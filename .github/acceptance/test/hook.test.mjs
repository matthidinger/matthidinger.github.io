import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { ACCEPTANCE_DIR } from '../lib/util.mjs';
import { decide } from '../../hooks/command-hygiene.mjs';

const HOOK = path.join(ACCEPTANCE_DIR, '..', 'hooks', 'command-hygiene.mjs');
// The exact command that was rejected during bootstrap, and its checkout-rooted equivalent.
const REJECTED = `cd _posts; echo "== fenced"; grep -lE '^\\s*\`\`\`' *.md | head; echo "== highlight"; grep -l '{% highlight' *.md | head; echo "== pre"; grep -liE '<pre' *.md | head; echo "== brush"; grep -l 'brush:' *.md | head; echo "== tables md"; grep -lE '^\\|.*\\|' *.md | head; echo "== html table"; grep -li '<table' *.md | head; echo "== img"; grep -lE '!\\[|<img' *.md | wc -l; grep -c '' ../_pages/home.md; head -20 ../index.html ../blog/index.html ../_pages/home.md`;
const ROOTED = `grep -lE '^\\s*\`\`\`' _posts/*.md | head; grep -li '<table' _posts/*.md | head; grep -lE '!\\[|<img' _posts/*.md | wc -l; head -20 index.html blog/index.html _pages/home.md`;

function runHook(input) {
  const r = spawnSync(process.execPath, [HOOK], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8' });
  assert.equal(r.status, 0);
  return r.stdout;
}

test('denies the actual rejected cd + ../ command', () => {
  const out = runHook({ toolName: 'bash', toolArgs: { command: REJECTED } });
  const d = JSON.parse(out);
  assert.equal(d.permissionDecision, 'deny');
  assert.match(d.permissionDecisionReason, /checkout/);
});

test('rooted equivalent gets no decision', () => {
  assert.equal(runHook({ toolName: 'bash', toolArgs: { command: ROOTED } }), '');
});

test('handles JSON-string toolArgs', () => {
  assert.equal(decide({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'cd docs && cat ../README.md' }) }).permissionDecision, 'deny');
  assert.equal(decide({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'cat README.md' }) }), null);
});

test('variants: pushd, Set-Location, cd .., windows separators', () => {
  for (const c of ['pushd sub && ls ../x', 'Set-Location src; Get-Content ..\\a.txt', 'cd .. && ls', 'ls; cd x; cat "../y"']) {
    assert.equal(decide({ toolName: 'powershell', toolArgs: { command: c } })?.permissionDecision, 'deny', c);
  }
});

test('normal commands, ranges and non-shell tools get no decision', () => {
  for (const c of ['git log HEAD~3..HEAD', 'echo ...', 'cd src', 'ls ../x', 'npm --prefix .github/acceptance test', 'abcd ../x']) {
    assert.equal(decide({ toolName: 'bash', toolArgs: { command: c } }), null, c);
  }
  assert.equal(decide({ toolName: 'view', toolArgs: { path: '../x', command: 'cd a; cat ../b' } }), null);
  assert.equal(runHook('not json'), '');
  assert.equal(runHook(''), '');
});

test('never returns allow', () => {
  for (const c of [REJECTED, ROOTED, '', 'cd ..']) {
    const d = decide({ toolName: 'bash', toolArgs: { command: c } });
    assert.ok(d === null || d.permissionDecision === 'deny');
  }
});
