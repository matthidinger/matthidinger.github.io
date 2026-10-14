// Negative/positive browser acceptance on synthetic fixture sites built in a temp dir
// (never inside the generated production site).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findChromium, runChecks } from '../lib/browser.mjs';
import { stagePrefixedSite } from '../lib/rewrite.mjs';
import { startServer } from '../lib/server.mjs';

const SHA = 'b'.repeat(40);
const PREFIX = `/matthidinger.github.io/pr-9/${SHA}`;
const ORIGINS = ['https://matthidinger.com'];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const CSS = 'body{font:16px sans-serif;color:#222;margin:20px} .ink{height:300px;background:#333} pre{overflow-x:auto}';
const page = (body, head = '<link rel="stylesheet" href="/style.css">') =>
  `<!doctype html><html><head><title>Fixture Page</title>${head}</head><body>${body}</body></html>`;
const GOOD = '<h1>Fixture</h1><p>' + 'Real fixture text. '.repeat(10) + '</p><div class="ink"></div><img src="/a.png" width="20" height="20"><pre><code>' + 'x'.repeat(500) + '</code></pre>';

let chromiumPath;
try { chromiumPath = findChromium(); } catch { /* skipped below */ }

async function check(files, { route = {}, strictOverflow = false, mobile = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-fixture-'));
  const site = path.join(dir, 'site');
  const files2 = { 'style.css': CSS, 'a.png': PNG, ...files };
  for (const [rel, content] of Object.entries(files2)) {
    if (content === null) continue;
    fs.mkdirSync(path.dirname(path.join(site, rel)), { recursive: true });
    fs.writeFileSync(path.join(site, rel), content);
  }
  stagePrefixedSite(site, path.join(dir, 'preview', PREFIX), PREFIX, ORIGINS);
  const server = await startServer(path.join(dir, 'preview'));
  const config = {
    productionOrigins: ORIGINS,
    viewports: [mobile ? { name: 'mobile', width: 390, height: 844, isMobile: true } : { name: 'desktop', width: 1000, height: 700 }],
    routes: [{ id: 'r', path: '/', title: 'Fixture', h1: 'Fixture', selectors: { pre: 1 }, ...route }],
  };
  try {
    const [res] = await runChecks({ origin: server.origin, prefix: PREFIX, config, outDir: path.join(dir, 'evidence'), executablePath: chromiumPath, strictOverflow });
    return res;
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const has = (res, re) => res.failures.some((f) => re.test(f));
const opts = { skip: !chromiumPath && 'no Chromium available', timeout: 60000 };

test('good fixture passes with non-blank screenshot', opts, async () => {
  const res = await check({ 'index.html': page(GOOD) });
  assert.deepEqual(res.failures, []);
  assert.ok(res.screenshot.inkRatio > 0.005);
});

test('blank page fails', opts, async () => {
  const res = await check({ 'index.html': page('') }, { route: { selectors: {} } });
  assert.ok(has(res, /blank or unreadable/));
  assert.ok(has(res, /h1/));
});

test('failed (404) page fails', opts, async () => {
  const res = await check({ 'index.html': page(GOOD) }, { route: { path: '/missing/' } });
  assert.ok(has(res, /document status 404/));
});

test('missing asset fails', opts, async () => {
  const res = await check({ 'index.html': page(GOOD), 'style.css': null });
  assert.ok(has(res, /HTTP 404 .*style\.css/));
  assert.ok(has(res, /stylesheet/));
});

test('broken image fails', opts, async () => {
  const res = await check({ 'index.html': page(GOOD.replace('/a.png', '/nope.png')) });
  assert.ok(has(res, /images loaded/));
});

test('production asset requests fail instead of being captured', opts, async () => {
  const html = page(GOOD) .replace('</body>', '<script>var i=new Image();i.src="https://matthidinger.com/x.png";document.body.appendChild(i)</script></body>');
  const res = await check({ 'index.html': html });
  assert.ok(has(res, /production URL requested/));
});

test('requests escaping the revision prefix fail', opts, async () => {
  const html = page(GOOD).replace('</body>', '<script>var i=new Image();i.src="/" + "escaped.png";document.body.appendChild(i)</script></body>');
  const res = await check({ 'index.html': html });
  assert.ok(has(res, /escaped preview prefix/));
});

test('uncaught page errors fail unless listed as known pre-existing', opts, async () => {
  const html = page(GOOD).replace('</body>', '<script>missingThing.go()</script></body>');
  assert.ok(has(await check({ 'index.html': html }), /page error: missingThing is not defined/));
  const known = await check({ 'index.html': html }, { route: { knownPageErrors: [{ message: 'missingThing is not defined', reason: 'test' }] } });
  assert.deepEqual(known.failures, []);
  assert.ok(known.warnings.some((w) => /known pre-existing/.test(w)));
});

test('page-level overflow: warning by default, failure in strict (UX) mode', opts, async () => {
  const html = page(GOOD + '<div style="width:2000px;height:10px;background:#000"></div>');
  const lax = await check({ 'index.html': html });
  assert.ok(lax.warnings.some((w) => /horizontal overflow/.test(w)));
  assert.deepEqual(lax.failures, []);
  assert.ok(has(await check({ 'index.html': html }, { strictOverflow: true }), /horizontal overflow/));
});

test('wide code/table that cannot scroll fails', opts, async () => {
  const html = page('<h1>Fixture</h1><p>' + 'text '.repeat(40) + '</p><div class="ink"></div><pre style="overflow:visible;white-space:pre">' + 'y'.repeat(400) + '</pre>');
  const res = await check({ 'index.html': html }, { mobile: true });
  assert.ok(has(res, /code\/table blocks scrollable/));
});

test('absentText and maxSelectors fail when violated', opts, async () => {
  const html = page(GOOD + '<p>### Usage</p><ul class="hidden-links"><li>x</li></ul>');
  const res = await check({ 'index.html': html }, { route: { absentText: ['### Usage'], maxSelectors: { '.hidden-links li': 0 } } });
  assert.ok(has(res, /absent text "### Usage"/));
  assert.ok(has(res, /selector \.hidden-links li <= 0/));
  const ok = await check({ 'index.html': page(GOOD) }, { route: { absentText: ['### Usage'], maxSelectors: { '.hidden-links li': 0 } } });
  assert.deepEqual(ok.failures, []);
});

test('click interactions verify navigation target and revealed elements', opts, async () => {
  const html = page(GOOD + '<a id="next" href="next/">Next</a> <a id="wrong" href="/">Home</a>'
    + '<button id="t" onclick="document.getElementById(\'m\').style.display=\'block\'">menu</button><div id="m" style="display:none">menu</div>'
    + '<button id="dead">dead</button>');
  const files = { 'index.html': html, 'next/index.html': page(GOOD) };
  const good = await check(files, { route: { interactions: [
    { name: 'next', click: '#next', expectPath: '/next/' },
    { name: 'menu', click: '#t', expectVisible: '#m' },
    { name: 'mobile only', click: '#missing', expectPath: '/x/', viewports: ['mobile'] },
  ] } });
  assert.deepEqual(good.failures, []);
  assert.equal(good.interactions.length, 2);
  const bad = await check(files, { route: { interactions: [
    { name: 'wrong', click: '#wrong', expectPath: '/next/' },
    { name: 'dead', click: '#dead', expectVisible: '#m' },
  ] } });
  assert.ok(has(bad, /interaction wrong: expected \/next\//));
  assert.ok(has(bad, /interaction dead/));
});
