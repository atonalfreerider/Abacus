import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.swf': 'application/x-shockwave-flash' };
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Invalid URL'); return; }
  if (url.endsWith('/')) url += 'index.html';
  let file = path.resolve(root, '.' + url);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) && root === path.resolve('.')) file = path.resolve(root, 'public', '.' + url);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
  const headers = { 'Content-Type': (mime[path.extname(file)] || 'application/octet-stream') + (['.html', '.css', '.js', '.json'].includes(path.extname(file)) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Accept-Encoding' };
  if (root.endsWith(path.sep + 'dist')) {
    headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
    if (/[/\\]vendor[/\\]/.test(file)) headers['Cache-Control'] = 'public, max-age=86400';
  }
  const accepts = req.headers['accept-encoding'] || '';
  if (/\bbr\b/.test(accepts) && fs.existsSync(file + '.br')) { headers['Content-Encoding'] = 'br'; file += '.br'; }
  else if (/\bgzip\b/.test(accepts) && fs.existsSync(file + '.gz')) { headers['Content-Encoding'] = 'gzip'; file += '.gz'; }
  headers['Content-Length'] = fs.statSync(file).size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Abacus is ready at http://localhost:${port}`));
