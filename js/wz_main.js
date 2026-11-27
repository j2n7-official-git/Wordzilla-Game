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

  // @branch      QUERY_EXIT_BUBBLE_DOM [+]
  // @docstring   Lấy tham chiếu hộp hội thoại xác nhận thoát và 2 nút bên trong
  const exitBubble = document.getElementById('wz-exit-bubble');
  const stayGameBtn = document.getElementById('wz-btn-stay');
  const confirmExitBtn = document.getElementById('wz-btn-confirm-exit');
  const exitBtn = document.getElementById('wz-btn-exit'); // [FIX] Khôi phục biến nút thoát bị xóa nhầm

  const chatBox = document.getElementById('wz-chat-box');
  const chatInput = document.getElementById('wz-chat-input');
  const scoreBoard = document.getElementById('wz-score-board');
  const hudPlayer = document.getElementById('wz-hud-player');
  const hudScore = document.getElementById('wz-hud-score');
  const hudDiff = document.getElementById('wz-hud-diff');

  // ==========================================================================
  // @module      [UPDATE] FlowerLifeController
  // @docstring   Quản lý trạng thái 3 mạng hoa đỏ (maxLives = 3) và đồng bộ hình ảnh:
  //              - Hoa còn mạng : src/life-visual/wz_flower_life_normal.png
  //              - Hoa mất mạng : src/life-visual/wz_flower_life_off.png
  //              - Thứ tự tắt   : Tắt từ phải sang trái (index 2 -> 1 -> 0).
  // ==========================================================================
  const lifeBoard = document.getElementById('wz-life-board');
  // Array.from() chuyển NodeList tĩnh thành mảng chuẩn JS để dùng được .forEach() và index ổn định
  const lifeFlowerImgs = Array.from(document.querySelectorAll('.wz-life-flower'));
  const FLOWER_ICON_NORMAL = 'src/life-visual/wz_flower_life_normal.png';
  const FLOWER_ICON_OFF = 'src/life-visual/wz_flower_life_off.png';
  const MAX_LIVES = 3;
  let currentLives = MAX_LIVES;

  // ==========================================================================
  // @module      [UPDATE] GameplaySFXController
  // @docstring   - Mục đích: Nạp sẵn và điều khiển 2 hiệu ứng âm thanh trong trận:
  //                1. sfxCorrectWord (src/sfx/wz_correct_word.wav): khi gõ đúng từ
  //                2. sfxWordMissed  (src/sfx/wz_word_missed.wav): khi từ rớt biên
  //              - Hàm playSfx() dùng lệnh audio.currentTime = 0 để tua âm thanh
  //                về mốc 0s trước khi .play(), giúp âm thanh nổ dòn và không bị
  //                nuốt tiếng khi người chơi gõ đúng 2 từ liên tiếp cực nhanh.
  //              - .catch(() => {}) giúp chặn lỗi Uncaught Promise trên Console
  //                nếu trình duyệt tạm chặn autoplay âm thanh.
  // ==========================================================================
  const sfxCorrectWord = new Audio('src/sfx/wz_correct_word.wav');
  const sfxWordMissed = new Audio('src/sfx/wz_word_missed.wav');

  // @branch      GAMEOVER_DOM_AND_SFX_REFS
  // @doclogger   Nạp âm thanh wz_gameover.wav và lấy tham chiếu bảng Game Over + 2 nút
  const sfxGameOver = new Audio('src/sfx/wz_gameover.wav');
  sfxGameOver.preload = 'auto';

  const gameOverOverlay = document.getElementById('wz-gameover-overlay');
  const gameOverWordsEl = document.getElementById('wz-go-words');
  const gameOverScoreEl = document.getElementById('wz-go-score');
  const gameOverReplayBtn = document.getElementById('wz-btn-go-replay');
  const gameOverExitBtn = document.getElementById('wz-btn-go-exit');

  const SPEED_UP_MILESTONE = 12; // Mốc 12 từ gõ đúng sẽ tăng nhích tốc độ +0.05x
  let currentPlayerName = 'Player';
  let currentDifficulty = 'easy';
  let isGameOver = false;
  let gameOverTimers = [];
  /**
   * @doclogger Dừng âm thanh Game Over & xóa sạch timer hiệu ứng nếu người chơi bấm nút sớm
   */
  const resetGameOverState = () => {
    isGameOver = false;
    gameOverTimers.forEach((id) => clearTimeout(id));
    gameOverTimers = [];

    sfxGameOver.pause();
    sfxGameOver.currentTime = 0;

    gameOverOverlay?.classList.remove('is-active', 'is-stats-shown', 'is-actions-shown');
  };

  sfxCorrectWord.preload = 'auto';
  sfxWordMissed.preload = 'auto';

  /**
   * @description Tua âm thanh hiệu ứng về 0s trước khi phát để không bị nuốt tiếng
   *            khi người chơi gõ đúng liên tiếp; nuốt lỗi promise nếu bị chặn autoplay.
   */
  const playSfx = (audioObj) => {
    if (!audioObj) return;
    audioObj.currentTime = 0;
    audioObj.play().catch(() => {});
  };

  // ==========================================================================
  // @module      DualBgmStateController
  // @description - Quản lý 2 luồng nhạc nền độc lập:
  //                1. bgmMenu (src/sfx/wz_mainmenu_bgm.mp3): Phát ở màn hình Slide 1.
  //                2. bgmGame (src/sfx/wz_background_game.mp3): Phát khi vào ván chơi.
  //              - Cơ chế unlockMenuAudio: Trình duyệt chặn tự phát âm thanh khi
  //                mới tải trang; sự kiện { once: true } sẽ tự kích hoạt nhạc sảnh
  //                ngay cú click/gõ phím đầu tiên của người chơi ở Slide 1 và tự gỡ.
  // ==========================================================================
  const bgmMenu = new Audio('src/sfx/wz_mainmenu_bgm.mp3');
  bgmMenu.preload = 'auto';
  bgmMenu.loop = true;
  bgmMenu.volume = 0.24;

  const bgmGame = new Audio('src/sfx/wz_background_game.mp3');
  bgmGame.preload = 'auto';
  bgmGame.loop = true;
  bgmGame.volume = 0.24;

  let isInGameplay = false;

  const switchToMenuBgm = () => {
    isInGameplay = false;
    bgmGame.pause();
    bgmGame.currentTime = 0;

    bgmMenu.currentTime = 0;
    bgmMenu.play().catch(() => {});
  };

  const switchToGameBgm = () => {
    isInGameplay = true;
    bgmMenu.pause();
    bgmMenu.currentTime = 0;

    bgmGame.currentTime = 0;
    bgmGame.play().catch(() => {});
  };

  // Thử phát nhạc sảnh ngay khi tải trang; nếu bị trình duyệt chặn -> mở khóa ở tương tác đầu tiên
  switchToMenuBgm();
  const unlockMenuAudio = () => {
    if (!isInGameplay && bgmMenu.paused) {
      bgmMenu.play().catch(() => {});
    }
  };
  document.addEventListener('pointerdown', unlockMenuAudio, { once: true });
  document.addEventListener('keydown', unlockMenuAudio, { once: true });

  const diffLabelMap = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };
  let currentScore = 0;
  let solvedWordsCount = 0; // Bộ đếm ngầm số từ phá được trong ván (ẩn khỏi UI HUD)
  console.info('[WORDZILLA - DEBUG] Bắt đầu ván mới | Bộ đếm ngầm: 0 từ');

  const updateScore = (newScore) => {
    currentScore = newScore;
    if (hudScore) hudScore.textContent = String(currentScore);
  };

  /**
   * @branch      [UPDATE] RENDER_FLOWER_LIVES
   * @docstring   Cập nhật giao diện 3 bông hoa theo số mạng còn lại:
   *              - Nếu index < lives: giữ hoa đỏ & gỡ class .is-lost.
   *              - Nếu index >= lives: đổi sang hoa xám & thêm .is-lost tạo nhịp giật.
   */
  const updateLivesUI = (lives) => {
    currentLives = Math.max(0, Math.min(MAX_LIVES, lives));
    lifeFlowerImgs.forEach((img, index) => {
      const isAlive = index < currentLives;
      img.src = isAlive ? FLOWER_ICON_NORMAL : FLOWER_ICON_OFF;
      img.classList.toggle('is-lost', !isAlive);
    });
  };

  /**
   * @module      TriggerGameOverSequence
   * @doclogger   Kích hoạt chuỗi sự kiện khi rớt mạng cuối cùng (currentLives === 0):
   *              1. Đóng băng sân chơi (thẻ cuối vừa vỡ xong, các thẻ khác đứng yên)
   *              2. Tắt nhạc nền gameplay & phát src/sfx/wz_gameover.wav
   *              3. Phủ nền đen 65% + thả bảng gỗ từ trên trời xuống trong 1.0s
   *              4. Mốc 1.0s: PPTX Appear Số từ đúng & Điểm số
   *              5. Mốc 1.35s: PPTX Appear 2 nút CHƠI LẠI & THOÁT
   */
  const triggerGameOver = () => {
    if (isGameOver) return;
    isGameOver = true;

    // 1. Đóng băng toàn bộ thẻ từ còn lại & khóa ô nhập liệu
    dropEngine.freeze();
    if (chatInput) {
      chatInput.disabled = true;
      chatInput.blur();
    }
    exitBubble?.classList.remove('is-open');
    exitBtn?.classList.remove('is-visible');

    // 2. Tắt nhạc nền gameplay ("Mii maker") & phát SFX Game Over
    isInGameplay = false;
    bgmGame.pause();
    bgmGame.currentTime = 0;
    playSfx(sfxGameOver);

    // 3. Đổ dữ liệu tổng kết vào 2 ô dát gỗ
    if (gameOverWordsEl) gameOverWordsEl.textContent = String(solvedWordsCount);
    if (gameOverScoreEl) gameOverScoreEl.textContent = String(currentScore);

    // 4. Reset class & ép Reflow để bảng rơi từ trời xuống chính giữa trong đúng 1.0s
    gameOverOverlay?.classList.remove('is-active', 'is-stats-shown', 'is-actions-shown');
    if (gameOverOverlay) void gameOverOverlay.offsetWidth;
    gameOverOverlay?.classList.add('is-active');

    // 5. Sau 1.0s (bảng vừa chạm tâm): bật PPTX Appear 2 thông số
    const statsTimer = setTimeout(() => {
      gameOverOverlay?.classList.add('is-stats-shown');
    }, 1000);

    // 6. Sau 1.35s: bật PPTX Appear 2 nút CHƠI LẠI và THOÁT cuối cùng
    const actionsTimer = setTimeout(() => {
      gameOverOverlay?.classList.add('is-actions-shown');
    }, 1350);

    gameOverTimers.push(statsTimer, actionsTimer);
  };

  // ==========================================================================
  // @branch      [UPDATE] ON_CARD_MISSED_EXCLUSIVE_SFX
  // @doclogger   Xử lý âm thanh độc quyền khi thẻ từ chạm vạch biên 140px:
  //              - Tính trước số mạng sau khi trừ (nextLives = currentLives - 1).
  //              - Nếu nextLives === 0 (mạng cuối cùng): tắt nốt bông hoa cuối và
  //                gọi thẳng triggerGameOver() để phát duy nhất wz_gameover.wav,
  //                không phát đè wz_word_missed.wav.
  //              - Nếu nextLives > 0 (vẫn còn mạng): phát tiếng mất mạng bình thường.
  // ==========================================================================
  dropEngine.onCardMissed = () => {
    if (currentLives <= 0 || isGameOver) return;

    const nextLives = currentLives - 1;
    updateLivesUI(nextLives);

    if (nextLives === 0) {
      triggerGameOver();
      return;
    }

    playSfx(sfxWordMissed);
  };

  /**
   * @module      StartMatchSessionController
   * @doclogger   Hàm dùng chung để khởi động ván mới (từ Slide 1 hoặc nút CHƠI LẠI):
   *              Reset điểm, 3 hoa đỏ, bộ đếm từ, mở khóa ô chat & thả băng truyền từ.
   */
  const startMatchSession = ({ playerName, difficulty }) => {
    currentPlayerName = playerName || currentPlayerName || 'Player';
    currentDifficulty = difficulty || currentDifficulty || 'easy';

    resetGameOverState();
    dropEngine.stopAndClear();

    if (hudPlayer) hudPlayer.textContent = currentPlayerName;
    if (hudDiff) hudDiff.textContent = diffLabelMap[currentDifficulty] || 'Dễ';
    updateScore(0);
    updateLivesUI(MAX_LIVES);
    solvedWordsCount = 0;

    switchToGameBgm();

    scoreBoard?.classList.add('is-visible');
    lifeBoard?.classList.add('is-visible');
    exitBtn?.classList.add('is-visible');

    if (chatBox && chatInput) {
      chatInput.disabled = false;
      chatInput.value = '';
      chatBox.classList.add('is-visible');
      setTimeout(() => chatInput.focus(), 350);
    }

    const allowedCefrMap = {
      easy:   new Set(['A1', 'A2', 'B1']),
      medium: new Set(['A1', 'A2', 'B1', 'B2']),
      hard:   new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    };

    const activeDiff = allowedCefrMap[currentDifficulty] ? currentDifficulty : 'easy';
    const filteredPool = WZ_DICTIONARY.filter((item) =>
      allowedCefrMap[activeDiff].has((item.cefr || 'A1').toUpperCase())
    );

    const modeConfig = {
      easy:   { speedMultiplier: 0.65, maxOnScreen: 3 },
      medium: { speedMultiplier: 0.9,  maxOnScreen: 3 },
      hard:   { speedMultiplier: 1.15, maxOnScreen: 4 }
    };

    dropEngine.startDictionaryGame(filteredPool, modeConfig[activeDiff]);
  };

  slideManager.onGameStart = (sessionInfo) => startMatchSession(sessionInfo);

  // Xử lý gõ từ vựng (chặn nhập khi đã Game Over)
  const handleCheckWord = () => {
    if (!chatInput || isGameOver) return;

    dropEngine.syncTypingHints(chatInput.value);
    const result = dropEngine.checkAndDestroyWord(chatInput.value);

    if (result.matched) {
      playSfx(sfxCorrectWord);
      chatInput.value = '';
      dropEngine.syncTypingHints('');
      updateScore(currentScore + result.points);

      solvedWordsCount += 1;
      console.log(
        `[WORDZILLA - COUNTER] Đã phá: ${solvedWordsCount} từ (Mốc tăng tốc: ${Math.ceil(solvedWordsCount / SPEED_UP_MILESTONE) * SPEED_UP_MILESTONE} từ)`
      );

      if (solvedWordsCount % SPEED_UP_MILESTONE === 0) {
        const updatedSpeed = dropEngine.increaseSpeedMultiplier(0.05);
        console.warn(`[WORDZILLA - SPEED UP!] Đạt mốc ${solvedWordsCount} từ -> Tốc độ: ${updatedSpeed}x`);
      }
    }
  };

  /**
   * @module      ReturnToMainMenuController
   * @doclogger   Dùng chung cho nút "Thoát" trong trận và nút "THOÁT" trên bảng Game Over:
   *              Dọn sạch sân chơi -> ẩn tức thì HUD -> thu tường xanh Sky Steel về Slide 1.
   */
  const returnToMainMenu = () => {
    resetGameOverState();
    dropEngine.stopAndClear();
    switchToMenuBgm();

    const gameplayUiNodes = [gameOverOverlay, exitBubble, scoreBoard, lifeBoard, exitBtn, chatBox];
    gameplayUiNodes.forEach((el) => el?.classList.add('wz-instant-disappear'));

    exitBubble?.classList.remove('is-open');
    scoreBoard?.classList.remove('is-visible');
    lifeBoard?.classList.remove('is-visible');
    exitBtn?.classList.remove('is-visible');
    chatBox?.classList.remove('is-visible');

    if (chatInput) {
      chatInput.value = '';
      chatInput.disabled = false;
    }
    updateScore(0);
    updateLivesUI(MAX_LIVES);

    requestAnimationFrame(() => {
      gameplayUiNodes.forEach((el) => el?.classList.remove('wz-instant-disappear'));
    });

    slideManager.playReturnToSlide1Transition();
  };

  exitBtn?.addEventListener('click', () => exitBubble?.classList.toggle('is-open'));
  stayGameBtn?.addEventListener('click', () => {
    exitBubble?.classList.remove('is-open');
    chatInput?.focus();
  });

  confirmExitBtn?.addEventListener('click', returnToMainMenu);
  gameOverExitBtn?.addEventListener('click', returnToMainMenu);

  // Nút CHƠI LẠI trên bảng Game Over: khởi động lại đúng mode hiện tại về từ đầu
  gameOverReplayBtn?.addEventListener('click', () => {
    startMatchSession({ playerName: currentPlayerName, difficulty: currentDifficulty });
  });

  // @branch      BIND_CHAT_INPUT_EVENT
  // @doclogger   Lắng nghe từng nhịp gõ phím trên #wz-chat-input để đồng bộ
  //              gợi ý chữ cái và kích nổ thẻ ngay khi khớp 100% đáp án
  chatInput?.addEventListener('input', handleCheckWord);

  window.Wordzilla = { slides: slideManager, dropEngine, updateScore };
});