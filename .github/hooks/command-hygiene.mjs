#!/usr/bin/env node
// preToolUse command-hygiene guard (not a security sandbox).
// Denies shell commands that combine a directory change with parent-directory (..) paths, because
// their effective paths are ambiguous. It never allows or grants anything: for every other input it
// prints nothing, leaving the normal permission flow unchanged.
import { pathToFileURL } from 'node:url';

const SHELL_TOOLS = new Set(['bash', 'shell', 'powershell', 'pwsh', 'sh']);
const CD_RE = /(?:^|[;&|(\n]|\s)(?:cd|pushd|chdir|Set-Location|sl)(?=\s|$)/i;
const PARENT_RE = /(?:^|[\s'"=:(,])\.\.(?:[\\/]|(?=[\s'";)|&]|$))/;

export const REASON = 'Command-hygiene guard: this command combines a directory change (cd/pushd/Set-Location) with a parent path (..), '
  + 'so the paths it touches are ambiguous. Run it without cd, using paths rooted at the checkout '
  + '(e.g. `grep -l pattern _posts/*.md; head _pages/home.md`).';

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
