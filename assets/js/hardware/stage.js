// What the index, the tour and the project stories share about the 3D model: mounting it, and showing a project in it.
// A project's place in the model is its front matter's `hardware.model`:
//   { where, system, mode?, pin, pins?, also?, cam?, at?, tall?, tags? } (part IDs; cam/at in Blender metres).
import { photoUrl } from './data.js';

/**
 * Unhide `stage` and mount the model into it. Resolves to the viewer, or null if the viewer itself couldn't load;
 * the model can still fail after that, which viewer.ready reports (false). Pages fall back to their plain HTML either way.
 */
export async function mountStage(stage, data, opts) {
  stage.hidden = false;
  try {
    const { mountViewer } = await import('./viewer.js');
    return mountViewer(stage, data, opts);
  } catch (err) {
    console.warn('Hardware: the 3D viewer could not load.', err);
    stage.hidden = true;
    return null;
  }
}

/** The projects that live on the boat, in tour order (bow to stern). */
export const boatProjects = data => data.projects.filter(p => p.hardware?.model && p.tour).sort((a, b) => a.tour - b.tour);

/** One photo pin per boat project, numbered in tour order, for the overview. */
export function overviewPins(data) {
  return boatProjects(data).map((p, i) => {
    const h = p.hardware;
    return {
      id: p.id, part: h.model.pin, title: p.title, n: i + 1,
      img: h.cover ? photoUrl(`${p.id}/${h.cover}`, true) : null,
      soon: !h.cover && h.soon ? 'Soon' : null,
    };
  });
}

/** The modelled parts with a real photo from this project (limited to model.pins when it lists them). */
export function partPins(data, id, polaroid = false) {
  const only = data.projectById[id]?.hardware.model?.pins;
  return Object.entries(data.parts)
    .filter(([part, info]) => info.photo?.startsWith(`${id}/`) && (!only || only.includes(part)))
    .map(([part, info]) => ({ id: part, part, img: photoUrl(info.photo, true), title: info.title, polaroid }));
}

/** Fly the model to a project: its system and camera, with its photographed parts pinned (o.pins === false: none). */
export function focusProject(viewer, data, id, o = {}) {
  const p = data.projectById[id];
  const m = p.hardware.model;
  let pins = o.pins === false ? [] : partPins(data, id, o.polaroid);
  // a project with a cover but no photographed parts pins its cover where it lives
  if (!pins.length && o.pins !== false && p.hardware.cover) {
    pins = [{ id, part: m.pin, img: photoUrl(`${id}/${p.hardware.cover}`, true), title: p.title, polaroid: o.polaroid }];
  }
  const pinned = new Set(pins.map(pin => pin.part));
  viewer.focus({ system: m.system, mode: m.mode, cam: m.cam, at: m.at, tall: m.tall, also: m.also,
    tags: (m.tags ?? []).filter(t => !pinned.has(t)) }, { animate: o.animate });
  viewer.setPins(pins);
}

/**
 * Hovering a project (its pin, or its name in a list) previews it in the overview: its gear solid, the rest stepped back.
 * Returns preview(id | null); `live()` says whether the overview is showing, so a hover elsewhere does nothing.
 */
export function previewer(viewer, data, live) {
  return id => {
    const m = id ? data.projectById[id]?.hardware.model : null;
    if (id && !live()) return;
    viewer.preview(m ? { system: m.system, mode: m.mode, also: [m.pin, ...(m.pins ?? []), ...(m.also ?? [])], tags: m.tags } : null);
    viewer.hotPin(m ? id : null);
  };
}
