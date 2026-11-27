/**
 * ============================================================================
 * @file        wordzilla_cpnt_game/js/wz_slides.js
 * @project     WORDZILLA (Web Component - Đồ Án Cơ Sở)
 * @module      SlideController
 * @description Điều khiển Form Sign In (Slide 1), chặn người chơi vô danh bằng
 *              bong bóng hội thoại + âm thanh lỗi, và hiệu ứng mở màn 4 phía.
 * ============================================================================
 */

export class WordzillaSlideManager {
  constructor(containerSelector = '#wz-ui-root') {
    this.container = document.querySelector(containerSelector);
    this.curtain = document.getElementById('wz-curtain-window');
    this.slide1 = document.getElementById('wz-slide-1');
    this.logo = document.getElementById('wz-game-logo');
    this.versionTag = document.getElementById('wz-version-tag');
    this.playerNameInput = document.getElementById('wz-player-name');
    this.errorBubble = document.getElementById('wz-name-error-bubble');
    this.diffButtons = document.querySelectorAll('.wz-diff-btn');
    this.startBtn = document.getElementById('wz-btn-start');

    this.selectedDifficulty = 'easy';
    this.onGameStart = null;
    this.bubbleTimer = null;

    // @branch PRELOAD_ERROR_SFX: Nạp sẵn âm thanh báo lỗi khi bỏ trống tên
    this.errorSound = new Audio('src/sfx/wz_error_sound.wav');
    this.errorSound.preload = 'auto';

    this.bindEvents();
  }

  /**
   * Gắn sự kiện chọn độ khó, nhập tên (tắt lỗi / Enter để chơi) và nút CHƠI
   */
  bindEvents() {
    this.diffButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.diffButtons.forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        this.selectedDifficulty = btn.dataset.diff || 'easy';
      });
    });

    if (this.playerNameInput) {
      this.playerNameInput.addEventListener('input', () => {
        if (this.playerNameInput.value.trim().length > 0) {
          this.hideNameError();
        }
      });

      this.playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.startBtn?.click();
      });
    }

    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => this.playStartTransition(this.onGameStart));
    }
  }

  /**
   * Hiển thị bong bóng lỗi chỉ vào ô nhập tên, rung ô & phát âm thanh cảnh báo
   * @param {string} msg - Nội dung thông báo lỗi
   */
  showNameError(msg = 'ERROR: Bạn cần nhập tên trước khi chơi') {
    if (this.errorBubble) {
      this.errorBubble.textContent = msg;
      this.errorBubble.classList.add('is-visible');
    }

    if (this.playerNameInput) {
      this.playerNameInput.classList.remove('is-shaking');
      void this.playerNameInput.offsetWidth; // Reset reflow để kích hoạt lại animation
      this.playerNameInput.classList.add('is-shaking');
      this.playerNameInput.focus();
    }

    // Phát lại âm thanh từ đầu kể cả khi người chơi bấm liên tục
    if (this.errorSound) {
      this.errorSound.currentTime = 0;
      this.errorSound.play().catch(() => {});
    }

    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.hideNameError(), 3500);
  }

  /**
   * Ẩn bong bóng báo lỗi và xóa trạng thái rung của ô nhập tên
   */
  hideNameError() {
    this.errorBubble?.classList.remove('is-visible');
    this.playerNameInput?.classList.remove('is-shaking');
  }

  /**
   * Kiểm tra tên hợp lệ -> Fade-out form & logo -> Stretch màn che ra 4 phía
   * @param {Function} [onComplete] - Callback kích hoạt vòng lặp rơi từ sau khi mở màn
   */
  playStartTransition(onComplete) {
    const playerName = (this.playerNameInput?.value || '').trim();

    if (!playerName) {
      this.showNameError('ERROR: Bạn cần nhập tên trước khi chơi');
      return;
    }

    this.hideNameError();

    // Gỡ trạng thái fade-in của vòng lặp trước (nếu có)
    this.slide1?.classList.remove('is-fading-in');
    this.logo?.classList.remove('is-fading-in');
    this.versionTag?.classList.remove('is-fading-in');

    // Bước 1: Fade out form Slide 1, Logo & Tag phiên bản
    this.slide1?.classList.add('is-fading-out');
    this.logo?.classList.add('is-fading-out');
    this.versionTag?.classList.add('is-fading-out');

    // Bước 2: Sau 260ms, giãn rộng cửa sổ & đẩy màn che Sky Steel ra 4 phía
    setTimeout(() => {
      this.curtain?.classList.add('is-stretching');
    }, 260);

    // Bước 3: Sau khi giãn xong (980ms), ẩn hẳn màn che để bắt đầu chơi
    setTimeout(() => {
      this.curtain?.classList.add('is-hidden');
      if (typeof onComplete === 'function') {
        onComplete({ playerName, difficulty: this.selectedDifficulty });
      }
    }, 980);
  }

  /**
   * ==========================================================================
   * @module      [UPDATE] ReturnToSlide1CurtainContractTransition
   * @doclogger   - Bước 1: Hiện lại tường Sky Steel từ trạng thái giãn rộng
   *                (.is-stretching) và thu ngược khung lỗ gỗ nâu 720x380px
   *                vào chính giữa màn hình trong 700ms.
   *              - Bước 2: Kích hoạt fade-in đúng 0.6s cho toàn bộ Logo,
   *                Form Slide 1 và Tag phiên bản để khép kín vòng lặp.
   * ==========================================================================
   */
  playReturnToSlide1Transition(onComplete) {
    if (!this.curtain) return;

    this.slide1?.classList.remove('is-fading-in');
    this.logo?.classList.remove('is-fading-in');
    this.versionTag?.classList.remove('is-fading-in');

    this.slide1?.classList.add('is-fading-out');
    this.logo?.classList.add('is-fading-out');
    this.versionTag?.classList.add('is-fading-out');

    // Bật tường xanh ở trạng thái mở rộng -> ép Reflow -> thu về kích thước chuẩn
    this.curtain.classList.add('is-stretching');
    this.curtain.classList.remove('is-hidden');
    void this.curtain.offsetWidth;
    this.curtain.classList.remove('is-stretching');

    // Sau 700ms tường thu xong -> Fade-in 0.6s toàn bộ giao diện Slide 1
    setTimeout(() => {
      this.slide1?.classList.add('is-fading-in');
      this.logo?.classList.add('is-fading-in');
      this.versionTag?.classList.add('is-fading-in');

      this.slide1?.classList.remove('is-fading-out');
      this.logo?.classList.remove('is-fading-out');
      this.versionTag?.classList.remove('is-fading-out');

      setTimeout(() => {
        this.playerNameInput?.focus();
        if (typeof onComplete === 'function') onComplete();
      }, 600);
    }, 700);
  }
}