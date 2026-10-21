import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
// --app builds the bundle the Android and iOS apps ship (dist-app, Capacitor's webDir):
// the equation app only, without the SWF comparison runtime, the test bench or
// precompressed copies, plus the Capacitor core module the native shell needs.
const app = process.argv.includes('--app');
const name = app ? 'dist-app' : 'dist', out = path.join(root, name);
if (path.relative(root, out) !== name) throw new Error('Output must remain inside the project directory.');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'src'), { recursive: true });
if (app) {
  // The page itself never zooms in the app; the graph has its own pinch zoom.
  fs.writeFileSync(path.join(out, 'index.html'), fs.readFileSync('index.html', 'utf8').replace('initial-scale=1,viewport-fit=cover', 'initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'));
  for (const file of ['engine.js', 'place-value.js', 'haptics.js', 'native.js']) fs.copyFileSync('src/' + file, path.join(out, 'src', file));
  fs.cpSync('src/mvc', path.join(out, 'src/mvc'), { recursive: true });
  fs.cpSync('src/graph', path.join(out, 'src/graph'), { recursive: true });
  fs.cpSync('src/numbers', path.join(out, 'src/numbers'), { recursive: true });
  // The Machine mode loads on first use; base e (e-base.js) on first use of base e. Its
  // named snapshot scenes (scenes.js) serve the test bench, which the apps do not ship.
  fs.cpSync('src/machine', path.join(out, 'src/machine'), { recursive: true, filter: file => path.basename(file) !== 'scenes.js' });
  fs.mkdirSync(path.join(out, 'textures'), { recursive: true });
  for (const id of [2, 18, 23, 24, 25]) fs.copyFileSync(`public/textures/swf-${id}.jpg`, path.join(out, `textures/swf-${id}.jpg`));
  fs.copyFileSync('public/textures/swf-12.png', path.join(out, 'textures/swf-12.png'));
  for (const file of ['favicon.svg', 'privacy.html']) fs.copyFileSync('public/' + file, path.join(out, file));
  fs.mkdirSync(path.join(out, 'vendor/capacitor'), { recursive: true });
  fs.copyFileSync('node_modules/@capacitor/core/dist/index.js', path.join(out, 'vendor/capacitor/core.js'));
  fs.copyFileSync('node_modules/@capacitor/core/LICENSE', path.join(out, 'vendor/capacitor/LICENSE'));
  let bytes = 0; const count = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) count(f); else bytes += fs.statSync(f).size; } }; count(out);
  console.log(`Built ${name}: ${(bytes / 1048576).toFixed(2)} MB for the native apps.`);
  process.exit(0);
}
fs.copyFileSync('index.html', path.join(out, 'index.html'));
// The SWF comparison page (reference.html) keeps its own stylesheet and loader.
for (const file of ['styles.css', 'ruffle-config.js', 'reference.js']) fs.copyFileSync('src/' + file, path.join(out, 'src', file));
for (const file of ['engine.js','place-value.js','haptics.js','native.js']) fs.copyFileSync('src/'+file,path.join(out,'src',file));
fs.cpSync('src/mvc',path.join(out,'src/mvc'),{recursive:true});
fs.cpSync('src/graph',path.join(out,'src/graph'),{recursive:true});
fs.cpSync('src/numbers',path.join(out,'src/numbers'),{recursive:true});
fs.cpSync('src/machine',path.join(out,'src/machine'),{recursive:true});
fs.mkdirSync(path.join(out,'textures'),{recursive:true});
for(const id of [2,18,23,24,25])fs.copyFileSync(`public/textures/swf-${id}.jpg`,path.join(out,`textures/swf-${id}.jpg`));
fs.copyFileSync('public/textures/swf-12.png',path.join(out,'textures/swf-12.png'));
fs.copyFileSync('public/tests.html',path.join(out,'tests.html'));
if(fs.existsSync('public/pixel-baselines'))fs.cpSync('public/pixel-baselines',path.join(out,'pixel-baselines'),{recursive:true});
for (const file of ['ABACUS.swf', 'abacus-director.swf', 'PRIME.swf', 'swf-provenance.json', 'reference.html', 'prime-reference.html', 'favicon.svg', 'privacy.html', '_headers']) fs.copyFileSync('public/' + file, path.join(out, file));
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
