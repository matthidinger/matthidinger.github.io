// The 3D model of NONSENSE for the Hardware pages. mountViewer(stage, data, opts) mounts the model into
// `stage` and returns a small API pages use to drive it (systems, story camera views, photo pins, part cards).
// Progressive enhancement: the stage's own HTML is never removed; stage.dataset.state goes
// loading -> ready | failed, and `ready` resolves false on any failure. Frames render only when something
// changes and the stage is on screen. Styles live in assets/css/hardware-viewer.css.
import * as THREE from './lib/three.min.js';
import { el, modelUrl, photo, prefersReducedMotion, siteUrl } from './data.js';
import { SWITCH_PART, createAnchor } from './anchor.js';

const { Box3, Color, Vector2, Vector3 } = THREE;

const FLIGHT_MS = 900;
const FADE_MS = 260;
const LOAD_TIMEOUT_MS = 20000;
const PICK_SLOP = 6;
const GLOW = new Color(0x2a2a2a);
const PREVIEW_DIM = 0.06;

// Blender metres (+X forward, +Y port, +Z up) <-> three.js (+Y up)
const B = (x, y, z) => new Vector3(x, z, -y);
const vec = a => (a?.isVector3 ? a.clone() : B(...(typeof a === 'string' ? a.trim().split(/[\s,]+/) : a).map(Number)));
const toB = v => [v.x, -v.z, v.y].map(n => Math.round(n * 1000) / 1000);
// data text, never a placeholder
const text = s => (typeof s === 'string' && s.trim() && s.trim() !== '?' ? s.trim() : '');

// the only shared state: one download of the model for every viewer on the page
let glbPromise = null;
function loadModel() {
  if (!glbPromise) {
    const loader = new THREE.GLTFLoader();
    loader.setMeshoptDecoder(THREE.MeshoptDecoder);
    glbPromise = loader.loadAsync(modelUrl());
    glbPromise.catch(() => { glbPromise = null; });
  }
  return glbPromise;
}

/**
 * opts: controls (true), zoom (true), pickable (= controls), chips (element), hint (true), initial ('all'),
 *       lazy (true), label ('3D model of the boat'), onPick(partId) -> true to skip the default,
 *       onPin(pin), onPinHover(pin|null), onChange(), onProject(projectId) -> true to stay on the page,
 *       onAnchor(lowered) after any press of the windlass switch (the model, its card or viewer.anchor)
 */
