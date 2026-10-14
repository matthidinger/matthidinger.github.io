#!/usr/bin/env node
import fs from 'node:fs';
import { ensure } from '../lib/cloud.mjs';
import { github, pages } from '../lib/cloud-github.mjs';
import { shouldDispatch } from '../lib/cloud-reconcile.mjs';
import { REPO_NWO } from '../lib/util.mjs';

try {
  ensure(process.env.GITHUB_REPOSITORY === REPO_NWO && process.env.GITHUB_REF === 'refs/heads/master', 'reconciler must run from website/master');
  const prs = await pages('/pulls?state=open&base=master');
  const runs = await pages('/actions/workflows/build-preview.yml/runs', 'workflow_runs');
  let dispatched = 0;
  for (const pr of prs) {
    if (pr.head?.repo?.full_name !== REPO_NWO) continue;
    const checks = await pages(`/commits/${pr.head.sha}/check-runs`, 'check_runs');
    if (!shouldDispatch(pr, runs, checks)) continue;
    const live = await github(`/pulls/${pr.number}`);
    if (live.head.sha !== pr.head.sha || live.state !== 'open') continue;
    await github('/actions/workflows/build-preview.yml/dispatches', {
      method: 'POST', body: { ref: 'master', inputs: { pr: String(pr.number), head_sha: pr.head.sha } },
    });
    dispatched++;
  }
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Dispatched ${dispatched} missing same-repository PR/head build(s). Fork approvals, failed dispatches and visual review are not bypassed.\n`);
} catch (e) {
  console.error(`Preview reconciliation failed: ${e.message}`);
  process.exitCode = 1;
}
