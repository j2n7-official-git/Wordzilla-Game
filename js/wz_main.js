/**
 * ============================================================================
 * @file        wordzilla_cpnt_game/js/wz_main.js
 * @project     WORDZILLA (Web Component - Đồ Án Cơ Sở)
 * @module      WordzillaEntryPoint
 * @description Điều phối trung tâm: Vật lý nền + Slide 1 + Kho 60 từ lớp 4-5.
 * ============================================================================
 */

import { initFloraWindPhysics } from './wz_bg_physics.js';
import { WordzillaSlideManager } from './wz_slides.js';
import { WordzillaDropEngine } from './wz_word_drop.js';
import { WZ_DICTIONARY } from './wz_dictionary.js';

document.addEventListener('DOMContentLoaded', () => {
  initFloraWindPhysics({ amplitude: 4, period: 4 });

  const slideManager = new WordzillaSlideManager('#wz-ui-root');
  const dropEngine = new WordzillaDropEngine('#wz-playfield', { bottomLimitPx: 140 });

  const chatBox = document.getElementById('wz-chat-box');
  const chatInput = document.getElementById('wz-chat-input');
  const scoreBoard = document.getElementById('wz-score-board');
  const hudPlayer = document.getElementById('wz-hud-player');
  const hudScore = document.getElementById('wz-hud-score');
  const hudDiff = document.getElementById('wz-hud-diff');

  const diffLabelMap = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };
  let currentScore = 0;

  const updateScore = (newScore) => {
    currentScore = newScore;
    if (hudScore) hudScore.textContent = String(currentScore);
  };

  // ==========================================================================
  // @branch      START_60_WORDS_SESSION_08X_EASY
  // @doclogger   Khởi chạy ván chơi với 60 từ lớp 4-5; mức Dễ chạy tốc độ 0.8x
  // ==========================================================================
  slideManager.onGameStart = ({ playerName, difficulty }) => {
    if (hudPlayer) hudPlayer.textContent = playerName || 'Player';
    if (hudDiff) hudDiff.textContent = diffLabelMap[difficulty] || 'Dễ';
    updateScore(0);

    scoreBoard?.classList.add('is-visible');

    if (chatBox) {
      chatBox.classList.add('is-visible');
      setTimeout(() => chatInput?.focus(), 350);
    }

    // @doclogger Lưu lượng băng truyền liên tục theo độ khó:
    //            - Dễ: tối đa 3 ô trên màn hình, tốc độ 0.8x
    //            - Trung bình: tối đa 3 ô trên màn hình, tốc độ 1.0x
    //            - Khó: tối đa 4 ô trên màn hình, tốc độ 1.25x
    const modeConfig = {
      easy:   { speedMultiplier: 0.6,  maxOnScreen: 3 },
      medium: { speedMultiplier: 0.9,  maxOnScreen: 3 },
      hard:   { speedMultiplier: 1.2, maxOnScreen: 4 }
    };

    dropEngine.startDictionaryGame(WZ_DICTIONARY, modeConfig[difficulty] || modeConfig.easy);
  };

  // ==========================================================================
  // @branch      AUTO_EXPLODE_AND_PROGRESSIVE_HINT (UPDATE v4.2)
  // @doclogger   Flow xử lý mỗi lần người chơi gõ 1 phím vào ô chat:
  //              1. Gọi syncTypingHints() để mở dần từng chữ cái khớp trên nắp gỗ
  //              2. Gọi checkAndDestroyWord() để kiểm tra nếu đã khớp 100% đáp án
  //                 -> phát nổ 6 mảnh gỗ, cộng 20 * (len - 1) điểm & reset gợi ý
  // ==========================================================================
  const handleCheckWord = () => {
    if (!chatInput) return;

    // Bước 1: Mở từng ký tự khớp trên các thẻ đang rơi
    dropEngine.syncTypingHints(chatInput.value);

    // Bước 2: Nếu đã gõ đủ toàn bộ từ -> cho nổ thẻ & xóa trắng ô nhập
    const result = dropEngine.checkAndDestroyWord(chatInput.value);
    if (result.matched) {
      chatInput.value = '';
      dropEngine.syncTypingHints(''); // Đưa các thẻ còn lại trên màn hình về gợi ý 1 chữ cái đầu
      updateScore(currentScore + result.points);
    }
  };

  // @branch      BIND_CHAT_INPUT_EVENT
  // @doclogger   Lắng nghe từng nhịp gõ phím trên #wz-chat-input để đồng bộ
  //              gợi ý chữ cái và kích nổ thẻ ngay khi khớp 100% đáp án
  chatInput?.addEventListener('input', handleCheckWord);

  window.Wordzilla = { slides: slideManager, dropEngine, updateScore };
});