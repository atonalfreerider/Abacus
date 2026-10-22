// Injected into the app before its modules run (as a string, via the DevTools protocol).
// 1. Virtual time: performance.now, requestAnimationFrame, setTimeout and CSS animations
//    advance only when the recorder calls __vt.advance(ms), so every frame is exact.
// 2. After load, __rec draws the recording overlay: touch indicators, captions (bottom or
//    top band), keycaps, title cards (with a row of bulbs for the machine's videos), chapter
//    chips and place-value labels, animated on video time.
export const virtualTime = `(() => {
  let now = 0, nextFrame = 1, nextTimer = 1;
  const frames = new Map(), timers = new Map(), started = new WeakMap();
  performance.now = () => now;
  window.requestAnimationFrame = cb => { frames.set(nextFrame, cb); return nextFrame++; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.setTimeout = (fn, ms = 0, ...args) => { timers.set(nextTimer, {at: now + Math.max(0, Number(ms) || 0), fn, args}); return nextTimer++; };
  window.clearTimeout = id => timers.delete(id);
  const run = fn => { try { fn(); } catch (error) { console.error(error); } };
  window.__vt = {
    get now() { return now; },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let due = null;
        for (const entry of timers) if (entry[1].at <= end && (!due || entry[1].at < due[1].at)) due = entry;
        if (!due) break;
        timers.delete(due[0]); now = Math.max(now, due[1].at); run(() => due[1].fn(...due[1].args));
      }
      now = end;
      const callbacks = [...frames.values()]; frames.clear();
      for (const cb of callbacks) run(() => cb(now));
      for (const a of document.getAnimations()) { if (!started.has(a)) { started.set(a, now); a.pause(); } a.currentTime = now - started.get(a); }
    },
  };
})();`;

