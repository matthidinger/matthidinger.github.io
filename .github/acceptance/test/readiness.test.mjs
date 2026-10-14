import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stageSource } from '../lib/pipeline.mjs';
import { exportPreview, previewTarget, readerFile, validateAssociation } from '../lib/preview.mjs';
import { stagePrefixedSite } from '../lib/rewrite.mjs';
import { evaluate, gatherFacts, verifyEvidence, verifyPreviewLink } from '../lib/readiness.mjs';
import { manifest, previewPrefix, sh, sha256, writeJson } from '../lib/util.mjs';

const SHA = 'c'.repeat(40);
const URL1 = 'https://github.com/user-attachments/assets/0f0e1d2c-3b4a-5968-7766-554433221100';
const shot = { file: 'talks-desktop.png', sha256: 'd'.repeat(64) };
const info = { number: 2, state: 'OPEN', isDraft: true, baseRefName: 'master', headRefOid: SHA, headRepositoryOwner: { login: 'matthidinger' }, body: `evidence ${SHA} <img src="${URL1}">` };

function facts(over = {}) {
  return {
    pr: 2, ux: false, head: SHA, dirty: [], mergeBase: 'e'.repeat(40),
    report: { sha: SHA, role: 'deliverable', deliverable: true, passed: true, builder: 'nas', failures: [], strictOverflow: false, prefix: previewPrefix(2, SHA), results: [{ route: 'talks', viewport: 'desktop', failures: [], screenshot: shot }] },
    evidence: { missing: [], mismatched: [] },
    inspection: { sha: SHA, notes: 'looked at it', screenshots: { [shot.file]: shot.sha256 } },
    uploads: { sha: SHA, items: [{ sha256: shot.sha256, url: URL1 }] },
    pr_info: info,
    checks: [{ name: 'site-acceptance', status: 'completed', conclusion: 'success' }],
    previewRoot: '/preview', preview: { exists: true, matches: true },
    previewBaseUrl: 'https://preview.invalid', previewFetch: { status: 'pass', detail: 'verified' },
    backend: { id: 'private-header', type: 'header', source: 'test', originEnv: 'COPILOT_PREVIEW_BASE_URL', base: 'https://preview.invalid', public: false, configured: true },
    hosted: { sha: SHA, pr: 2, prefix: previewPrefix(2, SHA), backend: 'private-header', origin: 'https://preview.invalid', strictOverflow: false, verification: { status: 'pass' }, results: [{ route: 'talks', viewport: 'desktop', passed: true, failures: [] }], passed: true },
    ...over,
  };
}
const gate = (r, id) => r.gates.find((g) => g.id === id);

test('all gates satisfied -> ready', () => {
  assert.equal(evaluate(facts()).overall, 'ready');
});

test('missing preview base URL -> blocked (not ready, no link)', () => {
  const r = evaluate(facts({ previewBaseUrl: '', previewFetch: null }));
  assert.equal(r.overall, 'blocked');
  assert.equal(gate(r, 'private-preview-link').status, 'blocked');
  assert.equal(gate(r, 'hosted-browser').status, 'blocked');
});

test('failed or unverified preview link is not ready; unreachable/denied is an external blocker', () => {
  assert.equal(evaluate(facts({ previewFetch: { status: 'fail', detail: 'wrong revision' } })).overall, 'not-ready');
  assert.equal(evaluate(facts({ previewFetch: null })).overall, 'not-ready');
  const r = evaluate(facts({ previewFetch: { status: 'blocked', detail: '/talks/: access denied (403)' } }));
  assert.equal(r.overall, 'blocked');
  assert.match(gate(r, 'private-preview-link').detail, /external verification blocker/);
});

test('stale revision (HEAD moved after evidence) -> not ready', () => {
  const r = evaluate(facts({ head: 'f'.repeat(40) }));
  assert.equal(gate(r, 'current-revision').status, 'fail');
  assert.equal(r.overall, 'not-ready');
});

test('stale PR head -> not ready', () => {
  const r = evaluate(facts({ pr_info: { ...info, headRefOid: 'f'.repeat(40) } }));
  assert.match(gate(r, 'pr-association').detail, /stale revision/);
});

