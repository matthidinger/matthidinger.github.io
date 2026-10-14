// Isolated preview export: only the compiled, prefix-rewritten public site for one PR head commit, plus
// its revision receipt (site/preview-revision.json) so the package maps 1:1 onto the URL prefix.
import fs from 'node:fs';
import path from 'node:path';
import { RECEIPT_FILE, buildReceipt, exportManifest, receiptBytes, sameManifest } from './hosting.mjs';
import { BASE_BRANCH, PREVIEW_SITE_DIR, REPO_NWO, manifest, readJson, sh } from './util.mjs';

const FORBIDDEN = [/^\.git(\/|$)/, /^\.github(\/|$)/, /(^|\/)_config\.yml$/, /(^|\/)Gemfile(\.lock)?$/, /(^|\/)AGENTS\.md$/, /(^|\/)\.env/, /(^|\/)node_modules\//, /(^|\/)\.artifacts\//];

export function prInfo(pr, run = sh) {
  return JSON.parse(run('gh', ['pr', 'view', String(pr), '-R', REPO_NWO, '--json', 'number,state,isDraft,headRefOid,baseRefName,headRepositoryOwner,body,url']));
}

// Pure check of a PR/head association so it can be unit-tested.
export function validateAssociation({ pr, sha, head, info }) {
  const errors = [];
  if (!info) return ['PR not found'];
  if (info.number !== pr) errors.push(`PR number mismatch (${info.number} != ${pr})`);
  if (info.state !== 'OPEN') errors.push(`PR #${pr} is ${info.state}`);
  if (info.baseRefName !== BASE_BRANCH) errors.push(`PR #${pr} targets ${info.baseRefName}, not ${BASE_BRANCH}`);
  if (info.headRepositoryOwner?.login !== REPO_NWO.split('/')[0]) errors.push('PR head is not in this repository');
  if (info.headRefOid !== sha) errors.push(`stale revision: PR head is ${info.headRefOid}, evidence is for ${sha}`);
  if (head !== sha) errors.push(`stale revision: local HEAD is ${head}, evidence is for ${sha}`);
  return errors;
}

// Disk layout: ROOT/matthidinger.github.io/pr-N/FULL_SHA/site/. The URL omits "site" (see previewPrefix).
export function previewTarget(previewRoot, pr, sha) {
  return path.join(previewRoot, PREVIEW_SITE_DIR, `pr-${pr}`, sha, 'site');
}

// The preview reader's URL -> file contract, used to prove exported links resolve. Returns null when
// the URL is outside a revision prefix or would escape it.
export function readerFile(previewRoot, urlPath) {
  const m = /^\/([^/]+)\/pr-(\d+)\/([0-9a-f]{40})(\/.*)?$/.exec(urlPath.split(/[?#]/)[0]);
  if (!m || m[1] !== PREVIEW_SITE_DIR) return null;
  const site = previewTarget(previewRoot, Number(m[2]), m[3]);
  let rest = decodeURIComponent(m[4] || '/');
  if (rest.endsWith('/')) rest += 'index.html';
  const file = path.join(site, rest);
  return file.startsWith(site + path.sep) ? file : null;
}

export function exportPreview({ runDir, previewRoot }) {
  if (!previewRoot) throw Object.assign(new Error('COPILOT_PREVIEW_ROOT is not set; preview export unavailable'), { blocked: true });
  const report = readJson(path.join(runDir, 'report.json'));
  if (!report.deliverable) throw new Error(`refusing to export a ${report.role} run; only clean committed deliverable runs may be published`);
  if (!report.passed) throw new Error('refusing to export a run whose acceptance failed');
  const source = path.join(runDir, 'preview', report.prefix);
  const expected = readJson(path.join(runDir, 'preview-manifest.json'));
  const actual = manifest(source);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('staged preview no longer matches the accepted manifest');
  const bad = Object.keys(actual).filter((rel) => FORBIDDEN.some((re) => re.test(rel)));
  if (bad.length) throw new Error(`non-site files in preview output: ${bad.slice(0, 5).join(', ')}`);
  const packaged = exportManifest(report, expected);

  const target = previewTarget(previewRoot, report.pr, report.sha);
  const revisionDir = path.dirname(target);
  if (fs.existsSync(revisionDir)) {
    const existing = fs.existsSync(target) ? manifest(target) : null;
    if (sameManifest(existing, packaged)) return { target, status: 'already-published', files: Object.keys(expected).length };
    throw new Error('a different preview already exists for this PR/commit; published revisions are immutable');
  }
  const prDir = path.dirname(revisionDir);
  fs.mkdirSync(prDir, { recursive: true });
  const staging = fs.mkdtempSync(path.join(prDir, `.staging-${report.sha.slice(0, 12)}-`));
  try {
    for (const rel of Object.keys(expected)) {
      const dest = path.join(staging, 'site', rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(source, rel), dest);
    }
    fs.writeFileSync(path.join(staging, 'site', RECEIPT_FILE), receiptBytes(buildReceipt(report, expected)));
    if (!sameManifest(manifest(path.join(staging, 'site')), packaged)) throw new Error('copy verification failed');
    fs.renameSync(staging, revisionDir);
  } catch (e) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw e;
  }
  return { target, status: 'published', files: Object.keys(expected).length };
}
