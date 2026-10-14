import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hostedSection } from '../bin/upload-screenshots.mjs';
import {
  RECEIPT_FILE, buildReceipt, exportManifest, hostedErrors, loadPreviewConfig, receiptBytes, receiptErrors, resolveBackend, verifyHostedReceipt,
} from '../lib/hosting.mjs';
import { exportPreview, previewTarget, readerFile } from '../lib/preview.mjs';
import { evaluate, gatherFacts, verifyHostedPreview } from '../lib/readiness.mjs';
import { REPO_NWO, manifest, previewPrefix, sh, sha256, writeJson } from '../lib/util.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const PR = 7;
const PFX = previewPrefix(PR, SHA);
const BUILDER = 'nas-pages-build (GitHub Pages 232, PAGES_ENV=dotcom)';
const AZURE = 'https://matthidingerpreviews.z5.web.core.windows.net';
const URL1 = 'https://github.com/user-attachments/assets/0f0e1d2c-3b4a-5968-7766-554433221100';
const FILES = {
  'index.html': Buffer.from('<h1>home</h1>'),
  'archive/2011/12/12/post/index.html': Buffer.from('<pre><code>  x = 1\n\ty\n</code></pre>'),
  'assets/js/code-copy.js': Buffer.from('/* copy */'),
};
const EXPECTED = Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k, sha256(v)]).sort(([a], [b]) => (a < b ? -1 : 1)));
const REPORT = {
  sha: SHA, pr: PR, prefix: PFX, role: 'deliverable', deliverable: true, passed: true, builder: BUILDER, failures: [], strictOverflow: true,
  results: [
    { route: 'home', path: '/', viewport: 'desktop', failures: [], screenshot: { file: 'home-desktop.png', sha256: 'd'.repeat(64) } },
    { route: 'post', path: '/archive/2011/12/12/post/', viewport: 'mobile', failures: [], screenshot: { file: 'post-mobile.png', sha256: 'e'.repeat(64) } },
  ],
};
const RECEIPT = buildReceipt(REPORT, EXPECTED);
const CONFIG = loadPreviewConfig();

// Serves a receipt-backed preview from an in-memory table; `over` mutates what is served.
function host(over = {}) {
  const calls = [];
  const table = { [RECEIPT_FILE]: receiptBytes(over.receipt === undefined ? RECEIPT : over.receipt), ...FILES, ...(over.files || {}) };
  for (const k of over.drop || []) delete table[k];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (over.handler) { const r = over.handler(url, opts); if (r) return r; }
    const u = new URL(url);
    assert.equal(u.origin, AZURE);
    if (!u.pathname.startsWith(PFX + '/')) return new Response('nf', { status: 404 });
    let rel = decodeURIComponent(u.pathname.slice(PFX.length + 1));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const body = table[rel];
    if (over.receiptRaw !== undefined && rel === RECEIPT_FILE) return new Response(over.receiptRaw, { status: 200 });
    return body === undefined ? new Response('nf', { status: 404 }) : new Response(body, { status: 200 });
  };
  return { fn, calls };
}
const verify = (fn, extra = {}) => verifyHostedReceipt({ origin: AZURE, prefix: PFX, pr: PR, sha: SHA, builder: BUILDER, expected: EXPECTED, paths: REPORT.results.map((r) => r.path), fetchImpl: fn, ...extra });

