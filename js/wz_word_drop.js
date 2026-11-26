/**
 * ============================================================================
 * @file        wordzilla_cpnt_game/js/wz_word_drop.js
 * @project     WORDZILLA (Web Component - Đồ Án Cơ Sở)
 * @module      WordDropPhysicsEngine
 * @description - Rơi thẻ gỗ theo delta-time & tự nổ khi vượt vạch biên 140px
 *              - Vật lý mảnh vỡ tự nhiên (gia tốc trọng trường g, vận tốc đầu vx/vy,
 *                mô-men xoay, giữ nguyên độ nét opacity: 1 đến khi rơi khỏi màn hình)
 *              - Công thức điểm: 20 * (số chữ cái - 1) + hiệu ứng [+ điểm] bay lên
 * ============================================================================
 */
import { formatWordHint } from './wz_dictionary.js';
export class WordzillaDropEngine {
  /**
   * @param {string} [playfieldSelector='#wz-playfield'] - Selector vùng chứa thẻ rơi
   * @param {Object} [options]
   * @param {number} [options.bottomLimitPx=140] - Khoảng cách vạch biên tính từ đáy (px)
   */
  constructor(playfieldSelector = '#wz-playfield', { bottomLimitPx = 140 } = {}) {
    this.playfield = document.querySelector(playfieldSelector);
    this.bottomLimitPx = bottomLimitPx;
    this.activeCards = [];
    this.debrisParticles = [];
    this.rafId = null;
    this.lastTimestamp = null;
    this.wordQueue = [];
    this.spawnTimer = 0;
    this.streamConfig = null;
  }

  /**
   * @doclogger Tạo DOM khung thẻ gỗ 2 tầng + ô kem ép lõm
   * @param {string} displayWord - Chữ hiển thị trên thẻ
   * @returns {HTMLElement}
   */
  /**
   * [UPDATE] Tạo DOM khung thẻ gỗ gồm nắp nâu đậm chứa gợi ý vàng + ô kem nghĩa tiếng Việt
   * @doclogger Gắn thêm thẻ <span class="wz-word-card__hint"> bên trong .wz-word-card__cap
   */
  createCardElement(displayWord = 'DRAGON', initialHint = '') {
    const card = document.createElement('div');
    card.className = 'wz-word-card';
    card.innerHTML = `
      <div class="wz-word-card__cap">
        <span class="wz-word-card__hint">${initialHint}</span>
      </div>
      <div class="wz-word-card__body">
        <div class="wz-word-card__slot">${displayWord}</div>
      </div>`;
    return card;
  }
  /**
   * @doclogger Khởi tạo 6 mảnh vỡ vật lý thật (không fade mờ):
   *            - 3 viên vuông gỗ nâu đậm 50x50px
   *            - 3 viên vuông dát gỗ màu da 32x32px
   *            - Mỗi mảnh có vận tốc ngang vx, lực nảy ban đầu vy và trọng lực g = 1150 px/s²
   */
  shatterCard(x, y, cardWidth = 250, cardHeight = 120) {
    if (!this.playfield) return;

    const centerX = x + cardWidth / 2;
    const centerY = y + cardHeight / 2;

    const specs = [
      { type: 'dark', size: 50, baseVx: -210 },
      { type: 'dark', size: 50, baseVx: -65 },
      { type: 'dark', size: 50, baseVx: 195 },
      { type: 'skin', size: 32, baseVx: -155 },
      { type: 'skin', size: 32, baseVx: 85 },
      { type: 'skin', size: 32, baseVx: 230 }
    ];

    specs.forEach((item) => {
      const el = document.createElement('div');
      el.className = `wz-debris wz-debris--${item.type}`;

      const startX = centerX - item.size / 2 + (Math.random() - 0.5) * 50;
      const startY = centerY - item.size / 2 + (Math.random() - 0.5) * 24;

      // Vận tốc ném xiên tự nhiên: bung ngang (vx) & hất nhẹ lên trước khi rơi tự do (vy < 0)
      const vx = item.baseVx + (Math.random() - 0.5) * 70;
      const vy = -(110 + Math.random() * 140);
      const rot = (Math.random() - 0.5) * 40;
      const vRot = (vx < 0 ? -1 : 1) * (240 + Math.random() * 260);

      el.style.transform = `translate3d(${startX.toFixed(1)}px, ${startY.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg)`;
      this.playfield.appendChild(el);

      this.debrisParticles.push({
        el,
        x: startX,
        y: startY,
        vx,
        vy,
        gravity: 1150, // Gia tốc trọng trường tự nhiên (px/s²)
        rot,
        vRot
      });
    });

    this.startLoop();
  }

