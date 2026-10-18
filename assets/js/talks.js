// Talks page (_layouts/talks.html).
// Now showing → theater. Clicking a poster morphs it into a big screen while the other posters step aside,
// dims the house lights and plays the talk. Close, Esc or the browser's Back button returns to the posters.
// Without JavaScript (or Web Animations) the posters stay plain YouTube links.

// Coming soon tiles are filtered when the site builds; this also retires them once their day has passed between builds.
(() => {
  const soon = document.querySelector('.tkc-soon');
  if (!soon) return;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tiles = [...soon.querySelectorAll('li[data-date]')];
  for (const li of tiles) if (li.dataset.date < today) li.hidden = true;
  if (tiles.every((li) => li.hidden)) soon.hidden = true;
})();

// Narrow screens: the posters become a swipeable strip; the dots under it track and jump between posters.
(() => {
  const strip = document.querySelector('.tkc-posters');
  const dots = strip ? [...document.querySelectorAll('.tkc-dots button')] : [];
  if (!dots.length) return;
  const items = [...strip.children];
  const pad = () => parseFloat(getComputedStyle(strip).paddingInlineStart) || 0;
  const offset = (li) => li.getBoundingClientRect().left - strip.getBoundingClientRect().left - pad();
  let frame = 0;
  const sync = () => {
    frame = 0;
    let on = 0;
    items.forEach((li, i) => { if (Math.abs(offset(li)) < Math.abs(offset(items[on]))) on = i; });
    if (strip.scrollLeft > 2 && strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 2) on = items.length - 1;
    dots.forEach((b, i) => b.classList.toggle('is-on', i === on));
  };
  strip.addEventListener('scroll', () => { frame = frame || requestAnimationFrame(sync); }, { passive: true });
  addEventListener('resize', () => { frame = frame || requestAnimationFrame(sync); });
  dots.forEach((b, i) => b.addEventListener('click', () => {
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollTo({ left: strip.scrollLeft + offset(items[i]), behavior: smooth ? 'smooth' : 'auto' });
  }));
  sync();
})();
(() => {
  const now = document.querySelector('.tkc-now');
  const theater = now && now.querySelector('.tkc-theater');
  if (!theater || !Element.prototype.animate) return;
  const stage = now.closest('.tkc-stage');
  const head = now.querySelector('.tkc-nowhead');
  const label = head.querySelector('.tkc-label');
  const exitBtn = head.querySelector('.tkc-exit');
  const posters = [...now.querySelectorAll('.tkc-poster[data-tid]')];
  const screen = theater.querySelector('.tkc-screen');
  const sbox = theater.querySelector('.tkc-sbox');
  const glow = theater.querySelector('.tkc-glow');
  const under = theater.querySelector('.tkc-under');
  const bills = [...theater.querySelectorAll('.tkc-bill')];
  const cards = [...theater.querySelectorAll('.tkc-rcard')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';
  const EASE_IN = 'cubic-bezier(.55, 0, .75, .2)';
  let current = null;
  let busy = false;
  let closeQueued = false;

  const find = (list, tid) => list.find((el) => el.dataset.tid === tid);
  const ms = (n) => (reduce.matches ? 0 : n);
  const wait = (n) => new Promise((r) => setTimeout(r, n));
  const fx = (el, frames, o = {}) => el.animate(frames, { duration: ms(o.duration ?? 300), delay: ms(o.delay ?? 0), easing: o.easing ?? EASE, fill: o.fill ?? 'backwards' });
  const settle = (a) => a.finished.catch(() => {});
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: `${r.left + scrollX}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` };
  };
  const art = (tid) => {
    const t = find(posters, tid).querySelector('img');
    const w = find(cards, tid).querySelector('img');
    return { tall: t.src, tallPos: t.style.objectPosition, wide: w.src, widePos: w.style.objectPosition };
  };
  const decoded = (src) => { const i = new Image(); i.src = src; return Promise.race([i.decode().catch(() => {}), wait(450)]); };
  const warm = () => cards.forEach((c) => { c.querySelector('img').loading = 'eager'; });
  now.addEventListener('pointerover', warm, { once: true });
  now.addEventListener('focusin', warm, { once: true });

  const meta = (p) => [...p.querySelectorAll('.tkc-yr, .tkc-pmeta, .dk-video-play')];
  const aside = (dir) => `translateX(${dir * 40}%) rotate(${dir * 5}deg) scale(.92)`;
  const others = (p) => posters.filter((x) => x !== p).map((x) => [x, posters.indexOf(x) < posters.indexOf(p) ? -1 : 1]);
  const flip = (el, change) => {
    const x0 = el.getBoundingClientRect().left;
    change();
    const dx = x0 - el.getBoundingClientRect().left;
    if (Math.abs(dx) > 1) fx(el, [{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 700 });
  };
  const toHead = () => {
    const top = Math.max(0, head.getBoundingClientRect().top + scrollY - 16);
    if (Math.abs(top - scrollY) > 4) scrollTo({ top, behavior: reduce.matches ? 'instant' : 'smooth' });
  };

  // A stand-in that flies between a poster or rail thumbnail and the screen, cross-fading tall art to wide.
  // It lives in a full-width clipping layer so a flight that starts or ends past the viewport edge never widens the page.
  function ghost(at, a, radius) {
    const layer = document.createElement('div');
    layer.className = 'tkc-ghosts';
    const g = document.createElement('div');
    g.className = 'tkc-ghost';
    Object.assign(g.style, at, { borderRadius: radius });
    const tall = new Image();
    tall.alt = '';
    tall.src = a.tall;
    tall.style.objectPosition = a.tallPos;
    const wide = new Image();
    wide.alt = '';
    wide.src = a.wide;
    wide.style.objectPosition = a.widePos;
    const shade = document.createElement('span');
    g.append(tall, wide, shade);
    layer.append(g);
    document.body.append(layer);
    const reach = (r) => {
      const bottom = parseFloat(r.top) + parseFloat(r.height) + 160;
      if (bottom > (parseFloat(layer.style.height) || 0)) layer.style.height = `${bottom}px`;
    };
    reach(at);
    return { g, wide, shade, reach, remove: () => layer.remove() };
  }

  // On narrow screens the posters are a swipeable strip; bring a poster into it before flying back to it.
  const strip = now.querySelector('.tkc-posters');
  const reveal = (p) => {
    if (strip.scrollWidth <= strip.clientWidth + 1) return;
    const pad = parseFloat(getComputedStyle(strip).paddingInlineStart) || 0;
    strip.scrollLeft += p.getBoundingClientRect().left - strip.getBoundingClientRect().left - pad;
  };

  function stop() {
    const f = sbox.querySelector('iframe');
    if (f) f.remove();
    sbox.classList.remove('is-loading');
  }

  // Puts a talk on the screen: still, ambient glow, bill, rail state and a fresh player.
  function show(tid) {
    current = tid;
    const a = art(tid);
    const p = find(posters, tid);
    for (const b of bills) b.hidden = b.dataset.tid !== tid;
    for (const c of cards) c.setAttribute('aria-current', String(c.dataset.tid === tid));
    let still = sbox.querySelector('img');
    if (!still) { still = new Image(); still.alt = ''; sbox.prepend(still); }
    still.src = a.wide;
    still.style.objectPosition = a.widePos;
    glow.style.backgroundImage = `url("${a.wide}")`;
    theater.setAttribute('aria-label', `Theater: ${p.dataset.title}`);
    stop();
    const f = document.createElement('iframe');
    f.src = p.dataset.play;
    f.title = p.dataset.title;
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    sbox.classList.add('is-loading');
    f.addEventListener('load', () => {
      sbox.classList.remove('is-loading');
      setTimeout(() => f.classList.add('is-ready'), ms(350));
    }, { once: true });
    sbox.append(f);
  }

  function finish() {
    busy = false;
    if (closeQueued) { closeQueued = false; close(); }
  }

  async function open(p) {
    if (busy || current) return;
    busy = true;
    history.scrollRestoration = 'manual';
    history.pushState({ tkcTheater: p.dataset.tid }, '');
    const a = art(p.dataset.tid);
    warm();
    const outs = [
      ...meta(p).map((m) => fx(m, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'forwards' })),
      ...others(p).map(([x, d]) => fx(x, [{ transform: 'none', opacity: 1 }, { transform: aside(d), opacity: 0 }], { duration: 300, easing: EASE_IN, fill: 'forwards' })),
    ];
    await Promise.all([...outs.map(settle), decoded(a.wide)]);
    const from = rect(p);
    const g = ghost(from, a, '14px');
    flip(label, () => {
      show(p.dataset.tid);
      now.classList.add('is-theater');
      theater.hidden = false;
      exitBtn.hidden = false;
    });
    outs.forEach((o) => o.cancel());
    stage.classList.add('is-dim');
    sbox.style.visibility = 'hidden';
    const to = rect(sbox);
    const radius = getComputedStyle(sbox).borderRadius;
    toHead();
    g.reach(to);
    const morph = g.g.animate([{ ...from, borderRadius: '14px' }, { ...to, borderRadius: radius }], { duration: ms(760), easing: EASE, fill: 'forwards' });
    fx(g.wide, [{ opacity: 0 }, { opacity: 1 }], { duration: 560, delay: 60, easing: 'ease-in-out', fill: 'both' });
    fx(g.shade, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-out', fill: 'both' });
    fx(exitBtn, [{ opacity: 0, transform: 'translateX(14px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 380 });
    [...under.children].forEach((el, i) => fx(el, [{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 440 + i * 120 }));
    await settle(morph);
    sbox.style.visibility = '';
    screen.classList.add('is-lit');
    g.remove();
    theater.focus({ preventScroll: true });
    finish();
  }

  async function switchTo(c) {
    const tid = c.dataset.tid;
    if (busy || !current || tid === current) return;
    busy = true;
    history.replaceState({ tkcTheater: tid }, '');
    const a = art(tid);
    await decoded(a.wide);
    const from = rect(c.querySelector('.tkc-rthumb'));
    const to = rect(sbox);
    const radius = getComputedStyle(sbox).borderRadius;
    const g = ghost(from, { ...a, tall: a.wide, tallPos: a.widePos }, '8px');
    g.shade.style.opacity = '0';
    stop();
    screen.classList.remove('is-lit');
    for (const x of cards) x.setAttribute('aria-current', String(x === c));
    const oldBill = find(bills, current);
    const newBill = find(bills, tid);
    const out = fx(sbox, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 320, easing: EASE_IN, fill: 'forwards' });
    const billOut = fx(oldBill, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    toHead();
    g.reach(to);
    const morph = g.g.animate([{ ...from, borderRadius: '8px' }, { ...to, borderRadius: radius }], { duration: ms(700), easing: EASE, fill: 'forwards' });
    await settle(billOut);
    billOut.cancel();
    oldBill.hidden = true;
    newBill.hidden = false;
    fx(newBill, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 120 });
    await settle(morph);
    show(tid);
    out.cancel();
    screen.classList.add('is-lit');
    g.remove();
    finish();
  }

  async function close() {
    if (!current) return;
    if (busy) { closeQueued = true; return; }
    busy = true;
    const p = find(posters, current);
    const a = art(current);
    const from = rect(sbox);
    const radius = getComputedStyle(sbox).borderRadius;
    const g = ghost(from, a, radius);
    stop();
    screen.classList.remove('is-lit');
    const fades = [under, exitBtn].map((el) => fx(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' }));
    fx(g.wide, [{ opacity: 1 }, { opacity: 0 }], { duration: 480, delay: 240, easing: 'ease-in-out', fill: 'both' });
    fx(g.shade, [{ opacity: 0 }, { opacity: 1 }], { duration: 480, delay: 280, easing: 'ease-in', fill: 'both' });
    await Promise.all(fades.map(settle));
    flip(label, () => {
      now.classList.remove('is-theater');
      theater.hidden = true;
      exitBtn.hidden = true;
    });
    fades.forEach((f) => f.cancel());
    stage.classList.remove('is-dim');
    reveal(p);
    p.style.visibility = 'hidden';
    const m = meta(p);
    m.forEach((el) => { el.style.opacity = '0'; });
    const pr = p.getBoundingClientRect();
    if (pr.top < 0 || pr.bottom > innerHeight) toHead();
    const to = rect(p);
    g.reach(to);
    const morph = g.g.animate([{ ...from, borderRadius: radius }, { ...to, borderRadius: '14px' }], { duration: ms(640), easing: EASE, fill: 'forwards' });
    others(p).forEach(([x, d], i) => fx(x, [{ transform: aside(d), opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 560, delay: 100 + i * 70 }));
    await settle(morph);
    p.style.visibility = '';
    g.remove();
    m.forEach((el) => { el.style.opacity = ''; fx(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }); });
    current = null;
    history.scrollRestoration = 'auto';
    p.focus({ preventScroll: true });
    finish();
  }

  const leave = () => {
    if (history.state && history.state.tkcTheater) history.back();
    else close();
  };

  now.addEventListener('click', (e) => {
    const p = e.target.closest('.tkc-poster[data-tid]');
    if (p) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(p);
      return;
    }
    const c = e.target.closest('.tkc-rcard');
    if (c) switchTo(c);
  });
  exitBtn.addEventListener('click', leave);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current && !e.defaultPrevented) { e.preventDefault(); leave(); }
  });
  addEventListener('popstate', (e) => {
    if (current && !(e.state && e.state.tkcTheater)) close();
  });
})();
