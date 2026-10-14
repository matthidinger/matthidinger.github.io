#!/usr/bin/env node
import fs from 'node:fs';
import { runChecks } from '../lib/browser.mjs';
import { BUILD_WORKFLOW, CLOUD_ORIGIN, ensure, positiveInt, previewDeployment, previewSuccess, validatePull } from '../lib/cloud.mjs';
import { freshHead, github, loadCandidate, pages } from '../lib/cloud-github.mjs';
import { azureStore, chooseImmutableCandidate, publishImmutable, verifyCloud } from '../lib/cloud-publish.mjs';
import { REPO_NWO, writeJson } from '../lib/util.mjs';

const output = (key, value) => fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
const summary = (text) => fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
const command = process.argv[2];
let failureReported = false;

// Invalid/missing candidates must still show a failure on the associated current head. This path
// trusts only GitHub metadata and never posts an artifact's diagnostic text or a preview URL.
async function reportFailure() {
  const run = await github(`/actions/runs/${positiveInt(process.env.SOURCE_RUN_ID)}`);
  const workflow = await github('/actions/workflows/build-preview.yml');
  ensure(run.repository?.full_name === REPO_NWO && run.head_repository?.full_name === REPO_NWO
    && run.path === BUILD_WORKFLOW && run.workflow_id === workflow.id, 'no eligible workflow association for failure reporting');
  const match = /^Preview PR #([1-9][0-9]*) @ ([0-9a-f]{40})$/.exec(run.display_title || '');
  ensure(match, 'no exact PR/head association for failure reporting');
  const pr = positiveInt(match[1]), sha = match[2];
  ensure((run.event === 'pull_request' && run.head_sha === sha)
    || (run.event === 'workflow_dispatch' && run.head_branch === 'master'), 'ineligible source event');
  validatePull(await github(`/pulls/${pr}`), pr, sha);
  const url = `https://github.com/${REPO_NWO}/actions/runs/${positiveInt(process.env.GITHUB_RUN_ID)}`;
  await github('/check-runs', { method: 'POST', body: {
    name: 'preview-verified', head_sha: sha, status: 'completed', conclusion: 'failure', details_url: url,
    output: { title: 'Preview blocked or failed', summary: `No verified preview for this head; inspect the [preview workflow](${url}).` },
  } });
}
try {
  ensure(process.env.GITHUB_REPOSITORY === REPO_NWO && process.env.GITHUB_REF === 'refs/heads/master', 'publisher must run from this repository/master');
  const current = await loadCandidate(process.env.SOURCE_RUN_ID, '.artifacts/cloud-input');
  const selected = await chooseImmutableCandidate(current, {
    loadPrevious: (runId, attempt) => loadCandidate(runId, '.artifacts/cloud-existing', { attempt }),
  });
  const { candidate: c, report, dir, artifact } = selected;
  const assertFresh = async () => {
    await freshHead(current.candidate.context);
    if (selected.reused) await freshHead(c.context, { historical: true });
  };
  const runUrl = `https://github.com/${REPO_NWO}/actions/runs/${positiveInt(process.env.GITHUB_RUN_ID)}`;
  const buildUrl = `https://github.com/${REPO_NWO}/actions/runs/${c.context.runId}`;
  if (command === 'gate') {
    output('pr', c.context.pr);
    output('sha', c.context.sha);
    summary(`Accepted cloud candidate for PR #${c.context.pr} at \`${c.context.sha}\`; build [${c.context.runId}](${buildUrl}), attempt ${c.context.runAttempt}, artifact ${artifact.id}.`);
  } else if (command === 'publish') {
    await publishImmutable({ dir, report, files: c.files, store: azureStore(), assertFresh });
    const verification = await verifyCloud(report, c.files);
    ensure(verification.status === 'pass', `${verification.status.toUpperCase()}: ${verification.detail}`);
    summary(`Exact preview receipt and ${Object.keys(c.files).length} hosted files verified; hosted browser checks still required.`);
  } else if (command === 'hosted') {
    const verification = await verifyCloud(report, c.files);
    ensure(verification.status === 'pass', `${verification.status.toUpperCase()}: ${verification.detail}`);
    // This job has no environment, OIDC permission, Azure token or GitHub write permission.
    const results = await runChecks({ origin: CLOUD_ORIGIN, prefix: report.prefix, config: c.config,
      outDir: '.artifacts/hosted/evidence', strictOverflow: true });
    writeJson('.artifacts/hosted/report.json', {
      schemaVersion: 1, sha: report.sha, pr: report.pr, prefix: report.prefix, provenance: report.provenance,
      publicationRunId: positiveInt(process.env.GITHUB_RUN_ID), origin: CLOUD_ORIGIN,
      backend: 'azure-receipt', public: true, checkedAt: new Date().toISOString(),
      strictOverflow: true, verification, results, passed: results.every((r) => r.passed),
      visualInspection: 'pending',
    });
    ensure(results.length === c.config.routes.length * c.config.viewports.length && results.every((r) => r.passed),
      `hosted browser acceptance failed: ${results.flatMap((r) => r.failures || []).slice(0, 5).join('; ')}`);
    await assertFresh();
    output('sha', report.sha);
    summary(`${results.length} hosted route/viewport cases passed, including the head's navigation and copy-code checks. Visual inspection remains required.`);
  } else if (command === 'announce') {
    await assertFresh();
    const passed = process.env.PUBLISH_RESULT === 'success' && process.env.HOSTED_RESULT === 'success' && process.env.HOSTED_SHA === report.sha;
    let url;
    if (passed) {
      const verification = await verifyCloud(report, c.files);
      ensure(verification.status === 'pass', `${verification.status.toUpperCase()}: ${verification.detail}`);
      await assertFresh();
      url = CLOUD_ORIGIN + report.prefix + '/';
      const deployment = await github('/deployments', {
        method: 'POST', body: previewDeployment(report, positiveInt(process.env.GITHUB_RUN_ID)),
      });
      positiveInt(deployment.id);
      try {
        await assertFresh();
        await github(`/deployments/${deployment.id}/statuses`, {
          method: 'POST', body: previewSuccess(report, positiveInt(process.env.GITHUB_RUN_ID)),
        });
      } catch (e) {
        await github(`/deployments/${deployment.id}/statuses`, { method: 'POST', body: {
          state: 'failure', log_url: runUrl, auto_inactive: false, description: 'Preview was not verified for the current open PR head.',
        } });
        throw e;
      }
    }
    const text = passed
      ? `Preview for \`${report.sha}\`: [View deployment](${url}) ([cloud build and screenshots](${buildUrl}), [hosted checks](${runUrl})); exact bytes and page interactions passed, visual review is pending.`
      : `Preview for \`${report.sha}\` is blocked or failed ([details](${runUrl})); publication=${process.env.PUBLISH_RESULT}, hosted checks=${process.env.HOSTED_RESULT}; no verified preview link is available.`;
    await github('/check-runs', { method: 'POST', body: {
      name: 'preview-verified', head_sha: report.sha, status: 'completed', conclusion: passed ? 'success' : 'failure',
      details_url: runUrl, output: { title: passed ? 'Cloud preview verified; visual review pending' : 'Preview blocked or failed', summary: text },
    } });
    failureReported = !passed;
    await assertFresh();
    const marker = '<!-- automatic-website-preview -->';
    const existing = (await pages(`/issues/${report.pr}/comments`)).filter((x) => x.user?.login === 'github-actions[bot]' && x.body?.startsWith(marker));
    ensure(existing.length <= 1, 'multiple automatic preview comments; refusing ambiguous update');
    await github(existing.length ? `/issues/comments/${positiveInt(existing[0].id)}` : `/issues/${report.pr}/comments`, {
      method: existing.length ? 'PATCH' : 'POST', body: { body: marker + '\n' + text },
    });
    writeJson('.artifacts/cloud-readiness.json', {
      schemaVersion: 1, status: passed ? 'preview-verified' : 'blocked-or-failed', sha: report.sha, pr: report.pr,
      provenance: report.provenance, publicationRunId: positiveInt(process.env.GITHUB_RUN_ID),
      requestedBuild: current.candidate.context, reusedImmutableRevision: !!selected.reused,
      visualInspection: 'pending', nasReadiness: 'not-evaluated', ...(url ? { url } : {}),
    });
    summary(text);
    ensure(passed, 'preview remains blocked or failed');
  } else throw new Error('expected gate, publish, hosted or announce');
} catch (e) {
  // Tool stderr can contain account diagnostics. Only the bounded, public failure class is logged.
  const message = e.status !== undefined ? 'External tool failed; preview was not published/verified.' : e.message;
  console.error(`Preview failed: ${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) summary(`Preview failed: ${message}`);
  if (command === 'announce' && !failureReported && process.env.GITHUB_REPOSITORY === REPO_NWO && process.env.GITHUB_REF === 'refs/heads/master') {
    try { await reportFailure(); } catch {
      console.error('Failure could not be associated with a current eligible PR head; see the failed workflow run.');
    }
  }
  process.exitCode = 1;
}
