// The wiring page (/hardware/wiring/): the schematic beside the 3D model. Picking a symbol shows its part in 3D; picking a part
// in 3D lights its symbol. The circuit and the selected symbol live in the address (?c=ac&n=micro), so a link opens on the
// same part. Without JavaScript, or if the schematic can't load, each circuit stays listed as text.
import { restoreY } from './history.js';
import { mountStage } from './stage.js';

export async function init(root, data) {
  const sec = root.querySelector('.mix-wiring');
  const box = sec?.querySelector('.vx-schem');
  if (!box || !data.wiring) return;
  const tabsBox = sec.querySelector('.vx-tabs');
  const tabs = [...tabsBox.querySelectorAll('button[data-c]')];
  const stage = sec.querySelector('.vx-stage');
  const q = new URLSearchParams(location.search);
  const ids = tabs.map(b => b.dataset.c);
  let circuit = ids.includes(q.get('c')) ? q.get('c') : ids[0];
  let viewer = null;
  let selPart = null;
  let fromModel = false;
  const reland = restoreY();

  const sync = node => {
    const u = new URL(location.href);
    u.searchParams.set('c', circuit);
    if (node) u.searchParams.set('n', node); else u.searchParams.delete('n');
    if (u.href !== location.href) history.replaceState(history.state, '', u);
  };
  const setTabs = () => { for (const b of tabs) b.setAttribute('aria-pressed', String(b.dataset.c === circuit)); };
  const show3D = part => viewer?.focusPart(part, { system: 'electrical', mode: circuit, also: [part], tags: [part], seg: false });

  let schem;
  try {
    const { createSchematic } = await import('./schematic.js');
    const listing = box.querySelector('.hw-circuits');
    listing.hidden = true;
    schem = createSchematic(box, {
      wiring: data.wiring, parts: data.parts, circuit,
      has: part => !!viewer?.has(part),
      title: { name: data.boat.name, model: data.boat.model },
      onShow3D: show3D,
      onSelect: (node, c, part) => { selPart = part; sync(node); },
      onCircuit: c => {
        circuit = c;
        setTabs();
        sync(schem?.selected ?? null);
        // a part picked in 3D keeps its view; the schematic only changes sheet to light it
        if (!fromModel) viewer?.show('electrical', { mode: c, seg: false });
      },
    });
    listing.remove();
  } catch (err) {
    console.warn('Hardware: the wiring schematic could not load.', err);
    box.querySelector('.hw-circuits').hidden = false;
    return;
  }
  setTabs();
  tabsBox.hidden = false;
  for (const b of tabs) {
    b.addEventListener('click', () => {
      if (b.dataset.c === circuit) return;
      circuit = b.dataset.c;
      setTabs();
      schem.setCircuit(circuit);
      sync(schem.selected);
      viewer?.show('electrical', { mode: circuit, seg: false });
    });
  }
  const n = q.get('n');
  if (n && !schem.select(n)) sync(null);
  else sync(schem.selected);
  reland();

  viewer = await mountStage(stage, data, {
    initial: 'electrical', label: `3D model of ${data.boat.name}: electrical`,
    onPick: part => {
      fromModel = true;
      try { schem.highlight(part); } finally { fromModel = false; }
      return false;
    },
  });
  if (!viewer || !(await viewer.ready)) {
    stage.hidden = true;
    viewer = null;
    schem.refresh();
    return;
  }
  viewer.show('electrical', { mode: circuit, seg: false, animate: false });
  // "Show in 3D" appears now the model is in, and a deep-linked symbol gets its part shown
  schem.refresh();
  if (selPart && viewer.has(selPart)) show3D(selPart);
}
