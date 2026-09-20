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
  // Local test bench only: bounded PNG artifacts with no caller-supplied paths.
  if(req.method==='POST'&&url.startsWith('/__visual/')&&root===path.resolve('.')) {
    if(req.headers.origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin)){res.writeHead(403).end();return;}
    const match=url.match(/^\/__visual\/(baseline|actual)\/([a-z0-9-]+\.png)$/);
    if(!match){res.writeHead(400).end('Invalid artifact name');return;}
    const dir=path.resolve(root,match[1]==='baseline'?'public/pixel-baselines':'artifacts/visual/pixels');
    const dest=path.resolve(dir,match[2]);
    if(!dest.startsWith(root+path.sep)||!dest.startsWith(dir+path.sep)){res.writeHead(403).end();return;}
    let size=0;const chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>5000000)req.destroy();else chunks.push(chunk);});
    req.on('end',()=>{const bytes=Buffer.concat(chunks);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){res.writeHead(400).end('PNG required');return;}fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dest,bytes);res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({saved:match[2]}));});return;
  }
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
