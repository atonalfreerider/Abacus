// planMachine: a machine tree and its inputs → a Plan, pure BigInt-exact data. It parses,
// evaluates the whole tree exactly first (so a zero divisor anywhere is caught on its block
// before anything moves), checks the limits, and then plays the run: INPUT, DELIVER, FANOUT,
// every node depth-first, left first (each ending in its RETURN), and OUTPUT. A node's work
// comes from its base's planners through the registry.
import './bt-base.js';
import {getBase, hasBase} from './registry.js';
import {PlanBuilder, LimitError} from './builder.js';
import {caption, BLOCKS} from './captions.js';
import {socketsOf, rootOf, childAt, openSockets, parseInput, evaluateNodes, QUOTIENT_OPS, BASE_NAMES, takes} from './tree.js';
import {RADIX, fmt, digits, divTrunc, divRound, signOf} from './bigmath.js';
import {evaluate as oracle} from './oracle.js';
import {GATES, complementIn, complementOut, lampOf} from './ops/logic.js';
import {COUNT_OPS, expandCount, powerValue} from './ops/shift.js';

// Section 6.10. Typed inputs past `input` are refused at Enter; a tower past `levels` (the
// lamp not counted), more than `nodes` nodes or `beats` beats make the run tooBig, and the
// exact answer is shown without animation.
export const LIMITS = {
  binary: {input: (1n << 63n) - 1n, levels: 64, shr: 63},
  ternary: {input: (3n ** 40n - 1n) / 2n, levels: 41, shr: 40},
  e: {top: 20, floor: -3, rail: -14, perLevel: 6, mule: [-6, 12], splitBulbs: 6, terms: 6, exponents: [-6, 12], precisionBits: 8192},
  blocks: 24, inputs: 8, nodes: 256, softBeats: 400, beats: 2000, frameBulbs: 1500, coinPx: 12,
};
export const TOO_BIG = 'Too big to animate step by step; here is the exact answer.';
const EMPTY = 'Hang a block under the triangle first: drag one from the palette, or tap the triangle\'s socket and then a block';
const fail = (reason, message, extra = {}) => ({ok: false, reason, message, ...extra});
const abs = v => v < 0n ? -v : v;

export function planMachine({tree, inputs, base, pace = 'together'}) {
  if (!hasBase(base)) return fail('input', `base ${base} is not loaded`);
  const spec = getBase(base);
  // 1. parse and arity
  let values;
  if (typeof inputs === 'string') {
    const r = parseInput(inputs, base); if (!r.ok) return fail('input', r.error); values = r.values;
  } else {
    values = [];
    for (const x of inputs ?? []) { const r = spec.parseValue(String(x)); if (!r.ok) return fail('input', r.error); values.push(r.value); }
  }
  for (const v of values) { const m = spec.checkLimits(v); if (m) return fail('input', m); }
  tree = tree ?? {};
  const ids = Object.keys(tree), root = rootOf(tree);
  if (!root) return fail('arity', EMPTY);
  for (const id of ids) if (!spec.palette.includes(tree[id].op)) return fail('input', `${BASE_NAMES[base] ?? base} has no ${BLOCKS[tree[id].op] ?? tree[id].op}.`, {node: id});
  const open = openSockets(tree).length;
  if (values.length !== open) return fail('arity', takes(open));
  // 2. the exact pre-check
  const pre = evaluateNodes(tree, values, base);
  if (!pre.ok) return fail(pre.reason, pre.message, pre.node ? {node: pre.node} : {});
  const result = {values: pre.values, text: pre.text};
  if (QUOTIENT_OPS.includes(tree[root].op)) result.label = `q ${fmt(pre.values[0])} · r ${fmt(pre.values[1])}`;
  // 3. limits on the machine and on computed values
  if (ids.length > LIMITS.blocks || values.length > LIMITS.inputs || tooTall(tree, pre, base)) return fail('tooBig', TOO_BIG, {result});
  // 4. the run; level pace that overflows first retries together
  try { return {ok: true, plan: build(tree, values, base, pace)}; }
  catch (e) {
    if (!(e instanceof LimitError)) throw e;
    if (pace === 'level') return planMachine({tree, inputs: values, base, pace: 'together'});
    return fail('tooBig', TOO_BIG, {result});
  }
}
// Any computed value or shift past the tower cap is refused before planning.
function tooTall(tree, pre, base) {
  const cap = LIMITS[base]?.levels; if (!cap) return false;
  const levels = v => digits(v, base).length + 1;   // +1: a lamp form may need one more bit
  for (const [id, {args, values}] of Object.entries(pre.nodes)) {
    const op = tree[id].op;
    if (op === 'shl' && Number(args[1]) + 1 > cap) return true;
    if (op === 'shr' && Number(args[1]) > LIMITS[base].shr) return true;
    if ([...args, ...values].some(v => levels(v) > cap + 1)) return true;
  }
  return false;
}

