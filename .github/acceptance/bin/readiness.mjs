#!/usr/bin/env node
// Final readiness for a PR head. Exit 0 = ready, 2 = blocked only by an external gate, 1 = not ready.
//   node .github/acceptance/bin/readiness.mjs RUN_DIR --pr N [--ux --baseline BASELINE_RUN_DIR] [--preview-backend ID] [--cloud-run BUILD_RUN_ID]
// The preview backend comes from --preview-backend, then COPILOT_PREVIEW_BACKEND, then preview.json.
import fs from 'node:fs';
import path from 'node:path';
import { evaluate, gatherFacts, verifyHostedPreview } from '../lib/readiness.mjs';
import { fail, parseArgs, prNumber, readJson, repoRoot, writeJson } from '../lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
try {
  const root = repoRoot();
  const runDir = path.resolve(args._[0] || '');
  const pr = prNumber(args.pr);
  const facts = gatherFacts({ root, runDir, pr, ux: !!args.ux, baselineDir: args.baseline && path.resolve(args.baseline), backendFlag: args['preview-backend'] });
  const r = facts.report;
  const manifestFile = path.join(runDir, 'preview-manifest.json');
  if (args['cloud-run']) {
    facts.cloudRequested = true;
    try {
      if (facts.backend?.id !== 'azure-receipt') throw new Error('--cloud-run requires the azure-receipt backend');
      const { gatherCloudProof } = await import('../lib/cloud-proof.mjs');
      facts.cloud = await gatherCloudProof({ runId: args['cloud-run'], runDir, pr, sha: r?.sha });
      facts.previewFetch = facts.cloud.verification;
      facts.hosted = facts.cloud.hosted;
    } catch (e) {
      const blocked = e.blocked || /^BLOCKED:/.test(e.message);
      facts.cloud = { status: blocked ? 'blocked' : 'fail', detail: e.status !== undefined ? 'cloud evidence could not be verified' : e.message };
      facts.previewFetch = { status: facts.cloud.status, detail: facts.cloud.detail };
    }
  } else if (facts.backend && r?.prefix && fs.existsSync(manifestFile)) {
    facts.previewFetch = await verifyHostedPreview({ backend: facts.backend, pr, report: r, expected: readJson(manifestFile) });
  }
  const result = evaluate(facts);
  writeJson(path.join(runDir, 'readiness.json'), { ...result, backend: facts.backend?.id || null,
    ...(facts.cloudRequested ? { cloud: facts.cloud } : {}), checkedAt: new Date().toISOString() });
  for (const g of result.gates) console.log(`${g.status.toUpperCase().padEnd(7)} ${g.id}: ${g.detail}`);
  console.log(`\nREADINESS: ${result.overall.toUpperCase()} for ${result.sha}`);
  process.exit(result.overall === 'ready' ? 0 : result.overall === 'blocked' ? 2 : 1);
} catch (e) {
  fail(e.message);
}
