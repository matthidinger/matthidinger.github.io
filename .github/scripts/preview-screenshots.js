// CI-only: serves the built _site locally and routes site-owned URLs to it, then screenshots /talks/.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || '_site');
const OUT = path.resolve(process.argv[3] || 'shots');
const PROD = 'https://matthidinger.com';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.xml': 'application/xml' };

function resolveFile(urlPath) {
  let p = path.join(ROOT, decodeURIComponent(urlPath.split('?')[0]));
  if (!p.startsWith(ROOT)) return null;
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  return fs.existsSync(p) ? p : null;
}

const server = http.createServer((req, res) => {
  const f = resolveFile(req.url);
  if (!f) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function run() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width, height } });
      const problems = [];
      let localLoaded = 0;
      // Serve production-domain asset URLs from this PR's build; block everything else external.
      await ctx.route('**/*', async (route) => {
        const u = route.request().url();
        if (u.startsWith(base)) return route.continue();
        if (u.startsWith(PROD)) {
          const f = resolveFile(new URL(u).pathname);
          if (!f) { problems.push(`missing in build: ${u}`); return route.fulfill({ status: 404, body: '' }); }
          localLoaded++;
          return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
        }
        return route.abort();
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(30000);
      page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
      const resp = await page.goto(`${base}/talks/`, { waitUntil: 'networkidle' });
      if (!resp || resp.status() !== 200) throw new Error(`${name}: /talks/ status ${resp && resp.status()}`);
      await page.evaluate(() => document.fonts.ready);
      const heading = page.locator('h1', { hasText: /^\s*Talks\s*$/i }).first();
      await heading.waitFor({ state: 'visible' });
      const info = await page.evaluate(() => ({
        sheets: [...document.styleSheets].filter((s) => { try { return s.cssRules.length > 0; } catch (e) { return false; } }).length,
        imgsBroken: [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length,
        bodyText: document.body.innerText.length,
        height: document.documentElement.scrollHeight,
      }));
      if (info.sheets === 0) problems.push('no stylesheet loaded');
      if (info.imgsBroken > 0) problems.push(`${info.imgsBroken} broken image(s)`);
      if (info.bodyText < 50) problems.push('page text is nearly empty');
      if (localLoaded === 0) problems.push('no site assets were loaded from the build');
      if (problems.length) throw new Error(`${name}: ${problems.join('; ')}`);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `talks-${name}.png`), fullPage: true });
      console.log(`${name}: ok (${info.sheets} stylesheets, ${localLoaded} routed assets, height ${info.height})`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
