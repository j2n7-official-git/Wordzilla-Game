/**
 * ============================================================================
 * @file        wordzilla_cpnt_game/js/wz_dictionary.js
 * @project     WORDZILLA (Web Component - Đồ Án Cơ Sở)
 * @module      DictionaryDatabase
 * @doclogger   Kho 60 từ vựng chuẩn SGK Tiếng Anh lớp 4 & lớp 5 (6 chủ điểm).
 *              Cấu trúc { vi: 'Nghĩa hiển thị trên thẻ gỗ', en: 'Đáp án gõ' }.
 * ============================================================================
 */

export const WZ_DICTIONARY = [
  // --- 1. TRƯỜNG HỌC & MÔN HỌC (12 từ) ---
  { vi: 'Phòng học', en: 'classroom' },     { vi: 'Thư viện', en: 'library' },
  { vi: 'Sân chơi', en: 'playground' },     { vi: 'Quyển vở', en: 'notebook' },
  { vi: 'Bút chì', en: 'pencil' },          { vi: 'Thước kẻ', en: 'ruler' },
  { vi: 'Cục tẩy', en: 'eraser' },          { vi: 'Giáo viên', en: 'teacher' },
  { vi: 'Học sinh', en: 'student' },        { vi: 'Môn Khoa học', en: 'science' },
  { vi: 'Môn Lịch sử', en: 'history' },     { vi: 'Môn Địa lý', en: 'geography' },

  // --- 2. ĐỘNG VẬT TRONG VƯỜN THÚ & TỰ NHIÊN (12 từ) ---
  { vi: 'Con voi', en: 'elephant' },        { vi: 'Con khỉ', en: 'monkey' },
  { vi: 'Con hổ', en: 'tiger' },            { vi: 'Con cá sấu', en: 'crocodile' },
  { vi: 'Con công', en: 'peacock' },        { vi: 'Con trăn', en: 'python' },
  { vi: 'Chuột túi', en: 'kangaroo' },      { vi: 'Cá heo', en: 'dolphin' },
  { vi: 'Con thỏ', en: 'rabbit' },          { vi: 'Con rùa', en: 'turtle' },
  { vi: 'Hươu cao cổ', en: 'giraffe' },     { vi: 'Ngựa vằn', en: 'zebra' },

  // --- 3. ĐỒ ĂN & THỨC UỐNG (12 từ) ---
  { vi: 'Quả táo', en: 'apple' },           { vi: 'Quả chuối', en: 'banana' },
  { vi: 'Quả cam', en: 'orange' },          { vi: 'Dưa hấu', en: 'watermelon' },
  { vi: 'Dâu tây', en: 'strawberry' },      { vi: 'Quả dứa', en: 'pineapple' },
  { vi: 'Thịt gà', en: 'chicken' },         { vi: 'Mì sợi', en: 'noodles' },
  { vi: 'Bánh mì', en: 'bread' },           { vi: 'Nước chanh', en: 'lemonade' },
  { vi: 'Sữa tươi', en: 'milk' },           { vi: 'Nước lọc', en: 'water' },

  // --- 4. THỜI TIẾT & CÁC MÙA (8 từ) ---
  { vi: 'Trời nắng', en: 'sunny' },         { vi: 'Trời mưa', en: 'rainy' },
  { vi: 'Có gió', en: 'windy' },            { vi: 'Nhiều mây', en: 'cloudy' },
  { vi: 'Có bão', en: 'stormy' },           { vi: 'Mùa hè', en: 'summer' },
  { vi: 'Mùa đông', en: 'winter' },         { vi: 'Mùa thu', en: 'autumn' },

  // --- 5. ĐỊA ĐIỂM & THIÊN NHIÊN (8 từ) ---
  { vi: 'Ngọn núi', en: 'mountain' },       { vi: 'Hòn đảo', en: 'island' },
  { vi: 'Ngôi làng', en: 'village' },       { vi: 'Thành phố', en: 'city' },
  { vi: 'Bệnh viện', en: 'hospital' },      { vi: 'Tiệm bánh', en: 'bakery' },
  { vi: 'Rạp chiếu phim', en: 'cinema' },   { vi: 'Bảo tàng', en: 'museum' },

  // --- 6. HOẠT ĐỘNG & THỂ THAO (8 từ) ---
  { vi: 'Bơi lội', en: 'swimming' },        { vi: 'Trượt patin', en: 'skating' },
  { vi: 'Nhảy dây', en: 'skipping' },       { vi: 'Bóng đá', en: 'football' },
  { vi: 'Cầu lông', en: 'badminton' },      { vi: 'Nấu ăn', en: 'cooking' },
  { vi: 'Đọc sách', en: 'reading' },        { vi: 'Vẽ tranh', en: 'drawing' }
];

/**
 * ============================================================================
 * @component   DictionaryHintFormatter (UPDATE v4.2)
 * @doclogger   - Mục đích: Chuẩn hóa chuỗi gợi ý dạng "g _ _ _ _ _ _" (luôn có
 *                khoảng cách giữa các ký tự) ngay từ kho từ điển để đồng bộ
 *                1 nguồn dữ liệu duy nhất (Single Source of Truth).
 *              - Quy tắc: Mặc định mở sẵn ký tự đầu tiên (revealedCount = 1),
 *                khi người chơi gõ khớp tới đâu sẽ tăng revealedCount tới đó.
 * @param {string} enWord - Từ tiếng Anh gốc (VD: 'giraffe')
 * @param {number} [revealedCount=1] - Số ký tự đầu được hiển thị
 * @returns {string} - Chuỗi định dạng có dấu cách (VD: 'g _ _ _ _ _ _')
 * ============================================================================
 */
export function formatWordHint(enWord = '', revealedCount = 1) {
  const cleanWord = enWord.toLowerCase().trim();
  if (!cleanWord) return '';

  // Luôn mở tối thiểu 1 chữ cái đầu tiên và không vượt quá độ dài từ
  const safeReveal = Math.min(Math.max(1, revealedCount), cleanWord.length);

  return cleanWord
    .split('')
    .map((char, index) => (index < safeReveal ? char : '_'))
    .join(' ');
}