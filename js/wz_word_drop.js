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
import { formatWordHint, normalizeAlphaWord } from './wz_dictionary.js';

/**
 * @constant    BASE_DROP_SPEED
 * @description   Tốc độ rơi chuẩn gốc (1.0x) tính bằng px/giây.
 *              Chỉ cần chỉnh duy nhất hằng số này để thay đổi tốc độ toàn game.
 */
export const BASE_DROP_SPEED = 80;

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

    // @branch [UPDATE] ON_CARD_MISSED_HOOK
    // @docstring Callback lưu hàm xử lý trừ mạng hoa từ wz_main.js truyền vào.
    //            Dùng cơ chế Callback Pattern giúp Engine vật lý tách biệt hoàn toàn
    //            với giao diện HUD (không cần query DOM mạng hoa bên trong file vật lý).
    this.onCardMissed = null;
    this.isFrozen = false; // UPDATE: Cờ đóng băng toàn bộ thẻ rơi & băng truyền khi hết mạng cuối
  }

  /**
   * @description Tạo DOM khung thẻ gỗ 2 tầng + ô kem ép lõm
   * @param {string} displayWord - Chữ hiển thị trên thẻ
   * @returns {HTMLElement}
   */
  /**
   * [UPDATE] Tạo DOM khung thẻ gỗ gồm nắp nâu đậm chứa gợi ý vàng + ô kem nghĩa tiếng Việt
   * @description Gắn thêm thẻ <span class="wz-word-card__hint"> bên trong .wz-word-card__cap
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
   * @description Khởi tạo 6 mảnh vỡ vật lý thật (không fade mờ):
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
   * @description Hiển thị chữ [+ số điểm] bay float lên tại tâm thẻ vừa giải đúng
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
   * @description Kích hoạt băng truyền từ vựng liên tục (Conveyor Stream):
   *            - Duy trì lưu lượng tối đa `maxOnScreen` ô cùng lúc trên màn hình
   *            - Vận tốc chuẩn hóa theo chiều cao 1 slide (5.0s ở 1.0x) * speedMultiplier
   *            - Chia 3 làn ngang luân phiên để các ô nối đuôi nhau không bao giờ đè chữ
   * @param {Array<{vi: string, en: string}>} dictionary - Kho 60 từ vựng
   * @param {Object} [options]
   * @param {number} [options.speedMultiplier=0.8] - Hệ số tốc độ (Dễ = 0.8x)
   * @param {number} [options.maxOnScreen=3] - Lưu lượng ô tối đa trên 1 màn hình
   */
  startDictionaryGame(dictionary, { speedMultiplier = 0.8, maxOnScreen = 3 } = {}) {
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
   * @module      DynamicSpeedEscalation
   * @description   Tăng hệ số tốc độ rơi thêm `step` (+0.05) mỗi mốc 15 từ giải đúng,
   *              đồng thời cập nhật lại vận tốc các thẻ đang rơi trên màn hình.
   */
  increaseSpeedMultiplier(step = 0.05) {
    if (!this.streamConfig) return 0;

    const prevMultiplier = this.streamConfig.speedMultiplier;
    const nextMultiplier = Number((prevMultiplier + step).toFixed(2));
    this.streamConfig.speedMultiplier = nextMultiplier;

    const scaleRatio = nextMultiplier / prevMultiplier;
    this.activeCards.forEach((card) => {
      card.speed *= scaleRatio;
    });

    return nextMultiplier;
  }

  /**
   * @module      FreezePlayfieldEngine
   * @doclogger   Đóng băng tức thì mọi thẻ từ đang lơ lửng trên màn hình và ngắt
   *              băng truyền thả từ mới, nhưng vẫn cho phép 6 mảnh vỡ của thẻ cuối
   *              cùng rơi hết quỹ đạo trọng lực rồi mới dừng requestAnimationFrame.
   */
  freeze() {
    this.isFrozen = true;
  }

  /**
   * @module      StopAndClearEngine
   * @doclogger   Ngắt vòng lặp requestAnimationFrame, mở khóa đóng băng, xóa sạch
   *              hàng đợi từ vựng, thẻ đang rơi và mảnh vỡ gỗ khi thoát hoặc chơi lại.
   */
  stopAndClear() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isFrozen = false;
    this.lastTimestamp = null;
    this.streamConfig = null;
    this.wordQueue = [];
    this.spawnTimer = 0;

    this.activeCards.forEach((card) => card.el?.remove());
    this.activeCards = [];

    this.debrisParticles.forEach((p) => p.el?.remove());
    this.debrisParticles = [];

    this.playfield?.classList.remove('is-active');
  }

  /**
   * [REPLACE] Thả 1 thẻ gỗ hỗ trợ cả từ đơn lẫn từ ghép có '-' / khoảng trắng
   * @description Lưu `rawAnswer` (VD: 'last-minute') để hiển thị dấu '-' trên nắp gỗ
   *            và `answer` (VD: 'lastminute') để đối chiếu gõ liền & tính điểm.
   */
  spawnCard(
    displayWord = 'DRAGON',
    speedPxPerSec = 80,
    answerWord = displayWord,
    laneIndex = null,
    totalLanes = 3
  ) {
    if (!this.playfield) return null;
    this.playfield.classList.add('is-active');

    const rawAnswer = answerWord.toLowerCase().trim();
    const normalizedAnswer = normalizeAlphaWord(rawAnswer);
    const initialHint = formatWordHint(rawAnswer, 1);

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
      rawAnswer,
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
   * [REPLACE] Đồng bộ mở từng chữ cái khớp trên nắp gỗ, tự bỏ qua '-' và dấu cách
   */
  syncTypingHints(inputWord) {
    const typed = normalizeAlphaWord(inputWord);

    this.activeCards.forEach((card) => {
      if (!card.hintEl) return;

      const isPrefixMatch = typed.length > 0 && card.answer.startsWith(typed);
      const revealCount = isPrefixMatch ? typed.length : 1;

      const nextHint = formatWordHint(card.rawAnswer || card.answer, revealCount);
      if (card.hintEl.textContent !== nextHint) {
        card.hintEl.textContent = nextHint;
      }
    });
  }

  /**
   * ==========================================================================
   * @module      UnifiedWordMatchAndScoreController
   * @description Đối chiếu chuỗi người chơi gõ với các thẻ đang rơi trên màn hình:
   *              - Hỗ trợ gõ liền không cần dấu '-' hay dấu cách (VD: 'lastminute',
   *                'onthecorner' đều khớp với 'last-minute', 'on the corner').
   *              - Nếu có 2 thẻ trùng đáp án cùng rơi, ưu tiên phá hủy thẻ nằm thấp
   *                nhất (gần vạch nguy hiểm 140px nhất) để cứu mạng cho người chơi.
   *              - Tính điểm theo công thức: 20 * (L - 1) với L là tổng số chữ cái
   *                thực tế (đã loại bỏ dấu cách và gạch nối).
   * ==========================================================================
   */
  checkAndDestroyWord(inputWord) {
    // 1. Chuẩn hóa chuỗi người chơi nhập: đưa về chữ thường & xóa sạch dấu cách, gạch nối '-'
    const normalizedInput = normalizeAlphaWord(inputWord);
    if (!normalizedInput) return { matched: false, points: 0 };

    // 2. Quét toàn bộ thẻ đang rơi để tìm thẻ khớp đáp án VÀ có tọa độ Y lớn nhất (nằm thấp nhất)
    let targetIndex = -1;
    let lowestCardY = -Infinity; // Khởi tạo mốc âm vô cực để mọi tọa độ Y hợp lệ đều lớn hơn

    this.activeCards.forEach((card, idx) => {
      if (card.answer === normalizedInput && card.y > lowestCardY) {
        lowestCardY = card.y;
        targetIndex = idx;
      }
    });

    // 3. Nếu tìm thấy thẻ mục tiêu -> Kích nổ vật lý, cộng điểm và dọn sạch thẻ khỏi màn hình
    if (targetIndex !== -1) {
      const targetCard = this.activeCards[targetIndex];

      // Công thức điểm: 20 điểm cho mỗi chữ cái tự gõ (trừ 1 chữ cái đầu đã gợi ý sẵn)
      // Math.max(1, ...) đảm bảo từ 1 ký tự vẫn được tối thiểu 20 điểm, không bị 0 điểm
      const earnedPoints = 20 * Math.max(1, targetCard.answer.length - 1);

      // Bung 6 mảnh vỡ gỗ tại đúng tọa độ (x, y) và kích thước của thẻ
      this.shatterCard(targetCard.x, targetCard.y, targetCard.width, targetCard.height);

      // Bay hiệu ứng [+ điểm] từ tâm hình chữ nhật của thẻ gỗ
      this.spawnScorePopup(
        targetCard.x + targetCard.width / 2,
        targetCard.y + targetCard.height / 2,
        earnedPoints
      );

      // Gỡ thẻ HTML khỏi giao diện và cắt khỏi mảng quản lý activeCards để ngừng tính rơi
      targetCard.el.remove();
      this.activeCards.splice(targetIndex, 1);

      return { matched: true, points: earnedPoints };
    }

    return { matched: false, points: 0 };
  }

  /**
   * @description Vòng lặp 60fps điều khiển băng truyền lưu lượng liên tục & vật lý mảnh vỡ
   */
  startLoop() {
    if (this.rafId !== null) return;
    this.lastTimestamp = null;

    const tick = (timestamp) => {
      if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
      const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
      this.lastTimestamp = timestamp;

      /* [CỤM 1 - DOM GEOMETRY API]:
         - .clientHeight: Thuộc tính chuẩn của HTML DOM dùng để đo chiều cao lọt lòng
           (tính bằng px) của khung sân chơi #wz-playfield (không tính viền border).
         - limitLineY: Quy đổi mốc cách đáy 140px thành tọa độ Y tính từ đỉnh trời xuống. */
      const stageHeight = this.playfield.clientHeight;
      const limitLineY = stageHeight - this.bottomLimitPx;

      /* [CỤM 2 - STATE GATE PATTERN (CỜ CHỐT TRẠNG THÁI) & DUYỆT NGƯỢC MẢNG]:
        - Tại sao dùng cờ `if (!this.isFrozen)` thay vì hủy hẳn vòng lặp?
          Vì khi hết mạng cuối, ta muốn thẻ đang rơi đứng yên (đóng băng), nhưng
          6 mảnh vỡ của thẻ cuối cùng vẫn phải rơi nốt theo trọng lực cho tự nhiên.
        - Tại sao phải duyệt ngược `for (let i = length - 1; i >= 0; i--)`?
          Đây là kỹ thuật kinh điển trong Game Loop: khi xóa phần tử bằng `.splice(i, 1)`,
          mảng sẽ dồn các phần tử phía sau lên. Nếu duyệt xuôi từ 0, phần tử kế tiếp
           sẽ bị nhảy lùi index và bị vòng lặp bỏ sót! Duyệt từ đuôi về đầu tránh 100% lỗi này. */
      if (!this.isFrozen) {
        for (let i = this.activeCards.length - 1; i >= 0; i--) {
          const card = this.activeCards[i];
          card.y += card.speed * dt; // Quãng đường rơi = Vận tốc * Thời gian trôi qua (Delta-Time)

          // Kiểm tra đáy thẻ (card.y + card.height) đã chạm hoặc vượt vạch biên 140px chưa
          if (card.y + card.height >= limitLineY) {
            this.shatterCard(card.x, limitLineY - card.height, card.width, card.height);

            /* [TÁCH BIỆT DOM VÀ BỘ NHỚ (MEMORY MANAGEMENT)]:
              - card.el.remove(): Gỡ thẻ HTML khỏi giao diện trình duyệt nhìn thấy.
              - .splice(i, 1): Cắt bỏ dữ liệu thẻ khỏi mảng JS. Phải làm đủ cả 2 bước,
                 nếu thiếu 1 trong 2 sẽ sinh ra "thẻ ma" hoặc rò rỉ bộ nhớ (Memory Leak). */
            card.el.remove();
            this.activeCards.splice(i, 1);

            /* [OBSERVER / CALLBACK HOOK PATTERN]:
              - Kiểm tra `typeof ... === 'function'` trước khi gọi giúp lớp vật lý
                (`wz_word_drop.js`) hoàn toàn độc lập, không cần biết bên ngoài
                 (`wz_main.js`) đang hiển thị mạng sống bằng bông hoa hay trái tim. */
            if (typeof this.onCardMissed === 'function') {
              this.onCardMissed(card);
            }
            continue; // Bỏ qua lệnh dịch chuyển bên dưới vì thẻ này đã nổ xong
          }

          /* [GPU HARDWARE ACCELERATION - TĂNG TỐC PHẦN CỨNG]:
            - Nguồn gốc từ CSS3 Compositor Layer: Thay vì gán `card.style.top = ...`
              (ép CPU tính lại bố cục toàn trang - Reflow rất giật lag), `translate3d(..., 0)`
              đẩy riêng thẻ gỗ lên Card đồ họa (GPU) để trượt mượt 60fps.
             - `.toFixed(1)`: Làm tròn 1 chữ số thập phân để chuỗi CSS gọn nhẹ và chống rung chữ. */
          card.el.style.transform = `translate3d(${card.x.toFixed(1)}px, ${card.y.toFixed(1)}px, 0)`;
        }
      }

      /* [CỤM 3 - TÍCH PHÂN EULER (SEMI-IMPLICIT EULER INTEGRATION) TRONG VẬT LÝ GAME 2D]:
        - Nguồn gốc từ cơ học cổ điển Newton áp dụng cho game loop rời rạc theo từng frame `dt`:
           1. `p.vy += p.gravity * dt`: Trọng lực kéo vận tốc rơi thẳng đứng tăng dần theo thời gian.
           2. `p.x += p.vx * dt` & `p.y += p.vy * dt`: Cập nhật tọa độ X, Y mới từ vận tốc vừa tính.
           3. `p.rot += p.vRot * dt`: Cộng dồn góc xoay tạo cảm giác mảnh gỗ văng lộn nhào.
        - Cụm này nằm ngoài `if (!this.isFrozen)` nên khi Game Over, mảnh vỡ của từ cuối
           vẫn rơi hết khỏi đáy màn hình (`stageHeight + 80`) rồi mới tự hủy. */
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

      /* [CỤM 4 - BĂNG TRUYỀN LƯU LƯỢNG & TOÁN HỌC ĐỒNG DƯ (MODULO ARITHMETIC)]:
        - `const { speedMultiplier, ... } = this.streamConfig`: Cú pháp ES6 Object Destructuring
          giúp "bóc" nhanh nhiều thuộc tính từ object ra thành biến cục bộ trong 1 dòng.
        - `this.wordQueue.pop()`: Cấu trúc ngăn xếp LIFO (Last-In, First-Out), lấy và xóa phần tử
          cuối mảng với tốc độ O(1) — nhanh hơn hẳn `.shift()` đầu mảng vốn tốn O(n).
        - `(this.nextLane + 1 + Math.floor(Math.random() * 2)) % totalLanes`:
          + `Math.floor(Math.random() * 2)` chỉ trả về `0` hoặc `1`.
          + Cộng thêm `1` thành bước nhảy `+1` hoặc `+2` làn (bắt buộc đổi cột, không bao giờ ra `0`).
          + Toán tử chia lấy dư `% 3` giúp chỉ số làn tự xoay vòng tròn `0 -> 1 -> 2 -> 0`
             mà không bao giờ bị tràn ra ngoài số làn cho phép. */
      if (!this.isFrozen && this.streamConfig && this.wordQueue.length > 0) {
        const { speedMultiplier, maxOnScreen, totalLanes } = this.streamConfig;
        const travelDistance = limitLineY + 120;
        const fallSpeed = BASE_DROP_SPEED * speedMultiplier;
        const cadenceSec = travelDistance / fallSpeed / maxOnScreen;

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.activeCards.length < maxOnScreen) {
          const nextItem = this.wordQueue.pop();
          this.spawnCard(nextItem.vi, fallSpeed, nextItem.en, this.nextLane, totalLanes);

          this.nextLane = (this.nextLane + 1 + Math.floor(Math.random() * 2)) % totalLanes;
          this.spawnTimer = cadenceSec;
        }
      }

      /* [CỤM 5 - AUTO SLEEP & REQUEST ANIMATION FRAME API]:
        - Khi đã đóng băng (`isFrozen`) VÀ mảnh vỡ cuối cùng đã rơi khuất (`length === 0`),
          ta chủ động `return` sớm để ngắt chuỗi gọi đệ quy, đưa mức tiêu thụ CPU về 0%.
        - `requestAnimationFrame(tick)`: API chuẩn của HTML5 (thay thế `setInterval` cũ kỹ),
          tự động đồng bộ nhịp vẽ theo tần số quét màn hình (60Hz/120Hz) và tự tạm dừng
           khi người chơi chuyển sang tab trình duyệt khác. */
      if (this.isFrozen && this.debrisParticles.length === 0) {
        this.rafId = null;
        return;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }
}