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
  for (const c of [REJECTED, ROOTED, '', 'cd ..', 'node -p 1', 'node a.mjs']) {
    const d = decide({ toolName: 'bash', toolArgs: { command: c } });
    assert.ok(d === null || d.permissionDecision === 'deny');
  }
});

// The inline-node command that was rejected because its URL literals were scanned as filesystem paths.
const REJECTED_INLINE = `R=.artifacts/acceptance/pr-2-x; node --input-type=module -e "
import fs from 'node:fs';
const P = '/matthidinger.github.io/pr-2/SHA';
console.log(fs.existsSync(P + '/site/talks/'));
"`;

test('denies inline node scripts (-e/--eval/-p/--print) with a rooted-helper instruction', () => {
  const cmds = [REJECTED_INLINE, 'node -e "1"', 'node -p 1+1', 'node --eval "x"', 'node --print=1', 'node -pe 1', 'node --input-type=module -e "x"',
    'node -r ./a.cjs -e 1', 'FOO=1 node -e 1', 'env NODE_ENV=x node -p 1', '/usr/bin/node -p 1', 'nodejs -e 1',
    'echo hi && node -p 1', 'ls; node -e 1', 'x=$(node -p 1)', 'npm test | node -e "process.stdin.pipe(process.stdout)"', 'node.exe -e 1'];
  for (const c of cmds) {
    const d = decide({ toolName: 'bash', toolArgs: { command: c } });
    assert.equal(d?.permissionDecision, 'deny', c);
    assert.match(d.permissionDecisionReason, /helper file inside the checkout/);
  }
  const d = JSON.parse(runHook({ toolName: 'bash', toolArgs: JSON.stringify({ command: REJECTED_INLINE }) }));
  assert.equal(d.permissionDecision, 'deny');
});

test('ordinary node FILE commands and non-node -e/-p flags get no decision', () => {
  for (const c of ['node .artifacts/check.mjs', 'node .github/acceptance/bin/accept.mjs --pr 2', 'node .github/acceptance/bin/inspect.mjs RUN --note "x -e y"',
    'node script.mjs -e -p --eval', 'node --test "test/*.test.mjs"', 'node --input-type=module .artifacts/x.mjs', 'node -- -e',
    'npm --prefix .github/acceptance test', 'grep -e pattern -e other file', 'sed -e s/a/b/ f', 'echo node -e 1', 'git log -p', 'nodemon -e js', 'node']) {
    assert.equal(decide({ toolName: 'bash', toolArgs: { command: c } }), null, c);
  }
  assert.equal(runHook({ toolName: 'bash', toolArgs: { command: 'node .artifacts/check.mjs' } }), '');
});

test('denies the observed URL-route argument stall without granting filesystem access', () => {
  const observed = 'sed -n 1,46p .github/acceptance/lib/server.mjs | grep -n "export\\|function" ; ls .github/acceptance/node_modules/playwright-core/ | head; node .artifacts/probe-nav.mjs .artifacts/acceptance/baseline-0a7995deb3f3/preview /archive/2012/12/05/sharing-code-windows-8-and-windows-phone/ 8 2>&1 | tail -5';
  for (const command of [observed, 'node probe.mjs "/"', "node probe.mjs '/talks/'",
    'node probe.mjs --route=/blog/', 'node probe.mjs --route="/archive/example/"', 'node /workspace/probe.mjs']) {
    const decision = JSON.parse(runHook({ toolName: 'bash', toolArgs: { command } }));
    assert.equal(decision.permissionDecision, 'deny', command);
    assert.match(decision.permissionDecisionReason, /named route ID/);
  }
});

test('relative files, named routes, real URLs and descriptive notes keep normal permission handling', () => {
  for (const command of ['node .artifacts/probe-nav.mjs .artifacts/preview tables-images 8',
    'node probe.mjs --config=.artifacts/probe.json', 'node probe.mjs --origin=https://example.com',
    'node inspect.mjs RUN --note "Viewed /talks/ and /blog/ at both widths"',
    'node inspect.mjs RUN --note="Viewed /talks/ and /blog/"', 'cat /approved/exact/snapshot.md']) {
    assert.equal(runHook({ toolName: 'bash', toolArgs: { command } }), '', command);
  }
});
