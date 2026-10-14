// Copy-code acceptance on synthetic fixtures served under a preview prefix. The good fixture uses the
// site's real assets/js/code-copy.js and blog-polish.css; each negative test breaks one behaviour of
// that real script and must be caught by the browser check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { findChromium, runChecks } from '../lib/browser.mjs';
import { stagePrefixedSite } from '../lib/rewrite.mjs';
import { startServer } from '../lib/server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'assets/js/code-copy.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'assets/css/blog-polish.css'), 'utf8');
const SHA = 'c'.repeat(40);
const PREFIX = `/matthidinger.github.io/pr-9/${SHA}`;
const ORIGINS = ['https://matthidinger.com'];

const rouge = (lang, code) => `<div class="language-${lang} highlighter-rouge"><div class="highlight"><pre class="highlight"><code>${code}</code></pre></div></div>`;
// Leading indentation, a tab, trailing spaces and blank lines must all survive the copy.
const SNIPPET_1 = '  public void First()\t// tab\n  {   \n\n      return;\n  }\n';
const BODY = '<h1>Fixture</h1><div class="page__content">'
  + `<p>${'Prose about the code below. '.repeat(6)}Call <code>Inline.Method()</code> and <code>x =&gt; y</code> here.</p>`
  + rouge('csharp', SNIPPET_1.replace(/</g, '&lt;'))
  + rouge('plaintext', '   \n')
  + '<ol><li>Step with <code>&lt;img id="hero" /&gt;</code></li><li>' + rouge('xml', '&lt;a&gt;\n  &lt;b attr="1" /&gt;\n&lt;/a&gt;\n') + '</li></ol>'
  + '<figure class="highlight"><pre><code class="language-sh" data-lang="sh">echo "third block"\nexit 0\n</code></pre></figure>'
  + `<p>${'Closing paragraph text. '.repeat(6)}</p></div>`;
const html = (script, extraHead = '') => `<!doctype html><html><head><title>Fixture Page</title><link rel="stylesheet" href="/style.css">${extraHead}</head><body>${BODY}${script === null ? '' : '<script src="/code-copy.js"></script>'}</body></html>`;

let chromiumPath;
try { chromiumPath = findChromium(); } catch { /* skipped below */ }
const opts = { skip: !chromiumPath && 'no Chromium available', timeout: 120000 };

