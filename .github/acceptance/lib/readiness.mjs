// Final-SHA readiness gates. gatherFacts() collects live state; evaluate() is pure and unit-tested.
import fs from 'node:fs';
import path from 'node:path';
import { previewTarget, prInfo, validateAssociation } from './preview.mjs';
import { REPO_NWO, dirtyFiles, headSha, manifest, readJson, sh, sha256File } from './util.mjs';

export const REQUIRED_CHECK = 'site-acceptance';
const ATTACHMENT_RE = /^https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]{36}$/;

const readIf = (f) => (fs.existsSync(f) ? readJson(f) : null);

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

export function gatherFacts({ root, runDir, pr, baselineDir, ux, env = process.env, run = sh, fetchStatus }) {
  const report = readIf(path.join(runDir, 'report.json'));
  const facts = {
    pr, ux: !!ux, head: headSha(root), dirty: dirtyFiles(root), report,
    evidence: verifyEvidence(runDir, report),
    inspection: readIf(path.join(runDir, 'evidence', 'inspection.json')),
    uploads: readIf(path.join(runDir, 'evidence', 'uploads.json')),
    baseline: baselineDir ? { report: readIf(path.join(baselineDir, 'report.json')), uploads: readIf(path.join(baselineDir, 'evidence', 'uploads.json')) } : null,
    mergeBase: null, pr_info: null, checks: null,
    previewRoot: env.COPILOT_PREVIEW_ROOT || '', previewBaseUrl: env.COPILOT_PREVIEW_BASE_URL || '',
    preview: null, previewFetch: null,
  };
  try { facts.mergeBase = run('git', ['merge-base', 'HEAD', 'origin/master'], { cwd: root }); } catch { /* reported by gate */ }
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
      facts.preview = { exists, matches: exists && expected ? JSON.stringify(manifest(target)) === JSON.stringify(expected) : false };
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

  if (!f.previewRoot) gate('preview-export', 'blocked', 'COPILOT_PREVIEW_ROOT is not provided by the runtime');
  else if (!f.preview?.exists) gate('preview-export', 'fail', 'preview not exported for this PR/commit; run bin/export-preview.mjs');
  else if (!f.preview.matches) gate('preview-export', 'fail', 'exported preview does not match the accepted build');
  else gate('preview-export', 'pass', 'immutable preview exported for this PR/commit');

  if (!f.previewBaseUrl) gate('private-preview-link', 'blocked', 'COPILOT_PREVIEW_BASE_URL is not configured: private preview ingress has not been approved/configured by the operator');
  else if (!f.previewFetch) gate('private-preview-link', 'fail', 'preview deep link was not verified');
  else if (!f.previewFetch.ok) gate('private-preview-link', 'fail', `preview deep link check failed: ${f.previewFetch.detail}`);
  else gate('private-preview-link', 'pass', 'authenticated preview deep link serves this revision');

  if (f.ux) {
    const b = f.baseline;
    if (!r?.strictOverflow) gate('ux-overflow', 'fail', 'UX jobs require the strict overflow gate (--ux)');
    else gate('ux-overflow', 'pass', 'no page-level overflow on any route/viewport');
    if (!b?.report || b.report.role !== 'baseline') gate('ux-before-after', 'fail', 'no baseline ("before") run; use --baseline-ref master');
    else if (f.mergeBase && b.report.sha !== f.mergeBase) gate('ux-before-after', 'fail', `baseline ${b.report.sha} is not the merge base ${f.mergeBase}`);
    else if (!b.uploads?.items?.length || b.uploads.items.some((i) => !body.includes(i.url))) gate('ux-before-after', 'fail', 'before screenshots are not embedded in the PR');
    else gate('ux-before-after', 'pass', 'before/after screenshots embedded');
  }

  const overall = gates.some((g) => g.status === 'fail') ? 'not-ready' : gates.some((g) => g.status === 'blocked') ? 'blocked' : 'ready';
  return { overall, sha: sha || null, gates };
}
