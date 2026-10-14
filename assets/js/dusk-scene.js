// Dusk homepage scene: assembles the poster layers into the fixed background SVG.
(function () {
  const { rng, geo: G } = window.Dusk;
  const H0 = G.H0;
  const DISPLAY = "'Tw Cen MT Condensed Extra Bold','Bahnschrift Condensed','DIN Condensed','Roboto Condensed','Arial Narrow',sans-serif";

  function boat() {
    const B = window.Dusk.boat;
    return `<g class="dk-boatW"><g class="dk-boat"><g transform="translate(-150,0)">
      <g transform="scale(1,-.42)" opacity=".24">${B('dkr')}</g>
      ${B('dkm')}
      <g class="dk-mast" opacity="0"><circle cx="281.5" cy="-463" r="20" fill="#7dffb4" opacity=".25"/><circle cx="281.5" cy="-463" r="6.5" fill="#c9ffe0"/></g>
    </g></g></g>`;
  }

  function lighthouse(r) {
    return `<g class="dk-east">
        <g class="dk-beam" opacity="0"><path d="M0,0 L1150,-50 L1150,50 Z" fill="url(#dk-beamg)"/></g>
        <path class="dk-near" d="${G.east(r)}"/>
        <g class="dk-tower"><path d="M1431,666 L1435,604 L1447,604 L1451,666 Z"/><rect x="1435" y="588" width="12" height="12"/><path d="M1452,666 L1452,652 L1462,645 L1472,652 L1472,666 Z"/></g>
        <g class="dk-near"><rect x="1430" y="600" width="22" height="4"/><path d="M1431,588 L1441,577 L1451,588 Z"/></g>
        <g class="dk-lamp" opacity="0"><circle cx="1441" cy="594" r="16" fill="#ffe9a8" opacity=".45"/><circle cx="1441" cy="594" r="4" fill="#fff6d8"/></g>
      </g>`;
  }

  function build(svg) {
    const r = rng(1979);
    const [w1, w2, w3] = G.waves(r);
    svg.innerHTML = `<defs><linearGradient id="dk-beamg" x1="0" x2="1"><stop offset="0" stop-color="#fff2c4" stop-opacity=".55"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></linearGradient></defs>
      <rect class="dk-b" x="-40" y="0" width="1680" height="1000"/>
      ${[250, 392, 482, 560].map((y) => `<path class="dk-b" d="${G.band(y)}"/>`).join('')}
      <g class="dk-stars" fill="#fff6e0" opacity="0">${G.stars(r)}</g>
      <g class="dk-moon" opacity="0"><mask id="dk-mm"><circle r="24" fill="#fff"/><circle cx="10" cy="-8" r="22" fill="#000"/></mask><circle r="24" fill="#f3e6cf" mask="url(#dk-mm)"/></g>
      <g class="dk-sunG"><circle class="dk-halo" cx="1060" cy="520" r="104" opacity=".28"/><circle class="dk-sun" cx="1060" cy="520" r="58"/></g>
      <g class="dk-nameG" text-anchor="middle" font-family="${DISPLAY}"></g>
      <path class="dk-far" d="${G.far(r)}"/>
      <path class="dk-mid" d="${G.mid()}"/>
      <rect class="dk-water" x="-40" y="${H0}" width="1680" height="340"/>
      <g class="dk-waves" fill="none" stroke-linecap="round"><path d="${w1}" stroke-width="1"/><path d="${w2}" stroke-width="1.8"/><path d="${w3}" stroke-width="2.8"/></g>
      <g class="dk-glitG" fill="none" stroke-linecap="round" stroke-width="2.2">${G.glit(r)}</g>
      ${lighthouse(r)}
      <g class="dk-west"><path class="dk-near" d="${G.west(r)}"/></g>
      ${boat()}`;
    const q = (s) => svg.querySelector(s);
    const qa = (s) => [...svg.querySelectorAll(s)];
    return {
      bands: qa('.dk-b'), stars: q('.dk-stars'), moon: q('.dk-moon'), sunG: q('.dk-sunG'),
      sun: q('.dk-sun'), halo: q('.dk-halo'), nameG: q('.dk-nameG'), far: q('.dk-far'), mid: q('.dk-mid'),
      water: q('.dk-water'), waves: q('.dk-waves'), glitG: q('.dk-glitG'), near: qa('.dk-near'), tower: q('.dk-tower'),
      lamp: q('.dk-lamp'), beam: q('.dk-beam'), west: q('.dk-west'), east: q('.dk-east'),
      boatW: q('.dk-boatW'), boat: q('.dk-boat'), mast: q('.dk-mast'), H0,
    };
  }

  window.Dusk.build = build;
})();
