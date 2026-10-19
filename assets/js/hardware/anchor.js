// The windlass switch lowers and raises the anchor: it slides forward off the bow roller, tips over the
// roller and drops on its chain, then comes back up and ends exactly where it started.
// Everything is measured from the model's own bounding boxes (three.js world coords: +x forward, +y up),
// so a rebuilt model with the anchor or roller moved still lines up.
import { Box3, CylinderGeometry, Group, Mesh, Quaternion, Vector3 } from './lib/three.min.js';

export const SWITCH_PART = 'deck-switch';
const ANCHOR_PART = 'anchor';
const ROLLER_PART = 'bow-roller';
const CHAIN_PART = 'chain';

const DURATION = 4000;
const DROP = 1.0;
const CHAIN_R = 0.012;
const AXLE = new Vector3(0, 0, 1);
const UP = new Vector3(0, 1, 0);
const DEG = Math.PI / 180;

const ease = (a, b, t) => {
  const k = Math.min(Math.max((t - a) / (b - a), 0), 1);
  return k * k * (3 - 2 * k);
};
const boxOf = o => new Box3().setFromObject(o);

/**
 * meshesOf(partId) -> Mesh[] (materials already cloned per mesh by the viewer)
 * onFrame()        -> ask the viewer for a frame (render on demand)
 * reducedMotion()  -> true to jump straight to the end of a move
 * Returns null when the model has no anchor.
 */
