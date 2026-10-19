import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BUILD_WORKFLOW, CLOUD_BUILDER, CLOUD_ORIGIN, candidateName, cloudReport, extractCandidate,
  previewDeployment, previewSuccess, runTitle, safePath, selectArtifact, sitePath, validateCandidate, validateConfig, validatePull, validateRun,
} from '../lib/cloud.mjs';
import { chooseImmutableCandidate, contentType, publishImmutable, verifyCloud } from '../lib/cloud-publish.mjs';
import { shouldDispatch } from '../lib/cloud-reconcile.mjs';
import { pages } from '../lib/cloud-github.mjs';
import { publicationRunId, validateHostedProof, validatePublication } from '../lib/cloud-proof.mjs';
import { RECEIPT_FILE, buildReceipt, receiptBytes, receiptErrors } from '../lib/hosting.mjs';
import { REPO_NWO, manifest, previewPrefix, readJson, sha256, writeJson } from '../lib/util.mjs';

const SHA = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const OTHER = 'c'.repeat(40);
const PR = 12;
const WORKFLOW = { id: 98, path: BUILD_WORKFLOW };
const CONTEXT = { repository: REPO_NWO, workflow: BUILD_WORKFLOW, runId: 42, runAttempt: 2, pr: PR,
  sha: SHA, baseSha: BASE, baselineSha: BASE, toolingSha: BASE };
const RUN = { id: 42, run_attempt: 2, path: BUILD_WORKFLOW, workflow_id: 98,
  repository: { full_name: REPO_NWO }, head_repository: { full_name: REPO_NWO },
  event: 'pull_request', status: 'completed', conclusion: 'success', head_sha: SHA, display_title: runTitle(PR, SHA) };
const PULL = { number: PR, state: 'open', base: { ref: 'master', sha: BASE, repo: { full_name: REPO_NWO } },
  head: { sha: SHA, repo: { full_name: REPO_NWO } } };
const ARTIFACT = { id: 444, name: candidateName(42, 2), expired: false, size_in_bytes: 100,
  digest: `sha256:${'d'.repeat(64)}`, workflow_run: { id: 42, head_sha: SHA } };
const CONFIG = {
  productionOrigins: ['https://matthidinger.com'], build: {},
  routes: [{ id: 'home', path: '/', title: 'Home', interactions: [{ name: 'next', click: '#next', expectPath: '/next/' }] }],
  viewports: [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }],
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
function report(sha = SHA, role = 'cloud') {
  return { repo: REPO_NWO, sha, pr: PR, prefix: previewPrefix(PR, sha), role, deliverable: false,
    builder: CLOUD_BUILDER, strictOverflow: role === 'cloud', passed: true, failures: [],
    results: CONFIG.viewports.map((v) => ({ route: 'home', path: '/', viewport: v.name, passed: true, failures: [],
      assertions: [{ name: 'document', ok: true }], interactions: [{ name: 'next', ok: true }],
      screenshot: { file: `home-${v.name}.png`, sha256: sha256(PNG) } })) };
}
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const data = { 'site/index.html': '<h1>Home</h1>', 'site/CNAME': 'matthidinger.com',
    'site/assets/main.js': 'console.log("public website")' };
  for (const side of ['before', 'after']) for (const v of CONFIG.viewports) data[`evidence/${side}/home-${v.name}.png`] = PNG;
  for (const [rel, body] of Object.entries(data)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  const c = { schemaVersion: 1, context: { ...CONTEXT }, config: structuredClone(CONFIG), baselineConfig: structuredClone(CONFIG),
    report: report(), baselineReport: report(BASE, 'baseline'), files: manifest(path.join(dir, 'site')) };
  writeJson(path.join(dir, 'candidate.json'), c);
  return { dir, c, report: cloudReport(c, ARTIFACT) };
}
const validate = (dir, c) => validateCandidate(dir, c, { headConfig: CONFIG, beforeConfig: CONFIG });

