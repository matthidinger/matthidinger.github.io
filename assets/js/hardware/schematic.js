// Stylised DC/AC wiring schematic for /hardware/wiring/, linked to the 3D viewer by part ID.
// Data: `wiring` from _data/hardware/wiring.yml ({ sheets, alias }); text for parts comes from `parts`.
// Solid = confirmed. Dashed, or a "?" badge = an assumption still to confirm. Not a wiring guide.
//
// createSchematic(el, { wiring, parts, circuit, has, onShow3D, onSelect, onCircuit?, follow?, title? })
//   -> { el, circuit, selected, setCircuit(id), highlight(partId), select(nodeId | null), refresh() }
//   has(partId)      the 3D model can show this part (gates the "Show in 3D" button and `follow`)
//   onShow3D(partId) "Show in 3D" pressed; also on any selection not made by highlight() while `follow` is true
//   onSelect(nodeId | null, circuitId, partId | null) after every selection change (user, select(), highlight())
//   onCircuit(circuitId) the schematic switched sheets itself (an "AC side →" link, or highlight())
//   title            optional { name, model } for the title block
import { el as h } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 114, H = 44;       // default node size, SVG units
const MIN_HIT = 48, PAD = 4; // hit areas grow to 48 units (>= 44 px once the sheet renders at 1:1)
const GLYPHED = new Set(['fuse', 'breaker', 'battery', 'switch']);
const PROTECTION = new Set(['fuse', 'breaker', 'bus']);
const SIGNAL = new Set(['data', 'ctl']); // wires that do not carry the feed
// when one 3D part maps to several symbols, prefer the thing over its fuse
const RANK = { device: 0, battery: 0, load: 0, switch: 0, box: 1, bus: 2, fuse: 3, breaker: 3, link: 9 };
const KIND = { fuse: 'Fuse', breaker: 'Breaker', bus: 'Bus', box: 'Panel', battery: 'Battery', switch: 'Switch', load: 'Load', device: 'Part', link: 'Link' };

let uid = 0;

function s(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v);
  e.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
  return e;
}

const known = r => Boolean(r) && !r.includes('?');
const label = n => [n.title, known(n.rating) && n.rating].filter(Boolean).join(' ');
const spoken = t => String(t).replace(/[→?]/g, '').replace(/\s+/g, ' ').trim();
const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
const gap = (a0, a1, b0, b1) => Math.max(0, b0 - a1, a0 - b1);
const within = (m, b) => m.t !== 'box' && m.x >= b.x && m.x + m.w <= b.x + b.w && m.y >= b.y && m.y + m.h <= b.y + b.h;

// What the pointer and the keyboard aim at: a panel frame is only "pressable" by its label strip.
const navRect = n => n.t === 'box' ? { x: n.x + 30, y: n.y + 3, w: n.w - 34, h: 17 } : { x: n.x, y: n.y, w: n.w, h: n.h };

// The focus ring hugs a panel's whole frame, everything else its symbol.
const ringRect = n => n.t === 'box' ? { x: n.x, y: n.y, w: n.w, h: n.h } : n.nav;

// Pad [a0, a1] out to `min`, keeping inside [lo, hi]; room lost on one side goes to the other.
function grow(a0, a1, lo, hi, min) {
  const need = Math.max(2 * PAD, min - (a1 - a0));
  let b0 = a0 - need / 2, b1 = a1 + need / 2;
  if (b0 < lo) { b1 = Math.min(hi, b1 + lo - b0); b0 = lo; }
  if (b1 > hi) { b0 = Math.max(lo, b0 - (b1 - hi)); b1 = hi; }
  return [b0, b1];
}