test('dirty tree, failed or development report -> not ready', () => {
  assert.equal(gate(evaluate(facts({ dirty: [' M x'] })), 'clean-tree').status, 'fail');
  assert.equal(gate(evaluate(facts({ report: { ...facts().report, passed: false, failures: ['x'] } })), 'acceptance-report').status, 'fail');
  assert.match(gate(evaluate(facts({ report: { ...facts().report, role: 'development', deliverable: false } })), 'acceptance-report').detail, /not deliverable/);
});

test('missing evidence, inspection, uploads or embedding -> not ready', () => {
  assert.equal(gate(evaluate(facts({ evidence: { missing: ['talks-desktop.png'], mismatched: [] } })), 'screenshots').status, 'fail');
  assert.equal(gate(evaluate(facts({ inspection: null })), 'visual-inspection').status, 'fail');
  assert.equal(gate(evaluate(facts({ inspection: { ...facts().inspection, screenshots: {} } })), 'visual-inspection').status, 'fail');
  assert.equal(gate(evaluate(facts({ uploads: null })), 'embedded-evidence').status, 'fail');
  assert.equal(gate(evaluate(facts({ uploads: { sha: SHA, items: [{ sha256: shot.sha256, url: 'https://example.com/x.png' }] } })), 'embedded-evidence').status, 'fail');
  assert.equal(gate(evaluate(facts({ pr_info: { ...info, body: 'nothing' } })), 'embedded-evidence').status, 'fail');
});

test('CI missing, pending or failed -> not ready', () => {
  assert.equal(gate(evaluate(facts({ checks: [] })), 'ci').status, 'fail');
  assert.equal(gate(evaluate(facts({ checks: [{ name: 'site-acceptance', status: 'in_progress', conclusion: null }] })), 'ci').status, 'fail');
  assert.equal(gate(evaluate(facts({ checks: [{ name: 'site-acceptance', status: 'completed', conclusion: 'failure' }] })), 'ci').status, 'fail');
});

test('preview not exported or different -> not ready', () => {
  assert.equal(gate(evaluate(facts({ preview: { exists: false } })), 'preview-export').status, 'fail');
  assert.equal(gate(evaluate(facts({ preview: { exists: true, matches: false } })), 'preview-export').status, 'fail');
  assert.equal(gate(evaluate(facts({ previewError: 'accepted site already contains preview-revision.json' })), 'preview-export').status, 'fail');
});

test('UX jobs require strict overflow and embedded before/after', () => {
  const r = evaluate(facts({ ux: true, baseline: null }));
  assert.equal(gate(r, 'ux-overflow').status, 'fail');
  assert.equal(gate(r, 'ux-before-after').status, 'fail');
});

test('association validation rejects other repos, bases and closed PRs', () => {
  assert.ok(validateAssociation({ pr: 2, sha: SHA, head: SHA, info: { ...info, baseRefName: 'main' } }).length);
  assert.ok(validateAssociation({ pr: 2, sha: SHA, head: SHA, info: { ...info, state: 'MERGED' } }).length);
  assert.ok(validateAssociation({ pr: 2, sha: SHA, head: SHA, info: { ...info, headRepositoryOwner: { login: 'someone' } } }).length);
  assert.deepEqual(validateAssociation({ pr: 2, sha: SHA, head: SHA, info }), []);
});

function fakeRun(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-run-'));
  const prefix = previewPrefix(2, SHA);
  const site = path.join(dir, 'preview', prefix);
  fs.mkdirSync(site, { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), '<h1>x</h1>');
  const png = Buffer.from('png-bytes');
  fs.mkdirSync(path.join(dir, 'evidence'));
  fs.writeFileSync(path.join(dir, 'evidence', 'a.png'), png);
  const report = { sha: SHA, pr: 2, prefix, role: 'deliverable', deliverable: true, passed: true, results: [{ route: 'a', viewport: 'desktop', screenshot: { file: 'a.png', sha256: sha256(png) } }], ...over };
  writeJson(path.join(dir, 'report.json'), report);
  writeJson(path.join(dir, 'preview-manifest.json'), manifest(site));
  return { dir, report, site };
}

test('evidence verification catches missing and altered screenshots', () => {
  const { dir, report } = fakeRun();
  assert.deepEqual(verifyEvidence(dir, report), { missing: [], mismatched: [] });
  fs.writeFileSync(path.join(dir, 'evidence', 'a.png'), 'tampered');
  assert.deepEqual(verifyEvidence(dir, report).mismatched, ['a.png']);
  fs.rmSync(path.join(dir, 'evidence', 'a.png'));
  assert.deepEqual(verifyEvidence(dir, report).missing, ['a.png']);
});

