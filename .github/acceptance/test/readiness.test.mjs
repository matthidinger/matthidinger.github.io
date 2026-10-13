import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stageSource } from '../lib/pipeline.mjs';
import { exportPreview, previewTarget, validateAssociation } from '../lib/preview.mjs';
import { evaluate, verifyEvidence } from '../lib/readiness.mjs';
import { manifest, previewPrefix, sha256, writeJson } from '../lib/util.mjs';

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
    previewBaseUrl: 'https://preview.invalid', previewFetch: { ok: true },
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
});

test('publicly readable or unverified preview link is not ready', () => {
  assert.equal(evaluate(facts({ previewFetch: { ok: false, detail: 'public' } })).overall, 'not-ready');
  assert.equal(evaluate(facts({ previewFetch: null })).overall, 'not-ready');
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
