/**
 * Minimal static server for the Expo web export (`pnpm run build:web`).
 *
 * Serves ./web-build with SPA fallback so deep links such as
 * /practitioner/<id> resolve to index.html. Zero dependencies, honours PORT.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'web-build');
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`No web build found at ${ROOT}. Run "pnpm run build:web" first.`);
  process.exit(1);
}

function send(res, filePath, status = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const immutable = filePath.includes(`${path.sep}_expo${path.sep}`);
  res.writeHead(status, {
    'content-type': MIME_TYPES[ext] || 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(
    /^(\.\.(\/|\\|$))+/,
    '',
  );
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    send(res, filePath);
    return;
  }

  // Client-side routes fall back to the app shell.
  send(res, path.join(ROOT, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving Expo web build on http://0.0.0.0:${PORT}`);
});