const LIMITED = base => ({levels: LIMITS[base]?.levels ?? Infinity, nodes: LIMITS.nodes, beats: LIMITS.beats});
const towerAt = (scene, place) => Object.keys(scene.towers).find(t => scene.towers[t].at === place && !scene.towers[t].ghost);
function build(tree, values, base, pace) {
  const spec = getBase(base), b = new PlanBuilder({base, tree, inputs: values, pace, limits: LIMITED(base)});
  const root = rootOf(tree), rootOp = tree[root].op, inputs = Object.keys(b.scene.towers);
  const texts = inputs.map(t => b.scene.towers[t].text);
  b.begin('input', 'io', {caption: caption.input(texts), ledger: {law: 'move'}});
  inputs.forEach((t, i) => b.tower(t, {at: `io:${i}`}));
  b.end();
  b.begin('deliver', root, {caption: caption.deliver(texts, rootOp), ledger: {law: 'move'}});
  inputs.forEach((t, i) => b.tower(t, {at: `${root}.C:${i}`}));
  b.end();
  // FANOUT: each number rides to its open socket and stands up; a shift's count expands
  // into the tower b^k, and a base-e light stays a light only where a ruler reads it.
  const sockets = openSockets(tree), items = [];
  let power = null;
  b.begin('fanout', root, {ledger: {law: 'move'}});
  inputs.forEach((t, i) => {
    const [node, s] = sockets[i].split('.'), op = b.scene.nodes[node].op, text = b.scene.towers[t].text;
    b.tower(t, b.scene.towers[t].form === 'coin' ? {at: sockets[i], form: 'tower'} : {at: sockets[i]});
    if (COUNT_OPS[op] && s === 'R') {
      const {k, power: out} = expandCount(b, node, t);
      power ??= {law: 'power', k, out};
      items.push({text, count: text, note: b.scene.towers[t].note});
    } else {
      spec.place(b, t, b.scene.towers[t].value, {asLight: op === 'measure' || op === 'ln'});
      const tw = b.scene.towers[t];
      items.push({text, reading: tw.form === 'light' ? spec.display(tw.value, {form: 'light'}).reading : undefined});
    }
  });
  b.describe({caption: caption.fanout(items), ledger: power ?? {law: 'move'}});
  b.end();
  solve(b, root);
  // OUTPUT: what stands in the triangle rides to the Output pill as coins
  const outs = Object.keys(b.scene.towers).filter(t => /^io:\d+$/.test(b.scene.towers[t].at))
    .sort((x, y) => Number(b.scene.towers[x].at.slice(3)) - Number(b.scene.towers[y].at.slice(3)));
  const shown = outs.map(t => b.scene.towers[t].reading ?? b.scene.towers[t].text), text = `[${shown.join(', ')}]`;
  const result = {values: outs.map(t => b.scene.towers[t].value), text};
  if (QUOTIENT_OPS.includes(rootOp) && outs.length === 2) result.label = `q ${fmt(result.values[0])} · r ${fmt(result.values[1])}`;
  b.begin('output', 'io', {caption: caption.output(text), ledger: {law: 'move', value: result.values[0]}});
  outs.forEach((t, i) => b.tower(t, {at: `out:${i}`, form: 'coin'}));
  b.end();
  return b.finish(result);
}
// Depth-first, left first. A node whose op rewrites it in place (MULT's split) answers
// {result: null} and is solved again; any other answers {result, other?} and returns.
function solve(b, id) {
  const spec = getBase(b.base);
  for (;;) {
    const node = b.scene.nodes[id], sockets = socketsOf(node.op);
    for (const s of sockets) { const child = childAt(b.scene.nodes, id, s); if (child) solve(b, child); }
    const towers = sockets.map(s => towerAt(b.scene, `${id}.${s}`));
    if (b.base === 'binary') convert(b, id, node.op, towers);
    const out = spec.ops[node.op](b, id, towers);
    if (out?.result) return finish(b, id, out);
  }
}
// Gate sockets take lamp form: a red operand enters by COMPLEMENT. Arithmetic sockets take
// sign-magnitude: a lit-lamp operand converts back (a dark lamp already faded in its RETURN).
function convert(b, id, op, towers) {
  const gate = GATES.includes(op);
  for (const t of towers) {
    const lamp = lampOf(b, t);
    if (gate && !lamp && b.valueOf(t) < 0n) complementIn(b, id, t);
    else if (!gate && lamp?.s) complementOut(b, id, t);
  }
}
// RETURN: the result rides up the wire into the parent socket (both towers of a root DIV,
// MOD or SHR ride into the triangle), the node vanishes, anything left at it fades, and the
// quotient register's leading darks fade as it rides.
function finish(b, id, {result, other}) {
  const node = b.scene.nodes[id], root = node.parent === 'io', op = node.op, parent = root ? null : b.scene.nodes[node.parent];
  const quotient = QUOTIENT_OPS.includes(op) && other;
  const [qT, rT] = quotient ? (op === 'mod' ? [other, result] : [result, other]) : [];
  let ledger, text;
  if (quotient) {
    const q = b.valueOf(qT), r = b.valueOf(rT), arg = BigInt(node.arg);
    ledger = {law: 'quotient', a: String(q * arg + r), b: node.arg, q: String(q), r: String(r)};
    text = caption.quotientReturn(q, r, {root, mod: op === 'mod'});
  } else {
    const t = b.scene.towers[result];
    ledger = {law: 'move', value: t.value};
    text = caption.ret(t.reading ?? t.text, root);
  }
  b.begin('return', id, {caption: text, ledger});
  b.dropNode(id);
  const up = root && quotient ? [[qT, 'io:0'], [rT, 'io:1']] : [[result, root ? 'io:0' : `${node.parent}.${node.socket}`]];
  for (const [t, place] of up) {
    const fromQ = /\.Q$/.test(b.scene.towers[t].at);
    b.tower(t, {at: place, note: null});
    if (fromQ) {
      const col = b.bulbsOf(t);
      for (let l = col.length - 1; l > 0 && !col[l][1].s; l--) b.drop(col[l][0], {fade: [0, 0.6]});
    }
  }
  for (const t of Object.keys(b.scene.towers)) if (b.scene.towers[t].at.startsWith(`${id}.`)) b.dropTower(t);
  if (!root && b.base === 'binary' && !GATES.includes(parent.op)) {
    const lamp = lampOf(b, result);
    if (lamp && !lamp.s) b.drop(lamp.id, {fade: [0, 0.6]});
  }
  if (!root && COUNT_OPS[parent.op] && node.socket === 'R') expandCount(b, node.parent, result);
  b.end();
}

