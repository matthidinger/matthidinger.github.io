import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { baselineConfig, renderReport, runConfig, settleCaptureOnly, stageSource } from '../lib/pipeline.mjs';

const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 900 }];
const BUILD = { productionShape: {}, mustNotExist: [] };
const OLD = {
  viewports: VIEWPORTS, build: BUILD, productionOrigins: [],
  routes: [
    { id: 'home', path: '/', text: ['Program Manager'], knownPageErrors: [{ message: 'google is not defined', reason: 'old layout' }] },
    { id: 'blog', path: '/blog/', h1: 'Blog' },
  ],
};
const NEW = {
  viewports: VIEWPORTS, build: BUILD, productionOrigins: [],
  routes: [
    { id: 'home', path: '/', text: ['Product Manager'], selectors: { '.dk-hero': 1 } },
    { id: 'blog', path: '/blog/', h1: 'Blog', interactions: [{ name: 'home', click: 'a[href$="/"]', expectPath: '/' }] },
    { id: 'about', path: '/about/', h1: 'About', text: ['Product Manager'], interactions: [{ name: 'home', click: 'a', expectPath: '/' }] },
    { id: 'blog-renamed', path: '/blog/', h1: 'Blog' },
  ],
};

function repoWithRoutes() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-base-'));
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(repo, '.github', 'acceptance'), { recursive: true });
  const write = (cfg) => fs.writeFileSync(path.join(repo, '.github', 'acceptance', 'routes.json'), JSON.stringify(cfg));
  write(OLD); git('add', '.'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  write(NEW); git('add', '.'); git('commit', '-qm', 'head');
  return { repo, base };
}

test('baseline runs are checked against the routes.json committed at the baseline, not HEAD (regression)', () => {
  const { repo, base } = repoWithRoutes();
  const staged = stageSource({ root: repo, role: 'baseline', ref: base });
  const { config, source } = runConfig({ runDir: staged.runDir, role: 'baseline', headConfig: NEW });
  assert.match(source, /baseline routes\.json/);
  const home = config.routes.find((r) => r.id === 'home');
  assert.deepEqual(home.text, ['Program Manager'], 'old homepage keeps its own expectations');
  assert.equal(home.selectors, undefined, 'HEAD-only selectors are not demanded of the baseline');
  assert.equal(home.knownPageErrors[0].message, 'google is not defined', "the baseline's known errors still apply");
  assert.equal(config.routes.find((r) => r.id === 'blog').interactions, undefined, 'HEAD-only navigation is not demanded of the baseline');
});

test('routes added since the baseline keep before coverage as capture-only, without HEAD expectations', () => {
  const config = baselineConfig(NEW, OLD);
  const about = config.routes.find((r) => r.id === 'about');
  assert.deepEqual(Object.keys(about).sort(), ['captureOnly', 'id', 'path', 'purpose']);
  assert.equal(about.captureOnly, true);
  assert.equal(config.routes.filter((r) => r.path === '/blog/').length, 1, 'a renamed route on an existing path is not captured twice');
  assert.deepEqual(baselineConfig(NEW, null).routes.map((r) => [r.id, !!r.captureOnly]), [['home', true], ['blog', true], ['about', true], ['blog-renamed', true]]);
});

test('deliverable and development runs always use the checkout routes.json unchanged', () => {
  for (const role of ['deliverable', 'development']) {
    const { config } = runConfig({ runDir: fs.mkdtempSync(path.join(os.tmpdir(), 'acc-run-')), role, headConfig: NEW });
    assert.equal(config, NEW);
  }
});

test('capture-only failures are report-only in baseline runs and can never relax other runs', () => {
  const config = baselineConfig(NEW, OLD);
  const results = [
    { route: 'home', viewport: 'desktop', failures: ['text "Program Manager": missing'], passed: false },
    { route: 'about', viewport: 'desktop', failures: ['document status 404 for /about/'], passed: false },
  ];
  const settled = settleCaptureOnly(results, config, 'baseline');
  assert.equal(settled[0].passed, false, "the baseline's own contract still fails");
  assert.equal(settled[1].passed, true);
  assert.deepEqual(settled[1].failures, []);
  assert.deepEqual(settled[1].warnings, ['capture only: document status 404 for /about/']);
  for (const role of ['deliverable', 'development']) {
    assert.deepEqual(settleCaptureOnly(results, config, role), results, `${role} ignores captureOnly`);
  }
  assert.match(renderReport({ sha: 'b'.repeat(40), role: 'baseline', builder: 'nas', configSource: 'baseline routes.json', strictOverflow: false, results: settled, failures: [], passed: false }), /checks from baseline routes\.json/);
});