test('preview export: blocked without root, refuses dev runs, atomic and immutable', () => {
  const { dir } = fakeRun();
  assert.throws(() => exportPreview({ runDir: dir, previewRoot: '' }), (e) => e.blocked === true);
  const dev = fakeRun({ role: 'development', deliverable: false });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-preview-'));
  assert.throws(() => exportPreview({ runDir: dev.dir, previewRoot: root }), /development/);
  const res = exportPreview({ runDir: dir, previewRoot: root });
  assert.equal(res.status, 'published');
  const target = previewTarget(root, 2, SHA);
  assert.ok(target.endsWith(path.join('matthidinger.github.io', 'pr-2', SHA, 'site')));
  assert.ok(fs.existsSync(path.join(target, 'index.html')));
  assert.deepEqual(fs.readdirSync(path.dirname(path.dirname(target))), [SHA]);
  assert.equal(exportPreview({ runDir: dir, previewRoot: root }).status, 'already-published');
  const other = fakeRun();
  fs.writeFileSync(path.join(other.site, 'index.html'), '<h1>different</h1>');
  writeJson(path.join(other.dir, 'preview-manifest.json'), manifest(other.site));
  assert.throws(() => exportPreview({ runDir: other.dir, previewRoot: root }), /immutable/);
});

test('preview export refuses source/config files in output', () => {
  const { dir, site } = fakeRun();
  fs.writeFileSync(path.join(site, '_config.yml'), 'x: 1');
  writeJson(path.join(dir, 'preview-manifest.json'), manifest(site));
  assert.throws(() => exportPreview({ runDir: dir, previewRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-preview-')) }), /non-site files/);
});

test('deliverable staging refuses a dirty tree', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-git-'));
  const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'ignore' });
  git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
  fs.writeFileSync(path.join(repo, '_config.yml'), 'title: t\n');
  git('add', '.'); git('commit', '-qm', 'init');
  fs.writeFileSync(path.join(repo, 'new.md'), 'x');
  assert.throws(() => stageSource({ root: repo, role: 'deliverable', pr: 1 }), /dirty/);
  const dev = stageSource({ root: repo, role: 'development', pr: 1 });
  assert.equal(dev.meta.deliverable, false);
  assert.ok(fs.existsSync(path.join(dev.runDir, 'src', 'new.md')));
});

test('UX gate fails explicitly when the merge base cannot be established (regression)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-git-'));
  const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'ignore' });
  git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a'); git('add', '.'); git('commit', '-qm', 'init');
  const run = (cmd, args, opts) => { if (cmd === 'gh') throw new Error('offline'); return sh(cmd, args, opts); };
  const g = gatherFacts({ root: repo, runDir: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-run-')), pr: 2, ux: true, env: {}, run });
  assert.equal(g.mergeBase, null);
  assert.ok(g.mergeBaseError);
  const URL2 = URL1.replace('1100', '2200');
  const ux = {
    ux: true, mergeBase: g.mergeBase, mergeBaseError: g.mergeBaseError,
    report: { ...facts().report, strictOverflow: true },
    baseline: { report: { role: 'baseline', sha: 'b'.repeat(40) }, uploads: { items: [{ url: URL2 }] } },
    pr_info: { ...info, body: info.body + ` <img src="${URL2}">` },
  };
  const r = evaluate(facts(ux));
  assert.equal(gate(r, 'ux-before-after').status, 'fail');
  assert.match(gate(r, 'ux-before-after').detail, /cannot establish the merge base/);
  assert.equal(r.overall, 'not-ready');
  assert.equal(gate(evaluate(facts({ ...ux, mergeBase: 'b'.repeat(40) })), 'ux-before-after').status, 'pass');
});

