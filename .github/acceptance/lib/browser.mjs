// Browser acceptance for a prefix-served build: route/content assertions, loading failures,
// layout overflow, code/table scrollability and non-blank screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { sha256 } from './util.mjs';
import { originRegex } from './rewrite.mjs';

const CHROMIUM_CANDIDATES = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
export const MAX_SHOT_HEIGHT = 5000;
export const MIN_INK_RATIO = 0.005;

export function findChromium(explicit) {
  const list = [explicit, process.env.CHROMIUM_PATH, ...CHROMIUM_CANDIDATES].filter(Boolean);
  const found = list.find((p) => fs.existsSync(p));
  if (!found) throw new Error('No Chromium found; pass --chromium PATH or set CHROMIUM_PATH');
  return found;
}

export async function inkRatio(browser, png) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const w = Math.min(bmp.width, 400);
      const h = Math.max(1, Math.round((bmp.height * w) / bmp.width));
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 4) if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 200) ink++;
      return ink / (w * h);
    }, png.toString('base64'));
  } finally {
    await page.close();
  }
}

// Runs in the page. Kept dependency-free so it can be serialized by Playwright.
function inspectPage(spec) {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const scrolls = (el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX);
  const inScroller = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) if (scrolls(n) && n.scrollWidth > n.clientWidth) return true;
    return false;
  };
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const h1 = [...document.querySelectorAll('h1')].filter(visible).map((e) => e.innerText.trim());
  const text = document.body ? document.body.innerText : '';
  const counts = {};
  for (const [sel] of Object.entries(spec.selectors || {})) counts[sel] = [...document.querySelectorAll(sel)].filter(visible).length;
  const sheets = [...document.styleSheets].filter((s) => {
    try { return s.href && new URL(s.href).origin === location.origin && s.cssRules.length > 0; } catch { return false; }
  }).length;
  const brokenImages = [...document.images]
    .filter((i) => i.currentSrc && new URL(i.currentSrc).origin === location.origin)
    .filter((i) => !i.complete || i.naturalWidth === 0)
    .map((i) => new URL(i.currentSrc).pathname);
  const overflowPx = Math.max(0, doc.scrollWidth - vw);
  const offenders = overflowPx > 1
    ? [...document.body.querySelectorAll('*')]
      .filter((e) => visible(e) && !inScroller(e) && (e.getBoundingClientRect().right > vw + 1
        || (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.getBoundingClientRect().right + (e.scrollWidth - e.clientWidth) > vw + 1)))
      .filter((e, _, all) => !all.some((o) => o !== e && e.contains(o)))
      .slice(0, 5).map(describe)
    : [];
  const blocks = [...document.querySelectorAll('pre, table')].filter(visible);
  const wide = blocks.filter((b) => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().width > vw + 1);
  const unscrollable = wide.filter((b) => !inScroller(b) && !scrolls(b)).map(describe);
  return { title: document.title, h1, textLength: text.trim().length, text, counts, sheets, brokenImages,
    overflowPx, offenders, blocks: blocks.length, wideBlocks: wide.length, unscrollable,
    scrollHeight: doc.scrollHeight };
}

