// Entry point for every Hardware page (loaded by _layouts/hardware.html). The pages are complete as HTML; this adds what
// needs JavaScript: Back restoring where the page was left, the before/after sliders, and the page's own module
// (the 3D model, the scrolling stories, the schematic). Any failure leaves the plain page as it was.
import { readData } from './data.js';
import { startKeeping } from './history.js';
import { initSliders } from './widgets.js';

const MODULES = {
  index: () => import('./index-page.js'),
  project: () => import('./project-page.js'),
  tour: () => import('./tour-page.js'),
  wiring: () => import('./wiring-page.js'),
};

async function main() {
  const root = document.querySelector('.hw[data-hw-page]');
  if (!root) return;
  let data;
  try {
    data = readData();
  } catch (err) {
    console.warn('Hardware: the page data could not be read.', err);
  }
  if (!data) return;
  startKeeping();
  initSliders(root);
  root.dataset.hwReady = '';
  const load = MODULES[root.dataset.hwPage];
  if (!load) return;
  try {
    const { init } = await load();
    await init(root, data);
  } catch (err) {
    console.warn('Hardware: the page script failed.', err);
  }
}

main();
