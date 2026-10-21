// Numbers: one whole number taken apart. Its marble fingerprint (its prime components)
// fills the stage; pull it apart (drag right, the slider, Pull apart or U) and it rebuilds
// the number's whole volume from its primes, push it back and it packs into its shorthand.
// The panel names its kind and writes it in every base the cards know, as card trays.
import { Fingerprint } from './fingerprint.js';
import { describe, classify, className } from './primes.js';
import { ink, onStyle } from '../mvc/theme.js';
import { cardsSVG } from '../mvc/view.js';
import { baseText, bases, baseOrder } from '../mvc/bases.js';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const examples = [[360, '360 = 2³ · 3² · 5'], [91, '91 = 7 · 13'], [97, '97, a prime'], [49, '49 = 7², a prime squared'], [90, '90 = 9 · 10, pronic'], [625, '625 = 5⁴'], [1001, '1001 = 7 · 11 · 13'], [128, '128 = 2⁷'], [1024, '1024 = 2¹⁰'], [210, '210 = 2 · 3 · 5 · 7'], [243, '243 = 3⁵'], [999983, '999983, a big prime']];
export const MAX = 999999999999999;
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP_SECONDS = 1.1;

export class NumbersView extends EventTarget {
  constructor() {
    super();
    this.stage = $('numbers-stage'); this.visible = false; this.phase = 0; this.target = 0; this.spin = 0; this.digits = false; this.n = 0;
    for (const [n, label] of examples) { const o = document.createElement('option'); o.value = n; o.textContent = label; $('numbers-examples').append(o); }
    $('numbers-examples').onchange = e => { if (e.target.value) this.set(Number(e.target.value)); e.target.value = ''; };
    $('numbers-n').onchange = e => this.set(e.target.value);
    $('numbers-prev').onclick = () => this.set(this.n - 1);
    $('numbers-next').onclick = () => this.set(this.n + 1);
    $('numbers-unpack').onclick = () => this.toggle();
    $('numbers-phase').oninput = e => { this.phase = this.target = Number(e.target.value) * this.print.phases; this.draw(); };
    $('numbers-digits').onchange = e => { this.digits = e.target.checked; this.draw(); };
    $('numbers-to-cards').onclick = () => this.dispatchEvent(new CustomEvent('cards', { detail: { n: this.n } }));
    // Drag right to pull the fingerprint apart, left to pack it: the stage's width is the whole unpacking.
    this.stage.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, phase: this.phase }; this.stage.setPointerCapture(e.pointerId); });
    this.stage.addEventListener('pointermove', e => { if (!this.drag) return; const w = this.stage.clientWidth || 600; this.phase = this.target = Math.max(0, Math.min(this.print.phases, this.drag.phase + (e.clientX - this.drag.x) / w * this.print.phases * 1.4)); this.draw(); });
    const end = () => { this.drag = null; };
    this.stage.addEventListener('pointerup', end); this.stage.addEventListener('pointercancel', end);
    this.stage.addEventListener('keydown', e => this.key(e));
    onStyle(() => { this.panel(); this.draw(); });
    new ResizeObserver(() => { if (this.visible) this.layout(); }).observe(this.stage);
    const loop = now => { requestAnimationFrame(loop); if (this.visible) this.frame(now); };
    requestAnimationFrame(loop);
  }
  show(n) { this.visible = true; if (n !== undefined) this.set(n); else if (!this.n) this.set(360); else this.layout(); this.stage.focus({ preventScroll: true }); }
  hide() { this.visible = false; }
  key(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); this.set(this.n + (e.key === 'ArrowLeft' ? -1 : 1)); }
    else if (e.key === 'u' || e.key === 'U') { e.preventDefault(); this.toggle(); }
    else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); $('numbers-digits').click(); }
  }
  // Pull apart, or pack back: the phase glides to its end.
  toggle() { const all = this.print.phases; this.target = this.phase > all / 2 ? 0 : all; this.last = null; this.label(); }
  label() { const open = this.target > this.print.phases / 2; $('numbers-unpack').textContent = open ? 'Pack' : 'Pull apart'; $('numbers-unpack').disabled = !this.print.factors.length; }
  set(value) {
    let n = Math.round(Math.abs(Number(String(value).replace(/[^\d.e+-]/gi, ''))));
    if (!Number.isFinite(n)) n = this.n || 360;
    n = Math.max(1, Math.min(MAX, n));
    this.n = n; $('numbers-n').value = String(n);
    this.layout(true); this.panel();
    this.dispatchEvent(new CustomEvent('number', { detail: { n } }));
  }
  // The fingerprint beside its volume on a wide stage, the volume above it on a tall one.
  layout(fresh = false) {
    const beside = this.stage.clientWidth > this.stage.clientHeight * 1.25;
    if (fresh || !this.print || this.print.beside !== beside) {
      const keep = this.print && this.print.n === BigInt(this.n) ? this.phase / this.print.phases : 0;
      this.print = new Fingerprint(this.n, { beside }); this.print.beside = beside;
      this.phase = this.target = keep * this.print.phases;
      // one frame for every phase, so the picture never jumps while it unpacks
      // the shorthand's frame, and one frame for every phase of the unpacking: the view eases
      // from the first to the second as the fingerprint opens, and never jumps
      const frame = samples => { let lo = { x: 1e9, y: 1e9 }, hi = { x: -1e9, y: -1e9 }; for (const ph of samples) { const b = this.print.render(ph, { palette: ink.marble, digits: true }).bounds; lo = { x: Math.min(lo.x, b.x), y: Math.min(lo.y, b.y) }; hi = { x: Math.max(hi.x, b.x + b.width), y: Math.max(hi.y, b.y + b.height) }; } const pad = 1.2; return { x: lo.x - pad, y: lo.y - pad, w: hi.x - lo.x + 2 * pad, h: hi.y - lo.y + 2 * pad }; };
      const samples = [0, .5, 1]; for (let lv = 0; lv <= this.print.factors.length; lv += .5) samples.push(1 + lv);
      this.box0 = frame([0]); this.boxAll = frame(samples);
      this.label();
    }
    this.draw();
  }
  frame(now) {
    const dt = Math.min(.05, (now - (this.last ?? now)) / 1000); this.last = now;
    let changed = false;
    if (!still()) { this.spin = (this.spin + 14 * dt) % 360; changed = true; }
    if (Math.abs(this.phase - this.target) > 1e-4 && !this.drag) { const step = dt / STEP_SECONDS; this.phase = this.phase < this.target ? Math.min(this.target, this.phase + step) : Math.max(this.target, this.phase - step); changed = true; }
    if (changed) this.draw();
  }
  draw() {
    if (!this.print || !this.visible) return;
    const { body } = this.print.render(this.phase, { spin: this.spin, digits: this.digits, palette: ink.marble });
    const u = Math.min(1, this.phase / 1.4), k = u * u * (3 - 2 * u), b = Object.fromEntries(['x', 'y', 'w', 'h'].map(key => [key, Math.round((this.box0[key] + (this.boxAll[key] - this.box0[key]) * k) * 1000) / 1000]));
    this.stage.innerHTML = `<svg class="fingerprint numbers-print" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(describe(this.n))}">${body}</svg>`;
    $('numbers-phase').value = String(this.print.phases ? this.phase / this.print.phases : 0);
  }
  // The panel: what the number is made of, and the number in every base, as cards.
  panel() {
    const n = this.n, kind = classify(n), value = { n, d: 1 };
    const rows = baseOrder.map(base => {
      const text = base === 'decimal' ? n.toLocaleString('en-US') : baseText(value, base, { subscript: true });
      // very long rows (a big number in base 2) are written, not drawn
      const cards = String(text).length <= 40 ? cardsSVG(value, base, { prefix: `nb-${base}-` }) : '';
      return `<div class="base-row" data-base="${base}"><div class="base-head"><span>${esc(bases[base].name)}</span><output>${esc(text)}</output></div>${cards}</div>`;
    }).join('');
    $('numbers-panel').innerHTML = `<h2>Prime components</h2><p class="numbers-kind"><i class="kind-${kind}" style="background:${ink.marble[kind]}"></i>${esc(describe(n))}</p>
<p class="numbers-legend">${n < 2 ? 'One has no prime components: it is the unit every number is built from.' : `The badge on the left is ${esc(n)} in its colour (${esc(className[kind])}). Each gold container holds a prime's worth of marbles; ${this.print.groups.some(g => g.k > 1) ? 'count a container’s rings, its own and the tilted ones, for how many times its prime is multiplied in.' : 'each prime is multiplied in once.'} ${this.print.volumeTooBig ? 'This number is too big to pull apart into marbles.' : 'Pull it apart to build all ' + esc(n) + ' marbles from its primes.'}`}</p>
<h2>In each base</h2>${rows}`;
  }
}
