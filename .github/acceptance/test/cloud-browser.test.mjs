import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findChromium, runChecks } from '../lib/browser.mjs';
import { acceptRun, baselineConfig } from '../lib/pipeline.mjs';
import { CLOUD_BUILDER, cloudReport, validateCandidate } from '../lib/cloud.mjs';
import { publishImmutable, verifyCloud } from '../lib/cloud-publish.mjs';
import { startServer } from '../lib/server.mjs';
import { REPO_NWO, manifest, previewPrefix, sha256, writeJson } from '../lib/util.mjs';

let chromium;
try { chromium = findChromium(); } catch { /* Existing runner contract: browser tests require Chromium. */ }

test('real browser: head/baseline candidate -> immutable package -> exact hosted bytes/navigation, including a negative navigation', {
  skip: !chromium && 'no Chromium available', timeout: 120000,
}, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-browser-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sha = 'a'.repeat(40), base = 'b'.repeat(40), pr = 12;
  const config = {
    productionOrigins: ['https://matthidinger.com'], build: { productionShape: { CNAME: ['matthidinger.com'] }, mustNotExist: ['.github', '_config.yml'] },
    routes: [
      { id: 'home', path: '/', title: 'Fixture', h1: 'Fixture', interactions: [{ name: 'next', click: '#next', expectPath: '/next/' }] },
      { id: 'next', path: '/next/', title: 'Fixture', h1: 'Fixture' },
    ],
    viewports: [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true }],
  };
  const beforeConfig = baselineConfig(config, { ...config, routes: [config.routes[0]] });
  const html = `<!doctype html><html><head><title>Fixture</title><link rel="stylesheet" href="/style.css"></head><body><h1>Fixture</h1><p>${'Public fixture text. '.repeat(30)}</p><div class="ink"></div><a id="next" href="/next/">Next</a></body></html>`;
  const makeRun = (role, revision) => {
    const dir = path.join(root, role);
    fs.mkdirSync(path.join(dir, 'site', 'next'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'site', 'index.html'), html);
    fs.writeFileSync(path.join(dir, 'site', 'next', 'index.html'), html);
    fs.writeFileSync(path.join(dir, 'site', 'CNAME'), 'matthidinger.com');
    fs.writeFileSync(path.join(dir, 'site', 'style.css'), 'body{font:16px sans-serif;color:#222;margin:20px}.ink{height:100px;background:#222}');
    writeJson(path.join(dir, 'meta.json'), { repo: REPO_NWO, sha: revision, role, deliverable: false, pr, prefix: previewPrefix(pr, revision) });
    return dir;
  };
  const headDir = makeRun('cloud', sha), beforeDir = makeRun('baseline', base);
  const report = await acceptRun({ runDir: headDir, siteDir: path.join(headDir, 'site'), config, builder: CLOUD_BUILDER, strictOverflow: true, chromium });
  const baselineReport = await acceptRun({ runDir: beforeDir, siteDir: path.join(beforeDir, 'site'), config: beforeConfig, builder: CLOUD_BUILDER, chromium, label: 'before' });
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.equal(baselineReport.passed, true, JSON.stringify(baselineReport));
  const dir = path.join(root, 'candidate');
  fs.cpSync(path.join(headDir, 'preview', report.prefix), path.join(dir, 'site'), { recursive: true });
  fs.cpSync(path.join(headDir, 'evidence'), path.join(dir, 'evidence', 'after'), { recursive: true });
  fs.cpSync(path.join(beforeDir, 'evidence'), path.join(dir, 'evidence', 'before'), { recursive: true });
  const candidate = { schemaVersion: 1, context: { pr, sha, baselineSha: base, toolingSha: base, runId: 42, runAttempt: 1 },
    report, baselineReport, config, baselineConfig: beforeConfig, files: manifest(path.join(dir, 'site')) };
  writeJson(path.join(dir, 'candidate.json'), candidate);
  validateCandidate(dir, candidate, { headConfig: config, beforeConfig });
  const cloud = cloudReport(candidate, { id: 123, digest: `sha256:${'d'.repeat(64)}` });
  const hostedRoot = path.join(root, 'hosted');
  fs.mkdirSync(hostedRoot);
  const blobs = new Map();
  const store = {
    list: async () => [],
    read: async (name) => blobs.get(name),
    create: async (name, bytes) => {
      blobs.set(name, Buffer.from(bytes));
      const file = path.join(hostedRoot, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes, { flag: 'wx' });
    },
  };
  await publishImmutable({ dir, report: cloud, files: candidate.files, store, assertFresh: async () => {} });
  const server = await startServer(hostedRoot);
  try {
    const served = Buffer.from(await (await fetch(server.origin + report.prefix + '/index.html', { signal: AbortSignal.timeout(15000) })).arrayBuffer());
    assert.equal(sha256(served), sha256(blobs.get(report.prefix.slice(1) + '/index.html')), 'fixture HTTP transport modified the HTML bytes');
    const verified = await verifyCloud(cloud, candidate.files, async (url, options) => fetch(server.origin + new URL(url).pathname, options));
    assert.equal(verified.status, 'pass', verified.detail);
    const results = await runChecks({ origin: server.origin, prefix: report.prefix, config, outDir: path.join(root, 'hosted-shots'), executablePath: chromium, strictOverflow: true });
    assert.equal(results.length, 4);
    assert.ok(results.every((r) => r.passed), JSON.stringify(results));
    assert.ok(results.filter((r) => r.route === 'home').every((r) => r.interactions.length === 1 && r.interactions[0].ok));
    // A real click to the wrong same-prefix page must fail, not merely a status/receipt check.
    const wrong = { ...config, routes: [{ ...config.routes[0], interactions: [{ name: 'wrong expected destination', click: '#next', expectPath: '/' }] }], viewports: [config.viewports[0]] };
    const [bad] = await runChecks({ origin: server.origin, prefix: report.prefix, config: wrong, outDir: path.join(root, 'negative-shots'), executablePath: chromium, strictOverflow: true });
    assert.equal(bad.passed, false);
    assert.ok(bad.failures.some((f) => /expected/.test(f)));
  } finally {
    await server.close();
  }
});