test('backend selection: preview.json default is the approved Azure receipt origin; env and flag override; unknown fails', () => {
  const az = resolveBackend({ env: {}, config: CONFIG });
  assert.deepEqual([az.id, az.type, az.origin, az.public, az.source], ['azure-receipt', 'receipt', AZURE, true, 'preview.json defaultBackend']);
  const hdr = resolveBackend({ env: { COPILOT_PREVIEW_BACKEND: 'private-header' }, config: CONFIG });
  assert.deepEqual([hdr.id, hdr.type, hdr.configured, hdr.public], ['private-header', 'header', false, false]);
  const hdr2 = resolveBackend({ flag: 'private-header', env: { COPILOT_PREVIEW_BACKEND: 'azure-receipt', COPILOT_PREVIEW_BASE_URL: 'https://p.invalid' }, config: CONFIG });
  assert.deepEqual([hdr2.id, hdr2.source, hdr2.base, hdr2.configured], ['private-header', '--preview-backend', 'https://p.invalid', true]);
  assert.throws(() => resolveBackend({ flag: 'netlify', env: {}, config: CONFIG }), /unknown preview backend "netlify"/);
  assert.throws(() => resolveBackend({ env: { COPILOT_PREVIEW_BACKEND: 'toString' }, config: CONFIG }), /unknown preview backend/);
  assert.throws(() => resolveBackend({ flag: true, env: {}, config: CONFIG }), /requires a backend name/);
  assert.throws(() => resolveBackend({ env: {}, config: { defaultBackend: 'x', backends: { x: { type: 'receipt', origin: 'http://insecure.invalid' } } } }), /https/);
  assert.throws(() => resolveBackend({ env: {}, config: { defaultBackend: 'x', backends: { x: { type: 'ftp' } } } }), /unsupported type/);
});

test('receipt format: repository, PR, full SHA, builder and the complete accepted manifest', () => {
  assert.deepEqual(Object.keys(RECEIPT), ['schemaVersion', 'repository', 'pr', 'sha', 'builder', 'files']);
  assert.equal(RECEIPT.repository, REPO_NWO);
  assert.deepEqual(RECEIPT.files, EXPECTED);
  assert.deepEqual(receiptErrors(RECEIPT, { pr: PR, sha: SHA, builder: BUILDER, expected: EXPECTED }), []);
  const pkg = exportManifest(REPORT, EXPECTED);
  assert.equal(pkg[RECEIPT_FILE], sha256(receiptBytes(RECEIPT)));
  assert.throws(() => exportManifest(REPORT, { ...EXPECTED, [RECEIPT_FILE]: 'f'.repeat(64) }), /reserved/);
});

test('receipt validation rejects wrong repository, PR, SHA, builder, schema and incomplete or altered manifests', () => {
  const errs = (over) => receiptErrors({ ...RECEIPT, ...over }, { pr: PR, sha: SHA, builder: BUILDER, expected: EXPECTED }).join('; ');
  assert.match(errs({ repository: 'mmistakes/minimal-mistakes' }), /repository/);
  assert.match(errs({ pr: 4 }), /pr 4 != 7/);
  assert.match(errs({ pr: '7' }), /pr "7" != 7/);
  assert.match(errs({ sha: OTHER }), new RegExp(`sha ${OTHER} != ${SHA}`));
  assert.match(errs({ sha: SHA.slice(0, 12) }), /not a full 40-character/);
  assert.match(errs({ builder: 'jekyll serve' }), /builder/);
  assert.match(errs({ schemaVersion: 2 }), /schemaVersion/);
  const { 'assets/js/code-copy.js': _dropped, ...partial } = EXPECTED;
  assert.match(errs({ files: partial }), /manifest incomplete: 1 accepted file\(s\) missing \(assets\/js\/code-copy\.js\)/);
  assert.match(errs({ files: { ...EXPECTED, 'secret.txt': 'f'.repeat(64) } }), /outside the accepted build \(secret\.txt\)/);
  assert.match(errs({ files: { ...EXPECTED, 'index.html': 'f'.repeat(64) } }), /hashes differ for 1 file\(s\) \(index\.html\)/);
  assert.match(errs({ files: null }), /files manifest missing/);
  assert.deepEqual(receiptErrors([], { pr: PR, sha: SHA, builder: BUILDER, expected: EXPECTED }), ['receipt is not a JSON object']);
});

test('hosted receipt: exact receipt and served bytes pass; every file and route URL is fetched without redirects or injected headers', async () => {
  const { fn, calls } = host();
  const res = await verify(fn);
  assert.equal(res.status, 'pass', res.detail);
  assert.match(res.detail, /complete 3-file accepted manifest; 3 files and 2 route URLs/);
  const urls = calls.map((c) => c.url.slice(AZURE.length));
  assert.equal(urls[0], `${PFX}/${RECEIPT_FILE}`);
  for (const rel of Object.keys(EXPECTED)) assert.ok(urls.includes(`${PFX}/${rel}`), rel);
  assert.ok(urls.includes(`${PFX}/`) && urls.includes(`${PFX}/archive/2011/12/12/post/`));
  for (const c of calls) {
    assert.equal(c.opts.redirect, 'manual');
    assert.ok(c.opts.signal);
    assert.equal(c.opts.headers, undefined);
  }
});

