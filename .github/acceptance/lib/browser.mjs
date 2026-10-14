// Browser acceptance for a prefix-served build (local NAS server or the hosted preview): route/content
// assertions, loading failures, layout overflow, code/table scrollability, non-blank screenshots and the
// blog "Copy code" behaviour (exact clipboard text, keyboard focus/activation, live announcements,
// denied/unavailable clipboard and no-JavaScript readability).
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
  // Upper bounds count every match, visible or not (e.g. nav items folded into a hidden menu).
  for (const [sel] of Object.entries(spec.maxSelectors || {})) counts[sel] = document.querySelectorAll(sel).length;
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

// ---------- Copy code buttons ----------
export const COPY_BLOCKS = '.page__content div.highlighter-rouge, .page__content figure.highlight';
export const COPY_SUCCESS_RE = /\bcopied\b/i;
export const COPY_FAILURE_RE = /\b(fail(ed|ure)?|denied|unavailable|could ?n[o']t|unable)\b/i;
// Denial as the browser reports it: writeText rejects with NotAllowedError. (Chromium cannot be made to
// deny a user-activated write through permissions, so the rejection is injected at the API boundary.)
const DENY_CLIPBOARD = `(() => {
  const deny = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
  if (typeof Clipboard !== 'undefined') Object.defineProperty(Clipboard.prototype, 'writeText', { value: deny, configurable: true, writable: true });
})();`;
const NO_CLIPBOARD = `Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true });`;

// Runs in the page: where copy buttons are, and whether they are where they belong.
function surveyCopy(sel) {
  const codeOf = (b) => b.querySelector('td.rouge-code pre') || b.querySelector('pre code') || b.querySelector('pre');
  const blocks = [...document.querySelectorAll(sel)].filter((b, _, all) => !all.some((o) => o !== b && o.contains(b)));
  const nonEmpty = blocks.filter((b) => codeOf(b) && codeOf(b).textContent.trim() !== '');
  const buttons = [...document.querySelectorAll('.code-copy')];
  const problems = [];
  for (const b of blocks) {
    const own = [...b.children].filter((c) => c.matches('.code-copy'));
    if (!nonEmpty.includes(b) && own.length) problems.push('copy button on an empty code block');
    if (nonEmpty.includes(b) && own.length !== 1) problems.push(`nonempty code block has ${own.length} copy buttons`);
  }
  for (const btn of buttons) {
    if (btn.tagName !== 'BUTTON' || btn.type !== 'button') problems.push(`copy control is <${btn.tagName.toLowerCase()}>, not <button type="button">`);
    if (btn.closest('pre, code')) problems.push('copy button inside the code text');
    if (!nonEmpty.includes(btn.parentElement)) problems.push('copy button outside a nonempty code block (inline code, prose or empty block)');
    if (btn.textContent.trim() !== 'Copy code') problems.push(`button label is "${btn.textContent.trim()}"`);
    const r = btn.getBoundingClientRect();
    const pr = btn.parentElement.getBoundingClientRect();
    const st = getComputedStyle(btn);
    if (!(r.width > 0 && r.height > 0) || st.visibility === 'hidden' || st.display === 'none') problems.push('copy button not visible');
    else {
      if (r.left < pr.left - 1 || r.right > pr.right + 1) problems.push('copy button overflows its code block');
      if (r.width < 24 || r.height < 24) problems.push(`copy button target ${Math.round(r.width)}x${Math.round(r.height)}px is under 24px`);
    }
  }
  const unreadable = nonEmpty.filter((b) => {
    const pre = b.querySelector('pre');
    const r = pre ? pre.getBoundingClientRect() : { width: 0, height: 0 };
    return !pre || r.width === 0 || r.height === 0 || getComputedStyle(pre).userSelect === 'none' || getComputedStyle(codeOf(b)).userSelect === 'none';
  }).length;
  return { blocks: blocks.length, nonEmpty: nonEmpty.length, buttons: buttons.length, problems: [...new Set(problems)], unreadable };
}

const expectedCode = (btn) => btn.evaluate((b) => {
  const blk = b.parentElement;
  const c = blk.querySelector('td.rouge-code pre') || blk.querySelector('pre code') || blk.querySelector('pre');
  return c ? c.textContent : null;
});

// Starts recording live-region text changes made from now on, so a stale message from an earlier
// activation can never satisfy a later check.
const watchLive = (page) => page.evaluate(() => {
  const read = () => [...document.querySelectorAll('[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]')]
    .map((e) => e.textContent.trim()).filter(Boolean).join(' | ');
  window.__liveLog = [];
  window.__liveObserver?.disconnect();
  window.__liveObserver = new MutationObserver(() => { const t = read(); if (t) window.__liveLog.push(t); });
  window.__liveObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
});

async function waitLive(page, re, timeout = 3000) {
  return page.waitForFunction(({ src, flags }) => (window.__liveLog || []).some((t) => new RegExp(src, flags).test(t)),
    { src: re.source, flags: re.flags }, { timeout }).then(() => true, () => false);
}
const liveLog = (page) => page.evaluate(() => (window.__liveLog || []).join(' || '));

// Keyboard-focus a button (so :focus-visible applies as it would for a keyboard user) and report its focus ring.
async function keyboardFocus(page, btn) {
  await btn.focus().catch(() => {});
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  return btn.evaluate((b) => {
    const st = getComputedStyle(b);
    return { active: document.activeElement === b, focusVisible: b.matches(':focus-visible'), outline: st.outlineStyle, width: parseFloat(st.outlineWidth) || 0, color: st.outlineColor };
  });
}

export async function checkCopyCode({ newContext, url, spec, viewport }) {
  const out = [];
  const add = (name, ok, detail) => out.push({ name: `copy-code: ${name}`, ok: !!ok, detail });
  const min = spec.min ?? 1;
  const open = async (ctxOpts = {}, init) => {
    const ctx = await newContext(ctxOpts);
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).split('\n')[0]));
    await page.goto(url, { waitUntil: 'load' });
    return { ctx, page, errors };
  };

  // 1. Placement + real clipboard via keyboard (Enter, Space) and pointer on several snippets.
  {
    const { ctx, page, errors } = await open({ permissions: ['clipboard-read', 'clipboard-write'] });
    try {
      const s = await page.evaluate(surveyCopy, COPY_BLOCKS);
      add('buttons on every nonempty code block only', s.buttons === s.nonEmpty && s.nonEmpty >= min && !s.problems.length,
        `${s.buttons} buttons / ${s.nonEmpty} nonempty of ${s.blocks} code blocks (min ${min})${s.problems.length ? '; ' + s.problems.join('; ') : ''}`);
      const n = Math.min(s.buttons, s.nonEmpty);
      const plan = [];
      if (n >= 1) plan.push({ i: 0, how: 'Enter' });
      if (n >= 2) plan.push({ i: n - 1, how: 'Space' });
      if (n >= 3) plan.push({ i: Math.floor(n / 2), how: viewport.isMobile ? 'tap' : 'click' });
      if (!n) add('copy interactions', false, 'no copy buttons to exercise');
      for (const { i, how } of plan) {
        const step = `snippet ${i + 1} ${how}`;
        try {
          const btn = page.locator('.code-copy').nth(i);
          const expected = await expectedCode(btn);
          const sentinel = `sentinel-${Date.now()}-${i}`;
          await page.evaluate(() => window.focus());
          await page.evaluate((t) => navigator.clipboard.writeText(t), sentinel).catch(() => {});
          await btn.scrollIntoViewIfNeeded();
          if (how === 'Enter' || how === 'Space') {
            const f = await keyboardFocus(page, btn);
            add(`snippet ${i + 1} visible keyboard focus`, f.active && f.focusVisible && f.outline !== 'none' && f.width >= 2,
              f.active ? `focus-visible=${f.focusVisible} outline ${f.outline} ${f.width}px ${f.color}` : 'button did not receive keyboard focus');
            await watchLive(page);
            await page.keyboard.press(how);
          } else {
            await watchLive(page);
            if (how === 'tap') await btn.tap(); else await btn.click();
          }
          const announced = await waitLive(page, COPY_SUCCESS_RE);
          const live = await liveLog(page);
          const label = ((await btn.textContent()) || '').trim();
          let clip;
          try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = `<read failed: ${e.message.split('\n')[0]}>`; }
          const exact = expected !== null && clip === expected;
          add(`${step} copies exact code`, exact && !/copy code/i.test(clip),
            exact ? `${expected.length} chars, ${expected.split('\n').length} lines identical` : clip === sentinel ? 'clipboard unchanged' : `clipboard differs from the code (${JSON.stringify(String(clip).slice(0, 60))})`);
          add(`${step} announces success`, announced && !COPY_FAILURE_RE.test(live) && COPY_SUCCESS_RE.test(label),
            `live region "${live}", button "${label}"`);
        } catch (e) {
          add(`${step} copy`, false, `error: ${e.message.split('\n')[0]}`);
        }
      }
      if (errors.length) add('no script errors', false, errors.join('; '));
    } finally {
      await ctx.close();
    }
  }

  // 2/3. Denied and unavailable clipboard: honest failure, no success, code still readable and selected.
  for (const [mode, init] of [['denied clipboard', DENY_CLIPBOARD], ['unavailable clipboard', NO_CLIPBOARD]]) {
    const { ctx, page, errors } = await open({}, init);
    try {
      const btn = page.locator('.code-copy').first();
      if (!(await btn.count())) { add(`${mode} reports failure`, false, 'no copy button'); continue; }
      await btn.scrollIntoViewIfNeeded();
      await watchLive(page);
      await btn.click();
      const failed = await waitLive(page, COPY_FAILURE_RE);
      await page.waitForTimeout(300);
      const live = await liveLog(page);
      const label = ((await btn.textContent()) || '').trim();
      const st = await btn.evaluate((b) => {
        const blk = b.parentElement;
        const code = blk.querySelector('td.rouge-code pre') || blk.querySelector('pre code') || blk.querySelector('pre');
        if (!code) return { visible: false, selectable: false, selected: false };
        const sel = window.getSelection();
        const r = code.getBoundingClientRect();
        return { visible: r.width > 0 && r.height > 0, selectable: getComputedStyle(code).userSelect !== 'none',
          selected: !!(sel && sel.rangeCount && sel.getRangeAt(0).intersectsNode(code) && sel.toString().trim()) };
      });
      add(`${mode} reports failure, never success`, failed && !COPY_SUCCESS_RE.test(live) && !COPY_SUCCESS_RE.test(label) && COPY_FAILURE_RE.test(label),
        `live region "${live}", button "${label}"`);
      add(`${mode} leaves code readable and selectable`, st.visible && st.selectable, `visible=${st.visible} selectable=${st.selectable} selectedForManualCopy=${st.selected}`);
      if (errors.length) add(`${mode} no script errors`, false, errors.join('; '));
    } catch (e) {
      add(`${mode} reports failure, never success`, false, `error: ${e.message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }

  // 4. No JavaScript: code is readable, nothing inert is rendered.
  {
    const { ctx, page } = await open({ javaScriptEnabled: false });
    try {
      const s = await page.evaluate(surveyCopy, COPY_BLOCKS).catch(() => null);
      const nojs = await page.$$eval(COPY_BLOCKS, (bs) => bs.map((b) => {
        const pre = b.querySelector('pre');
        const r = pre ? pre.getBoundingClientRect() : { width: 0, height: 0 };
        return { ok: !!pre && r.width > 0 && r.height > 0 && pre.textContent.trim().length > 0 && ['auto', 'scroll'].includes(getComputedStyle(pre).overflowX) };
      }));
      const readable = nojs.filter((x) => x.ok).length;
      const buttons = await page.locator('.code-copy').count();
      add('no-JavaScript code readable without buttons', buttons === 0 && readable >= min && (!s || !s.unreadable),
        `${readable}/${nojs.length} code blocks readable and scrollable, ${buttons} copy buttons`);
    } catch (e) {
      add('no-JavaScript code readable without buttons', false, `error: ${e.message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }
  return out;
}

export async function checkRoute(browser, { origin, prefix, route, viewport, outDir, origins, strictOverflow, label }) {
  const failures = [];
  const warnings = [];
  const external = new Set();
  const prodRe = originRegex(origins);
  const routeRequests = (r) => {
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
  };
  const newContext = async (extra = {}) => {
    const c = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor || 1,
      isMobile: !!viewport.isMobile,
      hasTouch: !!viewport.isMobile,
      serviceWorkers: 'block',
      ...extra,
    });
    await c.route('**/*', routeRequests);
    return c;
  };
  const ctx = await newContext();
  try {
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

    const info = await page.evaluate(inspectPage, { selectors: route.selectors, maxSelectors: route.maxSelectors });
    const assertions = [];
    const assert = (name, ok, detail) => { assertions.push({ name, ok, detail }); if (!ok) failures.push(`${name}: ${detail}`); };
    if (route.title) assert('title', info.title.includes(route.title), `expected "${route.title}" in "${info.title}"`);
    if (route.h1) assert('h1', info.h1.some((h) => h === route.h1), `expected visible h1 "${route.h1}", got ${JSON.stringify(info.h1)}`);
    for (const t of route.text || []) assert(`text "${t}"`, info.text.includes(t), info.text.includes(t) ? 'present' : 'missing');
    for (const t of route.absentText || []) assert(`absent text "${t}"`, !info.text.includes(t), info.text.includes(t) ? 'present' : 'absent');
    for (const [sel, min] of Object.entries(route.selectors || {})) assert(`selector ${sel} >= ${min}`, info.counts[sel] >= min, `found ${info.counts[sel]}`);
    for (const [sel, max] of Object.entries(route.maxSelectors || {})) assert(`selector ${sel} <= ${max}`, info.counts[sel] <= max, `found ${info.counts[sel]}`);
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

    const interactions = [];
    for (const step of route.interactions || []) {
      if (step.viewports && !step.viewports.includes(viewport.name)) continue;
      const name = `interaction ${step.name || step.click}`;
      try {
        await page.goto(url, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const target = page.locator(step.click).locator('visible=true').first();
        if (step.expectPath) {
          const [nav] = await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), target.click()]);
          const got = new URL(page.url()).pathname;
          const ok = got === prefix + step.expectPath && nav && nav.status() === 200;
          interactions.push({ name, ok, detail: `navigated to ${got.replace(prefix, '') || '/'} (${nav ? nav.status() : 'no response'})` });
          assert(name, ok, `expected ${step.expectPath}, navigated to ${got.replace(prefix, '') || '/'} (${nav ? nav.status() : 'no response'})`);
        } else if (step.expectVisible) {
          await target.click();
          const ok = await page.locator(step.expectVisible).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
          interactions.push({ name, ok, detail: ok ? `${step.expectVisible} visible` : `${step.expectVisible} not visible` });
          assert(name, ok, ok ? 'visible' : `${step.expectVisible} not visible after click`);
        } else {
          throw new Error('interaction needs expectPath or expectVisible');
        }
      } catch (e) {
        interactions.push({ name, ok: false, detail: e.message.split('\n')[0] });
        failures.push(`${name}: ${e.message.split('\n')[0]}`);
      }
    }

    let copyCode = null;
    if (route.copyCode) {
      try {
        copyCode = await checkCopyCode({ newContext, url, spec: route.copyCode, viewport });
        for (const a of copyCode) assert(a.name, a.ok, a.detail);
      } catch (e) {
        failures.push(`copy-code check crashed: ${e.message.split('\n')[0]}`);
      }
    }

    return {
      route: route.id, path: route.path, purpose: route.purpose, viewport: viewport.name,
      status: resp ? resp.status() : null, h1: info.h1, counts: info.counts, assertions, interactions, copyCode,
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
