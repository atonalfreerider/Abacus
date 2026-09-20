import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
if (path.relative(root, out) !== 'dist') throw new Error('Build output must remain in the project dist directory.');
// Only the checked, generated dist directory is replaced.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of ['index.html', 'src']) fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
const runtimeTextures = new Set(['swf-2.jpg', 'swf-23.jpg', 'swf-24.jpg', 'swf-25.jpg', 'swf-10.png', 'swf-14.png', 'manifest.json']);
fs.cpSync(path.join(root, 'public'), out, { recursive: true, filter: file => {
  if (fs.statSync(file).isDirectory()) return true;
  if (path.basename(path.dirname(file)) === 'textures') return runtimeTextures.has(path.basename(file));
  return true;
} });
let bytes = 0;
function total(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) total(file); else bytes += fs.statSync(file).size; } }
total(out);
console.log(`Built static site in dist/ (${(bytes / 1024 / 1024).toFixed(2)} MB). No runtime dependencies.`);