test('preview URL contract: canonical URL has no /site segment and resolves on the exported disk layout', () => {
  const prefix = previewPrefix(2, SHA);
  assert.equal(prefix + '/talks/', `/matthidinger.github.io/pr-2/${SHA}/talks/`);
  assert.ok(!prefix.includes('/site'));

  const built = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-built-'));
  const put = (rel, body) => { fs.mkdirSync(path.dirname(path.join(built, rel)), { recursive: true }); fs.writeFileSync(path.join(built, rel), body); };
  const nav = '<link rel="stylesheet" href="https://matthidinger.com/assets/css/main.css"><nav><a href="/">home</a><a href="https://matthidinger.com/talks/">t</a><a href="/blog/">b</a><a href="https://www.matthidinger.com/archive/2008/05/08/post/">p</a></nav>';
  put('index.html', `<html>${nav}<h1>home</h1></html>`);
  put('talks/index.html', `<html>${nav}<h1>Talks</h1></html>`);
  put('blog/index.html', `<html>${nav}<h1>Blog</h1><a href="/blog/page2/">2</a></html>`);
  put('blog/page2/index.html', `<html>${nav}<h1>Blog 2</h1></html>`);
  put('archive/2008/05/08/post/index.html', `<html>${nav}<h1>post</h1><img src="/images/a.png"></html>`);
  put('assets/css/main.css', 'body{background:url(/images/a.png)} h1{background:url("https://matthidinger.com/images/a.png")}');
  put('images/a.png', 'png');

  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-run-'));
  const staged = path.join(runDir, 'preview', prefix);
  const rw = stagePrefixedSite(built, staged, prefix, ['https://matthidinger.com', 'https://www.matthidinger.com']);
  assert.deepEqual(rw.escaping, []);
  writeJson(path.join(runDir, 'report.json'), { sha: SHA, pr: 2, prefix, role: 'deliverable', deliverable: true, passed: true, results: [] });
  writeJson(path.join(runDir, 'preview-manifest.json'), manifest(staged));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-preview-'));
  exportPreview({ runDir, previewRoot: root });

  const site = previewTarget(root, 2, SHA);
  assert.equal(readerFile(root, `/matthidinger.github.io/pr-2/${SHA}/talks/`), path.join(site, 'talks', 'index.html'));
  assert.ok(fs.existsSync(readerFile(root, `/matthidinger.github.io/pr-2/${SHA}/talks/`)));
  assert.ok(!fs.existsSync(readerFile(root, `/matthidinger.github.io/pr-2/${SHA}/site/talks/`)), 'old /site URL must not resolve');
  assert.equal(readerFile(root, `/matthidinger.github.io/pr-2/${SHA}/../../x`), null);

  const refs = [];
  for (const rel of Object.keys(manifest(site))) {
    const text = fs.readFileSync(path.join(site, rel), 'utf8');
    if (rel.endsWith('.html')) for (const m of text.matchAll(/(?:href|src)="([^"]+)"/g)) refs.push([rel, m[1]]);
    if (rel.endsWith('.css')) for (const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) refs.push([rel, m[1]]);
  }
  assert.ok(refs.length >= 25);
  for (const [rel, url] of refs) {
    assert.ok(url.startsWith(prefix + '/'), `${rel}: ${url} is outside the canonical prefix`);
    const file = readerFile(root, url);
    assert.ok(file && fs.existsSync(file), `${rel}: ${url} does not resolve through the reader contract`);
  }
});

const ORIGIN = 'https://preview.invalid';
const TALKS = Buffer.from('<h1>Talks</h1>');
const HOME = Buffer.from('<h1>home</h1>');
const EXPECTED = { 'talks/index.html': sha256(TALKS), 'index.html': sha256(HOME) };
const PFX = previewPrefix(2, SHA);
function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, opts }); return handler(url, opts); };
  return { fn, calls };
}
const serve = (over = {}) => (url) => {
  const p = new URL(url).pathname.slice(PFX.length);
  const body = p === '/talks/' ? TALKS : p === '/' ? HOME : null;
  if (!body) return new Response('nf', { status: 404 });
  return new Response(over.body?.(p) ?? body, { status: over.status ?? 200, headers: { 'x-preview-revision': over.rev ?? SHA, ...(over.headers || {}) } });
};
const verify = (fn, extra = {}) => verifyPreviewLink({ base: ORIGIN, prefix: PFX, sha: SHA, paths: ['/', '/talks/', '/talks/'], expected: EXPECTED, fetchImpl: fn, ...extra });

