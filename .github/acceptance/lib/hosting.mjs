// Preview hosting backends (preview.json) and the revision receipt that binds a hosted preview to
// one accepted build. Pure helpers are unit-tested; network checks take an injectable fetch.
import path from 'node:path';
import { ACCEPTANCE_DIR, REPO_NWO, isFullSha, readJson, sha256 } from './util.mjs';

export const RECEIPT_FILE = 'preview-revision.json';
export const RECEIPT_SCHEMA = 1;
export const PREVIEW_TIMEOUT_MS = 15000;
export const FETCH_CONCURRENCY = 8;

export function loadPreviewConfig(file = path.join(ACCEPTANCE_DIR, 'preview.json')) {
  return readJson(file);
}

// A preview base must be a bare HTTPS origin (no credentials, path, query or fragment).
export function previewOrigin(base, name = 'COPILOT_PREVIEW_BASE_URL') {
  let u;
  try { u = new URL(base); } catch { throw new Error(`${name} is not a valid URL`); }
  if (u.protocol !== 'https:') throw new Error(`${name} must use https`);
  if (u.username || u.password || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash || base.includes('?') || base.includes('#')) {
    throw new Error(`${name} must be a bare origin (no credentials, path, query or fragment)`);
  }
  return u.origin;
}

export const routeFile = (routePath) => (routePath.endsWith('/') ? routePath + 'index.html' : routePath).replace(/^\/+/, '');

// Selection order: --preview-backend, then COPILOT_PREVIEW_BACKEND, then preview.json defaultBackend.
// Unknown or malformed backends throw; callers turn that into a failing gate, never a silent default.
export function resolveBackend({ flag, env = process.env, config = loadPreviewConfig() } = {}) {
  if (flag === true) throw new Error('--preview-backend requires a backend name');
  const source = flag ? '--preview-backend' : env.COPILOT_PREVIEW_BACKEND ? 'COPILOT_PREVIEW_BACKEND' : 'preview.json defaultBackend';
  const id = flag || env.COPILOT_PREVIEW_BACKEND || config.defaultBackend;
  const def = Object.hasOwn(config.backends || {}, id) ? config.backends[id] : null;
  if (!def) throw new Error(`unknown preview backend "${id}" (from ${source}); expected one of: ${Object.keys(config.backends || {}).join(', ')}`);
  if (def.type === 'receipt') {
    return { id, type: 'receipt', source, origin: previewOrigin(def.origin, `preview backend ${id} origin`), public: def.public === true, configured: true };
  }
  if (def.type === 'header') {
    const base = env[def.originEnv] || '';
    return { id, type: 'header', source, originEnv: def.originEnv, base, public: false, configured: !!base };
  }
  throw new Error(`preview backend "${id}" has unsupported type "${def.type}"`);
}

const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

export function buildReceipt(report, files) {
  return { schemaVersion: RECEIPT_SCHEMA, repository: REPO_NWO, pr: report.pr, sha: report.sha, builder: report.builder, files: sortKeys(files) };
}

export const receiptBytes = (receipt) => Buffer.from(JSON.stringify(receipt, null, 2) + '\n');

// The exported package: the accepted site files plus the receipt at the prefix root.
export function exportManifest(report, files) {
  if (Object.hasOwn(files, RECEIPT_FILE)) throw new Error(`accepted site already contains ${RECEIPT_FILE}; that name is reserved for the revision receipt`);
  return sortKeys({ ...files, [RECEIPT_FILE]: sha256(receiptBytes(buildReceipt(report, files))) });
}

export function diffManifest(expected, actual) {
  const missing = Object.keys(expected).filter((k) => !Object.hasOwn(actual, k));
  const extra = Object.keys(actual).filter((k) => !Object.hasOwn(expected, k));
  const changed = Object.keys(expected).filter((k) => Object.hasOwn(actual, k) && actual[k] !== expected[k]);
  return { missing, extra, changed };
}