test('cloud run binds repository/workflow/run/attempt/PR/head and dispatch master', () => {
  validateRun(RUN, WORKFLOW, CONTEXT);
  validateRun({ ...RUN, event: 'workflow_dispatch', head_branch: 'master', head_sha: BASE }, WORKFLOW, CONTEXT);
  const cases = [
    { id: 1 }, { run_attempt: 1 }, { workflow_id: 99 }, { path: '.github/workflows/evil.yml' },
    { repository: { full_name: 'untrusted/repo' } }, { head_repository: { full_name: 'matthidinger/other' } },
    { event: 'push' }, { status: 'in_progress' }, { conclusion: 'failure' }, { conclusion: 'cancelled' },
    { head_sha: OTHER }, { display_title: runTitle(PR + 1, SHA) }, { display_title: runTitle(PR, OTHER) },
    { event: 'workflow_dispatch', head_branch: 'feature' },
  ];
  for (const over of cases) assert.throws(() => validateRun({ ...RUN, ...over }, WORKFLOW, CONTEXT), undefined, JSON.stringify(over));
  assert.throws(() => validateRun(RUN, WORKFLOW, { ...CONTEXT, toolingSha: 'master' }), /full commit/);
  assert.throws(() => validateRun(RUN, { ...WORKFLOW, path: 'bad' }, CONTEXT), /workflow/);
});

test('live association rejects stale/closed/wrong base and same-owner cross-repository PRs', () => {
  validatePull(PULL, PR, SHA);
  for (const over of [
    { number: PR + 1 }, { state: 'closed' }, { head: { sha: OTHER, repo: { full_name: REPO_NWO } } },
    { base: { ...PULL.base, ref: 'other' } }, { base: { ...PULL.base, repo: { full_name: 'x/y' } } },
    { head: { sha: SHA, repo: { full_name: 'matthidinger/another-repo' } } },
  ]) assert.throws(() => validatePull({ ...PULL, ...over }, PR, SHA));
  const fork = { ...PULL, head: { sha: SHA, repo: { full_name: 'contributor/fork' } } };
  validatePull(fork, PR, SHA, { allowFork: true });
  assert.throws(() => validatePull(fork, PR, SHA), /fork publishing/);
});

test('only one exact nonexpired API-associated artifact with a digest is accepted', () => {
  assert.equal(selectArtifact([ARTIFACT], RUN), ARTIFACT);
  for (const artifacts of [[], [ARTIFACT, ARTIFACT], [{ ...ARTIFACT, expired: true }],
    [{ ...ARTIFACT, name: candidateName(42, 1) }], [{ ...ARTIFACT, digest: null }],
    [{ ...ARTIFACT, workflow_run: { id: 1, head_sha: SHA } }],
    [{ ...ARTIFACT, workflow_run: { id: 42, head_sha: BASE } }],
    [{ ...ARTIFACT, size_in_bytes: 300 * 1024 * 1024 }]]) assert.throws(() => selectArtifact(artifacts, RUN));
});

test('paths reject traversal, encodings, Windows names, duplicate separators and source leakage', () => {
  for (const rel of ['../x', '/x', 'x/../y', 'x//y', 'x\\y', 'C:/x', 'x%2fy', 'x?query', 'x#hash', 'x\0y', 'x.', 'x ', 'CON', 'x/nul.txt'])
    assert.throws(() => safePath(rel), undefined, rel);
  for (const rel of ['.git/config', '.github/workflows/a.yml', '.env', 'assets/.env', 'AGENTS.md', '_config.yml',
    'Gemfile.lock', 'package.json', 'package-lock.json', 'assets/source.ts', 'tools/run.ps1', 'node_modules/a.js', RECEIPT_FILE])
    assert.throws(() => sitePath(rel), undefined, rel);
  for (const rel of ['CNAME', 'index.html', 'assets/css/main.css', 'archive/2011/a-post/index.html', 'images/Boat 1.png', 'assets/models/boat.glb'])
    assert.equal(sitePath(rel), rel);
  for (const rel of ['assets/models/boat.gltf', 'assets/models/boat.bin', 'assets/models/boat.blend'])
    assert.throws(() => sitePath(rel), /unsupported public asset type/, rel);
});