async function check({ script = SCRIPT, extraHead = '', mobile = false, min = 3 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-fixture-'));
  const site = path.join(dir, 'site');
  fs.mkdirSync(site, { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), html(script, extraHead));
  fs.writeFileSync(path.join(site, 'style.css'), CSS);
  if (script !== null) fs.writeFileSync(path.join(site, 'code-copy.js'), script);
  stagePrefixedSite(site, path.join(dir, 'preview', PREFIX), PREFIX, ORIGINS);
  const server = await startServer(path.join(dir, 'preview'));
  const config = {
    productionOrigins: ORIGINS,
    viewports: [mobile ? { name: 'mobile', width: 390, height: 844, isMobile: true } : { name: 'desktop', width: 1000, height: 700 }],
    routes: [{ id: 'r', path: '/', title: 'Fixture', h1: 'Fixture', selectors: { pre: 3 }, copyCode: { min } }],
  };
  try {
    const [res] = await runChecks({ origin: server.origin, prefix: PREFIX, config, outDir: path.join(dir, 'evidence'), executablePath: chromiumPath });
    return res;
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Break the real script in exactly one place; fail loudly if the anchor text has drifted.
function mutate(from, to, src = SCRIPT) {
  assert.ok(src.includes(from), `fixture anchor missing from code-copy.js: ${from}`);
  return src.replace(from, to);
}
const failed = (res, re) => res.failures.filter((f) => re.test(f));
const only = (res, re) => {
  assert.ok(failed(res, re).length > 0, `expected a failure matching ${re}; got ${JSON.stringify(res.failures)}`);
};

test('real script: buttons on nonempty blocks only; exact copy via Enter, Space and click; honest failures; no-JS readable', opts, async () => {
  const res = await check();
  assert.deepEqual(res.failures, []);
  const names = res.copyCode.map((a) => a.name);
  for (const want of ['buttons on every nonempty code block only', 'snippet 1 Enter copies exact code', 'snippet 3 Space copies exact code',
    'snippet 2 click copies exact code', 'snippet 1 visible keyboard focus', 'denied clipboard reports failure, never success',
    'unavailable clipboard reports failure, never success', 'no-JavaScript code readable without buttons']) {
    assert.ok(names.some((n) => n.endsWith(want)), `missing check: ${want}`);
  }
  assert.match(res.copyCode.find((a) => a.name.endsWith('buttons on every nonempty code block only')).detail, /^3 buttons \/ 3 nonempty of 4 code blocks/);
  assert.match(res.copyCode.find((a) => a.name.endsWith('snippet 1 Enter copies exact code')).detail, new RegExp(`^${SNIPPET_1.length} chars`));
});

test('real script on a phone viewport (tap) passes', opts, async () => {
  const res = await check({ mobile: true });
  assert.deepEqual(res.failures, []);
  assert.ok(res.copyCode.some((a) => a.name.endsWith('snippet 2 tap copies exact code') && a.ok));
});

test('no script: missing buttons fail; minimum count is enforced', opts, async () => {
  only(await check({ script: null }), /buttons on every nonempty code block only: 0 buttons/);
  only(await check({ min: 4 }), /buttons on every nonempty code block only: 3 buttons .*\(min 4\)/);
});

test('copying the rendered block (button label included) fails exact-copy', opts, async () => {
  const res = await check({ script: mutate('writeClipboard(code.textContent)', 'writeClipboard(block.innerText)') });
  only(res, /snippet 1 Enter copies exact code: clipboard differs/);
});

test('trimming indentation/newlines fails exact-copy', opts, async () => {
  only(await check({ script: mutate('writeClipboard(code.textContent)', 'writeClipboard(code.textContent.trim())') }), /copies exact code: clipboard differs/);
});

test('copying the wrong snippet fails exact-copy for later snippets', opts, async () => {
  const res = await check({ script: mutate('var code = codeElement(block);\n      var button', 'var code = codeElement(blocks[0]);\n      var button') });
  only(res, /snippet 3 Space copies exact code: clipboard differs/);
  assert.equal(failed(res, /snippet 1 Enter copies exact code/).length, 0);
});

test('false success when the clipboard is denied or unavailable fails', opts, async () => {
  const res = await check({ script: mutate('writeClipboard(code.textContent).then(', 'writeClipboard(code.textContent).catch(function () {}).then(') });
  only(res, /denied clipboard reports failure, never success/);
  only(res, /unavailable clipboard reports failure, never success/);
});

test('buttons on empty blocks or inline code fail', opts, async () => {
  only(await check({ script: mutate("return code && !nested && code.textContent.trim() !== '';", 'return code && !nested;') }), /copy button on an empty code block/);
  const inline = mutate("'.page__content div.highlighter-rouge, .page__content figure.highlight'", "'.page__content div.highlighter-rouge, .page__content figure.highlight, .page__content p'",
    mutate("|| block.querySelector('pre');", "|| block.querySelector('pre') || block.querySelector('code');"));
  only(await check({ script: inline }), /outside a nonempty code block \(inline code, prose or empty block\)/);
});

test('a non-button control fails keyboard access', opts, async () => {
  const res = await check({ script: mutate("document.createElement('button')", "document.createElement('div')") });
  only(res, /not <button type="button">/);
  only(res, /snippet 1 visible keyboard focus: button did not receive keyboard focus/);
});

test('a missing focus indicator fails', opts, async () => {
  only(await check({ extraHead: '<style>.page__content .code-copy:focus-visible{outline:none !important}</style>' }), /visible keyboard focus: focus-visible=true outline none/);
});

test('no live-region announcement fails', opts, async () => {
  only(await check({ script: mutate('document.body.appendChild(status);', '') }), /snippet 1 Enter announces success/);
});

test('code that is unreadable without JavaScript fails', opts, async () => {
  const hidden = '<style>.page__content pre{display:none}.js-ready .page__content pre{display:block}</style>';
  only(await check({ extraHead: hidden, script: SCRIPT + "\ndocument.body.classList.add('js-ready');" }), /no-JavaScript code readable without buttons: 0\/4/);
});