export function mountViewer(stage, data, opts = {}) {
  const boat = data.boat;
  const parts = data.parts ?? {};
  const projectById = data.projectById ?? Object.fromEntries((data.projects ?? []).map(p => [p.id, p]));
  const sysById = Object.fromEntries(boat.systems.map(s => [s.id, s]));
  const xray = { ...boat.xray, id: 'xray', tags: boat.xray?.tags ?? [] };
  const focusable = new Set(boat.focusable ?? []);
  const hullXray = boat.hull_xray ?? {};
  const acParts = new Set(boat.circuits?.ac ?? []);
  const bothParts = new Set(boat.circuits?.both ?? []);
  const mastParts = new Set(boat.mast ?? []);

  const orbit = opts.controls !== false;
  const pickable = opts.pickable ?? orbit;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const reduced = () => prefersReducedMotion();
  const initial = opts.initial ?? 'all';

  // ---------- systems, modes and how solid each part is ----------
  const sysOf = id => (id === 'xray' ? xray : sysById[id]);
  const modeIds = id => (sysOf(id)?.modes ?? []).map(m => m.id);
  const usesCircuits = id => modeIds(id).some(m => m === 'ac' || m === 'dc');
  const circuitOf = part => (bothParts.has(part) ? 'both' : acParts.has(part) ? 'ac' : 'dc');
  const defMode = id => modeIds(id)[0] ?? null;
  function modeFor(id, part) {
    const ids = modeIds(id);
    if (!ids.length) return null;
    if (usesCircuits(id)) return ids.includes(circuitOf(part)) ? circuitOf(part) : ids[0];
    if (ids.includes('mast')) return mastParts.has(part) ? 'mast' : ids.find(m => m !== 'mast');
    return ids[0];
  }
  // a system preset with its mode's camera, extra parts and labels laid over it
  function viewOf(id, mode) {
    const s = sysOf(id);
    const v = { ...s };
    const m = s.modes?.find(x => x.id === mode);
    if (m) {
      for (const k of ['cam', 'at', 'tall', 'also', 'tags']) if (m[k] !== undefined) v[k] = m[k];
      if (m.cam && !m.tall) delete v.tall;
    }
    return v;
  }
  function focused(m, v, mode) {
    const { system, part } = m.userData;
    if (v.id === 'xray') return focusable.has(system);
    if (system !== v.id && !v.also?.includes(part)) return false;
    if (!usesCircuits(v.id) || (mode !== 'ac' && mode !== 'dc')) return true;
    const c = circuitOf(part);
    return c === 'both' || c === mode;
  }
  // the view's gear solid, the hull and cabin a ghost around it (0 = not drawn)
  function alphaOf(m, id, v, mode) {
    const { system, part } = m.userData;
    if (id === 'all') return 1;
    if (system === 'sail') return 0;
    if (v.also?.includes(part)) return 1;
    if (system === 'rig') return id === 'xray' || id === 'electronics' ? 0.22 : 0;
    if (system === 'hull') return id === 'xray' ? hullXray[part] ?? 0.3 : 0.12;
    if (system === 'interior') return id === 'xray' ? 0.22 : 0.28;
    return focused(m, v, mode) ? 1 : 0.18;
  }
  const titleOf = part => text(parts[part]?.title) || part.replace(/-/g, ' ');

  // ---------- DOM: the stage keeps whatever the page rendered into it ----------
  const before = { cls: stage.classList.contains('b3'), role: stage.getAttribute('role'), label: stage.getAttribute('aria-label') };
  stage.classList.add('b3');
  if (!before.role) stage.setAttribute('role', 'region');
  if (!before.label) stage.setAttribute('aria-label', opts.label ?? '3D model of the boat');
  stage.dataset.state = 'loading';
  const msg = el('p', { class: 'b3-msg', role: 'status', text: 'Loading the 3D model…' });
  stage.append(msg);
  const added = [msg];
  const cleanups = [];
  const listen = (target, type, fn, o) => { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); };

  let state = 'loading', destroyed = false, started = false;
  let resolveReady;
  const ready = new Promise(r => { resolveReady = r; });

  // chips go in at once so the row doesn't jump when the model arrives; calls made before then are queued
  const chipButtons = [];
  let chipsMarked = false;
  if (opts.chips) {
    chipsMarked = !opts.chips.classList.contains('b3-chips');
    opts.chips.classList.add('b3-chips');
    for (const s of boat.systems) {
      const b = el('button', { type: 'button', class: 'b3-chip', 'aria-pressed': String(s.id === initial), dataset: { id: s.id },
        onclick: () => { show(s.id); opts.onChange?.(); } }, el('i', { 'aria-hidden': 'true' }), s.name);
      b.style.setProperty('--c', s.color);
      chipButtons.push(b);
    }
    opts.chips.append(...chipButtons);
  }

  // ---------- three.js objects, created when the stage nears the viewport ----------
  let renderer, labels, scene, camera, controls = null, envTex, anchor = null, canvas;
  const target = new Vector3();
  const meshes = [];
  const byPart = new Map();
  let current = initial, mode = null, view = null, hidden = new Set(), rest = new Map();
  let flight = null, fade = null, selected = null, hovered = null, hoverAt = null, instant = false;
  let raf = 0, onScreen = typeof IntersectionObserver === 'undefined', docVisible = document.visibilityState !== 'hidden';
  let tagLabels = [], pinLabels = [], hotId = null, hoveredPin = null;
  let sizes = new WeakMap();
  const queue = [];
  let seg, hint, card, partsBox, partsList, explore, done, opener = null;

  function invalidate() {
    if (!raf && state === 'ready' && onScreen && docVisible) raf = requestAnimationFrame(frame);
  }

  function fail(err) {
    if (state !== 'loading' || destroyed) return;
    state = 'failed';
    if (err) console.warn('Hardware viewer: the 3D model could not load.', err);
    teardown();
    for (const b of chipButtons) b.remove();
    if (chipsMarked) opts.chips.classList.remove('b3-chips');
    msg.textContent = 'The 3D model couldn\u2019t load.';
    stage.append(msg);
    stage.dataset.state = 'failed';
    resolveReady(false);
  }

  function start() {
    if (started || destroyed) return;
    started = true;
    lazyIo?.disconnect();
    try {
      canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default' });
      if (!gl) throw new Error('WebGL 2 is not available');
      renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
    } catch (err) {
      canvas = null;
      fail(err);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'b3-canvas';
    listen(canvas, 'webglcontextlost', () => fail(new Error('WebGL context lost')));
    listen(canvas, 'webglcontextrestored', invalidate);

    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new THREE.RoomEnvironment();
    envTex = pmrem.fromScene(room, 0.04).texture;
    room.dispose?.();
    pmrem.dispose();
    scene.environment = envTex;
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
    const first = viewOf(sysOf(initial) ? initial : 'all', defMode(initial));
    camera.position.copy(vec(first.cam));
    target.copy(vec(first.at));

    const timer = setTimeout(() => fail(new Error('timed out')), LOAD_TIMEOUT_MS);
    loadModel().then(gltf => {
      clearTimeout(timer);
      if (state !== 'loading' || destroyed) return;
      try { build(gltf); } catch (err) { fail(err); }
    }, err => { clearTimeout(timer); fail(err); });
  }

  function register(m) {
    const mat = m.material;
    m.userData.base = mat.opacity;
    m.userData.baseT = mat.transparent;
    m.userData.alpha = 1;
    m.userData.emissive = mat.emissive?.clone() ?? null;
    meshes.push(m);
    const part = m.userData.part;
    if (part) (byPart.get(part) ?? byPart.set(part, []).get(part)).push(m);
  }

  function build(gltf) {
    const root = gltf.scene.clone(true);
    root.traverse(o => {
      if (!o.isMesh) return;
      const ud = o.userData.part || o.userData.system ? o.userData : o.parent?.userData ?? {};
      if (ud.system === 'cutters') { o.visible = false; return; }
      o.material = o.material.clone();
      o.userData = { part: ud.part ?? null, system: ud.system ?? null };
      register(o);
    });
    scene.add(root);
    root.updateMatrixWorld(true);
    anchor = createAnchor({ meshesOf: id => byPart.get(id) ?? [], onFrame: invalidate, reducedMotion: reduced });
    for (const m of anchor?.chain ?? []) register(m);

    labels = new THREE.CSS2DRenderer();
    labels.domElement.className = 'b3-labels';
    buildUi();
    stage.prepend(canvas);
    msg.remove();
    added.push(canvas, labels.domElement);

    if (orbit && !coarse) makeControls();
    else canvas.style.touchAction = 'pan-y';
    wireCanvas();

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(entries => {
        onScreen = entries[entries.length - 1].isIntersecting;
        invalidate();
      });
      io.observe(stage);
      cleanups.push(() => io.disconnect());
    }
    listen(document, 'visibilitychange', () => { docVisible = document.visibilityState !== 'hidden'; invalidate(); });
    document.fonts?.ready.then(() => { sizes = new WeakMap(); invalidate(); });

    state = 'ready';
    stage.dataset.state = 'ready';
    resize();
    instant = true;
    show(sysOf(initial) ? initial : 'all');
    for (const call of queue.splice(0)) call();
    instant = false;
    resolveReady(true);
    invalidate();
  }

  function makeControls() {
    if (controls) { controls.connect(canvas); controls.enabled = true; return; }
    controls = new THREE.OrbitControls(camera, canvas);
    controls.target = target;
    controls.enableDamping = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 45;
    controls.enableZoom = opts.zoom !== false;
    let dragging = false, moved = false;
    controls.addEventListener('start', () => { flight = null; dragging = true; moved = false; });
    controls.addEventListener('change', () => { if (dragging) moved = true; invalidate(); });
    // someone orbited: the page can remember the view for Back (a plain click is not a view change)
    controls.addEventListener('end', () => { dragging = false; if (moved) opts.onChange?.(); });
    controls.update();
  }

  // a phone: the model starts as part of the page (a swipe scrolls it); "Explore in 3D" hands touches to the model
  function setExploring(on) {
    if (on) makeControls();
    else if (controls) {
      controls.enabled = false;
      controls.disconnect();
      canvas.style.touchAction = 'pan-y';
      canvas.style.cursor = '';
    }
    stage.classList.toggle('b3-exploring', on);
    explore.hidden = on;
    done.hidden = !on;
    (on ? done : explore).focus({ preventScroll: true });
    invalidate();
  }

  function buildUi() {
    seg = el('div', { class: 'b3-seg', role: 'group' });
    seg.hidden = true;
    partsList = el('ul');
    partsBox = el('div', { class: 'b3-parts', role: 'group', 'aria-label': 'Parts in this view' },
      el('p', { class: 'b3-parts-h', 'aria-hidden': 'true', text: 'Parts in this view' }), partsList);
    card = el('div', { class: 'b3-card', 'aria-live': 'polite', tabindex: '-1' });
    const ui = [seg];
    if (pickable) ui.push(partsBox);
    ui.push(labels.domElement, card);
    if (orbit && coarse) {
      explore = el('button', { type: 'button', class: 'b3-explore', onclick: () => setExploring(true) }, 'Explore in 3D');
      done = el('button', { type: 'button', class: 'b3-done', onclick: () => setExploring(false) }, 'Done');
      done.hidden = true;
      ui.push(explore, done);
    } else if (orbit && opts.hint !== false) {
      hint = el('span', { class: 'b3-hint', 'aria-hidden': 'true', text: opts.zoom === false ? 'drag \u00b7 tap a part' : 'drag \u00b7 zoom \u00b7 tap a part' });
      ui.push(hint);
    }
    stage.append(...ui);
    added.push(...ui);
    listen(stage, 'keydown', ev => {
      if (ev.key !== 'Escape') return;
      if (selected && card.childElementCount) { ev.stopPropagation(); closeCard(true); }
      else if (stage.classList.contains('b3-exploring')) setExploring(false);
    });
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h || !renderer) return;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    sizes = new WeakMap();
    invalidate();
  }

  // ---------- render on demand ----------
  const ease3 = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  function frame(now) {
    raf = 0;
    if (state !== 'ready') return;
    let more = false;
    if (flight) {
      const k = Math.min(Math.max((now - flight.t0) / FLIGHT_MS, 0), 1), e = ease3(k);
      camera.position.lerpVectors(flight.p0, flight.p1, e);
      target.lerpVectors(flight.a0, flight.a1, e);
      if (k === 1) flight = null; else more = true;
    }
    if (fade) {
      const k = Math.min(Math.max((now - fade.t0) / FADE_MS, 0), 1), e = k * (2 - k);
      fade.to.forEach((a, m) => { const a0 = fade.from.get(m) ?? a; setAlpha(m, k === 1 ? a : a0 + (a - a0) * e); });
      if (k === 1) fade = null; else more = true;
    }
    if (anchor?.step(now)) more = true;
    if (controls?.enabled) { if (controls.update()) more = true; } else camera.lookAt(target);
    if (hoverAt) hover();
    renderer.render(scene, camera);
    labels.render(scene, camera);
    if (tagLabels.length || pinLabels.length) declutter();
    if (more) invalidate();
  }

  // ---------- opacity ----------
  function setAlpha(m, a) {
    const mat = m.material, op = a * m.userData.base;
    m.userData.alpha = a;
    m.visible = a > 0.001;
    mat.opacity = op;
    mat.transparent = op < 1 || m.userData.baseT;
    mat.depthWrite = a >= 1;
    m.renderOrder = a < 1 ? 1 : 0;
  }
  function paint(to, smooth = true) {
    if (!smooth || instant || reduced()) { fade = null; to.forEach((a, m) => setAlpha(m, a)); }
    else fade = { t0: performance.now(), from: new Map(meshes.map(m => [m, m.userData.alpha])), to };
    invalidate();
  }

  // ---------- picking ----------
  const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const canPick = m => !!parts[m.userData.part] && !hidden.has(m.userData.part)
    && (current === 'all' || (rest.get(m) ?? 0) >= 1) && shown(m);
  const ray = new THREE.Raycaster();
  const ndc = new Vector2();
  function pickAt(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(meshes.filter(canPick), false)[0]?.object.userData.part ?? null;
  }
  function glow(part) {
    const on = part != null && (part === hovered || part === selected);
    for (const m of byPart.get(part) ?? []) {
      const e = m.material.emissive, o = m.userData.emissive;
      if (!e || !o) continue;
      e.copy(o);
      if (on) e.add(GLOW);
    }
  }
  function setHovered(part) {
    if (part === hovered) return;
    const old = hovered;
    hovered = part;
    glow(old);
    glow(part);
    if (canvas) canvas.style.cursor = part ? 'pointer' : '';
    invalidate();
  }
  // one raycast per frame at most, however fast the mouse moves
  function hover() {
    const at = hoverAt;
    hoverAt = null;
    setHovered(at.out ? null : pickAt(at.x, at.y));
  }
  function wireCanvas() {
    let down = null;
    listen(canvas, 'pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
    listen(canvas, 'pointercancel', () => { down = null; });
    listen(canvas, 'pointerup', ev => {
      const d = down;
      down = null;
      if (!pickable || !d || d.id !== ev.pointerId || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > PICK_SLOP) return;
      const part = pickAt(ev.clientX, ev.clientY);
      if (part) userPick(part);
      else if (selected && card.childElementCount) { closeCard(false); opts.onChange?.(); }
    });
    listen(canvas, 'pointermove', ev => {
      if (ev.pointerType !== 'mouse' || ev.buttons || !pickable) return;
      hoverAt = { x: ev.clientX, y: ev.clientY };
      invalidate();
    });
    listen(canvas, 'pointerleave', () => { hoverAt = { out: true }; invalidate(); });
  }

  // a person picked a part: on the model, its label, or the "Parts in this view" list
  function userPick(part, { keyboard = false } = {}) {
    if (part === SWITCH_PART && anchor) { anchor.toggle(); syncAnchor(); }
    if (opts.onPick?.(part)) return;
    const sys = byPart.get(part)?.[0]?.userData.system;
    if ((current === 'all' || current === 'xray') && sysById[sys] && focusable.has(sys)) {
      show(sys, { mode: usesCircuits(sys) ? defMode(sys) : modeFor(sys, part) });
    }
    if (keyboard) opener = part;
    select(part, { user: true, focusCard: keyboard });
  }

  // ---------- views ----------
  function show(id, o = {}) {
    if (state !== 'ready') { if (state === 'loading') queue.push(() => show(id, o)); return; }
    if (!sysOf(id)) return;
    current = id;
    mode = o.mode && modeIds(id).includes(o.mode) ? o.mode : defMode(id);
    const base = viewOf(id, mode);
    view = { ...base, also: [...(base.also ?? []), ...(o.also ?? [])] };
    // parts left out entirely, e.g. a project's "before" steps when the gear wasn't fitted yet
    hidden = new Set(o.hide ?? []);
    stage.classList.remove('b3-previewing');
    rest = new Map(meshes.map(m => [m, hidden.has(m.userData.part) ? 0 : alphaOf(m, id, view, mode)]));
    paint(rest, o.animate ?? true);
    setTags((o.tags ?? view.tags ?? []).filter(t => !hidden.has(t)));
    for (const b of chipButtons) b.setAttribute('aria-pressed', String(b.dataset.id === id));
    renderSeg(o.seg !== false);
    setHovered(null);
    closeCard(false);
    renderParts();
    if (o.fly === false) return;
    const animate = o.animate ?? true;
    if (camera.aspect < 1 && view.tall) { fly(vec(view.tall.cam), vec(view.tall.at), animate, false); return; }
    const lift = new Vector3(0, camera.aspect < 1 ? view.tall_lift ?? 0 : 0, 0);
    fly(vec(view.cam).add(lift), vec(view.at).add(lift), animate);
  }

  // spec: { system, mode?, cam, at, tall?: {cam, at}, also?, tags?, hide?: [partIds] } in Blender coords
  function focus(spec, o = {}) {
    if (state !== 'ready') { if (state === 'loading') queue.push(() => focus(spec, o)); return; }
    const sys = sysOf(spec.system) ? spec.system : current;
    show(sys, { mode: spec.mode, tags: spec.tags ?? [], also: spec.also, hide: spec.hide, fly: !spec.cam && !spec.part, animate: o.animate, seg: false });
    if (spec.part && byPart.has(spec.part)) select(spec.part, { card: false });
    if (spec.cam && spec.at) {
      const tall = camera.aspect < 1 && spec.tall?.cam && spec.tall?.at;
      fly(vec(tall ? spec.tall.cam : spec.cam), vec(tall ? spec.tall.at : spec.at), o.animate ?? true, !tall);
    } else if (spec.part) flyToPart(spec.part, o.animate ?? true);
  }

  // frame one part from the current preset's direction
  function flyToPart(part, animate = true) {
    const box = boxOf(part);
    if (!box) return;
    const at = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3()).length();
    const dir = vec(view.cam).sub(vec(view.at)).normalize();
    fly(at.clone().add(dir.multiplyScalar(Math.max(2.4, size * 3.2))), at, animate);
  }
  function focusPart(part, spec = {}) {
    if (state !== 'ready') { if (state === 'loading') queue.push(() => focusPart(part, spec)); return state === 'loading'; }
    if (!byPart.has(part)) return false;
    const own = byPart.get(part)[0].userData.system;
    const sys = sysOf(spec.system) ? spec.system : sysById[own] ? own : 'all';
    show(sys, { mode: spec.mode ?? modeFor(sys, part), fly: false, tags: spec.tags, also: spec.also, hide: spec.hide, seg: spec.seg, animate: spec.animate });
    select(part, { card: spec.card !== false });
    flyToPart(part, spec.animate ?? true);
    return true;
  }

  // hovering a project in a list: its gear stays solid, other gear steps back, the camera stays put
  function preview(spec) {
    if (state !== 'ready') return;
    stage.classList.toggle('b3-previewing', !!spec);
    if (!spec) return paint(rest);
    if (spec.system === 'all') return paint(new Map(meshes.map(m => [m, hidden.has(m.userData.part) ? 0 : 1])));
    const sys = sysOf(spec.system) ? spec.system : current;
    const md = spec.mode && modeIds(sys).includes(spec.mode) ? spec.mode : defMode(sys);
    const s = viewOf(sys, md);
    const v = { ...s, also: [...(s.also ?? []), ...(spec.also ?? []), ...(spec.tags ?? [])] };
    paint(new Map(meshes.map(m => {
      const { part, system } = m.userData;
      if (hidden.has(part)) return [m, 0];
      if (!focusable.has(system) && !v.also.includes(part)) return [m, rest.get(m) ?? 1];
      return [m, focused(m, v, md) ? 1 : PREVIEW_DIM];
    })));
  }

  function fly(pos, at, animate = true, pull = true) {
    // pull back on tall or narrow stages so the same subject still fits
    const k = pull ? Math.max(1, 1.6 / camera.aspect) ** 0.75 : 1;
    pos = at.clone().add(pos.clone().sub(at).multiplyScalar(k));
    if (!animate || instant || reduced()) {
      flight = null;
      camera.position.copy(pos);
      target.copy(at);
      controls?.update();
    } else flight = { t0: performance.now(), p0: camera.position.clone(), a0: target.clone(), p1: pos, a1: at.clone() };
    invalidate();
  }
  function setPose(cam, at) {
    if (state !== 'ready') { if (state === 'loading') queue.push(() => setPose(cam, at)); return; }
    flight = null;
    camera.position.copy(vec(cam));
    target.copy(vec(at));
    controls?.update();
    invalidate();
  }

  // ---------- labels and photo pins ----------
  function boxOf(part) {
    const list = byPart.get(part);
    if (!list) return null;
    const box = new Box3();
    for (const m of list) box.expandByObject(m);
    return box.isEmpty() ? null : box;
  }
  const topOf = part => { const b = boxOf(part); return b && b.getCenter(new Vector3()).setY(b.max.y); };

  function addLabel(button, pos, part, pin = false) {
    const lead = el('span', { class: 'b3-lead', 'aria-hidden': 'true' });
    const wrap = el('div', { class: 'b3-anchor' }, lead, button);
    const obj = new THREE.CSS2DObject(wrap);
    // labels on the anchor ride with it when it is lowered
    const parent = part && anchor?.moves(part) ? anchor.rig : scene;
    parent.updateWorldMatrix(true, false);
    obj.position.copy(parent.worldToLocal(pos.clone()));
    parent.add(obj);
    return { obj, el: button, lead, pin };
  }
  function setTags(list) {
    for (const t of tagLabels) t.obj.removeFromParent();
    tagLabels = [];
    for (const part of new Set(list)) {
      const at = topOf(part);
      if (!at) continue;
      const b = el('button', { type: 'button', class: 'b3-tag' + (parts[part]?.photo ? ' b3-has-photo' : ''), dataset: { part },
        onclick: ev => { ev.stopPropagation(); userPick(part); } }, titleOf(part));
      tagLabels.push(addLabel(b, at, part));
    }
    invalidate();
  }
  // pins: [{ id, part? | pos?: [x,y,z], img?, title?, polaroid?, step?, n?, soon? }]
  function setPins(list = []) {
    if (state !== 'ready') { if (state === 'loading') queue.push(() => setPins(list)); return; }
    for (const p of pinLabels) p.obj.removeFromParent();
    pinLabels = [];
    if (hoveredPin) { hoveredPin = null; opts.onPinHover?.(null); }
    for (const pin of list ?? []) {
      const at = pin.pos ? vec(pin.pos) : pin.part ? topOf(pin.part) : null;
      if (!at) continue;
      const title = text(pin.title) || (pin.part ? titleOf(pin.part) : '');
      const b = el('button', { type: 'button', class: 'b3-pin' + (pin.soon ? ' b3-soon' : '') + (pin.polaroid ? ' b3-polaroid' : '') + (pin.img ? '' : ' b3-noimg'),
        'aria-label': title || 'Photo', dataset: { pin: String(pin.id) } });
      if (pin.img) {
        const img = el('img', { src: pin.img, alt: '', decoding: 'async' });
        img.addEventListener('load', () => { sizes.delete(b); invalidate(); }, { once: true });
        b.append(img);
      } else if (text(pin.soon)) b.append(text(pin.soon));
      if (pin.n != null) b.append(el('span', { class: 'b3-pin-n', 'aria-hidden': 'true', text: String(pin.n) }));
      if (title) b.append(el('span', { class: 'b3-pin-t', 'aria-hidden': 'true', text: title }));
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        if (opts.onPin) opts.onPin(pin);
        else if (pin.part && byPart.has(pin.part)) select(pin.part, { user: true });
      });
      // a mouse over a pin lets the page preview that project in the model
      b.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') { hoveredPin = pin; opts.onPinHover?.(pin); } });
      b.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse' && hoveredPin === pin) { hoveredPin = null; opts.onPinHover?.(null); } });
      const label = addLabel(b, at, pin.part, true);
      label.id = String(pin.id);
      if (label.id === hotId) b.classList.add('b3-hot');
      pinLabels.push(label);
    }
    invalidate();
  }
  function hotPin(id) {
    if (state !== 'ready') { if (state === 'loading') queue.push(() => hotPin(id)); return; }
    hotId = id == null ? null : String(id);
    for (const p of pinLabels) p.el.classList.toggle('b3-hot', p.id === hotId);
    invalidate();
  }

  // keep pills and pins from overlapping: place bottom-most first, lift later ones above any they would hit
  const pv = new Vector3();
  function sizeOf(e) {
    let s = sizes.get(e);
    if (!s) { s = { w: e.offsetWidth, h: e.offsetHeight }; if (s.w) sizes.set(e, s); }
    return s;
  }
  function declutter() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const items = [];
    for (const t of [...tagLabels, ...pinLabels]) {
      pv.setFromMatrixPosition(t.obj.matrixWorld).project(camera);
      if (pv.z < -1 || pv.z > 1 || !shown(t.obj)) continue;
      const { w: bw, h: bh } = sizeOf(t.el);
      if (!bw) continue;
      items.push({ t, x: ((pv.x + 1) / 2) * w, y: ((1 - pv.y) / 2) * h, bw, bh });
    }
    items.sort((a, b) => b.y - a.y);
    const hits = (r, l, top, it) => l < r.r + 4 && l + it.bw > r.l - 4 && top < r.b + 3 && top + it.bh > r.t - 3;
    // every anchor dot counts as taken, so a pill never sits on another part's dot; so do the stage's own controls
    const placed = items.map(it => ({ l: it.x - 5, r: it.x + 5, t: it.y - 5, b: it.y + 5 }));
    for (const e of [seg, hint, explore, done]) {
      if (!e || e.hidden || !e.isConnected || (e === hint && !seg.hidden)) continue;
      let s = sizes.get(e);
      if (!s) { s = { l: e.offsetLeft, t: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight }; if (s.w) sizes.set(e, s); }
      if (s.w) placed.push({ l: s.l, r: s.l + s.w, t: s.t, b: s.t + s.h });
    }
    for (const it of items) {
      const l0 = Math.min(Math.max(it.x - it.bw / 2, 6), w - it.bw - 6);
      let lift = it.t.pin ? 22 : 16;
      for (let guard = 0; guard < 12; guard++) {
        const top = it.y - lift - it.bh;
        const hit = placed.find(r => hits(r, l0, top, it));
        if (!hit) break;
        lift = it.y - hit.t + 3;
      }
      let top = it.y - lift - it.bh, dy = -(lift + it.bh), leadTop = -lift, leadH = lift;
      let left = l0, leadL = 0, leadW = 1;
      const clear = (l, t) => !placed.some(r => hits(r, l, t, it));
      // no room above: hang it below the anchor instead of clipping it at the top edge
      if (top < 4) {
        let below = it.y + 14;
        for (let guard = 0; guard < 12; guard++) {
          const hit = placed.find(r => hits(r, l0, below, it));
          if (!hit) break;
          below = hit.b + 3;
        }
        if (below + it.bh < h - 4) { top = below; dy = below - it.y; leadTop = 0; leadH = dy; }
        else {
          // a short stage: fits neither above nor below, so sit beside the anchor, wholly inside the stage
          const fitT = t => Math.min(Math.max(t, 4), h - it.bh - 4);
          const sides = [it.x + 14, it.x - 14 - it.bw].map(l => Math.min(Math.max(l, 6), w - it.bw - 6));
          if (it.x > w / 2) sides.reverse();
          const spots = [it.y - it.bh / 2, it.y - it.bh + 12, it.y - 12].map(fitT).flatMap(t => sides.map(l => [l, t]));
          const [l, t] = spots.find(([sl, st]) => clear(sl, st)) ?? spots[0];
          left = l; top = t; dy = t - it.y; leadTop = 0; leadH = 1;
          leadL = left > it.x ? 0 : left + it.bw - it.x;
          leadW = Math.max(0, left > it.x ? left - it.x : it.x - left - it.bw);
        }
      }
      placed.push({ l: left, r: left + it.bw, t: top, b: top + it.bh });
      it.t.el.style.transform = `translate(${left - it.x}px, ${dy}px)`;
      Object.assign(it.t.lead.style, { top: `${leadTop}px`, height: `${leadH}px`, left: `${leadL}px`, width: `${leadW}px` });
    }
  }

  // ---------- mode buttons and the keyboard route to every part ----------
  let segFor = null;
  function renderSeg(visible) {
    const s = sysOf(current);
    const modes = s?.modes ?? [];
    seg.hidden = !visible || modes.length < 2;
    if (segFor !== current) {
      segFor = current;
      sizes.delete(seg);
      seg.setAttribute('aria-label', text(s?.modes_label) || 'Views');
      seg.replaceChildren(...modes.map(m => el('button', { type: 'button', dataset: { mode: m.id },
        onclick: () => { if (m.id !== mode) { show(current, { mode: m.id }); opts.onChange?.(); } } }, m.name)));
    }
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  }
  function renderParts() {
    if (!pickable) return;
    const ids = [...byPart.keys()].filter(part => parts[part] && !hidden.has(part)
      && (current === 'all' || byPart.get(part).some(m => (rest.get(m) ?? 0) >= 1)));
    ids.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
    partsList.replaceChildren(...ids.map(part => el('li', {}, el('button', { type: 'button', dataset: { part },
      onclick: () => userPick(part, { keyboard: true }) }, titleOf(part)))));
  }

  // ---------- the part card ----------
  function captionOf(project, name) {
    const hw = project?.hardware ?? {};
    const c = hw.compare ?? {};
    const hit = [...(c.steps ?? []), ...(hw.gallery ?? []), ...(hw.story?.steps ?? [])].find(s => s?.photo === name && text(s.caption));
    if (hit) return text(hit.caption);
    if (c.after === name) return text(c.after_label) || 'After';
    if (c.before === name) return text(c.before_label) || 'Before';
    return '';
  }
  const safeUrl = u => (typeof u !== 'string' ? null : /^https?:\/\//i.test(u) ? u : u.startsWith('/') ? siteUrl(u) : null);
  const anchorLabel = () => (anchor?.lowered ? 'Raise the anchor' : 'Lower the anchor');

  function renderCard(part) {
    const info = parts[part] ?? {};
    const sys = byPart.get(part)?.[0]?.userData.system;
    const kids = [el('button', { type: 'button', class: 'b3-x', 'aria-label': 'Close', onclick: () => { closeCard(true); opts.onChange?.(); } }, '\u00d7')];
    const sysName = text(sysById[sys]?.name);
    if (sysName) kids.push(el('small', { text: sysName }));
    kids.push(el('b', { text: titleOf(part) }));
    const body = text(info.body);
    if (body) kids.push(el('p', { class: 'b3-body', text: body }));
    const buy = safeUrl(info.url);
    if (buy) kids.push(el('a', { class: 'b3-buy', href: buy, target: '_blank', rel: 'noopener' }, 'Product page ',
      el('span', { 'aria-hidden': 'true', text: '\u2197' }), el('span', { class: 'b3-sr', text: '(opens in a new tab)' })));
    if (part === SWITCH_PART && anchor) {
      kids.push(el('button', { type: 'button', class: 'b3-act', dataset: { anchor: '' }, onclick: () => { anchor.toggle(); syncAnchor(); } }, anchorLabel()));
    }
    const key = text(info.photo);
    const project = projectById[info.project] ?? (key ? projectById[key.split('/')[0]] : null);
    if (key && data.photos?.[key]) {
      const ph = photo(data, key);
      const cap = [text(project?.title), captionOf(project, key.split('/').slice(1).join('/'))].filter(Boolean).join(' \u00b7 ');
      const img = el('img', { src: ph.small, alt: '', decoding: 'async' });
      if (ph.w && ph.h && ph.smallW) { img.width = ph.smallW; img.height = Math.round((ph.h * ph.smallW) / ph.w); }
      kids.push(el('figure', {}, img, cap ? el('figcaption', { text: cap }) : null));
    }
    const soon = text(project?.hardware?.soon);
    if (soon && text(project.title)) kids.push(el('span', { class: 'b3-soon-note', text: `${project.title}: ${soon}` }));
    if (project && project.id !== data.page && text(project.url)) {
      const a = el('a', { class: 'b3-open', href: siteUrl(project.url), 'aria-label': `Open the project: ${text(project.title) || project.id}` },
        'Open the project ', el('span', { 'aria-hidden': 'true', text: '\u2192' }));
      a.addEventListener('click', ev => { if (opts.onProject?.(project.id) === true) ev.preventDefault(); });
      kids.push(a);
    }
    card.replaceChildren(...kids);
    card.dataset.part = part;
    delete card.dataset.dock;
    dockCard();
  }
  // while the anchor is out, a narrow stage moves the switch card to the top so it doesn't hide the drop
  function dockCard() {
    if (card.dataset.part === SWITCH_PART && anchor && (anchor.lowered || anchor.moving)) card.dataset.dock = 'top';
  }
  // every way of working the windlass ends here, so the card and the page always say what the next press does
  function syncAnchor() {
    const b = card?.querySelector('[data-anchor]');
    if (b) b.textContent = anchorLabel();
    if (card) dockCard();
    opts.onAnchor?.(!!anchor?.lowered);
  }

  // select(part): highlight it and open its card. A programmatic select never works the windlass switch.
  function select(part, o = {}) {
    if (state !== 'ready') { if (state === 'loading') queue.push(() => select(part, o)); return; }
    if (part != null && !byPart.has(part)) part = null;
    const old = selected;
    selected = part;
    glow(old);
    glow(part);
    invalidate();
    if (!part || o.card === false) { clearCard(); return; }
    renderCard(part);
    if (o.focusCard) card.focus({ preventScroll: true });
    if (o.user) opts.onChange?.();
  }
  function clearCard() {
    const had = card.contains(document.activeElement);
    card.replaceChildren();
    delete card.dataset.part;
    delete card.dataset.dock;
    return had;
  }
  // close the card; if it held keyboard focus, hand focus back to where the person came from
  function closeCard(returnFocus) {
    const old = selected;
    selected = null;
    glow(old);
    invalidate();
    const had = clearCard();
    if (returnFocus && had) {
      const back = (opener && partsList.querySelector(`button[data-part="${CSS.escape(opener)}"]`)) || partsList.querySelector('button');
      back?.focus({ preventScroll: true });
    }
    opener = null;
  }

  // ---------- lifecycle ----------
  function teardown() {
    cancelAnimationFrame(raf);
    raf = 0;
    for (const off of cleanups.splice(0)) off();
    controls?.dispose();
    controls = null;
    anchor?.dispose();
    for (const m of meshes) m.material.dispose();
    meshes.length = 0;
    byPart.clear();
    envTex?.dispose();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
    renderer = null;
    for (const e of added.splice(0)) e.remove();
  }

  let lazyIo = null;
  if (opts.lazy !== false && typeof IntersectionObserver !== 'undefined') {
    lazyIo = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) start(); }, { rootMargin: '400px' });
    lazyIo.observe(stage);
  } else start();

  const anchorApi = {
    // false until the model is in, and on a model without the anchor
    get available() { return !!anchor; },
    get lowered() { return !!anchor?.lowered; },
    lower() { anchor?.lower(); syncAnchor(); },
    raise() { anchor?.raise(); syncAnchor(); },
    toggle() { anchor?.toggle(); syncAnchor(); },
  };

  return {
    ready,
    show: (id, o) => show(id, o),
    focus,
    focusPart,
    preview,
    hotPin,
    setPins,
    select: part => select(part ?? null),
    has: part => byPart.has(part),
    centerOf: part => { const b = state === 'ready' && boxOf(part); return b ? toB(b.getCenter(new Vector3())) : null; },
    setPose,
    // what Back needs to put the view back (Blender coords)
    getState() {
      if (state !== 'ready') return null;
      const end = flight ? { p: flight.p1, a: flight.a1 } : { p: camera.position, a: target };
      return { system: current, mode, cam: toB(end.p), at: toB(end.a), sel: card.childElementCount ? selected : null };
    },
    anchor: anchorApi,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lazyIo?.disconnect();
      queue.length = 0;
      teardown();
      for (const b of chipButtons) b.remove();
      if (chipsMarked) opts.chips.classList.remove('b3-chips');
      msg.remove();
      if (!before.cls) stage.classList.remove('b3');
      stage.classList.remove('b3-previewing', 'b3-exploring');
      if (!before.role) stage.removeAttribute('role');
      if (!before.label) stage.removeAttribute('aria-label');
      delete stage.dataset.state;
      state = 'destroyed';
      resolveReady(false);
    },
  };
}