export async function checkRoute(browser, { origin, prefix, route, viewport, outDir, origins, strictOverflow, label }) {
  const failures = [];
  const warnings = [];
  const external = new Set();
  const prodRe = originRegex(origins);
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    isMobile: !!viewport.isMobile,
    hasTouch: !!viewport.isMobile,
    serviceWorkers: 'block',
  });
  try {
    await ctx.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith(origin + '/')) {
        const p = new URL(u).pathname;
        if (p === prefix || p.startsWith(prefix + '/')) return r.continue();
        failures.push(`request escaped preview prefix: ${p}`);
        return r.fulfill({ status: 404, body: '' });
      }
      if (prodRe.test(u)) {
        failures.push(`production URL requested instead of branch asset: ${u}`);
        return r.abort();
      }
      try { external.add(new URL(u).host); } catch { /* data: etc */ }
      return r.abort();
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', (e) => {
      const msg = String(e.message).split('\n')[0];
      const known = (route.knownPageErrors || []).find((k) => k.message === msg);
      if (known) warnings.push(`known pre-existing page error "${msg}" (${known.reason})`);
      else failures.push(`page error: ${msg}`);
    });
    page.on('response', (res) => {
      if (res.url().startsWith(origin + '/') && res.status() >= 400) failures.push(`HTTP ${res.status()} ${new URL(res.url()).pathname}`);
    });
    page.on('requestfailed', (req) => {
      if (req.url().startsWith(origin + '/')) failures.push(`request failed ${new URL(req.url()).pathname}: ${req.failure()?.errorText}`);
    });

    const url = origin + prefix + route.path;
    const resp = await page.goto(url, { waitUntil: 'load' });
    if (!resp || resp.status() !== 200) failures.push(`document status ${resp ? resp.status() : 'none'} for ${route.path}`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => warnings.push('network did not go idle within 15s'));
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));

    const info = await page.evaluate(inspectPage, { selectors: route.selectors });
    const assertions = [];
    const assert = (name, ok, detail) => { assertions.push({ name, ok, detail }); if (!ok) failures.push(`${name}: ${detail}`); };
    if (route.title) assert('title', info.title.includes(route.title), `expected "${route.title}" in "${info.title}"`);
    if (route.h1) assert('h1', info.h1.some((h) => h === route.h1), `expected visible h1 "${route.h1}", got ${JSON.stringify(info.h1)}`);
    for (const t of route.text || []) assert(`text "${t}"`, info.text.includes(t), info.text.includes(t) ? 'present' : 'missing');
    for (const [sel, min] of Object.entries(route.selectors || {})) assert(`selector ${sel} >= ${min}`, info.counts[sel] >= min, `found ${info.counts[sel]}`);
    assert('visible text', info.textLength >= (route.minText || 100), `${info.textLength} chars`);
    assert('site stylesheet loaded', info.sheets > 0, `${info.sheets} same-origin stylesheets with rules`);
    assert('images loaded', info.brokenImages.length === 0, info.brokenImages.length ? info.brokenImages.slice(0, 5).join(', ') : 'all same-origin images decoded');
    assert('code/table blocks scrollable', info.unscrollable.length === 0, info.unscrollable.length ? info.unscrollable.join(', ') : `${info.wideBlocks}/${info.blocks} wide blocks scroll`);
    if (info.overflowPx > 1) {
      const msg = `page-level horizontal overflow ${info.overflowPx}px (${info.offenders.join(', ') || 'unknown element'})`;
      if (strictOverflow) failures.push(msg); else warnings.push(msg);
    }

    const height = Math.min(info.scrollHeight, MAX_SHOT_HEIGHT);
    const png = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: viewport.width, height }, animations: 'disabled' });
    const ink = await inkRatio(browser, png);
    if (ink < MIN_INK_RATIO) failures.push(`screenshot is blank or unreadable (ink ratio ${ink.toFixed(4)})`);
    const file = `${label ? label + '-' : ''}${route.id}-${viewport.name}.png`;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, file), png);

    return {
      route: route.id, path: route.path, purpose: route.purpose, viewport: viewport.name,
      status: resp ? resp.status() : null, h1: info.h1, counts: info.counts, assertions,
      overflowPx: info.overflowPx, wideBlocks: info.wideBlocks, blocks: info.blocks,
      externalBlocked: [...external].sort(),
      screenshot: { file, sha256: sha256(png), width: viewport.width, height, truncated: info.scrollHeight > MAX_SHOT_HEIGHT, inkRatio: Number(ink.toFixed(4)) },
      failures: [...new Set(failures)], warnings, passed: failures.length === 0,
    };
  } finally {
    await ctx.close();
  }
}

export async function runChecks({ origin, prefix, config, outDir, executablePath, strictOverflow = false, label = '' }) {
  const browser = await chromium.launch({ executablePath: findChromium(executablePath)});
  const results = [];
  try {
    for (const route of config.routes) {
      for (const viewport of config.viewports) {
        try {
          results.push(await checkRoute(browser, { origin, prefix, route, viewport, outDir, origins: config.productionOrigins, strictOverflow, label }));
        } catch (e) {
          results.push({ route: route.id, path: route.path, viewport: viewport.name, failures: [`check crashed: ${e.message.split('\n')[0]}`], passed: false });
        }
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}