export function sameManifest(a, b) {
  if (!a || !b) return false;
  const d = diffManifest(a, b);
  return !d.missing.length && !d.extra.length && !d.changed.length;
}

const few = (xs) => xs.slice(0, 3).join(', ') + (xs.length > 3 ? ', ...' : '');

// Pure receipt validation against the accepted report and manifest.
export function receiptErrors(receipt, { pr, sha, builder, expected }) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return ['receipt is not a JSON object'];
  const e = [];
  const j = JSON.stringify;
  if (receipt.schemaVersion !== RECEIPT_SCHEMA) e.push(`schemaVersion ${j(receipt.schemaVersion)} != ${RECEIPT_SCHEMA}`);
  if (receipt.repository !== REPO_NWO) e.push(`repository ${j(receipt.repository)} != ${REPO_NWO}`);
  if (receipt.pr !== pr) e.push(`pr ${j(receipt.pr)} != ${pr}`);
  if (!isFullSha(receipt.sha)) e.push(`sha ${j(receipt.sha)} is not a full 40-character commit SHA`);
  else if (receipt.sha !== sha) e.push(`sha ${receipt.sha} != ${sha}`);
  if (receipt.builder !== builder) e.push(`builder ${j(receipt.builder)} != ${j(builder)}`);
  const files = receipt.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) e.push('files manifest missing');
  else {
    const d = diffManifest(expected, files);
    if (d.missing.length) e.push(`manifest incomplete: ${d.missing.length} accepted file(s) missing (${few(d.missing)})`);
    if (d.extra.length) e.push(`manifest lists ${d.extra.length} file(s) outside the accepted build (${few(d.extra)})`);
    if (d.changed.length) e.push(`manifest hashes differ for ${d.changed.length} file(s) (${few(d.changed)})`);
  }
  return e;
}

