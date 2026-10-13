#!/usr/bin/env node
// Final readiness for a PR head. Exit 0 = ready, 2 = blocked only by an external gate, 1 = not ready.
//   node .github/acceptance/bin/readiness.mjs RUN_DIR --pr N [--ux --baseline BASELINE_RUN_DIR]
import path from 'node:path';
import { evaluate, gatherFacts, verifyPreviewLink } from '../lib/readiness.mjs';
import { fail, parseArgs, prNumber, readJson, repoRoot, writeJson } from '../lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
try {
  const root = repoRoot();
  const runDir = path.resolve(args._[0] || '');
  const facts = gatherFacts({ root, runDir, pr: prNumber(args.pr), ux: !!args.ux, baselineDir: args.baseline && path.resolve(args.baseline) });
  const r = facts.report;
  if (facts.previewBaseUrl && r?.prefix) {
    facts.previewFetch = await verifyPreviewLink({
      base: facts.previewBaseUrl, prefix: r.prefix, sha: r.sha,
      paths: r.results.map((x) => x.path), expected: readJson(path.join(runDir, 'preview-manifest.json')),
    });
  }
  const result = evaluate(facts);
  writeJson(path.join(runDir, 'readiness.json'), { ...result, checkedAt: new Date().toISOString() });
  for (const g of result.gates) console.log(`${g.status.toUpperCase().padEnd(7)} ${g.id}: ${g.detail}`);
  console.log(`\nREADINESS: ${result.overall.toUpperCase()} for ${result.sha}`);
  process.exit(result.overall === 'ready' ? 0 : result.overall === 'blocked' ? 2 : 1);
} catch (e) {
  fail(e.message);
}