test('candidate admits the existing public Font Awesome assets, not arbitrary stylesheet sources', (t) => {
  const { dir, c } = fixture(t);
  const vendor = new URL('../../../font-awesome/', import.meta.url);
  const assets = [...fs.readdirSync(new URL('less/', vendor)).filter((name) => name.endsWith('.less')).map((name) => `less/${name}`),
    'scss/font-awesome.scss'];
  assert.equal(assets.length, 14);
  for (const asset of assets) {
    const rel = 'font-awesome/' + asset;
    assert.equal(sitePath(rel), rel);
    const target = path.join(dir, 'site', rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(new URL(asset, vendor), target);
  }
  c.files = manifest(path.join(dir, 'site'));
  assert.equal(validate(dir, c), c);
  for (const rel of ['assets/custom.less', 'font-awesome/less/private.less', 'font-awesome/scss/_variables.scss',
    'font-awesome/scss/private.scss', 'nested/font-awesome/less/core.less', 'font-awesome/less/core.less.map'])
    assert.throws(() => sitePath(rel), undefined, rel);
});

test('complete candidate validates exact committed expectations, strict gate, baseline and screenshots', (t) => {
  const { dir, c } = fixture(t);
  assert.equal(validate(dir, c), c);
  const cases = [
    (x) => { x.report.sha = BASE; }, (x) => { x.report.role = 'deliverable'; },
    (x) => { x.report.deliverable = true; }, (x) => { x.report.builder = 'nas-pages-build'; },
    (x) => { x.report.strictOverflow = false; }, (x) => { x.report.passed = false; },
    (x) => { x.report.results.pop(); }, (x) => { x.report.results.push(x.report.results[0]); },
    (x) => { x.report.results[0].assertions = []; }, (x) => { x.report.results[0].assertions[0].ok = false; },
    (x) => { x.report.results[0].interactions = []; }, (x) => { x.report.results[0].interactions[0].ok = false; },
    (x) => { x.report.results[0].screenshot.file = '../escape.png'; },
    (x) => { x.report.results[0].screenshot.sha256 = 'f'.repeat(64); },
    (x) => { x.report.results[0].captureOnly = true; }, (x) => { x.baselineReport.sha = SHA; },
    (x) => { x.baselineReport.results[0].passed = false; }, (x) => { x.config.routes = []; },
    (x) => { x.baselineConfig.routes[0].title = 'changed'; }, (x) => { x.report.prefix = '/wrong'; },
    (x) => { x.files['index.html'] = 'e'.repeat(64); }, (x) => { delete x.files.CNAME; },
  ];
  for (const change of cases) {
    const copy = structuredClone(c);
    change(copy);
    assert.throws(() => validate(dir, copy), undefined, change.toString());
  }
});

test('candidate rejects extra files and tampered screenshots', (t) => {
  const { dir, c } = fixture(t);
  fs.writeFileSync(path.join(dir, 'source.txt'), 'not public output');
  assert.throws(() => validate(dir, c), /unexpected/);
  fs.unlinkSync(path.join(dir, 'source.txt'));
  fs.writeFileSync(path.join(dir, 'evidence/after/home-desktop.png'), 'tampered');
  assert.throws(() => validate(dir, c), /screenshot hash/);
});

test('config rejects filesystem-like IDs, external routes and invalid viewport sizes', () => {
  validateConfig(CONFIG);
  for (const mutate of [
    (c) => { c.routes[0].id = '../../x'; }, (c) => { c.routes[0].path = '//other'; },
    (c) => { c.routes[0].path = '/a/../escape/'; }, (c) => { c.routes.push(c.routes[0]); },
    (c) => { c.viewports[0].width = 100000; }, (c) => { c.viewports[0].name = '../x'; },
    (c) => { c.routes[0].interactions[0].expectPath = 'https://other/'; },
  ]) { const c = structuredClone(CONFIG); mutate(c); assert.throws(() => validateConfig(c)); }
});

test('cloud receipts are schema 2 and bind the exact workflow run/attempt/artifact; NAS stays schema 1', (t) => {
  const { c, report } = fixture(t);
  const receipt = buildReceipt(report, c.files);
  assert.equal(receipt.schemaVersion, 2);
  assert.equal(receipt.provenance.runId, 42);
  assert.equal(receipt.provenance.runAttempt, 2);
  assert.equal(receipt.provenance.artifactId, 444);
  const expected = { pr: PR, sha: SHA, builder: CLOUD_BUILDER, expected: c.files, provenance: report.provenance };
  assert.deepEqual(receiptErrors(receipt, expected), []);
  assert.match(receiptErrors({ ...receipt, provenance: { ...receipt.provenance, runAttempt: 1 } }, expected).join(), /provenance/);
  assert.match(receiptErrors(receipt, { ...expected, provenance: undefined }).join(), /schemaVersion|unexpected cloud/);
  assert.equal(buildReceipt({ ...report, provenance: undefined }, c.files).schemaVersion, 1);
});

test('deployment refers to PR head, not master; cannot merge, deploy production or inactivate another PR', (t) => {
  const { report } = fixture(t);
  const deployment = previewDeployment(report, 77);
  assert.equal(deployment.ref, SHA);
  assert.notEqual(deployment.ref, BASE);
  assert.equal(deployment.auto_merge, false);
  assert.equal(deployment.production_environment, false);
  assert.deepEqual(deployment.required_contexts, []);
  assert.equal(deployment.environment, `website-preview-pr-${PR}`);
  assert.equal(deployment.payload.publication_run_id, 77);
  const status = previewSuccess(report, 77);
  assert.equal(status.environment_url, CLOUD_ORIGIN + previewPrefix(PR, SHA) + '/');
  assert.equal(status.auto_inactive, false);
  assert.notEqual(previewDeployment({ ...report, pr: PR + 1, prefix: previewPrefix(PR + 1, SHA) }, 78).environment, deployment.environment);
  assert.throws(() => previewSuccess({ ...report, prefix: '/production' }, 77), /prefix/);
});

test('NAS cloud proof requires successful trusted publication and matching hosted provenance/navigation', (t) => {
  const { report } = fixture(t);
  const check = { name: 'preview-verified', app: { slug: 'github-actions' }, head_sha: SHA,
    status: 'completed', conclusion: 'success', details_url: `https://github.com/${REPO_NWO}/actions/runs/77`,
    output: { summary: `[hosted checks](https://github.com/${REPO_NWO}/actions/runs/77)` } };
  const publication = { ...RUN, id: 77, path: '.github/workflows/publish-preview.yml', head_branch: 'master', head_sha: BASE, event: 'workflow_run' };
  validatePublication(publication, check, report);
  for (const over of [{ head_branch: 'feature' }, { status: 'in_progress' }, { conclusion: 'failure' },
    { path: '.github/workflows/other.yml' }, { repository: { full_name: 'other/repo' } }])
    assert.throws(() => validatePublication({ ...publication, ...over }, check, report));
  assert.throws(() => validatePublication(publication, { ...check, head_sha: BASE }, report));
  assert.throws(() => validatePublication(publication, { ...check, app: { slug: 'someone' } }, report));
  const hosted = { ...report, publicationRunId: 77, origin: CLOUD_ORIGIN, backend: 'azure-receipt', verification: { status: 'pass' } };
  validateHostedProof(hosted, report, 77);
  assert.throws(() => validateHostedProof({ ...hosted, publicationRunId: 1 }, report, 77));
  assert.throws(() => validateHostedProof({ ...hosted, provenance: { ...report.provenance, runId: 1 } }, report, 77));
  assert.throws(() => validateHostedProof({ ...hosted, results: hosted.results.slice(0, 1) }, report, 77));
  assert.throws(() => validateHostedProof({ ...hosted, sha: BASE }, report, 77));
});

const NORMALIZED_CHECK = {
  name: 'preview-verified', app: { slug: 'github-actions' }, status: 'completed', conclusion: 'success',
  head_sha: 'ee64fdfe409ecde246e6bf968215f47dd51f107f',
  details_url: 'https://github.com/matthidinger/matthidinger.github.io/runs/116081955394',
  html_url: 'https://github.com/matthidinger/matthidinger.github.io/runs/116081955394',
  output: {
    summary: 'Preview for `ee64fdfe409ecde246e6bf968215f47dd51f107f`: [View deployment](https://matthidingerpreviews.z5.web.core.windows.net/matthidinger.github.io/pr-12/ee64fdfe409ecde246e6bf968215f47dd51f107f/) ([cloud build and screenshots](https://github.com/matthidinger/matthidinger.github.io/actions/runs/38629725020), [hosted checks](https://github.com/matthidinger/matthidinger.github.io/actions/runs/38630387536)); exact bytes and page interactions passed, visual review is pending.',
  },
};

test('NAS consumer accepts the real GitHub-normalized check URLs without mistaking the job or build ID for publication', () => {
  const publication = { ...RUN, id: 38630387536, path: '.github/workflows/publish-preview.yml',
    head_branch: 'master', head_sha: BASE, event: 'workflow_run' };
  assert.equal(publicationRunId(NORMALIZED_CHECK, NORMALIZED_CHECK.head_sha), publication.id);
  validatePublication(publication, NORMALIZED_CHECK, { sha: NORMALIZED_CHECK.head_sha });
  for (const id of [116081955394, 38629725020])
    assert.throws(() => validatePublication({ ...publication, id }, NORMALIZED_CHECK, { sha: NORMALIZED_CHECK.head_sha }), /run mismatch/);
});

test('publication resolver rejects untrusted checks and missing, ambiguous or noncanonical publication links', () => {
  const url = `https://github.com/${REPO_NWO}/actions/runs/38630387536`;
  for (const over of [{ name: 'other-check' }, { app: { slug: 'someone' } }, { head_sha: OTHER },
    { status: 'in_progress' }, { conclusion: 'failure' }])
    assert.throws(() => publicationRunId({ ...NORMALIZED_CHECK, ...over }, NORMALIZED_CHECK.head_sha), /check has not succeeded/);
  assert.throws(() => publicationRunId(undefined, NORMALIZED_CHECK.head_sha), /check has not succeeded/);
  const summaries = [
    undefined, 42, '', `[cloud build and screenshots](${url})`,
    `[hosted checks](${url}) [hosted checks](${url})`,
    `[hosted checks](${url}) [hosted checks](${url.replace('38630387536', '77')})`,
    `[hosted checks](${url}) [hosted checks]`,
    `![hosted checks](${url})`, `\\[hosted checks](${url})`,
    ...[
      url.replace('https:', 'http:'), url.replace('github.com', 'github.com.evil.invalid'),
      url.replace(REPO_NWO, 'other/repo'), url.replace('github.com/', 'user@github.com/'),
      url.replace('/actions/runs/', '/runs/'), `${url}?extra=1`, `${url}#fragment`, `${url}/`,
      url.replace('38630387536', '0'), url.replace('38630387536', '9007199254740992'),
    ].map((target) => `[hosted checks](${target})`),
  ];
  for (const summary of summaries)
    assert.throws(() => publicationRunId({ ...NORMALIZED_CHECK, output: { summary } }, NORMALIZED_CHECK.head_sha), undefined, String(summary));
});

function memoryStore(initial = {}) {
  const blobs = new Map(Object.entries(initial));
  const writes = [];
  return { blobs, writes,
    list: async (prefix) => [...blobs.keys()].filter((n) => n.startsWith(prefix)),
    read: async (name) => blobs.get(name),
    create: async (name, bytes, type) => {
      assert.ok(!blobs.has(name), 'must be create-only');
      blobs.set(name, Buffer.from(bytes)); writes.push({ name, type });
    },
  };
}

function memoryFetch(store) {
  return async (url, options) => {
    assert.equal(new URL(url).origin, CLOUD_ORIGIN);
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'manual');
    let name = decodeURIComponent(new URL(url).pathname.slice(1));
    if (name.endsWith('/')) name += 'index.html';
    return new Response(store.blobs.get(name), {
      status: store.blobs.has(name) ? 200 : 404,
      headers: { 'Content-Type': contentType(name) },
    });
  };
}