test('hosted receipt: absent receipt or denied/unreachable host is an external blocker, never a pass', async () => {
  const absent = await verify(host({ drop: [RECEIPT_FILE] }).fn);
  assert.equal(absent.status, 'blocked');
  assert.match(absent.detail, /absent \(404\): awaiting operator publication/);
  for (const status of [401, 403]) assert.equal((await verify(host({ handler: () => new Response('no', { status }) }).fn)).status, 'blocked');
  const down = await verify(async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }); });
  assert.equal(down.status, 'blocked');
  assert.match(down.detail, /unreachable \(ENOTFOUND\)/);
  const hang = (url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason)));
  const keepAlive = setInterval(() => {}, 1000);
  const t = await verify(hang, { timeoutMs: 20 }).finally(() => clearInterval(keepAlive));
  assert.equal(t.status, 'blocked');
  assert.match(t.detail, /timed out/);
});

test('hosted receipt: wrong receipts fail before any site file is trusted', async () => {
  const cases = [
    [{ ...RECEIPT, repository: 'someone/else' }, /repository/],
    [{ ...RECEIPT, pr: 4 }, /pr 4 != 7/],
    [{ ...RECEIPT, sha: OTHER }, /sha/],
    [{ ...RECEIPT, files: { 'index.html': EXPECTED['index.html'] } }, /manifest incomplete: 2/],
  ];
  for (const [receipt, re] of cases) {
    const { fn, calls } = host({ receipt });
    const res = await verify(fn);
    assert.equal(res.status, 'fail');
    assert.match(res.detail, /^receipt rejected: /);
    assert.match(res.detail, re);
    assert.equal(calls.length, 1, 'no site files fetched after a rejected receipt');
  }
  assert.match((await verify(host({ receiptRaw: '<html>not json' }).fn)).detail, /not valid JSON/);
  assert.equal((await verify(host({ handler: (u) => (u.endsWith(RECEIPT_FILE) ? new Response('x', { status: 500 }) : null) }).fn)).status, 'fail');
});

test('hosted receipt: a correct receipt over wrong or missing served bytes fails', async () => {
  const changed = await verify(host({ files: { 'assets/js/code-copy.js': Buffer.from('/* tampered */') } }).fn);
  assert.equal(changed.status, 'fail');
  assert.match(changed.detail, /assets\/js\/code-copy\.js: served bytes differ/);
  const missing = await verify(host({ drop: ['archive/2011/12/12/post/index.html'] }).fn);
  assert.equal(missing.status, 'fail');
  assert.match(missing.detail, /archive\/2011\/12\/12\/post\/index\.html: not found \(404\)/);
  assert.match(missing.detail, /\/archive\/2011\/12\/12\/post\/: not found/);
  const { fn, calls } = host({ handler: (u) => (u.endsWith('/index.html') && !u.includes('archive') ? new Response(null, { status: 301, headers: { location: 'https://evil.invalid/' } }) : null) });
  const redirected = await verify(fn);
  assert.equal(redirected.status, 'fail');
  assert.match(redirected.detail, /redirected \(301\)/);
  assert.ok(calls.every((c) => !c.url.includes('evil.invalid')));
  const notAccepted = await verify(host().fn, { paths: ['/talks/'] });
  assert.equal(notAccepted.status, 'fail');
  assert.match(notAccepted.detail, /\/talks\/: route not in the accepted preview manifest/);
  assert.equal((await verify(host().fn, { expected: {} })).status, 'fail');
});

function acceptedRun() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-host-'));
  const site = path.join(dir, 'preview', PFX);
  for (const [rel, body] of Object.entries(FILES)) { fs.mkdirSync(path.dirname(path.join(site, rel)), { recursive: true }); fs.writeFileSync(path.join(site, rel), body); }
  writeJson(path.join(dir, 'report.json'), REPORT);
  writeJson(path.join(dir, 'preview-manifest.json'), manifest(site));
  return dir;
}

