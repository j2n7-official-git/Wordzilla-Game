export class WordzillaInstructionBook {
  /**
   * @param {Object} options
   * @param {Array<{ left?: string, right?: string }>} [options.pages=[]] - Danh sách trang 1..n
   */
  constructor({ pages = [] } = {}) {
    this.openBtn = document.getElementById('wz-btn-instruction');
    this.modal = document.getElementById('wz-instruction-modal');
    this.closeBtn = document.getElementById('wz-btn-close-book');
    this.leftBox = this.modal?.querySelector('.wz-book-left-box') || null;
    this.rightContent = document.getElementById('wz-book-right-content');
    this.pageIndicator = document.getElementById('wz-book-page-indicator');

    /**
     * @doclogger Bộ 4 trang hướng dẫn cơ bản (1/4 -> 4/4) phục vụ chụp ảnh minh họa:
     *            Trang 1: Chào mừng | Trang 2-4: Gõ từ, Gợi ý & Combo, 3 Hoa sinh mạng.
     */
    const defaultPages = [
      {
        left: `<img src="src/wz_instruction_content/wz_instruct_logo.png" alt="Logo WordZilla" class="wz-book-hero-img" />`,
        right: `
          <h2 class="wz-book-welcome-title">CHÀO MỪNG BẠN ĐẾN VỚI WORDZILLA</h2>
          <p class="wz-book-page-desc">
            WordZilla là trò chơi rèn luyện phản xạ từ vựng tiếng Anh tốc độ cao. Các thẻ từ tiếng Việt sẽ liên tục rơi từ trên xuống; nhiệm vụ của bạn là gõ thật nhanh và chính xác từ tiếng Anh tương ứng trước khi chúng chạm đáy để giữ chuỗi Combo và bảo vệ 3 bông hoa sinh mạng.
          </p>
        `
      },
      {
        left: `<img src="src/wz_instruction_content/wz_instruct_1.png" alt="Bắt đầu và gõ từ" class="wz-book-hero-img" />`,
        right: `
          <h3 class="wz-book-page-title">1. Bắt Đầu & Gõ Từ Trực Tiếp</h3>
          <p class="wz-book-page-desc">
            Nhập tên người chơi, chọn độ khó (<em>Dễ, Trung bình</em> hoặc <em>Khó</em>) rồi nhấn <strong>Bắt đầu</strong> để vào ván. Khi thẻ từ tiếng Việt rơi xuống, hãy gõ thẳng từ tiếng Anh tương ứng — gõ đúng ký tự cuối là thẻ tự động vỡ và cộng điểm mà không cần dùng chuột hay nhấn Enter.
          </p>
        `
      },
      {
        left: `<img src="src/wz_instruction_content/wz_instruct_2.png" alt="Gợi ý chữ và Combo" class="wz-book-hero-img" />`,
        right: `
          <h3 class="wz-book-page-title">2. Gợi Ý Chữ & Chuỗi Combo</h3>
          <p class="wz-book-page-desc">
            Mỗi thẻ từ hiện sẵn chữ cái đầu và số ô trống, tự mở dần theo từng chữ bạn gõ đúng (cụm từ ghép viết liền không dấu cách, ví dụ: <strong>icecream</strong>). Sau khi phá xong một từ, hoàn thành từ tiếp theo trong <strong>5 giây</strong> để kích hoạt Combo nhân điểm.
          </p>
        `
      },
      {
        left: `<img src="src/wz_instruction_content/wz_instruct_3.png" alt="Hệ thống 3 bông hoa sinh mạng" class="wz-book-hero-img" />`,
        right: `
          <h3 class="wz-book-page-title">3. Hệ Thống 3 Bông Hoa Sinh Mạng</h3>
          <p class="wz-book-page-desc">
            Bạn bắt đầu mỗi lượt chơi với <strong>3 bông hoa</strong> sinh mạng ở thanh trạng thái phía trên. Nếu để thẻ từ rơi chạm vạch đỏ phía dưới mà chưa kịp gõ xong đáp án, bạn sẽ mất 1 bông hoa; khi cả 3 bông hoa đều tàn, ván chơi kết thúc và hiển thị tổng điểm đạt được.
          </p>
        `
      },
      {
        left: `<img src="src/wz_instruction_content/wz_instruct_4.png" alt="Điều khiển và mẹo chơi" class="wz-book-hero-img" />`,
        right: `
          <h3 class="wz-book-page-title">4. Điều Khiển & Mẹo Chinh Phục</h3>
          <p class="wz-book-page-desc">
            Dùng các nút tiện ích ở góc màn hình để bật/tắt âm thanh, xem lại hướng dẫn hoặc thoát ván bất cứ lúc nào. Khi chơi, hãy ưu tiên gõ thẻ từ rơi gần vạch đỏ nhất, chọn từ đồng nghĩa ngắn gọn và giữ nhịp gõ đều tay để nhân tối đa điểm thưởng!
          </p>
        `
      }
    ];

    this.pages = pages.length > 0 ? pages : defaultPages;
    this.currentIndex = 0;

    this.initPaginationUI();
    this.bindEvents();
    this.renderPage(0);
  }

  /**
   * @doclogger Tạo thanh điều hướng gọn [ ◀ ]   1/4   [ ▶ ] không dùng vạch nối.
   */
  initPaginationUI() {
    if (!this.pageIndicator || !this.pageIndicator.parentElement) return;

    const navBar = document.createElement('div');
    navBar.className = 'wz-book-pagination';

    this.prevBtn = document.createElement('button');
    this.prevBtn.type = 'button';
    this.prevBtn.className = 'wz-book-nav-btn';
    this.prevBtn.textContent = '◀';
    this.prevBtn.setAttribute('aria-label', 'Trang trước');

    this.nextBtn = document.createElement('button');
    this.nextBtn.type = 'button';
    this.nextBtn.className = 'wz-book-nav-btn';
    this.nextBtn.textContent = '▶';
    this.nextBtn.setAttribute('aria-label', 'Trang sau');

    this.pageIndicator.parentElement.insertBefore(navBar, this.pageIndicator);
    navBar.append(this.prevBtn, this.pageIndicator, this.nextBtn);
  }

  /**
   * @doclogger Gắn sự kiện mở/đóng sách, bấm nút ◀ / ▶ và phím mũi tên Trái/Phải.
   */
  bindEvents() {
    if (!this.openBtn || !this.modal) return;

    this.openBtn.addEventListener('click', () => this.open());
    this.closeBtn?.addEventListener('click', () => this.close());
    this.prevBtn?.addEventListener('click', () => this.renderPage(this.currentIndex - 1));
    this.nextBtn?.addEventListener('click', () => this.renderPage(this.currentIndex + 1));

    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) this.close();
    });

    document.addEventListener('keydown', (event) => {
      if (!this.modal?.classList.contains('is-open')) return;
      if (event.key === 'ArrowLeft') this.renderPage(this.currentIndex - 1);
      if (event.key === 'ArrowRight') this.renderPage(this.currentIndex + 1);
      if (event.key === 'Escape') this.close();
    });
  }

  open() {
    this.modal?.classList.add('is-open');
  }

  close() {
    this.modal?.classList.remove('is-open');
  }

  /**
   * @doclogger Render phẳng trang hiện tại, gắn thuộc tính data-page="1..n"
   *            để tinh chỉnh font-size riêng từng trang mà không làm xô khung.
   * @param {number} index
   */
  renderPage(index) {
    const total = this.pages.length;
    const safeIndex = Math.max(0, Math.min(index, total - 1));
    this.currentIndex = safeIndex;

    const pageData = this.pages[safeIndex] || {};
    if (this.leftBox) this.leftBox.innerHTML = pageData.left || '';
    if (this.rightContent) {
      this.rightContent.dataset.page = String(safeIndex + 1); /* @doclogger Đánh dấu số trang (1..5) cho CSS điều chỉnh font-size riêng */
      this.rightContent.innerHTML = pageData.right || '';
    }
    if (this.pageIndicator) {
      this.pageIndicator.textContent = `${safeIndex + 1}/${total}`;
    }

    if (this.prevBtn) this.prevBtn.disabled = safeIndex === 0;
    if (this.nextBtn) this.nextBtn.disabled = safeIndex === total - 1;
  }
}