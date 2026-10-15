// Long CamelCase title tokens on Dusk reading pages: the real assets/js/dusk-page.js and dusk-page.css on a synthetic
// title. A token that overflows its line must break only at its case humps (never mid-letter), a token that fits gets
// no break opportunities, and the decision is re-made when the title box resizes or a font finishes loading.
// The title width is derived in-page from the measured token, so the cases hold whichever fonts the runtime has.
// Each negative test breaks one behaviour of the real script and must be caught.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChromium } from '../lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel));
const SCRIPT = read('assets/js/dusk-page.js').toString('utf8');
const FONT = read('assets/fonts/source-serif-4-latin-wght-normal.woff2');
// "RealWorldWPDev" (14 characters, in seven post titles) slipped past the earlier 16-character threshold.
const TOKEN = 'RealWorldWPDev';
const HUMPS = [4, 9]; // Real|World|WPDev

const PAGE = `<!doctype html><html><head><title>Title fixture</title>
<link rel="stylesheet" href="/assets/css/dusk-page.css">
<style>
@font-face { font-family: Late; src: url(/late.woff2) format("woff2"); size-adjust: 200%; font-display: swap; }
@font-face { font-family: LateNow; src: url(/now.woff2) format("woff2"); size-adjust: 200%; }
.dkp.late { --disp: Late, sans-serif; }
</style></head>
<body class="dkp"><main><h1 class="dkp-title">${TOKEN} Part 3</h1></main>
<script>window.Dusk = {};</script>
<script>
window.__inspect = () => {
  const t = document.querySelector('.dkp-title');
  const span = [...t.querySelectorAll('span')].find((s) => s.textContent === '${TOKEN}');
  if (!span) return { error: 'token span missing' };
  const tops = [];
  const walk = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    for (let i = 0; i < n.data.length; i++) {
      const r = document.createRange();
      r.setStart(n, i); r.setEnd(n, i + 1);
      const b = r.getClientRects()[0];
      tops.push(b ? b.top : NaN);
    }
  }
  const breaks = [];
  for (let i = 1; i < tops.length; i++) if (tops[i] > tops[i - 1] + 2) breaks.push(i);
  return { wbr: span.querySelectorAll('wbr').length, breaks, overflow: t.scrollWidth - t.clientWidth, width: t.clientWidth };
};
(async () => {
  const mode = new URLSearchParams(location.search).get('w');
  const t = document.querySelector('.dkp-title');
  if (mode === 'font') document.body.classList.add('late');
  const m = (s, family) => {
    const p = document.createElement('span');
    p.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap';
    if (family) p.style.fontFamily = family;
    p.textContent = s;
    t.append(p);
    const w = p.getBoundingClientRect().width;
    p.remove();
    return w;
  };
  const parts = ['Real', 'World', 'WPDev'];
  const W = m('${TOKEN}'), P = Math.max(...parts.map((s) => m(s))), v = m('v');
  const info = { mode, W, P, narrow: W - v / 2, wide: W * 1.6 };
  let width = mode === 'overflow' ? info.narrow : info.wide;
  info.sane = mode === 'overflow' ? P < width && width < W : W < width;
  if (mode === 'font') {
    // Late is held by the server, so the title still lays out in its fallback; measure Late's metrics via LateNow.
    await document.fonts.load('62px LateNow');
    const WL = m('${TOKEN}', 'LateNow'), PL = Math.max(...parts.map((s) => m(s, 'LateNow'))), vL = m('v', 'LateNow');
    width = WL - vL / 2;
    Object.assign(info, { WL, PL, sane: W < width && PL < width && width < WL });
  }
  t.style.width = width + 'px';
  window.__w = info;
  const s = document.createElement('script');
  s.src = '/assets/js/dusk-page.js';
  s.onload = () => { window.__ready = true; };
  document.body.append(s);
})();
</script></body></html>`;

let chromiumPath;
try { chromiumPath = findChromium(); } catch { /* skipped below */ }
const opts = { skip: !chromiumPath && 'no Chromium available', timeout: 120000 };

async function serve(files, gate) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://fixture').pathname;
    if (p === '/late.woff2') await gate;
    const body = files[p === '/' ? '/index.html' : p];
    if (body === undefined) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); },
  };
}

