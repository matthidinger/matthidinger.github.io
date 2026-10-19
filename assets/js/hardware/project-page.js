// A project page (/hardware/<id>/): the story's beats are already on the page. This makes it a scrolling story with a sticky
// stage beside them: the 3D model, with each step's photo pinned where it was taken, or, for projects the model doesn't show,
// the step photos crossfading (wide screens only; on a phone each beat's own photo is enough).
import { el, photo } from './data.js';
import { scrolly } from './scrolly.js';
import { mountStage } from './stage.js';

const pad = n => String(n).padStart(2, '0');
const narrow = () => matchMedia('(max-width: 760px)').matches;

export async function init(root, data) {
  const sec = root.querySelector('.pj-story');
  const p = data.projectById[data.page];
  const story = p?.hardware.story;
  if (!sec || !story?.steps?.length) return;
  const keyOf = n => (n ? (n.includes('/') ? n : `${p.id}/${n}`) : null);
  const steps = story.steps.map((s, k) => {
    const v = story.views?.[s.view] ?? null;
    return { ...s, i: k + 1, key: keyOf(s.photo), v, pin: s.pin === undefined ? v?.pin ?? null : s.pin };
  });
  const count = i => (i ? `${pad(i)} / ${pad(steps.length)}` : `${steps.length} steps`);
  const sticky = sec.querySelector('.mix-st-sticky');

  if (sec.dataset.story === 'photos') {
    photoStory(sec, sticky, data, p, steps, count);
    return;
  }

  const stage = sticky.querySelector('.vx-stage');
  // "Lower the anchor": the windlass story's switch step works the model's windlass, like the real switch does
  const demos = [...sec.querySelectorAll('button[data-demo="anchor"]')];
  const syncDemo = lowered => {
    for (const b of demos) {
      b.setAttribute('aria-pressed', String(lowered));
      b.textContent = lowered ? 'Raise the anchor' : 'Lower the anchor';
    }
  };
  sticky.hidden = false;
  sec.classList.add('is-live');
  let eng = null;
  const viewer = await mountStage(stage, data, {
    hint: false, zoom: false, initial: p.hardware.model.system, label: `3D model: ${p.title}`,
    // on a phone the model is a backdrop, so a swipe scrolls the page; taps still pick
    ...(narrow() ? { controls: false, pickable: true } : {}),
    onPin: pin => (pin.step != null ? eng?.jump(pin.step, { focus: true }) : viewer.select(pin.part)),
    onAnchor: lowered => syncDemo(lowered),
  });
  if (!viewer) { unlive(sec, sticky); return; }

  // the overview pins each place a photo was taken; steps in the same view and spot share one pin, which opens the first.
  // Different views never merge, so the windlass shows both on deck and in the locker below it.
  let places = null;
  function placePins() {
    const out = [];
    for (const s of steps) {
      if (!s.key || s.pin == null) continue;
      const at = Array.isArray(s.pin) ? s.pin : viewer.centerOf(s.pin);
      if (!at || out.some(o => o.view === s.view && Math.hypot(...o.at.map((x, j) => x - at[j])) < 0.3)) continue;
      out.push({ at, view: s.view, id: `place-${s.id}`, ...(Array.isArray(s.pin) ? { pos: s.pin } : { part: s.pin }),
        img: photo(data, s.key).small, n: s.i, title: `${pad(s.i)} · ${s.caption}`, step: s.i });
    }
    return out;
  }
  function overview(animate) {
    const m = p.hardware.model;
    places ??= placePins();
    viewer.focus({ system: m.system, mode: m.mode, cam: m.cam, at: m.at, tall: m.tall,
      also: [m.pin, ...(m.pins ?? []), ...(m.also ?? []), ...places.filter(o => o.part).map(o => o.part)],
      tags: places.length ? [] : m.tags }, { animate });
    viewer.setPins(places);
  }
  function stepModel(s, animate) {
    const v = s.v;
    if (!v) { overview(animate); return; }
    const part = typeof s.pin === 'string' ? s.pin : null;
    // close views inside the hull lose the boat around them, so a story can pull every step's camera back
    const k = v.pull ?? story.pull ?? 1;
    const cam = v.at.map((a, j) => a + (v.cam[j] - a) * k);
    viewer.focus({ system: v.system, mode: v.mode, cam, at: v.at, tags: s.tags ?? [], hide: s.hide,
      also: [...(v.also ?? []), ...(s.tags ?? []), ...(s.about ?? []), ...(part ? [part] : [])] }, { animate });
    if (!s.key || s.pin == null) { viewer.setPins([]); return; }
    // a phone's model is short and the photo sits right under it, so the pin stays round there, with its caption showing
    const polaroid = !narrow();
    viewer.setPins([{ id: 'step', ...(part ? { part } : { pos: s.pin }), img: photo(data, s.key).small, title: s.caption, polaroid, step: s.i }]);
    if (!polaroid) viewer.hotPin('step');
  }

  eng = scrolly(sec, {
    label: 'Project steps', noun: 'step', count,
    onStop: (i, animate, isCur) => viewer.ready.then(ok => { if (ok && isCur()) (i ? stepModel(steps[i - 1], animate) : overview(animate)); }),
    onNear: k => { const s = steps[k - 1]; if (s?.key) new Image().src = photo(data, s.key).small; },
  });

  if (!(await viewer.ready)) { unlive(sec, sticky); return; }
  if (viewer.anchor.available) {
    for (const b of demos) {
      b.closest('.pj-demo').hidden = false;
      b.addEventListener('click', () => viewer.anchor.toggle());
    }
  }
}

// the model couldn't load: the story reads top to bottom again, each beat with its own photo
function unlive(sec, sticky) {
  sticky.hidden = true;
  sec.classList.remove('is-live');
}

function photoStory(sec, sticky, data, p, steps, count) {
  const box = sticky.querySelector('.pj-photo-stage');
  const frames = [[p.hardware.cover ? `${p.id}/${p.hardware.cover}` : null, p.title], ...steps.map(s => [s.key, s.caption])];
  const imgs = [];
  frames.forEach(([key, caption], k) => {
    if (!key) return;
    const ph = photo(data, key);
    const img = el('img', {
      src: ph.small, alt: k ? `${p.title}: ${caption}` : p.title, decoding: 'async', loading: k < 2 ? null : 'lazy',
      dataset: { k: String(k) }, sizes: '60vw',
      srcset: ph.smallW ? `${ph.small} ${ph.smallW}w, ${ph.src} ${ph.w}w` : null,
      width: ph.w, height: ph.h,
    });
    imgs.push(img);
  });
  box.replaceChildren(...imgs);
  // the stage repeats each beat's own photo, so screen readers hear it once
  box.setAttribute('aria-hidden', 'true');
  sticky.hidden = false;
  sec.classList.add('is-live');
  // a step without a photo keeps the one before it
  const show = i => {
    let k = i;
    while (k > 0 && !frames[k][0]) k--;
    for (const img of imgs) img.classList.toggle('on', Number(img.dataset.k) === k);
  };
  scrolly(sec, {
    label: 'Project steps', noun: 'step', count, onStop: show,
    onNear: k => { const img = imgs.find(m => Number(m.dataset.k) === k); if (img) img.loading = 'eager'; },
  });
}
