// Can the new pictures be read? A legibility study of the cyber style, the number-base
// trays and the marble fingerprints by TypeSafe's System One model Jev
// (https://docs.typesafe.ai), after the riemann-zeta-visualization study (Tools/jev_marbles.py).
//
// Each picture is rendered by the real app in headless Chrome, in both styles. For each one
// Jev answers one Choice question: which reading does it show? The options are the truth and
// three near misses made in code, shuffled; code keeps the score. This is "select instead of
// generate": the candidates are exact, the model only has to see which one fits.
// * fingerprints: which product of prime powers (a marble picture, no digits)? The near
//   misses: an exponent one off, a prime swapped for its neighbour, a factor dropped or added.
// * trays: which numeral in base 2, balanced ternary or base e (the trays carry their
//   digits; this checks the barred 1 of balanced ternary, the group and point markers and
//   the ellipsis read as intended)? The near misses: one digit changed, T and 1 swapped, a
//   digit dropped, the point moved.
//
// Usage (the key stays in the environment, never on the command line):
//   TYPESAFE_API_KEY=… node tools/jev-legibility.mjs [--only fingerprints|trays] [--styles sketchpad,cyber] [--model jev-latest]
//   TYPESAFE_API_KEY_FILE=path/to/key node tools/jev-legibility.mjs
// Pictures and every answer go to artifacts/jev/; a summary table is printed and written to
// artifacts/jev/summary.md.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { launch, chromePath } from './browser.mjs';
import { factor } from '../src/numbers/primes.js';
import { baseText } from '../src/mvc/bases.js';

const args = process.argv.slice(2), flag = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const key = process.env.TYPESAFE_API_KEY || (process.env.TYPESAFE_API_KEY_FILE ? fs.readFileSync(process.env.TYPESAFE_API_KEY_FILE, 'utf8').trim() : '');
if (!key) { console.error('Set TYPESAFE_API_KEY (or TYPESAFE_API_KEY_FILE).'); process.exit(2); }
if (!chromePath()) { console.error('Chrome not found (set CHROME=/path/to/chrome).'); process.exit(2); }
const MODEL = flag('--model') || 'jev-latest', ONLY = flag('--only'), STYLES = (flag('--styles') || 'sketchpad,cyber').split(',');
const API = 'https://api.typesafe.ai/v1/systemone', OUT = 'artifacts/jev';
fs.mkdirSync(OUT, { recursive: true });