test('export writes the receipt into the package; the exported package verifies byte-for-byte when served as-is', async () => {
  const runDir = acceptedRun();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-preview-'));
  const res = exportPreview({ runDir, previewRoot: root });
  assert.equal(res.status, 'published');
  const site = previewTarget(root, PR, SHA);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(site, RECEIPT_FILE), 'utf8')), RECEIPT);
  assert.deepEqual(manifest(site), exportManifest(REPORT, EXPECTED));
  assert.equal(exportPreview({ runDir, previewRoot: root }).status, 'already-published');

  // Serve the exported directory exactly through the reader URL contract, as the operator would publish it.
  const fromDisk = async (url) => {
    const file = readerFile(root, new URL(url).pathname);
    return file && fs.existsSync(file) ? new Response(fs.readFileSync(file), { status: 200 }) : new Response('nf', { status: 404 });
  };
  const backend = resolveBackend({ env: {}, config: CONFIG });
  const ok = await verifyHostedPreview({ backend, pr: PR, report: REPORT, expected: EXPECTED, fetchImpl: fromDisk });
  assert.equal(ok.status, 'pass', ok.detail);

  const facts = gatherFacts({ root: sh('git', ['rev-parse', '--show-toplevel']), runDir, pr: PR, env: { COPILOT_PREVIEW_ROOT: root }, run: () => { throw new Error('offline'); } });
  assert.equal(facts.backend.id, 'azure-receipt');
  assert.deepEqual(facts.preview, { exists: true, matches: true });
  fs.writeFileSync(path.join(site, RECEIPT_FILE), JSON.stringify({ ...RECEIPT, sha: OTHER }));
  assert.equal(gatherFacts({ root: sh('git', ['rev-parse', '--show-toplevel']), runDir, pr: PR, env: { COPILOT_PREVIEW_ROOT: root }, run: () => { throw new Error('offline'); } }).preview.matches, false);
  assert.throws(() => exportPreview({ runDir, previewRoot: root }), /immutable/);
});

test('an unknown preview backend is a failing readiness gate, never a silent default', () => {
  const runDir = acceptedRun();
  const f = gatherFacts({ root: sh('git', ['rev-parse', '--show-toplevel']), runDir, pr: PR, env: { COPILOT_PREVIEW_BACKEND: 'mystery' }, run: () => { throw new Error('offline'); } });
  assert.equal(f.backend, null);
  const r = evaluate({ ...ready(), backend: null, backendError: f.backendError });
  assert.equal(r.gates.find((g) => g.id === 'preview-backend').status, 'fail');
  assert.match(r.gates.find((g) => g.id === 'preview-backend').detail, /unknown preview backend "mystery"/);
  assert.equal(r.gates.find((g) => g.id === 'hosted-browser').status, 'fail');
  assert.equal(r.overall, 'not-ready');
});

const BACKEND = resolveBackend({ env: {}, config: CONFIG });
const HOSTED = {
  sha: SHA, pr: PR, prefix: PFX, backend: 'azure-receipt', origin: AZURE, public: true, strictOverflow: true, verification: { status: 'pass', detail: 'ok' },
  results: [
    { route: 'home', path: '/', viewport: 'desktop', passed: true, failures: [], copyCode: null },
    { route: 'post', path: '/archive/2011/12/12/post/', viewport: 'mobile', passed: true, failures: [], copyCode: [{ name: 'copy', ok: true }] },
  ],
  passed: true,
};
function ready(over = {}) {
  return {
    pr: PR, ux: false, head: SHA, dirty: [], mergeBase: 'e'.repeat(40), report: REPORT,
    evidence: { missing: [], mismatched: [] },
    inspection: { sha: SHA, notes: 'viewed', screenshots: Object.fromEntries(REPORT.results.map((r) => [r.screenshot.file, r.screenshot.sha256])) },
    uploads: { sha: SHA, items: REPORT.results.map((r) => ({ sha256: r.screenshot.sha256, url: URL1 })) },
    pr_info: { number: PR, state: 'OPEN', isDraft: true, baseRefName: 'master', headRefOid: SHA, headRepositoryOwner: { login: 'matthidinger' }, body: `${SHA} <img src="${URL1}">` },
    checks: [{ name: 'site-acceptance', status: 'completed', conclusion: 'success' }],
    previewRoot: '/p', preview: { exists: true, matches: true }, previewBaseUrl: '',
    backend: BACKEND, previewFetch: { status: 'pass', detail: 'receipt verified' }, hosted: HOSTED,
    ...over,
  };
}
const g = (r, id) => r.gates.find((x) => x.id === id);

