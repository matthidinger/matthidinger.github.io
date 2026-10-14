import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { RECEIPT_FILE, sameManifest } from './hosting.mjs';
import { REPO_NWO, isFullSha, manifest, previewPrefix, sha256File } from './util.mjs';

export const BUILD_WORKFLOW = '.github/workflows/build-preview.yml';
export const CLOUD_BUILDER = 'actions/jekyll-build-pages@44a6e6beabd48582f863aeeb6cb2151cc1716697';
export const CLOUD_ORIGIN = 'https://matthidingerpreviews.z5.web.core.windows.net';
export const CLOUD_ACCOUNT = 'matthidingerpreviews';
export const MAX_ARCHIVE = 256 * 1024 * 1024;
export const MAX_EXPANDED = 768 * 1024 * 1024;
export const candidateName = (runId, attempt) => `preview-candidate-${positiveInt(runId)}-${positiveInt(attempt)}`;
export const runTitle = (pr, sha) => `Preview PR #${positiveInt(pr)} @ ${fullSha(sha)}`;

// These exact vendor stylesheets already ship in the public site. Other source files stay forbidden.
const PUBLIC_VENDOR_STYLES = new Set([
  ...['bordered-pulled', 'core', 'fixed-width', 'font-awesome', 'icons', 'larger', 'list', 'mixins',
    'path', 'rotated-flipped', 'spinning', 'stacked', 'variables'].map((name) => `font-awesome/less/${name}.less`),
  'font-awesome/scss/font-awesome.scss',
]);

export function ensure(ok, message) {
  if (!ok) throw new Error(message);
}

export function positiveInt(value) {
  const n = Number(value);
  ensure(Number.isSafeInteger(n) && n > 0, 'expected a positive integer');
  return n;
}

export function fullSha(value) {
  ensure(isFullSha(value), 'expected a full commit SHA');
  return value;
}

