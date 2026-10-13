#!/usr/bin/env node
// Final readiness for a PR head. Exit 0 = ready, 2 = blocked only by an external gate, 1 = not ready.
//   node .github/acceptance/bin/readiness.mjs RUN_DIR --pr N [--ux --baseline BASELINE_RUN_DIR]
import path from 'node:path';
import { evaluate, gatherFacts } from '../lib/readiness.mjs';
import { fail, parseArgs, prNumber, repoRoot, writeJson } from '../lib/util.mjs';

async function checkPreview(base, prefix) {
  const url = `${base.replace(/\/+$/, '')}${prefix}/talks/`;
  const anon = await fetch(url, { redirect: 'manual' }).catch((e) => ({ status: 0, error: e.message }));
  if (anon.status === 200) return { ok: false, detail: 'preview is publicly readable without authentication' };
  const header = process.env.COPILOT_PREVIEW_AUTH_HEADER;
  if (!header) return { ok: false, detail: 'no runtime-provided authenticated check (COPILOT_PREVIEW_AUTH_HEADER) to confirm access' };
  const i = header.indexOf(':');
  const res = await fetch(url, { headers: { [header.slice(0, i).trim()]: header.slice(i + 1).trim() } }).catch(() => null);
  const text = res ? await res.text() : '';
  return res?.status === 200 && text.includes('Talks') ? { ok: true } : { ok: false, detail: `authenticated request returned ${res?.status ?? 'error'}` };
}

const args = parseArgs(process.argv.slice(2));
try {
  const root = repoRoot();
  const runDir = path.resolve(args._[0] || '');
  const facts = gatherFacts({ root, runDir, pr: prNumber(args.pr), ux: !!args.ux, baselineDir: args.baseline && path.resolve(args.baseline) });
  if (facts.previewBaseUrl && facts.report?.prefix) facts.previewFetch = await checkPreview(facts.previewBaseUrl, facts.report.prefix);
  const result = evaluate(facts);
  writeJson(path.join(runDir, 'readiness.json'), { ...result, checkedAt: new Date().toISOString() });
  for (const g of result.gates) console.log(`${g.status.toUpperCase().padEnd(7)} ${g.id}: ${g.detail}`);
  console.log(`\nREADINESS: ${result.overall.toUpperCase()} for ${result.sha}`);
  process.exit(result.overall === 'ready' ? 0 : result.overall === 'blocked' ? 2 : 1);
} catch (e) {
  fail(e.message);
}
