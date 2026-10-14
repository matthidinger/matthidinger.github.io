#!/usr/bin/env node
// Upload a run's screenshots to GitHub user attachments and embed them (with route, viewport and
// commit labels) in the PR body between evidence markers. Uses the existing gh login in memory only.
//   node .github/acceptance/bin/upload-screenshots.mjs RUN_DIR --pr N [--baseline BASELINE_RUN_DIR]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderReport } from '../lib/pipeline.mjs';
import { prInfo } from '../lib/preview.mjs';
import { verifyEvidence } from '../lib/readiness.mjs';
import { REPO_NWO, fail, parseArgs, prNumber, readJson, sh, writeJson } from '../lib/util.mjs';

export const START = '<!-- acceptance-evidence:start -->';
export const END = '<!-- acceptance-evidence:end -->';

export async function upload(file, name, repoId, token) {
  const q = new URLSearchParams({ name, content_type: 'image/png', repository_id: String(repoId) });
  const res = await fetch(`https://uploads.github.com/user-attachments/assets?${q}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png', Accept: 'application/vnd.github+json' },
    body: fs.readFileSync(file),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`upload of ${name} failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  const url = json.href || json.url || json.asset_url;
  if (!/^https:\/\/github\.com\/user-attachments\/assets\//.test(url || '')) throw new Error(`upload of ${name} returned no attachment URL: ${text.slice(0, 200)}`);
  return url;
}

async function uploadRun(runDir, repoId, token) {
  const report = readJson(path.join(runDir, 'report.json'));
  const ev = verifyEvidence(runDir, report);
  if (ev.missing.length || ev.mismatched.length) throw new Error(`evidence incomplete in ${runDir}`);
  const recordFile = path.join(runDir, 'evidence', 'uploads.json');
  const prev = fs.existsSync(recordFile) ? readJson(recordFile) : { items: [] };
  const items = [];
  for (const r of report.results) {
    const s = r.screenshot;
    const reuse = prev.sha === report.sha && prev.items.find((i) => i.sha256 === s.sha256);
    const url = reuse ? reuse.url : await upload(path.join(runDir, 'evidence', s.file), `${report.sha.slice(0, 12)}-${s.file}`, repoId, token);
    items.push({ route: r.route, path: r.path, viewport: r.viewport, file: s.file, sha256: s.sha256, url, truncated: s.truncated });
    console.log(`${reuse ? 'reused  ' : 'uploaded'} ${s.file}`);
  }
  const record = { sha: report.sha, role: report.role, items };
  writeJson(recordFile, record);
  return { report, record };
}

function gallery(title, report, record) {
  const rows = ['| Route | Desktop | Mobile |', '|---|---|---|'];
  for (const route of [...new Set(record.items.map((i) => i.path))]) {
    const cell = (vp) => {
      const i = record.items.find((x) => x.path === route && x.viewport === vp);
      return i ? `<img src="${i.url}" width="${vp === 'mobile' ? 180 : 360}" alt="${route} ${vp} @ ${report.sha.slice(0, 7)}">` : '—';
    };
    rows.push(`| \`${route}\` | ${cell('desktop')} | ${cell('mobile')} |`);
  }
  return [`#### ${title} — commit \`${report.sha}\``, '', ...rows, '', 'Screenshots are full-page captures (cut off at 5000px) of the branch build.'].join('\n');
}

// Hosted-preview browser results. Page links are listed only for a public, approved backend.
export function hostedSection(runDir) {
  const f = path.join(runDir, 'hosted', 'report.json');
  const readyFile = path.join(runDir, 'readiness.json');
  const ready = fs.existsSync(readyFile) ? readJson(readyFile) : null;
  let h;
  if (ready && Object.hasOwn(ready, 'cloud')) {
    if (ready.cloud?.status !== 'pass' || ready.cloud.report?.sha !== ready.sha) return '';
    h = ready.cloud.hosted;
    if (!h?.passed || h.sha !== ready.sha || h.verification?.status !== 'pass') return '';
  } else {
    if (!fs.existsSync(f)) return '';
    h = readJson(f);
  }
  const lines = ['', `#### Hosted preview checks: ${h.passed ? 'PASS' : 'FAIL'} — ${h.backend}, commit \`${h.sha}\` (checked ${h.checkedAt})`, '',
    `Revision verification: ${h.verification?.status} — ${(h.verification?.detail || '').replace(/\|/g, '\\|')}`];
  if (h.provenance?.kind === 'github-actions') lines.push('', `Preview built in Actions run ${h.provenance.runId}, attempt ${h.provenance.runAttempt}; NAS build evidence is recorded separately.`);
  if (!h.results?.length) return lines.join('\n');
  lines.push('', `| Route | Viewport | Result | Copy code |${h.public ? ' Preview |' : ''}`, `|---|---|---|---|${h.public ? '---|' : ''}`);
  for (const r of h.results) {
    const copy = r.copyCode ? `${r.copyCode.filter((a) => a.ok).length}/${r.copyCode.length}` : '—';
    lines.push(`| \`${r.path}\` | ${r.viewport} | ${r.passed ? '✅' : '❌ ' + (r.failures || []).slice(0, 2).join('; ').replace(/\|/g, '\\|')} | ${copy} |${h.public ? ` [open](${h.origin}${h.prefix}${r.path}) |` : ''}`);
  }
  return lines.join('\n');
}

function readinessTable(runDir) {
  const f = path.join(runDir, 'readiness.json');
  if (!fs.existsSync(f)) return '';
  const r = readJson(f);
  return ['', `#### Readiness: **${r.overall.toUpperCase()}** (checked ${r.checkedAt})`, '', '| Gate | Status | Detail |', '|---|---|---|',
    ...r.gates.map((g) => `| ${g.id} | ${g.status} | ${g.detail.replace(/\|/g, '\\|')} |`)].join('\n');
}

export function replaceSection(body, section) {
  const block = `${START}\n${section}\n${END}`;
  const s = body.indexOf(START);
  const e = body.indexOf(END);
  return s !== -1 && e > s ? body.slice(0, s) + block + body.slice(e + END.length) : `${body.trimEnd()}\n\n${block}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const pr = prNumber(args.pr);
    const runDir = path.resolve(args._[0] || '');
    const repoId = sh('gh', ['api', `repos/${REPO_NWO}`, '--jq', '.id']);
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const after = await uploadRun(runDir, repoId, token);
    if (after.report.pr !== pr || !after.report.deliverable) throw new Error('only a deliverable run for this PR can be embedded');
    const parts = ['### Acceptance evidence', '', renderReport(after.report), gallery('After (this PR)', after.report, after.record)];
    if (args.baseline) {
      const before = await uploadRun(path.resolve(args.baseline), repoId, token);
      parts.push('', gallery('Before (base branch)', before.report, before.record));
    }
    parts.push(hostedSection(runDir), readinessTable(runDir));
    const info = prInfo(pr);
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pr-body-')), 'body.md');
    fs.writeFileSync(tmp, replaceSection(info.body || '', parts.join('\n')));
    sh('gh', ['pr', 'edit', String(pr), '-R', REPO_NWO, '--body-file', tmp]);
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    console.log(`embedded ${after.record.items.length} screenshots in PR #${pr}`);
  } catch (e) {
    fail(e.message);
  }
}
