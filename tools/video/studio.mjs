// Records one tutorial in one format. The page runs on virtual time: each video frame
// advances the app clock by exactly 1/fps (times `rate`, for slow motion) and is
// captured, so animations, drags and narration line up frame for frame.
// Touches are real DevTools touch events; the overlay only draws where they land.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {launch} from '../browser.mjs';
import {virtualTime, overlay} from './page.js';
import {speak, mixWav} from './voice.mjs';

// CSS viewport × device scale = 1920×1080 or 1080×1920 video.
export const formats = {
  landscape: {width: 1280, height: 720, scale: 1.5, overlay: {finger: '52px', 'caption-bottom': '10px', 'caption-width': '80%', 'caption-size': '30px', 'title-size': '104px', 'chip-top': '18px', 'chip-size': '22px', 'label-size': '22px'}, captionChars: 64},
  portrait: {width: 540, height: 960, scale: 2, overlay: {finger: '46px', 'caption-bottom': '240px', 'caption-width': '92%', 'caption-size': '27px', 'title-size': '76px', 'chip-top': '66px', 'chip-size': '20px', 'label-size': '21px'}, captionChars: 60},
};

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const wait = ms => new Promise(r => setTimeout(r, ms));
// Caption chunks: clauses end at sentence punctuation (or a comma in a long clause);
// short clauses share a chunk, and long ones split into balanced parts, never orphans.
function chunk(words, limit) {
  const text = list => list.map(w => w.text).join(' ');
  const clauses = [];let current = [];
  for (const word of words) {
    current.push(word);
    if (/[.!?:;]$/.test(word.text) || /,$/.test(word.text) && text(current).length > limit * .6) { clauses.push(current); current = []; }
  }
  if (current.length) clauses.push(current);
  const merged = [];
  for (const clause of clauses) { const last = merged.at(-1); if (last && text([...last, ...clause]).length <= limit) last.push(...clause); else merged.push([...clause]); }
  const chunks = [];
  for (const clause of merged) {
    const parts = Math.ceil(text(clause).length / limit), target = text(clause).length / parts;
    let part = [];
    for (const [i, word] of clause.entries()) {
      if (part.length && text([...part, word]).length > target * 1.1 && clause.length - i > 1) { chunks.push(part); part = []; }
      part.push(word);
    }
    chunks.push(part);
  }
  return chunks.map(list => ({text: text(list), start: list[0].start, end: list.at(-1).end}));
}
const stamp = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

