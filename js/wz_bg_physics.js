/**
 * ============================================================================
 * @file        wordzilla_cpnt_game/js/wz_bg_physics.js
 * @project     WORDZILLA (Web Component - Đồ Án Cơ Sở)
 * @module      BackgroundFloraPhysics
 * @description Tính toán dao động gió điều hòa thời gian thực cho 4 bông hoa
 *              bằng công thức x(t) = A * sin(omega * t + phase) trên GPU.
 * ============================================================================
 */

export function initFloraWindPhysics({ amplitude = 4, period = 4 } = {}) {
  const flowers = document.querySelectorAll('.wz-flower');
  if (!flowers.length) return () => {};

  const omega = (2 * Math.PI) / period;
  const phaseStep = 0.45;
  let startTime = null;
  let rafId = null;

  function updateFrame(timestamp) {
    if (startTime === null) startTime = timestamp;
    const t = (timestamp - startTime) / 1000;

    flowers.forEach((flower, index) => {
      const phase = -index * phaseStep;
      const x = amplitude * Math.sin(omega * t + phase);
      const tiltDeg = x * 1.1;

      flower.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) rotate(${tiltDeg.toFixed(2)}deg)`;
    });

    rafId = requestAnimationFrame(updateFrame);
  }

  rafId = requestAnimationFrame(updateFrame);

  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}