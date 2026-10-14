import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { CLOUD_ORIGIN, ensure, extractCandidate, positiveInt, selectArtifact, validateResults } from './cloud.mjs';
import { downloadArtifact, freshHead, github, loadCandidate, pages } from './cloud-github.mjs';
import { chooseImmutableCandidate, verifyCloud } from './cloud-publish.mjs';
import { hostedErrors } from './hosting.mjs';
import { REPO_NWO, readJson, sh } from './util.mjs';

export function validatePublication(run, check, report) {
  ensure(check.name === 'preview-verified' && check.app?.slug === 'github-actions' && check.head_sha === report.sha && check.conclusion === 'success', 'current-head preview check has not succeeded');
  ensure(run.repository?.full_name === REPO_NWO && run.head_repository?.full_name === REPO_NWO
    && run.path === '.github/workflows/publish-preview.yml' && run.head_branch === 'master'
    && ['workflow_run', 'workflow_dispatch'].includes(run.event), 'untrusted publication workflow');
  ensure(run.status === 'completed' && run.conclusion === 'success', 'publication workflow has not completed successfully');
  ensure(check.details_url === `https://github.com/${REPO_NWO}/actions/runs/${positiveInt(run.id)}`, 'preview check/publication run mismatch');
}

export function validateHostedProof(hosted, report, publicationId) {
  ensure(isDeepStrictEqual(hosted.provenance, report.provenance), 'hosted provenance differs from the accepted cloud artifact');
  ensure(hosted.publicationRunId === publicationId, 'hosted checks belong to a different publication run');
  const errors = hostedErrors(hosted, { report, pr: report.pr, backend: { id: 'azure-receipt' }, origin: CLOUD_ORIGIN });
  ensure(errors.length === 0, errors.join('; '));
}

// Joins, but never conflates, NAS evidence with the Actions-built immutable preview. Downloads and
// inspects data only; it neither runs a site build nor claims NAS/visual acceptance.
export async function gatherCloudProof({ runId, runDir, sha, pr }) {
  const temp = fs.mkdtempSync(path.join(runDir, 'cloud-proof-'));
  try {
    const current = await loadCandidate(positiveInt(runId), path.join(temp, 'current'), { trustRef: 'origin/master' });
    ensure(current.report.sha === sha && current.report.pr === pr, 'cloud build does not match the NAS evidence PR/head');
    const selected = await chooseImmutableCandidate(current, {
      loadPrevious: (id, attempt) => loadCandidate(id, path.join(temp, 'original'), { attempt, trustRef: 'origin/master' }),
    });
    const { report, candidate } = selected;
    const checks = (await pages(`/commits/${sha}/check-runs`, 'check_runs'))
      .filter((c) => c.name === 'preview-verified' && c.app?.slug === 'github-actions').sort((a, b) => b.id - a.id);
    const check = checks[0];
    const prefix = `https://github.com/${REPO_NWO}/actions/runs/`;
    ensure(check?.details_url?.startsWith(prefix) && /^[1-9][0-9]*$/.test(check.details_url.slice(prefix.length)), 'no trusted publication run link');
    const publication = await github(`/actions/runs/${positiveInt(check.details_url.slice(prefix.length))}`);
    validatePublication(publication, check, report);
    sh('git', ['merge-base', '--is-ancestor', publication.head_sha, 'origin/master']);
    ensure(sh('git', ['show', `${publication.head_sha}:.github/workflows/publish-preview.yml`])
      === sh('git', ['show', 'origin/master:.github/workflows/publish-preview.yml']), 'publication workflow differs from trusted master');
    const artifact = selectArtifact(await pages(`/actions/runs/${publication.id}/artifacts`, 'artifacts'), publication,
      `hosted-evidence-${publication.id}-${publication.run_attempt}`);
    const zip = path.join(temp, 'hosted.zip'), dest = path.join(temp, 'hosted');
    await downloadArtifact(artifact, zip);
    await extractCandidate(zip, dest, { hosted: true });
    const hosted = readJson(path.join(dest, 'report.json'));
    validateHostedProof(hosted, report, publication.id);
    validateResults({ ...hosted, role: 'cloud', deliverable: false, builder: report.builder, failures: [] },
      candidate.config, sha, 'cloud', path.join(dest, 'evidence'));
    const verification = await verifyCloud(report, candidate.files);
    if (verification.status !== 'pass') throw Object.assign(new Error(verification.detail), { blocked: verification.status === 'blocked' });
    await freshHead(current.candidate.context);
    if (selected.reused) await freshHead(candidate.context, { historical: true });
    return { status: 'pass', report, hosted, verification, publicationRunId: publication.id,
      detail: `Actions build ${report.provenance.runId}/${report.provenance.runAttempt}, artifact ${report.provenance.artifactId}, publication ${publication.id}: digest, receipt, every hosted file and browser evidence verified for ${sha}` };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
