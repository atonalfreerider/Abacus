import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const out = path.join(root, 'dist');
if (path.relative(root, out) !== 'dist') throw new Error('Output must remain inside the project dist directory.');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'src'), { recursive: true });
fs.copyFileSync('index.html', path.join(out, 'index.html'));
// The SWF comparison page (reference.html) keeps its own stylesheet and loader.
for (const file of ['styles.css', 'ruffle-config.js', 'reference.js']) fs.copyFileSync('src/' + file, path.join(out, 'src', file));
for (const file of ['engine.js','place-value.js']) fs.copyFileSync('src/'+file,path.join(out,'src',file));
fs.cpSync('src/mvc',path.join(out,'src/mvc'),{recursive:true});
fs.cpSync('src/graph',path.join(out,'src/graph'),{recursive:true});
fs.mkdirSync(path.join(out,'textures'),{recursive:true});
for(const id of [2,18,23,24,25])fs.copyFileSync(`public/textures/swf-${id}.jpg`,path.join(out,`textures/swf-${id}.jpg`));
fs.copyFileSync('public/textures/swf-12.png',path.join(out,'textures/swf-12.png'));
fs.copyFileSync('public/tests.html',path.join(out,'tests.html'));
if(fs.existsSync('public/pixel-baselines'))fs.cpSync('public/pixel-baselines',path.join(out,'pixel-baselines'),{recursive:true});
for (const file of ['ABACUS.swf', 'abacus-director.swf', 'swf-provenance.json', 'reference.html', 'favicon.svg', '_headers']) fs.copyFileSync('public/' + file, path.join(out, file));
fs.cpSync('public/vendor', path.join(out, 'vendor'), {recursive:true, filter: file => !file.endsWith('.map')});
let bytes = 0, compressedBytes = 0;
function compress(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { compress(file); continue; }
    const data = fs.readFileSync(file); bytes += data.length;
    if (!/\.(wasm|js|css|html|json)$/.test(file)) continue;
    const br = zlib.brotliCompressSync(data, {params:{[zlib.constants.BROTLI_PARAM_QUALITY]:6}});
    fs.writeFileSync(file + '.br', br);
    fs.writeFileSync(file + '.gz', zlib.gzipSync(data, {level:9}));
    compressedBytes += br.length;
  }
}
compress(out);
console.log(`Built dist: ${(bytes/1048576).toFixed(2)} MB raw; ${(compressedBytes/1048576).toFixed(2)} MB Brotli for compressible assets. The native equation app does not load the optional SWF comparison runtime.`);
