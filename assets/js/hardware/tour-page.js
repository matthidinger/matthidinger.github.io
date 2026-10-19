// The boat tour (/hardware/tour/): the model sticks beside the stops and flies to each project as it scrolls past.
// The start and the end show every project pinned (hovering one in the list previews it); a stop pins that project's
// photographed parts. Pins on the start and end jump to their stop.
import { photoUrl } from './data.js';
import { scrolly } from './scrolly.js';
import { focusProject, mountStage, overviewPins, partPins, previewer } from './stage.js';

const narrow = () => matchMedia('(max-width: 760px)').matches;

export async function init(root, data) {
  const sec = root.querySelector('.hw-tour');
  const sticky = sec?.querySelector('.mix-st-sticky');
  if (!sticky) return;
  const beats = [...sec.querySelector('.mix-st-chapters').children];
  const stopOf = beats.map(b => (data.projectById[b.dataset.project]?.hardware.model ? b.dataset.project : null));
  sticky.hidden = false;
  sec.classList.add('is-live');

  let eng = null;
  let preview = () => {};
  const viewer = await mountStage(sticky.querySelector('.vx-stage'), data, {
    hint: false, zoom: false, initial: 'xray', label: `3D model of ${data.boat.name}`,
    // on a phone the model is a backdrop, so a swipe scrolls the page; taps still pick
    ...(narrow() ? { controls: false, pickable: true } : {}),
    onPin: pin => {
      const i = stopOf.indexOf(pin.id);
      if (i > 0) eng?.jump(i, { focus: true }); else viewer.select(pin.part);
    },
    onPinHover: pin => preview(pin?.id ?? null),
  });
  if (!viewer) { unlive(); return; }
  // only the start and the end show every project, so only there does hovering one preview it
  preview = previewer(viewer, data, () => eng != null && !stopOf[eng.cur]);

  const index = sec.querySelector('.mix-ch-index');
  for (const a of index?.querySelectorAll('a[href^="#stop-"]') ?? []) {
    const id = a.hash.slice('#stop-'.length);
    a.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') preview(id); });
    a.addEventListener('focus', () => { if (a.matches(':focus-visible')) preview(id); });
  }
  index?.addEventListener('pointerleave', () => preview(null));
  index?.addEventListener('focusout', e => { if (!index.contains(e.relatedTarget)) preview(null); });

  function model(i, animate) {
    const id = stopOf[i];
    if (!id) {
      viewer.show('xray', { animate });
      viewer.setPins(overviewPins(data));
      return;
    }
    // a phone's model strip is short and the stop's photos sit right under it, so pins stay small there
    focusProject(viewer, data, id, { polaroid: !narrow(), animate });
  }
  eng = scrolly(sec, {
    label: 'Tour stops', noun: 'stop', topAtStart: true,
    onStop: (i, animate, isCur) => viewer.ready.then(ok => { if (ok && isCur()) model(i, animate); }),
    onNear: k => {
      const id = stopOf[k];
      if (!id) return;
      const pins = partPins(data, id);
      const cover = data.projectById[id].hardware.cover;
      for (const src of pins.length ? pins.map(p => p.img) : cover ? [photoUrl(`${id}/${cover}`, true)] : []) new Image().src = src;
    },
  });

  if (!(await viewer.ready)) unlive();

  // the model couldn't load: the tour reads top to bottom again
  function unlive() {
    sticky.hidden = true;
    sec.classList.remove('is-live');
  }
}
