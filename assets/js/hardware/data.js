// Shared data access for the Hardware pages. Every page embeds its data as JSON in
// <script type="application/json" id="hw-data">:
//   { boat, parts, photos, wiring?, projects: [{ id, title, url, order, tour, hardware }], page? }
// where `hardware` is the project page's front matter block and `page` is the current project id.
// URLs inside that JSON are site-relative ("/hardware/windlass/"). Script text is not rewritten for
// previews served under a path prefix, so everything is resolved against the site root derived from
// this module's own URL (assets/js/hardware/data.js -> ../../../). Photos are the exception: they are
// served from the absolute base in the element's data-media attribute (_data/hardware/media.yml).

export const ROOT = new URL('../../../', import.meta.url);
const MEDIA = typeof document === 'undefined' ? undefined : document.getElementById('hw-data')?.dataset.media;

export const siteUrl = path => new URL(String(path).replace(/^\/+/, ''), ROOT).href;
export const photoUrl = (key, small = false) => new URL(`${key}${small ? '-sm' : ''}.jpg`, MEDIA).href;
export const modelUrl = () => siteUrl('assets/models/hardware/nonsuch30.glb');

export function readData(doc = document) {
  const el = doc.getElementById('hw-data');
  if (!el) return null;
  const d = JSON.parse(el.textContent);
  d.projects ??= [];
  d.projectById = Object.fromEntries(d.projects.map(p => [p.id, p]));
  d.systemById = Object.fromEntries((d.boat?.systems ?? []).map(s => [s.id, s]));
  return d;
}

// "windlass/final" -> { src, small, w, h } using photos.yml sizes [w, h, smallW].
export function photo(data, key) {
  const dims = data.photos?.[key];
  return { key, src: photoUrl(key), small: photoUrl(key, true), w: dims?.[0], h: dims?.[1], smallW: dims?.[2] };
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tiny DOM builder: el('p', { class: 'x', text: 'y' }, child, ...). Text only; never parses HTML.
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter(k => k != null && k !== false));
  return e;
}
