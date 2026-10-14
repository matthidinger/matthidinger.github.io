// Final-SHA readiness gates. gatherFacts() collects live state; evaluate() is pure and unit-tested.
import fs from 'node:fs';
import path from 'node:path';
import { PREVIEW_TIMEOUT_MS, exportManifest, hostedErrors, previewOrigin, resolveBackend, routeFile, sameManifest, verifyHostedReceipt } from './hosting.mjs';
import { previewTarget, prInfo, validateAssociation } from './preview.mjs';
import { REPO_NWO, dirtyFiles, headSha, manifest, readJson, sh, sha256, sha256File } from './util.mjs';

export const REQUIRED_CHECK = 'site-acceptance';
const ATTACHMENT_RE = /^https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]{36}$/;

const readIf = (f) => (fs.existsSync(f) ? readJson(f) : null);

export { PREVIEW_TIMEOUT_MS, previewOrigin, routeFile };

// Verifies the operator-configured private preview over this runtime's ambient authenticated transport.
// No identity/auth headers are injected and redirects are never followed. Owner-only access policy is an
// operator-verified prerequisite; it cannot be inferred from one client's responses. Details never echo the origin.
export async function verifyPreviewLink({ base, prefix, sha, paths, expected, fetchImpl = fetch, timeoutMs = PREVIEW_TIMEOUT_MS }) {
  let origin;
  try { origin = previewOrigin(base); } catch (e) { return { status: 'fail', detail: e.message, routes: [] }; }
  const routes = [];
  for (const p of [...new Set(paths)]) {
    const want = expected?.[routeFile(p)];
    if (!want) { routes.push({ path: p, status: 'fail', detail: 'route not in the accepted preview manifest' }); continue; }
    let res;
    try {
      res = await fetchImpl(origin + prefix + p, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      const why = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : `unreachable (${e?.cause?.code || e?.name || 'error'})`;
      routes.push({ path: p, status: 'blocked', detail: `${why} from this runtime` });
      continue;
    }
    const s = res.status;
    if (s >= 300 && s < 400 || res.type === 'opaqueredirect') routes.push({ path: p, status: 'fail', detail: `redirected (${s}); redirects are not followed` });
    else if (s === 401 || s === 403 || s === 407) routes.push({ path: p, status: 'blocked', detail: `access denied (${s}) for this runtime's ambient identity` });
    else if (s !== 200) routes.push({ path: p, status: 'fail', detail: `HTTP ${s}` });
    else {
      const rev = res.headers.get('x-preview-revision');
      const body = Buffer.from(await res.arrayBuffer());
      if (rev !== sha) routes.push({ path: p, status: 'fail', detail: `X-Preview-Revision ${rev || 'missing'} != ${sha}` });
      else if (sha256(body) !== want) routes.push({ path: p, status: 'fail', detail: 'served HTML differs from the accepted build' });
      else routes.push({ path: p, status: 'pass' });
    }
  }
  const bad = routes.filter((r) => r.status === 'fail');
  const blocked = routes.filter((r) => r.status === 'blocked');
  const list = (xs) => xs.map((r) => `${r.path}: ${r.detail}`).join('; ');
  if (!routes.length) return { status: 'fail', detail: 'no accepted routes to verify', routes };
  if (bad.length) return { status: 'fail', detail: list(bad), routes };
  if (blocked.length) return { status: 'blocked', detail: list(blocked), routes };
  return { status: 'pass', detail: `${routes.length} accepted routes served with X-Preview-Revision ${sha} and accepted HTML bytes`, routes };
}

// Backend-specific verification of the hosted preview for an accepted report. Returns null when the
// header backend has no configured base (readiness then reports BLOCKED).
export async function verifyHostedPreview({ backend, pr, report, expected, fetchImpl = fetch, timeoutMs = PREVIEW_TIMEOUT_MS }) {
  const paths = [...new Set((report.results || []).map((x) => x.path))];
  if (backend.type === 'header') {
    if (!backend.base) return null;
    return verifyPreviewLink({ base: backend.base, prefix: report.prefix, sha: report.sha, paths, expected, fetchImpl, timeoutMs });
  }
  return verifyHostedReceipt({ origin: backend.origin, prefix: report.prefix, pr, sha: report.sha, builder: report.builder, expected, paths, fetchImpl, timeoutMs });
}

export function verifyEvidence(runDir, report) {
  const missing = [];
  const mismatched = [];
  for (const r of report?.results || []) {
    if (!r.screenshot) { missing.push(`${r.route}-${r.viewport}`); continue; }
    const f = path.join(runDir, 'evidence', r.screenshot.file);
    if (!fs.existsSync(f)) missing.push(r.screenshot.file);
    else if (sha256File(f) !== r.screenshot.sha256) mismatched.push(r.screenshot.file);
  }
  return { missing, mismatched };
}

export function gatherFacts({ root, runDir, pr, baselineDir, ux, backendFlag, env = process.env, run = sh, previewConfig }) {
  const report = readIf(path.join(runDir, 'report.json'));
  const facts = {
    pr, ux: !!ux, head: headSha(root), dirty: dirtyFiles(root), report,
    evidence: verifyEvidence(runDir, report),
    inspection: readIf(path.join(runDir, 'evidence', 'inspection.json')),
    uploads: readIf(path.join(runDir, 'evidence', 'uploads.json')),
    baseline: baselineDir ? { report: readIf(path.join(baselineDir, 'report.json')), uploads: readIf(path.join(baselineDir, 'evidence', 'uploads.json')) } : null,
    mergeBase: null, pr_info: null, checks: null,
    previewRoot: env.COPILOT_PREVIEW_ROOT || '', previewBaseUrl: env.COPILOT_PREVIEW_BASE_URL || '',
    preview: null, previewFetch: null, backend: null, backendError: null,
    hosted: readIf(path.join(runDir, 'hosted', 'report.json')),
  };
  try { facts.backend = resolveBackend({ flag: backendFlag, env, ...(previewConfig ? { config: previewConfig } : {}) }); } catch (e) { facts.backendError = e.message; }
  try { facts.mergeBase = run('git', ['merge-base', 'HEAD', 'origin/master'], { cwd: root }) || null; } catch (e) { facts.mergeBaseError = e.message.split('\n')[0]; }
  try { facts.pr_info = prInfo(pr, run); } catch (e) { facts.pr_info = { error: e.message.split('\n')[0] }; }
  if (report?.sha) {
    try {
      const out = run('gh', ['api', `repos/${REPO_NWO}/commits/${report.sha}/check-runs?per_page=100`, '--jq', '.check_runs | map({name, status, conclusion, url: .html_url})']);
      facts.checks = JSON.parse(out);
    } catch (e) { facts.checks = { error: e.message.split('\n')[0] }; }
    if (facts.previewRoot) {
      const target = previewTarget(facts.previewRoot, pr, report.sha);
      const expected = readIf(path.join(runDir, 'preview-manifest.json'));
      const exists = fs.existsSync(target);
      let want = null;
      try { want = expected && exportManifest(report, expected); } catch (e) { facts.previewError = e.message; }
      facts.preview = { exists, matches: exists && want ? sameManifest(manifest(target), want) : false };
    }
  }
  return facts;
}

export function evaluate(f) {
  const gates = [];
  const gate = (id, status, detail) => gates.push({ id, status, detail });
  const r = f.report;
  const sha = r?.sha;

  if (!r) gate('acceptance-report', 'fail', 'no acceptance report; run bin/accept.mjs --pr N');
  else if (!r.deliverable) gate('acceptance-report', 'fail', `report is a ${r.role} run and is not deliverable`);
  else if (!r.passed) gate('acceptance-report', 'fail', 'acceptance failed: ' + [...r.failures, ...r.results.flatMap((x) => x.failures || [])].slice(0, 5).join('; '));
  else gate('acceptance-report', 'pass', `${r.results.length} route/viewport checks passed (${r.builder})`);

  if (f.dirty.length) gate('clean-tree', 'fail', `uncommitted changes: ${f.dirty.slice(0, 5).join(', ')}`);
  else gate('clean-tree', 'pass', 'working tree clean');

  if (!sha || f.head !== sha) gate('current-revision', 'fail', `stale revision: HEAD ${f.head} vs evidence ${sha || 'none'}`);
  else gate('current-revision', 'pass', `evidence is for HEAD ${sha}`);

  const info = f.pr_info;
  if (!info || info.error) gate('pr-association', 'fail', info?.error || 'PR not found');
  else {
    const errs = validateAssociation({ pr: f.pr, sha, head: f.head, info });
    gate('pr-association', errs.length ? 'fail' : 'pass', errs.join('; ') || `PR #${f.pr} head ${sha}`);
  }

  const ev = f.evidence;
  if (!r?.results?.length || ev.missing.length || ev.mismatched.length) gate('screenshots', 'fail', `missing: ${ev.missing.join(', ') || '-'}; changed: ${ev.mismatched.join(', ') || '-'}`);
  else gate('screenshots', 'pass', `${r.results.length} screenshots match the report`);

  const shots = (r?.results || []).filter((x) => x.screenshot).map((x) => x.screenshot);
  const insp = f.inspection;
  const uninspected = shots.filter((s) => insp?.screenshots?.[s.file] !== s.sha256).map((s) => s.file);
  if (!insp || insp.sha !== sha || uninspected.length) gate('visual-inspection', 'fail', insp ? `not inspected for this revision: ${uninspected.join(', ') || 'sha mismatch'}` : 'no inspection record; view every screenshot then run bin/inspect.mjs');
  else gate('visual-inspection', 'pass', `${shots.length} screenshots inspected: ${insp.notes}`);

  const body = info?.body || '';
  const up = f.uploads;
  const notUploaded = shots.filter((s) => !up?.items?.some((i) => i.sha256 === s.sha256 && ATTACHMENT_RE.test(i.url)));
  const notEmbedded = (up?.items || []).filter((i) => !body.includes(i.url));
  if (!up || up.sha !== sha || notUploaded.length) gate('embedded-evidence', 'fail', `screenshots not uploaded for this revision: ${notUploaded.map((s) => s.file).join(', ') || 'uploads record missing/stale'}`);
  else if (notEmbedded.length || !body.includes(sha)) gate('embedded-evidence', 'fail', `PR body lacks ${notEmbedded.length} screenshot(s) or the commit SHA`);
  else gate('embedded-evidence', 'pass', `${up.items.length} screenshots embedded in PR body`);

  const checks = f.checks;
  if (!Array.isArray(checks)) gate('ci', 'fail', checks?.error || 'no check runs found');
  else {
    const req = checks.filter((c) => c.name === REQUIRED_CHECK);
    const pending = checks.filter((c) => c.status !== 'completed');
    const bad = checks.filter((c) => c.status === 'completed' && !['success', 'neutral', 'skipped'].includes(c.conclusion));
    if (!req.length) gate('ci', 'fail', `required check "${REQUIRED_CHECK}" has not run on ${sha}`);
    else if (pending.length) gate('ci', 'fail', `pending: ${pending.map((c) => c.name).join(', ')}`);
    else if (bad.length || req.some((c) => c.conclusion !== 'success')) gate('ci', 'fail', `failed: ${[...bad, ...req.filter((c) => c.conclusion !== 'success')].map((c) => `${c.name}=${c.conclusion}`).join(', ')}`);
    else gate('ci', 'pass', `${checks.length} check run(s) succeeded on ${sha}`);
  }

  const be = f.backend;
  if (!be) gate('preview-backend', 'fail', f.backendError || 'no preview backend selected');
  else gate('preview-backend', 'pass', `${be.id}: ${be.type === 'receipt' ? 'revision receipt plus served bytes' : 'X-Preview-Revision header plus route HTML'} (selected by ${be.source})`);

  if (!f.previewRoot) gate('preview-export', 'blocked', 'COPILOT_PREVIEW_ROOT is not provided by the runtime');
  else if (f.previewError) gate('preview-export', 'fail', f.previewError);
  else if (!f.preview?.exists) gate('preview-export', 'fail', 'preview not exported for this PR/commit; run bin/export-preview.mjs');
  else if (!f.preview.matches) gate('preview-export', 'fail', 'exported preview does not match the accepted build plus its revision receipt');
  else gate('preview-export', 'pass', 'immutable preview package (accepted site + revision receipt) exported for this PR/commit');

  const pf = f.previewFetch;
  let link = null;
  if (be?.type === 'header') {
    if (!f.previewBaseUrl) link = ['blocked', 'COPILOT_PREVIEW_BASE_URL is not configured: private preview ingress has not been approved/configured by the operator'];
    else if (!pf) link = ['fail', 'preview deep link was not verified'];
    else if (pf.status === 'blocked') link = ['blocked', `external verification blocker: ${pf.detail}`];
    else if (pf.status !== 'pass') link = ['fail', `preview deep link check failed: ${pf.detail}`];
    else link = ['pass', pf.detail];
    gate('private-preview-link', ...link);
  } else if (be?.type === 'receipt') {
    if (!pf) link = ['fail', 'hosted preview receipt was not verified'];
    else if (pf.status === 'blocked') link = ['blocked', `external blocker: ${pf.detail}`];
    else if (pf.status !== 'pass') link = ['fail', `hosted preview rejected: ${pf.detail}`];
    else link = ['pass', pf.detail];
    gate('preview-receipt', ...link);
  }

  if (!be) gate('hosted-browser', 'fail', 'no preview backend selected');
  else if (link?.[0] === 'blocked') gate('hosted-browser', 'blocked', 'waiting for a verified hosted preview before browser checks can count');
  else if (link?.[0] !== 'pass') gate('hosted-browser', 'fail', 'hosted preview is not verified, so hosted browser checks cannot count');
  else {
    let origin = be.origin;
    if (be.type === 'header') { try { origin = previewOrigin(f.previewBaseUrl); } catch { origin = null; } }
    const errs = hostedErrors(f.hosted, { report: r, pr: f.pr, backend: be, origin });
    if (errs.length) gate('hosted-browser', 'fail', errs.join('; '));
    else {
      const copy = f.hosted.results.filter((x) => x.copyCode?.length).length;
      gate('hosted-browser', 'pass', `${f.hosted.results.length} route/viewport checks passed in Chromium against the hosted preview for ${sha}, including ${copy} copy-code interaction runs`);
    }
  }

  if (f.ux) {
    const b = f.baseline;
    if (!r?.strictOverflow) gate('ux-overflow', 'fail', 'UX jobs require the strict overflow gate (--ux)');
    else gate('ux-overflow', 'pass', 'no page-level overflow on any route/viewport');
    if (!f.mergeBase) gate('ux-before-after', 'fail', `cannot establish the merge base with origin/master${f.mergeBaseError ? ` (${f.mergeBaseError})` : ''}; fetch origin/master and re-run`);
    else if (!b?.report || b.report.role !== 'baseline') gate('ux-before-after', 'fail', 'no baseline ("before") run; use --baseline-ref master');
    else if (b.report.sha !== f.mergeBase) gate('ux-before-after', 'fail', `baseline ${b.report.sha} is not the merge base ${f.mergeBase}`);
    else if (!b.uploads?.items?.length || b.uploads.items.some((i) => !body.includes(i.url))) gate('ux-before-after', 'fail', 'before screenshots are not embedded in the PR');
    else gate('ux-before-after', 'pass', 'before/after screenshots embedded');
  }

  const overall = gates.some((g) => g.status === 'fail') ? 'not-ready' : gates.some((g) => g.status === 'blocked') ? 'blocked' : 'ready';
  return { overall, sha: sha || null, gates };
}
