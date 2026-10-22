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
    const calls = ['window.__recCam?.tick()', `__vt.advance(${1000 * dt * rate})`, `__rec.touch(${JSON.stringify(touch)})`];
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
  // The pieces a silent caption shows in: past the format's width it splits at clause ends
  // into balanced parts (chunk), and a scrap joins its neighbour (tidy). A clause that ends in
  // a colon introduces the next piece, so it moves down to it when a sentence ends before it
  // ('… their levels.' / 'Level 0: a lit bulb …').
  const pieces = text => {
    const words = text.split(/\s+/).filter(Boolean).map((w, i) => ({text: w, start: i, end: i + 1}));
    const out = tidy(chunk(words, format.captionChars), format.captionChars).map(c => c.text);
    for (let i = 0; i + 1 < out.length; i++) {
      const m = /^(.*[.!?])\s+([^.!?]*:)$/.exec(out[i]);
      if (m && `${m[2]} ${out[i + 1]}`.length <= format.captionChars) [out[i], out[i + 1]] = [m[1], `${m[2]} ${out[i + 1]}`];
    }
    return out;
  };
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
    // A silent caption (no narration): shown now for `seconds`, by default long enough to
    // read. await caption.done() waits it out. Text longer than the format's caption width is
    // shown in pieces (pieces()), one after another, each on screen for its own reading time
    // (about 15 characters a second, at least 1.6 s); a given `seconds` is shared out in
    // proportion to those times, and `tail` keeps the last piece up a little longer.
    // {at: 'top'} puts it in the top band. A new caption replaces the one on screen.
    caption(text, seconds, {at, tail = 0} = {}) {
      const start = time, parts = pieces(text), need = parts.map(readingTime), total = need.reduce((a, b) => a + b, 0);
      const length = seconds ?? total, end = start + length + tail;
      for (const c of captions) if (c.start <= start && c.end > start) c.end = start;
      let from = start;
      const mine = parts.map((piece, i) => { const c = {text: piece, start: from, end: from + length * need[i] / total, at}; from = c.end; return c; });
      if (mine.length) mine.at(-1).end = end;
      captions.push(...mine);
      captions.sort((a, b) => a.start - b.start);
      // stop() takes the caption down now (a piece not yet shown is dropped).
      return {start, end, done: (pad = .2) => ctx.until(end + pad), stop: () => { for (const c of mine) c.end = Math.max(c.start, Math.min(c.end, time)); }};
    },
    // How long a caption needs on screen: the reading times of the pieces it shows in.
    readingTime: text => pieces(text).reduce((s, piece) => s + readingTime(piece), 0),
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
  ctx.machine = machineHelpers(ctx, page, {frame, fps});

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
function machineHelpers(ctx, page, {frame, fps}) {
  const hook = (call, ...args) => page.eval(`window.__machine.${call}(${args.map(a => JSON.stringify(a)).join(',')})`);
  // Seconds since the run began at plan time t (beats chain with no gaps: no read-along).
  const elapsed = (beats, t) => {
    const n = beats.length; if (!n) return 0;
    if (t >= n) return beats[n - 1].end;
    const k = Math.max(0, Math.floor(t + 1e-9)), b = beats[k];
    return b.start + Math.max(0, t - k) * (b.end - b.start);
  };
  const m = {
    load: async params => { await page.eval('window.__recCam?.stop()'); return hook('load', {auto: 1, ...params}); },
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
      const reading = lines.reduce((s, l) => s + ctx.readingTime(l), 0);
      const seconds = Math.max(speed ? 0 : min, reading, speed ? length / 1000 / speed : 0);
      // several lines share the beat in proportion to their reading time (each line's pieces
      // in proportion to theirs); each caption stays until the next one replaces it, so none
      // blinks out between frames
      for (const [k, line] of lines.entries()) {
        const share = seconds * ctx.readingTime(line) / reading;
        ctx.caption(line, share, {at, tail: .25 + (k === lines.length - 1 ? hold : 0)});
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
    // Close-ups. The app's camera frames each beat for the whole viewport (from the socket a
    // block hangs from down to its towers), which can leave bulbs a few pixels across. These
    // take the camera over with the stage's own wheel zoom and drag pan, and give it back to
    // the app seamlessly. Specs:
    //   {nodes, scenes: [a, b], max = 1.6, min, align}: frame those nodes and the towers on
    //     them at plan times a to b, at most `max` times the app's own camera at b (at least
    //     `min` times, cutting the box's foot off, or its middle with align: 'centre');
    //   {tower, level, dx, dy, factor, centre}: `factor` times closer about a point of a tower
    //     (as point()), from the app's camera at this moment; centre: true brings the point to
    //     the middle of the picture;
    //   {at: t}: the app's own camera at plan time t (to get to a beat's frame early).
    // zoom() moves there now, eased over `seconds` with the app's clock held (freeze: false
    // lets it run); follow() moves there as the run plays from plan time t0 to t1, with the
    // app's own easing, and follow('auto', [t0, t1]) eases back onto the app's camera, which
    // then takes over again; unzoom() goes back at once (held), then hands the camera over.
    async zoom(spec, {seconds = .8, freeze = true} = {}) {
      await install();
      await move(await page.eval(`__recCam.target(${JSON.stringify(spec)})`), seconds, freeze);
    },
    async follow(spec, [t0, t1]) {
      await install();
      await page.eval(`__recCam.follow(${JSON.stringify(spec)},${t0},${t1})`);
    },
    async unzoom({seconds = .8, freeze = true} = {}) {
      await install();
      await move(await page.eval('__recCam.auto()'), seconds, freeze);
      await m.centre();
    },
  };
  const install = () => page.eval(CAMERA);
  async function move(target, seconds, freeze) {
    const from = await page.eval('__recCam.stop(), __recCam.now().cam'), n = Math.max(1, Math.round(seconds * fps)), previous = ctx.rate;
    if (freeze) ctx.rate = 0;
    for (let i = 1; i <= n; i++) {
      await page.eval(`__recCam.step(${JSON.stringify(from)},${JSON.stringify(target)},${ease(i / n)})`);
      await frame();
    }
    ctx.rate = previous;
  }
  return m;
}

// In the page: the camera behind zoom(), follow() and unzoom(). The stage's wheel handler
// zooms about the pointer and its drag handler pans; both act at once on the app's manual
// camera, which is drawn on the next frame, so each step lands exactly. A step zooms about
// the middle of the picture above the caption band (the anchor) and pans the anchor along a
// straight line. tick() runs before every frame and plays a follow() path, if one is set.
const CAMERA = `window.__recCam ??= (() => {
  let L = null, path = null;
  const ready = import('/src/machine/layout.js').then(m => { L = m; });
  const $ = id => document.getElementById(id);
  const view = () => { const st = $('machine-stage'), vw = Math.max(1, st.clientWidth), vh = Math.max(1, st.clientHeight); return {vw, vh, band: vh > vw ? 170 : 120}; };
  const union = (a, b) => { if (!a) return b; if (!b) return a; const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return {x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y}; };
  const now = () => { const [x, y, w, h] = $('machine-svg').getAttribute('viewBox').split(/[\\s,]+/).map(Number), r = $('machine-svg').getBoundingClientRect(); return {cam: {x, y, w, h}, rect: {x: r.x, y: r.y, width: r.width, height: r.height}, ...view()}; };
  const plan = () => { const p = __machine.plan(); return {p, lay: L.layoutPlan(p)}; };
  const cameraAt = ({p, lay}, t) => { const {vw, vh, band} = view(); return L.cameraAt(p, lay, t, {width: vw, height: vh}, {inset: {bottom: band}}); };
  const auto = async (t = __machine.state().t) => { await ready; return cameraAt(plan(), t); };
  // a tower's level, in machine units: from one of its drawn bulbs (render.js marks each with
  // data-t and data-l), as point() does, or from the layout when the camera has culled them
  function point({tower, level = 0, dx = 0, dy = 0}) {
    const g = document.querySelector('#machine-svg .mb[data-t="' + tower + '"]');
    if (!g) {
      const P = plan(), s = L.scenesOf(P.p)[Math.round(__machine.state().t)], t = s?.towers[tower]; if (!t) throw Error('no tower ' + tower);
      const o = P.lay.placeOf(t.at);
      return {x: o.x + (P.p.base === 'e' && t.form !== 'light' ? L.UNITS.eSlots[0] : 0) + dx, y: o.y - L.UNITS.pitch * level + dy};
    }
    const t = /translate\\(([-\\d.]+)[ ,]+([-\\d.]+)\\)/.exec(g.getAttribute('transform'));
    const m = $('machine-svg').getScreenCTM().inverse().multiply(g.parentNode.getScreenCTM());
    return new DOMPoint(+t[1] + dx, +t[2] - 84 * (level - Number(g.dataset.l)) + dy).matrixTransform(m);
  }
  async function target(spec) {
    await ready;
    const {vw, vh, band} = view(), H = vh - band;
    if (spec.at != null) return cameraAt(plan(), spec.at);
    if (spec.tower) {
      const A = await auto(), p = point(spec), f = spec.factor, w = A.w / f, h = A.h / f;
      if (spec.centre) return {x: p.x - w / 2, y: p.y - h * H / 2 / vh, w, h};
      return {x: p.x - (p.x - A.x) / f, y: p.y - (p.y - A.y) / f, w, h};
    }
    const P = plan(), scenes = L.scenesOf(P.p), {nodes, scenes: [a, b], max = 1.6, min = 0, align = 'top', pad = 24} = spec;
    let box = null;
    for (const id of nodes) box = union(box, P.lay.nodeBox(id));
    for (let k = a; k <= b; k++) for (const [id, tower] of Object.entries(scenes[k].towers)) if (nodes.includes(L.parsePlace(tower.at).node)) box = union(box, P.lay.towerBox(scenes[k], id));
    const A = cameraAt(P, b), s = Math.max(min * vw / A.w, Math.min((vw - 2 * pad) / box.w, (H - 2 * pad) / box.h, max * vw / A.w));
    const tall = box.h + 2 * pad / s > H / s, cy = tall && align === 'top' ? box.y - pad / s + H / 2 / s : box.y + box.h / 2;
    return {x: box.x + box.w / 2 - vw / 2 / s, y: cy - H / 2 / s, w: vw / s, h: vh / s};
  }
  // One step of a move from camera a to camera b, e (0..1) of the way.
  function step(a, b, e) {
    const {cam, rect, vw, vh, band} = now(), fy = (vh - band) / 2 / vh, st = $('machine-stage');
    const anchor = c => ({x: c.x + c.w / 2, y: c.y + c.h * fy}), from = anchor(a), to = anchor(b), here = anchor(cam);
    const w = a.w * (b.w / a.w) ** e, want = {x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e};
    const x = rect.x + rect.width / 2, y = rect.y + rect.height * fy;
    const k = Math.log(w / cam.w);
    if (Math.abs(k) > 1e-9) st.dispatchEvent(new WheelEvent('wheel', {clientX: x, clientY: y, deltaY: k / .0015, cancelable: true}));
    // the zoom keeps the anchor in place; a drag (past the 6 px a tap may wander) pans it
    const scale = vw / cam.w, dx = -(want.x - here.x) * scale, dy = -(want.y - here.y) * scale;
    if (Math.hypot(dx, dy) < 1e-6) return;
    const pointer = (type, px, py) => st.dispatchEvent(new PointerEvent(type, {pointerId: 917, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: px, clientY: py}));
    pointer('pointerdown', x, y); pointer('pointermove', x + 7, y); pointer('pointermove', x + dx, y + dy); pointer('pointerup', x + dx, y + dy);
  }
  async function follow(spec, t0, t1) {
    await ready;
    path = {from: now().cam, to: spec === 'auto' ? null : await target(spec), plan: plan(), t0, t1};
  }
  function tick() {
    if (!path) return;
    const u = Math.min(1, Math.max(0, (__machine.state().t - path.t0) / (path.t1 - path.t0))), to = path.to ?? cameraAt(path.plan, path.t0 + u * (path.t1 - path.t0));
    step(path.from, to, 1 - (1 - u) ** 2);
    if (u < 1) return;
    if (!path.to) $('machine-centre').click();
    path = null;
  }
  return {now, auto, target, step, follow, tick, stop: () => { path = null; }};
})(), true`;
