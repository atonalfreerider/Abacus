// Graph mode. Equations become curves; a tracer point rides a curve and its
// coordinates stand as card stacks (a column of y cards on the x axis, a row of x
// cards from the y axis). The point settles into detents at roots, the y-intercept,
// turning points and crossings; at a crossing every equation of the system holds.
// Advanced: an area sweep drops columns of card strips that gather into one stack.
import { parseCurves, parseExpression, specialPoints, intersections, show, degree, evaluateExact, riemann, integral, curveText } from './polynomial.js';
import { renderStatic, renderDynamic, textureDefs, toX, toY, fromX, fromY, snapStep, fx, groupSpecials, COLORS } from './graph-view.js';
import { spring } from '../mvc/physics.js';
import { frac, numeric, add, mul, sub, parseScalar, abs } from '../engine.js';

export const examples = [
  { label: 'Parabola: y = x² − 2x − 3', equations: ['y = x^2 - 2x - 3'] },
  { label: 'System of two lines', equations: ['y = x + 1', 'y = -x + 5'] },
  { label: 'System: 2x + 3y = 12 and x − y = 1', equations: ['2x + 3y = 12', 'x - y = 1'] },
  { label: 'x + y = 10: every point on the line solves it', equations: ['x + y = 10'] },
  { label: 'A line meets a parabola', equations: ['y = x^2 - 4', 'y = 2x - 1'] },
  { label: 'Cubic: y = (x + 2)(x − 1)(x − 3)/2', equations: ['y = (x+2)(x-1)(x-3)/2'] },
  { label: 'Both sides of 3x + 1 = x + 9', equations: ['3x + 1 = x + 9'] },
  { label: 'Parallel lines: no solution', equations: ['y = 2x + 1', 'y = 2x - 3'] },
];
const STEPS = [[0.01, 1, 100], [0.05, 1, 20], [0.1, 1, 10], [0.25, 1, 4], [0.5, 1, 2], [1, 1, 1], [2, 2, 1], [5, 5, 1], [10, 10, 1], [25, 25, 1], [50, 50, 1], [100, 100, 1]];
const kindNames = { solution: 'solution', root: 'root', 'y-intercept': 'y-intercept', vertex: 'vertex', 'turning point': 'turning point' };
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const value = (exact, x) => exact ? show(exact) : `≈ ${show(x)}`;
const pretty = text => text.replace(/\^([0-4])/g, (_, d) => '⁰¹²³⁴'[d]).replace(/\*/g, '×').replace(/-/g, '−');
const cards = (v, axis) => { const n = typeof v === 'number' ? Math.abs(v) : numeric(abs(v)); const word = n === 1 ? 'card' : 'cards'; return `${typeof v === 'number' ? '≈ ' + show(n) : show(abs(v))} ${word} ${axis === 'x' ? (v < 0 || v.n < 0 ? 'left (red)' : 'across (blue)') : (v < 0 || v.n < 0 ? 'down (red)' : 'up (blue)')}`; };

// Evaluate one side of a typed equation at the point, exactly when possible.
function evalSide(map, x, y) {
  const exact = x.exact && y.exact;
  if (exact) try {
    let total = frac(0);
    for (const [key, c] of map) { const [i, j] = key.split(',').map(Number); let term = c; for (let k = 0; k < i; k++) term = mul(term, x.exact); for (let k = 0; k < j; k++) term = mul(term, y.exact); total = add(total, term); }
    return { exact: total, n: numeric(total) };
  } catch {}
  let n = 0; for (const [key, c] of map) { const [i, j] = key.split(',').map(Number); n += numeric(c) * x.n ** i * y.n ** j; }
  return { exact: null, n };
}

