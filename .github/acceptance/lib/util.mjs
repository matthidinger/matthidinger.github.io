import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_NWO = 'matthidinger/matthidinger.github.io';
export const PREVIEW_SITE_DIR = 'matthidinger.github.io';
export const BASE_BRANCH = 'master';
export const ACCEPTANCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...opts }).trim();
}

export function repoRoot(cwd = process.cwd()) {
  return sh('git', ['rev-parse', '--show-toplevel'], { cwd });
}

export function headSha(root) {
  return sh('git', ['rev-parse', 'HEAD'], { cwd: root });
}

// Ignored paths (.artifacts, node_modules) do not count; anything else uncommitted does.
export function dirtyFiles(root) {
  const out = sh('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root });
  return out ? out.split('\n') : [];
}

export function isFullSha(s) {
  return typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
}

export function previewPrefix(pr, sha) {
  if (!Number.isInteger(pr) || pr < 0) throw new Error(`invalid PR number: ${pr}`);
  if (!isFullSha(sha)) throw new Error(`invalid full commit SHA: ${sha}`);
  return `/${PREVIEW_SITE_DIR}/pr-${pr}/${sha}/site`;
}

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function walkFiles(dir, base = dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) throw new Error(`symlink not allowed in site output: ${path.relative(base, full)}`);
    if (ent.isDirectory()) walkFiles(full, base, out);
    else if (ent.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

export function manifest(dir) {
  const files = {};
  for (const rel of walkFiles(dir)) files[rel] = sha256File(path.join(dir, rel));
  return files;
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { args._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

export function prNumber(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error('--pr must be a positive PR number');
  return n;
}

export function loadConfig(file = path.join(ACCEPTANCE_DIR, 'routes.json')) {
  return readJson(file);
}

export function fail(message, code = 1) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}
