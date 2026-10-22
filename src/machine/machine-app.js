// Machine: PRIME's function machine rebuilt in LED bulbs (docs/machine-design.md). Input
// pill → IO triangle → blocks hung on wires → Output pill; a number is a tower of bulbs.
// This module is the mode around the pure parts: it builds trees (palette, sockets, the
// expression field), plans them (plan.js), keeps time (clock.js), draws each frame
// (render.js over layout.js) into one persistent SVG, and owns the keys, the camera
// override, the outline and Steps list, the live region, haptics, the automation hook and
// recording mode. app.js loads it on first use; base e (e-base.js) loads on first use too.
import { ink } from '../mvc/theme.js';
import { haptic } from '../haptics.js';
import { BeatClock, SPEEDS, schedule, enterAction } from './clock.js';
import { planMachine } from './plan.js';
import { ARITY, palette, defaultMachine, attach, detach, openSockets, parseInput, parseExpression, sentence } from './tree.js';
import { snapshotAt } from './scene.js';
import { layoutPlan, cameraAt, foldWeight, moveCamera, foldCamera } from './layout.js';
import { renderMachine, machineDefs, blockGlyphSVG } from './render.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const media = q => typeof matchMedia === 'function' && matchMedia(q).matches;
const touchFirst = () => media('(pointer: coarse)');
const windowSize = () => `${innerWidth}×${innerHeight}`;
export const BASES = ['binary', 'ternary', 'e'];
const BASE_SHORT = { binary: '2', ternary: '±3', e: 'e' }, BASE_NAME = { binary: 'binary', ternary: 'balanced ternary', e: 'base e' };
// Palette names (PRIME's FunctBar spelled them out) and what the outline calls each block.
export const OPS = {
  add: ['ADD', '+'], sub: ['SUB', '−'], mul: ['MULT', '×'], div: ['DIV', '÷'], mod: ['MOD', 'mod'], cmp: ['COMP', 'compare'],
  shl: ['SHL', 'shift left'], shr: ['SHR', 'shift right'], and: ['AND', 'AND'], or: ['OR', 'OR'], xor: ['XOR', 'XOR'], not: ['NOT', 'NOT'],
  min: ['MIN', 'MIN'], max: ['MAX', 'MAX'], sum: ['SUM', 'SUM'], cons: ['CONS', 'CONS'], neg: ['NEG', 'NEG'],
  mule: ['×eᵏ', '× eᵏ'], measure: ['MEASURE', 'measure'], ln: ['LN', 'ln'],
};
// Base e greys out what it cannot do, with the reason (design 3.10).
const E_MISSING = { div: 'A quotient of e-numerals is usually not an e-numeral.', mod: 'A quotient of e-numerals is usually not an e-numeral.',
  shl: 'Shift by a count needs whole-number levels: use ×eᵏ.', shr: 'Shift by a count needs whole-number levels: use ×eᵏ.',
  and: 'Logic needs whole-number levels; base e has none.', or: 'Logic needs whole-number levels; base e has none.',
  xor: 'Logic needs whole-number levels; base e has none.', not: 'Logic needs whole-number levels; base e has none.' };
const EMPTY = 'Hang a block under the triangle first: drag one from the palette, or tap the triangle\'s socket and then a block';
const TOO_BIG = 'Too big to animate step by step; here is the exact answer.';
// A tooBig with no answer (a value past what even the exact pre-check works out) says why in
// its own message instead of promising an answer that Output does not show; one with an
// answer says whether it was too big or (past base e's rail) too small to animate.
const refusalText = r => r.reason === 'tooBig' ? (r.result ? r.message || TOO_BIG : r.message || 'Too big to animate step by step.') : r.message;
const SAFE = 9007199254740991n, MAX_BLOCKS = 24, SOFT_BEATS = 400, LEVEL_BEATS = 1000, DRAG_RADIUS = 250, MIN_SCALE = .05, MAX_SCALE = 2.4, MIN_FONT = 10;
const AUTO_KEY = 'abacus-machine-auto', REDUCED_KEY = 'abacus-machine-reduced', REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
// When Steps and Parts are a sheet: exactly style.css's phone portrait and phone landscape
// queries (elsewhere the side panel is always on screen).
const SHEET_QUERY = '(max-width: 699px), (max-height: 520px) and (min-aspect-ratio: 3/2)';
const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
const arity = op => ARITY?.[op] ?? 2;
const socketsOf = op => arity(op) === 1 ? ['C'] : ['L', 'R'];
const SIDE = { L: 'left', R: 'right', C: 'centre' };
const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
// Layout boxes and cameras are {x, y, w, h} in machine units; accept width/height too.
const box = b => b && { x: b.x, y: b.y, w: b.w ?? b.width, h: b.h ?? b.height };
const boxText = b => `${+b.x.toFixed(3)} ${+b.y.toFixed(3)} ${+b.w.toFixed(3)} ${+b.h.toFixed(3)}`;
const parseBox = v => typeof v === 'string' ? (([x, y, w, h]) => ({ x, y, w, h }))(v.trim().split(/[\s,]+/).map(Number)) : box(v);
// render.js returns the body of a frame; tolerate a full <svg> element as well.
const inner = svg => /^\s*<svg[\s>]/.test(svg) ? svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '') : svg;
// Frames within a beat keep almost every element and change attributes, so a new frame
// is patched into the old one: replacing 1500 <use> bulbs costs about five times as much
// as parsing the frame and setting the attributes that changed.
const parser = typeof document !== 'undefined' ? document.createElement('template') : null;
export function patch(old, next) {
  const a = old.childNodes, b = [...next.childNodes];
  for (let i = 0; i < b.length; i++) {
    const o = a[i], n = b[i];
    if (!o) { old.append(...b.slice(i)); break; }
    if (o.nodeName !== n.nodeName) { old.replaceChild(n, o); continue; }
    if (n.nodeType === 3) { if (o.data !== n.data) o.data = n.data; continue; }
    if (n.nodeType !== 1) continue;
    setAttributes(o, n);
    if (n.firstChild || o.firstChild) patch(o, n);
  }
  while (a.length > b.length) old.lastChild.remove();
}
const setAttributes = (o, n) => {
  for (const { name, value } of n.attributes) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
  if (o.attributes.length !== n.attributes.length) for (const { name } of [...o.attributes]) if (!n.hasAttribute(name)) o.removeAttribute(name);
};
// Most frames change only the attributes of the few bulbs in motion (9 of 512 elements at
// the widest ADD of (2³² − 1)²). So a frame is first compared with the last one, tag by tag:
// when the only differences are start tags that kept their name and shape, just those tags
// are parsed and their attributes set, and the elements are found by position. Any other
// change (text, structure, or markup the tokens do not cover) parses and patches in full.
const TOKENS = /<\/?[a-zA-Z][^>]*>|[^<]+/g, tagName = tag => /^<\/?([a-zA-Z][\w:-]*)/.exec(tag)[1];
export class FramePatcher {
  constructor(root) { this.root = root; this.tokens = null; this.els = null; }
  apply(markup) {
    const tokens = markup.match(TOKENS) ?? [];
    if (!this.quick(tokens, markup.length)) {
      parser.innerHTML = `<svg>${markup}</svg>`; patch(this.root, parser.content.firstChild);
      this.els = [...this.root.querySelectorAll('*')];
    }
    this.tokens = tokens;
  }
  quick(tokens, length) {
    const prev = this.tokens; if (!prev || prev.length !== tokens.length) return false;
    const at = [], tags = []; let size = 0, el = -1;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i], p = prev[i], start = t[0] === '<' && t[1] !== '/';
      size += t.length; if (start) el++;
      if (t === p) continue;
      if (!start || p[0] !== '<' || p[1] === '/' || tagName(t) !== tagName(p) || t.endsWith('/>') !== p.endsWith('/>') || at.length >= 256) return false;
      at.push(el); tags.push(t.endsWith('/>') ? t : `${t}</${tagName(t)}>`);
    }
    if (size !== length) return false;
    if (!at.length) return true;
    parser.innerHTML = `<svg>${tags.join('')}</svg>`;
    const fresh = parser.content.firstChild.children;
    if (fresh.length !== at.length || at.some((k, j) => this.els[k]?.localName !== fresh[j].localName)) return false;
    at.forEach((k, j) => setAttributes(this.els[k], fresh[j]));
    return true;
  }
}
// A plan with no beats draws a machine that cannot run yet: the tree hangs under IO with
// its sockets open, so it can still be built on.
export const displayPlan = (tree, base, pace) => ({ v: 1, base, pace, tree, inputs: [], start: { nodes: { ...tree }, towers: {}, bulbs: {} }, beats: [],
  result: { values: [], text: '' }, stats: { beats: 0, nodes: Object.keys(tree).length, maxLevels: 0, maxBulbs: 0 }, display: true });
