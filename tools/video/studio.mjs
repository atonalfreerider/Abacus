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
  portrait: {width: 540, height: 960, scale: 2, overlay: {finger: '46px', 'caption-bottom': '240px', 'caption-width': '92%', 'caption-size': '27px', 'title-size': '76px', 'chip-top': '66px', 'chip-size': '20px', 'label-size': '21px', 'key-top': 'auto', 'key-bottom': '250px', 'key-right': '18px', 'key-size': '24px'}, captionChars: 60},
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
// A silent caption a little past the width splits at its first colon into a scrap ('13 + 9:')
// that would flash by; a scrap joins its neighbour when the two fit in about two lines.
function tidy(chunks, limit) {
  const out = [];
  for (const c of chunks) {
    const last = out.at(-1), join = (a, b) => ({text: `${a.text} ${b.text}`, start: a.start, end: b.end});
    if (last && (last.text.length < 20 || c.text.length < 20) && last.text.length + c.text.length + 1 <= limit * 1.3) out[out.length - 1] = join(last, c);
    else out.push(c);
  }
  return out;
}
const stamp = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

// Reading pace for silent captions: about 15 characters a second, at least 1.6 s.
export const readingTime = text => Math.max(1.6, .8 + text.length / 15);
// Real key events (DevTools Input.dispatchKeyEvent): [code, key code, text typed].
const KEYS = {Enter: ['Enter', 13, '\r'], Escape: ['Escape', 27], Tab: ['Tab', 9], Backspace: ['Backspace', 8], ' ': ['Space', 32, ' '],
  ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40], Home: ['Home', 36], End: ['End', 35],
  '[': ['BracketLeft', 219, '['], ']': ['BracketRight', 221, ']']};
const keyOf = key => KEYS[key] ?? (/^[a-z]$/i.test(key) ? [`Key${key.toUpperCase()}`, key.toUpperCase().charCodeAt(0), key] : /^\d$/.test(key) ? [`Digit${key}`, key.charCodeAt(0), key] : null);
const KEY_LABEL = {Enter: 'Enter ⏎', Escape: 'Esc', ' ': 'Space', ArrowLeft: '←', ArrowUp: '↑', ArrowRight: '→', ArrowDown: '↓'};

