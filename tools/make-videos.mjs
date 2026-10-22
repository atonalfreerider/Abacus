// Tutorial videos, recorded from the real app in headless Chrome.
// Usage: npm run videos [-- base-ten carry-borrow solving-for-x] [--format landscape|portrait] [--draft]
//        npm run videos:machine [-- machine-multiply binary-carry …]   (the same as --silent)
// With no names, `npm run videos` records the three narrated tutorials and `--silent` the ten
// silent, captioned Machine explainers; names may come from either set.
// Writes videos/<name>-<format>.mp4 (narrated) or videos/machine/<name>-<format>.mp4 (silent),
// 1920×1080 or 1080×1920 at 30 fps, each with a matching .srt.
// Narration: ElevenLabs (see tools/video/voice.mjs for the key and voice settings); the
// silent explainers never need it.
import {spawn} from 'node:child_process';
import {chromePath} from './browser.mjs';
import {record, formats} from './video/studio.mjs';
import {tutorials} from './video/tutorials.mjs';
import {machineTutorials} from './video/machine-tutorials.mjs';

const args = process.argv.slice(2), flag = name => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const format = flag('--format'), draft = args.includes('--draft'), silent = args.includes('--silent'), names = args.filter(a => !a.startsWith('--'));
const entry = name => tutorials[name] ?? machineTutorials[name];
const chosen = names.length ? names : Object.keys(silent ? machineTutorials : tutorials);
for (const name of chosen) if (!entry(name)) throw Error(`Unknown tutorial ${name}; narrated: ${Object.keys(tutorials).join(', ')}; silent (--silent): ${Object.keys(machineTutorials).join(', ')}.`);
if (format && !formats[format]) throw Error(`Unknown format ${format}; choose landscape or portrait.`);
if (!chromePath()) throw Error('Chrome not found. Set CHROME=/path/to/chrome.');
// A tutorial's overlay variables, either for every format or keyed by format.
const overlayFor = (t, f) => (t.overlay && Object.keys(formats).some(k => k in t.overlay) ? t.overlay[f] : t.overlay) ?? {};

const server = spawn(process.execPath, ['tools/serve.mjs'], {env: {...process.env, PORT: '0'}, stdio: ['ignore', 'pipe', 'inherit']});
const origin = await new Promise((resolve, reject) => { server.stdout.on('data', d => { const m = String(d).match(/http:\/\/[\d.:]+/); if (m) resolve(m[0]); }); setTimeout(() => reject(Error('server did not start')), 5000); });
const log = message => console.log(`${new Date().toISOString().slice(11, 19)} ${message}`);
try {
  for (const name of chosen) {
    const t = entry(name);
    // Both formats record at once; narration is cached, so the second request is free.
    await Promise.all((format ? [format] : Object.keys(formats)).map(async f => {
      const out = t.silent ? `videos/machine/${name}-${f}.mp4` : `videos/${name}-${f}.mp4`, started = Date.now();
      const {seconds} = await record({origin, format: f, script: t.script, out, scale: draft ? 1 : undefined, log, ...(t.path ? {path: t.path} : {}), silent: !!t.silent, overlay: overlayFor(t, f)});
      log(`${out}: ${seconds.toFixed(1)} s of video in ${((Date.now() - started) / 1000).toFixed(0)} s`);
    }));
  }
} finally { server.kill(); }