// ---- the questions ------------------------------------------------------------------------
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = k => String(k).replace(/\d/g, d => SUP[d]);
const show = f => f.map(({ p, k }) => p + (k > 1 ? sup(k) : '')).join(' × ');
const PRIMES = []; for (let p = 2; p < 200; p++) if (PRIMES.every(q => p % q)) PRIMES.push(p);
let seed = 7; const rand = k => (seed = (seed * 1103515245 + 12345) % 2147483648) % k;
const shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = rand(i + 1); [list[i], list[j]] = [list[j], list[i]]; } return list; };
function factorMisses(f) {
  const out = [], seen = new Set([show(f)]);
  for (let tries = 0; out.length < 3 && tries < 300; tries++) {
    const g = f.map(x => ({ ...x })), i = rand(g.length), kind = rand(4);
    if (kind === 0) g[i].k += g[i].k > 1 ? (rand(2) ? 1 : -1) : 1;
    else if (kind === 1) { const j = PRIMES.indexOf(g[i].p), q = PRIMES[Math.max(0, Math.min(PRIMES.length - 1, j + (rand(2) ? 1 : -1)))]; if (g.some(x => x.p === q)) continue; g[i].p = q; }
    else if (kind === 2 && g.length > 1) g.splice(i, 1);
    else { const q = [2, 3, 5, 7][rand(4)], hit = g.find(x => x.p === q); if (hit) hit.k++; else g.push({ p: q, k: 1 }); }
    const h = g.filter(x => x.k > 0).sort((a, b) => a.p - b.p), text = show(h);
    if (h.length && !seen.has(text)) { seen.add(text); out.push(text); }
  }
  return out;
}
function numeralMisses(text, base) {
  const out = [], seen = new Set([text]), digits = base === 'ternary' ? ['T', '0', '1'] : base === 'binary' ? ['0', '1'] : ['0', '1', '2'];
  const body = text.replace(/[…₂ₑ]| bal₃/g, ''), tail = text.slice(body.length), places = [...body].map((c, i) => [c, i]).filter(([c]) => c !== '.');
  for (let tries = 0; out.length < 3 && tries < 300; tries++) {
    const chars = [...body], kind = rand(4), [, at] = places[rand(places.length)];
    if (kind === 0) chars[at] = digits.filter(d => d !== chars[at])[rand(digits.length - 1)];
    else if (kind === 1 && base === 'ternary') { const ones = places.filter(([c]) => c === 'T' || c === '1'); if (!ones.length) continue; const [c, j] = ones[rand(ones.length)]; chars[j] = c === 'T' ? '1' : 'T'; }
    else if (kind === 2 && places.length > 2) chars.splice(at, 1);
    else if (body.includes('.')) { const p = chars.indexOf('.'); chars.splice(p, 1); chars.splice(Math.max(1, Math.min(chars.length - 1, p + (rand(2) ? 1 : -1))), 0, '.'); }
    else chars.splice(at, 0, digits[rand(digits.length)]);
    const miss = chars.join('').replace(/^0+(?=[^.])/, '') + tail;
    if (!seen.has(miss)) { seen.add(miss); out.push(miss); }
  }
  return out;
}
const FINGERPRINT = [
  '`picture` shows one whole number written with marbles instead of digits. Read it left to right.',
  'The large marble at the far left is only a badge for the whole number; ignore it when counting.',
  'Then come round gold containers (thin gold rings) along a thin string. Each ring holds gold marbles in a symmetric pattern: a pair, a triangle, a ring, or one marble in the middle with equal arms spiralling out round it. Count every gold marble inside the ring. That count is a prime factor.',
  "Some containers have extra gold rings round them, tilted out of the picture so that they look like ellipses through the container (like the rings of an armillary sphere or a gyroscope; the far half of each is fainter). Count all of a container's rings: its own round ring plus every tilted ring. That count says how many times that container's prime is multiplied in (just its own ring: once; one tilted ring as well: squared; two tilted rings: cubed; and so on).",
  'Which product of prime powers does `picture` show?',
];
const TRAYS = {
  binary: ['`picture` shows a whole number written in base 2 as a row of square trays, one tray per binary digit, read left to right. Each tray shows its digit (0 or 1) as a large numeral, with card stacks in the tray.',
    'Small triangles between trays only separate groups of four digits; they are not digits. Which base-2 numeral does `picture` show?'],
  ternary: ['`picture` shows a number written in balanced ternary as a row of square trays, one tray per digit, read left to right. The digits are 1, 0 and minus one. Minus one is drawn as a large 1 with a short bar over it (and a red card); in the options it is written T.',
    'Small triangles between trays only separate groups of three digits, and a triangle with a dotted stem below it is the point between the whole part and the fraction. Which balanced-ternary numeral does `picture` show?'],
  e: ['`picture` shows a number written in base e as a row of square trays, one tray per digit, read left to right. Each tray shows its digit (0, 1 or 2) as a large numeral.',
    'A plain triangle between trays separates groups of three digits; a triangle with a dotted stem below it is the point between the whole part and the fraction. Three dots after the last tray mean the digits run on (written … in the options). Which base-e numeral does `picture` show?'],
};

// ---- the pictures ---------------------------------------------------------------------------
const server = spawn(process.execPath, ['tools/serve.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
const origin = await new Promise((resolve, reject) => { server.stdout.on('data', d => { const m = String(d).match(/http:\/\/[\d.:]+/); if (m) resolve(m[0]); }); setTimeout(() => reject(Error('server did not start')), 5000); });
const page = await launch(origin + '/?examples=written', { width: 1400, height: 900 });
await new Promise(r => setTimeout(r, 600));
// Draw one picture alone on the page in a style and capture just it (at least 320 px a side:
// the API takes images from 280 to 1568 px).
async function picture(style, kind, value, base) {
  const rect = await page.eval(`(async()=>{
    const {setStyle,ink}=await import('/src/mvc/theme.js');setStyle(${JSON.stringify(style)});
    const {fingerprintSVG}=await import('/src/numbers/fingerprint.js');const {cardsSVG}=await import('/src/mvc/view.js');
    let host=document.getElementById('jev-host');if(!host){host=document.createElement('div');host.id='jev-host';document.body.append(host);}
    host.style.cssText='position:fixed;left:0;top:0;z-index:99;padding:24px;display:flex;align-items:center;justify-content:center;min-width:320px;min-height:320px;box-sizing:border-box;background:'+ink.background;
    host.innerHTML=${JSON.stringify(kind)}==='fingerprint'?fingerprintSVG(${value},{palette:ink.marble,unit:30}):cardsSVG({n:${value},d:1},${JSON.stringify(base)},{prefix:'j-'});
    const svg=host.firstElementChild;if(${JSON.stringify(kind)}!=='fingerprint'){svg.style.width=Math.min(1360,svg.viewBox.baseVal.width*.55)+'px';svg.style.height='auto';}
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all([...host.querySelectorAll('image')].map(i=>i.href?.baseVal?fetch(i.href.baseVal).catch(()=>0):0));await new Promise(r=>setTimeout(r,150));
    const r=host.getBoundingClientRect();return {x:r.x,y:r.y,width:Math.ceil(r.width),height:Math.ceil(r.height)};})()`);
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...rect, scale: 1 } });
  const file = `${OUT}/${kind}-${base || 'fp'}-${value}-${style}.png`; fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return { file, data };
}