export function createAnchor({ meshesOf, onFrame = () => {}, reducedMotion = () => false }) {
  const parts = meshesOf(ANCHOR_PART);
  if (!parts.length) return null;
  const parent = parts[0].parent;
  parent.updateWorldMatrix(true, true);

  const boxes = parts.map(boxOf);
  // the swivel is the aft-most piece of the anchor: the chain is shackled to it
  const swivel = boxes.reduce((a, b) => (b.min.x < a.min.x ? b : a)).getCenter(new Vector3());
  // a rough centre of mass: each piece's box centre weighted by its volume (the fluke dominates)
  const mass = new Vector3();
  let total = 0;
  for (const b of boxes) {
    const s = b.getSize(new Vector3()), v = Math.max(s.x * s.y * s.z, 1e-9);
    mass.addScaledVector(b.getCenter(new Vector3()), v);
    total += v;
  }
  mass.divideScalar(total);

  // the roller wheel is the bow-roller piece whose side view is closest to round
  const roller = meshesOf(ROLLER_PART).map(boxOf).map(b => ({ b, s: b.getSize(new Vector3()) }))
    .filter(r => r.s.x > 0 && r.s.y > 0)
    .sort((p, q) => Math.abs(p.s.x - p.s.y) / Math.max(p.s.x, p.s.y) - Math.abs(q.s.x - q.s.y) / Math.max(q.s.x, q.s.y))[0];
  const pivot = roller ? roller.b.getCenter(new Vector3()).setZ(swivel.z) : new Vector3(swivel.x + 0.3, swivel.y - 0.05, swivel.z);
  const wrap = (roller ? roller.s.y / 2 : 0.03) + CHAIN_R;
  const rise = Math.max(swivel.y - pivot.y, wrap);
  const slide = Math.max(0, pivot.x - swivel.x);
  // tip until the centre of mass hangs straight under the swivel
  const lean = Math.atan2(mass.y - swivel.y, mass.x - swivel.x);
  const tip = Math.min(Math.max(-Math.PI / 2 - lean, -95 * DEG), -35 * DEG);
  // once it hangs, the swivel sits just off the front of the roller so the chain drops plumb
  const settle = wrap - rise * Math.sin(-tip);

  const rig = new Group();
  rig.name = 'Anchor rig';
  parent.add(rig);
  rig.updateWorldMatrix(true, false);
  for (const m of parts) rig.attach(m);

  // the chain paid out: up to three straight runs (deck to roller top, over the roller, down to the swivel)
  const chainMat = (meshesOf(CHAIN_PART)[0] ?? parts[0]).material.clone();
  const geo = new CylinderGeometry(CHAIN_R, CHAIN_R, 1, 8, 1);
  const runs = [0, 1, 2].map(() => {
    const holder = new Group();
    const mesh = new Mesh(geo, chainMat.clone());
    mesh.userData = { part: CHAIN_PART, system: (meshesOf(CHAIN_PART)[0] ?? parts[0]).userData.system };
    holder.add(mesh);
    holder.visible = false;
    parent.add(holder);
    return { holder, mesh };
  });
  chainMat.dispose();

  const q = new Quaternion();
  const tmp = new Vector3();
  const top = pivot.clone().add(new Vector3(0, wrap, 0));
  const front = pivot.clone().add(new Vector3(wrap, 0, 0));
  const swivelNow = new Vector3();

  function lay(run, a, b) {
    const len = a.distanceTo(b);
    run.holder.visible = len > 1e-4;
    if (!run.holder.visible) return;
    run.mesh.position.addVectors(a, b).multiplyScalar(0.5);
    run.mesh.quaternion.setFromUnitVectors(UP, tmp.subVectors(b, a).normalize());
    run.mesh.scale.set(1, len, 1);
  }

  let t = 0;
  function pose(k) {
    t = k;
    if (k <= 0) {
      rig.position.set(0, 0, 0);
      rig.quaternion.identity();
      for (const r of runs) r.holder.visible = false;
      return;
    }
    const e1 = ease(0, 0.28, k), e2 = ease(0.22, 0.5, k), e3 = ease(0.45, 1, k);
    q.setFromAxisAngle(AXLE, tip * e2);
    // p' = R + q (p + slide - R) + drop
    rig.quaternion.copy(q);
    rig.position.set(slide * e1, 0, 0).sub(pivot).applyQuaternion(q).add(pivot).add(tmp.set(settle * e3, -DROP * e3, 0));
    swivelNow.copy(swivel).applyQuaternion(q).add(rig.position);
    if (swivelNow.x < top.x - 1e-3 && e2 === 0) {
      lay(runs[0], swivel, swivelNow);
      runs[1].holder.visible = runs[2].holder.visible = false;
    } else {
      lay(runs[0], swivel, top);
      if (swivelNow.y < front.y) { lay(runs[1], top, front); lay(runs[2], front, swivelNow); }
      else { lay(runs[1], top, swivelNow); runs[2].holder.visible = false; }
    }
  }

  let goal = 0, anim = null;
  function go(to) {
    goal = to;
    if (reducedMotion()) { anim = null; pose(to); onFrame(); return; }
    if (t === to) { anim = null; return; }
    anim = { from: t, to, t0: performance.now(), dur: Math.abs(to - t) * DURATION };
    onFrame();
  }
  // advance the move; true while it is still going (and on the frame it lands)
  function step(now) {
    if (!anim) return false;
    const k = Math.min(Math.max((now - anim.t0) / anim.dur, 0), 1);
    pose(anim.from + (anim.to - anim.from) * k);
    if (k >= 1) anim = null;
    return true;
  }

  const toB = v => [v.x, -v.z, v.y].map(n => Math.round(n * 1000) / 1000);
  return {
    rig,
    chain: runs.map(r => r.mesh),
    moves: part => part === ANCHOR_PART,
    get lowered() { return goal === 1; },
    get moving() { return !!anim; },
    lower: () => go(1),
    raise: () => go(0),
    toggle: () => go(goal === 1 ? 0 : 1),
    step,
    // geometry used, in Blender coords, for debugging and docs
    info: { swivel: toB(swivel), pivot: toB(pivot), tipDeg: Math.round(-tip / DEG), drop: DROP, slide: Math.round(slide * 1000) / 1000 },
    dispose() {
      anim = null;
      geo.dispose();
      for (const r of runs) { r.mesh.material.dispose(); r.holder.removeFromParent(); }
    },
  };
}
