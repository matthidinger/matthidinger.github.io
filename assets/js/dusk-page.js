// Dusk inner pages: draws the blue-hour masthead and the night footer scene, and wires the reading-page helpers.
(function () {
  const D = window.Dusk;
  const { rng, f, sliceRange } = D;
  const set = (el, a, v) => el.setAttribute(a, v);

  function firLine(W, base, hMin, hMax, r) {
    let d = `M0,${base + 30} L0,${base}`;
    for (let x = 0; x <= W + 20; x += 7 + r() * 12) {
      const h = Math.min(hMax, hMin + r() * (hMax - hMin) + 10 * Math.sin(x / 300));
      d += D.geo.fir(x, base + 4 * Math.sin(x / 140), h, h * 0.2 + 2);
    }
    return d + ` L${W + 20},${base + 30} Z`;
  }

  // Masthead: blue-hour sky, a few stars, a crescent and the fir line. Static.
  const msvg = document.querySelector('.dkp-mast-art');
  function mast() {
    const W = msvg.clientWidth, H = msvg.clientHeight;
    if (!W || !H) return;
    const r = rng(7);
    let stars = '';
    for (let i = 0; i < Math.round(W / 22); i++) {
      stars += `<circle cx="${f(r() * W)}" cy="${f(r() ** 1.4 * H * 0.62)}" r="${f(0.5 + r() ** 3 * 1.3)}" opacity="${f(0.35 + r() * 0.5)}"/>`;
    }
    const mx = f(W * 0.55), my = f(W <= 760 ? H * 0.6 : H * 0.32);
    set(msvg, 'viewBox', `0 0 ${W} ${H}`);
    msvg.innerHTML = `<rect width="${W}" height="${H}" fill="#2b3b6b"/><g fill="#fff6e0">${stars}</g>
      <mask id="dkp-mm"><circle cx="${mx}" cy="${my}" r="15" fill="#fff"/><circle cx="${f(mx + 6)}" cy="${f(my - 5)}" r="13.5" fill="#000"/></mask>
      <circle cx="${mx}" cy="${my}" r="15" fill="#f3e6cf" mask="url(#dkp-mm)"/>
      <path d="${firLine(W, H - 2, Math.min(26, H * 0.16), Math.min(64, H * 0.36), rng(510))}" fill="#141a36"/>`;
  }

  // Footer: the homepage scene at night, with the 509 crossing and the lighthouse beam sweeping.
  const fsvg = document.querySelector('.dk-foot-scene');
  const edge = document.querySelector('.dk-foot-edge');
  let S = null, range = [0, 1600];
  if (fsvg && D.build) {
    S = D.build(fsvg);
    const row = '0a1026 0d1430 111939 151e41 1b2547 b0644e aab0dc 1b2142 161b39 0f1430 1f2a56 37427a 0b0f26 3a3f66 39406e'.split(' ').map((h) => '#' + h);
    S.bands.forEach((b, i) => set(b, 'fill', row[i]));
    set(S.sunG, 'opacity', 0); set(S.nameG, 'opacity', 0); set(S.glitG, 'opacity', 0);
    set(S.far, 'fill', row[7]); set(S.mid, 'fill', row[8]); set(S.water, 'fill', row[9]); set(S.waves, 'stroke', row[10]);
    S.near.forEach((n) => set(n, 'fill', row[12]));
    set(S.tower, 'fill', row[13]); set(S.boat, 'fill', row[14]); set(S.boat, 'color', row[14]);
    for (const el of [S.stars, S.moon, S.lamp, S.mast]) set(el, 'opacity', 1);
  }
  const starPts = S ? [...S.stars.querySelectorAll('circle')].map((c) => [c, +c.getAttribute('cx'), +c.getAttribute('cy')]) : [];

  function foot() {
    if (!S) return;
    const [x0, x1] = range = sliceRange(fsvg, 1600, 1000), w = x1 - x0, k = Math.min(1, Math.max(0.5, w / 1500)), H0 = S.H0;
    const box = fsvg.getBoundingClientRect(), sc = Math.max(box.width / 1600, box.height / 1000) || 1, top = 1000 - box.height / sc;
    set(S.west, 'transform', `translate(${f(x0)},${H0}) scale(${f(k)}) translate(0,${-H0})`);
    set(S.east, 'transform', `translate(${f(x1)},${H0}) scale(${f(k)}) translate(-1600,${-H0})`);
    // The moon takes the free spot in its column nearest its usual height, clear of footer text and above the hills.
    const mx = box.left + w * 0.82 * sc, r = 24 * sc + 10;
    const lo = box.top + (Math.max(top + 150, 300) - top) * sc, hi = box.top + (H0 - 150 - top) * sc;
    const busy = [];
    for (const el of document.querySelectorAll('.dk-foot-in a, .dk-foot-in p')) {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > mx - r && b.left < mx + r) busy.push([b.top - r, b.bottom + r]);
    }
    busy.sort((a, b) => a[0] - b[0]);
    let cur = box.top + r, my = lo, gap = Infinity;
    const take = (a, b) => {
      if (b < a) return;
      const y = Math.min(Math.max(lo, a), b);
      if (Math.abs(y - lo) < gap) { gap = Math.abs(y - lo); my = y; }
    };
    for (const [a, b] of busy) { take(cur, Math.min(a, hi)); cur = Math.max(cur, b); }
    take(cur, hi);
    set(S.moon, 'transform', `translate(${f(x0 + w * 0.82)},${f(top + (my - box.top) / sc)})`);
    // Stars stay out of the footer's words so the links read cleanly.
    const words = [];
    for (const el of document.querySelectorAll('.dk-foot-in a, .dk-foot-in p')) {
      const rg = document.createRange();
      rg.selectNodeContents(el);
      for (const b of rg.getClientRects()) if (b.width) words.push([b.left - 6, b.top - 6, b.right + 6, b.bottom + 6]);
    }
    for (const [c, cx, cy] of starPts) {
      const sx = box.left + (cx - x0) * sc, sy = box.top + (cy - top) * sc;
      set(c, 'visibility', words.some(([l, t, rr, bb]) => sx > l && sx < rr && sy > t && sy < bb) ? 'hidden' : 'visible');
    }
    if (edge && edge.clientWidth) {
      const W = Math.round((edge.clientWidth * 90) / (edge.clientHeight || 60));
      set(edge, 'viewBox', `0 0 ${W} 90`);
      set(edge.firstElementChild, 'd', firLine(W, 82, 24, 78, rng(510)).replace(/^M0,112 L0,82/, 'M0,91 L0,82'));
    }
    if (D.reduced.matches) frame(-1);
  }

  function frame(clock) {
    if (!S) return;
    const [x0, x1] = range, s = innerWidth <= 760 ? 0.34 : 0.38, m = 330 * s;
    const still = clock < 0;
    const p = still ? 0.36 : (0.36 + clock / 70000) % 1;
    const y = 905 + (still ? 0 : Math.sin(clock / 850) * 2.2), rot = still ? 0 : Math.sin(clock / 1300) * 1.4;
    set(S.boatW, 'transform', `translate(${f(x0 - m + p * (x1 - x0 + 2 * m))},${f(y)}) rotate(${f(rot)}) scale(${s})`);
    const sx = Math.cos(still ? Math.PI : clock / 1150);
    set(S.beam, 'transform', `translate(1441,594) scale(${f(sx * 100) / 100},1)`);
    set(S.beam, 'opacity', f(0.3 + 0.7 * Math.abs(sx)));
  }

  // Wide code blocks become keyboard-scrollable.
  const pres = [...document.querySelectorAll('.dkp-prose pre')];
  function scrollers() {
    for (const pre of pres) {
      if (pre.scrollWidth > pre.clientWidth + 1) set(pre, 'tabindex', '0');
      else pre.removeAttribute('tabindex');
    }
  }

  // A CamelCase identifier too wide for its title line breaks at its word humps rather than mid-letter.
  const HUMP = /(?<=[a-z.])(?=[A-Z])/;
  const camels = [];
  for (const el of document.querySelectorAll('.dkp-title, .dkp-entry-title a, .post-pager__title, .dkp-more a')) {
    let box = el;
    while (box.parentElement && getComputedStyle(box).display.startsWith('inline')) box = box.parentElement;
    for (const n of [...el.childNodes]) {
      if (n.nodeType !== 3 || !n.data.split(/\s+/).some((t) => HUMP.test(t))) continue;
      const frag = document.createDocumentFragment();
      for (const tok of n.data.split(/(\s+)/)) {
        if (!HUMP.test(tok)) { frag.append(tok); continue; }
        const span = document.createElement('span');
        span.textContent = tok;
        camels.push({ span, box, parts: tok.split(HUMP), split: false });
        frag.append(span);
      }
      n.replaceWith(frag);
    }
  }
  function humps() {
    // Read each title's width first, then each token's unbroken width from a hidden probe that inherits its font.
    const rooms = camels.map(({ box }) => {
      const cs = getComputedStyle(box);
      return box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    });
    const probes = camels.map((c) => {
      const p = document.createElement('span');
      p.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap';
      p.textContent = c.parts.join('');
      c.span.append(p);
      return p;
    });
    const widths = probes.map((p) => p.getBoundingClientRect().width);
    for (const p of probes) p.remove();
    camels.forEach((c, i) => {
      const split = widths[i] > rooms[i] + 0.5;
      if (split === c.split) return;
      c.split = split;
      c.span.replaceChildren(...c.parts.flatMap((p, j) => (split && j ? [document.createElement('wbr'), p] : [p])));
    });
  }
  if (camels.length) {
    humps();
    // Titles narrow when teaser images load, fonts swap or the viewport changes; recheck a frame later.
    let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(humps); };
    const ro = new ResizeObserver(later);
    for (const box of new Set(camels.map((c) => c.box))) ro.observe(box);
    if (document.fonts) document.fonts.ready.then(later);
  }

  function layout() {
    if (msvg) mast();
    foot();
    scrollers();
  }
  new ResizeObserver(layout).observe(document.body);
  layout();
  if (document.fonts) document.fonts.ready.then(layout);
  if (S) D.loop(fsvg, frame);

  // Very wide or very tall teaser images crop from the top-left, where screenshots carry their detail.
  for (const img of document.querySelectorAll('.dkp-entry-thumb img')) {
    const fit = () => {
      const a = img.naturalWidth / (img.naturalHeight || 1);
      if (img.naturalWidth && (a > 2 || a < 0.5)) img.parentElement.classList.add('is-extreme');
    };
    if (img.complete) fit(); else img.addEventListener('load', fit, { once: true });
  }

  // Comments load from Disqus only when the reader asks for them.
  const cbtn = document.querySelector('.dkp-comments-btn');
  if (cbtn) {
    cbtn.hidden = false;
    cbtn.addEventListener('click', () => {
      window.disqus_shortname = cbtn.dataset.shortname;
      window.disqus_url = cbtn.dataset.disqusUrl;
      const s = document.createElement('script');
      s.src = `https://${cbtn.dataset.shortname}.disqus.com/embed.js`;
      s.async = true;
      s.setAttribute('data-timestamp', String(Date.now()));
      const note = document.createElement('p');
      note.className = 'dkp-comments-note';
      note.setAttribute('role', 'status');
      note.textContent = 'Loading comments…';
      cbtn.after(note);
      s.onload = () => note.remove();
      s.onerror = () => { note.textContent = 'Comments could not be loaded.'; };
      document.body.appendChild(s);
      // The button is about to disappear, so hand focus to the section heading instead of <body>.
      const head = cbtn.parentElement.querySelector('h2');
      cbtn.hidden = true;
      if (head) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
    }, { once: true });
  }

  // Videos stay a plain link (and load nothing from the host) until the reader presses play.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.dk-video-link[data-embed]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const box = document.createElement('div');
    box.className = 'dk-video-frame';
    const frameEl = document.createElement('iframe');
    frameEl.src = a.dataset.embed;
    frameEl.title = a.dataset.title || 'Video';
    frameEl.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    frameEl.allowFullscreen = true;
    box.appendChild(frameEl);
    a.replaceWith(box);
    frameEl.focus();
  });
})();
