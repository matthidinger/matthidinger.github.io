// Dusk homepage helpers: seeded RNG, motion loop, slice range and the Nonsuch 30 silhouette.
(function () {
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Calls fn(clockMs) every frame while el is on screen and motion is allowed; fn(-1) draws the static pose.
  function loop(el, fn) {
    let visible = false, raf = 0, last = 0, clock = 0;
    function frame(now) {
      clock += last ? Math.min(now - last, 64) : 16;
      last = now;
      fn(clock);
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      const run = visible && !reduced.matches && !document.hidden;
      if (run && !raf) { last = 0; raf = requestAnimationFrame(frame); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      sync();
    }).observe(el);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', () => { sync(); if (reduced.matches) fn(-1); });
    fn(reduced.matches ? -1 : 0);
  }

  // Visible viewBox x-range for an SVG drawn with preserveAspectRatio xMidYMax slice.
  function sliceRange(svg, vbW, vbH) {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return [0, vbW];
    const s = Math.max(r.width / vbW, r.height / vbH);
    const w = r.width / s;
    const x0 = (vbW - w) / 2;
    return [x0, x0 + w];
  }

  const f = (n) => Math.round(n * 10) / 10;

  // Nonsuch 30 in profile, bow to the right, waterline at y = 0 (units: tenths of a foot).
  const P = {
    hull: 'M8,-33 Q150,-28 300,-40 L299,6 Q292,13 270,13 L40,12 Q18,11 12,4 Z',
    cabin: 'M98,-31 L103,-46 Q106,-50 116,-50 L206,-50 Q219,-50 228,-42 L234,-34 Z',
    coaming: 'M24,-32 L26,-41 L98,-41 L99,-32',
    wheel: 'M41,-41 A11,11 0 0 1 63,-41',
    mast: 'M279,-37 L285,-37 L283,-456 L280,-456 Z',
    sail: 'M279,-58 L279,-445 L262,-438 Q110,-290 40,-98 Q165,-64 279,-58 Z',
    wishbone: 'M282,-138 Q160,-104 36,-96',
  };
  const FONT = "'Bahnschrift','DIN Alternate','Franklin Gothic Medium','Arial Narrow',sans-serif-condensed,sans-serif";

  // Solid silhouette; the sail number 509 and the wishbone gap are cut out with a mask.
  function boat(id) {
    return `<defs><mask id="${id}-m" maskUnits="userSpaceOnUse" x="-20" y="-480" width="340" height="520">
        <rect x="-20" y="-480" width="340" height="520" fill="#fff"/>
        <text x="214" y="-292" font-size="46" font-weight="700" text-anchor="middle" font-family="${FONT}" letter-spacing="2" fill="#000">509</text>
        <path d="${P.wishbone}" stroke="#000" stroke-width="3" fill="none" transform="translate(0,7)"/>
      </mask></defs>
      <g mask="url(#${id}-m)">
        <path d="${P.sail}"/><path d="${P.mast}"/><path d="${P.cabin}"/><path d="${P.hull}"/>
        <path d="${P.wheel}" fill="none" stroke="currentColor" stroke-width="3"/>
        <path d="${P.coaming}" fill="none" stroke="currentColor" stroke-width="3"/>
      </g>
      <path d="${P.wishbone}" fill="none" stroke="currentColor" stroke-width="4"/>`;
  }

  window.Dusk = { rng, reduced, loop, sliceRange, f, boat };
})();