async function withTitle(mode, fn, script = SCRIPT) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const server = await serve({
    '/index.html': PAGE,
    '/assets/css/dusk-page.css': read('assets/css/dusk-page.css'),
    '/assets/js/dusk-page.js': script,
    '/assets/fonts/source-serif-4-latin-wght-normal.woff2': FONT,
    '/assets/fonts/source-serif-4-latin-wght-italic.woff2': read('assets/fonts/source-serif-4-latin-wght-italic.woff2'),
    '/late.woff2': FONT,
    '/now.woff2': FONT,
  }, gate);
  const browser = await chromium.launch({ executablePath: chromiumPath });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${server.origin}/?w=${mode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready === true);
    const frames = (n) => page.evaluate((k) => new Promise((resolve) => {
      const step = (left) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
      step(k);
    }), n);
    const state = async ({ fonts = true } = {}) => {
      if (fonts) await page.evaluate(() => document.fonts.ready.then(() => 0));
      await frames(4);
      const s = await page.evaluate(() => window.__inspect());
      assert.equal(s.error, undefined, s.error);
      return { ...s, bad: s.breaks.filter((i) => !HUMPS.includes(i)) };
    };
    const info = await page.evaluate(() => window.__w);
    assert.ok(info.sane, `fixture widths do not set up the ${mode} case: ${JSON.stringify(info)}`);
    const setWidth = (key) => page.evaluate((k) => { document.querySelector('.dkp-title').style.width = `${window.__w[k]}px`; }, key);
    const lateLoaded = async () => {
      release();
      await page.waitForFunction(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Late' && f.status === 'loaded'));
    };
    await fn({ state, setWidth, lateLoaded, info });
    assert.deepEqual(errors, []);
  } finally {
    release();
    await browser.close();
    await server.close();
  }
}

// Clean breaks: the token wraps, only at its humps, and nothing overflows the title box.
function assertHumpBreaks(s) {
  assert.equal(s.wbr, HUMPS.length, `expected a break opportunity at each hump: ${JSON.stringify(s)}`);
  assert.ok(s.breaks.length > 0, `expected the token to wrap: ${JSON.stringify(s)}`);
  assert.deepEqual(s.bad, [], `token broke mid-letter: ${JSON.stringify(s)}`);
  assert.ok(s.overflow <= 0.5, `title overflows its box: ${JSON.stringify(s)}`);
}
function assertWhole(s) {
  assert.equal(s.wbr, 0, `a token that fits must get no break opportunities: ${JSON.stringify(s)}`);
  assert.deepEqual(s.breaks, [], `a token that fits must stay on one line: ${JSON.stringify(s)}`);
}
const defect = (s) => s.bad.length > 0 || s.overflow > 0.5;

function mutate(from, to, src = SCRIPT) {
  assert.ok(src.includes(from), `fixture anchor missing from dusk-page.js: ${from}`);
  return src.replace(from, to);
}
const DECIDE = 'const split = widths[i] > rooms[i] + 0.5;';
const OBSERVE = 'const ro = new ResizeObserver(later);';
const FONTS = 'document.fonts.ready.then(later)';

test('real script: an overflowing 14-character CamelCase token breaks only at its humps', opts, async () => {
  await withTitle('overflow', async ({ state }) => assertHumpBreaks(await state()));
});

test('real script: a token that fits gets no break opportunities', opts, async () => {
  await withTitle('fit', async ({ state }) => assertWhole(await state()));
});

test('real script: resizing the title box re-evaluates in both directions', opts, async () => {
  await withTitle('resize', async ({ state, setWidth }) => {
    assertWhole(await state());
    await setWidth('narrow');
    assertHumpBreaks(await state());
    await setWidth('wide');
    assertWhole(await state());
  });
});

test('real script: a font that loads late and widens the token re-evaluates after loading', opts, async () => {
  await withTitle('font', async ({ state, lateLoaded }) => {
    assertWhole(await state({ fonts: false }));
    await lateLoaded();
    assertHumpBreaks(await state());
  });
});

test('the old 16-character threshold breaks RealWorldWPDev mid-letter and is caught', opts, async () => {
  const script = mutate(DECIDE, 'const split = c.parts.join(\'\').length >= 16;');
  await withTitle('overflow', async ({ state }) => {
    const s = await state();
    assert.ok(defect(s), `expected a mid-letter break or overflow: ${JSON.stringify(s)}`);
  }, script);
});

test('always inserting break opportunities is caught by the fits case', opts, async () => {
  await withTitle('fit', async ({ state }) => {
    const s = await state();
    assert.equal(s.wbr, HUMPS.length, `expected the mutant to insert breaks: ${JSON.stringify(s)}`);
  }, mutate(DECIDE, 'const split = true;'));
});

test('no resize recheck is caught when the title box narrows', opts, async () => {
  await withTitle('resize', async ({ state, setWidth }) => {
    assertWhole(await state());
    await setWidth('narrow');
    const s = await state();
    assert.ok(defect(s), `expected a mid-letter break or overflow: ${JSON.stringify(s)}`);
  }, mutate(OBSERVE, 'const ro = { observe() {} };'));
});

test('no recheck after a late font load is caught', opts, async () => {
  const script = mutate(FONTS, 'Promise.resolve()', mutate(OBSERVE, 'const ro = { observe() {} };'));
  await withTitle('font', async ({ state, lateLoaded }) => {
    assertWhole(await state({ fonts: false }));
    await lateLoaded();
    const s = await state();
    assert.ok(defect(s), `expected a mid-letter break or overflow: ${JSON.stringify(s)}`);
  }, script);
});
