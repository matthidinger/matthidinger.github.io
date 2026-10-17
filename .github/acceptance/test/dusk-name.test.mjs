import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { findChromium } from '../lib/browser.mjs';

let executablePath;
try { executablePath = findChromium(); } catch { /* skipped below */ }
const root = new URL('../../../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const viewports = [[320, 568], [390, 844], [430, 932], [768, 1024], [1280, 720],
  [1280, 900], [1440, 900], [1920, 1080], [2560, 1080], [844, 390], [390, 844]];

test('Dusk single-line name stays legible while the stacked layout is unchanged after resizing and font changes', {
  skip: !executablePath && 'no Chromium available', timeout: 60000,
}, async () => {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${read('assets/css/dusk.css')}</style>
      <div class="dk">
        <svg class="dk-scene" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice"></svg>
        <header class="dk-top"><a class="dk-sig">Matt Hidinger</a>
          <nav class="dk-nav"><a>About</a><a>Blog</a><a>Talks</a></nav></header>
        <main><section class="dk-hero"><h1 class="dk-name">Matt Hidinger</h1>
          <div class="dk-lede"><p class="dk-hi">Hi, I'm Matt.</p>
          <p>Principal Product Manager at Microsoft in Seattle. Into Sailing and making.</p></div>
        </section></main>
      </div>`);
    for (const file of ['dusk-kit.js', 'dusk-geo.js', 'dusk-scene.js', 'dusk.js']) {
      await page.addScriptTag({ content: read(`assets/js/${file}`) });
    }
    for (const font of [null, 'sans-serif', 'serif']) {
      if (font) await page.locator('.dk-nameG').evaluate((el, value) => el.setAttribute('font-family', value), font);
      for (const [width, height] of viewports) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const issues = await page.evaluate(() => {
          const svg = document.querySelector('.dk-scene');
          const group = svg.querySelector('.dk-nameG');
          if (group.children.length === 2) {
            const [first, last] = group.children;
            const size = Number(last.getAttribute('font-size'));
            const baseline = Math.round((616 - Math.min(size * 0.45, 40)) * 10) / 10;
            return group.hasAttribute('transform') || Number(last.getAttribute('y')) !== baseline
              || Math.abs(Number(first.getAttribute('y')) - (baseline - size * 0.8)) > 0.15
              ? ['stacked layout changed'] : [];
          }
          const ridgeTop = new DOMPoint(0, svg.querySelector('.dk-far').getBBox().y).matrixTransform(svg.getScreenCTM()).y;
          const intro = document.querySelector('.dk-lede').getBoundingClientRect();
          const nav = document.querySelector('.dk-top').getBoundingClientRect();
          const ctx = document.createElement('canvas').getContext('2d');
          return [...svg.querySelectorAll('.dk-nameG text')].flatMap(text => {
            const r = text.getBoundingClientRect();
            const style = getComputedStyle(text);
            ctx.font = `${style.fontSize} ${style.fontFamily}`;
            const metrics = ctx.measureText(text.textContent), y = Number(text.getAttribute('y'));
            const matrix = text.getScreenCTM();
            const top = new DOMPoint(0, y - metrics.actualBoundingBoxAscent).matrixTransform(matrix).y;
            const bottom = new DOMPoint(0, y + metrics.actualBoundingBoxDescent).matrixTransform(matrix).y;
            const problems = [];
            if (r.left < -1 || r.right > innerWidth + 1 || top < -1 || bottom > innerHeight + 1) problems.push('clipped by viewport');
            if (bottom > ridgeTop + (bottom - top) * 0.12 + 1) problems.push('too much hidden by ridge');
            if (r.left < intro.right && r.right > intro.left && top < intro.bottom && bottom > intro.top) problems.push('overlaps intro');
            if (top < nav.bottom) problems.push('overlaps navigation');
            return problems;
          });
        });
        assert.deepEqual(issues, [], `${width}x${height}, font=${font || 'site default'}`);
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