export class Graph extends EventTarget {
  constructor({ cardsEquation }) {
    super();
    this.cardsEquation = cardsEquation;
    this.stage = $('graph-stage');
    this.stage.innerHTML = `<svg id="graph-svg" xmlns="http://www.w3.org/2000/svg"><defs>${textureDefs()}</defs><defs class="dynamic-defs"></defs><g class="layer-back"></g><g class="layer-area"></g><g class="layer-front"></g><g class="layer-top"></g></svg>`;
    this.svg = this.stage.firstElementChild;
    this.layers = Object.fromEntries(['dynamic-defs', 'layer-back', 'layer-area', 'layer-front', 'layer-top'].map(c => [c, this.svg.querySelector('.' + c)]));
    this.view = { cx: 0, cy: 0, unit: 40, width: 600, height: 400 };
    this.inputs = []; this.curves = []; this.specials = []; this.groups = []; this.tracer = null;
    this.area = { enabled: false, a: frac(0), b: frac(3), dx: frac(1, 4), rule: 'left', phase: 'static', columns: [], shown: 0, grow: 0 };
    this.pointers = new Map(); this.visible = false; this.dirty = true;
    this.bind();
    new ResizeObserver(() => this.resize()).observe(this.stage);
    for (const [i, ex] of examples.entries()) { const o = document.createElement('option'); o.value = i; o.textContent = ex.label; $('graph-examples').append(o); }
    this.setEquations(examples[0].equations);
    const loop = now => { requestAnimationFrame(loop); if (this.visible) try { this.frame(now); } catch (error) { console.error(error); this.area.phase = 'static'; } };
    requestAnimationFrame(loop);
  }
  show() { this.visible = true; this.resize(); this.fit(); this.stage.focus({ preventScroll: true }); }
  hide() { this.visible = false; }
  resize() {
    const { clientWidth: w, clientHeight: h } = this.stage;
    if (!w || !h) return;
    Object.assign(this.view, { width: w, height: h });
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.dirty = true;
  }
  // ---------- equations ----------
  setEquations(texts, { fit = true } = {}) {
    this.inputs = texts.slice(0, 3);
    this.renderInputs();
    this.parse();
    this.tracer = null; this.setArea({ phase: 'static' });
    if (fit) this.fit();
    // The point starts on a whole number clear of the interesting points, so finding them is the learner's move.
    const first = this.curves.findIndex(c => c.kind === 'function');
    if (first >= 0) { const base = Math.round(this.view.cx), shift = [0, 1, -1, 2, -2, 3, -3, 4].find(d => this.groups.every(g => Math.abs(g.x - (base + d)) > .75)) ?? 0; this.place(first, base + shift, { instant: true, snapRadius: 0 }); }
    this.update();
  }
  renderInputs() {
    const box = $('graph-equations'); box.innerHTML = '';
    this.inputs.forEach((text, i) => {
      const row = document.createElement('div'); row.className = 'graph-eq';
      row.innerHTML = `<i></i><input aria-label="Equation ${i + 1}" spellcheck="false" autocomplete="off"><button aria-label="Remove equation ${i + 1}" title="Remove">×</button>`;
      const input = row.querySelector('input'); input.value = text;
      input.oninput = () => { this.inputs[i] = input.value; clearTimeout(this.typing); this.typing = setTimeout(() => { this.parse(); this.keepTracer(); this.update(); }, 250); };
      input.onkeydown = e => { if (e.key === 'Enter') { this.parse(); this.fit(); this.keepTracer(); this.update(); } };
      row.querySelector('button').onclick = () => { this.inputs.splice(i, 1); if (!this.inputs.length) this.inputs.push('y = x'); this.setEquations(this.inputs, { fit: false }); };
      box.append(row);
    });
    $('graph-add').disabled = this.inputs.length >= 3;
  }
  parse() {
    this.parsed = this.inputs.map(text => { try { return { text, curves: parseCurves(text) }; } catch (e) { return { text, error: e.message, curves: [] }; } });
    this.curves = this.parsed.flatMap((p, input) => p.curves.map(c => ({ ...c, input }))).slice(0, 4);
    const rows = [...$('graph-equations').children];
    let colour = 0;
    this.parsed.forEach((p, i) => { const row = rows[i]; if (!row) return; row.classList.toggle('invalid', !!p.error); row.title = p.error || p.curves.map(curveText).join('  and  '); row.querySelector('i').style.background = p.curves.length ? COLORS[colour % COLORS.length] : 'transparent'; colour += p.curves.length; });
    try { this.specials = specialPoints(this.curves); } catch { this.specials = []; }
    this.groups = groupSpecials(this.specials).filter(g => Number.isFinite(g.x) && Number.isFinite(g.y));
    if (this.tracer && !this.curves[this.tracer.curve]) this.tracer = null;
    this.setArea({});
    this.dirty = true;
  }
  keepTracer() { if (this.tracer && this.curves[this.tracer.curve]) this.place(this.tracer.curve, this.tracer.target.x); }
  // Frame the interesting points (roots, vertices, crossings) with the origin, sampling
  // curves only between them so a parabola's steep arms do not shrink the picture.
  fit() {
    const v = this.view, xs = this.groups.map(g => g.x);
    let x0 = Math.min(0, ...xs), x1 = Math.max(0, ...xs);
    if (x1 - x0 < 4) { const c = (x0 + x1) / 2; x0 = c - 2; x1 = c + 2; }
    const ys = [0, ...this.groups.map(g => g.y)];
    for (const c of this.curves) if (c.kind === 'function') for (let k = 0; k <= 40; k++) { const y = fx(c, x0 + (x1 - x0) * k / 40); if (Number.isFinite(y)) ys.push(y); }
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const xpad = Math.max(1, (x1 - x0) * .25), ypad = Math.max(1, (y1 - y0) * .15);
    x0 -= xpad; x1 += xpad; y0 -= ypad; y1 += ypad;
    v.unit = Math.max(3, Math.min(90, Math.min(v.width / (x1 - x0), v.height / (y1 - y0))));
    v.cx = (x0 + x1) / 2; v.cy = (y0 + y1) / 2;
    this.dirty = true;
  }
  // ---------- tracer ----------
  // Target a point on curve i nearest to the raw coordinate (x for a function, y for a vertical line).
  place(i, raw, { instant = false, snapRadius = 14, at = null } = {}) {
    const c = this.curves[i], v = this.view; if (!c) return;
    const vertical = c.kind === 'vertical', px = vertical ? toY(v, raw) : toX(v, raw);
    const along = g => vertical ? toY(v, g.y) : toX(v, g.x);
    const mine = this.groups.filter(g => g.curves.includes(i));
    let snap = this.tracer?.snapped && this.tracer.curve === i && mine.includes(this.tracer.snapGroup) && Math.abs(along(this.tracer.snapGroup) - px) < 24 ? this.tracer.snapGroup : null;
    if (!snap) { let best = null; for (const g of mine) { const d = Math.abs(along(g) - px); if (d < snapRadius && (!best || d < best.d)) best = { g, d }; } snap = best?.g || null; }
    let target;
    if (snap) target = { x: snap.x, y: snap.y, exact: snap.exact, group: snap };
    else {
      const [s, num, den] = STEPS.find(([s]) => s * v.unit >= 9) || STEPS.at(-1), q = at || frac(Math.round(raw / s) * num, den);
      if (vertical) target = { x: numeric(c.x), y: numeric(q), exact: { x: c.x, y: q } };
      else { const y = evaluateExact(c.poly, q); target = { x: numeric(q), y: y ? numeric(y) : fx(c, numeric(q)), exact: y ? { x: q, y } : null }; }
    }
    const t = this.tracer?.curve === i ? this.tracer : { curve: i, x: target.x, y: target.y, v: 0 };
    const changed = !this.tracer || this.tracer.snapGroup !== snap || this.tracer.target?.x !== target.x || this.tracer.target?.y !== target.y;
    if (snap && snap !== this.tracer?.snapGroup) try { navigator.vibrate?.(8); } catch {}
    Object.assign(t, { target, snapped: snap ? snap.kinds.map(k => kindNames[k]).join(' · ') : null, snapGroup: snap });
    if (instant) { t.x = target.x; t.y = target.y; t.v = 0; }
    this.tracer = t;
    if (changed) { this.readout(); this.dispatchEvent(new CustomEvent('point', { detail: this.pointInfo() })); }
    this.dirty = true;
  }
  pointInfo() {
    const t = this.tracer; if (!t) return null;
    const checks = this.checks();
    return { x: t.target.x, y: t.target.y, exact: t.target.exact, kinds: t.snapGroup?.kinds || [], solvesAll: checks.length > 0 && checks.every(c => c.ok), checks };
  }
  checks() {
    const t = this.tracer; if (!t) return [];
    const x = { exact: t.target.exact?.x, n: t.target.x }, y = { exact: t.target.exact?.y, n: t.target.y };
    return this.parsed.filter(p => !p.error).map(p => {
      const [l, r] = p.text.split('=').map(parseExpression), L = evalSide(l, x, y), R = evalSide(r, x, y);
      const ok = L.exact && R.exact ? numeric(sub(L.exact, R.exact)) === 0 : Math.abs(L.n - R.n) < 1e-6 * (1 + Math.abs(L.n));
      const xs = x.exact ? show(x.exact) : show(x.n), ys = y.exact ? show(y.exact) : show(y.n);
      const substituted = pretty(p.text.replace(/x/gi, `(${xs})`).replace(/y/gi, `(${ys})`));
      return { text: pretty(p.text), ok, substituted, left: L.exact ? show(L.exact) : show(L.n), right: R.exact ? show(R.exact) : show(R.n), approximate: !(L.exact && R.exact) };
    });
  }
  readout() {
    const t = this.tracer, box = $('graph-readout');
    if (!t) { box.innerHTML = '<p>Drag along a curve: the point’s x and y stand up as cards.</p>'; return; }
    const ex = t.target.exact, xv = ex ? ex.x : t.target.x, yv = ex ? ex.y : t.target.y;
    let html = `<p class="point">(x, y) = (${value(ex?.x, t.target.x)}, ${value(ex?.y, t.target.y)})</p>${t.snapped ? `<p><i>At the ${esc(t.snapped)}.</i></p>` : ''}<p>x: ${cards(xv, 'x')}<br>y: ${cards(yv, 'y')}</p>`;
    const checks = this.checks();
    for (const c of checks) html += `<div class="check ${c.ok ? 'ok' : 'no'}">${esc(c.text)} ${c.ok ? '✓' : '✗'}<small>${esc(c.substituted)}: ${esc(c.left)} ${c.ok ? '=' : '≠'} ${esc(c.right)}${c.approximate ? ' (rounded)' : ''}</small></div>`;
    const both = this.parsed.length === 1 && this.parsed[0].curves.length === 2;
    if (checks.length > 1 && checks.every(c => c.ok)) html += `<div class="solved-banner">(${value(ex?.x, t.target.x)}, ${value(ex?.y, t.target.y)}) solves every equation: it is the system’s solution.</div>`;
    else if (both && t.snapGroup?.kinds.includes('solution')) html += `<div class="solved-banner">Both sides are equal here, so x = ${value(ex?.x, t.target.x)} solves ${esc(this.parsed[0].text)}.</div>`;
    else if (checks.length === 1 && checks[0].ok && !both) html += `<p><small>Every point on this curve solves the equation; drag to see others.</small></p>`;
    box.innerHTML = html;
  }
  listPoints() {
    const box = $('graph-points'), order = g => g.kinds.includes('solution') ? 0 : g.kinds.includes('root') ? 1 : 2;
    const groups = [...this.groups].sort((a, b) => order(a) - order(b) || a.x - b.x).slice(0, 12);
    let note = '';
    for (let i = 0; i < this.curves.length; i++) for (let j = i + 1; j < this.curves.length; j++) {
      const s = intersections(this.curves[i], this.curves[j]);
      if (s.type === 'none') note += `<p><small>${esc(curveText(this.curves[i]))} and ${esc(curveText(this.curves[j]))} never meet: no solution.</small></p>`;
      if (s.type === 'same') note += `<p><small>${esc(curveText(this.curves[i]))} is the same line twice: every point on it is a solution.</small></p>`;
    }
    const errors = this.parsed.filter(p => p.error).map(p => `<p class="check no">${esc(p.text)}<small>${esc(p.error)}</small></p>`).join('');
    box.innerHTML = errors + (groups.length ? '<h2>Points</h2>' : '') + groups.map((g, k) => `<button data-point="${k}" class="${g.kinds.includes('solution') ? 'solution' : ''}"><i></i>${g.kinds.map(k => kindNames[k]).join(' · ')}: (${value(g.exact?.x, g.x)}, ${value(g.exact?.y, g.y)})</button>`).join('') + note;
    box.querySelectorAll('[data-point]').forEach(b => b.onclick = () => this.goTo(groups[Number(b.dataset.point)]));
  }
  // The first special point of a kind ('solution', 'root'), for the tutor.
  goal(kind) { return this.groups.filter(g => g.kinds.includes(kind)).sort((a, b) => a.x - b.x)[0] || null; }
  pointText(g) { return `${value(g.exact?.x, g.x)}, ${value(g.exact?.y, g.y)}`; }
  goTo(group) { const i = group.curves[0], c = this.curves[i]; this.place(i, c.kind === 'vertical' ? group.y : group.x, { snapRadius: 1e9 }); }
  solve() {
    const solutions = this.groups.filter(g => g.kinds.includes('solution'));
    const pool = solutions.length ? solutions : this.groups.filter(g => g.kinds.includes('root'));
    if (!pool.length) { $('graph-readout').insertAdjacentHTML('beforeend', '<p><small>No crossings or roots in these equations.</small></p>'); return; }
    const at = pool.indexOf(this.tracer?.snapGroup);
    this.goTo(pool[(at + 1) % pool.length]);
  }
  fromCards() { try { this.setEquations([this.cardsEquation().replace(/−/g, '-')]); } catch (e) { $('graph-readout').innerHTML = `<p class="check no">${esc(e.message)}</p>`; } }
  // ---------- area (advanced) ----------
  setArea(patch) {
    const A = Object.assign(this.area, patch);
    A.curve = this.curves.findIndex(c => c.kind === 'function');
    const curve = this.curves[A.curve];
    if (!A.enabled || !curve || numeric(sub(A.b, A.a)) <= 0) { A.columns = []; A.total = null; this.areaResult(); this.dirty = true; return; }
    const n = numeric(sub(A.b, A.a)) / numeric(A.dx);
    if (n > 400) { A.columns = []; $('area-result').innerHTML = '<p class="check no">Too many strips: widen Δx or shorten [a, b].</p>'; return; }
    const sums = riemann(curve.poly, A.a, A.b, A.dx, A.rule); A.columns = sums.columns; A.total = sums.total; A.exact = integral(curve.poly, A.a, A.b);
    if (A.phase === 'static') { A.shown = A.columns.length; A.grow = 0; A.gather = null; A.tallies = null; A.net = null; }
    this.areaResult(); this.dirty = true;
  }
  sweep() { const A = this.area; if (!A.columns.length) return; Object.assign(A, { phase: 'sweep', start: performance.now(), shown: 0, grow: 0, gather: null, tallies: null, net: null }); this.frameArea(); this.areaResult(); }
  // Frame [a, b], the tallest strips and the stacks the strips will gather into.
  frameArea() {
    const A = this.area, v = this.view; let up = 0, down = 0, hi = 0, lo = 0;
    for (const c of A.columns) { const area = c.area ? numeric(c.area) : c.h * numeric(A.dx); if (area >= 0) up += area; else down -= area; hi = Math.max(hi, c.h); lo = Math.min(lo, c.h); }
    const x0 = Math.min(numeric(A.a), 0) - 1, x1 = numeric(A.b) + 3, y0 = Math.min(lo, -down) - 1, y1 = Math.max(hi, up) + 1;
    v.unit = Math.max(2, Math.min(90, Math.min(v.width / (x1 - x0), v.height / (y1 - y0)))); v.cx = (x0 + x1) / 2; v.cy = (y0 + y1) / 2; this.dirty = true;
  }
  areaResult() {
    const A = this.area, box = $('area-result'); if (!box) return;
    if (!A.enabled || !A.columns.length) { box.innerHTML = ''; return; }
    const shown = A.phase === 'sweep' ? A.columns.slice(0, A.shown) : A.columns;
    let pos = frac(0), neg = frac(0), exact = true;
    for (const c of shown) { if (!c.area) { exact = false; continue; } if (c.area.n > 0) pos = add(pos, c.area); else neg = add(neg, c.area); }
    const sum = exact ? add(pos, neg) : null, fmt = v => !v ? '—' : show(v).includes('/') ? `${show(v)} ≈ ${show(numeric(v))}` : show(v);
    box.innerHTML = `<table><tr><td>Strips so far</td><td>${shown.length} of ${A.columns.length}</td></tr><tr><td>Blue cards (above)</td><td>${fmt(pos)}</td></tr><tr><td>Red cards (below)</td><td>${fmt(neg)}</td></tr><tr><td><b>Strips add up to</b></td><td><b>${fmt(sum)}</b></td></tr>${A.phase === 'done' || A.phase === 'static' ? `<tr><td>Exact area ∫</td><td>${fmt(A.exact)}</td></tr><tr><td>Difference</td><td>${A.exact && A.total ? show(sub(A.total, A.exact)) : '—'}</td></tr>` : ''}</table>${A.phase === 'done' ? '<p><small>Each strip’s cards became whole cards in the stacks beside b; red cancelled blue. Thinner strips come closer to the exact area.</small></p>' : ''}`;
  }
  areaFrame(now) {
    const A = this.area; if (A.phase !== 'sweep' && A.phase !== 'gather') return;
    // rAF timestamps can precede the click that started the sweep, so time starts at zero.
    const n = A.columns.length, per = Math.max(.05, Math.min(.4, 4 / n)), t = Math.max(0, (now - A.start) / 1000);
    if (A.phase === 'sweep') {
      const k = Math.min(n, Math.floor(t / per)), grow = ease((t - k * per) / per);
      if (k !== A.shown) { A.shown = k; this.areaResult(); }
      A.grow = grow;
      if (k < n && A.columns[k]) this.place(A.curve, numeric(A.columns[k].sample), { snapRadius: 0, at: A.columns[k].sample });
      else { A.phase = 'gather'; A.start = now; A.shown = n; }
      this.dirty = true; return;
    }
    // Gather: every strip column slides beside b and becomes whole cards (area kept), blue up, red down.
    const tally = numeric(A.b) + 1.2, v = this.view, stagger = Math.min(.04, 1 / n), dur = .55;
    let up = 0, down = 0, arrivedUp = 0, arrivedDown = 0; A.gather = {};
    A.columns.forEach((c, k) => {
      const q = ease((t - k * stagger) / dur), area = c.area ? numeric(c.area) : c.h * numeric(A.dx), h = Math.abs(area);
      const from = { x: toX(v, numeric(c.left)), y: toY(v, Math.max(0, c.h)), w: numeric(A.dx) * v.unit, h: Math.abs(c.h) * v.unit };
      const base = area >= 0 ? up : down, to = { x: toX(v, tally), y: area >= 0 ? toY(v, base + h) : toY(v, -base), w: v.unit, h: h * v.unit };
      if (area >= 0) up += h; else down += h;
      if (q >= 1) { if (area >= 0) arrivedUp += h; else arrivedDown += h; A.gather[k] = { x: 0, y: 0, w: 0, h: 0, opacity: 0 }; return; }
      A.gather[k] = { x: from.x + (to.x - from.x) * q, y: from.y + (to.y - from.y) * q, w: from.w + (to.w - from.w) * q, h: from.h + (to.h - from.h) * q, opacity: 1 };
    });
    // Once everything has arrived, equal amounts of red and blue cancel, leaving the net area.
    const settle = ease((t - (n * stagger + dur + .2)) / .8), cancel = Math.min(arrivedUp, arrivedDown) * settle;
    A.tallies = [{ x: tally, sign: 1, height: arrivedUp - cancel }, { x: tally, sign: -1, height: arrivedDown - cancel }];
    A.net = settle >= 1 ? arrivedUp - arrivedDown : null;
    if (settle >= 1) { A.phase = 'done'; this.areaResult(); }
    this.dirty = true;
  }
  // ---------- frame ----------
  frame(now) {
    const dt = Math.min(.05, (now - (this.last || now)) / 1000); this.last = now;
    this.areaFrame(now);
    const t = this.tracer;
    if (t) {
      const c = this.curves[t.curve];
      if (c?.kind === 'vertical') { [t.y, t.v] = spring(t.y, t.v, t.target.y, 26, dt); t.x = t.target.x; }
      else if (c) { [t.x, t.v] = spring(t.x, t.v, t.target.x, 26, dt); t.y = Math.abs(t.x - t.target.x) < 1e-6 ? t.target.y : fx(c, t.x); }
      if (Math.abs(t.v) > .001) this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const state = { view: this.view, curves: this.curves, specials: this.specials, tracer: t && { ...t, active: this.dragging === 'tracer', label: { x: value(t.target.exact?.x, t.target.x), y: value(t.target.exact?.y, t.target.y) } }, area: this.area.enabled ? this.area : null };
    if (this.staticKey !== this.key()) { const s = renderStatic(state); this.layers['layer-back'].innerHTML = s.back; this.layers['layer-front'].innerHTML = s.front; this.staticKey = this.key(); }
    const d = renderDynamic(state);
    this.layers['dynamic-defs'].innerHTML = d.defs; this.layers['layer-area'].innerHTML = d.area; this.layers['layer-top'].innerHTML = d.tracer;
  }
  key() { const v = this.view; return [v.cx, v.cy, v.unit, v.width, v.height, this.inputs.join('|')].join(','); }
  update() { this.readout(); this.listPoints(); this.dirty = true; }
  // ---------- input ----------
  local(e) { const r = this.svg.getBoundingClientRect(); return { X: e.clientX - r.left, Y: e.clientY - r.top }; }
  nearestCurve({ X, Y }) {
    let best = null;
    this.curves.forEach((c, i) => {
      const d = c.kind === 'vertical' ? Math.abs(toX(this.view, numeric(c.x)) - X) : Math.abs(toY(this.view, fx(c, fromX(this.view, X))) - Y);
      if (d < 22 && (!best || d < best.d)) best = { i, d };
    });
    return best?.i ?? null;
  }
  bind() {
    const s = this.stage;
    s.addEventListener('pointerdown', e => {
      s.setPointerCapture(e.pointerId); const p = this.local(e); this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.dragging = 'pinch'; this.pinch = { d: Math.hypot(a.X - b.X, a.Y - b.Y), unit: this.view.unit }; return; }
      const v = this.view, A = this.area;
      if (A.enabled && A.columns) for (const h of ['a', 'b']) if (Math.abs(toX(v, numeric(A[h])) - p.X) < 14 && Math.abs(toY(v, 0) + 12 - p.Y) < 24) { this.dragging = h; return; }
      const t = this.tracer;
      if (t && Math.hypot(toX(v, t.x) - p.X, toY(v, t.y) - p.Y) < 22) { this.dragging = 'tracer'; this.dirty = true; return; }
      const i = this.nearestCurve(p);
      if (i !== null) { this.dragging = 'tracer'; const c = this.curves[i]; this.place(i, c.kind === 'vertical' ? fromY(v, p.Y) : fromX(v, p.X)); return; }
      this.dragging = 'pan'; this.panFrom = { ...p, cx: v.cx, cy: v.cy };
    });
    s.addEventListener('pointermove', e => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = this.local(e), v = this.view; this.pointers.set(e.pointerId, p);
      if (this.dragging === 'pinch' && this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.zoomAt((a.X + b.X) / 2, (a.Y + b.Y) / 2, this.pinch.unit * Math.hypot(a.X - b.X, a.Y - b.Y) / this.pinch.d / v.unit); return; }
      if (this.dragging === 'tracer' && this.tracer) { const c = this.curves[this.tracer.curve]; this.place(this.tracer.curve, c.kind === 'vertical' ? fromY(v, p.Y) : fromX(v, p.X)); }
      else if (this.dragging === 'a' || this.dragging === 'b') {
        const [s2, num, den] = STEPS.find(([st]) => st * v.unit >= 9) || STEPS.at(-1), q = frac(Math.round(fromX(v, p.X) / s2) * num, den);
        const other = this.dragging === 'a' ? this.area.b : this.area.a;
        if ((this.dragging === 'a' ? numeric(sub(other, q)) : numeric(sub(q, other))) > 0) { this.setArea({ [this.dragging]: q, phase: 'static' }); $(`area-${this.dragging}`).value = show(q).replace('−', '-'); }
      }
      else if (this.dragging === 'pan') { v.cx = this.panFrom.cx - (p.X - this.panFrom.X) / v.unit; v.cy = this.panFrom.cy + (p.Y - this.panFrom.Y) / v.unit; this.dirty = true; }
    });
    const end = e => { this.pointers.delete(e.pointerId); if (!this.pointers.size) { this.dragging = null; this.dirty = true; } };
    s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end);
    s.addEventListener('wheel', e => { e.preventDefault(); const p = this.local(e); this.zoomAt(p.X, p.Y, Math.exp(-e.deltaY * .0015)); }, { passive: false });
    s.addEventListener('keydown', e => {
      const t = this.tracer, v = this.view;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && t) {
        e.preventDefault(); const c = this.curves[t.curve], [st] = STEPS.find(([s]) => s * v.unit >= 9) || STEPS.at(-1), dir = ['ArrowLeft', 'ArrowDown'].includes(e.key) ? -1 : 1;
        this.place(t.curve, (c.kind === 'vertical' ? t.target.y : t.target.x) + dir * st * (e.shiftKey ? 10 : 1), { snapRadius: 0 });
      }
      if (e.key === '+' || e.key === '=') this.zoomAt(v.width / 2, v.height / 2, 1.25);
      if (e.key === '-') this.zoomAt(v.width / 2, v.height / 2, .8);
    });
    $('graph-add').onclick = () => { if (this.inputs.length < 3) { this.inputs.push(this.inputs.length === 1 ? 'y = -x + 5' : 'y = 2'); this.setEquations(this.inputs, { fit: false }); this.fit(); } };
    $('graph-examples').onchange = e => { const ex = examples[Number(e.target.value)]; if (ex) this.setEquations(ex.equations); e.target.value = ''; };
    $('graph-solve').onclick = () => this.solve();
    $('graph-fit').onclick = () => this.fit();
    $('graph-from-cards').onclick = () => this.fromCards();
    $('graph-area-toggle').onchange = e => { $('graph-area').hidden = !e.target.checked; this.setArea({ enabled: e.target.checked, phase: 'static' }); if (e.target.checked) this.fitArea(); };
    const scalar = text => parseScalar(text.replace(/−/g, '-'));
    for (const h of ['a', 'b']) $(`area-${h}`).onchange = e => { try { const q = scalar(e.target.value); this.setArea({ [h]: q, phase: 'static' }); } catch (err) { $('area-result').innerHTML = `<p class="check no">${esc(err.message)}</p>`; } };
    $('area-dx').onchange = e => this.setArea({ dx: scalar(e.target.value), phase: 'static' });
    $('area-rule').onchange = e => this.setArea({ rule: e.target.value, phase: 'static' });
    $('area-sweep').onclick = () => this.sweep();
    $('area-finer').onclick = () => { const select = $('area-dx'); if (select.selectedIndex < select.options.length - 1) select.selectedIndex++; this.setArea({ dx: scalar(select.value), phase: 'static' }); this.sweep(); };
  }
  // Keep room right of b for the stacks the strips gather into.
  fitArea() { const v = this.view, right = numeric(this.area.b) + 3; if (toX(v, right) > v.width) v.cx += right - fromX(v, v.width); this.dirty = true; }
  zoomAt(X, Y, factor) {
    const v = this.view, gx = fromX(v, X), gy = fromY(v, Y);
    v.unit = Math.max(2, Math.min(400, v.unit * factor));
    v.cx = gx - (X - v.width / 2) / v.unit; v.cy = gy + (Y - v.height / 2) / v.unit; this.dirty = true;
  }
}
