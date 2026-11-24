/**
 * ============================================================================
 * @file        wordzilla_cpnt_game/js/wz_main.js
 * @project     WORDZILLA (Web Component - Đồ Án Cơ Sở)
 * @module      WordzillaEntryPoint
 * @description File điều phối trung tâm (Vật lý nền + Quản lý Slide + Thả thẻ từ).
 * ============================================================================
 */

import { initFloraWindPhysics } from './wz_bg_physics.js';
import { WordzillaSlideManager } from './wz_slides.js';
import { WordzillaDropEngine } from './wz_word_drop.js';

document.addEventListener('DOMContentLoaded', () => {
  initFloraWindPhysics({ amplitude: 4, period: 4 });

  // ==========================================================================
  // @branch      INIT_CORE_CONTROLLERS
  // @description Khởi tạo bộ điều khiển Slide 1 và Engine thả thẻ gỗ (biên 140px)
  // ==========================================================================
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

  /**
   * Cập nhật điểm số hiển thị trên bảng HUD
   * @param {number} newScore - Điểm mới cần hiển thị
   */
  const updateScore = (newScore) => {
    currentScore = newScore;
    if (hudScore) hudScore.textContent = String(currentScore);
  };

  // Sau khi màn che Sky Steel giãn hết ra 4 phía, bật khung chat, bảng điểm & thả thẻ gỗ
  slideManager.onGameStart = ({ playerName, difficulty }) => {
    if (hudPlayer) hudPlayer.textContent = playerName || 'Player';
    if (hudDiff) hudDiff.textContent = diffLabelMap[difficulty] || 'Dễ';
    updateScore(0);

    scoreBoard?.classList.add('is-visible');

    if (chatBox) {
      chatBox.classList.add('is-visible');
      setTimeout(() => chatInput?.focus(), 350);
    }

    const speedMap = { easy: 110, medium: 165, hard: 230 };
    dropEngine.spawnCard('WORDZILLA', speedMap[difficulty] || 135);
  };

  window.Wordzilla = { slides: slideManager, dropEngine, updateScore };
})