// path: where the page opens (default the equation space with the written examples).
// silent: a captioned explainer with no narration (ctx.say refuses; use ctx.caption).
// overlay: overlay variables that override the format's for this video.
export async function record({origin, format: formatName, script, out, fps = 30, scale, quality = 90, log = () => {}, path: start = '/?examples=written', silent: quiet = false, overlay: vars = {}}) {
  const format = formats[formatName], dt = 1 / fps;
  scale ??= format.scale;
  const page = await launch('about:blank', {width: format.width, height: format.height, scale});
  await page.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  await page.send('Page.addScriptToEvaluateOnNewDocument', {source: virtualTime});
  await page.goto(origin + start);
  // Let textures decode (real time) while advancing the app a little.
  for (let i = 0; i < 20; i++) { await page.eval('__vt.advance(16)'); await wait(40); }
  // The machine opens on first use: wait (real time) for its automation hook.
  if (/[?&]automation\b/.test(start)) for (let i = 0; !(await page.eval('!!window.__machine')); i++) { if (i > 200) throw Error(`${start}: the machine did not open`); await page.eval('__vt.advance(16)'); await wait(50); }
  await page.eval(overlay);
  await page.eval(`__rec.config(${JSON.stringify({...format.overlay, ...vars})})`);

  fs.mkdirSync(path.dirname(out), {recursive: true});
  const bare = out.replace(/\.mp4$/, '.video.mp4');
  const encoder = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), bare], {stdio: ['pipe', 'ignore', 'inherit']});
  const encoded = new Promise((resolve, reject) => encoder.on('exit', code => code ? reject(Error('ffmpeg exited ' + code)) : resolve()));

  let time = 0, app = 0, frames = 0, rate = 1, caption = '';
  const clips = [], captions = [];
  const touch = {x: 0, y: 0, visible: 0, pressed: 0};
  async function frame() {
    const now = time;
    const shown = captions.find(c => now >= c.start && now < c.end), current = shown ? `${shown.at || ''}|${shown.text}` : '';
    const calls = [`__vt.advance(${1000 * dt * rate})`, `__rec.touch(${JSON.stringify(touch)})`];
    app += 1000 * dt * rate;
    if (current !== caption) { caption = current; calls.push(`__rec.caption(${JSON.stringify(shown?.text || '')},${JSON.stringify(shown?.at || '')})`); }
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
      if (quiet) throw Error('silent video: use ctx.caption');
      const clip = await speak(text), start = time;
      clips.push({start, pcm: clip.pcm});
      for (const c of chunk(clip.words, format.captionChars)) captions.push({text: c.text, start: start + c.start, end: start + c.end + .25});
      // Chunks meet: each caption holds until the next one begins.
      captions.sort((a, b) => a.start - b.start).forEach((c, i, all) => { if (all[i + 1] && all[i + 1].start - c.end < .6) c.end = all[i + 1].start; });
      const at = word => { const w = clip.words.find(w => w.text.toLowerCase().replace(/\W/g, '') === word.toLowerCase()); if (!w) throw Error(`"${word}" is not in: ${text}`); return start + w.start; };
      return {start, end: start + clip.duration, at, done: (pad = .35) => ctx.until(start + clip.duration + pad), word: word => ctx.until(at(word))};
    },
    // A silent caption (no narration): shown now for `seconds` (by default long enough to
    // read: about 15 characters a second, at least 1.6 s). await caption.done() waits it out.
    // Text longer than the format's caption width is shown in chunks, timed by their length;
    // {at: 'top'} puts it in the top band. A new caption replaces the one on screen.
    caption(text, seconds, {at} = {}) {
      const start = time, length = seconds ?? readingTime(text), end = start + length;
      for (const c of captions) if (c.start <= start && c.end > start) c.end = start;
      const words = text.split(/\s+/).filter(Boolean), total = words.reduce((n, w) => n + w.length + 1, 0);
      let chars = 0;
      const timed = words.map(w => { const s = start + length * chars / total; chars += w.length + 1; return {text: w, start: s, end: start + length * chars / total}; });
      const mine = tidy(chunk(timed, format.captionChars), format.captionChars).map(c => ({text: c.text, start: c.start, end: c.end, at}));
      captions.push(...mine);
      captions.sort((a, b) => a.start - b.start);
      // stop() takes the caption down now (a chunk not yet shown is dropped).
      return {start, end, done: (pad = .2) => ctx.until(end + pad), stop: () => { for (const c of mine) c.end = Math.max(c.start, Math.min(c.end, time)); }};
    },
    // Hold the picture: video time passes while the app's clock stands still.
    async freeze(seconds) { const previous = rate; rate = 0; await ctx.hold(seconds); rate = previous; },
    // Play exactly `ms` of app time at `speed` (app ms per video ms), the last frame partial.
    async advance(ms, speed = 1) {
      const previous = rate;
      for (let left = ms; left > .5;) { const step = Math.min(left, 1000 * dt * speed); rate = step / (1000 * dt); await frame(); left -= step; }
      rate = previous;
    },
    // A real key press (keyDown and keyUp) on the focused element, with a keycap on screen
    // (label: null presses it unseen).
    async key(key, {label = KEY_LABEL[key] ?? key.toUpperCase()} = {}) {
      const k = keyOf(key); if (!k) throw Error(`ctx.key: unknown key ${key}`);
      const [code, vk, text] = k, base = {key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk};
      if (label) await page.eval(`__rec.key(${JSON.stringify(label)})`);
      await page.send('Input.dispatchKeyEvent', {type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? {text} : {})});
      await page.send('Input.dispatchKeyEvent', {type: 'keyUp', ...base});
    },
    // Tap a field, then type into it, one character per 80 ms of video (replacing what was there).
    async type(selector, text, {per = .08, replace = true} = {}) {
      await ctx.tap(() => ctx.element(selector));
      await page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus({preventScroll:true});${replace ? 'e.select?.();' : ''}})()`);
      const from = time;
      for (const [i, ch] of [...text].entries()) { await page.send('Input.insertText', {text: ch}); await ctx.until(from + per * (i + 1)); }
    },
    // Zoom the page's camera by `factor` about a point (CSS px) with real wheel events, eased
    // over `seconds`; freeze holds the app's clock meanwhile (a close-up between beats).
    async wheel(point, factor, seconds = 1, {freeze = true} = {}) {
      const p = await resolve(point), n = Math.max(1, Math.round(seconds * fps)), previous = rate;
      if (freeze) rate = 0;
      await page.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: p.x, y: p.y});
      for (let i = 1; i <= n; i++) {
        const step = Math.log(factor) * (ease(i / n) - ease((i - 1) / n));
        await page.send('Input.dispatchMouseEvent', {type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: -step / .0015});
        await frame();
      }
      rate = previous;
    },
    // Title and end cards with a row of bulbs: {bits, base, title, subtitle} or {rows: [...]}.
    bulbTitle: (spec, on = true, fade = .5) => page.eval(`__rec.bulbTitle(${JSON.stringify(spec)},${on},${fade})`),
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
  ctx.machine = machineHelpers(ctx, page);

  try {
    await script(ctx);
    await ctx.hold(.5);
  } finally {
    encoder.stdin.end();
    await encoded.catch(error => { throw error; });
    if (page.errors.length) log(`${formatName}: page errors: ${page.errors.join(' | ')}`);
    await page.close();
  }
  if (clips.length) {
    const wav = out.replace(/\.mp4$/, '.wav');
    mixWav(clips, frames / fps, wav);
    // Speech normalized to −16 LUFS, the usual loudness for online video.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', bare, '-i', wav, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
    fs.rmSync(wav);
  } else execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', bare, '-c:v', 'copy', '-movflags', '+faststart', out]);  // silent explainers: captions only, no audio track
  fs.rmSync(bare);
  fs.writeFileSync(out.replace(/\.mp4$/, '.srt'), captions.filter(c => c.end > c.start).map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
  return {seconds: frames / fps, frames};
}

// The Machine, driven through its automation hook (window.__machine, design 6.7). The app
// plays under AUTO on its own beat clock, which reads the page's virtual time, so these
// helpers pace a run purely by how much app time each video frame advances: a beat can be
// played at speed, stretched over a caption's reading time, or held (frozen) at its end.
function machineHelpers(ctx, page) {
  const hook = (call, ...args) => page.eval(`window.__machine.${call}(${args.map(a => JSON.stringify(a)).join(',')})`);
  // Seconds since the run began at plan time t (beats chain with no gaps: no read-along).
  const elapsed = (beats, t) => {
    const n = beats.length; if (!n) return 0;
    if (t >= n) return beats[n - 1].end;
    const k = Math.max(0, Math.floor(t + 1e-9)), b = beats[k];
    return b.start + Math.max(0, t - k) * (b.end - b.start);
  };
  const m = {
    load: params => hook('load', {auto: 1, ...params}),
    beats: () => hook('beats'),
    state: () => hook('state'),
    plan: () => hook('plan'),
    chrome: mode => hook('chrome', mode),
    seek: t => hook('seek', t),
    // Start the run with a real Enter (the Enter rule), shown as a keycap unless label is
    // null, pressed in `field` if given (else wherever the focus is: the stage, as a rule).
    async start({label = 'Enter ⏎', field} = {}) {
      if (field) await page.eval(`document.querySelector(${JSON.stringify(field)}).focus({preventScroll:true})`);
      await ctx.key('Enter', {label});
      const s = await m.state();
      if (!s.playing) throw Error(`machine: the run did not start (${s.error || s.caption || 'not playing'})`);
    },
    // Play (at `speed`× the app's own pace) until plan time `target` (a beat boundary).
    async to(target, {speed = 1} = {}) {
      const [beats, s] = await Promise.all([m.beats(), m.state()]);
      const n = beats.length, goal = target === 'end' ? n : Math.min(n, target);
      if (s.t >= goal - 1e-9) return;
      if (!s.playing) throw Error(`machine: cannot reach t = ${goal}: the run is not playing (t = ${s.t})`);
      const at = goal >= n ? beats[n - 1].end : beats[goal].start;
      await ctx.advance((at - elapsed(beats, s.t)) * 1000, speed);
    },
    // Frames advance until beat i (or the whole run: 'end') has ended.
    until: (i, options) => m.to(i === 'end' ? 'end' : i + 1, options),
    // App time (ms) from now to the end of beat i: all of it from the beat's start, or what
    // is left of it if the run is already inside it.
    async left(i) {
      const [beats, s] = await Promise.all([m.beats(), m.state()]);
      return {beats, ms: Math.max(0, (beats[i].end - elapsed(beats, s.t)) * 1000)};
    },
    // Wait for beat i, then play it over `seconds` of video.
    async stretch(i, seconds) {
      await m.to(i);
      await ctx.stretch((await m.left(i)).ms, seconds);
    },
    // Beat i with captions: `text` (default the plan's own caption for the beat; a function
    // receives it) shows as the beat plays, and the beat lasts max(min, its reading time), so
    // AUTO never moves on before the caption has been read and the subtitle never disagrees
    // with the maths. `before` captions are read with the picture held at the start of the
    // beat, `extra` ones with it held at the end; `hold` (a moment by default) keeps the end
    // of the beat on screen before the next one starts.
    // i may be a range [first, last] of beats that share the captions; `speed` plays them no
    // slower than that multiple of the app's pace (the captions still get their reading time).
    async captionBeat(i, {text, before = [], extra = [], min = 1.5, hold = .35, at, speed} = {}) {
      const [first, last] = [].concat(i, i);
      await m.to(first);
      for (const line of [].concat(before)) await m.note(line, {at});
      const {beats, ms: length} = await m.left(last), own = beats[first].caption, lines = [].concat(typeof text === 'function' ? text(own) : text ?? own);
      const reading = lines.reduce((s, l) => s + readingTime(l), 0);
      const seconds = Math.max(speed ? 0 : min, reading, speed ? length / 1000 / speed : 0);
      // several lines share the beat in proportion to their reading time; each caption
      // stays until the next one replaces it, so none blinks out between frames
      for (const [k, line] of lines.entries()) {
        const share = seconds * readingTime(line) / reading;
        ctx.caption(line, share + .25 + (k === lines.length - 1 ? hold : 0), {at});
        await ctx.stretch(length * share / seconds, share);
      }
      for (const line of [].concat(extra)) await m.note(line, {at});
      if (hold) await ctx.freeze(hold);
    },
    // A caption read with the picture held still (no app time passes).
    async note(text, {at, extra = 0} = {}) { const c = ctx.caption(text, null, {at}); await ctx.freeze(c.end - c.start + extra); },
    // A point on the stage, in CSS pixels, at a tower's level (dx, dy in machine units): from
    // the transform of one of the tower's drawn bulbs (render.js marks them data-t and data-l).
    point: (tower, level = 0, {dx = 0, dy = 0} = {}) => page.eval(`(()=>{
      const g=document.querySelector('#machine-svg .mb[data-t="'+${JSON.stringify(tower)}+'"]');if(!g)throw Error('no tower '+${JSON.stringify(tower)});
      const t=/translate\\(([-\\d.]+)[ ,]+([-\\d.]+)\\)/.exec(g.getAttribute('transform'));
      const p=new DOMPoint(+t[1]+${dx},+t[2]-84*(${level}-Number(g.dataset.l))+${dy}).matrixTransform(g.parentNode.getScreenCTM());
      return {x:p.x,y:p.y};})()`),
    // Back to following the beat (T: the camera recentres on the active node).
    centre: () => page.eval(`document.getElementById('machine-centre').click()`),
  };
  return m;
}