// The node hanging in a socket ('io' or `${id}.L|R|C`), if any.
export function occupant(tree, socket) {
  const [parent, side] = socket === 'io' ? ['io', 'C'] : socket.split('.');
  return Object.keys(tree).find(id => tree[id].parent === parent && (parent === 'io' || tree[id].socket === side)) ?? null;
}
// Dropping a block on an occupied socket pushes the block already there into the new
// block's left (or only) socket. Ids are never reused within a tree.
export function insertAbove(tree, id, op) {
  const fresh = `n${Math.max(0, ...Object.keys(tree).map(k => Number(k.slice(1)) || 0)) + 1}`, old = tree[id];
  return { tree: ordered({ ...tree, [fresh]: { op, parent: old.parent, socket: old.socket }, [id]: { ...old, parent: fresh, socket: socketsOf(op)[0] } }), node: fresh };
}
// Depth-first, left first: parents before children, whatever order edits left them in.
export function ordered(tree) {
  const out = {}, visit = parent => { for (const side of ['L', 'R', 'C']) for (const id of Object.keys(tree)) if (tree[id].parent === parent && (parent === 'io' || tree[id].socket === side) && !(id in out)) { out[id] = tree[id]; visit(id); } };
  visit('io'); return out;
}
// URL-style parameters → a load() preset (design 4.1, 6.7): machine is an op id, an
// expression or 'empty'; mbase is the machine's base (?base= belongs to the equation space).
// The automation hook takes the same names, so B's videos can say {mbase: 'e', …}, and
// also load()'s own (base, op, expression, tree).
const URL_NAMES = { mbase: 'base', input: 'input', sp: 'sp', pace: 'pace', auto: 'auto' };
export function presetOf(params = {}, { names = { ...URL_NAMES, base: 'base', op: 'op', expression: 'expression', tree: 'tree' } } = {}) {
  const p = {}, m = params.machine;
  if (m === 'empty') p.tree = {}; else if (m && OPS[m]) p.op = m; else if (m) p.expression = String(m);
  for (const [key, name] of Object.entries(names)) if (params[key] != null && !(name in p)) p[name] = params[key];
  return p;
}
// ?machine… from location.search. A '+' stays a plus: the URL carries expressions such as
// (5+3)*7 and base-e sums such as e^2+2, which URLSearchParams would read as spaces. (Inputs
// never need a space: 16,7 separates them.)
export function presetFromQuery(query) {
  if (query instanceof URLSearchParams) return presetOf(Object.fromEntries(query), { names: URL_NAMES });
  const decode = s => { try { return decodeURIComponent(s); } catch { return s; } }, raw = {};
  for (const part of String(query ?? '').replace(/^\?/, '').split('&')) {
    if (!part) continue;
    const k = part.indexOf('='), key = decode(k < 0 ? part : part.slice(0, k));
    if (!(key in raw)) raw[key] = k < 0 ? '' : decode(part.slice(k + 1));
  }
  return presetOf(raw, { names: URL_NAMES });
}

export class MachineView extends EventTarget {
  constructor() {
    super();
    this.mode = $('machine-mode'); this.stage = $('machine-stage'); this.$input = $('machine-input'); this.$expr = $('machine-expr');
    const q = new URLSearchParams(location.search);
    // Reduced motion: the system setting, or the option (#machine-reduced), remembered once chosen.
    let chosen = null; try { chosen = localStorage.getItem(REDUCED_KEY); } catch {}
    this.recording = q.has('recording'); this.reducedChosen = chosen === '1' || chosen === '0'; this.reduced = this.reducedChosen ? chosen === '1' : media(REDUCED_QUERY);
    this.base = 'binary'; this.pace = 'together'; this.tree = defaultMachine(); this.planText = this.$input.value = '[16,7]'; this.inputs = ['16', '7'];
    this.sp = this.reduced ? 1.5 : 1; this.readAlong = this.reduced; this.digits = false; this.selected = null; this.manual = null; this.cam = null;
    // A long run the user chose to play at 4× plays at sp / 4; the chosen speed itself is kept.
    this.boost = 1;
    this.auto = true; try { this.auto = localStorage.getItem(AUTO_KEY) !== '0'; } catch {}
    this.stepMode = !this.auto; this.visible = false; this.dirty = true; this.lastT = -1; this.lastDone = 0; this.lastStarted = -1; this.lastBoundary = -1;
    this.stage.insertAdjacentHTML('afterbegin', `<svg id="machine-svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet" viewBox="-400 -200 800 600"><defs class="m-defs"></defs><g class="m-scene"></g><g class="m-hits"></g></svg>`);
    this.svg = $('machine-svg'); this.$defs = this.svg.querySelector('.m-defs'); this.$scene = this.svg.querySelector('.m-scene'); this.frames = new FramePatcher(this.$scene); this.$hits = this.svg.querySelector('.m-hits');
    this.wire();
    this.restyle();
    this.plan();
    new ResizeObserver(() => { this.dirty = true; }).observe(this.stage);
    const loop = now => { requestAnimationFrame(loop); if (this.visible) { try { this.frame(now); } catch (error) { console.error(error); this.status(error.message); this.clock.stop(); } } };
    requestAnimationFrame(loop);
    if (q.has('automation')) this.hook();
    if (this.recording) { document.body.classList.add('machine-recording'); this.chrome('run'); }
  }

