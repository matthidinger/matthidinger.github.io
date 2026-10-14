import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runChecks } from './browser.mjs';
import { stagePrefixedSite } from './rewrite.mjs';
import { startServer } from './server.mjs';
import { REPO_NWO, dirtyFiles, headSha, manifest, previewPrefix, readJson, sh, writeJson } from './util.mjs';

export const RUNS_DIR = '.artifacts/acceptance';
const ROUTES_REL = ['.github', 'acceptance', 'routes.json'];

// A baseline is judged by the routes.json committed at that ref: HEAD's routes describe the change
// under review and would fail the old site by design. HEAD routes the baseline lacks are still
// captured for before/after comparison, without HEAD's expectations, and are report-only.
export function baselineConfig(headConfig, ownConfig) {
  const own = ownConfig || { ...headConfig, routes: [] };
  const ids = new Set(own.routes.map((r) => r.id));
  const paths = new Set(own.routes.map((r) => r.path));
  const added = headConfig.routes
    .filter((r) => !ids.has(r.id) && !paths.has(r.path))
    .map((r) => ({ id: r.id, path: r.path, purpose: `Before capture only (not in the baseline's routes.json). ${r.purpose || ''}`.trim(), captureOnly: true }));
  return { ...own, routes: [...own.routes, ...added] };
}

export function runConfig({ runDir, role, headConfig }) {
  if (role !== 'baseline') return { config: headConfig, source: 'checkout routes.json' };
  const file = path.join(runDir, 'src', ...ROUTES_REL);
  const own = fs.existsSync(file) ? readJson(file) : null;
  return {
    config: baselineConfig(headConfig, own),
    source: own ? 'baseline routes.json (+ capture-only routes added since)' : 'capture only (baseline has no routes.json)',
  };
}

// captureOnly is honoured only in baseline runs, so it can never relax a deliverable or development check.
export function settleCaptureOnly(results, config, role) {
  if (role !== 'baseline') return results;
  const only = new Set(config.routes.filter((r) => r.captureOnly).map((r) => r.id));
  return results.map((r) => (only.has(r.route)
    ? { ...r, captureOnly: true, passed: true, failures: [], warnings: [...(r.warnings || []), ...(r.failures || []).map((f) => `capture only: ${f}`)] }
    : r));
}

