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
import { WordzillaInstructionBook } from './wz_instruction_book.js';
import { WordzillaComboController } from './wz_combo.js'; //[UPDATE]: TÍNH ĐIỂM THEO COMBO

document.addEventListener('DOMContentLoaded', () => {
  initFloraWindPhysics({ amplitude: 4, period: 4 });

  const comboController = new WordzillaComboController(); // [UPDATE FUNCTION] TÍNH ĐIỂM THEO COMBO
  const instructionBook = new WordzillaInstructionBook(); // [UPDATE FUNCTION] TÍNH NĂNG SÁCH HƯỚNG DẪN
  const slideManager = new WordzillaSlideManager('#wz-ui-root');
  const dropEngine = new WordzillaDropEngine('#wz-playfield', { bottomLimitPx: 140 });

  // @branch      QUERY_EXIT_BUBBLE_DOM [+]
  // @docstring   Lấy tham chiếu hộp hội thoại xác nhận thoát và 2 nút bên trong
  const exitBubble = document.getElementById('wz-exit-bubble');
  const stayGameBtn = document.getElementById('wz-btn-stay');
  const confirmExitBtn = document.getElementById('wz-btn-confirm-exit');
  const exitBtn = document.getElementById('wz-btn-exit');

  // ==========================================================================
  // @module      PauseFreezeController
  // @doclogger   - Bật/tắt chế độ tạm dừng qua nút #wz-btn-pause hoặc [Alt + P].
  //              - Đóng băng đồng thời: dropEngine, comboController, nhạc nền
  //                và khóa ô chat với placeholder "Game đã tạm dừng".
  // ==========================================================================
  const pauseWrapper = document.getElementById('wz-pause-wrapper');
  const pauseBtn = document.getElementById('wz-btn-pause');
  const pauseTooltip = document.getElementById('wz-pause-tooltip');
  const freezeOverlay = document.getElementById('wz-freeze-overlay');
  let isGamePaused = false;

  const setGamePaused = (shouldPause) => {
    if (!isInGameplay || isGameOver || isGamePaused === shouldPause) return;
    isGamePaused = shouldPause;
    playSfx(sfxPausePlay); // Phát âm thanh phản hồi tức thì ở cả 2 chiều Tạm dừng & Tiếp tục

    if (isGamePaused) {
      dropEngine.pause();
      comboController.pause();
      if (!bgmGame.paused) bgmGame.pause();

      if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = 'Game đã tạm dừng';
      }

      freezeOverlay?.classList.add('is-frozen');
      pauseBtn?.classList.add('is-paused');
      pauseWrapper?.classList.add('is-paused-hint');
      if (pauseTooltip) {
        pauseTooltip.innerHTML = 'Nhấn nút <strong>PLAY</strong> / <strong>[Alt+P]</strong> để tiếp tục game';
      }
    } else {
      if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = 'Gõ từ tại đây...';
        chatInput.focus();
      }

      freezeOverlay?.classList.remove('is-frozen');
      pauseBtn?.classList.remove('is-paused');
      pauseWrapper?.classList.remove('is-paused-hint');
      if (pauseTooltip) {
        pauseTooltip.innerHTML = 'Nhấn nút <strong>PAUSE</strong> / <strong>[Alt+P]</strong> để tạm dừng game';
      }

      comboController.resume();
      dropEngine.resume();
      if (!isMusicMuted) bgmGame.play().catch(() => {}); // @doclogger Chỉ phát lại nhạc khi nút Music đang bật
    }
  };

  pauseBtn?.addEventListener('click', () => setGamePaused(!isGamePaused));

  document.addEventListener('keydown', (event) => {
    if (event.altKey && event.code === 'KeyP') {
      event.preventDefault();
      if (!isInGameplay || isGameOver || exitBubble?.classList.contains('is-open')) return;
      setGamePaused(!isGamePaused);
    }
  });

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
  const sfxCorrectWord = new Audio('src/sfx/sound/wz_correct_word.wav');
  const sfxWordMissed = new Audio('src/sfx/sound/wz_word_missed.wav');

  // @branch      GAMEOVER_DOM_AND_SFX_REFS
  // @doclogger   Nạp âm thanh wz_gameover.wav và lấy tham chiếu bảng Game Over + 2 nút
  const sfxGameOver = new Audio('src/sfx/sound/wz_gameover.wav');
  sfxGameOver.preload = 'auto';

  const gameOverOverlay = document.getElementById('wz-gameover-overlay');
  const gameOverWordsEl = document.getElementById('wz-go-words');
  const gameOverScoreEl = document.getElementById('wz-go-score');
  const gameOverReplayBtn = document.getElementById('wz-btn-go-replay');
  const gameOverExitBtn = document.getElementById('wz-btn-go-exit');

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
  // @doclogger Nạp sẵn hiệu ứng âm thanh khi bấm PAUSE hoặc PLAY (Alt + P)
  const sfxPausePlay = new Audio('src/sfx/sound/wz_pause_n_play.wav');
  sfxPausePlay.preload = 'auto';

  /**
   * @description Tua âm thanh hiệu ứng về 0s trước khi phát để không bị nuốt tiếng
   *            khi người chơi gõ đúng liên tiếp; nuốt lỗi promise nếu bị chặn autoplay.
   */
  // @doclogger Cờ trạng thái Bật/Tắt độc lập cho Nhạc nền (Music) và Hiệu ứng (Sound)
  let isMusicMuted = false;
  let isSoundMuted = false;

  const playSfx = (audioObj) => {
    if (!audioObj || isSoundMuted) return; // @doclogger Chặn phát hiệu ứng nếu nút Sound đang tắt
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
  const bgmMenu = new Audio('src/sfx/music/wz_mainmenu_bgm.mp3');
  bgmMenu.preload = 'auto';
  bgmMenu.loop = true;
  bgmMenu.volume = 0.24;

  const bgmGame = new Audio('src/sfx/music/wz_background_game.mp3');
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
  // ==========================================================================
  // @module      AudioToggleButtonsController
  // @doclogger   Điều khiển 2 nút #wz-btn-music và #wz-btn-sound (bật/tắt độc lập):
  //              - Music: Đồng bộ thuộc tính .muted cho cả bgmMenu và bgmGame.
  //              - Sound: Khóa/mở cờ isSoundMuted cho toàn bộ SFX + lỗi nhập tên.
  // ==========================================================================
  const musicToggleBtn = document.getElementById('wz-btn-music');
  const soundToggleBtn = document.getElementById('wz-btn-sound');

  musicToggleBtn?.addEventListener('click', () => {
    isMusicMuted = !isMusicMuted;
    bgmMenu.muted = isMusicMuted;
    bgmGame.muted = isMusicMuted;
    musicToggleBtn.classList.toggle('is-muted', isMusicMuted);
    musicToggleBtn.setAttribute('aria-pressed', String(!isMusicMuted));

    // Nếu người chơi bật lại nhạc mà luồng nhạc hiện tại chưa chạy thì kích phát luôn
    if (!isMusicMuted) {
      const activeBgm = isInGameplay ? bgmGame : bgmMenu;
      if (activeBgm.paused && !isGamePaused && !isGameOver) {
        activeBgm.play().catch(() => {});
      }
    }
  });

  soundToggleBtn?.addEventListener('click', () => {
    isSoundMuted = !isSoundMuted;
    if (slideManager.errorSound) {
      slideManager.errorSound.muted = isSoundMuted; // @doclogger Đồng bộ tắt/bật luôn tiếng báo lỗi nhập tên ở Slide 1
    }
    soundToggleBtn.classList.toggle('is-muted', isSoundMuted);
    soundToggleBtn.setAttribute('aria-pressed', String(!isSoundMuted));
  });

  const diffLabelMap = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };
  let currentScore = 0;
  let solvedWordsCount = 0; // Bộ đếm ngầm số từ phá được trong ván (ẩn khỏi UI HUD)
  console.info('[WORDZILLA - DEBUG] Bắt đầu ván mới | Bộ đếm ngầm: 0 từ');

  const updateScore = (newScore) => {
    currentScore = newScore;
    if (hudScore) hudScore.textContent = String(currentScore);
  };

  // ==========================================================================
  // @branch      FLOWER_BLINK_SEQUENCE_CONTROLLER [FIXED]
  // @doclogger   - Mục đích tổng bộ: Quản lý vòng đời timer và chạy chuỗi hiệu ứng
  //                mất mạng 7 chặng: B (xám) -> A (đỏ) -> B -> A -> B -> A ->
  //                B (xám + thu nhỏ cuối), mỗi chặng cách nhau 250ms.
  //              - Cụm lệnh chống chồng chéo: Dùng Map lưu mảng timerId theo từng
  //                <img>; khi bắt đầu chuỗi mới hoặc reset ván sẽ clearTimeout sạch.
  // ==========================================================================
  const lifeBlinkTimers = new Map();

  /**
   * @doclogger Hủy toàn bộ timer nháy đang chờ của 1 bông hoa hoặc cả 3 bông hoa.
   * @param {HTMLElement|null} [targetEl=null] - Truyền thẻ hoa nếu chỉ hủy 1 hoa
   */
  const clearLifeBlinkSequence = (targetEl = null) => {
    if (targetEl) {
      const timers = lifeBlinkTimers.get(targetEl) || [];
      timers.forEach((id) => clearTimeout(id));
      lifeBlinkTimers.delete(targetEl);
      return;
    }

    lifeBlinkTimers.forEach((timers) => timers.forEach((id) => clearTimeout(id)));
    lifeBlinkTimers.clear();
  };

  /**
   * @doclogger Chạy chuỗi 7 bước B -> A -> B -> A -> B -> A -> B(thu nhỏ) trên 1 hoa.
   *            - Chặng 0 chạy ngay (0ms) để thấy phản hồi mất mạng tức thì, các chặng
   *              sau nối tiếp mỗi 150ms (0.15s).
   * @param {HTMLImageElement} flowerEl - Thẻ <img> của bông hoa mất mạng
   * @param {number} [stepMs=150] - Thời gian mỗi chặng (ms)
   */
  const playLifeLostSequence = (flowerEl, stepMs = 150) => {
    //stepMs: mất theo chặng thời gian do cài đặt time-pane (ms) [CHỈNH TẠI ĐÂY]
    if (!flowerEl) return;

    clearLifeBlinkSequence(flowerEl);
    flowerEl.classList.remove('is-lost', 'is-lost-final');

    const sequenceSteps = [
      { src: FLOWER_ICON_OFF, isFinalShrink: false },    // B (chặng 1)
      { src: FLOWER_ICON_NORMAL, isFinalShrink: false }, // A (chặng 2)
      { src: FLOWER_ICON_OFF, isFinalShrink: false },    // B (chặng 3)
      { src: FLOWER_ICON_NORMAL, isFinalShrink: false }, // A (chặng 4)
      { src: FLOWER_ICON_OFF, isFinalShrink: false },    // B (chặng 5)
      { src: FLOWER_ICON_NORMAL, isFinalShrink: false }, // A (chặng 6)
      { src: FLOWER_ICON_OFF, isFinalShrink: true }      // B final + thu nhỏ (chặng 7)
    ];

    const scheduledIds = sequenceSteps.map((step, idx) =>
      setTimeout(() => {
        flowerEl.src = step.src;
        flowerEl.classList.toggle('is-lost-final', step.isFinalShrink);
      }, idx * stepMs)
    );

    lifeBlinkTimers.set(flowerEl, scheduledIds);
  };

  /**
   * @branch      [UPDATE] RENDER_FLOWER_LIVES [FIXED]
   * @doclogger   - Mục đích: Đồng bộ trạng thái 3 bông hoa khi reset hoặc mất mạng.
   *              - Cụm lệnh bảo vệ hiệu ứng: Chỉ chạm vào những bông hoa KHÔNG nằm
   *                trong lifeBlinkTimers (tức đang không chạy chuỗi nháy); bông hoa
   *                đang chạy chuỗi sẽ tự hoàn tất tới B(thu nhỏ) mà không bị cắt ngang.
   */
  const updateLivesUI = (lives, { isReset = false, lostIndex = -1 } = {}) => {
    currentLives = Math.max(0, Math.min(MAX_LIVES, lives));

    if (isReset) {
      clearLifeBlinkSequence();
    }

    lifeFlowerImgs.forEach((img, index) => {
      const isAlive = index < currentLives;

      if (index === lostIndex && !isAlive && !isReset) {
        playLifeLostSequence(img, 150); 
        // Chạy chuỗi nháy mất mạng 7 chặng [TRUYỀN SỐ TỪ STEPMS BẮT BUỘC, NẾU sử dụng biến stepMs sẽ bị lỗi "stepMs is not defined"]
        return;
      }

      // Không ghi đè bông hoa đang chạy chuỗi nháy trừ khi đang reset ván
      if (!isReset && lifeBlinkTimers.has(img)) {
        return;
      }

      img.src = isAlive ? FLOWER_ICON_NORMAL : FLOWER_ICON_OFF;
      img.classList.remove('is-lost');
      img.classList.toggle('is-lost-final', !isAlive);
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
    pauseWrapper?.classList.remove('is-visible', 'is-paused-hint'); //Ẩn nút Pause khi hiện bảng Game Over

    // 2. Tắt nhạc nền gameplay & phát SFX Game Over
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
  // @branch      [UPDATE] ON_CARD_MISSED_EXCLUSIVE_SFX [SINGLE SOURCE OF TRUTH]
  // @doclogger   - Mục đích: Xử lý duy nhất 1 luồng khi thẻ chạm vạch biên 140px:
  //                trừ mạng -> kích chuỗi nháy trên bông hoa vừa rớt -> nếu hết
  //                mạng thì gọi triggerGameOver() (phát duy nhất wz_gameover.wav),
  //                nếu còn mạng thì phát wz_word_missed.wav.
  // ==========================================================================
  dropEngine.onCardMissed = () => {
    comboController.onWordMissed();
    if (currentLives <= 0 || isGameOver) return;

    const nextLives = currentLives - 1;
    const lostFlowerIndex = nextLives; // Tắt từ phải sang trái: 2 -> 1 -> 0
    updateLivesUI(nextLives, { lostIndex: lostFlowerIndex });

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

    comboController.reset(); 
    currentPlayerName = playerName || currentPlayerName || 'Player';
    currentDifficulty = difficulty || currentDifficulty || 'easy';

    resetGameOverState();
    dropEngine.stopAndClear();

    if (hudPlayer) hudPlayer.textContent = currentPlayerName;
    if (hudDiff) hudDiff.textContent = diffLabelMap[currentDifficulty] || 'Dễ';
    updateScore(0);
    updateLivesUI(MAX_LIVES, { isReset: true });
    solvedWordsCount = 0;

    switchToGameBgm();

    scoreBoard?.classList.add('is-visible');
    lifeBoard?.classList.add('is-visible');
    exitBtn?.classList.add('is-visible');
    isGamePaused = false;
    freezeOverlay?.classList.remove('is-frozen');
    pauseBtn?.classList.remove('is-paused');
    pauseWrapper?.classList.remove('is-paused-hint');
    pauseWrapper?.classList.add('is-visible'); // @doclogger Hiện cụm nút PAUSE góc dưới-phải khi vào ván
    if (chatInput) chatInput.placeholder = 'Gõ từ tại đây...';

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
      easy:   { speedMultiplier: 0.64, maxOnScreen: 3 },
      medium: { speedMultiplier: 0.80, maxOnScreen: 3 },
      hard:   { speedMultiplier: 1.00, maxOnScreen: 4 }
    };

    dropEngine.startDictionaryGame(filteredPool, modeConfig[activeDiff]);
  };

  slideManager.onGameStart = (sessionInfo) => startMatchSession(sessionInfo);

  // Xử lý gõ từ vựng (chặn nhập khi đã Game Over)
  // Xử lý gõ từ vựng (chặn nhập khi đã Game Over)
  const handleCheckWord = () => {
    if (!chatInput || isGameOver) return;

    dropEngine.syncTypingHints(chatInput.value);

    // @doclogger Lấy trước hệ số kế tiếp nếu từ khớp để số bay [+điểm] khớp 100% điểm cộng
    const previewMultiplier = (() => {
      const nextStreak = comboController.streakCount + 1;
      const stages = [1.0, 1.2, 1.5, 1.8, 2.0];
      return nextStreak <= 1 ? 1.0 : stages[Math.min(nextStreak - 1, stages.length - 1)];
    })();

    const result = dropEngine.checkAndDestroyWord(chatInput.value, previewMultiplier);

    if (result.matched) {
      playSfx(sfxCorrectWord);
      chatInput.value = '';
      dropEngine.syncTypingHints('');

      comboController.onWordMatched();
      updateScore(currentScore + result.points);

      const SPEED_UP_MILESTONE = 12; // Mốc 12 từ gõ đúng sẽ tăng nhích tốc độ +0.05x
      solvedWordsCount += 1;
      console.log(
        `[WORDZILLA - COUNTER] Đã phá: ${solvedWordsCount} từ | Combo: ${comboController.streakCount} (x${comboController.getHiddenMultiplier()})`
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
    comboController.hide(); 
    comboController.reset();
    resetGameOverState();
    dropEngine.stopAndClear();
    switchToMenuBgm();

    //UPDATE: Dọn sạch trạng thái Pause khi thoát về Slide 1 (SLIDE SIGN IN)
    isGamePaused = false;
    freezeOverlay?.classList.remove('is-frozen');
    pauseBtn?.classList.remove('is-paused');
    pauseWrapper?.classList.remove('is-visible', 'is-paused-hint');
    if (chatInput) chatInput.placeholder = 'Gõ từ tại đây...';

    const gameplayUiNodes = [gameOverOverlay, exitBubble, scoreBoard, lifeBoard, exitBtn, pauseWrapper, chatBox];

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