  // ---------- public API (design 6.6) ----------
  async show(preset) {
    this.visible = true; this.dirty = true;
    if (preset && Object.keys(preset).length) await this.load(preset);
    // A fine pointer (or none: a keyboard) types straight away; on touch the stage takes
    // focus so no soft keyboard rises.
    if (!this.recording && !touchFirst()) { this.$input.focus({ preventScroll: true }); this.$input.select(); }
    else this.stage.focus({ preventScroll: true });
    this.sync(this.clock.t(performance.now()), true);
  }
  // Leaving closes the Steps/Parts sheet too, so the mode never reopens under it.
  hide() { this.visible = false; this.hidePeek(); this.endDrag(); this.closeSheet(); const now = performance.now(); if (this.clock.playing) this.clock.pause(now); this.sync(this.clock.t(now), true); }
  // Android's back closes an open sheet before it leaves the mode, as Esc does: true if it did.
  closeSheet() { if (!$('machine-side').classList.contains('open')) return false; this.sheet(false); return true; }
  // {tree?|op?|expression?, base, input, sp, pace, auto}: resolves once the machine is planned.
  async load(p = {}) {
    if (p.base && p.base !== this.base) { const r = await this.setBase(p.base, { force: !!(p.tree || p.op || p.expression), plan: false }); if (!r.ok) return r; }
    if (p.sp != null && Number.isFinite(Number(p.sp))) this.setSpeed(Number(p.sp));
    if (p.pace === 'together' || p.pace === 'level') { this.pace = p.pace; $('machine-pace').value = p.pace; }
    if (p.auto != null) this.setAuto(p.auto === true || p.auto === 1 || p.auto === '1' || p.auto === 'true', { remember: false });
    let text = p.input != null ? String(p.input) : null, message = null;
    if (p.tree) this.tree = ordered(p.tree);
    else if (p.op) this.tree = attach({}, 'io', p.op).tree;
    else if (p.expression) {
      const parsed = parseExpression(String(p.expression), this.base);
      if (parsed.ok) { this.tree = ordered(parsed.tree); this.$expr.value = String(p.expression); text ??= `[${parsed.inputs.join(',')}]`; }
      else message = parsed.error;
    }
    if (text != null) { text = text.trim(); if (!/^\[.*\]$/.test(text)) text = `[${text}]`; this.$input.value = text; }
    text = this.$input.value;
    const parsed = parseInput(text, this.base);
    this.inputs = parsed.ok ? parsed.values : []; this.planText = text; this.selected = null;
    this.plan();
    message ??= parsed.ok ? null : parsed.error;
    if (message) this.status(message, 'refuse');
    if (this.visible) this.draw(this.clock.t(performance.now()));
    return { ok: !message && !this.refusal, message: message ?? this.refusal?.message };
  }
  // The Enter rule (design 4.2).
  enter({ step = false } = {}) {
    this.hidePeek(); this.ask(false);
    const now = performance.now(), text = this.$input.value.trim();
    if (enterAction(this.clock, { changed: text !== this.planText.trim() || !!this.refusal }) === 'step') {
      if (step || !this.auto) this.stepMode = true;
      this.clock.step(now); this.manual = null; this.sync(this.clock.t(now)); return { ok: true };
    }
    return this.start(text, now, { step });
  }
  step() { return this.enter({ step: true }); }
  back() { this.clock.back(); this.rewound(); }
  // A seek into the plan counts as a run under way: Enter then steps on from there.
  seek(t) { this.clock.seek(Number(t)); if (this.clock.pos > 0) this.clock.started = true; this.rewound(); }
  setAuto(on, { remember = true } = {}) {
    this.auto = !!on; this.clock?.setAuto(this.auto, performance.now()); if (!this.auto) this.stepMode = true;
    if (remember) try { localStorage.setItem(AUTO_KEY, this.auto ? '1' : '0'); } catch {}
    this.hud();
  }
  setSpeed(sp) {
    this.sp = SPEEDS.reduce((best, s) => Math.abs(s - sp) < Math.abs(best - sp) ? s : best, SPEEDS[0]);
    this.clock?.setSpeed(this.sp / this.boost, performance.now()); this.hud();
  }
  // Reduced motion (design 4.9): beats crossfade, carries and falls become ghost arrows and
  // the camera cuts; its defaults are 1.5 s beats and Read along on. The speed and Read
  // along follow the switch only while they still hold the other setting's defaults.
  setReduced(on, { remember = false } = {}) {
    on = !!on;
    if (remember) { this.reducedChosen = true; try { localStorage.setItem(REDUCED_KEY, on ? '1' : '0'); } catch {} }
    $('machine-reduced').checked = on;
    if (on === this.reduced) return;
    this.reduced = on; this.dirty = true; this.mode.classList.toggle('reduced', on);
    if (this.sp === (on ? 1 : 1.5)) this.setSpeed(on ? 1.5 : 1);
    if (this.readAlong === !on) { this.readAlong = on; $('machine-readalong').checked = on; this.clock.setReadAlong(on, performance.now()); }
  }
  async setBase(base, { force = false, plan = true } = {}) {
    if (!BASES.includes(base)) return { ok: false, message: `Unknown base ${base}` };
    if (base === this.base) return { ok: true };
    if (base === 'e') try { await import('./e-base.js'); } catch (error) { console.error(error); return this.refuse('Base e is not available in this build.'); }
    const missing = force ? [] : Object.values(this.tree).filter(n => !palette(base).includes(n.op));
    if (missing.length) return this.refuse(`${BASE_NAME[base][0].toUpperCase() + BASE_NAME[base].slice(1)} has no ${OPS[missing[0].op]?.[0] ?? missing[0].op} block: take it off first.`);
    this.base = base; this.selected = null;
    const parsed = parseInput(this.planText, base); this.inputs = parsed.ok ? parsed.values : [];
    if (plan) this.plan();
    this.buildPalette(); this.hud();
    return { ok: true };
  }
  setPace(pace) { if (pace !== 'together' && pace !== 'level' || pace === this.pace) return; this.pace = pace; $('machine-pace').value = pace; this.plan(); }
  restyle() {
    this.$defs.innerHTML = machineDefs(ink, 'm-');
    this.buildPalette(); this.dirty = true;
  }
  get state() {
    const c = this.clock, t = c.t(performance.now());
    return { base: this.base, beat: c.beat, beats: c.n, t, playing: c.playing, auto: this.auto, sp: this.sp, pace: this.pace,
      caption: $('machine-caption').textContent, sentence: $('machine-sentence').textContent, output: this.outputText(t), error: this.refusal?.message ?? null };
  }

  // ---------- planning ----------
  // Re-plan the current tree, base, pace and committed inputs, and rewind to beat 0.
  plan() {
    this.refusal = null; this.highlight = null; this.answer = null; this.longOK = false; this.boost = 1;
    const k = openSockets(this.tree).length;
    let r;
    if (!Object.keys(this.tree).length) r = { ok: false, reason: 'empty', message: EMPTY };
    else if (this.inputs.length !== k) r = { ok: false, reason: 'arity', message: `This machine takes ${plural(k, 'number')}` };
    else {
      const ask = pace => { try { return planMachine({ tree: this.tree, inputs: this.inputs, base: this.base, pace }); } catch (error) { console.error(error); return { ok: false, reason: 'input', message: error.message }; } };
      r = ask(this.pace);
      // Level pace that would run too long falls back to carries together (design 6.10), and
      // so does one past LEVEL_BEATS: (2³² − 1)² is 1649 beats a level at a time, which froze
      // the page for over a second to lay out and held 60 MB of scenes, for a run that takes
      // minutes even at 4× (161 beats together). Below it the soft limit still asks at Enter.
      if (this.pace === 'level' && (!r.ok && r.reason === 'tooBig' || r.ok && r.plan.beats.length > LEVEL_BEATS)) { const again = ask('together'); if (again.ok) r = again; }
      if (r.ok && r.plan.pace !== this.pace) r.note = 'Carries play together: one level at a time would be too long for this run.';
    }
    if (r.ok) { this.answer = r.plan.result; this.use(r.plan); }
    else {
      // the refusal, its highlight and a tooBig's answer are known before use() draws Output
      // and the outline (Output was left empty after a load, an expression or an Enter)
      this.refusal = r;
      if (r.reason === 'zeroDivision' || r.reason === 'domain') this.highlight = r.node ?? null;
      if (r.reason === 'tooBig' && r.result) this.answer = r.result;
      this.use(displayPlan(this.tree, this.base, this.pace));
    }
    this.status(r.ok ? r.note ?? '' : ['zeroDivision', 'domain', 'tooBig'].includes(r.reason) ? refusalText(r) : '', r.ok ? '' : 'refuse');
    if (this.highlight) haptic('thud');
    this.cards();
  }
  use(plan) {
    this.planned = plan; this.planId = (this.planId ?? 0) + 1; this.layout = layoutPlan(plan);
    this.clock = new BeatClock(plan, { sp: this.sp / this.boost, auto: this.auto, readAlong: this.readAlong });
    this.manual = null; this.steps(); this.rewound(); this.hud();
  }
  rewound() { const t = this.clock.t(performance.now()); this.lastDone = Math.floor(t + 1e-9); this.lastStarted = -1; this.lastBoundary = -1; this.dirty = true; this.hidePeek(); this.sync(t, true); }
  start(text, now, { step = false } = {}) {
    const parsed = parseInput(text, this.base);
    if (!parsed.ok) return this.refuse(parsed.error);
    if (!sameList(parsed.values, this.inputs) || this.refusal) { this.inputs = parsed.values; this.planText = text; this.plan(); }
    else this.planText = text;
    if (this.refusal) return this.refuse(refusalText(this.refusal), this.refusal);
    if (this.planned.beats.length > SOFT_BEATS && !this.longOK) { this.ask(true); return { ok: false, message: 'long' }; }
    this.stepMode = step || !this.auto; this.manual = null;
    this.clock.setSpeed(this.sp / this.boost, now); this.clock.start(now); this.rewound(); return { ok: true };
  }
  // #machine-status is role=status (6.7), a polite live region of its own: what it shows is
  // announced from there, never written to #machine-live as well (4.9: nothing twice).
  refuse(message, r = {}) {
    this.status(message, 'refuse');
    const pill = this.$input; pill.classList.remove('shake'); void pill.offsetWidth; pill.classList.add('shake');
    this.dirty = true; this.hitKey = null; return { ok: false, message, reason: r.reason, node: r.node };
  }
  // Soft limit: a long run asks first (design 6.10).
  ask(on) {
    const box = $('machine-ask'); box.hidden = !on; if (!on) return;
    $('machine-ask-text').textContent = `Long run (${this.planned.beats.length} beats): play at 4× or show the answer`;
  }
  // The four Enter refusals and the domain-error highlight leave Output as [—].
  outputText(t) {
    if (this.refusal) return this.refusal.reason === 'tooBig' && this.answer ? this.answer.text : this.refusal.reason === 'zeroDivision' || this.refusal.reason === 'domain' ? '[—]' : '';
    return this.clock.n && t >= this.clock.n ? this.answer?.text ?? '' : '';
  }