  /**
   * @doclogger Hiển thị chữ [+ số điểm] bay float lên tại tâm thẻ vừa giải đúng
   *            (Tổng thời gian 0.7s, fade-out mượt trong 0.5s)
   */
  spawnScorePopup(centerX, centerY, points) {
    if (!this.playfield) return;

    const popup = document.createElement('div');
    popup.className = 'wz-score-popup';
    popup.textContent = `+${points}`;
    popup.style.left = `${centerX.toFixed(1)}px`;
    popup.style.top = `${centerY.toFixed(1)}px`;

    this.playfield.appendChild(popup);
    setTimeout(() => popup.remove(), 720);
  }

  /**
   * @doclogger Kích hoạt băng truyền từ vựng liên tục (Conveyor Stream):
   *            - Duy trì lưu lượng tối đa `maxOnScreen` ô cùng lúc trên màn hình
   *            - Vận tốc chuẩn hóa theo chiều cao 1 slide (5.0s ở 1.0x) * speedMultiplier
   *            - Chia 3 làn ngang luân phiên để các ô nối đuôi nhau không bao giờ đè chữ
   * @param {Array<{vi: string, en: string}>} dictionary - Kho 60 từ vựng
   * @param {Object} [options]
   * @param {number} [options.speedMultiplier=0.8] - Hệ số tốc độ (Dễ = 0.8x)
   * @param {number} [options.maxOnScreen=3] - Lưu lượng ô tối đa trên 1 màn hình
   */
  startDictionaryGame(
    dictionary,
    { speedMultiplier = 0.8, maxOnScreen = 3 } = {}
  ) {
    this.wordQueue = [...dictionary].sort(() => Math.random() - 0.5);
    this.streamConfig = {
      speedMultiplier,
      maxOnScreen,
      totalLanes: 3
    };
    this.nextLane = Math.floor(Math.random() * 3); // Làn xuất phát ngẫu nhiên (0, 1, 2)
    this.spawnTimer = 0.15; // Ô đầu tiên xuất hiện sau 0.15s
    this.startLoop();
  }

  /**
   * @doclogger Thả 1 thẻ gỗ vào đúng làn ngang được chỉ định, cách xa nhau & né Bảng điểm HUD
   */
  /**
   * [UPDATE] Thả 1 thẻ gỗ kèm chuỗi gợi ý ban đầu (VD: 'g _ _ _ _ _ _')
   * @doclogger Lưu tham chiếu `hintEl` vào `cardState` để cập nhật từng chữ 60fps
   *            mà không phải querySelector lại DOM mỗi lần người chơi gõ phím.
   */
  spawnCard(
    displayWord = 'DRAGON',
    speedPxPerSec = 100,
    answerWord = displayWord,
    laneIndex = null,
    totalLanes = 3
  ) {
    if (!this.playfield) return null;
    this.playfield.classList.add('is-active');

    const normalizedAnswer = answerWord.toLowerCase().trim();
    const initialHint = formatWordHint(normalizedAnswer, 1);

    const el = this.createCardElement(displayWord, initialHint);
    const hintEl = el.querySelector('.wz-word-card__hint');
    this.playfield.appendChild(el);

    const cardWidth = el.offsetWidth || 250;
    const cardHeight = el.offsetHeight || 120;
    const stageWidth = this.playfield.clientWidth;

    const leftMargin = 36;
    const safeAreaWidth = Math.max(cardWidth + 40, stageWidth - 250 - leftMargin);
    let x = leftMargin;

    if (laneIndex !== null && totalLanes > 1) {
      const stepX = (safeAreaWidth - cardWidth) / (totalLanes - 1);
      x = leftMargin + stepX * laneIndex;
    } else {
      x = leftMargin + Math.random() * Math.max(0, safeAreaWidth - cardWidth);
    }

    const y = -cardHeight;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    const cardState = {
      el,
      hintEl,
      word: displayWord,
      answer: normalizedAnswer,
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      speed: speedPxPerSec
    };

    this.activeCards.push(cardState);
    this.startLoop();
    return cardState;
  }

  /**
   * [UPDATE MODULE - Cùng cấp trên checkAndDestroyWord]
   * @branch      PROGRESSIVE_HINT_REVEAL_ON_TYPE (UPDATE v4.2)
   * @doclogger   - Mục đích: Đồng bộ tiến độ gõ của người chơi lên tất cả thẻ đang rơi.
   *              - Flow: Nếu `card.answer` bắt đầu bằng chuỗi đang gõ (`startsWith`),
   *                mở khóa đúng `typed.length` ký tự trên nắp gỗ (VD: g -> gi -> gir).
   *                Nếu gõ lệch hoặc xóa bớt chữ, tự động thu về mức khớp thực tế (tối thiểu 1).
   * @param {string} inputWord - Chuỗi người chơi đang gõ trong #wz-chat-input
   */
  syncTypingHints(inputWord) {
    const typed = (inputWord || '').toLowerCase().trim();

    this.activeCards.forEach((card) => {
      if (!card.hintEl) return;

      // Kiểm tra tiền tố (Prefix Match): từ đáp án có bắt đầu bằng chuỗi đang gõ không
      const isPrefixMatch = typed.length > 0 && card.answer.startsWith(typed);
      const revealCount = isPrefixMatch ? typed.length : 1;

      const nextHint = formatWordHint(card.answer, revealCount);
      if (card.hintEl.textContent !== nextHint) {
        card.hintEl.textContent = nextHint;
      }
    });
  }


