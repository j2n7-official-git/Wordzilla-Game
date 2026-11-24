/**
 * ============================================================================
 * @file        wordzilla_cpnt_game/js/wz_word_drop.js
 * @project     WORDZILLA (Web Component - Đồ Án Cơ Sở)
 * @module      WordDropPhysicsEngine
 * @description Quản lý khởi tạo khung thẻ gỗ, tính toán tọa độ rơi theo delta-time
 *              và khóa giới hạn va chạm tại vạch biên cách đáy 125px.
 * ============================================================================
 */

export class WordzillaDropEngine {
  /**
   * @param {string} [playfieldSelector='#wz-playfield'] - Selector vùng chứa thẻ rơi
   * @param {Object} [options]
   * @param {number} [options.bottomLimitPx=140] - Chiều cao vùng che giới hạn tính từ đáy (px)
   */
  constructor(playfieldSelector = '#wz-playfield', { bottomLimitPx = 140 } = {}) {
    this.playfield = document.querySelector(playfieldSelector);
    this.bottomLimitPx = bottomLimitPx;
    this.activeCards = [];
    this.rafId = null;
    this.lastTimestamp = null;
  }

  /**
   * Tạo DOM khung thẻ gỗ theo đúng cấu trúc 2 tầng + ô kem
   * @param {string} word - Từ hiển thị bên trong khung
   * @returns {HTMLElement}
   */
  createCardElement(word = 'DRAGON') {
    const card = document.createElement('div');
    card.className = 'wz-word-card';
    card.innerHTML = `
      <div class="wz-word-card__cap"></div>
      <div class="wz-word-card__body">
        <div class="wz-word-card__slot">${word}</div>
      </div>
    `;
    return card;
  }

  /**
   * Thả 1 thẻ gỗ từ mép trên xuống vạch giới hạn 125px
   * @param {string} word - Từ cần hiển thị
   * @param {number} [speedPxPerSec=135] - Vận tốc rơi (px/giây)
   */
  spawnCard(word = 'DRAGON', speedPxPerSec = 135) {
    if (!this.playfield) return null;
    this.playfield.classList.add('is-active');

    const el = this.createCardElement(word);
    this.playfield.appendChild(el);

    const cardWidth = el.offsetWidth || 250;
    const cardHeight = el.offsetHeight || 120;
    const stageWidth = this.playfield.clientWidth;

    // Căn giữa ngang (hoặc random trong vùng an toàn nếu thả nhiều thẻ)
    const x = Math.max(16, (stageWidth - cardWidth) / 2);
    const y = -cardHeight;

    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    const cardState = {
      el,
      word,
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      speed: speedPxPerSec,
      reachedLimit: false,
    };

    this.activeCards.push(cardState);
    this.startLoop();
    return cardState;
  }

  startLoop() {
    if (this.rafId !== null) return;
    this.lastTimestamp = null;

    const tick = (timestamp) => {
      if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
      const dt = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      const stageHeight = this.playfield.clientHeight;
      // Tọa độ Y của vạch biên tính từ mép trên khung chơi
      const limitLineY = stageHeight - this.bottomLimitPx;

      this.activeCards.forEach((card) => {
        if (card.reachedLimit) return;

        card.y += card.speed * dt;

        // Kiểm tra đáy thẻ chạm đúng vạch biên 125px
        if (card.y + card.height >= limitLineY) {
          card.y = limitLineY - card.height;
          card.reachedLimit = true;
          card.el.classList.add('is-at-limit');
        }

        card.el.style.transform = `translate3d(${card.x.toFixed(1)}px, ${card.y.toFixed(1)}px, 0)`;
      });

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }
}