function withCloud(over = {}) {
  const report = { ...REPORT, role: 'cloud', deliverable: false, builder: 'actions/jekyll-build-pages@pinned',
    provenance: { kind: 'github-actions', runId: 42, runAttempt: 1, artifactId: 123 } };
  return ready({
    cloudRequested: true,
    cloud: { status: 'pass', report, verification: { status: 'pass' }, hosted: HOSTED, detail: 'cloud proof verified' },
    previewRoot: '', preview: { exists: false, matches: false },
    checks: [{ name: 'preview-verified', status: 'completed', conclusion: 'success' }],
    ...over,
  });
}

test('NAS readiness can consume distinct cloud bytes/provenance without pretending the cloud build ran on NAS', () => {
  const result = evaluate(withCloud());
  assert.equal(result.overall, 'ready', JSON.stringify(result.gates.filter((x) => x.status !== 'pass')));
  assert.equal(g(result, 'nas-build').status, 'pass');
  assert.equal(g(result, 'preview-export').status, 'pass');
  assert.match(g(result, 'preview-export').detail, /independently of NAS build bytes/);
  assert.match(g(result, 'ci').detail, /not inferred from a default-branch check SHA/);
  assert.equal(evaluate(withCloud({ report: { ...REPORT, passed: false } })).overall, 'not-ready');
  assert.equal(evaluate(withCloud({ report: { ...REPORT, builder: 'actions/jekyll-build-pages' } })).overall, 'not-ready');
  assert.equal(evaluate(withCloud({ report: { ...REPORT, deliverable: false, role: 'cloud' } })).overall, 'not-ready');
  assert.equal(evaluate(withCloud({ inspection: null })).overall, 'not-ready');
  assert.equal(evaluate(withCloud({ uploads: null })).overall, 'not-ready');
  assert.equal(evaluate(withCloud({ dirty: ['M changed'] })).overall, 'not-ready');
});

test('cloud-aware NAS readiness refuses missing/stale cloud proofs and preserves blocked access', () => {
  assert.equal(evaluate(withCloud({ cloud: null })).overall, 'not-ready');
  assert.equal(evaluate(withCloud({ cloud: { ...withCloud().cloud, report: { ...withCloud().cloud.report, sha: OTHER } } })).overall, 'not-ready');
  assert.equal(evaluate(withCloud({ checks: { error: 'API failed' } })).overall, 'not-ready');
  assert.equal(evaluate(withCloud({ checks: [{ name: 'lint', status: 'completed', conclusion: 'failure' }] })).overall, 'not-ready');
  const blocked = evaluate(withCloud({ cloud: { status: 'blocked', detail: 'GitHub artifact access denied' },
    previewFetch: { status: 'blocked', detail: 'GitHub artifact access denied' }, hosted: null }));
  assert.equal(blocked.overall, 'blocked');
  assert.equal(g(blocked, 'cloud-provenance').status, 'blocked');
});

test('readiness (azure-receipt): ready only with a verified receipt and a passing hosted browser run for this SHA', () => {
  const r = evaluate(ready());
  assert.equal(r.overall, 'ready', JSON.stringify(r.gates.filter((x) => x.status !== 'pass')));
  assert.match(g(r, 'preview-backend').detail, /azure-receipt/);
  assert.equal(g(r, 'preview-receipt').status, 'pass');
  assert.match(g(r, 'hosted-browser').detail, /including 1 copy-code/);
  assert.equal(g(r, 'private-preview-link'), undefined);
});

