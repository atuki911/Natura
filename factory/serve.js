'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serve(root, port) {
  root = path.resolve(root);
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    console.error(`❌ ${root} にゲームがありません。先に npm run batch を実行してください。`);
    process.exitCode = 1;
    return null;
  }
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, path.normalize(rel));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        if (fs.existsSync(file + '/index.html')) {
          res.writeHead(301, { Location: req.url + '/' }).end();
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
  server.listen(port, () => {
    console.log(`🏬 ゲーム工場の直売所を開店しました`);
    console.log(`   PC:     http://localhost:${port}/`);
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const n of nets || []) if (n.family === 'IPv4' && !n.internal) console.log(`   スマホ: http://${n.address}:${port}/  （同じ Wi-Fi から）`);
    }
  });
  return server;
}

module.exports = { serve };
