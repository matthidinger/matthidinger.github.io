// The scrolling engine behind the tour and the project stories. A .mix-st section holds a sticky stage
// (.mix-st-sticky) and its beats (.mix-st-chapters > article, each with an id and a data-name). The beat that has crossed
// a line 40% of the way down the readable area is current; scrolly() marks it, keeps it in the address and tells the page,
// which shows it on the stage. A bar under the stage steps through the beats with arrows, dots and the left/right keys.
import { el } from './data.js';
import { isTouched, kept } from './history.js';

const SVG = 'http://www.w3.org/2000/svg';
const pad = n => String(n).padStart(2, '0');

function arrow(dir, label) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7');
  svg.append(path);
  return el('button', { type: 'button', class: `mix-st-arrow ${dir}`, 'aria-label': label }, svg);
}

/**
 * opts: label (the bar's name, e.g. "Project steps"), noun ("step"), count(i) -> text for the counter,
 *       onStop(i, animate, isCurrent) shows beat i, onNear(i) prefetches for a beat about to show,
 *       topAtStart (beat 0 lands at the very top of the page).
 * The first beat has no hash of its own, so a plain link to the page opens at the start.
 * Returns { jump(i, { smooth, focus, animate }), cur }.
 */
export function scrolly(sec, { label, noun, count, onStop, onNear, topAtStart = false }) {
  const narrow = matchMedia('(max-width: 760px)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = sec.querySelector('.mix-st-chapters');
  const sticky = sec.querySelector('.mix-st-sticky');
  const beats = [...chapters.children];
  const ids = beats.map((b, i) => (i === 0 ? '' : b.id));
  const names = beats.map(b => b.dataset.name ?? '');
  const last = beats.length - 1;

  const prev = arrow('prev', `Previous ${noun}`);
  const next = arrow('next', `Next ${noun}`);
  const countEl = el('span', { class: 'mix-st-count' });
  const nameEl = el('b', { class: 'mix-st-name' });
  const dots = el('span', { class: 'mix-st-dots' }, names.map((name, i) =>
    el('button', { type: 'button', 'aria-label': name, onclick: () => jump(i, { announce: true }) })));
  // announced only when the person steps with the bar or the keys; scrolling past beats stays quiet
  const live = el('p', { class: 'hw-sr', 'aria-live': 'polite' });
  sticky.append(el('nav', { class: 'mix-st-bar', 'aria-label': label },
    prev, el('p', { class: 'mix-st-now' }, countEl, nameEl), dots, next, live));

  let cur = -1;
  function activate(i, animate = true, announce = false) {
    if (i === cur) return;
    cur = i;
    beats.forEach((b, k) => b.classList.toggle('on', k === i));
    countEl.textContent = count ? count(i) : `${pad(i + 1)} / ${pad(beats.length)}`;
    nameEl.textContent = names[i];
    [...dots.children].forEach((b, k) => b.setAttribute('aria-current', k === i ? 'step' : 'false'));
    prev.disabled = i === 0;
    next.disabled = i === last;
    if (announce) live.textContent = `${countEl.textContent}: ${names[i]}`;
    // an arrow or a link can land several beats away, so fetch this beat's and its neighbours' photos now
    for (let k = Math.max(0, i - 1); k <= Math.min(last, i + 2); k++) {
      for (const img of beats[k].querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
      onNear?.(k);
    }
    // replaced, not pushed: Back leaves the page, and coming back lands on this beat
    const url = location.pathname + location.search + (ids[i] ? `#${ids[i]}` : '');
    if (location.pathname + location.search + location.hash !== url) history.replaceState(history.state, '', url);
    onStop(i, animate, () => cur === i);
  }

  // the readable area starts under the sticky stage on a phone
  const readTop = () => (narrow.matches && !sticky.hidden ? sticky.getBoundingClientRect().bottom : 0);
  function fromScroll() {
    const doc = document.documentElement;
    if (scrollY + innerHeight >= doc.scrollHeight - 4) return last;
    const top = readTop();
    const line = top + (innerHeight - top) * 0.4;
    let i = 0;
    beats.forEach((b, k) => { if (b.getBoundingClientRect().top <= line) i = k; });
    return i;
  }

  // the scroll position that puts beat i just under the sticky stage (phone) or at the top (desktop)
  function landing(i) {
    const gap = narrow.matches && !sticky.hidden ? sticky.offsetHeight + 8 : 0;
    const top = i === 0 && topAtStart ? 0 : beats[i].getBoundingClientRect().top + scrollY - gap;
    return Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
  }

  // A jump holds its beat until the scroll arrives. Photos loading on the way can move the target, so aim again if it
  // ended short; the settle timeout lands it for good. A person scrolling mid-jump takes over.
  let hold = -1;
  let settle = 0;
  function release(force) {
    if (hold < 0) return;
    const off = Math.abs(scrollY - landing(hold));
    if (off > 4 && !force) { scrollTo({ top: landing(hold), behavior: calm.matches ? 'instant' : 'smooth' }); return; }
    if (off > 4) scrollTo({ top: landing(hold), behavior: 'instant' });
    hold = -1;
    clearTimeout(settle);
  }
  function jump(i, o = {}) {
    i = Math.max(0, Math.min(last, i));
    const smooth = o.smooth !== false && !calm.matches;
    hold = i;
    clearTimeout(settle);
    settle = setTimeout(() => release(true), smooth ? 2000 : 80);
    activate(i, o.animate, o.announce);
    scrollTo({ top: landing(i), behavior: smooth ? 'smooth' : 'instant' });
    if (o.focus) beats[i].focus({ preventScroll: true });
  }

  let raf = 0;
  addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (hold < 0) activate(fromScroll()); });
  }, { passive: true });
  addEventListener('scrollend', () => release(false));
  for (const type of ['wheel', 'touchstart']) addEventListener(type, () => { hold = -1; clearTimeout(settle); }, { passive: true });

  prev.addEventListener('click', () => jump(cur - 1, { announce: true }));
  next.addEventListener('click', () => jump(cur + 1, { announce: true }));
  // left/right step through the beats while the stage or its bar has focus; elsewhere the keys keep their usual jobs
  sticky.addEventListener('keydown', e => {
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    jump(cur + (e.key === 'ArrowLeft' ? -1 : 1), { announce: true });
  });

  const indexOf = hash => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    return id && id === beats[0].id ? 0 : ids.indexOf(id);
  };
  // in-page links (the step list, the tour index) land below the sticky stage instead of under it
  chapters.addEventListener('click', e => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || a.pathname !== location.pathname) return;
    const i = indexOf(a.hash);
    if (i < 0) return;
    e.preventDefault();
    jump(i, { focus: true });
  });
  addEventListener('hashchange', () => jump(Math.max(0, indexOf(location.hash))));

  const start = location.hash ? indexOf(location.hash) : -1;
  if (kept?.y != null) {
    // Back or a reload: the same scroll position as when the page was left; fonts and photos can move it, so land again
    const land = () => { if (isTouched()) return; scrollTo({ top: kept.y, behavior: 'instant' }); activate(fromScroll(), false); };
    land();
    document.fonts?.ready.then(land);
    if (document.readyState !== 'complete') addEventListener('load', land, { once: true });
  } else if (start > 0) {
    jump(start, { smooth: false, animate: false });
    // web fonts can move the beats a little; land on the deep-linked one again if nobody has scrolled yet
    document.fonts?.ready.then(() => { if (!isTouched()) jump(start, { smooth: false, animate: false }); });
  } else activate(fromScroll(), false);

  return { jump, get cur() { return cur; } };
}