// ---- asking Jev -----------------------------------------------------------------------------
async function ask(state, questions, assets) {
  const body = JSON.stringify({ model: MODEL, state, questions, assets });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'TypeSafe-Danger-Zone-Images': 'true' }, body });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); continue; }
    throw Error(`TypeSafe API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
}
async function read(img, instructions, truth, misses) {
  const options = shuffle([truth, ...misses]), names = ['A', 'B', 'C', 'D'].slice(0, options.length), ref = 'pic-' + crypto.randomUUID();
  const res = await ask({ picture: ref }, { reading: { type: 'choice', instructions, criteria: Object.fromEntries(names.map((n, i) => [n, options[i]])) } }, { [ref]: { type: 'image', format: 'png', data_base64: img.data } });
  const a = res.answers.reading, right = names[options.indexOf(truth)];
  return { truth, chosen: options[names.indexOf(a.choice)], right: a.choice === right, pTruth: a.probabilities[right], confidence: a.confidence, options, tokens: res.usage?.input_tokens };
}

const rows = [];
const FINGERPRINTS = [360, 49, 1001, 125, 625, 243, 128, 1024, 90, 100, 12, 30, 56, 72, 210, 105, 18, 20, 28, 45, 63, 81, 99, 121, 169, 150, 196, 225, 250, 343, 77, 91];
const NUMBERS = { binary: [5, 13, 22, 37, 100, 255, 360, 1001], ternary: [2, 5, 8, 13, 18, 40, 100, 360], e: [3, 7, 10, 30, 50, 100, 360, 1000] };
try {
  for (const style of STYLES) {
    if (ONLY !== 'trays') for (const n of FINGERPRINTS) {
      const f = factor(n), img = await picture(style, 'fingerprint', n), r = await read(img, FINGERPRINT, show(f), factorMisses(f));
      rows.push({ study: 'fingerprints', style, n, ...r });
      console.log(`${style.padEnd(9)} fingerprint ${String(n).padStart(5)} = ${r.truth.padEnd(14)} ${r.right ? 'right' : 'WRONG'}  chose ${r.chosen.padEnd(14)} p(truth) ${r.pTruth.toFixed(2)}  confidence ${r.confidence.toFixed(2)}`);
    }
    if (ONLY !== 'fingerprints') for (const [base, list] of Object.entries(NUMBERS)) for (const n of list) {
      const truth = baseText({ n, d: 1 }, base), img = await picture(style, 'trays', n, base), r = await read(img, TRAYS[base], truth, numeralMisses(truth, base));
      rows.push({ study: `trays ${base}`, style, n, ...r });
      console.log(`${style.padEnd(9)} ${base.padEnd(7)} ${String(n).padStart(5)} = ${r.truth.padEnd(16)} ${r.right ? 'right' : 'WRONG'}  chose ${r.chosen.padEnd(16)} p(truth) ${r.pTruth.toFixed(2)}  confidence ${r.confidence.toFixed(2)}`);
    }
  }
} finally { await page.close(); server.kill(); }

// ---- the score ------------------------------------------------------------------------------
fs.writeFileSync(`${OUT}/answers.json`, JSON.stringify({ model: MODEL, date: new Date().toISOString(), rows }, null, 1));
const groups = new Map(); for (const r of rows) { const k = `${r.study}|${r.style}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
let table = '| pictures | style | read right | confident (≥ 0.6) reads that were right | mean p(truth) |\n|---|---|---|---|---|\n';
for (const [k, list] of groups) {
  const [study, style] = k.split('|'), right = list.filter(r => r.right).length, sure = list.filter(r => r.confidence >= .6), sureRight = sure.filter(r => r.right).length;
  table += `| ${study} (${list.length}) | ${style} | ${right} (${Math.round(100 * right / list.length)}%) | ${sureRight} of ${sure.length} | ${(list.reduce((s, r) => s + r.pTruth, 0) / list.length).toFixed(2)} |\n`;
}
const misses = rows.filter(r => !r.right).map(r => `* ${r.study}, ${r.style}: ${r.n} = ${r.truth}, read as ${r.chosen} (confidence ${r.confidence.toFixed(2)})`).join('\n');
fs.writeFileSync(`${OUT}/summary.md`, `Model ${MODEL}, ${new Date().toISOString().slice(0, 10)}\n\n${table}\n${misses || 'No misses.'}\n`);
console.log('\n' + table + '\n' + (misses || 'No misses.'));
