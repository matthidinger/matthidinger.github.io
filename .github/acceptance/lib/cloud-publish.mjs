import fs from 'node:fs';
import path from 'node:path';
import { buildReceipt, receiptBytes, receiptErrors, RECEIPT_FILE, verifyHostedReceipt } from './hosting.mjs';
import { CLOUD_ACCOUNT, CLOUD_ORIGIN, ensure, positiveInt, sitePath } from './cloud.mjs';
import { sha256, sh } from './util.mjs';

const BLOB_ORIGIN = `https://${CLOUD_ACCOUNT}.blob.core.windows.net`;
export const contentType = (rel) => ({
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.otf': 'font/otf', '.pdf': 'application/pdf',
}[path.extname(rel).toLowerCase()] || 'application/octet-stream');

export function azureStore() {
  // Only data-plane scope. Never query account keys, account configuration or resource metadata.
  const token = JSON.parse(sh('az', ['account', 'get-access-token', '--resource', 'https://storage.azure.com/', '--output', 'json'])).accessToken;
  ensure(typeof token === 'string' && token.length > 0, 'Azure storage token unavailable');
  const url = (name) => `${BLOB_ORIGIN}/$web/${name.split('/').map(encodeURIComponent).join('/')}`;
  const request = async (name, method, body, headers = {}) => {
    const res = await fetch(url(name), { method, body, redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${token}`, 'x-ms-version': '2023-11-03', 'x-ms-date': new Date().toUTCString(), ...headers } });
    ensure(res.ok, `preview blob ${method} failed (${res.status}); no overwrite or access fallback attempted`);
    return res;
  };
  return {
    list: async (prefix) => JSON.parse(sh('az', ['storage', 'blob', 'list', '--account-name', CLOUD_ACCOUNT,
      '--container-name', '$web', '--auth-mode', 'login', '--prefix', prefix, '--num-results', '*', '--only-show-errors', '--output', 'json'])).map((b) => b.name),
    read: async (name) => Buffer.from(await (await request(name, 'GET')).arrayBuffer()),
    create: async (name, body, type) => request(name, 'PUT', body, {
      'If-None-Match': '*', 'x-ms-blob-type': 'BlockBlob', 'Content-Type': type,
      'x-ms-blob-content-type': type, 'x-ms-blob-cache-control': 'public, max-age=31536000, immutable',
    }),
  };
}

export async function publishImmutable({ dir, report, files, store, assertFresh }) {
  const prefix = report.prefix.slice(1) + '/';
  Object.keys(files).forEach(sitePath);
  const receipt = receiptBytes(buildReceipt(report, files));
  const expected = { ...files, [RECEIPT_FILE]: sha256(receipt) };
  const existing = await store.list(prefix);
  ensure(new Set(existing).size === existing.length, 'duplicate existing preview blobs');
  // Validate the entire old prefix before writing anything. Interrupted identical uploads may resume;
  // a receipt commits the complete revision and may never mask missing or extra blobs.
  for (const name of existing) {
    ensure(name.startsWith(prefix) && Object.hasOwn(expected, name.slice(prefix.length)), 'conflicting immutable preview contains unexpected files');
    ensure(sha256(await store.read(name)) === expected[name.slice(prefix.length)], 'conflicting immutable preview bytes/receipt');
  }
  if (existing.includes(prefix + RECEIPT_FILE)) ensure(existing.length === Object.keys(expected).length, 'committed immutable preview is incomplete');
  await assertFresh();
  const present = new Set(existing);
  const pending = Object.keys(files).filter((rel) => !present.has(prefix + rel));
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, pending.length) }, async () => {
    while (next < pending.length) {
      const rel = pending[next++];
      const bytes = fs.readFileSync(path.join(dir, 'site', rel));
      ensure(sha256(bytes) === files[rel], 'preview file changed before upload');
      await store.create(prefix + rel, bytes, contentType(rel));
    }
  }));
  await assertFresh();
  if (!present.has(prefix + RECEIPT_FILE)) await store.create(prefix + RECEIPT_FILE, receipt, 'application/json; charset=utf-8');
}

export async function verifyCloud(report, files, fetchImpl = fetch) {
  return verifyHostedReceipt({
    origin: CLOUD_ORIGIN, prefix: report.prefix, pr: report.pr, sha: report.sha,
    builder: report.builder, provenance: report.provenance, expected: files,
    paths: report.results.map((r) => r.path), fetchImpl,
  });
}

// Same code can build different bytes (for example site.time). Keep the first accepted revision:
// reuse only after reloading its exact successful run attempt and digest-verified artifact. A receipt
// alone is never proof, and expired/missing original evidence blocks reuse rather than overwriting it.
export async function chooseImmutableCandidate(current, { loadPrevious, fetchImpl = fetch }) {
  const res = await fetchImpl(CLOUD_ORIGIN + current.report.prefix + '/' + RECEIPT_FILE, {
    redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) return current;
  ensure(res.status === 200, `BLOCKED: existing preview receipt cannot be read (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  ensure(bytes.length <= 4 * 1024 * 1024, 'existing receipt too large');
  const receipt = JSON.parse(bytes.toString('utf8'));
  const checks = (candidate) => ({
    pr: candidate.report.pr, sha: candidate.report.sha, builder: candidate.report.builder,
    provenance: candidate.report.provenance, expected: candidate.candidate.files,
  });
  if (!receiptErrors(receipt, checks(current)).length) return current;
  ensure(receipt.schemaVersion === 2 && receipt.repository === current.candidate.context.repository
    && receipt.pr === current.report.pr && receipt.sha === current.report.sha
    && receipt.provenance?.kind === 'github-actions', 'conflicting immutable preview receipt');
  const previous = await loadPrevious(positiveInt(receipt.provenance.runId), positiveInt(receipt.provenance.runAttempt));
  ensure(previous.report.pr === current.report.pr && previous.report.sha === current.report.sha, 'existing preview evidence belongs to another PR/head');
  ensure(!receiptErrors(receipt, checks(previous)).length, 'existing receipt does not match its original accepted artifact');
  return { ...previous, reused: true };
}
