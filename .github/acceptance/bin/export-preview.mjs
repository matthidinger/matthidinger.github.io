#!/usr/bin/env node
// Publish an accepted deliverable run into the runtime-provided preview volume:
//   COPILOT_PREVIEW_ROOT/matthidinger.github.io/pr-N/FULL_SHA/site (disk), served at URL /matthidinger.github.io/pr-N/FULL_SHA/
// The package is the accepted site plus site/preview-revision.json (the revision receipt).
// Requires a clean tree whose HEAD is the PR head. Never overwrites a published revision.
//   node .github/acceptance/bin/export-preview.mjs RUN_DIR --pr N [--preview-backend ID]
import path from 'node:path';
import { resolveBackend } from '../lib/hosting.mjs';
import { exportPreview, prInfo, validateAssociation } from '../lib/preview.mjs';
import { dirtyFiles, fail, headSha, parseArgs, prNumber, readJson, repoRoot } from '../lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
try {
  const root = repoRoot();
  const pr = prNumber(args.pr);
  const runDir = path.resolve(args._[0] || '');
  const report = readJson(path.join(runDir, 'report.json'));
  if (report.pr !== pr) throw new Error(`run was accepted for PR ${report.pr}, not ${pr}`);
  const backend = resolveBackend({ flag: args['preview-backend'] });
  const dirty = dirtyFiles(root);
  if (dirty.length) throw new Error('working tree is dirty; refusing to publish');
  const errors = validateAssociation({ pr, sha: report.sha, head: headSha(root), info: prInfo(pr) });
  if (errors.length) throw new Error(errors.join('; '));
  const res = exportPreview({ runDir, previewRoot: process.env.COPILOT_PREVIEW_ROOT });
  console.log(`${res.status}: ${res.files} site files + preview-revision.json for PR #${pr} @ ${report.sha}`);
  if (backend.type === 'receipt') {
    console.log(`backend ${backend.id}: an operator publishes this package unchanged; it is not live until readiness verifies it.`);
    console.log(`expected deep link (approved public origin): ${backend.origin}${report.prefix}/`);
  } else if (backend.base) {
    console.log(`deep link (private; do not post unless its origin is approved for disclosure): ${backend.base.replace(/\/+$/, '')}${report.prefix}/`);
  } else {
    console.log(`BLOCKED: ${backend.originEnv} is not configured; no preview link exists yet.`);
  }
} catch (e) {
  fail(e.message, e.blocked ? 2 : 1);
}
