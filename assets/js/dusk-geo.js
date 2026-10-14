// Dusk homepage scene geometry: procedural poster layers in a 1600x1000 box, horizon at y 676.
(function () {
  const { f } = window.Dusk;
  const H0 = 676;

  const band = (y) => `M-40,1000 L-40,${y} Q1060,${y - 34} 1640,${y} L1640,1000 Z`;

  function far(r) {
    let d = 'M-40,720 L-40,600';
    for (let x = -40; x <= 1660; x += 26 + r() * 44) {
      const y = 606 - 44 * (0.5 + 0.5 * Math.sin(x / 170 + 1)) - 28 * Math.sin(x / 63) ** 2 - r() * 16;
      d += ` L${f(x)},${f(y)}`;
    }
    return d + ' L1660,720 Z';
  }

  function mid() {
    let d = 'M-40,720';
    for (let x = -40; x <= 1680; x += 40) d += ` L${x},${f(654 - 20 * (0.5 + 0.5 * Math.sin(x / 260 + 2)) - 8 * Math.sin(x / 90))}`;
    return d + ' L1680,720 Z';
  }

  function waves(r) {
    const out = ['', '', ''];
    for (let k = 1; k <= 24; k++) {
      const y = H0 + 3 + 1.85 * k ** 1.62, len = 6 + k * 2.4;
      for (let i = 0, n = 7 + Math.floor(r() * 6); i < n; i++) out[Math.floor((k - 1) / 8)] += `M${f(-40 + r() * 1680)},${f(y)}h${f(len * (0.5 + r()))}`;
    }
    return out;
  }

  function glit(r) {
    const out = ['', ''];
    for (let k = 1; k <= 15; k++) {
      const y = H0 + 3 + 1.5 * k ** 1.62, s = 12 + k * 6;
      for (let i = 0; i < 4; i++) out[Math.floor(r() * 2)] += `M${f(1060 + (r() * 2 - 1) * s)},${f(y)}h${f(5 + k * 1.8)}`;
    }
    return out.map((d) => `<path class="dk-gl" d="${d}"/>`).join('');
  }

  const SIDE = [[-1, 0], [-0.42, -0.36], [-0.7, -0.34], [-0.26, -0.66], [-0.46, -0.64], [0, -1]];
  const FIR = SIDE.concat(SIDE.slice(0, 5).reverse().map(([a, c]) => [-a, c]));
  const fir = (x, b, h, w) => FIR.map(([a, c]) => ` L${f(x + a * w)},${f(b + c * h)}`).join('');

  function west(r) {
    let d = `M-60,${H0 + 1} L-60,640`;
    for (let x = -50; x < 440; x += 9 + r() * 11) {
      const b = 641 + 40 * Math.max(0, x / 470) ** 1.6, h = (48 + r() * 56) * (1 - x / 560);
      d += fir(x, b, h, h * 0.2 + 3);
    }
    return d + ` L470,${H0 + 1} L520,${H0 + 1} Z`;
  }

  function east(r) {
    let d = `M1240,${H0 + 1} Q1330,${H0 - 8} 1420,${H0 - 10} L1500,${H0 - 13}`;
    for (let x = 1504; x < 1660; x += 8 + r() * 9) d += fir(x, H0 - 12, 24 + r() * 44, 9);
    return d + ` L1660,${H0 + 1} Z`;
  }

  function stars(r) {
    const s = ['', '', ''];
    for (let i = 0; i < 120; i++) s[i % 3] += `<circle cx="${f(-40 + r() * 1680)}" cy="${f(r() ** 1.3 * 470)}" r="${f(0.6 + r() ** 3 * 1.7)}"/>`;
    return s.map((c) => `<g class="dk-tw">${c}</g>`).join('');
  }

  window.Dusk.geo = { H0, band, far, mid, waves, glit, fir, west, east, stars };
})();
