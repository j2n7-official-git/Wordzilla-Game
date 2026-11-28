/**
 * ============================================================================
 * @file        wordzilla_cpnt_game/js/wz_combo.js
 * @project     WORDZILLA (Web Component - Đồ Án Cơ Sở)
 * @module      WordzillaComboController
 * @doclogger   - Mục đích tổng bộ:
 *                1. Đếm chuỗi từ đúng liên tiếp (hiện UI từ Combo 2 trở lên).
 *                2. Ánh xạ ngầm sang 5 cấp hệ số [1.0, 1.2, 1.5, 1.8, 2.0].
 *                3. Làm tròn trần lên hàng chục: Math.ceil(raw / 10) * 10.
 *                4. Chạy tích phân đường (SVG Line Integral) trên vành viền gỗ
 *                   trong 4000ms: dịch chuyển strokeDashoffset theo chu vi
 *                   C = 2 * pi * r (r = 33px) từ trục 90 độ (đỉnh 12h) đủ 2pi;
 *                   khi quét hết vòng sẽ tự dập lửa combo (reset về 0).
 * ============================================================================ */

const HIDDEN_MULTIPLIERS = [1.0, 1.2, 1.5, 1.8, 2.0];
const COMBO_COOLDOWN_MS = 5000; // Thời gian hạ nhiệt chuẩn 5 giây (2pi rad)
const RING_RADIUS = 33;         // Bán kính đường tâm vành viền gỗ 4px (70/2 - 4/2 = 33px)
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // Chu vi đường tròn C = 2πr ≈ 207.345px

export class WordzillaComboController {
  /**
   * @doclogger Khởi tạo tham chiếu DOM và cấu hình sẵn chu vi SVG strokeDasharray.
   */
  constructor(selectors = {}) {
    this.boxEl = document.querySelector(selectors.box || '#wz-combo-box');
    this.circleEl = document.querySelector(selectors.circle || '#wz-combo-circle');
    this.valueEl = document.querySelector(selectors.value || '#wz-combo-value');
    this.ringProgressEl = document.querySelector(selectors.ring || '#wz-combo-ring-progress');

    this.streakCount = 0;
    this.bounceTimer = null;
    this.cooldownRafId = null;
    this.cooldownStartTime = null;
    this.pausedElapsedMs = 0; // @doclogger Lưu thời gian đã trôi qua của vòng Combo tại lúc bấm Pause
    this.isPaused = false;    // @doclogger Cờ khóa vòng lặp SVG tích phân đường khi tạm dừng

    if (this.ringProgressEl) {
      this.ringProgressEl.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
      this.ringProgressEl.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
    }
  }

  getHiddenMultiplier() {
    if (this.streakCount <= 1) return 1.0;
    const stageIdx = Math.min(this.streakCount - 1, HIDDEN_MULTIPLIERS.length - 1);
    return HIDDEN_MULTIPLIERS[stageIdx];
  }

  calculatePoints(basePoints) {
    const rawScore = Number(basePoints || 0) * this.getHiddenMultiplier();
    return Math.ceil(rawScore / 10) * 10;
  }

  stopCooldownWipe() {
    if (this.cooldownRafId !== null) {
      cancelAnimationFrame(this.cooldownRafId);
      this.cooldownRafId = null;
    }
    this.cooldownStartTime = null;
    this.pausedElapsedMs = 0;
    this.isPaused = false;

    if (this.ringProgressEl) {
      this.ringProgressEl.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
    }
  }

  /**
   * @doclogger Đóng băng vòng đếm ngược Combo và lưu lại phần thời gian đã chạy.
   */
  pause() {
    if (this.isPaused || this.cooldownRafId === null) return;
    this.isPaused = true;
    this.pausedElapsedMs = performance.now() - this.cooldownStartTime;
    cancelAnimationFrame(this.cooldownRafId);
    this.cooldownRafId = null;
  }