test('readiness (azure-receipt): absent receipt -> BLOCKED; wrong receipt or bytes -> NOT READY; unverified -> NOT READY', () => {
  const blocked = evaluate(ready({ previewFetch: { status: 'blocked', detail: 'receipt preview-revision.json is absent (404): awaiting operator publication' }, hosted: null }));
  assert.equal(blocked.overall, 'blocked');
  assert.match(g(blocked, 'preview-receipt').detail, /awaiting operator publication/);
  assert.equal(g(blocked, 'hosted-browser').status, 'blocked');
  const wrong = evaluate(ready({ previewFetch: { status: 'fail', detail: 'receipt rejected: sha x != y' } }));
  assert.equal(wrong.overall, 'not-ready');
  assert.equal(g(wrong, 'hosted-browser').status, 'fail');
  assert.equal(evaluate(ready({ previewFetch: null })).overall, 'not-ready');
});

test('readiness (azure-receipt): missing, stale, failing or partial hosted browser runs are not ready', () => {
  const bad = [
    [null, /no hosted browser report/],
    [{ ...HOSTED, sha: OTHER }, /stale/],
    [{ ...HOSTED, pr: 4 }, /PR 4/],
    [{ ...HOSTED, backend: 'private-header' }, /backend private-header/],
    [{ ...HOSTED, origin: 'https://elsewhere.invalid' }, /different origin/],
    [{ ...HOSTED, verification: { status: 'blocked' } }, /verified preview/],
    [{ ...HOSTED, strictOverflow: false }, /overflow/],
    [{ ...HOSTED, results: HOSTED.results.slice(0, 1) }, /do not cover 1 accepted route\/viewport\(s\): post-mobile/],
    [{ ...HOSTED, passed: false, results: [HOSTED.results[0], { ...HOSTED.results[1], passed: false, failures: ['copy code: snippet 1 Enter copies exact code: clipboard unchanged'] }] }, /post-mobile: copy code/],
  ];
  for (const [hosted, re] of bad) {
    const r = evaluate(ready({ hosted }));
    assert.equal(g(r, 'hosted-browser').status, 'fail');
    assert.match(g(r, 'hosted-browser').detail, re);
    assert.equal(r.overall, 'not-ready');
  }
  assert.deepEqual(hostedErrors(HOSTED, { report: REPORT, pr: PR, backend: BACKEND, origin: AZURE }), []);
});

test('readiness (azure-receipt): stale evidence, failed/pending CI and missing screenshot evidence still block readiness', () => {
  assert.equal(g(evaluate(ready({ head: OTHER })), 'current-revision').status, 'fail');
  assert.equal(evaluate(ready({ head: OTHER })).overall, 'not-ready');
  for (const checks of [[], [{ name: 'site-acceptance', status: 'in_progress', conclusion: null }], [{ name: 'site-acceptance', status: 'completed', conclusion: 'failure' }]]) {
    assert.equal(evaluate(ready({ checks })).overall, 'not-ready');
  }
  assert.equal(evaluate(ready({ evidence: { missing: ['post-mobile.png'], mismatched: [] } })).overall, 'not-ready');
  assert.equal(evaluate(ready({ uploads: null })).overall, 'not-ready');
  assert.equal(evaluate(ready({ inspection: null })).overall, 'not-ready');
  assert.equal(evaluate(ready({ preview: { exists: true, matches: false } })).overall, 'not-ready');
});

test('PR hosted section lists page-specific links only for a public backend', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-hs-'));
  writeJson(path.join(dir, 'hosted', 'report.json'), { ...HOSTED, checkedAt: 'now' });
  const pub = hostedSection(dir);
  assert.ok(pub.includes(`[open](${AZURE}${PFX}/archive/2011/12/12/post/)`));
  assert.match(pub, /\| 1\/1 \|/);
  writeJson(path.join(dir, 'hosted', 'report.json'), { ...HOSTED, public: false, origin: 'https://private.invalid', checkedAt: 'now' });
  const priv = hostedSection(dir);
  assert.ok(!priv.includes('private.invalid') && !priv.includes('[open]'));
});
