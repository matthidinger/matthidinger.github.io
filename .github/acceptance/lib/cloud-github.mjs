import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { baselineConfig } from './pipeline.mjs';
import { BUILD_WORKFLOW, MAX_ARCHIVE, cloudReport, ensure, extractCandidate, positiveInt, selectArtifact, validateCandidate, validatePull, validateRun } from './cloud.mjs';
import { REPO_NWO, readJson, sh, sha256File } from './util.mjs';

export async function github(endpoint, { method = 'GET', body, raw = false } = {}) {
  ensure(endpoint.startsWith('/') && !endpoint.includes('..'), 'invalid GitHub endpoint');
  const token = process.env.GH_TOKEN || sh('gh', ['auth', 'token']);
  const res = await fetch(`https://api.github.com/repos/${REPO_NWO}${endpoint}`, {
    method, redirect: 'manual', signal: AbortSignal.timeout(30000),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (raw) return res;
  if (!res.ok) throw Object.assign(new Error(`GitHub ${method} ${endpoint.split('?')[0]} failed (${res.status})`), {
    blocked: [401, 403].includes(res.status),
  });
  return res.status === 204 ? null : res.json();
}

export async function pages(endpoint, key, api = github) {
  const all = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const batch = key ? result[key] : result;
    ensure(Array.isArray(batch), 'unexpected GitHub pagination response');
    all.push(...batch);
    if (batch.length < 100) return all;
  }
  throw new Error('GitHub pagination limit exceeded');
}

export async function downloadArtifact(artifact, destination) {
  const response = await github(`/actions/artifacts/${positiveInt(artifact.id)}/zip`, { raw: true });
  ensure(response.status === 302, `artifact download failed (${response.status})`);
  const url = new URL(response.headers.get('location'));
  ensure(url.protocol === 'https:' && !url.username && !url.password
    && (url.hostname.endsWith('.blob.core.windows.net') || url.hostname.endsWith('.actions.githubusercontent.com')), 'unexpected artifact download origin');
  // The signed download URL is used without the GitHub token, and is never logged.
  const data = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  ensure(data.ok && data.body, 'artifact body unavailable');
  let size = 0;
  const limiter = new Transform({ transform(chunk, encoding, callback) {
    size += chunk.length;
    callback(size > MAX_ARCHIVE ? new Error('artifact download too large') : null, chunk);
  } });
  await pipeline(data.body, limiter, fs.createWriteStream(destination, { flags: 'wx' }));
  ensure(`sha256:${sha256File(destination)}` === artifact.digest, 'GitHub artifact digest mismatch');
}

const sourceJson = (sha, rel) => JSON.parse(sh('git', ['show', `${sha}:${rel}`]));
const ancestor = (sha) => sh('git', ['merge-base', '--is-ancestor', sha, 'origin/master']);

// Every job re-queries live state, downloads the exact API-selected artifact and validates it afresh.
// No candidate metadata is used as a shell argument, executable, endpoint, or checkout ref.
export async function loadCandidate(runId, dir, { attempt, trustRef = 'HEAD' } = {}) {
  runId = positiveInt(runId);
  const run = await github(`/actions/runs/${runId}${attempt ? `/attempts/${positiveInt(attempt)}` : ''}`);
  const workflow = await github('/actions/workflows/build-preview.yml');
  ensure(run.repository?.full_name === REPO_NWO && run.workflow_id === workflow.id
    && run.path === BUILD_WORKFLOW && run.status === 'completed' && run.conclusion === 'success', 'source run is not an accepted website build');
  const artifact = selectArtifact(await pages(`/actions/runs/${runId}/artifacts`, 'artifacts'), run);
  fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(dir, 'candidate.zip');
  await downloadArtifact(artifact, zip);
  const extracted = path.join(dir, 'candidate');
  await extractCandidate(zip, extracted);
  const candidate = readJson(path.join(extracted, 'candidate.json'));
  const context = candidate.context;
  validateRun(run, workflow, context);
  positiveInt(context.pr);
  const pr = await github(`/pulls/${context.pr}`);
  validatePull(pr, context.pr, context.sha);

  sh('git', ['fetch', '--no-tags', 'origin', 'master:refs/remotes/origin/master']);
  sh('git', ['fetch', '--no-tags', 'origin', `refs/pull/${context.pr}/head`]);
  ensure(sh('git', ['rev-parse', 'FETCH_HEAD']) === context.sha, 'PR changed while fetching evidence sources');
  ancestor(context.baseSha);
  ancestor(context.toolingSha);
  if (run.event === 'workflow_dispatch') ancestor(run.head_sha);
  ensure(sh('git', ['merge-base', context.sha, context.baseSha]) === context.baselineSha, 'incorrect merge-base baseline');
  ensure(sh('git', ['merge-base', context.sha, 'origin/master']) === context.baselineSha, 'baseline no longer matches the current merge base');
  // PR event workflows are editable by the PR. Do not trust their reports unless the executed
  // definition matches ours. A master workflow_dispatch can safely build a tooling-changing PR.
  const workflowSha = run.head_sha;
  ensure(sh('git', ['show', `${workflowSha}:${BUILD_WORKFLOW}`]) === sh('git', ['show', `${trustRef}:${BUILD_WORKFLOW}`]), 'source workflow differs from trusted master; dispatch the master build instead');
  for (const rel of ['.github/acceptance/lib', '.github/acceptance/bin', '.github/acceptance/package.json', '.github/acceptance/package-lock.json']) {
    ensure(sh('git', ['rev-parse', `${context.toolingSha}:${rel}`]) === sh('git', ['rev-parse', `${trustRef}:${rel}`]), 'stale trusted acceptance tooling; a new build is required');
  }
  const headConfig = sourceJson(context.sha, '.github/acceptance/routes.json');
  const beforeConfig = baselineConfig(headConfig, sourceJson(context.baselineSha, '.github/acceptance/routes.json'));
  validateCandidate(extracted, candidate, { headConfig, beforeConfig });
  return { candidate, dir: extracted, artifact, report: cloudReport(candidate, artifact), run };
}

export async function freshHead(context, { historical = false } = {}) {
  validatePull(await github(`/pulls/${positiveInt(context.pr)}`), context.pr, context.sha);
  const run = await github(`/actions/runs/${positiveInt(context.runId)}${historical ? `/attempts/${positiveInt(context.runAttempt)}` : ''}`);
  ensure(run.run_attempt === context.runAttempt && run.status === 'completed' && run.conclusion === 'success',
    'source workflow was rerun or is no longer successful');
}
