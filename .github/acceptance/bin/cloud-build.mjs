#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { baselineConfig, acceptRun, stageSource } from '../lib/pipeline.mjs';
import { github } from '../lib/cloud-github.mjs';
import { BUILD_WORKFLOW, CLOUD_BUILDER, ensure, fullSha, positiveInt, validateConfig, validatePull } from '../lib/cloud.mjs';
import { REPO_NWO, headSha, manifest, readJson, sh, writeJson } from '../lib/util.mjs';

const contextFile = '.artifacts/cloud/context.json';
const output = (key, value) => fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
try {
  if (process.argv[2] === 'stage') {
    const pr = positiveInt(process.env.PR);
    const sha = fullSha(process.env.HEAD_SHA);
    ensure(process.env.GITHUB_REPOSITORY === REPO_NWO, 'wrong repository');
    const info = await github(`/pulls/${pr}`);
    validatePull(info, pr, sha, { allowFork: process.env.GITHUB_EVENT_NAME === 'pull_request' });
    const baseSha = fullSha(info.base.sha);
    sh('git', ['fetch', '--no-tags', 'origin', `refs/pull/${pr}/head`]);
    ensure(sh('git', ['rev-parse', 'FETCH_HEAD']) === sha, 'head moved before staging');
    sh('git', ['fetch', '--no-tags', 'origin', baseSha]);
    const baselineSha = fullSha(sh('git', ['merge-base', sha, baseSha]));
    for (const revision of [sha, baselineSha]) {
      ensure(!sh('git', ['ls-tree', '-r', revision]).split('\n').some((r) => /^(120000|160000) /.test(r)), 'source symlinks/submodules are not permitted');
    }
    const context = {
      repository: REPO_NWO, workflow: BUILD_WORKFLOW, pr, sha, baseSha, baselineSha,
      toolingSha: headSha(process.cwd()), runId: positiveInt(process.env.GITHUB_RUN_ID),
      runAttempt: positiveInt(process.env.GITHUB_RUN_ATTEMPT),
    };
    const head = stageSource({ root: process.cwd(), role: 'cloud', ref: sha, pr });
    const before = stageSource({ root: process.cwd(), role: 'baseline', ref: baselineSha, pr });
    writeJson(contextFile, context);
    output('head_dir', path.relative(process.cwd(), head.runDir));
    output('before_dir', path.relative(process.cwd(), before.runDir));
    output('baseline_sha', baselineSha);
  } else if (process.argv[2] === 'accept') {
    const context = readJson(contextFile);
    const headDir = `.artifacts/acceptance/pr-${context.pr}-${context.sha}`;
    const beforeDir = `.artifacts/acceptance/baseline-${context.baselineSha.slice(0, 12)}`;
    const config = readJson(path.join(headDir, 'src', '.github', 'acceptance', 'routes.json'));
    const beforeConfig = baselineConfig(config, readJson(path.join(beforeDir, 'src', '.github', 'acceptance', 'routes.json')));
    validateConfig(config);
    validateConfig(beforeConfig);
    ensure(config.routes.every((r) => !r.captureOnly), 'final expectations cannot be capture-only');
    const baselineReport = await acceptRun({
      runDir: beforeDir, siteDir: path.join(beforeDir, 'site'), config: beforeConfig,
      configSource: 'merge-base routes.json (+ capture-only additions)', builder: CLOUD_BUILDER, label: 'before',
    });
    const report = await acceptRun({
      runDir: headDir, siteDir: path.join(headDir, 'site'), config,
      configSource: 'exact PR head routes.json', builder: CLOUD_BUILDER, strictOverflow: true,
    });
    for (const [label, dir] of [['Before', beforeDir], ['After', headDir]]) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${label}\n\n${fs.readFileSync(path.join(dir, 'report.md'), 'utf8')}\n`);
    }
    ensure(report.passed && baselineReport.passed, 'head or baseline acceptance failed; see screenshot evidence');
    const dest = '.artifacts/cloud/candidate';
    ensure(!fs.existsSync(dest), 'candidate already exists');
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(path.join(headDir, 'preview', report.prefix), path.join(dest, 'site'), { recursive: true });
    fs.cpSync(path.join(headDir, 'evidence'), path.join(dest, 'evidence', 'after'), { recursive: true });
    fs.cpSync(path.join(beforeDir, 'evidence'), path.join(dest, 'evidence', 'before'), { recursive: true });
    writeJson(path.join(dest, 'candidate.json'), {
      schemaVersion: 1, context, config, baselineConfig: beforeConfig, report, baselineReport,
      files: manifest(path.join(dest, 'site')),
    });
  } else throw new Error('expected stage or accept');
} catch (e) {
  console.error(`Cloud acceptance failed: ${e.message}`);
  process.exitCode = 1;
}
