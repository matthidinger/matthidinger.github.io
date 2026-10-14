#!/usr/bin/env node
// Build + browser acceptance.
//   node .github/acceptance/bin/accept.mjs --pr N                 deliverable run of clean HEAD on the pinned NAS runtime
//   node .github/acceptance/bin/accept.mjs --pr N --dev           working-tree run, explicitly NOT deliverable
//   node .github/acceptance/bin/accept.mjs --baseline-ref master  "before" evidence for UX work
//   --ux            strict page-level overflow gate (required for broad UX/redesign jobs)
//   --stage-only    stage sources and print the run dir (CI builds them with the Pages action)
//   --run DIR --site DIR --builder NAME   accept an already-built site (CI)
import path from 'node:path';
import { acceptRun, buildNas, stageSource } from '../lib/pipeline.mjs';
import { fail, loadConfig, parseArgs, prNumber, readJson, repoRoot } from '../lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
const root = repoRoot();
const config = loadConfig();

try {
  let runDir;
  let siteDir;
  let builder;
  if (args.run) {
    runDir = path.resolve(args.run);
    if (!args.site) throw new Error('--run requires --site');
    siteDir = path.resolve(args.site);
    builder = args.builder || 'external';
    const meta = readJson(path.join(runDir, 'meta.json'));
    if (meta.deliverable && args.pr && Number(args.pr) !== meta.pr) throw new Error('--pr does not match staged run');
  } else {
    const role = args['baseline-ref'] ? 'baseline' : args.dev ? 'development' : 'deliverable';
    const pr = role === 'deliverable' ? prNumber(args.pr) : args.pr ? prNumber(args.pr) : 0;
    const staged = stageSource({ root, role, ref: args['baseline-ref'], pr });
    runDir = staged.runDir;
    console.log(`staged ${staged.meta.role} ${staged.meta.sha} -> ${path.relative(root, runDir)}`);
    if (args['stage-only']) { console.log(`run_dir=${path.relative(root, runDir)}`); process.exit(0); }
    siteDir = buildNas(runDir);
    builder = 'nas-pages-build (GitHub Pages 232, PAGES_ENV=dotcom)';
    console.log('built with nas-pages-build');
  }
  const report = await acceptRun({
    runDir, siteDir, config, builder, strictOverflow: !!args.ux, chromium: args.chromium,
    label: args['baseline-ref'] ? 'before' : '',
  });
  for (const r of report.results) {
    console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.viewport.padEnd(7)} ${r.path}${r.failures.length ? '\n    - ' + r.failures.join('\n    - ') : ''}${r.warnings?.length ? '\n    ~ ' + r.warnings.join('\n    ~ ') : ''}`);
  }
  for (const f of report.failures) console.log(`FAIL build: ${f}`);
  console.log(`\n${report.passed ? 'ACCEPTANCE PASSED' : 'ACCEPTANCE FAILED'} for ${report.sha} (${report.role}${report.deliverable ? '' : ', not deliverable'})`);
  console.log(`report: ${path.relative(root, path.join(runDir, 'report.md'))}`);
  process.exit(report.passed ? 0 : 1);
} catch (e) {
  fail(e.message);
}