  /**
   * @doclogger Nối tiếp vòng đếm ngược Combo từ đúng vị trí góc đã đóng băng.
   */
  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.streakCount >= 2 && this.ringProgressEl) {
      this.cooldownStartTime = performance.now() - this.pausedElapsedMs;
      this.runCooldownLoop();
    }
  }

  /**
   * @doclogger Vòng lặp cập nhật strokeDashoffset theo thời gian thực.
   */
  runCooldownLoop() {
    const tick = (now) => {
      if (this.isPaused) return;
      const elapsed = now - this.cooldownStartTime;
      const progress = Math.min(1, elapsed / COMBO_COOLDOWN_MS);

      const remainingArcLength = RING_CIRCUMFERENCE * (1 - progress);
      this.ringProgressEl.style.strokeDashoffset = `${remainingArcLength.toFixed(3)}`;

      if (progress >= 1) {
        this.cooldownRafId = null;
        this.onWordMissed();
        return;
      }

      this.cooldownRafId = requestAnimationFrame(tick);
    };

    this.cooldownRafId = requestAnimationFrame(tick);
  }

  startCooldownWipe() {
    this.stopCooldownWipe();
    if (!this.ringProgressEl) return;

    this.cooldownStartTime = performance.now();
    this.runCooldownLoop();
  }

  /**
   * @doclogger Hiệu ứng zoom-bounce: phóng 100% -> nhỉnh 105% -> về lại 100%.
   */
  triggerZoomBounce() {
    if (!this.circleEl) return;

    if (this.bounceTimer) {
      clearTimeout(this.bounceTimer);
      this.bounceTimer = null;
    }

    this.circleEl.classList.remove('is-zoom-bounce');
    void this.circleEl.offsetWidth; // Ép trình duyệt reflow để chạy lại animation
    this.circleEl.classList.add('is-zoom-bounce');

    this.bounceTimer = setTimeout(() => {
      this.circleEl?.classList.remove('is-zoom-bounce');
      this.bounceTimer = null;
    }, 340);
  }

  /**
   * @doclogger Đồng bộ hiển thị: chỉ mở UI từ Combo 2 trở lên, ẩn ở 0 và 1.
   */
  renderUI({ animate = false } = {}) {
    const shouldShow = this.streakCount >= 2;
    this.boxEl?.classList.toggle('is-visible', shouldShow);

    if (!shouldShow) return;

    if (this.valueEl) {
      this.valueEl.textContent = String(this.streakCount);
    }

    if (this.circleEl) {
      this.circleEl.classList.toggle('is-max-maintain', this.streakCount >= 5);
    }

    if (animate) {
      this.triggerZoomBounce();
    }
  }

  /**
   * @doclogger Khi gõ đúng 1 từ: tăng chuỗi +1; nếu đạt từ Combo 2 trở lên thì
   *            nạp lại vòng tích phân đường 4s chạy dọc theo viền gỗ.
   */
  onWordMatched() {
    this.streakCount += 1;
    this.renderUI({ animate: this.streakCount >= 2 });

    if (this.streakCount >= 2) {
      this.startCooldownWipe();
    }
  }

  /**
   * @doclogger Khi thẻ chạm biên hoặc hết 4s hạ nhiệt: dập lửa combo về 0 và ẩn UI.
   */
  onWordMissed() {
    this.stopCooldownWipe();
    this.streakCount = 0;
    this.renderUI({ animate: false });
  }

  /**
   * @doclogger Ẩn badge và dọn sạch timer/rAF khi thoát về sảnh.
   */
  hide() {
    this.stopCooldownWipe();
    if (this.bounceTimer) {
      clearTimeout(this.bounceTimer);
      this.bounceTimer = null;
    }
    this.circleEl?.classList.remove('is-zoom-bounce');
    this.boxEl?.classList.remove('is-visible');
  }

  /**
   * @doclogger Reset sạch trạng thái combo đầu ván mới.
   */
  reset() {
    this.stopCooldownWipe();
    if (this.bounceTimer) {
      clearTimeout(this.bounceTimer);
      this.bounceTimer = null;
    }
    this.streakCount = 0;
    this.circleEl?.classList.remove('is-zoom-bounce');
    this.renderUI({ animate: false });
  }
}