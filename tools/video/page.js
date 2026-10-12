// Injected into the app before its modules run (as a string, via the DevTools protocol).
// 1. Virtual time: performance.now, requestAnimationFrame, setTimeout and CSS animations
//    advance only when the recorder calls __vt.advance(ms), so every frame is exact.
// 2. After load, __rec draws the recording overlay: touch indicators, captions, title
//    cards, chapter chips and place-value labels, animated on video time.
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
  \`;
  const root = document.createElement('div'); root.id = 'rec'; root.setAttribute('popover', 'manual');
  root.innerHTML = '<style>' + css + '</style><div class="chip"></div><div class="caption"></div><div class="card"></div><div class="ripple"></div><div class="ripple"></div><div class="finger"></div>';
  document.body.append(root);
  const raise = () => { try { root.hidePopover(); } catch {} root.showPopover(); };
  raise();
  // A modal dialog enters the top layer above the overlay; lift the overlay back over it.
  const showModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () { showModal.call(this); raise(); };
  const $ = s => root.querySelector(s), finger = $('.finger'), ripples = [...root.querySelectorAll('.ripple')];
  const fades = new Map();
  let t = 0, touch = {x: 0, y: 0, visible: 0, pressed: 0}, rippleAt = [], labels = [];
  const approach = (current, target, dt, time = .3) => current + Math.sign(target - current) * Math.min(Math.abs(target - current), dt / time);
  function fade(el, on, time = .35) { fades.set(el, {target: on ? 1 : 0, time}); }
  function level(el) { return Number(el.style.opacity || 0); }
  window.__rec = {
    raise,
    config(vars) { for (const [k, v] of Object.entries(vars)) root.style.setProperty('--' + k, v); },
    touch(state) { Object.assign(touch, state); },
    ripple(x, y) { rippleAt.push({x, y, t}); rippleAt = rippleAt.slice(-2); },
    caption(text) { const el = $('.caption'); if (text) { el.textContent = text; } fade(el, !!text, .18); },
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