  /**
   * @doclogger Kiểm tra từ người chơi gõ: khớp đáp án -> quy luật cổng điểm: nổ 6 mảnh & cộng 20*(len(word)-1) điểm
   */
  checkAndDestroyWord(inputWord) {
    const normalized = (inputWord || '').toLowerCase().trim();
    if (!normalized) return { matched: false, points: 0 };

    let targetIndex = -1;
    let maxY = -Infinity;

    this.activeCards.forEach((card, idx) => {
      if (card.answer === normalized && card.y > maxY) {
        maxY = card.y;
        targetIndex = idx;
      }
    });

    if (targetIndex !== -1) {
      const targetCard = this.activeCards[targetIndex];
      const earnedPoints = 20 * Math.max(1, targetCard.answer.length - 1);

      this.shatterCard(targetCard.x, targetCard.y, targetCard.width, targetCard.height);
      this.spawnScorePopup(
        targetCard.x + targetCard.width / 2,
        targetCard.y + targetCard.height / 2,
        earnedPoints
      );

      targetCard.el.remove();
      this.activeCards.splice(targetIndex, 1);
      return { matched: true, points: earnedPoints };
    }

    return { matched: false, points: 0 };
  }

  /**
   * @doclogger Vòng lặp 60fps điều khiển băng truyền lưu lượng liên tục & vật lý mảnh vỡ
   */
  startLoop() {
    if (this.rafId !== null) return;
    this.lastTimestamp = null;

    const tick = (timestamp) => {
      if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
      const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
      this.lastTimestamp = timestamp;

      const stageHeight = this.playfield.clientHeight;
      const limitLineY = stageHeight - this.bottomLimitPx;

      // 1. Cập nhật rơi thẻ từ vựng
      for (let i = this.activeCards.length - 1; i >= 0; i--) {
        const card = this.activeCards[i];
        card.y += card.speed * dt;

        // Vượt vạch biên 140px -> tự vỡ (không cộng điểm) & mất mạng & giải phóng 1 slot lưu lượng
        if (card.y + card.height >= limitLineY) {
          this.shatterCard(card.x, limitLineY - card.height, card.width, card.height);
          card.el.remove();
          this.activeCards.splice(i, 1);
          continue;
        }

        card.el.style.transform = `translate3d(${card.x.toFixed(1)}px, ${card.y.toFixed(1)}px, 0)`;
      }

      // 2. Cập nhật vật lý trọng lực cho 6 mảnh vỡ gỗ
      for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
        const p = this.debrisParticles[i];
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vRot * dt;

        if (p.y > stageHeight + 80) {
          p.el.remove();
          this.debrisParticles.splice(i, 1);
          continue;
        }

        p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${p.rot.toFixed(1)}deg)`;
      }

      // 3. Băng truyền lưu lượng liên tục (Conveyor Stream):
      //    Giữ tối đa `maxOnScreen` ô trên màn hình, ô sau nối đuôi ô trước đều đặn
      if (this.streamConfig && this.wordQueue.length > 0) {
        const { speedMultiplier, maxOnScreen, totalLanes } = this.streamConfig;
        const travelDistance = limitLineY + 120; // Quãng đường rơi hết 1 màn hình (px)
        const fallSpeed = (travelDistance / 5.0) * speedMultiplier;

        // Nhịp giãn cách tự động = (thời gian rơi hết slide / số ô lưu lượng)
        // Giúp 3 ô luôn rải đều bậc thang canon từ đỉnh xuống đáy màn hình
        const cadenceSec = travelDistance / fallSpeed / maxOnScreen;

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.activeCards.length < maxOnScreen) {
          const nextItem = this.wordQueue.pop();
          this.spawnCard(nextItem.vi, fallSpeed, nextItem.en, this.nextLane, totalLanes);

          // Đảo làn ngang sang làn khác để không bao giờ trùng cột với ô liền trước
          this.nextLane = (this.nextLane + 1 + Math.floor(Math.random() * 2)) % totalLanes;
          this.spawnTimer = cadenceSec;
        }
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }
}