// ── evaluateScene ───────────────────────────────────────────────
// The exact value of the machine at a beat boundary: the tree read with the towers in its
// sockets and the inputs still in flight filling the open ones. A spent node (glyph 0, or a
// two-socket node with a tower at its centre) is its result tower; DIV and MOD in progress
// are Q + R/arg; a shift's count is a count until it expands, then the multiplier `arg`.
const gcd = (a, b) => { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; };
const Q = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return {n: n / g, d: d / g}; };
const isQ = x => typeof x === 'object';
const qadd = (x, y) => Q(x.n * y.d + y.n * x.d, x.d * y.d), qmul = (x, y) => Q(x.n * y.n, x.d * y.d), qdiv = (x, y) => Q(x.n * y.d, x.d * y.n);
const qstr = x => isQ(x) ? (x.d === 1n ? String(x.n) : `${x.n}/${x.d}`) : x;
// Free towers (the Input, the triangle, Output and coins riding a wire) sort by their slot.
const freeSlot = at => {
  const k = at.lastIndexOf(':'); if (k < 0) return -1;
  const head = at.slice(0, k);
  return head === 'in' || head === 'io' || head === 'out' || head.endsWith('.C') ? Number(at.slice(k + 1)) : -1;
};
export function evaluateScene(scene, base) {
  const spec = getBase(base), radix = RADIX[base], at = new Map(), free = [], kids = new Map();
  let root = null;
  for (const id in scene.towers) {
    const t = scene.towers[id]; if (t.ghost) continue;
    at.set(t.at, t);
    if (freeSlot(t.at) >= 0) free.push(t);
  }
  free.sort((x, y) => freeSlot(x.at) - freeSlot(y.at));
  for (const id in scene.nodes) { const n = scene.nodes[id]; if (n.parent === 'io') root = id; else kids.set(`${n.parent}.${n.socket}`, id); }
  const nodes = scene.nodes;
  if (!root) return free.map(t => t.value);
  const coins = free.filter(t => !t.at.startsWith('out:'));
  let next = 0;
  const lift = v => radix ? {n: BigInt(v), d: 1n} : v;
  const symbolic = (op, args) => `${op}(${args.map(qstr).join(', ')})`;
  const operand = (id, s) => {
    const c = kids.get(`${id}.${s}`); if (c) return value(c);
    const t = at.get(`${id}.${s}`) ?? coins[next++];
    return t ? lift(t.value) : '?';
  };
  const value = id => {
    const node = nodes[id], op = node.op, C = at.get(`${id}.C`), sockets = socketsOf(op);
    if (radix && QUOTIENT_OPS.includes(op)) {
      const R = at.get(`${id}.Q`) ? at.get(`${id}.Q`) : null;
      if (R) return qadd(lift(R.value), qdiv(lift(at.get(`${id}.L`).value), lift(node.arg)));
      if (op === 'shr' && node.glyph === 0) return qadd(lift(at.get(`${id}.L`).value), qdiv(lift(at.get(`${id}.R`).value), lift(node.arg)));
      const [a, d] = sockets.map(s => operand(id, s));
      if (!isQ(a) || !isQ(d)) return symbolic(op, [a, d]);
      const divisor = op !== 'shr' ? d : node.arg ? lift(node.arg) : Q(radix ** d.n);
      return divisor.n === 0n ? symbolic(op, [a, d]) : qdiv(a, divisor);
    }
    if (C && (node.glyph === 0 || sockets.length === 2)) return lift(C.value);
    const args = sockets.map(s => operand(id, s));
    if (COUNT_OPS[op]) {
      const m = node.arg ? lift(node.arg) : radix ? (isQ(args[1]) ? Q(radix ** args[1].n) : null) : powerValue(base, Number(args[1]));
      if (radix) return m && isQ(args[0]) ? qmul(args[0], m) : symbolic(op, args);
      const r = spec.evaluate('mul', [args[0], m]);
      return r.ok ? r.values[0] : symbolic(op, args);
    }
    if (radix) {
      if (!args.every(x => isQ(x) && x.d === 1n)) {
        if (args.every(isQ) && op === 'add') return qadd(...args);
        if (args.every(isQ) && op === 'sub') return qadd(args[0], Q(-args[1].n, args[1].d));
        if (args.every(isQ) && op === 'mul') return qmul(...args);
        return symbolic(op, args);
      }
      const r = oracle(op, base, args.map(x => x.n));
      return r.error ? symbolic(op, args) : Q(r.value);
    }
    const r = spec.evaluate(op, args);
    return r.ok ? r.values[0] : symbolic(op, args);
  };
  return [qstr(value(root))];
}

