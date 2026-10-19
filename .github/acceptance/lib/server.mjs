// Minimal static server for a preview root. Bound to loopback, closed by the caller.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
};

export function contentType(file) {
  return TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

export async function startServer(root) {
  const realRoot = fs.realpathSync(root);
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
    const file = path.join(realRoot, pathname);
    if (file !== realRoot && !file.startsWith(realRoot + path.sep)) { res.writeHead(403); return res.end(); }
    let target = file;
    try {
      const st = fs.statSync(target);
      if (st.isDirectory()) {
        if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }); return res.end(); }
        target = path.join(target, 'index.html');
      }
      fs.statSync(target);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    // no-cache, not no-store: every load still revalidates, but Chromium reports streamed reads of
    // no-store bodies (e.g. three.js's model loader) as net::ERR_ABORTED even though they complete.
    // Real hosts (Pages, the preview container) send cacheable responses.
    res.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  });
  server.keepAliveTimeout = 1000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}
