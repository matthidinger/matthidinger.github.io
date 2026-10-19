// Negative/positive browser acceptance on synthetic fixture sites built in a temp dir
// (never inside the generated production site).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkMediaPrefixes, findChromium, runChecks } from '../lib/browser.mjs';
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

// media: files served from the server root, outside the revision prefix (like the photo host);
// mediaPath: a folder on the test server listed in config.mediaPrefixes.
async function check(files, { route = {}, strictOverflow = false, mobile = false, media = {}, mediaPath } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-fixture-'));
  const site = path.join(dir, 'site');
  const files2 = { 'style.css': CSS, 'a.png': PNG, ...files };
  for (const [rel, content] of Object.entries(files2)) {
    if (content === null) continue;
    fs.mkdirSync(path.dirname(path.join(site, rel)), { recursive: true });
    fs.writeFileSync(path.join(site, rel), content);
  }
  stagePrefixedSite(site, path.join(dir, 'preview', PREFIX), PREFIX, ORIGINS);
  for (const [rel, content] of Object.entries(media)) {
    fs.mkdirSync(path.dirname(path.join(dir, 'preview', rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, 'preview', rel), content);
  }
  const server = await startServer(path.join(dir, 'preview'));
  const config = {
    productionOrigins: ORIGINS,
    ...(mediaPath ? { mediaPrefixes: [server.origin + mediaPath] } : {}),
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

test('lazy images are checked after a reader scroll; unrendered ones are skipped', opts, async () => {
  const lazy = (src, style = '') => `<div style="height:3000px"></div><div style="${style}"><img loading="lazy" src="${src}" srcset="${src} 20w" sizes="20px" width="20" height="20"></div>`;
  const ok = await check({ 'index.html': page(GOOD + lazy('/a.png') + lazy('/hidden.png', 'display:none')) });
  assert.deepEqual(ok.failures, []);
  const broken = await check({ 'index.html': page(GOOD + lazy('/nope.png')) });
  assert.ok(has(broken, /HTTP 404 .*nope\.png/));
  assert.ok(has(broken, /images loaded: .*nope\.png/));
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

test('listed media prefixes load outside the revision prefix and must decode', opts, async () => {
  const html = (name) => page(GOOD).replace('</body>', `<script>var i=new Image();i.src=location.origin + "/media/hw/${name}";document.body.appendChild(i)</script></body>`);
  const media = { 'media/hw/p.png': PNG, 'media/hw/bad.png': 'not a png', 'other/p.png': PNG };
  const ok = await check({ 'index.html': html('p.png') }, { media, mediaPath: '/media/hw/' });
  assert.deepEqual(ok.failures, []);
  assert.ok(ok.assertions.some((a) => a.name === 'images loaded' && /media images decoded/.test(a.detail)));
  const missing = await check({ 'index.html': html('nope.png') }, { media, mediaPath: '/media/hw/' });
  assert.ok(has(missing, /HTTP 404 http:\/\/127\.0\.0\.1:\d+\/media\/hw\/nope\.png/));
  assert.ok(has(missing, /images loaded: \/media\/hw\/nope\.png/));
  assert.ok(has(await check({ 'index.html': html('bad.png') }, { media, mediaPath: '/media/hw/' }), /images loaded: \/media\/hw\/bad\.png/));
  // Unlisted, the same folder is still an escape, and a listed folder does not cover its neighbours.
  assert.ok(has(await check({ 'index.html': html('p.png') }, { media }), /escaped preview prefix: \/media\/hw\/p\.png/));
  const other = page(GOOD).replace('</body>', '<script>var i=new Image();i.src=location.origin + "/other/p.png";document.body.appendChild(i)</script></body>');
  assert.ok(has(await check({ 'index.html': other }, { media, mediaPath: '/media/hw/' }), /escaped preview prefix: \/other\/p\.png/));
});

test('media prefixes must be folders outside the site root and revision prefix', () => {
  const origin = 'https://previews.example';
  const prefix = '/repo/pr-9/' + SHA;
  assert.deepEqual(checkMediaPrefixes(['https://previews.example/media/hw/'], origin, prefix), ['https://previews.example/media/hw/']);
  for (const bad of ['https://previews.example/', 'https://previews.example/media/hw', 'https://previews.example/repo/',
    `https://previews.example${prefix}/media/`, 'ftp://previews.example/media/', 'https://previews.example/media/?x=1', '/media/hw/', 'https://PREVIEWS.example/media/']) {
    assert.throws(() => checkMediaPrefixes([bad], origin, prefix), /invalid mediaPrefixes entry/, bad);
  }
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
    + ' <a id="saving" href="next/" onclick="history.replaceState({s:1}, \'\'); history.replaceState(history.state, \'\', \'#saved\')">Saving</a>'
    + '<button id="t" onclick="document.getElementById(\'m\').style.display=\'block\'">menu</button><div id="m" style="display:none">menu</div>'
    + '<button id="dead">dead</button>');
  const files = { 'index.html': html, 'next/index.html': page(GOOD) };
  const good = await check(files, { route: { interactions: [
    { name: 'next', click: '#next', expectPath: '/next/' },
    { name: 'history state saved on click', click: '#saving', expectPath: '/next/' },
    { name: 'menu', click: '#t', expectVisible: '#m' },
    { name: 'mobile only', click: '#missing', expectPath: '/x/', viewports: ['mobile'] },
  ] } });
  assert.deepEqual(good.failures, []);
  assert.equal(good.interactions.length, 3);
  const bad = await check(files, { route: { interactions: [
    { name: 'wrong', click: '#wrong', expectPath: '/next/' },
    { name: 'dead', click: '#dead', expectVisible: '#m' },
  ] } });
  assert.ok(has(bad, /interaction wrong: expected \/next\//));
  assert.ok(has(bad, /interaction dead/));
});

test('streamed fetch reads of site files complete without failures', opts, async () => {
  // three.js's model loader reads fetch bodies as streams; Chromium reported those as net::ERR_ABORTED
  // when the fixture server sent no-store, though real hosts send cacheable responses.
  const read = '<script>fetch("big.bin").then(function(r){var rd=r.body.getReader();(function pump(){return rd.read().then(function(x){if(!x.done)return pump()})})()})</script>';
  const res = await check({ 'index.html': page(GOOD).replace('</body>', read + '</body>'), 'big.bin': Buffer.alloc(1 << 20, 7) });
  assert.deepEqual(res.failures, []);
});