// Cloud runs build an explicit ref, never masquerading as a local/NAS deliverable.
export function stageSource({ root, role = 'deliverable', ref, pr = 0 }) {
  let sha;
  let dirty = dirtyFiles(root);
  if (role === 'deliverable') {
    if (dirty.length) throw new Error(`working tree is dirty; commit first or use --dev (non-deliverable):\n  ${dirty.slice(0, 10).join('\n  ')}`);
    sha = headSha(root);
  } else if (role === 'baseline' || role === 'cloud') {
    sha = sh('git', ['rev-parse', `${ref}^{commit}`], { cwd: root });
    dirty = [];
  } else if (role === 'development') {
    sha = headSha(root);
  } else {
    throw new Error(`unknown role ${role}`);
  }
  const name = role === 'deliverable' || role === 'cloud' ? `pr-${pr}-${sha}` : role === 'baseline' ? `baseline-${sha.slice(0, 12)}` : `dev-${sha.slice(0, 12)}-${Date.now()}`;
  const runDir = path.join(root, RUNS_DIR, name);
  fs.rmSync(runDir, { recursive: true, force: true });
  const src = path.join(runDir, 'src');
  fs.mkdirSync(src, { recursive: true });
  if (role === 'development') {
    const files = sh('git', ['ls-files', '-z', '-co', '--exclude-standard'], { cwd: root }).split('\0').filter(Boolean);
    for (const rel of files) {
      const from = path.join(root, rel);
      if (!fs.existsSync(from) || !fs.lstatSync(from).isFile()) continue;
      fs.mkdirSync(path.dirname(path.join(src, rel)), { recursive: true });
      fs.copyFileSync(from, path.join(src, rel));
    }
  } else {
    const tar = execFileSync('git', ['archive', '--format=tar', sha], { cwd: root, maxBuffer: 1024 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', src], { input: tar });
  }
  const meta = { schema: 1, repo: REPO_NWO, sha, role, deliverable: role === 'deliverable', pr, prefix: previewPrefix(pr, sha), dirtyAtStage: dirty, stagedAt: new Date().toISOString() };
  writeJson(path.join(runDir, 'meta.json'), meta);
  return { runDir, meta };
}

// Pinned GitHub Pages runtime on the self-hosted machine. PAGES_ENV=dotcom matches github.com Pages
// metadata (otherwise jekyll-github-metadata derives an enterprise-style /pages/<owner> baseurl).
export function buildNas(runDir) {
  const src = path.join(runDir, 'src');
  const log = path.join(runDir, 'build.log');
  const r = spawnSync('nas-pages-build', [src], {
    env: { ...process.env, PAGES_ENV: 'dotcom', PAGES_REPO_NWO: REPO_NWO },
    encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
  fs.writeFileSync(log, (r.stdout || '') + (r.stderr || ''));
  if (r.error) throw new Error(`nas-pages-build could not run: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`nas-pages-build failed (exit ${r.status}); see ${path.relative(process.cwd(), log)}`);
  return path.join(src, '.artifacts', 'site');
}

export function verifyBuild(siteDir, config) {
  const failures = [];
  const checks = [];
  if (!fs.existsSync(path.join(siteDir, 'index.html'))) failures.push('built site has no index.html');
  for (const [rel, needles] of Object.entries(config.build.productionShape || {})) {
    const file = path.join(siteDir, rel);
    const body = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    for (const n of needles) {
      const ok = body !== null && body.includes(n);
      checks.push({ name: `${rel} contains ${n}`, ok });
      if (!ok) failures.push(`production build shape: ${rel} lacks ${n}`);
    }
  }
  for (const rel of config.build.mustNotExist || []) {
    const ok = !fs.existsSync(path.join(siteDir, rel));
    checks.push({ name: `${rel} excluded from site`, ok });
    if (!ok) failures.push(`setup/source file leaked into generated site: ${rel}`);
  }
  return { checks, failures };
}

export async function acceptRun({ runDir, siteDir, config, configSource = 'checkout routes.json', builder, strictOverflow = false, chromium, label = '' }) {
  const meta = readJson(path.join(runDir, 'meta.json'));
  const build = verifyBuild(siteDir, config);
  const previewRoot = path.join(runDir, 'preview');
  const prefixed = path.join(previewRoot, meta.prefix);
  const rewrite = stagePrefixedSite(siteDir, prefixed, meta.prefix, config.productionOrigins);
  const failures = [...build.failures, ...rewrite.escaping.slice(0, 20).map((e) => `unrewritten site URL: ${e}`)];
  const evidenceDir = path.join(runDir, 'evidence');
  fs.rmSync(evidenceDir, { recursive: true, force: true });

  const server = await startServer(previewRoot);
  let results;
  try {
    results = await runChecks({ origin: server.origin, prefix: meta.prefix, config, outDir: evidenceDir, executablePath: chromium, strictOverflow, label });
  } finally {
    await server.close();
  }
  results = settleCaptureOnly(results, config, meta.role);
  const passed = failures.length === 0 && results.every((r) => r.passed);
  const report = {
    schema: 1, repo: meta.repo, sha: meta.sha, role: meta.role, deliverable: meta.deliverable, pr: meta.pr,
    prefix: meta.prefix, builder, configSource, strictOverflow, generatedAt: new Date().toISOString(),
    build: { checks: build.checks, rewrittenFiles: rewrite.rewritten, unrewritten: rewrite.escaping.length },
    failures, results, passed,
  };
  writeJson(path.join(runDir, 'report.json'), report);
  writeJson(path.join(runDir, 'preview-manifest.json'), manifest(prefixed));
  fs.writeFileSync(path.join(runDir, 'report.md'), renderReport(report));
  return report;
}

export function renderReport(report) {
  const lines = [
    `### Acceptance: ${report.passed ? 'PASS' : 'FAIL'} (${report.role}${report.deliverable ? '' : ', NOT deliverable'})`,
    '',
    `Commit \`${report.sha}\` · builder ${report.builder}${report.configSource ? ` · checks from ${report.configSource}` : ''} · overflow gate ${report.strictOverflow ? 'strict' : 'report-only'}`,
    '',
    '| Route | Viewport | Result | Checks | Notes |',
    '|---|---|---|---|---|',
  ];
  for (const r of report.results) {
    const okCount = (r.assertions || []).filter((a) => a.ok).length;
    const notes = [...(r.failures || []), ...(r.warnings || [])].join('; ') || '—';
    lines.push(`| \`${r.path}\` | ${r.viewport} | ${r.passed ? '✅' : '❌'} | ${okCount}/${(r.assertions || []).length} | ${notes.replace(/\|/g, '\\|')} |`);
  }
  const hosts = [...new Set(report.results.flatMap((r) => r.externalBlocked || []))].sort();
  if (hosts.length) {
    lines.push('', `Third-party hosts blocked for isolation (their images/widgets appear missing in screenshots): ${hosts.map((h) => `\`${h}\``).join(', ')}`);
  }
  if (report.failures.length) lines.push('', 'Build failures:', ...report.failures.map((f) => `- ${f}`));
  return lines.join('\n') + '\n';
}