// Grow each target to MIN_HIT, but never past the midpoint to a neighbouring symbol.
// A panel's target is its whole frame, drawn beneath the symbols inside it.
function hitRect(n, nodes, def) {
  if (n.t === 'box') return { x: n.x, y: n.y, width: n.w, height: n.h };
  const r = n.nav, others = nodes.filter(m => m !== n && m.t !== 'box').map(m => m.nav);
  const px = Math.max(PAD, (MIN_HIT - r.w) / 2);
  let lo = 0, hi = def.h, left = 0, right = def.w;
  for (const o of others) {
    if (!overlaps(r.x - px, r.x + r.w + px, o.x, o.x + o.w)) continue;
    if (o.y >= r.y + r.h) hi = Math.min(hi, (r.y + r.h + o.y) / 2);
    else if (o.y + o.h <= r.y) lo = Math.max(lo, (o.y + o.h + r.y) / 2);
  }
  const [y0, y1] = grow(r.y, r.y + r.h, lo, hi, MIN_HIT);
  for (const o of others) {
    if (!overlaps(y0, y1, o.y, o.y + o.h)) continue;
    if (o.x >= r.x + r.w) right = Math.min(right, (r.x + r.w + o.x) / 2);
    else if (o.x + o.w <= r.x) left = Math.max(left, (o.x + o.w + r.x) / 2);
  }
  const [x0, x1] = grow(r.x, r.x + r.w, left, right, MIN_HIT);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function glyph(n) {
  const gx = n.x + 9, cy = n.y + n.h / 2;
  const p = d => s('path', { class: 'hws-g', d });
  if (n.t === 'fuse') return [p(`M${gx - 1} ${cy}H${gx + 19}`), s('rect', { class: 'hws-g', x: gx + 2, y: cy - 5, width: 14, height: 10, rx: 2 })];
  if (n.t === 'breaker') return [p(`M${gx - 1} ${cy}H${gx + 3}M${gx + 15} ${cy}H${gx + 19}M${gx + 3} ${cy}a6 6 0 0 1 12 0`)];
  if (n.t === 'battery') return [p(`M${gx + 2} ${cy - 10}V${cy + 10}M${gx + 8} ${cy - 5}V${cy + 5}M${gx + 14} ${cy - 10}V${cy + 10}M${gx + 20} ${cy - 5}V${cy + 5}`)];
  if (n.t === 'switch') return [s('circle', { class: 'hws-g', cx: gx + 2, cy, r: 2.4 }), s('circle', { class: 'hws-g', cx: gx + 18, cy, r: 2.4 }), p(`M${gx + 4} ${cy - 1}L${gx + 16} ${cy - 8}`)];
  return [];
}

const badge = (cx, cy, r = 8) => s('g', { class: 'hws-q', 'aria-hidden': 'true' },
  s('circle', { cx, cy, r }), s('text', { x: cx, y: cy + r * 0.44, 'text-anchor': 'middle' }, '?'));

function ariaLabel(n, sheetName) {
  if (n.t === 'link') return `${spoken(n.title)}: open the ${sheetName(n.go)} schematic`;
  const kind = KIND[n.t]?.toLowerCase() ?? 'part';
  return [spoken(n.title), known(n.rating) ? `${n.rating} ${kind}` : kind, n.q && 'to confirm'].filter(Boolean).join(', ');
}

// One symbol. Returns its <g> and the text runs that must fit inside it ([text, max width]).
function nodeEl(n, sheetName) {
  const cls = ['hws-node', `hws-${n.t}`, (n.q || n.dash) && 'hws-assumed', n.nomodel && 'hws-nomodel'].filter(Boolean).join(' ');
  const g = s('g', { class: cls, 'data-id': n.id, role: 'button', tabindex: '-1', 'aria-label': ariaLabel(n, sheetName) },
    s('rect', { class: 'hws-hit', ...n.hit }));
  const fits = [];
  const mark = n.q && n.badge !== false;
  if (n.t === 'bus') {
    g.append(s('rect', { class: 'hws-shape', x: n.x, y: n.y, width: n.w, height: n.h, rx: 3 }));
    if (n.label) g.append(s('text', { class: 'hws-buslabel', transform: `translate(${n.x - 7} ${n.y + n.h / 2}) rotate(-90)`, 'text-anchor': 'middle' }, n.label));
    return { g, fits };
  }
  if (n.t === 'box') {
    const t = s('text', { class: 'hws-boxlabel', x: n.x + n.w - 8, y: n.y + 15, 'text-anchor': 'end' }, n.title);
    g.append(s('rect', { class: 'hws-frame', x: n.x, y: n.y, width: n.w, height: n.h, rx: 10 }), t);
    if (mark) g.append(badge(n.x + n.w - 1, n.y + 1));
    fits.push([t, n.w - 40]);
    return { g, fits };
  }
  if (n.t === 'link') {
    const t = s('text', { class: 'hws-linktext', x: n.x + n.w / 2, y: n.y + n.h / 2 + 4, 'text-anchor': 'middle' }, n.title);
    g.append(s('rect', { class: 'hws-shape', x: n.x, y: n.y, width: n.w, height: n.h, rx: n.h / 2 }), t);
    fits.push([t, n.w - 16]);
    return { g, fits };
  }
  g.append(s('rect', { class: 'hws-shape', x: n.x, y: n.y, width: n.w, height: n.h, rx: n.t === 'load' ? 5 : 7 }));
  if (n.t === 'load') {
    const t = s('text', { class: 'hws-t1 hws-small', x: n.x + 9, y: n.y + 16 }, n.title);
    g.append(t);
    if (mark) g.append(badge(n.x + n.w - 1, n.y + 1));
    fits.push([t, n.w - 9 - (mark ? 12 : 6)]);
    return { g, fits };
  }
  const tx = GLYPHED.has(n.t) ? n.x + 36 : n.x + 10, mid = n.y + n.h / 2, room = n.x + n.w - 6 - tx;
  const lines = [];
  if (n.rating) {
    lines.push(s('text', { class: 'hws-t1', x: tx, y: mid - 4 }, n.title));
    lines.push(s('text', { x: tx, y: mid + 12 }, s('tspan', { class: 'hws-rate' }, n.rating), n.sub && s('tspan', { class: 'hws-t2', dx: 5 }, n.sub)));
  } else if (n.sub) {
    lines.push(s('text', { class: 'hws-t1', x: tx, y: mid - 3 }, n.title), s('text', { class: 'hws-t2', x: tx, y: mid + 12 }, n.sub));
  } else lines.push(s('text', { class: 'hws-t1', x: tx, y: mid + 4 }, n.title));
  g.append(...glyph(n), ...lines);
  if (mark) g.append(badge(n.x + n.w - 1, n.y + 1));
  for (const t of lines) fits.push([t, room]);
  return { g, fits };
}

function titleBlock(def, title) {
  const x = def.w - 256;
  const lines = [title?.model, 'Stylised, not a wiring guide', 'Dashed = route assumed'].filter(Boolean);
  return s('g', { class: 'hws-title', 'aria-hidden': 'true' },
    s('rect', { x, y: 14, width: 240, height: 30 + lines.length * 13, rx: 6 }),
    s('text', { class: 'hws-tb1', x: x + 12, y: 34 }, title?.name ? `${title.name} · ${def.name}` : def.name),
    lines.map((t, i) => s('text', { class: 'hws-t2', x: x + 12, y: 50 + i * 13 }, t)));
}

// Legend items are laid out once the sheet is visible and its text can be measured (see layout()).
function legend(def, nodes) {
  const items = (def.legend ?? []).map(l => ({ kind: l.kind, label: l.label }));
  const listed = kind => items.some(i => i.kind === kind);
  if (!listed('assumed') && (nodes.some(n => n.q || n.dash) || def.wires.some(w => w.assumed))) items.push({ kind: 'assumed', label: 'route assumed' });
  if (!listed('nomodel') && nodes.some(n => n.nomodel)) items.push({ kind: 'nomodel', label: 'not in 3D yet' });
  const groups = items.map(({ kind, label: text }) => {
    const swatch = kind === 'nomodel' ? [s('rect', { class: 'hws-shape hws-nomodel-swatch', x: 0, y: -7, width: 22, height: 14, rx: 3 })]
      : kind === 'assumed' ? [s('path', { class: 'hws-wire hws-swatch-assumed', d: 'M0 0H22' }), badge(31, 0, 7)]
        : [s('path', { class: `hws-wire hws-${kind}`, d: 'M0 0H22' })];
    const tx = kind === 'assumed' ? 44 : 30;
    const t = s('text', { class: 'hws-t2', x: tx, y: 4 }, text);
    return { g: s('g', {}, swatch, t), t, tx, text };
  });
  return { g: s('g', { class: 'hws-legend', 'aria-hidden': 'true' }, groups.map(i => i.g)), items: groups, y: def.h - 26 };
}

function build(def, { title, describedBy, sheetName }) {
  const nodes = def.nodes.map(n => ({ w: W, h: H, ...n }));
  for (const n of nodes) n.nav = navRect(n);
  for (const n of nodes) n.hit = hitRect(n, nodes, def);
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  const wires = def.wires.map((w, i) => ({ i, ...w }));
  const parent = {}, kids = {};
  for (const w of wires) {
    if (SIGNAL.has(w.kind)) continue;
    parent[w.to] = w.from;
    (kids[w.from] ??= []).push(w.to);
  }
  const boxKids = Object.fromEntries(nodes.filter(b => b.t === 'box').map(b => [b.id, nodes.filter(m => within(m, b)).map(m => m.id)]));
  const g = {}, fits = [];
  const make = n => { const r = nodeEl(n, sheetName); g[n.id] = r.g; fits.push(...r.fits); return r.g; };
  const wireEls = {};
  const wireGroup = s('g', { class: 'hws-wires', 'aria-hidden': 'true' }, wires.map(w => {
    const d = w.points.map((p, j) => `${j ? 'L' : 'M'}${p[0]} ${p[1]}`).join('');
    wireEls[w.i] = s('path', { class: `hws-wire hws-${w.kind}${w.assumed ? ' hws-assumed' : ''}`, d });
    const lab = w.label && s('text', { class: 'hws-wirelabel', x: w.lx, y: w.ly },
      [].concat(w.label).map((t, j) => s('tspan', { x: w.lx, dy: j ? 11 : 0 }, t)));
    return [wireEls[w.i], lab];
  }));
  const leg = legend(def, nodes);
  const ring = s('rect', { class: 'hws-ring', 'aria-hidden': 'true', rx: 9 });
  ring.style.display = 'none';
  const svg = s('svg', {
    class: 'hws-svg', 'data-circuit': def.id, viewBox: `0 0 ${def.w} ${def.h}`,
    tabindex: '-1', // Chromium otherwise makes the <svg> itself a tab stop
    role: 'group', 'aria-label': `${def.name} schematic`, 'aria-describedby': describedBy,
  },
  titleBlock(def, title),
  nodes.filter(n => n.t === 'box').map(make),
  wireGroup,
  nodes.filter(n => n.t !== 'box').map(make),
  leg.g, ring);
  svg.style.setProperty('--hws-w', `${def.w}px`);
  return { def, nodes, by, wires, wireEls, parent, kids, boxKids, g, fits, legend: leg, ring, svg, roving: null, order: nodes };
}

// Shrink any label that would overflow its symbol, and space the legend by measured text width.
function layout(v) {
  for (const [t, max] of v.fits) {
    t.removeAttribute('textLength');
    t.removeAttribute('lengthAdjust');
    const len = t.getComputedTextLength();
    if (len > max) { t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
  }
  let x = 20;
  for (const it of v.legend.items) {
    it.g.setAttribute('transform', `translate(${x} ${v.legend.y})`);
    x += it.tx + (it.t.getComputedTextLength() || it.text.length * 6) + 22;
  }
}

// Nearest symbol in an arrow's direction: distance along the arrow, sideways offset weighted 3x.
function nearest(v, n, key) {
  const a = n.nav, horiz = key === 'ArrowLeft' || key === 'ArrowRight';
  const sign = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
  let best = null, score = Infinity;
  for (const m of v.order) {
    const b = m.nav, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
    if (m === n || (horiz ? bcx - acx : bcy - acy) * sign <= 1) continue;
    const along = horiz ? (sign > 0 ? b.x - a.x - a.w : a.x - b.x - b.w) : (sign > 0 ? b.y - a.y - a.h : a.y - b.y - b.h);
    const side = horiz ? gap(a.y, a.y + a.h, b.y, b.y + b.h) : gap(a.x, a.x + a.w, b.x, b.x + b.w);
    const sc = Math.max(0, along) + 3 * side + 0.05 * Math.hypot(bcx - acx, bcy - acy);
    if (sc < score) { score = sc; best = m; }
  }
  return best;
}

function setRoving(v, id) {
  if (v.roving === id) return;
  v.g[v.roving]?.setAttribute('tabindex', '-1');
  v.roving = id;
  v.g[id].setAttribute('tabindex', '0');
}

function focusNode(v, id) {
  setRoving(v, id);
  v.g[id].focus();
}

// Bring a symbol into the sideways-scrolling box without moving the page.
function reveal(box, el) {
  if (box.scrollWidth <= box.clientWidth) return;
  const b = box.getBoundingClientRect(), r = el.getBoundingClientRect(), pad = 16;
  if (r.left < b.left + pad) box.scrollLeft += r.left - b.left - pad;
  else if (r.right > b.right - pad) box.scrollLeft += Math.min(r.right - b.right + pad, r.left - b.left - pad);
}

function placeRing(v, n, visible) {
  const r = ringRect(n), p = 5;
  for (const [k, val] of Object.entries({ x: r.x - p, y: r.y - p, width: r.w + 2 * p, height: r.h + 2 * p })) v.ring.setAttribute(k, val);
  v.ring.style.display = visible ? '' : 'none';
}

function upstream(v, id) {
  const out = [], seen = new Set([id]);
  for (let p = v.parent[id]; p && !seen.has(p); p = v.parent[p]) { seen.add(p); out.unshift(p); }
  return out;
}

function downstream(v, id, acc = [], seen = new Set([id])) {
  for (const k of v.kids[id] ?? []) if (!seen.has(k)) { seen.add(k); acc.push(k); downstream(v, k, acc, seen); }
  return acc;
}

// A symbol's feed (source first) and everything it feeds. A panel takes those of the symbols inside it.
function reach(v, n) {
  if (n.t !== 'box') return { up: upstream(v, n.id), down: downstream(v, n.id) };
  const inside = new Set(v.boxKids[n.id]), up = new Set(), down = new Set();
  for (const k of inside) {
    for (const x of upstream(v, k)) if (!inside.has(x)) up.add(x);
    for (const x of downstream(v, k)) if (!inside.has(x)) down.add(x);
  }
  return { up: [...up], down: [...down] };
}

function unpaint(v) {
  v.svg.classList.remove('hws-dim');
  for (const g of Object.values(v.g)) { g.classList.remove('hws-on', 'hws-path'); g.removeAttribute('aria-current'); }
  for (const p of Object.values(v.wireEls)) p.classList.remove('hws-path');
}

// Light the symbol, its feed back to the source and everything it feeds; dim the rest.
function paint(v, n, up, down) {
  unpaint(v);
  const lit = new Set([n.id, ...up, ...down, ...(v.boxKids[n.id] ?? [])]), path = new Set([...lit].filter(x => x !== n.id));
  for (const [box, inside] of Object.entries(v.boxKids)) if (inside.some(x => lit.has(x))) path.add(box);
  v.svg.classList.add('hws-dim');
  for (const [id, g] of Object.entries(v.g)) {
    g.classList.toggle('hws-on', id === n.id);
    g.classList.toggle('hws-path', id !== n.id && path.has(id));
    if (id === n.id) g.setAttribute('aria-current', 'true');
  }
  for (const w of v.wires) {
    const on = (lit.has(w.from) && lit.has(w.to) && !SIGNAL.has(w.kind)) || w.from === n.id || w.to === n.id;
    v.wireEls[w.i].classList.toggle('hws-path', on);
  }
}

export function createSchematic(container, {
  wiring, parts = {}, circuit = 'dc', has = () => false, onShow3D, onSelect, onCircuit, follow = true, title,
} = {}) {
  const sheets = wiring?.sheets ?? [];
  if (!sheets.length) throw new Error('createSchematic: no wiring sheets');
  const alias = wiring.alias ?? {};
  const sheetName = id => sheets.find(d => d.id === id)?.name ?? id;
  const keys = h('p', { class: 'hws-sr', id: `hws-keys-${++uid}`, text: 'Arrow keys move between symbols. Enter or Space selects one and lights its feed. Escape clears.' });
  const scroller = h('div', { class: 'hws-scroll' });
  const info = h('div', { class: 'hws-info', 'aria-live': 'polite' });
  const root = h('div', { class: 'hws' }, keys, scroller, info);
  const views = {};
  let cur = null, sel = null;

  for (const def of sheets) {
    const v = views[def.id] = build(def, { title, describedBy: keys.id, sheetName });
    v.svg.style.display = 'none';
    setRoving(v, v.order[0].id);
    listen(v);
    scroller.append(v.svg);
  }
  container.append(root);

  function listen(v) {
    v.svg.addEventListener('click', e => {
      const g = e.target.closest('.hws-node');
      if (g) activate(v.by[g.dataset.id]);
    });
    v.svg.addEventListener('keydown', e => {
      const g = e.target.closest?.('.hws-node');
      if (!g || e.altKey || e.ctrlKey || e.metaKey) return;
      const n = v.by[g.dataset.id];
      let to = null;
      if (e.key.startsWith('Arrow')) to = nearest(v, n, e.key) ?? n;
      else if (e.key === 'Home') to = v.order[0];
      else if (e.key === 'End') to = v.order.at(-1);
      else if (e.key === 'Enter' || e.key === ' ') { placeRing(v, n, true); activate(n); }
      else if (e.key === 'Escape' && sel != null) clear(true);
      else return;
      e.preventDefault();
      if (to) { focusNode(v, to.id); placeRing(v, to, true); }
    });
    v.svg.addEventListener('focusin', e => {
      const g = e.target.closest?.('.hws-node');
      if (!g) return;
      setRoving(v, g.dataset.id);
      placeRing(v, v.by[g.dataset.id], g.matches(':focus-visible'));
    });
    v.svg.addEventListener('focusout', () => { v.ring.style.display = 'none'; });
  }

  function idle(text = views[cur].def.hint) {
    info.replaceChildren(h('p', { class: 'hws-idle', text }));
  }

  // Switch the visible sheet; drops the selection without notifying (callers decide).
  function show(c, refocus = true) {
    const had = cur != null && views[cur].svg.contains(document.activeElement);
    if (cur != null) unpaint(views[cur]);
    sel = null;
    cur = c;
    for (const [k, v] of Object.entries(views)) v.svg.style.display = k === c ? '' : 'none';
    scroller.scrollLeft = 0;
    root.dataset.circuit = c;
    layout(views[c]);
    idle();
    if (had && refocus) focusNode(views[c], views[c].roving);
  }

  function clear(notify) {
    const had = sel != null;
    unpaint(views[cur]);
    sel = null;
    idle();
    if (notify && had) onSelect?.(null, cur, null);
  }

  function pick(id, { show3D = false } = {}) {
    const v = views[cur], n = v.by[id];
    const { up, down } = reach(v, n);
    paint(v, n, up, down);
    sel = id;
    // keep focus, the ring and the tab stop together when the selection moves under a keyboard user
    if (v.svg.contains(document.activeElement)) focusNode(v, id); else setRoving(v, id);
    reveal(scroller, v.g[id]);
    render(v, n, up, down);
    onSelect?.(id, cur, n.part ?? null);
    if (show3D && n.part && !n.nomodel && has(n.part)) onShow3D?.(n.part);
  }

  function activate(n) {
    if (n.t !== 'link') { pick(n.id, { show3D: follow }); return; }
    const from = views[cur], to = views[n.go];
    if (!to) return;
    const hadFocus = from.svg.contains(document.activeElement);
    show(n.go, false);
    onCircuit?.(cur);
    // land on the symbol both sheets share (the MultiPlus links DC and AC)
    const twin = to.nodes.find(m => m.t !== 'link' && from.by[m.id] && from.by[m.id].t !== 'link');
    if (twin) pick(twin.id, { show3D: follow });
    else onSelect?.(null, cur, null);
    if (hadFocus) { focusNode(to, to.roving); placeRing(to, to.by[to.roving], true); }
  }

  function render(v, n, up, down) {
    const body = PROTECTION.has(n.t) ? '' : parts[n.part]?.body ?? '';
    const guard = [...up.map(x => v.by[x]).filter(m => m.chain), ...(n.chain ? [n] : [])];
    const feeds = down.map(x => v.by[x]).filter(m => !PROTECTION.has(m.t) && m.t !== 'link');
    const chain = guard.flatMap((m, i) => [
      i ? [h('span', { 'aria-hidden': 'true', text: ' → ' }), h('span', { class: 'hws-sr', text: ', then ' })] : [],
      h('b', { text: label(m) }),
      m.q ? [h('span', { class: 'hws-qm', 'aria-hidden': 'true', text: '?' }), h('span', { class: 'hws-sr', text: ' (to confirm)' })] : [],
    ]);
    const canShow = n.part && !n.nomodel && has(n.part);
    info.replaceChildren(...[
      h('p', { class: 'hws-k', text: `${KIND[n.t] ?? 'Part'}${n.nomodel ? ' · not in the 3D model yet' : ''}` }),
      h('p', { class: 'hws-h' }, label(n), n.sub ? h('span', { class: 'hws-sub', text: ` · ${n.sub}` }) : null),
      body ? h('p', { class: 'hws-body', text: body }) : null,
      chain.length ? h('p', { class: 'hws-chain' }, `From the ${cur === 'ac' ? 'source' : 'bank'}: `, ...chain) : null,
      feeds.length ? h('p', { class: 'hws-chain', text: `Feeds: ${feeds.map(m => m.title).join(', ')}` }) : null,
      n.q ? h('p', { class: 'hws-qnote', text: `To confirm: ${n.q}` }) : null,
      canShow ? h('button', { type: 'button', class: 'hws-show', text: 'Show in 3D', onclick: () => onShow3D?.(n.part) }) : null,
    ].filter(Boolean));
  }

  function setCircuit(c) {
    if (!(c in views)) return false;
    if (c !== cur) show(c);
    return true;
  }

  // Programmatic selection on the current sheet (deep links). Fires onSelect, and onShow3D when following.
  function select(nodeId) {
    if (nodeId == null) { clear(true); return true; }
    const n = views[cur].by[nodeId];
    if (!n || n.t === 'link') return false;
    pick(n.id, { show3D: follow });
    return true;
  }

  // A part was picked in 3D: light its best symbol (switching sheets if needed) without echoing back.
  function highlight(partId) {
    const want = alias[partId] ?? partId;
    const find = v => v.nodes.filter(n => n.part === want).sort((a, b) => (RANK[a.t] ?? 5) - (RANK[b.t] ?? 5))[0];
    let n = find(views[cur]);
    if (!n) {
      const other = Object.keys(views).find(k => k !== cur && find(views[k]));
      if (other) { show(other); onCircuit?.(other); n = find(views[other]); }
    }
    if (n) { pick(n.id); return true; }
    clear(true);
    idle(`${parts[partId]?.title ?? 'That part'} isn’t on this schematic.`);
    return false;
  }

  // Re-measure labels and redraw the panel, e.g. once the 3D model has loaded and has() changes.
  function refresh() {
    const v = views[cur];
    layout(v);
    if (sel != null) { const { up, down } = reach(v, v.by[sel]); render(v, v.by[sel], up, down); }
  }

  show(circuit in views ? circuit : sheets[0].id);
  document.fonts?.ready.then(() => layout(views[cur]));

  return {
    el: root,
    get circuit() { return cur; },
    get selected() { return sel; },
    setCircuit, highlight, select, refresh,
  };
}
