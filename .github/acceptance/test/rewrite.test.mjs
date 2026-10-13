import assert from 'node:assert/strict';
import test from 'node:test';
import { escapingRefs, rewriteCss, rewriteHtml } from '../lib/rewrite.mjs';

const P = '/matthidinger.github.io/pr-7/' + 'a'.repeat(40);
const O = ['https://matthidinger.com', 'https://www.matthidinger.com', 'http://matthidinger.com'];

test('rewrites production and root-relative URLs into the prefix', () => {
  const html = '<a href="https://matthidinger.com/talks/">t</a><img src="/images/a.png"><link href="https://www.matthidinger.com/x.css"><a href="https://matthidinger.com">h</a>';
  const out = rewriteHtml(html, P, O);
  assert.ok(out.includes(`href="${P}/talks/"`));
  assert.ok(out.includes(`src="${P}/images/a.png"`));
  assert.ok(out.includes(`href="${P}/x.css"`));
  assert.ok(out.includes(`href="${P}/"`));
  assert.deepEqual(escapingRefs(out, P, O), []);
});

test('leaves external, protocol-relative, anchors and already-prefixed URLs alone', () => {
  const html = `<a href="https://github.com/x">g</a><script src="//cdn.example/x.js"></script><a href="#top">a</a><a href="${P}/blog/">b</a><a href="https://matthidinger.community/">c</a>`;
  assert.equal(rewriteHtml(html, P, O), html);
});

test('does not alter code/pre/script text, but does rewrite script src', () => {
  const html = '<pre><code>&lt;a href="/x"&gt; <a href="/y"></code></pre><script src="/js/a.js">var u = "https://matthidinger.com/a"; x.href="/b"</script>';
  const out = rewriteHtml(html, P, O);
  assert.ok(out.includes('<pre><code>&lt;a href="/x"&gt; <a href="/y"></code></pre>'));
  assert.ok(out.includes(`<script src="${P}/js/a.js">var u = "https://matthidinger.com/a"; x.href="/b"</script>`));
});

test('rewrites meta refresh, srcset and CSS url()', () => {
  const out = rewriteHtml('<meta http-equiv="refresh" content="0; url=https://matthidinger.com/talks/"><img srcset="/a.png 1x, /b.png 2x">', P, O);
  assert.ok(out.includes(`url=${P}/talks/`));
  assert.ok(out.includes(`srcset="${P}/a.png 1x, ${P}/b.png 2x"`));
  assert.equal(rewriteCss('a{background:url(/i/x.png)} b{src:url("../fonts/f.woff")}', P, O), `a{background:url(${P}/i/x.png)} b{src:url("../fonts/f.woff")}`);
});
