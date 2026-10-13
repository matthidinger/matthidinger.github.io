#!/usr/bin/env node
// preToolUse command-hygiene guard (not a security sandbox).
// Denies (1) shell commands that combine a directory change with parent-directory (..) paths, because
// their effective paths are ambiguous, and (2) inline node scripts (node -e/--eval/-p/--print), because
// URL or path literals inside them are indistinguishable from filesystem paths. It never allows or grants
// anything: for every other input it prints nothing, leaving the normal permission flow unchanged.
import { pathToFileURL } from 'node:url';

const SHELL_TOOLS = new Set(['bash', 'shell', 'powershell', 'pwsh', 'sh']);
const CD_RE = /(?:^|[;&|(\n]|\s)(?:cd|pushd|chdir|Set-Location|sl)(?=\s|$)/i;
const PARENT_RE = /(?:^|[\s'"=:(,])\.\.(?:[\\/]|(?=[\s'";)|&]|$))/;

export const REASON = 'Command-hygiene guard: this command combines a directory change (cd/pushd/Set-Location) with a parent path (..), '
  + 'so the paths it touches are ambiguous. Run it without cd, using paths rooted at the checkout '
  + '(e.g. `grep -l pattern _posts/*.md; head _pages/home.md`).';

export const INLINE_NODE_REASON = 'Command-hygiene guard: inline node scripts (node -e/--eval/-p/--print) are not allowed, because '
  + 'literals inside them are scanned as filesystem paths. Write the script to a helper file inside the checkout '
  + '(e.g. .artifacts/check.mjs) and run it with `node .artifacts/check.mjs`.';

const NODE_BIN_RE = /^(?:\S*\/)?node(?:js)?(?:\.exe)?$/i;
const PREFIX_WORDS = new Set(['env', 'exec', 'time', 'command', 'nohup', 'nice', 'sudo']);
const EVAL_FLAG_RE = /^(?:-[a-z]*[ep][a-z]*|--eval|--print)(?:=.*)?$/;
const VALUE_FLAGS = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '-C', '--conditions', '--input-type', '--env-file']);

// True when any simple command runs node with an inline-script flag before its script file argument.
export function hasInlineNode(command) {
  for (const segment of command.split(/[;&|\n`]|\$\(|\(/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < words.length && (PREFIX_WORDS.has(words[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]))) i++;
    if (!NODE_BIN_RE.test(words[i] || '')) continue;
    for (i++; i < words.length && words[i].startsWith('-'); i++) {
      if (words[i] === '--') break;
      if (!words[i].startsWith('--') ? EVAL_FLAG_RE.test(words[i]) : /^--(?:eval|print)(?:=|$)/.test(words[i])) return true;
      if (VALUE_FLAGS.has(words[i])) i++;
    }
  }
  return false;
}

export function decide(input) {
  let data = input;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return null; } }
  if (!data || typeof data !== 'object') return null;
  const tool = String(data.toolName || '').toLowerCase();
  if (!SHELL_TOOLS.has(tool)) return null;
  let args = data.toolArgs;
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = { command: args }; } }
  const command = args && typeof args.command === 'string' ? args.command : '';
  if (CD_RE.test(command) && PARENT_RE.test(command)) return { permissionDecision: 'deny', permissionDecisionReason: REASON };
  if (hasInlineNode(command)) return { permissionDecision: 'deny', permissionDecisionReason: INLINE_NODE_REASON };
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    const d = decide(raw);
    if (d) process.stdout.write(JSON.stringify(d));
  });
}
