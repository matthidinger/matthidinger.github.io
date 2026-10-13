// Rewrites compiled site URLs so a build hosted under a revision prefix resolves its own
// pages and assets instead of production. Only URL attributes/CSS url() are touched;
// text inside <pre>, <code>, <script>, <style> and <textarea> is preserved byte-for-byte.
import fs from 'node:fs';
import path from 'node:path';
import { walkFiles } from './util.mjs';

const ATTR_RE = /(\s(?:href|src|action|poster|data-src)\s*=\s*)(["'])([^"']*)\2/gi;
const SRCSET_RE = /(\ssrcset\s*=\s*)(["'])([^"']*)\2/gi;
const REFRESH_RE = /(<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*?url=)([^"']+)/gi;
const PROTECTED_RE = /<(pre|code|script|style|textarea)\b[\s\S]*?<\/\1\s*>/gi;
const CSS_URL_RE = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;

export function originRegex(origins) {
  const alts = origins.map((o) => o.replace(/\/+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^(?:${alts.join('|')})(?=/|$|[?#])`, 'i');
}

export function rewriteUrl(url, prefix, prodRe) {
  let u = url;
  if (prodRe.test(u)) u = u.replace(prodRe, '') || '/';
  if (!u.startsWith('/') || u.startsWith('//')) return url;
  if (u === prefix || u.startsWith(prefix + '/')) return u;
  return prefix + u;
}

function rewriteTagText(html, prefix, prodRe) {
  return html
    .replace(ATTR_RE, (m, pre, q, url) => pre + q + rewriteUrl(url, prefix, prodRe) + q)
    .replace(SRCSET_RE, (m, pre, q, val) => pre + q + val.split(',').map((part) => {
      const [u, ...rest] = part.trim().split(/\s+/);
      return [rewriteUrl(u, prefix, prodRe), ...rest].join(' ');
    }).join(', ') + q)
    .replace(REFRESH_RE, (m, pre, url) => pre + rewriteUrl(url, prefix, prodRe));
}

// Opening tags of protected elements still get their attributes rewritten (e.g. <script src>).
export function rewriteHtml(html, prefix, origins) {
  const prodRe = originRegex(origins);
  let out = '';
  let last = 0;
  for (const m of html.matchAll(PROTECTED_RE)) {
    out += rewriteTagText(html.slice(last, m.index), prefix, prodRe);
    const block = m[0];
    const openEnd = block.indexOf('>') + 1;
    out += rewriteTagText(block.slice(0, openEnd), prefix, prodRe) + block.slice(openEnd);
    last = m.index + block.length;
  }
  return out + rewriteTagText(html.slice(last), prefix, prodRe);
}

export function rewriteCss(css, prefix, origins) {
  const prodRe = originRegex(origins);
  return css.replace(CSS_URL_RE, (m, q, url) => `url(${q}${rewriteUrl(url, prefix, prodRe)}${q})`);
}

// Returns references that would still escape the prefix (root-relative or production) outside protected text.
export function escapingRefs(html, prefix, origins) {
  const prodRe = originRegex(origins);
  const stripped = html.replace(PROTECTED_RE, (b) => b.slice(0, b.indexOf('>') + 1));
  const found = [];
  for (const m of stripped.matchAll(ATTR_RE)) {
    const url = m[3];
    if (prodRe.test(url) || (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(prefix + '/') && url !== prefix)) found.push(url);
  }
  return found;
}

export function stagePrefixedSite(siteDir, destDir, prefix, origins) {
  fs.rmSync(destDir, { recursive: true, force: true });
  let rewritten = 0;
  const escaping = [];
  for (const rel of walkFiles(siteDir)) {
    const src = path.join(siteDir, rel);
    const dest = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const ext = path.extname(rel).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
      const html = fs.readFileSync(src, 'utf8');
      const out = rewriteHtml(html, prefix, origins);
      if (out !== html) rewritten++;
      for (const ref of escapingRefs(out, prefix, origins)) escaping.push(`${rel}: ${ref}`);
      fs.writeFileSync(dest, out);
    } else if (ext === '.css') {
      const css = fs.readFileSync(src, 'utf8');
      const out = rewriteCss(css, prefix, origins);
      if (out !== css) rewritten++;
      fs.writeFileSync(dest, out);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
  return { rewritten, escaping };
}
