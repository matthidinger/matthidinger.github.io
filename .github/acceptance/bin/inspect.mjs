#!/usr/bin/env node
// Record that every screenshot of a run was actually viewed, bound to the image hashes and commit.
//   node .github/acceptance/bin/inspect.mjs RUN_DIR --note "what was checked / what looked wrong"
import fs from 'node:fs';
import path from 'node:path';
import { verifyEvidence } from '../lib/readiness.mjs';
import { fail, parseArgs, readJson, writeJson } from '../lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
try {
  const runDir = path.resolve(args._[0] || '');
  const report = readJson(path.join(runDir, 'report.json'));
  if (typeof args.note !== 'string' || args.note.trim().length < 20) throw new Error('--note must describe what was inspected (>= 20 chars)');
  const ev = verifyEvidence(runDir, report);
  if (ev.missing.length || ev.mismatched.length) throw new Error(`evidence incomplete: ${[...ev.missing, ...ev.mismatched].join(', ')}`);
  const screenshots = Object.fromEntries(report.results.map((r) => [r.screenshot.file, r.screenshot.sha256]));
  writeJson(path.join(runDir, 'evidence', 'inspection.json'), { sha: report.sha, inspectedAt: new Date().toISOString(), notes: args.note.trim(), screenshots });
  console.log(`recorded inspection of ${Object.keys(screenshots).length} screenshots for ${report.sha}`);
} catch (e) {
  fail(e.message);
}