async function fetchExact(fetchImpl, url, timeoutMs) {
  let res;
  try {
    res = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const why = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : `unreachable (${e?.cause?.code || e?.name || 'error'})`;
    return { kind: 'blocked', detail: `${why} from this runtime` };
  }
  const s = res.status;
  if ((s >= 300 && s < 400) || res.type === 'opaqueredirect') return { kind: 'fail', detail: `redirected (${s}); redirects are not followed` };
  if (s === 401 || s === 403 || s === 407) return { kind: 'blocked', detail: `access denied (${s})` };
  if (s === 404) return { kind: 'missing', detail: 'not found (404)' };
  if (s !== 200) return { kind: 'fail', detail: `HTTP ${s}` };
  try {
    return { kind: 'ok', body: Buffer.from(await res.arrayBuffer()) };
  } catch (e) {
    return { kind: 'blocked', detail: `body read failed (${e?.name || 'error'})` };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

const encodePath = (rel) => '/' + rel.split('/').map(encodeURIComponent).join('/');

// Verifies a published receipt-backed preview: the receipt must name this repository, PR, full SHA and
// builder and list exactly the accepted manifest; then every accepted file and route URL is fetched and
// its served bytes hashed. Redirects are never followed and no auth headers are sent. An absent receipt,
// denied access or timeout is an external blocker (awaiting operator publication); anything else wrong fails.
export async function verifyHostedReceipt({ origin, prefix, pr, sha, builder, expected, paths = [], fetchImpl = fetch, timeoutMs = PREVIEW_TIMEOUT_MS, concurrency = FETCH_CONCURRENCY }) {
  if (!expected || !Object.keys(expected).length) return { status: 'fail', detail: 'no accepted preview manifest to verify against' };
  const got = await fetchExact(fetchImpl, origin + prefix + '/' + RECEIPT_FILE, timeoutMs);
  if (got.kind === 'missing') return { status: 'blocked', detail: `receipt ${RECEIPT_FILE} is absent (404): awaiting operator publication of this exact package` };
  if (got.kind === 'blocked') return { status: 'blocked', detail: `receipt ${got.detail}` };
  if (got.kind === 'fail') return { status: 'fail', detail: `receipt ${got.detail}` };
  let receipt;
  try { receipt = JSON.parse(got.body.toString('utf8')); } catch { return { status: 'fail', detail: 'receipt is not valid JSON' }; }
  const errs = receiptErrors(receipt, { pr, sha, builder, expected });
  if (errs.length) return { status: 'fail', detail: `receipt rejected: ${errs.join('; ')}` };

  const targets = Object.keys(expected).map((rel) => ({ label: rel, url: encodePath(rel), want: expected[rel] }));
  const routeFails = [];
  for (const p of [...new Set(paths)]) {
    const want = expected[routeFile(p)];
    if (!want) routeFails.push(`${p}: route not in the accepted preview manifest`);
    else if (p.endsWith('/')) targets.push({ label: p, url: p, want });
  }
  const results = await pool(targets, concurrency, async (t) => {
    const r = await fetchExact(fetchImpl, origin + prefix + t.url, timeoutMs);
    if (r.kind === 'ok') return sha256(r.body) === t.want ? null : { kind: 'fail', msg: `${t.label}: served bytes differ from the accepted build` };
    return { kind: r.kind === 'blocked' ? 'blocked' : 'fail', msg: `${t.label}: ${r.detail}` };
  });
  const fails = [...routeFails, ...results.filter((x) => x?.kind === 'fail').map((x) => x.msg)];
  const blocked = results.filter((x) => x?.kind === 'blocked').map((x) => x.msg);
  if (fails.length) return { status: 'fail', detail: `${fails.length} of ${targets.length + routeFails.length} served URL(s) rejected: ${few(fails)}` };
  if (blocked.length) return { status: 'blocked', detail: `${blocked.length} served URL(s) could not be fetched: ${few(blocked)}` };
  const files = Object.keys(expected).length;
  return { status: 'pass', detail: `receipt matches ${REPO_NWO} PR #${pr} @ ${sha} with the complete ${files}-file accepted manifest; ${files} files and ${targets.length - files} route URLs served with accepted bytes` };
}

// Pure validation of a bin/check-hosted.mjs report against the accepted deliverable report.
export function hostedErrors(hosted, { report, pr, backend, origin }) {
  if (!hosted) return ['no hosted browser report; run bin/check-hosted.mjs after the preview is published'];
  const e = [];
  if (hosted.sha !== report?.sha) e.push(`stale: hosted checks ran for ${hosted.sha}, evidence is for ${report?.sha}`);
  if (hosted.pr !== pr) e.push(`hosted checks ran for PR ${hosted.pr}, not ${pr}`);
  if (hosted.prefix !== report?.prefix) e.push('hosted checks used a different preview prefix');
  if (hosted.backend !== backend?.id) e.push(`hosted checks used backend ${hosted.backend}, readiness uses ${backend?.id}`);
  if (origin && hosted.origin !== origin) e.push('hosted checks ran against a different origin');
  if (hosted.verification?.status !== 'pass') e.push(`hosted checks did not start from a verified preview (${hosted.verification?.status || 'unverified'})`);
  if (!!hosted.strictOverflow !== !!report?.strictOverflow) e.push('hosted overflow gate differs from the accepted run');
  const have = new Set((hosted.results || []).map((x) => `${x.route}|${x.viewport}`));
  const missing = (report?.results || []).map((x) => `${x.route}|${x.viewport}`).filter((k) => !have.has(k));
  if (missing.length) e.push(`hosted checks do not cover ${missing.length} accepted route/viewport(s): ${few(missing.map((k) => k.replace('|', '-')))}`);
  const failed = (hosted.results || []).filter((x) => !x.passed);
  if (failed.length) e.push(`${failed.length} hosted route/viewport check(s) failed: ${few(failed.map((x) => `${x.route}-${x.viewport}: ${(x.failures || [])[0] || 'failed'}`))}`);
  else if (hosted.passed !== true) e.push('hosted report is not marked passed');
  return e;
}