test('public verification failures leave the revision receipt absent despite successful blob uploads', async (t) => {
  const { dir, c, report } = fixture(t);
  for (const failure of ['bytes', 'missing', 'type', 'missing-type', 'route', 'denied', 'unreachable', 'redirect']) {
    const store = memoryStore();
    const fetchImpl = async (url, options) => {
      const response = await memoryFetch(store)(url, options);
      if (failure === 'route' && url.endsWith('/')) return new Response('wrong route', { headers: response.headers });
      if (!url.endsWith('/index.html')) return response;
      if (failure === 'bytes') return new Response('changed', { headers: response.headers });
      if (failure === 'missing') return new Response(null, { status: 404 });
      if (failure === 'denied') return new Response(null, { status: 403 });
      if (failure === 'unreachable') throw new TypeError('network unavailable');
      if (failure === 'redirect') return new Response(null, { status: 302, headers: { Location: 'https://other.invalid' } });
      if (failure === 'type') response.headers.set('Content-Type', 'text/plain');
      if (failure === 'missing-type') response.headers.delete('Content-Type');
      return response;
    };
    const error = await publishImmutable({ dir, report, files: c.files, store, fetchImpl, assertFresh: async () => {} })
      .then(() => null, (e) => e);
    assert.equal(store.blobs.has(report.prefix.slice(1) + '/' + RECEIPT_FILE), false, `receipt committed before rejecting ${failure}`);
    assert.match(error?.message || '', /before receipt/);
    assert.equal(error.blocked, ['denied', 'unreachable'].includes(failure));
    assert.equal(store.writes.length, Object.keys(c.files).length, 'test must reach public verification after the uploads');
    await publishImmutable({ dir, report, files: c.files, store, fetchImpl: memoryFetch(store), assertFresh: async () => {} });
    assert.ok(store.blobs.has(report.prefix.slice(1) + '/' + RECEIPT_FILE), 'an identical retry can commit after public verification succeeds');
    assert.equal(store.writes.length, Object.keys(c.files).length + 1, 'retry must not overwrite any uploaded file');
  }
});