// No decoding/normalization ambiguities across ZIP, Windows, blob names and browser URLs.
export function safePath(rel) {
  ensure(typeof rel === 'string' && rel.length > 0 && rel.length <= 1024, 'invalid artifact path');
  ensure(!/[\\:%?#\x00-\x1f\x7f]/.test(rel), `unsafe artifact path: ${rel}`);
  ensure(rel.split('/').every((p) => p && p !== '.' && p !== '..' && !/[. ]$/.test(p)
    && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(p)), `unsafe artifact path: ${rel}`);
  return rel;
}

export function sitePath(rel) {
  safePath(rel);
  ensure(!rel.split('/').some((part) => part.startsWith('.') || /^(?:AGENTS\.md|CLAUDE\.md|Gemfile(?:\.lock)?|package(?:-lock)?\.json|node_modules|vendor|_config.*|_posts|_layouts|_includes|_sass|_data|src)$/i.test(part)),
    `source/setup file in public site: ${rel}`);
  ensure(!/\.(?:ya?ml|md|markdown|mjs|cjs|ts|tsx|jsx|rb|py|sh|ps1|pem|key|pfx|env|lock|map)$/i.test(rel), `non-site file: ${rel}`);
  ensure(rel === 'CNAME' || PUBLIC_VENDOR_STYLES.has(rel) || /\.(?:html?|css|js|json|xml|txt|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf)$/i.test(rel), `unsupported public asset type: ${rel}`);
  ensure(rel !== RECEIPT_FILE, 'receipt name is reserved');
  return rel;
}

function archivePath(rel, hosted) {
  safePath(rel);
  if (hosted) {
    ensure(rel === 'report.json' || /^evidence\/[a-z0-9-]+\.png$/.test(rel), `unexpected hosted artifact file: ${rel}`);
    return;
  }
  ensure(rel === 'candidate.json' || rel.startsWith('site/') || /^evidence\/(?:before|after)\/[a-z0-9-]+\.png$/.test(rel), `unexpected artifact file: ${rel}`);
  if (rel.startsWith('site/')) sitePath(rel.slice(5));
}

// Extract data, never archive permissions or links. Enforce limits before creating a file.
export async function extractCandidate(zipFile, destination, { hosted = false } = {}) {
  ensure(fs.statSync(zipFile).size <= MAX_ARCHIVE, 'artifact archive too large');
  ensure(!fs.existsSync(destination), 'artifact destination must not exist');
  const zip = await new Promise((resolve, reject) => yauzl.open(zipFile, { lazyEntries: true, strictFileNames: true }, (e, z) => e ? reject(e) : resolve(z)));
  fs.mkdirSync(destination, { recursive: true });
  const seen = new Set();
  let expanded = 0;
  try {
    await new Promise((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', async (entry) => {
        try {
          const directory = entry.fileName.endsWith('/');
          const rel = directory ? entry.fileName.slice(0, -1) : entry.fileName;
          safePath(rel);
          const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
          ensure(mode === 0 || mode === (directory ? 0o040000 : 0o100000), 'links/special files in artifact are forbidden');
          ensure(!(entry.generalPurposeBitFlag & 1), 'encrypted artifact is forbidden');
          ensure(!seen.has(rel.toLowerCase()), 'duplicate/case-colliding artifact path');
          seen.add(rel.toLowerCase());
          ensure(seen.size <= 12000, 'too many artifact entries');
          expanded += entry.uncompressedSize;
          ensure(expanded <= MAX_EXPANDED && entry.uncompressedSize <= 64 * 1024 * 1024, 'expanded artifact too large');
          if (!directory) {
            archivePath(rel, hosted);
            const target = path.join(destination, rel);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            const stream = await new Promise((res, rej) => zip.openReadStream(entry, (e, s) => e ? rej(e) : res(s)));
            await pipeline(stream, fs.createWriteStream(target, { flags: 'wx', mode: 0o600 }));
          } else {
            ensure(hosted ? rel === 'evidence' : rel === 'site' || rel.startsWith('site/') || ['evidence', 'evidence/before', 'evidence/after'].includes(rel), 'unexpected artifact directory');
          }
          zip.readEntry();
        } catch (e) { reject(e); }
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

export function validatePull(pr, number, sha, { allowFork = false } = {}) {
  ensure(pr?.number === number && pr.state === 'open', 'PR is missing, closed or mismatched');
  ensure(pr.base?.repo?.full_name === REPO_NWO && pr.base.ref === 'master', 'PR must target this repository/master');
  ensure(allowFork || pr.head?.repo?.full_name === REPO_NWO, 'cross-repository/fork publishing is not permitted');
  ensure(pr.head?.sha === sha, 'stale candidate: PR head changed');
}

export function validateRun(run, workflow, context, { completed = true } = {}) {
  ensure(run.repository?.full_name === REPO_NWO && run.head_repository?.full_name === REPO_NWO, 'workflow run repository mismatch');
  ensure(workflow.path === BUILD_WORKFLOW && run.workflow_id === workflow.id && run.path === BUILD_WORKFLOW, 'unexpected source workflow');
  ensure(run.id === context.runId && run.run_attempt === context.runAttempt, 'workflow run/attempt mismatch');
  ensure(['pull_request', 'workflow_dispatch'].includes(run.event), 'unsupported source event');
  if (completed) ensure(run.status === 'completed' && run.conclusion === 'success', 'source workflow has not succeeded');
  ensure(run.display_title === runTitle(context.pr, context.sha), 'workflow title does not bind this PR/head');
  if (run.event === 'pull_request') ensure(run.head_sha === context.sha, 'workflow ran for a different PR head');
  else ensure(run.head_branch === 'master' && isFullSha(run.head_sha), 'dispatch must use trusted master');
  ensure(context.repository === REPO_NWO && context.workflow === BUILD_WORKFLOW, 'candidate repository/workflow mismatch');
  for (const field of ['sha', 'baseSha', 'baselineSha', 'toolingSha']) fullSha(context[field]);
}

export function selectArtifact(artifacts, run, name = candidateName(run.id, run.run_attempt)) {
  const matches = artifacts.filter((a) => a.name === name);
  ensure(matches.length === 1, 'expected exactly one candidate artifact for this run/attempt');
  const a = matches[0];
  ensure(!a.expired && a.size_in_bytes > 0 && a.size_in_bytes <= MAX_ARCHIVE, 'candidate artifact expired/empty/too large');
  ensure(a.workflow_run?.id === run.id && a.workflow_run?.head_sha === run.head_sha, 'artifact belongs to another workflow run/head');
  ensure(/^sha256:[0-9a-f]{64}$/.test(a.digest), 'artifact has no SHA-256 digest');
  positiveInt(a.id);
  return a;
}

export function validateConfig(config) {
  ensure(config && Array.isArray(config.routes) && config.routes.length > 0 && config.routes.length <= 100, 'invalid route configuration');
  ensure(Array.isArray(config.viewports) && config.viewports.length > 0 && config.viewports.length <= 5, 'invalid viewports');
  const ids = new Set();
  for (const r of config.routes) {
    ensure(/^[a-z0-9-]+$/.test(r.id) && !ids.has(r.id), 'invalid/duplicate route ID');
    ids.add(r.id);
    ensure(typeof r.path === 'string' && r.path.startsWith('/') && !r.path.startsWith('//'), 'invalid route path');
    if (r.path !== '/') safePath(r.path.replace(/^\//, '').replace(/\/$/, ''));
    for (const i of r.interactions || []) {
      if (i.expectPath) ensure(i.expectPath.startsWith('/') && !i.expectPath.startsWith('//') && !/[\\?#]/.test(i.expectPath), 'invalid navigation path');
    }
  }
  const names = new Set();
  for (const v of config.viewports) {
    ensure(/^[a-z0-9-]+$/.test(v.name) && !names.has(v.name), 'invalid/duplicate viewport');
    names.add(v.name);
    ensure(Number.isInteger(v.width) && v.width >= 320 && v.width <= 1920 && Number.isInteger(v.height) && v.height >= 320 && v.height <= 1200, 'invalid viewport dimensions');
  }
}

export function validateResults(report, config, sha, role, evidenceDir) {
  ensure(report.sha === sha && report.role === role && report.deliverable === false && report.builder === CLOUD_BUILDER, 'wrong report revision/role/builder');
  ensure(report.passed === true && report.failures?.length === 0, 'acceptance report failed');
  const wanted = config.routes.flatMap((r) => config.viewports.map((v) => `${r.id}|${v.name}`)).sort();
  const have = report.results?.map((r) => `${r.route}|${r.viewport}`).sort();
  ensure(isDeepStrictEqual(have, wanted), 'acceptance route/viewport coverage mismatch');
  for (const r of report.results) {
    const route = config.routes.find((s) => s.id === r.route);
    const captureOnly = role === 'baseline' && route.captureOnly === true;
    ensure(r.path === route.path && r.passed === true && r.failures?.length === 0, 'route failed or changed');
    ensure(captureOnly || (!r.captureOnly && r.assertions?.length > 0 && r.assertions.every((a) => a.ok === true)), 'missing/failing assertions');
    if (!captureOnly) {
      const interactions = (route.interactions || []).filter((i) => !i.viewports || i.viewports.includes(r.viewport));
      ensure((r.interactions || []).length === interactions.length && (r.interactions || []).every((i) => i.ok === true), 'missing/failing navigation interactions');
      if (route.copyCode) ensure(r.copyCode?.length > 0 && r.copyCode.every((a) => a.ok === true), 'missing/failing copy-code checks');
    }
    ensure(r.screenshot && /^[a-z0-9-]+\.png$/.test(r.screenshot.file), 'invalid screenshot path');
    ensure(sha256File(path.join(evidenceDir, r.screenshot.file)) === r.screenshot.sha256, 'screenshot hash mismatch');
  }
}

export function validateCandidate(dir, c, { headConfig, beforeConfig }) {
  ensure(c.schemaVersion === 1, 'unsupported candidate schema');
  ensure(isDeepStrictEqual(c.config, headConfig) && isDeepStrictEqual(c.baselineConfig, beforeConfig), 'route expectations do not match committed sources');
  validateConfig(headConfig);
  validateConfig(beforeConfig);
  ensure(headConfig.routes.every((r) => !r.captureOnly), 'final expectations cannot be capture-only');
  ensure(c.report.strictOverflow === true && c.baselineReport.strictOverflow === false, 'incorrect final/baseline overflow gates');
  ensure(c.report.pr === c.context.pr && c.report.repo === REPO_NWO && c.report.prefix === previewPrefix(c.context.pr, c.context.sha), 'report association mismatch');
  ensure(c.baselineReport.pr === c.context.pr && c.baselineReport.repo === REPO_NWO && c.baselineReport.prefix === previewPrefix(c.context.pr, c.context.baselineSha), 'baseline association mismatch');
  validateResults(c.report, headConfig, c.context.sha, 'cloud', path.join(dir, 'evidence', 'after'));
  validateResults(c.baselineReport, beforeConfig, c.context.baselineSha, 'baseline', path.join(dir, 'evidence', 'before'));
  const actual = manifest(path.join(dir, 'site'));
  ensure(Object.keys(actual).length > 0, 'empty preview site');
  Object.keys(actual).forEach(sitePath);
  ensure(sameManifest(c.files, actual), 'site manifest/hash mismatch');
  ensure(Object.hasOwn(actual, 'index.html') && Object.hasOwn(actual, 'CNAME'), 'missing site root/CNAME');
  const allowed = new Set(['candidate.json', ...Object.keys(actual).map((r) => `site/${r}`),
    ...c.report.results.map((r) => `evidence/after/${r.screenshot.file}`),
    ...c.baselineReport.results.map((r) => `evidence/before/${r.screenshot.file}`)]);
  ensure(Object.keys(manifest(dir)).every((r) => allowed.has(r)), 'unexpected candidate files');
  return c;
}

export function cloudReport(candidate, artifact) {
  const c = candidate.context;
  return {
    ...candidate.report,
    provenance: {
      kind: 'github-actions', repository: REPO_NWO, workflow: BUILD_WORKFLOW,
      runId: c.runId, runAttempt: c.runAttempt, toolingSha: c.toolingSha,
      baselineSha: c.baselineSha, artifactId: artifact.id, artifactDigest: artifact.digest,
    },
  };
}

export function previewDeployment(report, publicationRunId) {
  ensure(report.prefix === previewPrefix(positiveInt(report.pr), fullSha(report.sha)), 'invalid deployment prefix');
  return {
    ref: report.sha, task: 'deploy:preview', auto_merge: false, required_contexts: [],
    environment: `website-preview-pr-${report.pr}`, transient_environment: true, production_environment: false,
    description: 'Verified isolated PR preview; visual review remains required.',
    payload: { pr: report.pr, sha: report.sha, source_run_id: report.provenance.runId,
      source_run_attempt: report.provenance.runAttempt, publication_run_id: positiveInt(publicationRunId),
      artifact_id: report.provenance.artifactId },
  };
}

export function previewSuccess(report, publicationRunId) {
  previewDeployment(report, publicationRunId);
  return {
    state: 'success', environment_url: CLOUD_ORIGIN + report.prefix + '/',
    log_url: `https://github.com/${REPO_NWO}/actions/runs/${publicationRunId}`, auto_inactive: false,
    description: 'Exact bytes and hosted browser checks passed; visual review pending.',
  };
}