  // ---------- building ----------
  // Tap a socket (or Tab to it in Parts), then tap a block; or drag a block onto a socket.
  attachAt(target, op) {
    if (!palette(this.base).includes(op)) return this.refuse(E_MISSING[op] ?? `${BASE_NAME[this.base]} has no ${OPS[op]?.[0] ?? op} block`);
    if (Object.keys(this.tree).length >= MAX_BLOCKS) return this.refuse(`A machine holds up to ${MAX_BLOCKS} blocks`);
    const socket = this.tree[target] ? this.socketOf(target) : target, held = occupant(this.tree, socket);
    let tree, node;
    try { ({ tree, node } = held ? insertAbove(this.tree, held, op) : attach(this.tree, socket, op)); }
    catch (error) { return this.refuse(error.message); }
    this.tree = ordered(tree);
    const open = openSockets(this.tree).filter(s => s.startsWith(node + '.'));
    this.selected = open[0] ?? null;
    this.edited(`${OPS[op][1]} block hung ${socket === 'io' ? 'under the triangle' : `in the ${SIDE[socket.split('.')[1]]} socket`}.`);
    return { ok: true, node };
  }
  // Backspace on a selected block takes it, and everything hanging from it, off.
  remove(id) {
    const n = this.tree[id]; if (!n) return;
    const socket = this.socketOf(id);
    this.tree = ordered(detach(this.tree, id)); this.selected = socket;
    this.edited(`${OPS[n.op]?.[1] ?? n.op} block taken off.`);
  }
  socketOf(id) { const n = this.tree[id]; return !n ? null : n.parent === 'io' ? 'io' : `${n.parent}.${n.socket}`; }
  // Any edit re-plans at once and rewinds to beat 0, with every block back in place.
  edited(message) {
    this.plan();
    if (this.refusal?.reason === 'arity' || this.refusal?.reason === 'empty') message = `${message} ${this.refusal.message}.`;
    if (!this.refusal || this.refusal.reason === 'arity' || this.refusal.reason === 'empty') this.status(message);
  }
  tapBlock(op) {
    let target = this.selected;
    if (!target) target = Object.keys(this.tree).length ? openSockets(this.tree)[0] : 'io';
    if (!target) return this.refuse('Select a socket first: tap one on the stage or in Parts, then a block.');
    return this.attachAt(target, op);
  }
  select(target) {
    this.selected = this.selected === target ? null : target; this.dirty = true; this.outline();
    if (this.selected) this.status(this.tree[this.selected] ? `${OPS[this.tree[this.selected].op][1]} block selected: ${touchFirst() ? 'Take off removes it' : 'Backspace or Take off removes it'}; a palette block goes above it.` : 'Socket selected: tap a block in the palette to hang it there.');
    $('machine-remove').hidden = !this.tree[this.selected];
  }
  // Enter in the expression field builds the tree, fills Input and starts the run.
  expression() {
    const parsed = parseExpression(this.$expr.value, this.base);
    if (!parsed.ok) { this.$expr.classList.remove('shake'); void this.$expr.offsetWidth; this.$expr.classList.add('shake'); return this.refuse(parsed.error); }
    this.tree = ordered(parsed.tree); this.$input.value = `[${parsed.inputs.join(',')}]`; this.selected = null;
    this.inputs = parsed.inputs; this.planText = this.$input.value; this.plan();
    return this.enter();
  }
  cards() {
    const first = this.answer?.values?.[0], v = first == null ? null : String(first), root = Object.values(this.tree).find(n => n.parent === 'io'), b = $('machine-to-cards');
    let reason = '';
    if (v == null) reason = 'Run a machine first: its Output goes to the cards';
    else if (root?.op === 'ln' || /[a-z]/i.test(v)) reason = 'this value is not a card';
    else if (v.replace('-', '').split('/').some(part => { try { return BigInt(part) > SAFE; } catch { return true; } })) reason = 'Too large for the cards: they hold whole numbers up to 9 007 199 254 740 991';
    b.disabled = !!reason; b.title = reason || `Put ${v.replace('-', '−')} on the cards in ${BASE_NAME[this.base]}`;
  }