export async function record({origin, format: formatName, script, out, fps = 30, scale, quality = 90, log = () => {}}) {
  const format = formats[formatName], dt = 1 / fps;
  scale ??= format.scale;
  const page = await launch('about:blank', {width: format.width, height: format.height, scale});
  await page.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  await page.send('Page.addScriptToEvaluateOnNewDocument', {source: virtualTime});
  await page.goto(origin + '/?examples=written');
  // Let textures decode (real time) while advancing the app a little.
  for (let i = 0; i < 20; i++) { await page.eval('__vt.advance(16)'); await wait(40); }
  await page.eval(overlay);
  await page.eval(`__rec.config(${JSON.stringify(format.overlay)})`);

  fs.mkdirSync(path.dirname(out), {recursive: true});
  const silent = out.replace(/\.mp4$/, '.video.mp4');
  const encoder = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), silent], {stdio: ['pipe', 'ignore', 'inherit']});
  const encoded = new Promise((resolve, reject) => encoder.on('exit', code => code ? reject(Error('ffmpeg exited ' + code)) : resolve()));

  let time = 0, app = 0, frames = 0, rate = 1, caption = '';
  const clips = [], captions = [];
  const touch = {x: 0, y: 0, visible: 0, pressed: 0};
  async function frame() {
    const now = time;
    const current = captions.find(c => now >= c.start && now < c.end)?.text || '';
    const calls = [`__vt.advance(${1000 * dt * rate})`, `__rec.touch(${JSON.stringify(touch)})`];
    app += 1000 * dt * rate;
    if (current !== caption) { caption = current; calls.push(`__rec.caption(${JSON.stringify(current)})`); }
    calls.push(`__rec.frame(${dt})`);
    await page.eval(calls.join(';'));
    const {data} = await page.send('Page.captureScreenshot', {format: 'jpeg', quality});
    if (!encoder.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => encoder.stdin.once('drain', r));
    time += dt; frames++;
    if (frames % (fps * 10) === 0) log(`${formatName}: ${time.toFixed(0)} s recorded`);
  }
  const touchEvent = (type, x, y) => page.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y, id: 1, radiusX: 11, radiusY: 11, force: 1}]});
  const resolve = async point => typeof point === 'function' ? point() : point;

  const ctx = {
    format: formatName, portrait: formatName === 'portrait',
    get time() { return time; },
    set rate(value) { rate = value; }, get rate() { return rate; },
    // App clock (ms). A drop starts its animation at the app time drag() returns.
    get app() { return app; },
    async playTo(ms, speed = 1) { const previous = rate; rate = speed; while (app < ms - 1e-6) await frame(); rate = previous; },
    // Play exactly `ms` of app time spread over `seconds` of video (slow motion).
    async stretch(ms, seconds) { const previous = rate, n = Math.max(1, Math.round(seconds * fps)); rate = ms / (n * dt * 1000); for (let i = 0; i < n; i++) await frame(); rate = previous; },
    eval: expression => page.eval(expression),
    async hold(seconds) { const end = time + seconds; while (time < end - 1e-9) await frame(); },
    async until(t) { while (time < t - 1e-9) await frame(); },
    // Narration starts now and plays while the script carries on; await line.done() to wait for it.
    async say(text) {
      const clip = await speak(text), start = time;
      clips.push({start, pcm: clip.pcm});
      for (const c of chunk(clip.words, format.captionChars)) captions.push({text: c.text, start: start + c.start, end: start + c.end + .25});
      // Chunks meet: each caption holds until the next one begins.
      captions.sort((a, b) => a.start - b.start).forEach((c, i, all) => { if (all[i + 1] && all[i + 1].start - c.end < .6) c.end = all[i + 1].start; });
      const at = word => { const w = clip.words.find(w => w.text.toLowerCase().replace(/\W/g, '') === word.toLowerCase()); if (!w) throw Error(`"${word}" is not in: ${text}`); return start + w.start; };
      return {start, end: start + clip.duration, at, done: (pad = .35) => ctx.until(start + clip.duration + pad), word: word => ctx.until(at(word))};
    },
    // Frames advance until an in-page condition holds (or the timeout passes).
    async whenever(condition, {timeout = 20} = {}) { const end = time + timeout; while (time < end && !(await page.eval(condition))) await frame(); },
    busy: () => page.eval(`document.getElementById('solve').disabled`),
    async idle({rate: slow = rate, timeout = 30} = {}) {
      const previous = rate; rate = slow;
      const end = time + timeout;
      await frame();
      while (time < end && await ctx.busy()) await frame();
      rate = previous;
    },
    // Terms on screen, in CSS pixels: {id, label, value, side, x, y, w, h}.
    terms: () => page.eval(`[...document.querySelectorAll('#equation-svg [data-term]:not(.placeholder)')].map(n=>{const r=n.querySelector('.hit').getBoundingClientRect(),label=n.getAttribute('aria-label')||'';return {id:n.dataset.term,label,value:label.split(',')[0].replace('−','-'),side:n.dataset.side,x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})`),
    async term(value, nth = 0) { const all = (await ctx.terms()).filter(t => t.value === value); if (!all[nth]) throw Error(`No card ${value} (have ${(await ctx.terms()).map(t => t.value)})`); return all[nth]; },
    mirror: () => page.eval(`(()=>{const r=document.querySelector('#equation-svg .equals-mirror').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`),
    element: selector => page.eval(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`),
    // Load a problem between frames (no dialog is shown).
    async load(text) {
      await page.eval(`(()=>{const i=document.getElementById('equation-input');document.getElementById('open-equation').click();i.value=${JSON.stringify(text)};document.getElementById('equation-form').requestSubmit();})()`);
      const status = await page.eval(`document.getElementById('feedback').textContent`);
      if (status) throw Error(`Loading ${text}: ${status}`);
    },
    // The finger appears, presses, and lifts. A tap on a button or a card.
    async tap(point, {press = .14} = {}) {
      const p = await resolve(point);
      await ctx.approach(p);
      touch.pressed = 1; await touchEvent('touchStart', p.x, p.y); await page.eval(`__rec.ripple(${p.x},${p.y})`);
      await ctx.hold(press);
      touch.pressed = 0; await touchEvent('touchEnd', p.x, p.y);
      await ctx.leave();
    },
    async approach(p, seconds = .3) {
      Object.assign(touch, {x: p.x, y: p.y});
      const frames = Math.round(seconds * fps);
      for (let i = 1; i <= frames; i++) { touch.visible = ease(i / frames); await frame(); }
    },
    async leave(seconds = .3) {
      const frames = Math.round(seconds * fps);
      for (let i = frames - 1; i >= 0; i--) { touch.visible = ease(i / frames); await frame(); }
    },
    // A touch drag along a gentle arc. `via` points are passed through in order; `pause`
    // holds at each via point (seconds), and `settle` holds before lifting the finger.
    async drag(from, to, {duration = 1.2, via = [], pause = 0, settle = .35, lift = 0, after = rate} = {}) {
      const start = await resolve(from), stops = [...(await Promise.all(via.map(resolve))), await resolve(to)];
      await ctx.approach(start);
      touch.pressed = 1; await touchEvent('touchStart', start.x, start.y); await page.eval(`__rec.ripple(${start.x},${start.y})`);
      await ctx.hold(.22);
      let a = start;
      const total = stops.reduce((sum, b, i) => sum + Math.hypot(b.x - (i ? stops[i - 1] : start).x, b.y - (i ? stops[i - 1] : start).y), 0);
      for (const [index, b] of stops.entries()) {
        const length = Math.hypot(b.x - a.x, b.y - a.y), seconds = Math.max(.25, duration * length / total), n = Math.round(seconds * fps);
        for (let i = 1; i <= n; i++) {
          const k = ease(i / n), arc = Math.sin(Math.PI * k) * lift;
          touch.x = a.x + (b.x - a.x) * k; touch.y = a.y + (b.y - a.y) * k - arc;
          await touchEvent('touchMove', touch.x, touch.y); await frame();
        }
        a = b;
        if (index < stops.length - 1 && pause) await ctx.hold(pause);
      }
      await ctx.hold(settle);
      touch.pressed = 0; await touchEvent('touchEnd', a.x, a.y);
      const released = app, previous = rate; rate = after;
      await ctx.leave();
      rate = previous;
      return released;
    },
    chip: text => page.eval(`__rec.chip(${JSON.stringify(text || '')})`),
    card: (html, on = true, fade = .5) => page.eval(`__rec.card(${JSON.stringify(html || '')},${on},${fade})`),
    // Cut to a new problem behind a quick paper fade.
    async cut(fn) { await ctx.card('', true, .25); await ctx.hold(.3); await fn(); await ctx.card('', false, .25); await ctx.hold(.3); },
    labels: (term, names) => page.eval(`__rec.labels(${JSON.stringify(term || null)},${JSON.stringify(names || [])})`),
    setCamera: camera => page.eval(`(()=>{const s=document.getElementById('camera');s.value=${JSON.stringify(camera)};s.dispatchEvent(new Event('change'));})()`),
  };

  try {
    await script(ctx);
    await ctx.hold(.5);
  } finally {
    encoder.stdin.end();
    await encoded.catch(error => { throw error; });
    if (page.errors.length) log(`${formatName}: page errors: ${page.errors.join(' | ')}`);
    await page.close();
  }
  const wav = out.replace(/\.mp4$/, '.wav');
  mixWav(clips, frames / fps, wav);
  // Speech normalized to −16 LUFS, the usual loudness for online video.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', wav, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  fs.rmSync(silent); fs.rmSync(wav);
  fs.writeFileSync(out.replace(/\.mp4$/, '.srt'), captions.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
  return {seconds: frames / fps, frames};
}
