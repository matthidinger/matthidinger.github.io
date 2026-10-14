#!/usr/bin/env node
// Browser acceptance against the actual hosted preview of an accepted deliverable run.
//   node .github/acceptance/bin/check-hosted.mjs RUN_DIR --pr N [--preview-backend ID]
// First verifies the hosted revision (receipt + served bytes, or the private X-Preview-Revision link), then
// runs every routes.json check (including copy-code) in Chromium at the hosted origin and prefix.
// Writes RUN_DIR/hosted/report.json for readiness. Exit 0 pass, 2 external blocker, 1 fail.
import fs from 'node:fs';
import path from 'node:path';
import { runChecks } from '../lib/browser.mjs';
import { previewOrigin, resolveBackend } from '../lib/hosting.mjs';
import { verifyHostedPreview } from '../lib/readiness.mjs';
import { fail, loadConfig, parseArgs, prNumber, readJson, writeJson } from '../lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
try {
  const pr = prNumber(args.pr);
  const runDir = path.resolve(args._[0] || '');
  const report = readJson(path.join(runDir, 'report.json'));
  if (!report.deliverable || !report.passed) throw new Error('hosted checks need a passing deliverable run');
  if (report.pr !== pr) throw new Error(`run was accepted for PR ${report.pr}, not ${pr}`);
  const backend = resolveBackend({ flag: args['preview-backend'] });
  if (backend.type === 'header' && !backend.base) fail(`${backend.originEnv} is not configured; there is no hosted preview to check`, 2);
  const origin = backend.type === 'receipt' ? backend.origin : previewOrigin(backend.base);
  const outDir = path.join(runDir, 'hosted');
  fs.rmSync(outDir, { recursive: true, force: true });

  const verification = await verifyHostedPreview({ backend, pr, report, expected: readJson(path.join(runDir, 'preview-manifest.json')) });
  const base = { schema: 1, sha: report.sha, pr, prefix: report.prefix, backend: backend.id, origin, public: backend.public, strictOverflow: !!report.strictOverflow, verification: { status: verification.status, detail: verification.detail } };
  console.log(`${verification.status.toUpperCase()} hosted revision: ${verification.detail}`);
  if (verification.status !== 'pass') {
    writeJson(path.join(outDir, 'report.json'), { ...base, results: [], passed: false, checkedAt: new Date().toISOString() });
    process.exit(verification.status === 'blocked' ? 2 : 1);
  }

  const results = await runChecks({ origin, prefix: report.prefix, config: loadConfig(), outDir: path.join(outDir, 'evidence'), executablePath: args.chromium, strictOverflow: !!report.strictOverflow, label: 'hosted' });
  const passed = results.length > 0 && results.every((r) => r.passed);
  writeJson(path.join(outDir, 'report.json'), { ...base, results, passed, checkedAt: new Date().toISOString() });
  for (const r of results) {
    const copy = r.copyCode ? ` (copy-code ${r.copyCode.filter((a) => a.ok).length}/${r.copyCode.length})` : '';
    console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.viewport.padEnd(7)} ${r.path}${copy}${r.failures.length ? '\n    - ' + r.failures.join('\n    - ') : ''}`);
  }
  console.log(`\n${passed ? 'HOSTED CHECKS PASSED' : 'HOSTED CHECKS FAILED'} for ${report.sha} via ${backend.id}`);
  process.exit(passed ? 0 : 1);
} catch (e) {
  fail(e.message);
}
