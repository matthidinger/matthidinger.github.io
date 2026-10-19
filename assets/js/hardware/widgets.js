// Before/after sliders (_includes/hardware/slider.html). Without JavaScript the two photos sit side by side; here they
// stack, and a range input over them wipes between them, so it works by drag, tap, keys and screen reader alike.
// A slider with data-sweep wipes across once when it first scrolls into view, unless motion is reduced.
import { prefersReducedMotion } from './data.js';

const SWEEP_MS = 1600;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function initSliders(root) {
  for (const ba of root.querySelectorAll('.ba')) slider(ba);
}

function slider(ba) {
  const input = ba.querySelector('input[type="range"]');
  if (!input) return;
  const before = ba.querySelector('.ba-tag.l')?.textContent.trim() || 'Before';
  ba.classList.add('is-live');
  input.hidden = false;

  const set = v => {
    const n = Math.round(Math.min(100, Math.max(0, Number(v))));
    ba.style.setProperty('--pos', `${v}%`);
    ba.dataset.at = String(n);
    input.setAttribute('aria-valuetext', `${before} ${n}%`);
  };
  set(input.value);

  let raf = 0;
  let io = null;
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    io?.disconnect();
    io = null;
  };
  input.addEventListener('input', () => { stop(); set(input.value); });
  input.addEventListener('pointerdown', stop);
  input.addEventListener('focus', stop);

  if (!ba.hasAttribute('data-sweep') || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
  io = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    io.disconnect();
    io = null;
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / SWEEP_MS);
      const v = 100 - 50 * easeInOut(t);
      input.value = String(v);
      set(v);
      raf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  }, { threshold: 0.6 });
  io.observe(ba);
}