// ── validatePlan ────────────────────────────────────────────────
const FLOW = ['input', 'deliver', 'fanout', 'return', 'output'];
const E_KINDS = ['pile', 'legal', 'fold', 'unfold', 'slide', 'meet', 'race', 'read'];
const VALUE_LAWS = ['quotient', 'compare', 'gate', 'complement', 'read'];
// Every invariant of 6.9 at every beat end: 'beat 7 I3: tower t2 has a leading dark bulb'.
// The scene is advanced in place (scenes are pure data, so this equals applyDiff), keeping
// only the S_i entries a beat replaces; I7 reads facts collected on the way.
export function validatePlan(plan) {
  const errs = [], base = plan.base;
  if (!hasBase(base)) return [`base ${base} is not loaded`];
  const spec = getBase(base), KINDS = ['nodes', 'towers', 'bulbs'];
  const scene = {nodes: {...plan.start.nodes}, towers: {...plan.start.towers}, bulbs: {...plan.start.bulbs}};
  const members = new Map(), join = (id, x) => { let s = members.get(x.t); if (!s) members.set(x.t, s = new Set()); s.add(id); };
  for (const id in scene.bulbs) join(id, scene.bulbs[id]);
  const listOf = t => { const out = []; for (const id of members.get(t) ?? []) out.push([id, scene.bulbs[id]]); return out; };
  for (const t in scene.towers) for (const e of spec.validateTower(scene, t, listOf(t))) errs.push(`start ${e}`);
  const seen = {nodes: new Set(Object.keys(scene.nodes)), towers: new Set(Object.keys(scene.towers)), bulbs: new Set(Object.keys(scene.bulbs))};
  const facts = {first: new Map(), work: new Map(), collide: new Map()};
  let value = evaluateScene(scene, base).join(' | ');
  plan.beats.forEach((beat, i) => {
    const err = (inv, msg) => errs.push(`beat ${i} ${inv}: ${msg}`);
    if (beat.i !== i) err('I6', `the beat is numbered ${beat.i}`);
    if (!['input', 'deliver', 'fanout', 'output'].includes(beat.kind) && scene.nodes[beat.node]) {
      if (!facts.first.has(beat.node)) facts.first.set(beat.node, {i, ...operandsOf(scene, beat.node, listOf)});
      if (!facts.work.has(beat.node) && !['flip', 'addone'].includes(beat.kind)) facts.work.set(beat.node, {i, ...operandsOf(scene, beat.node, listOf)});
    }
    const set = beat.set ?? {}, old = {nodes: {}, towers: {}, bulbs: {}};
    for (const kind of KINDS) for (const id in set[kind] ?? {}) {
      const p = set[kind][id], was = scene[kind][id];
      old[kind][id] = was;
      if (p === null) delete scene[kind][id];
      else { const next = was ? {...was, ...p} : {...p}; for (const f in p) if (p[f] === null) delete next[f]; scene[kind][id] = next; }
      if (kind === 'bulbs') { if (was) members.get(was.t)?.delete(id); if (p !== null) join(id, scene.bulbs[id]); }
    }
    const before = (kind, id) => id in old[kind] ? old[kind][id] : scene[kind][id];
    // I8
    if (typeof beat.caption !== 'string' || !beat.caption.trim()) err('I8', 'the caption is empty');
    else if (beat.caption.length > 110) err('I8', `the caption has ${beat.caption.length} characters`);
    const dur = beat.dur ?? 1;
    if (!(dur === 1 || dur === 0.5 && beat.kind === 'carry')) err('I8', `a ${beat.kind} beat lasts ${dur}`);
    // I6: ids are never reused; from/to name towers that exist
    for (const kind of KINDS) for (const id in set[kind] ?? {}) {
      if (set[kind][id] === null || old[kind][id]) continue;
      if (seen[kind].has(id)) err('I6', `${id} is reused`);
      seen[kind].add(id);
    }
    for (const [id, m] of Object.entries(beat.motion ?? {})) {
      if (m.from && !before('towers', m.from.t)) err('I6', `bulb ${id} comes from tower ${m.from.t}, which is not there`);
      if (m.to && !scene.towers[m.to.t]) err('I6', `bulb ${id} goes to tower ${m.to.t}, which is not there`);
    }
    // I2, I3: every tower the beat touched
    const touched = new Set(Object.keys(set.towers ?? {}));
    for (const id in set.bulbs ?? {}) { if (old.bulbs[id]) touched.add(old.bulbs[id].t); if (scene.bulbs[id]) touched.add(scene.bulbs[id].t); }
    for (const t of touched) if (scene.towers[t]) for (const e of spec.validateTower(scene, t, listOf(t))) errs.push(`beat ${i} ${e}`);
    // I1
    const after = evaluateScene(scene, base).join(' | '), law = beat.ledger?.law;
    if (after !== value && !VALUE_LAWS.includes(law) && !(law === 'power' && beat.kind === 'fanout')) err('I1', `the machine's value changed from ${value} to ${after}`);
    value = after;
    for (const e of ledgerErrors(beat.ledger, base)) err('I4', e);
    for (const e of motionErrors(beat, old.bulbs, scene, base)) err('I5', e);
    if (beat.kind === 'collide') facts.collide.set(i, ['C', 'L'].map(s => {
      const t = Object.keys(scene.towers).find(x => scene.towers[x].at === `${beat.node}.${s}`);
      return {owed: t ? listOf(t).filter(([, x]) => x.o).length : 0, pending: !!scene.towers[t]?.pending};
    }));
  });
  const last = plan.beats.length - 1;
  for (const [id, t] of Object.entries(scene.towers)) if (!/^out:\d+$/.test(t.at)) errs.push(`beat ${last} I6: tower ${id} is left at ${t.at}`);
  for (const id of Object.keys(scene.nodes)) errs.push(`beat ${last} I6: node ${id} is left`);
  if (RADIX[base]) errs.push(...countErrors(plan, facts));
  return errs;
}
// A node's op and the towers in its sockets (value, and the lamp's state when it has one).
function operandsOf(scene, id, listOf) {
  const node = scene.nodes[id], ops = {};
  for (const s of socketsOf(node.op)) {
    const t = Object.keys(scene.towers).find(x => scene.towers[x].at === `${id}.${s}` && !scene.towers[x].ghost);
    if (!t) continue;
    let lamp = null;
    for (const [, x] of listOf(t)) if (x.k === 'lamp') lamp = x.s;
    ops[s] = {value: scene.towers[t].value, lamp};
  }
  return {op: node.op, operands: ops};
}
const isPower = (v, radix) => { v = abs(v); if (v === 0n) return false; while (v % radix === 0n) v /= radix; return v === 1n; };
function ledgerErrors(L, base) {
  if (!L || typeof L.law !== 'string') return ['the beat has no ledger'];
  const radix = RADIX[base], out = [], B = BigInt;
  if (!radix) {
    // base e: the laws that are plain arithmetic, checked through the registry
    const ev = (op, args) => { const r = getBase(base).evaluate(op, args); return r.ok ? r.values[0] : null; };
    if (L.law === 'sum' && ev('add', [L.a, L.b]) !== L.out) out.push(`sum: ${L.a} + ${L.b} is not ${L.out}`);
    if (L.law === 'shift' && ev('mul', [L.a, L.m]) !== L.out) out.push(`shift: ${L.a} × ${L.m} is not ${L.out}`);
    if (L.law === 'zero' && (L.out !== '0' || L.a !== '0' && L.b !== '0')) out.push('zero: no zero operand');
    return out;
  }
  try {
    switch (L.law) {
      case 'move': case 'regroup': break;
      case 'split': if (B(L.b) !== B(L.t) + B(L.r)) out.push(`split: ${L.b} ≠ ${L.t} + ${L.r}`); if (!isPower(B(L.t), radix)) out.push(`split: ${L.t} is not one digit`); break;
      case 'shift':
        if (B(L.out) !== B(L.a) * B(L.m)) out.push(`shift: ${L.a} × ${L.m} ≠ ${L.out}`);
        if (abs(B(L.m)) !== radix ** B(L.k) || signOf(B(L.m)) !== L.sign) out.push(`shift: ${L.m} is not ${L.sign < 0 ? '−' : ''}${radix}^${L.k}`);
        break;
      case 'zero': if (B(L.out) !== 0n || B(L.a) !== 0n && B(L.b) !== 0n) out.push('zero: no zero operand'); break;
      case 'sum': if (B(L.out) !== B(L.a) + B(L.b)) out.push(`sum: ${L.a} + ${L.b} ≠ ${L.out}`); break;
      case 'negate': if (B(L.out) !== -B(L.a)) out.push(`negate: −${L.a} ≠ ${L.out}`); break;
      case 'power': if (B(L.out) !== radix ** B(L.k)) out.push(`power: ${radix}^${L.k} ≠ ${L.out}`); break;
      case 'gate': { const r = oracle(L.op, base, L.b === undefined ? [B(L.a)] : [B(L.a), B(L.b)]); if (r.error || r.value !== B(L.out)) out.push(`gate: ${L.op} gives ${r.value}, not ${L.out}`); break; }
      case 'complement': if (abs(B(L.out) - B(L.a)) !== 1n) out.push(`complement: ${L.a} → ${L.out} is not one step`); break;
      case 'compare': if (B(L.out) !== B(signOf(B(L.a) - B(L.b)))) out.push(`compare: sign(${L.a} − ${L.b}) ≠ ${L.out}`); break;
      case 'divstep': if (B(L.a) !== B(L.q) * B(L.b) + B(L.r)) out.push(`divstep: ${L.a} ≠ ${L.q}·${L.b} + ${L.r}`); break;
      case 'quotient': {
        const {q, r} = (base === 'binary' ? divTrunc : divRound)(B(L.a), B(L.b));
        if (q !== B(L.q) || r !== B(L.r)) out.push(`quotient: ${L.a} ÷ ${L.b} is ${q} r ${r}, not ${L.q} r ${L.r}`);
        break;
      }
      default: out.push(`unknown law ${L.law}`);
    }
  } catch (e) { out.push(`${L.law}: ${e.message}`); }
  return out;
}
// I5: what each kind of beat may do to a bulb's level (S holds the S_i entries of the bulbs
// the beat changed, N is S_{i+1}).
function motionErrors(beat, S, N, base) {
  const kind = beat.kind, out = [], motion = beat.motion ?? {};
  if (E_KINDS.includes(kind)) return base === 'e' || kind === 'read' ? out : [`${kind} happens only in base e`];
  const radix = RADIX[base];
  const k = kind === 'shift' || kind === 'prep' ? beat.ledger?.k : kind === 'drop' && radix ? digits(BigInt(beat.ledger.b), base).length - 1 : null;
  let movers = 0;
  for (const id of Object.keys(beat.set?.bulbs ?? {})) {
    const o = S[id], n = N.bulbs[id], m = motion[id] ?? {};
    if (!o || o.k === 'light' || n?.k === 'light') continue;
    const dl = n ? n.l - o.l : m.to ? m.to.l - o.l : 0, lamp = o.k === 'lamp';
    if (!dl) continue;
    const bad = () => out.push(`a ${kind} beat moves bulb ${id} by ${dl} levels`);
    if (FLOW.includes(kind)) bad();
    else if (['collide', 'carry', 'gate', 'addone'].includes(kind)) {
      if (lamp) continue;
      if (dl === 0.5 && n === undefined && (kind === 'gate')) continue;
      if (dl !== 1) { bad(); continue; }
      const flight = m.via ? m.via.s : o.s;
      if (!flight) out.push(`bulb ${id} climbs dark`);
    } else if (kind === 'shift' || kind === 'prep') { if (dl !== k) bad(); }
    else if (kind === 'drop') { if (dl !== -k) bad(); }
    else if (kind === 'zero') { if (!(m.to && m.to.l === 0)) bad(); }
    else if (kind === 'borrow') { if (dl > 0 || ++movers > 1) bad(); }
    else if (kind === 'descend') { if (dl !== -1) bad(); }
    else if (!(lamp && kind === 'flip')) bad();
  }
  return out;
}
// I7: each node's beats, case by case, and MULT's 5·nz(B) − 3.
function countErrors(plan, facts) {
  const errs = [], byNode = new Map(), beats = plan.beats, binary = plan.base === 'binary';
  beats.forEach((beat, i) => {
    if (['input', 'deliver', 'fanout', 'output'].includes(beat.kind)) return;
    let list = byNode.get(beat.node); if (!list) byNode.set(beat.node, list = []); list.push(i);
  });
  for (const [id, list] of byNode) {
    const first = facts.first.get(id), err = msg => errs.push(`beat ${list[0]} I7: node ${id} ${msg}`);
    if (!first) { err('works before it exists'); continue; }
    const node = {op: first.op}, kinds = list.map(i => beats[i].kind);
    // lamp conversions: two beats per operand that changes form
    let expected = 0;
    if (binary) for (const {value, lamp} of Object.values(first.operands)) {
      if (GATES.includes(node.op) ? lamp === null && BigInt(value) < 0n : !!lamp) expected++;
    }
    let c = 0;
    while (kinds[2 * c] === 'flip' && kinds[2 * c + 1] === 'addone' && c < expected) c++;
    if (c !== expected) err(`converts ${c} operands, not ${expected}`);
    const rest = kinds.slice(2 * c), seq = rest.join(' '), at = list.slice(2 * c);
    const pattern = {
      mul: /^((zero|shift) return|split collide( carry)*( borrow)* return)$/, add: /^collide( carry)*( borrow)* return$/,
      sub: /^negate collide( carry)*( borrow)* return$/, cmp: /^compare return$/, shl: /^(shift|zero) return$/, shr: /^drop return$/,
      not: /^flip return$/, neg: /^negate return$/,
      div: binary ? /^prep( compare( collide( borrow)*)?( descend)?)+ return$/ : /^prep( (try judge|clear)( descend)?)* return$/,
    }[['and', 'or', 'xor', 'min', 'max', 'sum', 'cons'].includes(node.op) ? 'gate' : node.op === 'mod' ? 'div' : node.op] ?? /^gate return$/;
    if (!pattern.test(seq)) { err(`plays "${seq}"`); continue; }
    // borrows follow each collide, one per owed bulb
    rest.forEach((kind, n) => {
      if (kind !== 'collide') return;
      let borrows = 0; while (rest[n + 1 + borrows] === 'borrow') borrows++;
      const {owed, pending} = facts.collide.get(at[n])[['div', 'mod'].includes(node.op) ? 1 : 0];
      if (owed !== borrows) err(`has ${owed} owed bulbs but ${borrows} borrows`);
      let carries = 0; while (rest[n + 1 + carries] === 'carry') carries++;
      if (carries && (plan.pace !== 'level' || !pending)) err('plays carry beats without a pending tower');
      if (!carries && pending) err('leaves a tower pending');
    });
    if (['div', 'mod'].includes(node.op)) {
      const K = beats[at[0]].ledger.k, rounds = rest.filter(x => x === (binary ? 'compare' : 'try')).length;
      if (rounds !== K + 1 && !rest.includes('clear')) err(`plays ${rounds} rounds, not ${K + 1}`);
      if (rounds > K + 1) err(`plays ${rounds} rounds, more than ${K + 1}`);
    }
  }
  // MULT: 5·nz(B) − 3 beats between FANOUT and OUTPUT, or 2 with a zero (carry beats extra)
  for (const [id, node] of Object.entries(plan.tree)) {
    if (node.op !== 'mul' || !byNode.has(id)) continue;
    const family = new Set([id]);
    beats.forEach(beat => { if (beat.kind === 'split' && family.has(beat.node)) for (const [n, p] of Object.entries(beat.set.nodes ?? {})) if (p?.parent) family.add(n); });
    const mine = beats.filter(beat => family.has(beat.node) && !['carry', 'flip', 'addone', 'input', 'deliver', 'fanout', 'output'].includes(beat.kind));
    const work = facts.work.get(id), A = work?.operands.L, B = work?.operands.R;
    if (!A || !B) continue;
    const nz = [...digits(BigInt(B.value), plan.base)].filter(Boolean).length;
    const want = BigInt(A.value) === 0n || BigInt(B.value) === 0n ? 2 : 5 * nz - 3;
    if (mine.length !== want) errs.push(`beat ${work.i} I7: MULT ${id} plays ${mine.length} beats, not ${want}`);
  }
  return errs;
}
