// /hardware/: the boat in 3D. Chips pick a system; "Projects" (the x-ray) pins a photo for every boat project, and a pin
// opens its project. Back puts the same system, camera and open part card back.
import { siteUrl } from './data.js';
import { keep, kept, remember, restoreY, save } from './history.js';
import { mountStage, overviewPins, previewer } from './stage.js';

export async function init(root, data) {
  const block = root.querySelector('.vx-inset');
  const stage = block?.querySelector('.vx-stage');
  if (!stage) return;
  const row = block.querySelector('.mix-chiprow');
  const chips = [...row.querySelectorAll('.b3-chip')];
  const wiring = row.querySelector('.mix-chiplink');
  const reland = restoreY();
  let current = 'xray';
  let preview = () => {};

  const viewer = await mountStage(stage, data, {
    initial: 'xray',
    label: `3D model of ${data.boat.name}`,
    onPin: pin => {
      const p = data.projectById[pin.id];
      if (!p) { viewer.select(pin.part); return; }
      save();
      location.href = siteUrl(p.url);
    },
    onPinHover: pin => preview(pin?.id ?? null),
    onChange: keep,
  });
  if (!viewer) { fallback(); return; }
  preview = previewer(viewer, data, () => current === 'xray');
  row.hidden = false;

  function pick(id, o = {}) {
    current = id;
    for (const b of chips) b.setAttribute('aria-pressed', String(b.dataset.id === id));
    wiring.hidden = id !== 'electrical';
    viewer.show(id, { mode: o.mode, animate: o.animate });
    viewer.setPins(id === 'xray' ? overviewPins(data) : []);
  }
  for (const b of chips) b.addEventListener('click', () => { pick(b.dataset.id); keep(); });

  if (!(await viewer.ready)) { fallback(); return; }
  // Back: the same system, camera and open card as when the page was left
  const s = kept?.boat;
  if (s && chips.some(b => b.dataset.id === s.system)) {
    pick(s.system, { mode: s.mode, animate: false });
    if (s.cam && s.at) viewer.setPose(s.cam, s.at);
    if (s.sel && viewer.has(s.sel)) viewer.select(s.sel);
  } else pick(current, { animate: false });
  remember('boat', () => viewer.getState());
  reland();

  // the model couldn't load: the block is just its links again
  function fallback() {
    row.hidden = true;
    stage.hidden = true;
    for (const e of block.querySelectorAll('.vx-note, .hint')) e.hidden = true;
  }
}