test('immutable publishing writes receipt last, correct MIME types, exact bytes and is idempotent', async (t) => {
  const { dir, c, report } = fixture(t);
  const store = memoryStore();
  let fresh = 0;
  let first = true;
  const requests = [];
  const fetchImpl = async (url, options) => {
    if (first) assert.ok(!store.blobs.has(report.prefix.slice(1) + '/' + RECEIPT_FILE), 'public files must be verified before the receipt');
    requests.push(url);
    return memoryFetch(store)(url, options);
  };
  const args = { dir, report, files: c.files, store, fetchImpl, assertFresh: async () => { fresh++; } };
  await publishImmutable(args);
  first = false;
  assert.equal(fresh, 2);
  assert.equal(new Set(requests).size, Object.keys(c.files).length + 1, 'every file and the slash route must be checked');
  assert.ok(store.writes.at(-1).name.endsWith('/' + RECEIPT_FILE));
  assert.equal(store.writes.find((x) => x.name.endsWith('/index.html')).type, 'text/html; charset=utf-8');
  assert.equal(contentType('x.css'), 'text/css; charset=utf-8');
  assert.equal(contentType('x.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentType('x.glb'), 'model/gltf-binary');
  const count = store.writes.length;
  await publishImmutable(args);
  assert.equal(store.writes.length, count);
  assert.equal((await verifyCloud(report, c.files, fetchImpl)).status, 'pass');
  assert.equal((await verifyCloud(report, c.files, async (url, options) => {
    const response = await fetchImpl(url, options);
    if (url.endsWith('/index.html')) response.headers.set('Content-Type', 'text/plain');
    return response;
  })).status, 'fail', 'post-receipt verification must also reject incorrect media types');
  store.blobs.set(report.prefix.slice(1) + '/index.html', Buffer.from('wrong bytes'));
  assert.equal((await verifyCloud(report, c.files, fetchImpl)).status, 'fail');
});

test('immutable upload rejects extra/mismatched/incomplete committed revisions before writing', async (t) => {
  const { dir, c, report } = fixture(t);
  const p = report.prefix.slice(1) + '/';
  for (const initial of [
    { [p + 'extra.txt']: Buffer.from('extra') },
    { [p + 'index.html']: Buffer.from('different') },
    { [p + RECEIPT_FILE]: receiptBytes(buildReceipt(report, c.files)) },
    { [p + RECEIPT_FILE]: receiptBytes(buildReceipt({ ...report, provenance: { ...report.provenance, runId: 1 } }, c.files)) },
  ]) {
    const store = memoryStore(initial);
    await assert.rejects(publishImmutable({ dir, report, files: c.files, store, fetchImpl: memoryFetch(store), assertFresh: async () => {} }), /immutable/);
    assert.equal(store.writes.length, 0);
  }
});

test('interrupted identical upload resumes, but head changes never receive a receipt', async (t) => {
  const { dir, c, report } = fixture(t);
  const p = report.prefix.slice(1) + '/';
  const store = memoryStore({ [p + 'index.html']: fs.readFileSync(path.join(dir, 'site/index.html')) });
  let fresh = 0;
  await assert.rejects(publishImmutable({ dir, report, files: c.files, store, fetchImpl: memoryFetch(store), assertFresh: async () => {
    if (++fresh === 2) throw new Error('head changed');
  } }), /head changed/);
  assert.ok(!store.blobs.has(p + RECEIPT_FILE));
  await publishImmutable({ dir, report, files: c.files, store, fetchImpl: memoryFetch(store), assertFresh: async () => {} });
  assert.ok(store.blobs.has(p + RECEIPT_FILE));
});

test('Azure denial/network failure surfaces; no receipt or fabricated success', async (t) => {
  const { dir, c, report } = fixture(t);
  const store = memoryStore();
  store.create = async () => { throw new Error('403'); };
  await assert.rejects(publishImmutable({ dir, report, files: c.files, store, fetchImpl: memoryFetch(store), assertFresh: async () => {} }), /403/);
  assert.equal(store.writes.length, 0);
  assert.equal((await verifyCloud(report, c.files, async () => new Response('', { status: 403 }))).status, 'blocked');
});

test('same-SHA reruns reuse the original proven candidate, never overwrite site.time or provenance', async (t) => {
  const original = fixture(t);
  const current = fixture(t);
  fs.writeFileSync(path.join(current.dir, 'site/index.html'), '<h1>New build time</h1>');
  current.c.files = manifest(path.join(current.dir, 'site'));
  current.c.context.runId = 43;
  current.report = cloudReport(current.c, { ...ARTIFACT, id: 445 });
  const receipt = buildReceipt(original.report, original.c.files);
  let loaded;
  const selected = await chooseImmutableCandidate({ ...current, candidate: current.c }, {
    fetchImpl: async () => new Response(receiptBytes(receipt)),
    loadPrevious: async (runId, attempt) => {
      loaded = [runId, attempt];
      return { ...original, candidate: original.c };
    },
  });
  assert.deepEqual(loaded, [42, 2]);
  assert.equal(selected.report.provenance.runId, 42);
  assert.equal(selected.candidate.files['index.html'], original.c.files['index.html']);
  assert.equal(selected.reused, true);
  const store = memoryStore();
  await publishImmutable({ dir: original.dir, report: original.report, files: original.c.files, store, fetchImpl: memoryFetch(store), assertFresh: async () => {} });
  const count = store.writes.length;
  await publishImmutable({ dir: selected.dir, report: selected.report, files: selected.candidate.files, store, fetchImpl: memoryFetch(store), assertFresh: async () => {} });
  assert.equal(store.writes.length, count);
});

test('immutable reuse refuses unproven/expired evidence, wrong receipts, denied access and redirects', async (t) => {
  const current = fixture(t);
  const value = { ...current, candidate: current.c };
  const original = buildReceipt({ ...current.report, provenance: { ...current.report.provenance, runId: 1 } }, current.c.files);
  const failLoad = async () => { throw new Error('artifact expired'); };
  await assert.rejects(chooseImmutableCandidate(value, {
    fetchImpl: async () => new Response(receiptBytes(original)), loadPrevious: failLoad,
  }), /artifact expired/);
  await assert.rejects(chooseImmutableCandidate(value, {
    fetchImpl: async () => new Response(receiptBytes({ ...original, pr: 999 })), loadPrevious: failLoad,
  }), /conflicting immutable/);
  await assert.rejects(chooseImmutableCandidate(value, {
    fetchImpl: async () => new Response(receiptBytes(original)), loadPrevious: async () => value,
  }), /original accepted artifact/);
  for (const status of [301, 403, 500]) await assert.rejects(chooseImmutableCandidate(value, {
    fetchImpl: async () => new Response(null, { status }), loadPrevious: failLoad,
  }), /cannot be read/);
  assert.equal(await chooseImmutableCandidate(value, { fetchImpl: async () => new Response(null, { status: 404 }) }), value);
});

test('reconciler dispatches missing or approval-required same-repository heads, once, never forks', () => {
  assert.equal(shouldDispatch(PULL, [], []), true);
  assert.equal(shouldDispatch(PULL, [{ ...RUN, status: 'completed', conclusion: 'action_required' }], []), true);
  assert.equal(shouldDispatch(PULL, [{ ...RUN, status: 'waiting', conclusion: null }], []), true);
  assert.equal(shouldDispatch(PULL, [{ ...RUN, status: 'queued' }], []), false);
  assert.equal(shouldDispatch(PULL, [{ ...RUN, event: 'workflow_dispatch', head_branch: 'master', conclusion: 'failure' }], []), false);
  assert.equal(shouldDispatch(PULL, [{ ...RUN, display_title: runTitle(PR, OTHER), event: 'workflow_dispatch', head_branch: 'master' }], []), true);
  assert.equal(shouldDispatch(PULL, [], [{ name: 'preview-verified', head_sha: SHA, app: { slug: 'github-actions' }, conclusion: 'success' }]), false);
  assert.equal(shouldDispatch({ ...PULL, state: 'closed' }, [], []), false);
  assert.equal(shouldDispatch({ ...PULL, head: { ...PULL.head, repo: { full_name: 'someone/fork' } } }, [], []), false);
});

test('GitHub pagination handles more than one page and fails malformed responses', async () => {
  const calls = [];
  const rows = await pages('/actions/runs?event=workflow_dispatch', 'workflow_runs', async (url) => {
    calls.push(url);
    return { workflow_runs: calls.length === 1 ? Array.from({ length: 100 }, (_, n) => n) : [100] };
  });
  assert.equal(rows.length, 101);
  assert.ok(calls[1].endsWith('&per_page=100&page=2'));
  await assert.rejects(pages('/x', 'x', async () => ({})), /pagination/);
});

// Minimal stored ZIP writer for hostile-input tests (no production ZIP-writing dependency).
function zip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const { name, body = 'x', mode = 0o100644, declaredSize, method = 0, flags = 0 } of entries) {
    const n = Buffer.from(name), b = Buffer.from(body);
    let crc = 0xffffffff;
    for (const byte of b) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt16LE(flags, 6); l.writeUInt16LE(method, 8); l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(b.length, 18); l.writeUInt32LE(declaredSize ?? b.length, 22); l.writeUInt16LE(n.length, 26);
    local.push(l, n, b);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(0x314, 4); c.writeUInt16LE(20, 6);
    c.writeUInt16LE(flags, 8); c.writeUInt16LE(method, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(b.length, 20); c.writeUInt32LE(declaredSize ?? b.length, 24);
    c.writeUInt16LE(n.length, 28); c.writeUInt32LE((mode << 16) >>> 0, 38); c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += l.length + n.length + b.length;
  }
  const c = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(c.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, c, end]);
}