test('preview link: ambient-auth 200 with exact revision and accepted bytes passes, with no injected headers', async () => {
  const { fn, calls } = fakeFetch(serve());
  const res = await verify(fn);
  assert.equal(res.status, 'pass', res.detail);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((c) => c.url), [`${ORIGIN}${PFX}/`, `${ORIGIN}${PFX}/talks/`]);
  for (const c of calls) {
    assert.equal(c.opts.redirect, 'manual');
    assert.ok(c.opts.signal);
    assert.equal(c.opts.headers, undefined);
    assert.equal(c.opts.credentials, undefined);
  }
  assert.equal(evaluate(facts({ previewFetch: res })).overall, 'ready');
});

test('preview link: wrong/missing revision or changed content fails', async () => {
  assert.match((await verify(fakeFetch(serve({ rev: 'f'.repeat(40) })).fn)).detail, /X-Preview-Revision/);
  assert.equal((await verify(fakeFetch(serve({ rev: '' })).fn)).status, 'fail');
  const changed = await verify(fakeFetch(serve({ body: (p) => (p === '/talks/' ? '<h1>Talks</h1><p>other build</p>' : null) })).fn);
  assert.equal(changed.status, 'fail');
  assert.match(changed.detail, /\/talks\/: served HTML differs/);
  assert.equal((await verify(fakeFetch(serve()).fn, { paths: ['/missing/'] })).status, 'fail');
  assert.equal((await verify(fakeFetch(() => new Response('x', { status: 500 })).fn)).status, 'fail');
  assert.equal((await verify(fakeFetch(() => new Response('x', { status: 404 })).fn)).status, 'fail');
});

test('preview link: redirects fail and are never followed', async () => {
  const { fn, calls } = fakeFetch(() => new Response(null, { status: 302, headers: { location: 'https://login.invalid/' } }));
  const res = await verify(fn);
  assert.equal(res.status, 'fail');
  assert.match(res.detail, /redirected \(302\)/);
  assert.ok(calls.every((c) => !c.url.includes('login.invalid')));
  assert.equal((await verify(fakeFetch(() => ({ status: 0, type: 'opaqueredirect', headers: new Headers() })).fn)).status, 'fail');
});

test('preview link: http, credentialed or non-origin base URLs fail without any request', async () => {
  for (const base of ['http://preview.invalid', 'https://preview.invalid/pages', 'https://u:p@preview.invalid', 'https://preview.invalid/?x=1', 'https://preview.invalid/#a', 'ftp://preview.invalid', 'not a url']) {
    const { fn, calls } = fakeFetch(serve());
    const res = await verify(fn, { base });
    assert.equal(res.status, 'fail', base);
    assert.equal(calls.length, 0, base);
  }
  assert.equal((await verify(fakeFetch(serve()).fn, { base: 'https://preview.invalid/' })).status, 'pass');
});

test('preview link: timeout, unreachable or access denied is an external blocker that never leaks the origin', async () => {
  const hang = (url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason)));
  const keepAlive = setInterval(() => {}, 1000); // AbortSignal.timeout is unref'd; a real fetch holds a socket
  const t = await verify(hang, { timeoutMs: 20 }).finally(() => clearInterval(keepAlive));
  assert.equal(t.status, 'blocked');
  assert.match(t.detail, /timed out/);
  const down = await verify(async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }); });
  assert.equal(down.status, 'blocked');
  assert.match(down.detail, /unreachable \(ENOTFOUND\)/);
  for (const status of [401, 403]) {
    const denied = await verify(fakeFetch(() => new Response('no', { status })).fn);
    assert.equal(denied.status, 'blocked');
    assert.match(denied.detail, new RegExp(`access denied \\(${status}\\)`));
    assert.equal(evaluate(facts({ previewFetch: denied })).overall, 'blocked');
  }
  const real = await verifyPreviewLink({ base: 'https://127.0.0.1:1', prefix: PFX, sha: SHA, paths: ['/talks/'], expected: EXPECTED, timeoutMs: 2000 });
  assert.equal(real.status, 'blocked');
  for (const r of [t, down, real]) assert.ok(!r.detail.includes('preview.invalid') && !r.detail.includes('127.0.0.1'));
  const mixed = await verify(fakeFetch((url) => (url.endsWith('/talks/') ? new Response('no', { status: 403 }) : new Response('x', { status: 500 }))).fn);
  assert.equal(mixed.status, 'fail');
});