  // ---------- time and drawing ----------
  frame(now) {
    const c = this.clock, t = c.t(now);
    if (c.run && c.run.i !== this.lastStarted) { this.lastStarted = c.run.i; this.began(c.run.i); }
    const done = Math.floor(t + 1e-9);
    if (done > this.lastDone) for (let k = Math.max(0, this.lastDone); k < done; k++) this.ended(k);
    this.lastDone = done;
    // The text and the run's fold first, so the frame is drawn for the stage it is shown in: a
    // caption or sentence that takes another line resizes it, and so does the phone layout's fold.
    this.sync(t);
    if (t !== this.lastT || this.dirty) this.draw(t);
  }
  began(i) {
    const beat = this.planned.beats[i];
    if (this.stepMode) haptic('tick');
    if (beat.motion && Object.values(beat.motion).some(m => m.burst)) haptic('pop');
    this.dispatchEvent(new CustomEvent('beat', { detail: { i } }));
  }
  ended(i) {
    const plan = this.planned, beat = plan.beats[i], n = plan.beats.length, said = this.sentenceAt(i + 1);
    // The live region keeps pace with a screen reader: every beat when stepping or reading
    // along, otherwise each completed node and the Output (design 4.9).
    if (this.stepMode || this.readAlong) this.announce(`${beat.caption} ${said ? said + '.' : ''}`.trim());
    else if (beat.kind === 'return') this.announce(said);
    if (beat.kind === 'output' || i === n - 1) {
      if (!this.stepMode && !this.readAlong) this.announce(`Output ${plan.result.text}${plan.result.label ? `: ${plan.result.label}` : ''}.`);
      haptic('success'); this.dispatchEvent(new CustomEvent('done', { detail: { result: plan.result } }));
    } else if (['collide', 'carry', 'addone'].includes(beat.kind) && this.grew(i)) haptic('thud');
  }
  // A carry that lands above a tower's top grows the column.
  grew(i) {
    const a = snapshotAt(this.planned, i), b = snapshotAt(this.planned, i + 1), top = (s, t) => Math.max(-1, ...Object.values(s.bulbs).filter(x => x.t === t && !x.slot).map(x => x.l));
    return Object.keys(b.towers).some(t => a.towers[t] && top(b, t) > top(a, t));
  }
  sentenceAt(k) { try { return this.planned.display ? '' : sentence(snapshotAt(this.planned, k)); } catch { return ''; } }
  viewport() { return { width: Math.max(1, this.stage.clientWidth), height: Math.max(1, this.stage.clientHeight) }; }
  // The stage's client box on screen, the one viewport() measures (its border is not framed).
  stageBox() {
    const b = this.stage.getBoundingClientRect(), { width, height } = this.viewport();
    return { x: b.left + this.stage.clientLeft, y: b.top + this.stage.clientTop, width, height };
  }
  // The camera frames what is left of the stage: above the burned-in caption band in
  // recording mode, and above the palette where it lies over the stage (desktop, tablets).
  // It also keeps clear of the HUD in the top-left corner, insetting whichever side costs the
  // viewport the smaller share (the top on a portrait phone, the left in landscape).
  inset() {
    const { width, height } = this.viewport(), band = this.recording ? (height > width ? 170 : 120) : 0;
    const p = $('machine-palette').getBoundingClientRect(), b = this.stageBox(), hud = $('machine-hud').getBoundingClientRect();
    const st = { top: b.y, left: b.x, bottom: b.y + height, right: b.x + width };
    // The palette counts only where it lies over the stage: in the phone landscape rail it is
    // beside the stage, level with it, and covers none of it.
    const over = p.width && p.top < st.bottom && p.bottom > st.top + 1 && p.left < st.right && p.right > st.left ? (media('(hover: none)') ? st.bottom - p.top : 30) : 0, inset = {};
    if (band || over) inset.bottom = Math.max(band, Math.round(over));
    if (hud.width && hud.height) { const top = Math.round(hud.bottom - st.top), left = Math.round(hud.right - st.left); if (top / height <= left / width) inset.top = top; else inset.left = left; }
    return inset;
  }
  draw(t) {
    // minFont: value pills whose text would draw under 10 px (on a phone at the camera's
    // smallest scale, 6.6 px) grow into the free space around them (render.js, design 1.3);
    // the recording keeps the layout's sizes, which its 1280 × 720 frames read at
    const view = { viewport: this.viewport(), motion: this.reduced ? 'reduced' : 'full', digits: this.digits, prefix: 'm-', selected: this.selected, highlight: this.highlight, inset: this.inset(), active: this.active(t), minFont: this.recording ? 0 : MIN_FONT };
    if (this.manual) view.camera = this.fit(this.manual);
    else { const folded = this.folded(t, view.viewport, view.inset); if (folded) view.camera = folded; }
    const out = renderMachine(this.planned, t, this.layout, ink, view);
    this.cam = parseBox(out.viewBox) ?? view.camera;
    this.frames.apply(inner(out.svg));
    if (this.cam) this.svg.setAttribute('viewBox', boxText(this.cam));
    this.lastT = t; this.dirty = false; this.hits(t);
  }
  // On a phone the run folds the HUD away (4.8), and in portrait the palette strip and the bar's
  // second row: the stage grows and moves, or loses only the HUD's inset. The camera does not
  // jump there: at t = 0 and t = n it frames as at rest (the stage as the run began), carried
  // into the run's stage so that nothing moves on screen, and it eases to the run's own
  // framing over the first beat and back over the last (layout.js foldWeight). Null where
  // nothing folds (desktop, tablets, a recording), or after a resize or rotation mid-run:
  // the run's own camera.
  folded(t, viewport, inset) {
    const rest = this.rest, plan = this.planned, tt = Number.isFinite(t) ? t : 0, w = foldWeight(tt, plan.beats.length, this.reduced);
    if (!rest || w >= 1 || !this.mode.classList.contains('running') || rest.win !== windowSize()) return null;
    const now = this.stageBox(), same = (p, q, keys) => keys.every(k => Math.abs((p[k] || 0) - (q[k] || 0)) < .5);
    if (same(rest.box, now, ['x', 'y', 'width', 'height']) && same(rest.inset, inset, ['top', 'left', 'right', 'bottom'])) return null;
    const at = moveCamera(cameraAt(plan, this.layout, tt, rest.box, { reduced: this.reduced, inset: rest.inset }), rest.box, now);
    return w > 0 ? foldCamera(at, cameraAt(plan, this.layout, tt, viewport, { reduced: this.reduced, inset }), w) : at;
  }
  // The run state that the phone layout folds on (4.8), set before a frame is drawn. As a run
  // begins, the stage and the camera's inset at rest are kept for folded().
  fold() {
    const c = this.clock, running = !!c && c.started && !c.done;
    if (this.mode.classList.contains('running') === running) return;
    if (running) { const box = this.stageBox(); this.rest = this.visible && box.width > 1 && box.height > 1 ? { box, inset: this.inset(), win: windowSize() } : null; }
    this.mode.classList.toggle('running', running); this.dirty = true;
  }
  // The node at work: the beat in motion's, else the one just finished (while it stands),
  // else the next one's. The renderer draws place values and digits beside it.
  active(t) {
    // (t within 1e-9 of 0 is the opening too, and so is a NaN: beats[-1] would throw)
    const beats = this.planned.beats, n = beats.length; if (!n || !(t > 1e-9)) return 'io';
    const i = Math.min(n - 1, Math.ceil(t - 1e-9) - 1), here = beats[i].node;
    if (Math.abs(t - Math.round(t)) > 1e-9 || here === 'io' || snapshotAt(this.planned, i + 1).nodes[here]) return here;
    return beats[i + 1]?.node ?? 'io';
  }
  // A manual camera keeps the viewport's shape, so pans and pinches never distort.
  fit(c) {
    const { width, height } = this.viewport(), aspect = width / height, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    let w = c.w, h = c.h; if (w / h > aspect) h = w / aspect; else w = h * aspect;
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, width / w)); w = width / s; h = height / s;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  overview() { const b = box(this.layout.bounds); if (!b) return; const pad = 40; this.manual = this.fit({ x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad }); this.dirty = true; }
  centre() { this.manual = null; this.dirty = true; }
  // Pointer targets over the frame, in machine units: open sockets, blocks, and towers at rest.
  hits(t) {
    const plan = this.planned, L = this.layout, rest = !this.clock.playing && Math.abs(t - Math.round(t)) < 1e-9, key = `${this.planId}|${rest ? Math.round(t) : 'm'}|${this.selected}|${this.drag?.socket ?? ''}`;
    if (key === this.hitKey && !this.drag) return;
    this.hitKey = key;
    let svg = '';
    const safe = fn => { try { return fn(); } catch { return null; } };
    if (rest) {
      const scene = snapshotAt(plan, Math.round(t));
      for (const id of Object.keys(scene.towers)) { const b = safe(() => box(L.towerBox(scene, id))); if (b && Number.isFinite(b.w)) svg += `<rect class="m-hit m-hit-tower" data-tower="${esc(id)}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>`; }
    }
    for (const id of Object.keys(this.tree)) { const b = safe(() => box(L.nodeBox(id))); if (b && Number.isFinite(b.w)) svg += `<rect class="m-hit m-hit-node${this.selected === id ? ' selected' : ''}" data-node="${id}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="14"/>`; }
    for (const s of openSockets(this.tree).concat(Object.keys(this.tree).length ? [] : ['io'])) {
      const p = this.socketPoint(s); if (!p) continue;
      svg += `<circle class="m-hit m-hit-socket${this.selected === s ? ' selected' : ''}${this.drag?.socket === s ? ' target' : ''}" data-socket="${s}" cx="${p.x}" cy="${p.y}" r="${s === 'io' ? 70 : 46}"/>`;
    }
    if (this.drag?.socket && this.drag.at) { const p = this.socketPoint(this.drag.socket) ?? this.drag.at; svg += `<path class="m-preview" d="M${p.x} ${p.y}L${this.drag.at.x} ${this.drag.at.y}"/>`; }
    // a long exact answer is elided on the stage only: Output below holds every digit
    let note = this.outputText(t); if (note.length > 48) note = `${note.slice(0, 22)}…${note.slice(-22)}`;
    if (this.refusal && note) svg += `<text class="m-output-note" x="162" y="-86" text-anchor="middle">${esc(note)}</text>`;
    this.$hits.innerHTML = svg;
  }
  socketPoint(s) {
    if (s === 'io') return { x: 0, y: 24 };
    const id = s.split('.')[0];
    if (!this.tree[id]) return null;
    try { const p = this.layout.place(s); return p && Number.isFinite(p.x) ? p : null; } catch { return null; }
  }
  // Text, controls and attributes that follow the clock. Cheap; most of it only on change.
  sync(t, force = false) {
    const c = this.clock, n = c.n, boundary = Math.max(0, Math.min(n, Math.floor(t + 1e-9)));
    const s = this.stage.dataset, put = (key, v) => { if (s[key] !== v) s[key] = v; };
    put('beat', String(c.beat)); put('beats', String(n)); put('playing', String(c.playing)); put('t', String(Math.round(t * 1000) / 1000));
    // (a Step, Back or seek folds or unfolds the phone layout at once: the frame is drawn again)
    this.fold();
    const pause = $('machine-pause'); if (pause.getAttribute('aria-pressed') !== String(c.paused)) { pause.setAttribute('aria-pressed', String(c.paused)); pause.textContent = c.paused ? 'Resume' : 'Pause'; }
    const shown = c.run ? c.run.i : c.beat;
    if (!force && boundary === this.lastBoundary && shown === this.lastShown) return;
    this.lastBoundary = boundary; this.lastShown = shown;
    $('machine-caption').textContent = !c.started && t === 0 || shown < 0 ? this.prompt() : this.planned.beats[shown]?.caption ?? '';
    $('machine-sentence').textContent = this.sentenceAt(boundary);
    const out = this.outputText(t); $('machine-output').textContent = out;
    for (const b of this.$steps.querySelectorAll('[aria-current]')) b.removeAttribute('aria-current');
    const cur = shown >= 0 && this.$steps.children[shown]?.firstElementChild; if (cur) { cur.setAttribute('aria-current', 'step'); if (!this.$steps.closest('[hidden]')) cur.scrollIntoView?.({ block: 'nearest' }); }
    this.outline();
  }
  prompt() {
    if (this.refusal?.reason === 'empty') return 'Tap the triangle, then a block in the palette (or drag one under it).';
    return this.refusal ? '' : touchFirst() ? 'Tap Run' : 'Press Enter';
  }
  // The same refusal twice (Enter again on [1,2,3]) is cleared first, so it is heard again.
  status(text, tone = '') {
    const el = $('machine-status'); el.dataset.tone = tone;
    if (text && el.textContent === text && tone === 'refuse') { el.textContent = ''; requestAnimationFrame(() => { if (!el.textContent) el.textContent = text; }); }
    else el.textContent = text;
    $('machine-remove').hidden = !this.tree[this.selected];
  }
  announce(text) { if (!text) return; const el = $('machine-live'); el.textContent = ''; requestAnimationFrame(() => { el.textContent = text; }); }
  hud() {
    $('machine-hud-base').textContent = BASE_SHORT[this.base];
    for (const b of this.mode.querySelectorAll('#machine-base [data-base]')) { const on = b.dataset.base === this.base; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    $('machine-hud-auto').classList.toggle('lit', this.auto); $('machine-auto').setAttribute('aria-pressed', String(this.auto));
    // The SPEED bulbs fill up as beats get shorter; a long run played at 4× says so.
    const lit = SPEEDS.length - SPEEDS.indexOf(this.sp), label = `${this.sp} s${this.boost > 1 ? ` ÷ ${this.boost}` : ''}`;
    $('machine-hud-speed').innerHTML = SPEEDS.map((_, i) => `<i class="${i < lit ? 'lit' : ''}"></i>`).join(''); $('machine-hud-sp').textContent = label;
    $('machine-speed').textContent = label; $('machine-slower').disabled = this.sp >= SPEEDS.at(-1); $('machine-faster').disabled = this.sp <= SPEEDS[0];
  }

  // ---------- panels ----------
  buildPalette() {
    const ops = palette(this.base), greyed = this.base === 'e' ? Object.keys(E_MISSING) : [];
    $('machine-palette').innerHTML = [...ops, ...greyed].map(op => {
      const off = !ops.includes(op);
      return `<button type="button" data-op="${op}"${off ? ` disabled title="${esc(E_MISSING[op])}"` : ` title="${esc(OPS[op]?.[1] ?? op)} block: tap to hang it on the selected socket, or drag it onto one"`}>${blockGlyphSVG(op, ink, this.base)}<span>${esc(OPS[op]?.[0] ?? op)}</span></button>`;
    }).join('');
  }
  steps() {
    this.$steps = $('machine-steps');
    this.$steps.innerHTML = this.planned.beats.map(b => `<li><button type="button" data-beat="${b.i}"><span>${b.i}</span> ${esc(b.caption)}</button></li>`).join('');
  }
  // Parts: the machine as a tree of blocks and sockets, the keyboard path to building.
  outline() {
    const el = $('machine-outline'), scene = snapshotAt(this.planned, Math.max(0, Math.min(this.clock.n, Math.floor(this.clock.pos + 1e-9))));
    const towerIn = at => Object.values(scene.towers).find(t => t.at === at);
    const nameOf = id => `${OPS[this.tree[id].op]?.[1] ?? this.tree[id].op} block`;
    const item = (attrs, label, kids = '') => `<li role="treeitem" tabindex="-1" ${attrs} aria-label="${esc(label)}"${kids ? ' aria-expanded="true"' : ''}><span>${esc(label)}</span>${kids ? `<ul role="group">${kids}</ul>` : ''}</li>`;
    const node = id => item(`data-node="${id}" aria-selected="${this.selected === id}"`, nameOf(id), socketsOf(this.tree[id].op).map(side => socket(`${id}.${side}`, `${nameOf(id)}, ${SIDE[side]} socket`)).join(''));
    const socket = (s, name) => {
      const held = occupant(this.tree, s), tower = towerIn(s === 'io' ? 'io:0' : s);
      const content = held ? nameOf(held) : tower ? `${tower.text}${tower.digits ? `, ${BASE_NAME[this.base]} ${tower.digits.replace(/[₂ₑ]| bal₃/g, '')}` : ''}` : 'open';
      return item(`data-socket="${s}" aria-selected="${this.selected === s}"`, `${name}: ${content}`, held ? node(held) : '');
    };
    const html = `<ul role="none">${socket('io', `Triangle: input ${this.planText}, output ${this.outputText(this.clock.pos) || 'empty'}; its socket`)}</ul>`;
    if (html === this.outlineHTML) return;
    const focused = el.contains(document.activeElement) ? document.activeElement.dataset.node ?? document.activeElement.dataset.socket : null;
    this.outlineHTML = html; el.innerHTML = html;
    const items = [...el.querySelectorAll('[role=treeitem]')], keep = items.find(i => (i.dataset.node ?? i.dataset.socket) === (focused ?? this.selected)) ?? items[0];
    if (keep) { keep.tabIndex = 0; if (focused) keep.focus({ preventScroll: true }); }
  }
  sheet(open) {
    const side = $('machine-side'); side.classList.toggle('open', open); $('machine-steps-toggle').setAttribute('aria-expanded', String(open));
    this.inertOutline();
    if (open) side.querySelector('[role=tab][aria-selected=true]')?.focus({ preventScroll: true });
  }
  tab(name) {
    for (const t of this.mode.querySelectorAll('#machine-side [role=tab]')) { t.setAttribute('aria-selected', String(t.dataset.tab === name)); t.tabIndex = t.dataset.tab === name ? 0 : -1; }
    $('machine-steps-panel').hidden = name !== 'steps'; $('machine-parts-panel').hidden = name !== 'parts';
    this.inertOutline();
  }
  // The outline is reachable only while it can be seen (design 4.9).
  inertOutline() {
    const sheet = media(SHEET_QUERY), shown = !$('machine-parts-panel').hidden && (!sheet || $('machine-side').classList.contains('open'));
    $('machine-outline').inert = !shown;
  }
  peek(id, at) {
    const scene = snapshotAt(this.planned, Math.round(this.clock.pos)), t = scene.towers[id]; if (!t) return;
    const el = $('machine-peek'), r = this.stage.getBoundingClientRect();
    el.innerHTML = `<b>${esc(t.text)}</b>${t.approx ? `<span>${esc(t.approx)}</span>` : ''}${t.digits ? `<span>${esc(t.digits)}</span>` : ''}${t.reading ? `<span>${esc(t.reading)}</span>` : ''}${t.note ? `<small>${esc(t.note)}</small>` : ''}`;
    el.hidden = false; el.style.left = `${Math.max(8, Math.min(r.width - el.offsetWidth - 8, at.x - r.left - el.offsetWidth / 2))}px`; el.style.top = `${Math.max(8, at.y - r.top - el.offsetHeight - 24)}px`;
    this.announce(`${t.text}${t.digits ? `, ${t.digits}` : ''}`); haptic('peek');
  }
  hidePeek() { const el = $('machine-peek'); if (el) el.hidden = true; }
  // Recording mode: 'build' shows the bar and palette, 'run' hides them (design 5.1).
  chrome(mode) { document.body.classList.toggle('machine-chrome-build', mode === 'build'); this.dirty = true; }

  // ---------- input ----------
  wire() {
    $('machine-run').onclick = () => this.enter();
    $('machine-step').onclick = () => this.step();
    $('machine-back').onclick = () => this.back();
    $('machine-auto').onclick = $('machine-hud-auto').onclick = () => this.setAuto(!this.auto);
    $('machine-pause').onclick = () => { this.clock.pause(performance.now()); this.sync(this.clock.t(performance.now()), true); };
    $('machine-slower').onclick = () => this.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(this.sp) + 1)]);
    $('machine-faster').onclick = () => this.setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(this.sp) - 1)]);
    $('machine-pace').onchange = e => this.setPace(e.target.value);
    $('machine-digits').onchange = e => { this.digits = e.target.checked; this.dirty = true; };
    $('machine-readalong').checked = this.readAlong; $('machine-reduced').checked = this.reduced; this.mode.classList.toggle('reduced', this.reduced);
    $('machine-reduced').onchange = e => this.setReduced(e.target.checked, { remember: true });
    if (typeof matchMedia === 'function') matchMedia(REDUCED_QUERY).addEventListener?.('change', e => { if (!this.reducedChosen) this.setReduced(e.matches); });
    $('machine-readalong').onchange = e => { this.readAlong = e.target.checked; this.clock.setReadAlong(this.readAlong, performance.now()); };
    $('machine-centre').onclick = () => this.centre();
    $('machine-overview').onclick = () => this.overview();
    $('machine-rebuild').onclick = () => this.rebuild();
    // Take off: the touch path to Backspace, shown while a block is selected
    $('machine-remove').onclick = () => { if (this.tree[this.selected]) this.remove(this.selected); };
    $('machine-to-cards').onclick = () => { const v = this.answer?.values?.[0]; if (v != null && !$('machine-to-cards').disabled) this.dispatchEvent(new CustomEvent('cards', { detail: { value: String(v), base: this.base } })); };
    $('machine-steps-toggle').onclick = () => this.sheet(!$('machine-side').classList.contains('open'));
    $('machine-sheet-close').onclick = () => { this.sheet(false); $('machine-steps-toggle').focus(); };
    for (const t of this.mode.querySelectorAll('#machine-side [role=tab]')) t.onclick = () => this.tab(t.dataset.tab);
    // Play at 4×: this plan plays at a quarter of the chosen beat length, which is kept for
    // every other run. Show the answer jumps to OUTPUT; a later run asks again.
    $('machine-ask-play').onclick = () => { this.longOK = true; this.boost = 4; this.ask(false); this.start(this.$input.value.trim(), performance.now()); this.hud(); };
    $('machine-ask-answer').onclick = () => { this.ask(false); this.clock.seek(this.clock.n); this.clock.started = true; this.rewound(); };
    for (const b of this.mode.querySelectorAll('#machine-base [data-base]')) b.onclick = () => this.setBase(b.dataset.base);
    $('machine-steps').onclick = e => { const b = e.target.closest('[data-beat]'); if (!b) return; this.clock.seek(Number(b.dataset.beat)); this.stepMode = true; this.clock.step(performance.now(), { once: true }); this.rewound(); };
    this.wireOutline(); this.wireStage(); this.wirePalette();
    this.mode.addEventListener('keydown', e => this.key(e));
    this.tab('steps'); this.hud();
    // On phones the options (carries, Digits, Read along, Reduced motion) sit at the foot of
    // the Steps sheet: a strip of their own under the control row cost a portrait stage 52 px
    // at the opening, when the camera most needs the height (design 4.5, 4.8). Elsewhere they
    // flow in the control row, before Centre.
    const extras = this.mode.querySelector('.machine-extras'), side = $('machine-side'), centre = $('machine-centre');
    const placeExtras = () => { if (media(SHEET_QUERY)) { if (extras.parentNode !== side) side.append(extras); } else if (extras.nextElementSibling !== centre) centre.before(extras); };
    placeExtras();
    matchMedia(SHEET_QUERY).addEventListener?.('change', () => { placeExtras(); this.inertOutline(); });
  }
  rebuild() { this.clock.seek(0); this.clock.started = false; this.manual = null; this.rewound(); }
  cycleBase() { this.setBase(BASES[(BASES.indexOf(this.base) + 1) % BASES.length]); }
  key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    // Esc closes the Steps/Parts sheet first, and gives focus back to its toggle.
    if (e.key === 'Escape' && $('machine-side').classList.contains('open') && media(SHEET_QUERY)) { e.preventDefault(); this.sheet(false); $('machine-steps-toggle').focus({ preventScroll: true }); return; }
    const field = e.target.closest('input,select,textarea');
    if (field) {
      if (e.key === 'Enter' && field === this.$input) { e.preventDefault(); this.enter(); }
      else if (e.key === 'Enter' && field === this.$expr) { e.preventDefault(); this.expression(); }
      else if (e.key === 'Escape') { e.preventDefault(); field.blur(); this.stage.focus({ preventScroll: true }); }
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('button,[role=treeitem]')) return;
    // The shortcuts belong to the stage (design 4.4). Widgets that own their arrow keys keep
    // them: the base radios, the Steps/Parts tabs, the palette, the Steps list and the outline.
    if (NAV_KEYS.includes(e.key)) { const group = e.target.closest('#machine-base,#machine-palette,[role=tablist],#machine-steps,#machine-outline'); if (group) return this.groupKey(e, group); }
    if (e.target.closest('#machine-outline') && ['Backspace', 'Delete'].includes(e.key)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, now = performance.now();
    const act = {
      Enter: () => this.enter(), ArrowRight: () => this.enter(), ArrowDown: () => this.enter(), ArrowLeft: () => this.back(), ArrowUp: () => this.back(),
      a: () => this.setAuto(!this.auto), ' ': () => $('machine-pause').click(), '[': () => $('machine-slower').click(), ']': () => $('machine-faster').click(),
      Home: () => { this.clock.start(now); this.rewound(); }, End: () => { this.clock.seek(this.clock.n); this.clock.started = true; this.rewound(); },
      r: () => this.rebuild(), t: () => this.centre(), o: () => this.overview(), d: () => $('machine-digits').click(),
      p: () => this.setPace(this.pace === 'together' ? 'level' : 'together'), b: () => this.cycleBase(),
      // Esc on a control returns to the stage; Esc on the stage leaves the mode.
      Escape: () => this.stage.contains(e.target) ? this.dispatchEvent(new Event('leave')) : this.stage.focus({ preventScroll: true }),
      Backspace: () => { if (this.tree[this.selected]) this.remove(this.selected); }, Delete: () => { if (this.tree[this.selected]) this.remove(this.selected); },
    }[k];
    if (!act) return;
    e.preventDefault(); act();
  }
  // Arrow keys inside a composite widget move between its items, wrapping round. Radios and
  // tabs select as focus moves (ARIA's automatic activation); the outline has its own handler.
  groupKey(e, group) {
    if (group.id === 'machine-outline') return;
    const items = [...group.querySelectorAll(group.id === 'machine-base' ? '[data-base]' : group.id === 'machine-palette' ? 'button:not(:disabled)' : group.id === 'machine-steps' ? 'button' : '[role=tab]')];
    const i = items.indexOf(e.target.closest('button')); if (i < 0) return;
    const next = { ArrowLeft: i - 1, ArrowUp: i - 1, ArrowRight: i + 1, ArrowDown: i + 1, Home: 0, End: items.length - 1 }[e.key], to = items[(next + items.length) % items.length];
    e.preventDefault(); if (!to) return;
    to.focus({ preventScroll: group.id !== 'machine-steps' });
    if (group.id === 'machine-base') this.setBase(to.dataset.base);
    else if (to.getAttribute('role') === 'tab') this.tab(to.dataset.tab);
  }
  wireOutline() {
    const el = $('machine-outline');
    const pick = li => { if (!li) return; if (li.dataset.node) this.select(li.dataset.node); else this.select(li.dataset.socket); };
    el.addEventListener('click', e => { const li = e.target.closest('[role=treeitem]'); if (li) { e.stopPropagation(); pick(li); } });
    el.addEventListener('keydown', e => {
      const li = e.target.closest('[role=treeitem]'); if (!li) return;
      const items = [...el.querySelectorAll('[role=treeitem]')], i = items.indexOf(li);
      const move = to => { e.preventDefault(); const t = items[Math.max(0, Math.min(items.length - 1, to))]; for (const x of items) x.tabIndex = -1; t.tabIndex = 0; t.focus(); };
      if (e.key === 'ArrowDown') move(i + 1); else if (e.key === 'ArrowUp') move(i - 1); else if (e.key === 'Home') move(0); else if (e.key === 'End') move(items.length - 1);
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(li); }
      else if ((e.key === 'Backspace' || e.key === 'Delete') && li.dataset.node) { e.preventDefault(); this.remove(li.dataset.node); }
    });
  }
  // The stage: tap a socket, block or tower; drag the background to pan; pinch or wheel to zoom.
  wireStage() {
    const st = this.stage, pts = new Map();
    const toMachine = (x, y) => { const m = this.svg.getScreenCTM(); if (!m) return null; const p = new DOMPoint(x, y).matrixTransform(m.inverse()); return { x: p.x, y: p.y }; };
    this.toMachine = toMachine;
    st.addEventListener('pointerdown', e => {
      if (e.target.closest('#machine-hud,#machine-peek') || e.button > 0) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, target: e.target });
      try { st.setPointerCapture(e.pointerId); } catch {}
      if (pts.size === 2) this.pinch = { d: dist(), cam: { ...(this.manual ?? this.cam) } };
    });
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    st.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) p.moved = true;
      if (!this.cam) return;
      const scale = this.viewport().width / this.cam.w;
      if (pts.size === 2 && this.pinch) { const k = this.pinch.d / dist(), c = this.pinch.cam; this.manual = this.fit({ x: c.x + c.w * (1 - k) / 2, y: c.y + c.h * (1 - k) / 2, w: c.w * k, h: c.h * k }); this.dirty = true; return; }
      if (p.moved && pts.size === 1) { const c = this.manual ?? this.cam; this.manual = { ...c, x: c.x - dx / scale, y: c.y - dy / scale }; this.dirty = true; this.hidePeek(); }
    });
    const up = e => {
      const p = pts.get(e.pointerId); if (!p) return; pts.delete(e.pointerId); if (pts.size < 2) this.pinch = null;
      if (p.moved || e.type === 'pointercancel') return;
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-socket],[data-node],[data-tower]') ?? p.target.closest?.('[data-socket],[data-node],[data-tower]');
      if (hit?.dataset.socket) this.select(hit.dataset.socket);
      else if (hit?.dataset.node) this.select(hit.dataset.node);
      else if (hit?.dataset.tower) this.peek(hit.dataset.tower, { x: e.clientX, y: e.clientY });
      else { this.hidePeek(); if (this.selected) { this.selected = null; this.dirty = true; this.outline(); this.status(''); } }
    };
    st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
    st.addEventListener('wheel', e => {
      if (!this.cam) return; e.preventDefault();
      const c = this.manual ?? this.cam, k = Math.exp(Math.max(-.5, Math.min(.5, e.deltaY * .0015))), at = toMachine(e.clientX, e.clientY) ?? { x: c.x + c.w / 2, y: c.y + c.h / 2 };
      this.manual = this.fit({ x: at.x - (at.x - c.x) * k, y: at.y - (at.y - c.y) * k, w: c.w * k, h: c.h * k }); this.dirty = true;
    }, { passive: false });
  }
  // Palette: tap (or Enter) hangs a block on the selected socket; drag previews the nearest
  // socket within reach (PRIME's Ping) and drops it there. On touch a sideways swipe
  // scrolls the strip; a drag needs a vertical pull of 10 px or a 350 ms press.
  wirePalette() {
    const pal = $('machine-palette');
    pal.addEventListener('click', e => {
      const b = e.target.closest('button[data-op]'); if (!b || b.disabled) return;
      if (this.suppressClick) { this.suppressClick = false; return; }
      this.tapBlock(b.dataset.op);
    });
    pal.addEventListener('pointerdown', e => {
      const b = e.target.closest('button[data-op]'); if (!b || b.disabled || e.button > 0) return;
      const touch = e.pointerType !== 'mouse';
      this.press = { id: e.pointerId, op: b.dataset.op, button: b, x0: e.clientX, y0: e.clientY, touch };
      if (touch) this.press.timer = setTimeout(() => { if (this.press?.id === e.pointerId) this.beginDrag(e.clientX, e.clientY); }, 350);
    });
    pal.addEventListener('pointermove', e => {
      const p = this.press; if (!p || p.id !== e.pointerId) return;
      if (this.drag) return this.moveDrag(e.clientX, e.clientY);
      const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
      if (p.touch ? Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) : Math.hypot(dx, dy) > 5) this.beginDrag(e.clientX, e.clientY);
      else if (p.touch && Math.abs(dx) > 10) this.endDrag();
    });
    pal.addEventListener('pointerup', e => { if (this.press?.id !== e.pointerId) return; if (this.drag) { this.dropDrag(); this.suppressClick = true; setTimeout(() => { this.suppressClick = false; }, 0); } else this.endDrag(); });
    pal.addEventListener('pointercancel', () => this.endDrag());
    // Once a block is being dragged, the strip must not scroll under the finger.
    pal.addEventListener('touchmove', e => { if (this.drag) e.preventDefault(); }, { passive: false });
  }
  beginDrag(x, y) {
    const p = this.press; if (!p || this.drag) return;
    clearTimeout(p.timer);
    try { p.button.setPointerCapture(p.id); } catch {}
    const ghost = document.createElement('div'); ghost.className = 'machine-ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.innerHTML = p.button.innerHTML;
    document.body.append(ghost); document.body.classList.add('machine-dragging');
    this.drag = { op: p.op, ghost, socket: null, at: null }; this.moveDrag(x, y);
  }
  moveDrag(x, y) {
    const d = this.drag; if (!d) return;
    d.ghost.style.transform = `translate(${x - 28}px,${y - 28}px)`;
    const at = this.toMachine?.(x, y); d.at = at;
    let best = null, bestD = DRAG_RADIUS;
    if (at) for (const s of [...openSockets(this.tree), ...(Object.keys(this.tree).length ? Object.keys(this.tree) : ['io'])]) {
      const p = this.tree[s] ? this.nodeCentre(s) : this.socketPoint(s); if (!p) continue;
      const dd = Math.hypot(p.x - at.x, p.y - at.y); if (dd < bestD) { bestD = dd; best = s; }
    }
    d.socket = best; this.hits(this.lastT);
  }
  nodeCentre(id) { try { const b = box(this.layout.nodeBox(id)); return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null; } catch { return null; } }
  dropDrag() { const d = this.drag; const target = d?.socket; const op = d?.op; this.endDrag(); if (target) this.attachAt(target, op); else this.status('Drop a block near an open socket to hang it there.'); }
  endDrag() { if (this.press) clearTimeout(this.press.timer); this.press = null; if (this.drag) { this.drag.ghost.remove(); this.drag = null; this.hitKey = null; this.dirty = true; document.body.classList.remove('machine-dragging'); } }

  // ---------- automation (tests and videos only: &automation) ----------
  hook() {
    window.__machine = {
      state: () => this.state,
      // seconds at the speed the clock plays (a long run played at 4× included)
      beats: () => { const s = schedule(this.planned, this.clock.sp, { readAlong: this.readAlong }); return this.planned.beats.map((b, i) => ({ i, kind: b.kind, node: b.node, caption: b.caption, start: s.starts[i], end: s.ends[i] })); },
      plan: () => JSON.parse(JSON.stringify(this.planned)),
      // the URL's names (mbase, machine) or load()'s own (base, op, expression, tree)
      load: async params => { await this.load(presetOf(params)); },
      seek: t => this.seek(t),
      chrome: mode => this.chrome(mode),
    };
  }
}
