#!/usr/bin/env node
// preToolUse command-hygiene guard (not a security sandbox).
// Denies ambiguous directory changes, inline node scripts, absolute-looking node arguments and
// absolute executables that can turn routine probes into filesystem-approval prompts.
// It never grants permissions; other inputs leave the normal permission flow unchanged.
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

export const ABSOLUTE_NODE_REASON = 'Command-hygiene guard: node arguments beginning with / can be mistaken for outside-checkout filesystem access. '
  + 'Use checkout-relative file arguments. Put non-filesystem URL routes in a checkout-local helper/configuration, '
  + 'or pass a named route ID from routes.json instead. No additional filesystem permission is granted.';

export const ABSOLUTE_EXECUTABLE_REASON = 'Command-hygiene guard: absolute executable paths require separate filesystem approval. '
  + 'Invoke installed tools by name through PATH (e.g. `chromium --version` or `nas-pages-build --help`), '
  + 'and use checkout-relative paths for repository scripts. Do not request wider filesystem access for tool discovery.';

const NODE_BIN_RE = /^(?:\S*\/)?node(?:js)?(?:\.exe)?$/i;
const PREFIX_WORDS = new Set(['env', 'exec', 'time', 'command', 'nohup', 'nice', 'sudo']);
const EVAL_FLAG_RE = /^(?:-[a-z]*[ep][a-z]*|--eval|--print)(?:=.*)?$/;
const VALUE_FLAGS = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '-C', '--conditions', '--input-type', '--env-file']);

function* commandWords(command) {
  for (const segment of command.split(/[;&|\n`]|\$\(|\(/)) {
    const words = (segment.match(/(?:[^\s"'\\]|\\.|"(?:\\.|[^"\\])*"|'[^']*')+/g) || [])
      .map((word) => word.replace(/^(['"])(.*)\1$/s, '$2'));
    let i = 0;
    while (i < words.length && (PREFIX_WORDS.has(words[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]))) i++;
    if (i < words.length) yield words.slice(i);
  }
}

function* nodeArguments(command) {
  for (const words of commandWords(command)) {
    if (NODE_BIN_RE.test(words[0])) yield words.slice(1);
  }
}

// True when any simple command runs node with an inline-script flag before its script file argument.
export function hasInlineNode(command) {
  for (const args of nodeArguments(command)) {
    for (let i = 0; i < args.length && args[i].startsWith('-'); i++) {
      if (args[i] === '--') break;
      if (!args[i].startsWith('--') ? EVAL_FLAG_RE.test(args[i]) : /^--(?:eval|print)(?:=|$)/.test(args[i])) return true;
      if (VALUE_FLAGS.has(args[i])) i++;
    }
  }
  return false;
}

export function hasAbsoluteNodeArgument(command) {
  for (const args of nodeArguments(command)) {
    if (args.some((arg) => /^(?:--?[\w-]+=)?['"]?\//.test(arg))) return true;
  }
  return false;
}

export function hasAbsoluteExecutable(command) {
  for (const words of commandWords(command)) {
    if (words[0].startsWith('/')) return true;
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
  if (hasAbsoluteNodeArgument(command)) return { permissionDecision: 'deny', permissionDecisionReason: ABSOLUTE_NODE_REASON };
  if (hasAbsoluteExecutable(command)) return { permissionDecision: 'deny', permissionDecisionReason: ABSOLUTE_EXECUTABLE_REASON };
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
