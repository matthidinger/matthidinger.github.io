import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ACCEPTANCE_DIR } from '../lib/util.mjs';

const workflow = (file) => fs.readFileSync(path.join(ACCEPTANCE_DIR, '..', 'workflows', file), 'utf8');
const build = workflow('build-preview.yml');
const publish = workflow('publish-preview.yml');
const reconcile = workflow('reconcile-previews.yml');
const tooling = workflow('test-acceptance.yml');
const job = (text, name) => text.split(new RegExp(`^  ${name}:\\r?$`, 'm'))[1]?.split(/^  [a-z][a-z-]*:\r?$/m)[0];

test('workflow trust boundaries: no public-PR NAS runner/target trigger, pinned actions, no cached PR tools', () => {
  for (const text of [build, publish, reconcile, tooling]) {
    assert.doesNotMatch(text, /self-hosted|pull_request_target|actions\/cache|secrets\.inherit/);
    for (const line of text.split('\n').filter((l) => /^\s+- uses:/.test(l)))
      assert.match(line, /@[a-f0-9]{40}(?:\s|$)/);
    assert.doesNotMatch(text, /persist-credentials:\s*true/);
  }
  assert.match(build, /^run-name: ['"]Preview PR #/m, 'YAML # must not truncate the run/head association');
  assert.match(build, /pull_request:[\s\S]*branches: \[master\]/);
  assert.match(build, /workflow_dispatch:/);
  assert.doesNotMatch(build, /id-token:|environment:|:\s*write\b/);
  assert.match(build, /ref: master/);
});

test('proposed PR tooling executes only in a separate read-only workflow, never the candidate artifact namespace', () => {
  assert.doesNotMatch(tooling, /id-token:|environment:|:\s*write\b|upload-artifact/);
  assert.match(tooling, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(tooling, /npm --prefix .github\/acceptance test/);
  assert.match(publish, /workflows: \[Build preview\]/);
  assert.doesNotMatch(build, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
});

test('only the fixed preview environment job can obtain Azure tokens; browser/announcement jobs cannot', () => {
  const credentialJob = job(publish, 'publish');
  assert.match(credentialJob, /environment: website-preview/);
  assert.match(credentialJob, /id-token: write/);
  assert.match(credentialJob, /azure\/login@[a-f0-9]{40}/);
  assert.doesNotMatch(credentialJob, /cloud-preview\.mjs hosted|cloud-build\.mjs|refs\/pull|head\.sha/);
  for (const name of ['gate', 'hosted', 'announce']) {
    assert.doesNotMatch(job(publish, name), /id-token:|environment:|azure\/login/);
    assert.match(job(publish, name), /ref: \$\{\{ github.sha \}\}/);
  }
  assert.doesNotMatch(job(publish, 'hosted'), /:\s*write\b/);
  assert.match(job(publish, 'announce'), /needs: \[gate, publish, hosted\]/);
  assert.match(publish, /permissions: \{\}/);
  assert.match(publish, /github.ref == 'refs\/heads\/master'/);
  assert.doesNotMatch(publish, /cancel-in-progress: true/);
});

test('reconciler is cloud-only/master-only with a scheduled/manual fallback, not a deployment identity', () => {
  assert.match(reconcile, /cron: '17,47 \* \* \* \*'/);
  assert.match(reconcile, /workflow_dispatch:/);
  assert.match(reconcile, /actions: write/);
  assert.match(reconcile, /github.ref == 'refs\/heads\/master'/);
  assert.doesNotMatch(reconcile, /id-token:|environment:|deployments:|azure\/login/);
});
