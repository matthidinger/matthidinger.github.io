// Dusk homepage controller: scroll sets the time of day, the 509 crosses the Sound, plate edges are cut to fit.
(function () {
  const svg = document.querySelector('.dk-scene');
  if (!svg || !window.Dusk || !window.Dusk.build) return;
  const { rng, f, loop, sliceRange, reduced } = window.Dusk;
  const fir = window.Dusk.geo.fir;
  const S = window.Dusk.build(svg);

  // Rows run golden hour -> sunset -> blue hour -> night. Columns:
  // s0..s4 sky bands, sun, name, far ridge, mid ridge, water, waves, glitter, near shore, tower, boat
  const PAL = [
    '7fb3c8 a9c9cf e9d9b0 f3c48c f6b77a fff3d0 34497a 8a9cc2 6a7fa6 3f6684 6f93b0 ffe6b0 26345a f6eedc 142038',
    '3f5a8a 7d6f9c d98b7d f2a571 f7c27a ffd590 2a2c5c 6d6a96 4b4f7c 4a5684 7f7aa6 ffc47e 252a52 f2cdb0 141834',
    '1b2a52 2b3b6b 46507f 6c5f8c 9a7192 e98a6a e9c9b8 3a3f6b 2b3060 222d58 3b477a a07a98 1a1f44 9a95b8 0d1130',
    '0a1026 0d1430 111939 151e41 1b2547 b0644e aab0dc 1b2142 161b39 0f1430 1f2a56 37427a 0b0f26 3a3f66 39406e',
  ].map((row) => row.split(' ').map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))));

  const clamp = (v) => Math.min(1, Math.max(0, v));
  const smooth = (v) => v * v * (3 - 2 * v);
  const set = (el, a, v) => el.setAttribute(a, v);
  let night = 0, sweep = 1, range = [0, 1600];

  function colors(t) {
    const p = clamp(t) * (PAL.length - 1), i = Math.min(PAL.length - 2, Math.floor(p)), u = smooth(p - i);
    return PAL[i].map((a, k) => `rgb(${a.map((v, j) => Math.round(v + (PAL[i + 1][k][j] - v) * u)).join(',')})`);
  }

  function paint() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const t = max > 0 ? clamp(scrollY / max) : 0;
    const c = colors(t);
    S.bands.forEach((b, i) => set(b, 'fill', c[i]));
    const cy = f(520 + 190 * smooth(clamp(t / 0.55)));
    for (const el of [S.sun, S.halo]) { set(el, 'fill', c[5]); set(el, 'cy', cy); }
    set(S.nameG, 'fill', c[6]); set(S.far, 'fill', c[7]); set(S.mid, 'fill', c[8]); set(S.water, 'fill', c[9]);
    set(S.waves, 'stroke', c[10]); set(S.glitG, 'stroke', c[11]);
    S.near.forEach((n) => set(n, 'fill', c[12]));
    set(S.tower, 'fill', c[13]); set(S.boat, 'fill', c[14]); set(S.boat, 'color', c[14]);
    night = smooth(clamp((t - 0.5) / 0.45));
    set(S.stars, 'opacity', f(night));
    set(S.moon, 'opacity', f(smooth(clamp((t - 0.6) / 0.3))));
    for (const el of [S.lamp, S.mast]) set(el, 'opacity', f(night));
    set(S.beam, 'opacity', f(night * sweep));
    set(S.glitG, 'opacity', f(1 - night * 0.6));
  }

  // The name sits between the sky and the ridges: one line when it fits large, otherwise stacked.
  function nameLayout(x0, w) {
    const g = S.nameG, cx = f(x0 + w / 2), fit = w * 0.86;
    g.innerHTML = `<text x="${cx}" font-size="100" letter-spacing="2">MATT HIDINGER</text>`;
    let size = Math.min(270, (fit / g.firstChild.getComputedTextLength()) * 100);
    if (size >= 150) {
      g.innerHTML = `<text x="${cx}" y="616" font-size="${f(size)}" letter-spacing="${f(size * 0.02)}">MATT HIDINGER</text>`;
      return;
    }
    g.innerHTML = `<text x="${cx}" font-size="100" letter-spacing="2">HIDINGER</text>`;
    size = Math.min(230, (fit / g.firstChild.getComputedTextLength()) * 100);
    const a = `x="${cx}" font-size="${f(size)}" letter-spacing="${f(size * 0.02)}"`;
    const yb = f(616 - Math.min(size * 0.45, 40));
    g.innerHTML = `<text ${a} y="${f(yb - size * 0.8)}">MATT</text><text ${a} y="${yb}">HIDINGER</text>`;
  }

  // Top edges of the three content plates: a ridge line, a fir line, and a swell.
  const EDGE = [
    (W, r) => {
      let d = 'M0,91 L0,60';
      for (let x = 0; x <= W + 60; x += 24 + r() * 40) {
        d += ` L${f(x)},${f(Math.max(4, 84 - 74 * (0.5 + 0.5 * Math.sin(x / 230 + 1.3)) * (0.6 + 0.4 * Math.sin(x / 71)) - r() * 14))}`;
      }
      return d + ` L${f(W + 60)},91 Z`;
    },
    (W, r) => {
      let d = 'M0,91 L0,82';
      for (let x = 0; x <= W + 20; x += 7 + r() * 12) {
        const h = Math.min(78, 24 + r() * 46 + 14 * Math.sin(x / 300));
        d += fir(x, 82 + 4 * Math.sin(x / 140), h, h * 0.2 + 2);
      }
      return d + ` L${f(W + 20)},91 Z`;
    },
    (W, r) => {
      let d = 'M0,91 L0,54';
      for (let x = 0; x < W + 120; x += 120) d += ` Q${x + 30},${f(28 + r() * 12)} ${x + 60},54 T${x + 120},54`;
      return d + ` L${W + 120},91 Z`;
    },
  ];
  const edgeEls = [...document.querySelectorAll('.dk-edge')];

  function layout() {
    range = sliceRange(svg, 1600, 1000);
    const [x0, x1] = range, w = x1 - x0, k = Math.min(1, Math.max(0.5, w / 1500)), H0 = S.H0;
    set(S.west, 'transform', `translate(${f(x0)},${H0}) scale(${f(k)}) translate(0,${-H0})`);
    set(S.east, 'transform', `translate(${f(x1)},${H0}) scale(${f(k)}) translate(-1600,${-H0})`);
    const dx = `translate(${f(x0 + w * 0.68 - 1060)},0)`;
    set(S.sunG, 'transform', dx); set(S.glitG, 'transform', dx);
    set(S.moon, 'transform', `translate(${f(x0 + w * 0.8)},250)`);
    nameLayout(x0, w);
    edgeEls.forEach((el, i) => {
      const W = Math.round((el.clientWidth * 90) / (el.clientHeight || 60));
      set(el, 'viewBox', `0 0 ${W} 90`);
      set(el.firstElementChild, 'd', EDGE[i % EDGE.length](W, rng(509 + i)));
    });
    paint();
    if (reduced.matches) frame(-1);
  }

  // The boat crosses the visible water every 70 s; the lighthouse beam sweeps once night falls.
  function frame(clock) {
    const [x0, x1] = range, s = innerWidth <= 760 ? 0.3 : 0.38, m = 330 * s;
    const p = clock < 0 ? 0.3 : (clock / 70000) % 1;
    const y = 905 + (clock < 0 ? 0 : Math.sin(clock / 850) * 2.2), rot = clock < 0 ? 0 : Math.sin(clock / 1300) * 1.4;
    set(S.boatW, 'transform', `translate(${f(x0 - m + p * (x1 - x0 + 2 * m))},${f(y)}) rotate(${f(rot)}) scale(${s})`);
    const sx = Math.cos(clock < 0 ? Math.PI : clock / 1150);
    sweep = 0.3 + 0.7 * Math.abs(sx);
    set(S.beam, 'transform', `translate(1441,594) scale(${f(sx * 100) / 100},1)`);
    set(S.beam, 'opacity', f(night * sweep));
  }

  let queued = false;
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; paint(); }); }
  }, { passive: true });
  const ro = new ResizeObserver(() => layout());
  ro.observe(svg); ro.observe(document.body);
  if (document.fonts) document.fonts.ready.then(layout);
  layout();
  loop(svg, frame);
  document.documentElement.classList.add('dk-drawn');
})();
