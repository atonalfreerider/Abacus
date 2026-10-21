// Deterministic SVG snapshots of the machine (design 6.9): every scene of src/machine/scenes.js
// at u ∈ {0, .25, .5, .75, 1} of each chosen beat, in both styles and both video formats,
// hashed against reviewed baselines. Base-e scenes from B's e-*.json fixtures are kept in
// tests/machine-e-baselines.json; everything else in tests/machine-baselines.json.
//   node tools/machine-visual-tests.mjs             compare
//   node tools/machine-visual-tests.mjs --update    record new hashes (after looking at them)
//   node tools/machine-visual-tests.mjs --png [re]  also render frames whose names match re to PNG
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {machineScenes} from '../src/machine/scenes.js';
import {layoutPlan} from '../src/machine/layout.js';
import {renderMachine, machineDefs} from '../src/machine/render.js';
import {styles} from '../src/mvc/theme.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/machine-visual');
fs.mkdirSync(out, {recursive: true});
const FORMATS = {landscape: {width: 1280, height: 720}, portrait: {width: 540, height: 960}};
const US = [0, .25, .5, .75, 1];
const paper = pathToFileURL(path.join(root, 'public/textures/swf-24.jpg')).href;

// One frame as a standalone SVG document: the stage's defs, a background, the body.
function frameDocument(plan, layout, t, style, format, view = {}) {
  const palette = styles[style], viewport = FORMATS[format];
  const node = t > 0 ? plan.beats[Math.ceil(t) - 1]?.node : undefined;
  const {svg, viewBox} = renderMachine(plan, t, layout, palette, {viewport, digits: format === 'portrait', active: node, ...view});
  const [x, y, w, h] = viewBox.split(' ');
  const background = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${palette.background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${viewport.width}" height="${viewport.height}" data-style="${style}"><defs>${machineDefs(palette)}</defs>${background}${svg}</svg>`;
}

const update = process.argv.includes('--update'), pngAt = process.argv.indexOf('--png');
const pngFilter = pngAt > 0 ? new RegExp(process.argv[pngAt + 1] && !process.argv[pngAt + 1].startsWith('--') ? process.argv[pngAt + 1] : '.') : null;
const {scenes, skipped} = await machineScenes();
const results = {main: {}, e: {}}, frames = [];
for (const scene of scenes) {
  const layout = layoutPlan(scene.plan), group = scene.source === 'e-fixture' ? 'e' : 'main';
  const times = scene.beats.length ? scene.beats.flatMap(b => US.map(u => [`b${b}-u${u}`, b + u])) : [['static', 0]];
  for (const [label, t] of times) for (const style of ['sketchpad', 'cyber']) for (const format of Object.keys(FORMATS)) {
    const name = `${scene.name}-${label}-${style}-${format}`, doc = frameDocument(scene.plan, layout, t, style, format, scene.view);
    if (/NaN|undefined|Infinity/.test(doc)) { console.error(`${name}: NaN or undefined in the frame`); process.exitCode = 1; }
    fs.writeFileSync(path.join(out, `${name}.svg`), doc);
    results[group][name] = crypto.createHash('sha256').update(doc).digest('hex');
    if (pngFilter?.test(name)) frames.push({name, doc, style, format});
  }
}
const files = {main: path.join(root, 'tests/machine-baselines.json'), e: path.join(root, 'tests/machine-e-baselines.json')};
let total = 0;
for (const [group, hashes] of Object.entries(results)) {
  const count = Object.keys(hashes).length; total += count;
  if (update) { if (count) fs.writeFileSync(files[group], JSON.stringify(hashes, null, 2) + '\n'); continue; }
  const expected = fs.existsSync(files[group]) ? JSON.parse(fs.readFileSync(files[group], 'utf8')) : {};
  const changed = Object.keys({...hashes, ...expected}).filter(k => hashes[k] !== expected[k]);
  if (changed.length) {
    const fresh = changed.filter(k => !(k in expected)), gone = changed.filter(k => !(k in hashes)), diff = changed.filter(k => k in expected && k in hashes);
    console.error(`${path.basename(files[group])}: ${diff.length} changed, ${fresh.length} without a baseline, ${gone.length} no longer drawn` + (changed.length ? ':\n  ' + changed.slice(0, 40).join('\n  ') + (changed.length > 40 ? '\n  …' : '') : ''));
    process.exitCode = 1;
  }
}
if (skipped.length) console.log(`Skipped ${skipped.length} scenes:\n  ${skipped.join('\n  ')}`);
if (update) console.log(`Recorded ${total} machine SVG baselines. Review the frames (--png) before accepting changes.`);
else if (!process.exitCode) console.log(`PASS: ${total} machine SVG snapshots match reviewed baselines.`);
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({frames: total, skipped, hashes: results}, null, 2));

if (frames.length) {
  const {launch} = await import('./browser.mjs');
  const pngDir = path.join(out, 'png'); fs.mkdirSync(pngDir, {recursive: true});
  const page = await launch('about:blank', FORMATS.landscape);
  try {
    for (const f of frames) {
      const {width, height} = FORMATS[f.format];
      await page.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
      const bg = f.style === 'sketchpad' ? `background:#f7f0df url('${paper}') repeat` : 'background:#05070b';
      const html = path.join(pngDir, `${f.name}.html`);
      fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;${bg}}svg{display:block}svg>rect:first-of-type{display:none}</style>${f.doc}`);
      await page.goto(pathToFileURL(html).href);
      await page.screenshot(path.join(pngDir, `${f.name}.png`));
      fs.rmSync(html);
    }
  } finally { await page.close(); }
  console.log(`Wrote ${frames.length} PNG frames to ${path.relative(root, pngDir)}.`);
}