test('ZIP extraction only admits bounded data files and rejects links, traversal, executable/source paths and duplicates', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-zip-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cases = [
    [{ name: 'site/index.html' }, { name: 'candidate.json', body: '{}' }],
    [{ name: '../outside.txt' }], [{ name: 'site/../../outside' }], [{ name: '/absolute' }],
    [{ name: 'site/link', mode: 0o120777 }], [{ name: 'site/pipe', mode: 0o010644 }],
    [{ name: 'site/a\\b' }], [{ name: 'site/a%2fb' }], [{ name: 'site/.env' }],
    [{ name: 'site/node_modules/a.js' }], [{ name: 'site/_config.yml' }],
    [{ name: 'run.mjs' }], [{ name: 'site/a.txt' }, { name: 'site/a.txt' }],
    [{ name: 'site/Index.html' }, { name: 'site/index.html' }],
  ];
  for (let i = 0; i < cases.length; i++) {
    const file = path.join(root, `${i}.zip`), dest = path.join(root, `${i}`);
    fs.writeFileSync(file, zip(cases[i]));
    if (i === 0) {
      await extractCandidate(file, dest);
      assert.deepEqual(readJson(path.join(dest, 'candidate.json')), {});
    } else await assert.rejects(extractCandidate(file, dest), undefined, JSON.stringify(cases[i]));
  }
  assert.ok(!fs.existsSync(path.join(root, 'outside.txt')));
});

test('ZIP bounds and encryption are refused before any oversized/decrypted payload is written', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-zip-bounds-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [label, entry, error] of [
    ['large', { name: 'site/index.html', declaredSize: 65 * 1024 * 1024, method: 8 }, /expanded artifact too large/],
    ['encrypted', { name: 'site/index.html', flags: 1, method: 8 }, /encrypted artifact/],
  ]) {
    const file = path.join(root, label + '.zip'), destination = path.join(root, label);
    fs.writeFileSync(file, zip([entry]));
    await assert.rejects(extractCandidate(file, destination), error);
    assert.ok(!fs.existsSync(path.join(destination, 'site', 'index.html')));
  }
});