export const overlay = `(() => {
  const css = \`
  #rec{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:hidden;pointer-events:none;color:#25241e;font-family:'Adobe Garamond Pro',Garamond,Georgia,serif}
  #transport,#feedback{visibility:hidden}
  #rec .finger{position:absolute;left:0;top:0;width:var(--finger);height:var(--finger);border-radius:50%;background:radial-gradient(circle at 42% 38%,#fffffff2 0 22%,#ffffffb8 55%,#ffffff70 100%);border:3px solid #25241ed0;box-shadow:0 8px 18px #0005;opacity:0}
  #rec .ripple{position:absolute;left:0;top:0;width:var(--finger);height:var(--finger);border-radius:50%;border:4px solid #3b6c78;opacity:0}
  #rec .caption{position:absolute;left:50%;bottom:var(--caption-bottom);transform:translateX(-50%);width:max-content;max-width:var(--caption-width);background:#25241ee8;color:#fbf6e8;font-size:var(--caption-size);line-height:1.28;padding:.32em .8em .38em;border-radius:.45em;text-align:center;opacity:0;box-shadow:0 4px 14px #0003}
  #rec .card{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:.4em;text-align:center;background:#f7f0df url('textures/swf-24.jpg') repeat;opacity:0;padding:0 8%}
  #rec .card .brand{font-size:var(--title-size);line-height:1;color:#4b4a40;letter-spacing:.02em}
  #rec .card .title{font-size:calc(var(--title-size)*.46);line-height:1.15;max-width:22em}
  #rec .card .subtitle{font-size:calc(var(--title-size)*.25);color:#6d6858;font-style:italic;max-width:30em}
  #rec .tray{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--title-size)*.05);padding:calc(var(--title-size)*.07);border:3px solid #25241e;border-radius:calc(var(--title-size)*.12);width:calc(var(--title-size)*1.3);aspect-ratio:1;margin-bottom:.3em;background:#fff6}
  #rec .tray i{border-radius:12%;background:url('textures/swf-25.jpg') center/300%;box-shadow:inset 0 0 0 2px #1e4f7a66}
  #rec .tray i.x{background-image:url('textures/swf-2.jpg')}
  #rec .tray i.red{background-image:url('textures/swf-23.jpg')}
  #rec .tray i.empty{background:#0000;box-shadow:inset 0 0 0 1px #25241e22}
  #rec .chip{position:absolute;left:50%;top:var(--chip-top);transform:translateX(-50%);background:#3b6c78;color:#fff;font-size:var(--chip-size);padding:.18em .75em .24em;border-radius:1em;opacity:0;white-space:nowrap}
  #rec .label{position:absolute;transform:translate(-50%,0);font-size:var(--label-size);color:#3b6c78;font-variant:small-caps;letter-spacing:.04em;white-space:nowrap;opacity:0}
  #rec .label::before{content:'';position:absolute;left:50%;top:-.35em;width:1.6em;margin-left:-.8em;border-top:2px solid #3b6c78}
  #rec .caption.top{bottom:auto;top:var(--caption-top,12px)}
  #rec .key{position:absolute;right:var(--key-right,36px);top:var(--key-top,120px);bottom:var(--key-bottom,auto);min-width:1.6em;padding:.2em .55em .28em;border:2px solid #25241e;border-bottom-width:5px;border-radius:.32em;background:#fbf6e8;color:#25241e;font:600 var(--key-size,30px)/1.1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em;text-align:center;box-shadow:0 6px 16px #0003;opacity:0;white-space:nowrap}
  #rec .card .kicker{font-size:calc(var(--title-size)*.2);letter-spacing:.22em;text-transform:uppercase;color:#6d6858;margin-top:-.2em}
  #rec .bulbset{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:.4em 1.6em;margin-bottom:.45em;max-width:100%}
  #rec .bulbgroup{display:flex;flex-direction:column;align-items:center;gap:.35em}
  #rec .bulbrow{display:flex;align-items:center;justify-content:center;gap:calc(var(--bs)*.3)}
  #rec .bulbrow .level{display:flex;gap:calc(var(--bs)*.06)}
  #rec .bulbrow .point{width:calc(var(--bs)*.16);height:calc(var(--bs)*.16);border-radius:50%;background:#25241e;align-self:flex-end;margin:0 calc(var(--bs)*-.08)}
  #rec .bulbrow .dust{width:calc(var(--bs)*.9);height:var(--bs);border-radius:50%;background:radial-gradient(closest-side,var(--dust) 0,transparent 100%);opacity:.7;display:grid;place-items:center;color:#6d6858;font-size:calc(var(--bs)*.5)}
  #rec .b{position:relative;width:var(--bs);height:var(--bs);border-radius:50%;flex:none;box-sizing:border-box}
  #rec .b.on{background:radial-gradient(circle,var(--core) 0 29%,color-mix(in srgb,var(--core) 45%,var(--body)) 42%,var(--body) 58%);border:max(2px,calc(var(--bs)*.04)) solid var(--glow);box-shadow:0 0 0 calc(var(--bs)*.11) color-mix(in srgb,var(--glow) 26%,transparent),0 0 0 calc(var(--bs)*.21) color-mix(in srgb,var(--glow) 14%,transparent)}
  #rec .b.off{background:var(--fill) var(--filament) center/62% no-repeat;border:max(2px,calc(var(--bs)*.03)) solid var(--stroke)}
  #rec .b::after{content:'';position:absolute;left:15%;top:13%;width:26%;height:15%;border-radius:50%;background:#fff;opacity:.75;transform:rotate(-35deg)}
  #rec .b.off::after{opacity:.35}
  #rec .b.red::before{content:'';position:absolute;left:31%;width:38%;top:45%;height:10%;border-radius:1em;background:var(--body)}
  #rec .bulbs-text{font-size:calc(var(--title-size)*.24);color:#4b4a40;letter-spacing:.06em;font-variant-numeric:lining-nums}
  #rec .bulbcard{display:contents}
  #rec .bulbcard .title,#rec .bulbcard .subtitle{text-wrap:balance}
  #rec .bulbs-label{font-size:calc(var(--title-size)*.2);color:#6d6858;font-variant:small-caps;letter-spacing:.08em}
  \`;
  const root = document.createElement('div'); root.id = 'rec'; root.setAttribute('popover', 'manual');
  root.innerHTML = '<style>' + css + '</style><div class="chip"></div><div class="caption"></div><div class="key"></div><div class="card"></div><div class="ripple"></div><div class="ripple"></div><div class="finger"></div>';
  document.body.append(root);
  const raise = () => { try { root.hidePopover(); } catch {} root.showPopover(); };
  raise();
  // A modal dialog enters the top layer above the overlay; lift the overlay back over it.
  const showModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () { showModal.call(this); raise(); };
  const $ = s => root.querySelector(s), finger = $('.finger'), ripples = [...root.querySelectorAll('.ripple')];
  const fades = new Map();
  let t = 0, touch = {x: 0, y: 0, visible: 0, pressed: 0}, rippleAt = [], labels = [], keyAt = null, below = [];
  // Bulb colours come from the app's own theme (whichever style is on), so title cards match
  // the stage; the sketchpad values stand in if the module cannot be loaded.
  let ink = {bulb: {blue: {body: '#2f7fc4', core: '#e2f3ff', glow: '#4aa3ff'}, red: {body: '#c8402f', core: '#ffe4dc', glow: '#ff6a4d'}, off: {fill: '#ebe5d2', stroke: '#7b7564', filament: '#a79f88'}}, machine: {dust: '#d99a1e'}};
  const theme = import('/src/mvc/theme.js').then(m => { if (m.ink?.bulb) ink = m.ink; }).catch(() => {});
  const SUFFIX = {binary: '₂', ternary: ' bal₃', e: 'ₑ'};
  // A row of bulbs for a digit string, most significant first. Binary and balanced ternary:
  // 1 blue, T red (with the bar that marks red bulbs), 0 dark. Base e: each level has two
  // sockets holding 0, 1 or 2 bulbs; '.' is the radix point and '…' the dust below the floor.
  function bulbRow({bits = '', base = 'binary', text, label}, size) {
    const b = ink.bulb, lit = colour => '<i class="b on ' + colour + '" style="--body:' + b[colour].body + ';--core:' + b[colour].core + ';--glow:' + b[colour].glow + '"></i>';
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='-14 -7 28 19'><path d='M-13 11v-9l4.6-8 4.2 8 4.2-8 4.2 8 4.2-8 4.6 8v9' fill='none' stroke='" + b.off.filament + "' stroke-width='2.4' stroke-linejoin='round'/></svg>";
    const dark = '<i class="b off" style="--fill:' + b.off.fill + ';--stroke:' + b.off.stroke + ';--filament:url(&quot;data:image/svg+xml,' + encodeURIComponent(svg) + '&quot;)"></i>';
    let html = '';
    for (const ch of [...bits]) {
      if (ch === '.') html += '<span class="point"></span>';
      else if (ch === '…') html += '<span class="dust" style="--dust:' + (ink.machine?.dust || '#d99a1e') + '">…</span>';
      else if (base === 'e') { const d = Number(ch); html += '<span class="level" style="--bs:calc(' + size + ' * .8)">' + Array.from({length: 2}, (_, k) => k < d ? lit('blue') : dark).join('') + '</span>'; }
      else html += ch === '1' ? lit('blue') : ch === 'T' ? lit('red') : dark;
    }
    // binary is sign-magnitude: red bulbs are the bits of a negative number (−101₂)
    const line = text ?? (!bits ? '' : base === 'binary' && bits.includes('T') ? '−' + bits.replace(/T/g, '1') + '₂' : bits + (SUFFIX[base] || ''));
    return '<div class="bulbgroup" style="--bs:' + size + '"><div class="bulbrow">' + html + '</div>' + (line ? '<div class="bulbs-text">' + line + '</div>' : '') + (label ? '<div class="bulbs-label">' + label + '</div>' : '') + '</div>';
  }
  // How wide a row is, in bulbs, so long rows shrink to fit the card.
  const rowWidth = ({bits = '', base}) => [...bits].reduce((w, ch) => w + (ch === '.' ? .2 : ch === '…' ? 1.2 : base === 'e' ? 1.95 : 1.3), 0);
  // The top caption band sits under whatever the page shows at the top (the machine's bar).
  function topBand() {
    let y = 12;
    for (const s of below) for (const el of document.querySelectorAll(s)) { const r = el.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(el).display !== 'none') y = Math.max(y, r.bottom + 10); }
    return y;
  }
  const approach = (current, target, dt, time = .3) => current + Math.sign(target - current) * Math.min(Math.abs(target - current), dt / time);
  function fade(el, on, time = .35) { fades.set(el, {target: on ? 1 : 0, time}); }
  function level(el) { return Number(el.style.opacity || 0); }
  window.__rec = {
    raise,
    config(vars) { for (const [k, v] of Object.entries(vars)) root.style.setProperty('--' + k, v); },
    touch(state) { Object.assign(touch, state); },
    ripple(x, y) { rippleAt.push({x, y, t}); rippleAt = rippleAt.slice(-2); },
    // at: 'top' puts the caption in the top band (build scenes, where the bottom shows controls).
    caption(text, at) {
      const el = $('.caption');
      if (text) { el.textContent = text; el.classList.toggle('top', at === 'top'); if (at === 'top') el.style.setProperty('--caption-top', topBand() + 'px'); }
      fade(el, !!text, .18);
    },
    // Selectors of page furniture that top captions must stay below.
    below(selectors) { below = [].concat(selectors || []); },
    // A keycap for a key press: it pops in, holds, then fades over 0.6 s.
    key(label) { const el = $('.key'); el.textContent = label; keyAt = t; },
    // Title and end cards with rows of bulbs (bits, most significant first, in the given base),
    // or several rows side by side ({rows: [{bits, base, text, label}]}).
    async bulbTitle({bits, base = 'binary', text, rows, brand = 'Abacus', kicker = 'Machine', title, subtitle} = {}, on = true, time = .5) {
      await theme;
      const list = rows || (bits ? [{bits, base, text}] : []);
      const room = 84 / Math.max(1, list.reduce((w, r) => w + rowWidth(r), 0) + (list.length - 1) * 2.4);
      const size = 'min(calc(var(--title-size) * .5), ' + room.toFixed(3) + 'vw)';
      const html = '<div class="bulbcard">' + (list.length ? '<div class="bulbset">' + list.map(r => bulbRow(r, size)).join('') + '</div>' : '')
        + '<div class="brand">' + brand + '</div>' + (kicker ? '<div class="kicker">' + kicker + '</div>' : '')
        + (title ? '<div class="title">' + title + '</div>' : '') + (subtitle ? '<div class="subtitle">' + subtitle + '</div>' : '') + '</div>';
      this.card(html, on, time);
    },
    chip(text) { const el = $('.chip'); if (text) el.textContent = text; fade(el, !!text); },
    card(html, on = true, time = .5) { const el = $('.card'); if (on) el.innerHTML = html; if (time) fade(el, on, time); else { fades.delete(el); el.style.opacity = on ? 1 : 0; } },
    // Place labels under each tray of a card: ones, tens, hundreds, ... right to left.
    labels(term, names) {
      for (const l of labels) fade(l, false); labels = [];
      if (!term) return;
      const node = document.querySelector('#equation-svg [data-term="' + CSS.escape(term) + '"]');
      if (!node) return;
      const m = node.getScreenCTM(), point = (x, y) => new DOMPoint(x, y).matrixTransform(m);
      names.forEach((name, i) => {
        const p = point(75 + i * 160, 172), el = document.createElement('div');
        el.className = 'label'; el.textContent = name; el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
        root.append(el); labels.push(el); fade(el, true);
      });
    },
    frame(dt) {
      t += dt;
      for (const [el, {target, time}] of fades) {
        const v = approach(level(el), target, dt, time); el.style.opacity = v;
        if (v === target) { fades.delete(el); if (!target && el.classList.contains('label')) el.remove(); }
      }
      if (keyAt !== null) {
        const k = t - keyAt, el = $('.key');
        el.style.opacity = k < .08 ? k / .08 : k < .6 ? 1 : Math.max(0, 1 - (k - .6) / .6);
        el.style.transform = k < .16 ? 'translateY(3px) scale(.96)' : 'none';
        if (k >= 1.2) keyAt = null;
      }
      const size = finger.offsetWidth, scale = touch.pressed ? .82 : 1 + .25 * (1 - touch.visible);
      finger.style.opacity = touch.visible * (touch.pressed ? .95 : .8);
      finger.style.transform = 'translate(' + (touch.x - size / 2) + 'px,' + (touch.y - size / 2) + 'px) scale(' + scale + ')';
      ripples.forEach((el, i) => {
        const r = rippleAt[i], k = r ? (t - r.t) / .55 : 1;
        el.style.opacity = k < 1 ? (1 - k) * .9 : 0;
        if (r) el.style.transform = 'translate(' + (r.x - size / 2) + 'px,' + (r.y - size / 2) + 'px) scale(' + (.6 + 1.6 * k) + ')';
      });
    },
  };
})();`;
