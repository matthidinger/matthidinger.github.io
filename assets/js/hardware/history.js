// Back puts every Hardware page back where it was left: the scroll position, and anything a page registers with
// remember() (the index keeps its model view). Some browsers rebuild the page on Back instead of restoring it from the
// back/forward cache, so the state lives in history.state and is put back once the page has loaded.
const KEY = 'hw';

/** What the page held when it was last left, or null on a fresh visit. */
export const kept = history.state?.[KEY] ?? null;

const getters = new Map([['y', () => Math.round(scrollY)]]);
let timer = 0;
let touched = false;
let started = false;

/** Keep `get()` in history.state under `key` from now on. */
export function remember(key, get) {
  getters.set(key, get);
}

export function save() {
  clearTimeout(timer);
  const state = {};
  for (const [k, get] of getters) {
    const v = get();
    if (v != null) state[k] = v;
  }
  history.replaceState({ ...history.state, [KEY]: state }, '');
}

/** Save soon: for things that change often, like scrolling or orbiting the model. */
export function keep() {
  clearTimeout(timer);
  timer = setTimeout(save, 300);
}

/** True once the person has scrolled, tapped or typed; after that nothing jumps them back. */
export const isTouched = () => touched;

export function startKeeping() {
  if (started) return;
  started = true;
  addEventListener('scroll', keep, { passive: true });
  document.addEventListener('click', e => { if (e.target.closest?.('a[href]')) save(); }, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  addEventListener('pagehide', save);
  for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
    addEventListener(type, () => { touched = true; }, { once: true, passive: true });
  }
}

/**
 * Scroll back to where the page was left, and again once fonts and photos are in (they can still move things).
 * Returns a function that lands again, for pages that change height after an async step. A no-op on a fresh visit.
 */
export function restoreY() {
  if (kept?.y == null) return () => {};
  const land = () => { if (!touched) scrollTo({ top: kept.y, behavior: 'instant' }); };
  land();
  document.fonts?.ready.then(land);
  if (document.readyState !== 'complete') addEventListener('load', land, { once: true });
  return land;
}
