import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { E, sign, compare, greedy, isLegalNumeral, approx, height, lnText, digitsText, top, ln, foldHeight, meetHeight, PrecisionError } from '../src/machine/e-exact.js';
import { eSpec, unfoldPlan, readingOf, validateTower, evaluate, parseValue, display, checkLimits } from '../src/machine/ops/e.js';
import { digitsOf } from '../src/mvc/bases.js';
import '../src/machine/e-base.js';
import { PlanBuilder } from '../src/machine/builder.js';
import { planMachine, validatePlan } from '../src/machine/plan.js';
import { applyDiff } from '../src/machine/scene.js';
import { evaluateTree, openSockets, ARITY } from '../src/machine/tree.js';

const here = p => new URL(p, import.meta.url);
const fixtures = here('fixtures/machine/');
// mulberry32: a seeded generator whose low bits are as random as its high ones (an LCG in
// float arithmetic loses them past 2^53, so rand(2) would always be 0).
let seed = 20261021;
const rand = k => { seed = (seed + 0x6D2B79F5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * k); };
const digitString = (g, from) => [...g.digits.keys()].sort((a, b) => b - a).filter(k => k <= from).map(k => g.digits.get(k)).join('');

// The planner around the base-e ops is engineer A's: base e registers itself with A's
// registry, and every plan here comes from A's planMachine and is checked by validatePlan.
const one = op => ({ n1: { op, parent: 'io', socket: 'C' } });
function plan(op, inputs, pace = 'together') {
  const r = planMachine({ tree: typeof op === 'string' ? one(op) : op, inputs, base: 'e', pace });
  assert.ok(r.ok, `${JSON.stringify(inputs)}: ${r.message}`);
  return r.plan;
}
const scenesOf = p => { const out = [p.start]; for (const bt of p.beats) out.push(applyDiff(out.at(-1), bt.set)); return out; };
const last = p => scenesOf(p).at(-1);
const kinds = p => p.beats.map(bt => bt.kind);
const opBeats = p => p.beats.filter(bt => !['input', 'deliver', 'fanout', 'return', 'output'].includes(bt.kind));
const towerBulbs = (scene, t) => Object.values(scene.bulbs).filter(q => q.t === t);
// Every base-e plan passes validatePlan (6.9), survives a JSON round trip, and writes its
// captions with U+2212, never an ASCII hyphen (6.2).
function check(p) {
  assert.deepEqual(validatePlan(p), [], 'validatePlan');
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p, 'a plan survives a JSON round trip');
  for (const bt of p.beats) assert.ok(!bt.caption.includes('-'), `beat ${bt.i} writes a hyphen for a minus: ${bt.caption}`);
}

// ---------------------------------------------------------------------------------------
test('E arithmetic is exact and its keys are canonical', () => {
  for (const [text, key] of [['e^2+2', 'e^2+2'], ['2e + 2', '2e+2'], ['3 − e', '3-e'], ['-e+3', '3-e'], ['1/3', '1/3'], ['e^-1', 'e^-1'], ['e⁻¹', 'e^-1'],
    ['2*e', '2e'], ['e²+e²', '2e^2'], ['(1/3)e', 'e/3'], ['2e/3 + 1/3', '2e/3+1/3'], ['1/10^6', '1/1000000'], ['2.5', '5/2'], ['e^(−2)', 'e^-2'], ['−e² − 2', '-e^2-2'], ['e - e', '0']])
    assert.equal(E.parse(text).key(), key, text);
  const e1 = E.parse('e+1');
  assert.equal(e1.mul(e1).key(), 'e^2+2e+1');
  assert.equal(e1.mul(e1).mul(e1).key(), 'e^3+3e^2+3e+1');
  assert.equal(E.e(3).mul(E.e(-3)).key(), '1');
  assert.equal(E.parse('e^2+2').sub(2).key(), 'e^2');
  assert.equal(E.of({ n: 6, d: 4 }).key(), '3/2');
  assert.equal(E.parse('e/2+1/3').mul(6).key(), '3e+2');
  assert.equal(E.parse('3-e').shift(2).key(), '3e^2-e^3');
  assert.deepEqual(E.parse('2e^2/3+1').coeff(2), { n: 2n, d: 3n });
  assert.deepEqual(E.parse('e^2+2e^-1').levels(), [2, -1]);
  assert.ok(E.of(7).isInteger() && !E.parse('e').isInteger() && E.of(0).isZero());
  assert.equal(E.parse('e^2+2').text(), 'e² + 2');
  assert.equal(E.parse('3-e').text(), '3 − e');
  assert.equal(E.parse('-e^-1').text(), '−e⁻¹');
  for (let i = 0; i < 300; i++) {
    const terms = Array.from({ length: 1 + rand(4) }, () => [rand(19) - 6, BigInt(rand(13) - 6)]), x = new E(terms, BigInt(1 + rand(6)));
    assert.equal(E.parse(x.key()).key(), x.key(), 'keys parse back to themselves');
    assert.equal(E.parse(x.text()).key(), x.key(), 'pill text parses back too');
    assert.ok(x.add(x.neg()).isZero());
  }
});

test('sign and compare are certified and agree with floats whenever the gap exceeds 1e-9', () => {
  const f = x => x.t.reduce((s, [k, c]) => s + Number(c) * Math.E ** k, 0) / Number(x.d);
  let decided = 0;
  for (let i = 0; i < 3000; i++) {
    const x = new E(Array.from({ length: 1 + rand(5) }, () => [rand(10) - 3, BigInt(rand(11) - 5)]), BigInt(1 + rand(4)));
    const v = f(x);
    if (Math.abs(v) > 1e-9) { assert.equal(sign(x), Math.sign(v), x.key()); decided++; }
    const y = E.of(rand(30) - 10);
    if (Math.abs(v - f(y)) > 1e-9) assert.equal(compare(x, y), Math.sign(v - f(y)));
  }
  assert.ok(decided > 2500);
  assert.equal(sign(E.parse('e-e')), 0);
  assert.equal(compare(E.parse('2e+2'), E.e(2)), 1, '22ₑ is more than e²');
  assert.equal(compare(E.parse('2721/1001'), E.e(1)), -1, '2721/1001 is just below e');
  assert.equal(sign(E.parse('e^2 - 7389056/1000000')), 1);
  assert.equal(sign(E.parse('e - 2718281828/1000000000')), 1);
  assert.equal(sign(E.parse('e - 2718281829/1000000000')), -1);
});

test('no PrecisionError on 10 000 random piles within the limits', () => {
  for (let i = 0; i < 10000; i++) {
    const lo = -3, levels = 1 + rand(24), terms = [];
    for (let k = lo; k < lo + levels; k++) terms.push([k, BigInt(rand(13) - 6)]);
    const x = new E(terms);
    assert.doesNotThrow(() => { sign(x); compare(x, E.e(top(x.isZero() ? E.of(1) : x))); }, PrecisionError);
    if (i % 10 === 0 && !x.isZero()) assert.doesNotThrow(() => greedy(x), PrecisionError);
  }
});

test('greedy digits agree with the independent 80-digit oracle (0..2000, k/7, k/10, 8 places)', () => {
  const fx = JSON.parse(readFileSync(here('fixtures/base-e.json'), 'utf8'));
  assert.equal(fx.places, 8);
  assert.ok(fx.values.length > 2300);
  for (const [x, t, digits, exact] of fx.values) {
    const g = greedy(E.parse(x), { floor: -8 });
    assert.equal(digitString(g, Infinity), digits, x);
    if (g.sign) assert.equal(g.top, t, x);
    assert.equal(g.exact, !!exact, x);
  }
});

test('among the integers 0..2000 only 0, 1 and 2 end; every other expansion has dust', () => {
  const exact = [];
  for (let n = 0; n <= 2000; n++) if (greedy(E.of(n)).exact) exact.push(n);
  assert.deepEqual(exact, [0, 1, 2]);
});

test('worked numerals from section 3', () => {
  assert.equal(digitsText(E.parse('e^2+2')), '102ₑ');
  assert.ok(isLegalNumeral(E.parse('e^2+2')));
  for (const [v, d] of [[3, '10.020…ₑ'], [4, '11.020…ₑ'], [5, '12.020…ₑ'], [7, '21.111…ₑ'], [16, '201.011…ₑ'], [23, '1010.011…ₑ'], [30, '1102.110…ₑ'], [112, '20010.001…ₑ']])
    assert.equal(digitsText(E.of(v)), d, String(v));
  assert.equal(digitsText(E.parse('e')), '10ₑ');
  assert.equal(digitsText(E.parse('e+1')), '11ₑ');
  assert.equal(digitsText(E.parse('e^-1')), '0.1ₑ');
  assert.equal(digitsText(E.of(-3)), '−10.020…ₑ');
  assert.equal(digitString(greedy(E.parse('3-e'), { floor: -7 }), 0), '00200112', '3 − e = 0.0200112…ₑ');
  // 3, 4 and 5 share the fractional part 3 − e
  for (const v of [3, 4, 5]) assert.equal(greedy(E.of(v), { floor: -12 }).rest.key(), greedy(E.of(3), { floor: -12 }).rest.key());
  assert.ok(!isLegalNumeral(E.parse('2e+2')), '22ₑ is too full: 2e + 2 > e²');
  assert.equal(digitString(greedy(E.parse('2e+2'), { floor: -4 }), 2), '1000002', '22ₑ = 100.0002…ₑ');
  assert.ok(!greedy(E.parse('2e+2'), { floor: -40 }).exact);
  assert.ok(isLegalNumeral(E.parse('e^2+2e+1')), '(e + 1)² = 121ₑ');
  assert.ok(!isLegalNumeral(E.parse('e^3+3e^2+3e+1')));
  assert.equal(digitString(greedy(E.parse('e^3+3e^2+3e+1'), { floor: -4 }), 3), '21110021', '(e + 1)³ = 2111.0021…ₑ');
  assert.equal(digitsText(E.parse('3e^2')), '1002.001…ₑ');
  assert.equal(digitString(greedy(E.parse('3e^5'), { floor: -2 }), 6), '100200112', '3e⁵ = 1002001.12…ₑ');
  assert.equal(digitsText(E.parse('2e^3')), '2000ₑ');
  assert.equal(digitsText(E.parse('1/30')), '0.000…ₑ');
  assert.equal(digitsText(E.of(0)), '0ₑ');
});

test('the pile theorem: an integer pile ends if and only if it is already a legal numeral', () => {
  let legal = 0;
  for (let i = 0; i < 600; i++) {
    // half random piles, half cut-off greedy expansions (legal by construction), nudged
    const terms = [];
    if (i % 2) for (let k = -3; k <= 5; k++) { if (rand(3)) terms.push([k, BigInt(rand(4))]); }
    else { for (const [k, d] of greedy(E.of({ n: 1 + rand(400), d: 1 + rand(5) })).digits) if (d) terms.push([k, BigInt(d)]); if (i % 4 === 0) terms.push([rand(9) - 3, 1n]); }
    const x = new E(terms); if (x.isZero()) continue;
    const g = greedy(x, { floor: -40 });
    if (isLegalNumeral(x)) {
      legal++;
      assert.ok(g.exact, x.key());
      for (const [k, d] of g.digits) assert.equal(BigInt(d), x.coeff(k).n, `${x.key()} keeps its digits`);
    } else assert.ok(!g.exact, `${x.key()} is not legal, so it never ends`);
  }
  assert.ok(legal > 100, `${legal} legal piles`);
});

test('the shift law: the greedy expansion of x·e^k is that of x moved k levels', () => {
  for (let i = 0; i < 200; i++) {
    const x = E.of({ n: 1 + rand(5000), d: 1 + rand(40) }).add(E.e(rand(4)).mul(rand(3))), k = rand(19) - 6;
    const g = greedy(x, { floor: -3 - k }), h = greedy(x.shift(k), { floor: -3 });
    for (const [l, d] of h.digits) assert.equal(d, g.digits.get(l - k) ?? 0, `${x.key()} × e^${k} at level ${l}`);
    assert.equal(h.rest.key(), g.rest.shift(k).key());
  }
});

test('heights: rounded ln, clamped below the next level; only powers of e sit on a level', () => {
  const fx = JSON.parse(readFileSync(here('fixtures/base-e.json'), 'utf8'));
  for (const [x, , , , l] of fx.values) {
    if (!l) continue;
    const v = E.parse(x), h = height(v);
    assert.ok(Math.abs(h - Number(l)) <= 1e-4 + 1e-12, `${x}: ${h} against ln ${l}`);
    assert.ok(Math.abs(ln(v) - Number(l)) < 1e-12, `ln ${x}`);
    assert.ok(Math.abs(h * 1e4 - Math.round(h * 1e4)) < 1e-6, `${x}: a height has four decimals at most`);
    if (!v.isPower()) assert.ok(!Number.isInteger(h), `${x} is no power of e, so it stands off the level`);
  }
  for (let k = -14; k <= 20; k++) assert.equal(height(E.e(k)), k);
  assert.equal(height(E.parse('2721/1001')), 0.9999);
  assert.equal(lnText(E.parse('2721/1001')), 'ln(2721/1001) ≈ 0.99999996');
  assert.equal(lnText(E.of(112)), 'ln 112 ≈ 4.7185');
  assert.equal(lnText(E.parse('e^2')), 'ln e² = 2');
  assert.equal(height(E.of(3)), 1.0986);
  assert.equal(height(E.parse('3-e')), -1.2668);
  assert.equal(height(E.parse('3-e-2e^-2')), -4.5055);
  assert.equal(height(E.parse('1/30')), -3.4012);
  assert.equal(height(E.parse('1/1000000')), -13.8155);
  assert.equal(height(E.of(-16)), height(E.of(16)), 'a red light stands at height(|x|)');
  // 162755 is within 2e−6 of e¹²: the clamp keeps it off level 12
  assert.equal(height(E.of(162755)), 12.0001);
});

test('the fold and meet laws equal ln of the exact sum and difference within 1e-12', () => {
  for (let i = 0; i < 2000; i++) {
    const a = 1 + rand(100000) / 7, b = 1 + rand(100000) / 11;
    assert.ok(Math.abs(foldHeight(Math.log(a), Math.log(b)) - Math.log(a + b)) < 1e-12);
    if (Math.abs(a - b) > 1e-3) assert.ok(Math.abs(meetHeight(Math.log(a), Math.log(b)) - Math.log(Math.abs(a - b))) < 1e-9);
  }
  assert.ok(Math.abs(foldHeight(0, 0) - Math.LN2) < 1e-15, 'equal heights lift by ln 2');
  assert.ok(Math.abs(foldHeight(1, 0) - 1 - 0.3132616875182228) < 1e-15, 'one level apart, by 0.313');
});

test('UNFOLD keyframes and deposits follow 6.3, and deposit the greedy digits', () => {
  const ease = v => 1 - (1 - v) ** 2;
  for (const x of [3, 7, 16, 23, 112, 600, '1/3', 'e^2+2', '2e+2', 'e^3+3e^2+3e+1', '1/30', '2721/1001', 'e^5', '-3'].map(v => E.parse(String(v)))) {
    const p = plan('measure', [x.key()]), bt = p.beats.find(b => b.kind === 'unfold'), s = last(p);
    const t = Object.keys(s.towers)[0], g = greedy(x);
    // the deposits are the greedy digits, in the value's colour
    const got = new Map(); for (const q of towerBulbs(s, t)) if (q.s) { got.set(q.l, (got.get(q.l) ?? 0) + 1); assert.equal(q.s, g.sign); }
    for (const [k, d] of g.digits) assert.equal(got.get(k) ?? 0, d, `${x.key()} level ${k}`);
    assert.equal(!!s.towers[t].dust, !g.exact);
    // every deposit is born within 0.05 level of the falling light
    const path = Object.values(bt.motion).find(m => m.path)?.path;
    if (!path) continue;
    assert.deepEqual(path[0], [0, height(x)]);
    for (const [id, m] of Object.entries(bt.motion)) {
      if (!m.grow) continue;
      const c = m.in[0], j = path.findIndex(([u], i) => i + 1 < path.length && u <= c && c <= path[i + 1][0]);
      const [[u0, h0], [u1, h1]] = [path[j], path[j + 1]], at = h0 + (h1 - h0) * ease((c - u0) / (u1 - u0));
      assert.ok(Math.abs(at - bt.set.bulbs[id].l) < 0.05, `${x.key()}: bulb ${id} born at ${at.toFixed(3)} for level ${bt.set.bulbs[id].l}`);
      assert.equal(m.in[1], Math.round((c + 0.081) * 1e4) / 1e4);
    }
  }
  // 112: start at 4.7185, leave 2 at level 4, rest at 1.0309, 1 at level 1, rest at −2.4602, 1 at level −3
  const u = unfoldPlan(E.of(112));
  assert.deepEqual(u.events.map(e => [e.k, e.d, e.h]), [[4, 2, 4.7185], [1, 1, 1.0309], [-3, 1, -2.4602]]);
});

test('MEASURE 3 reproduces the normative UNFOLD beat and the whole fixture of 6.5', () => {
  const p = plan('measure', ['3']);
  assert.deepEqual(p.beats[3], { i: 3, kind: 'unfold', node: 'n1', caption: 'The light falls and leaves the bulbs that fit: 3 = 10.020…ₑ.', ledger: { law: 'unfold', value: '3' },
    set: { nodes: { n1: { glyph: 0 } }, towers: { t1: { form: 'tower', dust: true, digits: '10.020…ₑ', reading: null } },
      bulbs: { b1: null, b2: { t: 't1', l: 1, s: 1, slot: 0 }, b3: { t: 't1', l: -2, s: 1, slot: 0 }, b4: { t: 't1', l: -2, s: 1, slot: 1 } } },
    motion: { b1: { path: [[0, 1.0986], [0.45, -1.2668], [0.9, -4.5055]], fade: [0.9, 1] },
      b2: { in: [0.0095, 0.0905], grow: true }, b3: { in: [0.5042, 0.5852], grow: true }, b4: { in: [0.5042, 0.5852], grow: true } } });
  assert.deepEqual(p.start, { nodes: { n1: { op: 'measure', parent: 'io', socket: 'C' } }, towers: { t1: { at: 'in:0', form: 'light', value: '3', text: '3', reading: 'ln 3 ≈ 1.0986' } }, bulbs: { b1: { t: 't1', l: 1.0986, s: 1, k: 'light' } } });
  assert.deepEqual(p, JSON.parse(readFileSync(new URL('e-measure-3.json', fixtures), 'utf8')), 'the whole plan is the fixture of 6.5');
  check(p);
});

test('ADD piles, then LEGAL or FOLD and UNFOLD; 16 + 7 reads 2|2|2.1|2|2 and lands on 1010.011…ₑ', () => {
  const p = plan('add', ['16', '7']);
  assert.deepEqual(opBeats(p).map(bt => bt.kind), ['pile', 'fold', 'unfold']);
  const pile = p.beats.find(bt => bt.kind === 'pile'), fold = p.beats.find(bt => bt.kind === 'fold');
  assert.equal(Object.values(pile.set.towers).find(t => t?.pile).digits, '2|2|2.1|2|2…ₑ');
  assert.equal(fold.caption, 'Fold: the bulbs merge into one light at height ln 23 ≈ 3.1355.');
  assert.equal(p.result.values[0], '23');
  assert.equal(Object.values(last(p).towers)[0].digits, '1010.011…ₑ');
  check(p);
  const q = plan('add', ['1', 'e']);
  assert.deepEqual(opBeats(q).map(bt => bt.kind), ['pile', 'legal'], '1 + e = 11ₑ is legal at once');
  assert.equal(Object.values(last(q).towers)[0].digits, '11ₑ');
  check(q);
});

test('mixed signs: opposite bulbs cancel in the pile, each colour folds, the lights MEET', () => {
  for (const [op, inputs, out] of [['add', ['16', '-7'], '9'], ['sub', ['7', '16'], '-9'], ['add', ['-16', '7'], '-9'], ['sub', ['5', 'e'], '5-e'], ['add', ['1/3', '-1/3'], '0'], ['sub', ['3', '3'], '0']]) {
    const p = plan(op, inputs);
    assert.equal(p.result.values[0], out, `${op} ${inputs}`);
    const s = last(p), t = Object.keys(s.towers)[0];
    assert.ok(towerBulbs(s, t).every(q => q.s === sign(E.parse(out))), 'the result is one colour (sign-magnitude)');
    if (op === 'sub') assert.equal(p.beats.find(bt => bt.kind === 'negate').set.nodes.n1.op, 'add', 'the minus turns into a plus');
    check(p);
  }
  const p = plan('sub', ['7', '16']);
  assert.deepEqual(opBeats(p).map(bt => bt.kind), ['negate', 'pile', 'fold', 'meet', 'unfold']);
  assert.ok(p.beats.find(bt => bt.kind === 'pile').motion && Object.values(p.beats.find(bt => bt.kind === 'pile').motion).some(m => m.burst));
  const meet = p.beats.find(bt => bt.kind === 'meet');
  assert.equal(compare(E.parse(meet.ledger.a).add(E.parse(meet.ledger.b)), E.of(-9)), 0, 'the meet adds the two lights exactly');
  // one colour left after the pile: skip MEET
  assert.ok(!kinds(plan('sub', ['5', 'e'])).includes('meet'));
});

test('(e² + 2) − 2 is legal after the pile, so it skips FOLD: 100ₑ', () => {
  const p = plan('sub', ['e^2+2', '2']);
  assert.deepEqual(opBeats(p).map(bt => bt.kind), ['negate', 'pile', 'legal']);
  assert.equal(p.result.values[0], 'e^2');
  assert.equal(Object.values(last(p).towers)[0].digits, '100ₑ');
  check(p);
});

test('MULT: shift by e^k, split finite numerals (121ₑ exactly), the slide rule otherwise', () => {
  const sq = plan('mul', ['e+1', 'e+1']);
  assert.deepEqual(opBeats(sq).map(bt => bt.kind), ['split', 'shift', 'shift', 'pile', 'legal'], '(e + 1)² = 110 + 11 → 121ₑ');
  assert.equal(Object.values(last(sq).towers)[0].digits, '121ₑ');
  check(sq);
  const cube = plan('mul', ['e^2+2e+1', 'e+1']);
  assert.deepEqual(opBeats(cube).map(bt => bt.kind), ['split', 'shift', 'shift', 'pile', 'fold', 'unfold'], 'the 3s of 1331 are overfull');
  assert.equal(Object.values(last(cube).towers)[0].digits, '2111.002…ₑ');
  check(cube);
  // a digit 2 makes two leaves; the + born by a split piles without normalising
  const two = plan('mul', ['3', 'e^2+2']);
  assert.deepEqual(opBeats(two).map(bt => bt.kind), ['split', 'shift', 'split', 'shift', 'shift', 'pile', 'pile', 'fold', 'unfold']);
  assert.ok(two.beats.some(bt => bt.set.nodes && Object.values(bt.set.nodes).some(n => n?.pile)), 'split-born + nodes carry pile: true');
  check(two);
  const s = plan('mul', ['16', '7']);
  assert.ok(['fold', 'slide', 'unfold'].every(k => kinds(s).includes(k)));
  const slide = s.beats.find(bt => bt.kind === 'slide');
  assert.equal(slide.caption, 'Multiplying adds heights: 2.77 + 1.95 = 4.72; levels 2 + 1 = 3, yet 112 stands at level 4.');
  assert.equal(Object.values(slide.set.bulbs).find(q => q?.l !== undefined).l, height(E.of(112)), 'the planner stores height(ab), never a sum of rounded heights');
  assert.equal(Object.values(last(s).towers)[0].digits, '20010.001…ₑ');
  check(s);
  // the colour of a product is the product of the colours
  for (const [a, b, out] of [['16', '-7', '-112'], ['-3', '-e-1', '3e+3'], ['-2', 'e^2', '-2e^2'], ['0', '9', '0'], ['9', '0', '0']]) {
    const p = plan('mul', [a, b]);
    assert.equal(p.result.values[0], out, `${a} × ${b}`);
    if (a === '0' || b === '0') assert.deepEqual(opBeats(p).map(bt => bt.kind), ['zero']);
    check(p);
  }
});

test('×eᵏ is a shift: digits move, the dust gives up digits, and sinking levels join it', () => {
  const p = plan('mule', ['3', '2']);
  const shift = p.beats.find(bt => bt.kind === 'shift');
  assert.equal(shift.ledger.out, '3e^2');
  assert.equal(Object.values(last(p).towers)[0].digits, '1002.001…ₑ');
  assert.ok(Object.values(shift.motion).some(m => m.grow), 'the 1 at level −5 of 3 condenses at level −3');
  check(p);
  const q = plan('mule', ['2', '3']);
  assert.equal(Object.values(last(q).towers)[0].digits, '2000ₑ');
  check(q);
  const r = plan('mule', ['3', '-2']);
  assert.equal(r.result.values[0], '3e^-2');
  assert.ok(Object.values(r.beats.find(bt => bt.kind === 'shift').set.bulbs).includes(null), 'levels below the floor merge into the dust');
  check(r);
});

test('COMP: colours decide without a fold; two reds race and the verdict inverts', () => {
  for (const [a, b, v, race] of [['16', '7', '1', true], ['-16', '-7', '-1', true], ['-7', '-16', '1', true], ['3', '-2', '1', false], ['0', '2', '-1', false], ['5', '5', '0', true], ['e', '2721/1001', '1', true]]) {
    const p = plan('cmp', [a, b]);
    assert.equal(p.result.values[0], v, `${a} vs ${b}`);
    assert.equal(kinds(p).includes('race'), race);
    const s = last(p), t = Object.keys(s.towers)[0];
    assert.deepEqual(towerBulbs(s, t).map(q => q.s), [Number(v)], 'the verdict is one bulb');
    check(p);
  }
  assert.match(plan('cmp', ['-16', '-7']).beats.find(bt => bt.kind === 'race').caption, /Both red/);
});

test('MEASURE: 0 is exact, −3 is red, 1/30 and 1/10⁶ are dust only; level pace deposits one level a beat', () => {
  const z = plan('measure', ['0']);
  assert.deepEqual(towerBulbs(last(z), Object.keys(last(z).towers)[0]), [{ t: 't1', l: 0, s: 0, slot: 0 }]);
  check(z);
  const red = plan('measure', ['-3']), s = last(red);
  assert.equal(red.start.bulbs.b1.s, -1, 'its light is red');
  assert.equal(red.start.bulbs.b1.l, height(E.of(3)));
  assert.ok(towerBulbs(s, 't1').every(q => q.s === -1));
  assert.equal(s.towers.t1.digits, '−10.020…ₑ');
  check(red);
  for (const tiny of ['1/30', '1/1000000']) {
    const p = plan('measure', [tiny]), t = last(p).towers.t1;
    assert.equal(towerBulbs(last(p), 't1').length, 0, `${tiny} has no bulb above the floor`);
    assert.ok(t.dust);
    assert.equal(t.approx, tiny === '1/30' ? '≈ 0.0333' : '≈ 1.00 × 10⁻⁶');
    check(p);
  }
  const lv = plan('measure', ['112'], 'level');
  assert.equal(kinds(lv).filter(k => k === 'unfold').length, 3);
  check(lv);
});

test('LN folds and reads the height; ln e^k = k exactly; ln of 0 is a domain error', () => {
  const p = plan('ln', ['112']);
  assert.equal(p.result.text, '[ln 112 ≈ 4.7185]');
  assert.equal(p.beats.find(bt => bt.kind === 'read').ledger.h, 4.7185);
  check(p);
  assert.equal(plan('ln', ['e^2']).result.text, '[ln e² = 2]');
  assert.deepEqual(evaluate('ln', ['0']), { ok: false, reason: 'domain', message: 'ln needs a positive number: 0 has no logarithm; its light would fall forever.' });
  assert.equal(evaluate('ln', ['-3']).reason, 'domain');
  assert.equal(evaluate('add', ['ln(112)', '1']).reason, 'domain', 'a reading can only go to Output');
  const r = planMachine({ tree: { n1: { op: 'ln', parent: 'io', socket: 'C' }, n2: { op: 'sub', parent: 'n1', socket: 'C' } }, inputs: ['2', '2'], base: 'e' });
  assert.equal(r.ok, false); assert.equal(r.reason, 'domain'); assert.equal(r.node, 'n1');
});

test('top(ab) − top(a) − top(b) is 0 or 1: the heights carry', () => {
  let carried = 0;
  for (let i = 0; i < 400; i++) {
    const a = E.of({ n: 1 + rand(3000), d: 1 + rand(9) }), b = E.of({ n: 1 + rand(3000), d: 1 + rand(9) }), d = top(a.mul(b)) - top(a) - top(b);
    assert.ok(d === 0 || d === 1); carried += d;
  }
  assert.ok(carried > 50);
  assert.equal(top(E.of(112)) - top(E.of(16)) - top(E.of(7)), 1);
});

test('the base entry: typed limits, refusals with reasons, display strings', () => {
  assert.deepEqual(parseValue('[e^2+2]'.replace(/[[\]]/g, '')), { ok: true, value: 'e^2+2' });
  assert.equal(parseValue('1/3').value, '1/3');
  assert.equal(parseValue('e^13').ok, false, 'exponents run from −6 to 12');
  assert.equal(parseValue('e+e+e+e+e+e+e').ok, false, 'at most 6 terms');
  assert.equal(parseValue('1/1000001').ok, false, 'fractions up to 10⁶');
  assert.equal(parseValue('300000000*e^0+e^12*1000').ok, false);
  assert.match(parseValue('1000000e^12').error, /past e²⁰/);
  assert.equal(parseValue('2 + ').ok, false);
  assert.equal(parseValue('16 7').ok, false, 'a space between numbers makes a list, as in [16 7]');
  assert.equal(parseValue('2 e').ok, false);
  assert.equal(parseValue('e^2 + 2').value, 'e^2+2', 'spaces beside an operator are fine');
  // evaluate is exact whatever the size: the caps belong to the planner (6.10), which then
  // answers tooBig with this very value
  assert.deepEqual(evaluate('mul', ['e^12', 'e^10']), { ok: true, values: ['e^22'] });
  assert.deepEqual(evaluate('mul', ['1/1000000', 'e^-6']), { ok: true, values: ['e^-6/1000000'] });
  assert.equal(evaluate('mule', ['3', '400']).reason, 'tooBig', 'only a power past e^±300 is refused outright');
  // an operand evaluateScene could not read is no answer, never a crash
  assert.equal(evaluate('add', ['mul(1/1000000, e^-3)', '1']).reason, 'domain');
  assert.equal(evaluate('mul', ['3', undefined]).reason, 'domain');
  assert.equal(checkLimits('e^-15'), 'e⁻¹⁵ is below e⁻¹⁴, past the end of the rail');
  assert.equal(checkLimits('0'), null);
  for (const op of ['div', 'mod', 'and', 'xor', 'not', 'shl']) assert.equal(evaluate(op, ['3', '2']).ok, false, op);
  assert.equal(evaluate('div', ['3', '2']).message, 'A quotient of e-numerals is usually not an e-numeral.');
  assert.equal(evaluate('and', ['3', '2']).message, 'Logic needs whole-number levels; base e has none.');
  // ×eᵏ takes only a count: '1' is ×e¹, and a power (the expanded socket) is no count
  assert.deepEqual(evaluate('mule', ['3', '2']), { ok: true, values: ['3e^2'] });
  assert.deepEqual(evaluate('mule', ['3', '1']), { ok: true, values: ['3e'] });
  assert.deepEqual(evaluate('mule', ['3', '0']), { ok: true, values: ['3'] });
  assert.deepEqual(evaluate('mule', ['3', '-2']), { ok: true, values: ['3e^-2'] });
  assert.deepEqual(evaluate('mule', ['3', '13']), { ok: true, values: ['3e^13'] }, 'a count past 12 is the planner\'s tooBig');
  for (const k of ['1/2', 'e', 'e^2', 'e^-1', '-e^-6']) assert.equal(evaluate('mule', ['3', k]).reason, 'domain', k);
  assert.deepEqual(evaluate('cmp', ['-16', '-7']), { ok: true, values: ['-1'] });
  assert.deepEqual(eSpec.palette, ['add', 'sub', 'mul', 'mule', 'cmp', 'measure', 'ln']);
  assert.deepEqual(display('e^2+2'), { text: 'e² + 2', approx: '≈ 9.389', digits: '102ₑ' });
  assert.deepEqual(display('3', { form: 'light' }), { text: '3', reading: 'ln 3 ≈ 1.0986' });
  assert.deepEqual(display('ln(112)'), { text: 'ln 112 ≈ 4.7185' });
  assert.deepEqual(display('1/30'), { text: '1/30', approx: '≈ 0.0333', digits: '0.000…ₑ' });
});

test('place writes a value once, as a light or a tower, and replaces only what differs', () => {
  const b = new PlanBuilder({ base: 'e', tree: one('measure'), inputs: ['3'] }), ids = () => b.bulbsOf('t1').map(([id]) => id);
  assert.equal(b.scene.towers.t1.form, 'light', 'an input in the Input pill is a light');
  b.begin('fanout', 'n1', { caption: 'Placing.', ledger: { law: 'move' } });
  const light = ids(); eSpec.place(b, 't1', '3', { asLight: true });
  assert.deepEqual(ids(), light, 'already that light: left alone');
  eSpec.place(b, 't1', '3');
  assert.equal(b.scene.towers.t1.form, 'tower'); assert.equal(b.scene.towers.t1.dust, true);
  assert.deepEqual(b.bulbsOf('t1').map(([, q]) => [q.l, q.slot, q.s]), [[-2, 0, 1], [-2, 1, 1], [1, 0, 1]]);
  const tower = ids(); eSpec.place(b, 't1', '3');
  assert.deepEqual(ids(), tower, 'already that tower: left alone');
  eSpec.place(b, 't1', '2', { asLight: true });
  assert.equal(b.scene.towers.t1.value, '2'); assert.equal(b.scene.towers.t1.dust, undefined);
  eSpec.place(b, 't1', 'e^2');
  assert.deepEqual(b.bulbsOf('t1').map(([, q]) => [q.l, q.slot, q.s]), [[2, 0, 1]]);
  eSpec.place(b, 't1', '0', { asLight: true });
  assert.deepEqual(b.bulbsOf('t1').map(([, q]) => [q.l, q.s, q.k]), [[0, 0, undefined]], '0 is never a light');
  b.end();
});

test('validateTower catches a tower that does not encode its value', () => {
  const scene = (tower, bulbs) => ({ nodes: {}, towers: { t1: { at: 'n1.C', form: 'tower', text: 'x', ...tower } }, bulbs: Object.fromEntries(bulbs.map((q, i) => [`b${i + 1}`, { t: 't1', ...q }])) });
  assert.deepEqual(validateTower(scene({ value: 'e+1' }, [{ l: 0, s: 1, slot: 0 }, { l: 1, s: 1, slot: 0 }]), 't1'), []);
  assert.notDeepEqual(validateTower(scene({ value: 'e+1' }, [{ l: 0, s: 1, slot: 0 }]), 't1'), [], 'missing a bulb');
  assert.notDeepEqual(validateTower(scene({ value: '3' }, [{ l: 1, s: 1, slot: 0 }, { l: -2, s: 1, slot: 0 }, { l: -2, s: 1, slot: 1 }]), 't1'), [], '3 has dust');
  assert.deepEqual(validateTower(scene({ value: '3', dust: true }, [{ l: 1, s: 1, slot: 0 }, { l: -2, s: 1, slot: 0 }, { l: -2, s: 1, slot: 1 }]), 't1'), []);
  assert.notDeepEqual(validateTower(scene({ value: '2e+2' }, [{ l: 0, s: 1, slot: 0 }, { l: 0, s: 1, slot: 1 }, { l: 1, s: 1, slot: 0 }, { l: 1, s: 1, slot: 1 }]), 't1'), [], '22ₑ is not greedy');
  assert.deepEqual(validateTower(scene({ value: '2e+2', pile: true }, [{ l: 0, s: 1, slot: 0 }, { l: 0, s: 1, slot: 1 }, { l: 1, s: 1, slot: 0 }, { l: 1, s: 1, slot: 1 }]), 't1'), [], 'but it is a fine pile');
  assert.notDeepEqual(validateTower(scene({ value: '3', form: 'light' }, [{ l: 1.0985, s: 1, k: 'light' }]), 't1'), [], 'a light at the wrong height');
  assert.deepEqual(validateTower(scene({ value: '3', form: 'light' }, [{ l: 1.0986, s: 1, k: 'light' }]), 't1'), []);
  assert.notDeepEqual(validateTower(scene({ value: '0' }, []), 't1'), [], 'zero is one dark bulb');
  assert.notDeepEqual(validateTower(scene({ value: 'e', text: '' }, [{ l: 1, s: 1, slot: 0 }]), 't1'), [], 'every tower has text');
});

test('planning is deterministic, and random base-e machines give the exact answer', () => {
  const pool = ['0', '1', '2', '3', '7', '16', '-5', 'e', 'e+1', 'e^2+2', '1/3', '-1/2', '2e+2', '30'];
  const ops = ['add', 'sub', 'mul', 'cmp'];
  for (let i = 0; i < 90; i++) {
    const op = ops[i % 4], inputs = [pool[rand(pool.length)], pool[rand(pool.length)]], pace = i % 3 ? 'together' : 'level';
    const p = plan(op, inputs, pace);
    assert.equal(p.result.values[0], evaluate(op, inputs).values[0], `${op} ${inputs}`);
    assert.deepEqual(plan(op, inputs, pace), p, 'planned twice, the same plan');
    check(p);
  }
  for (const k of [-6, -1, 0, 1, 5, 12]) { const p = plan('mule', ['30', String(k)]); assert.equal(p.result.values[0], E.of(30).shift(k).key()); check(p); }
  // a machine of several blocks: (16 + 7) × e
  const tree = { n1: { op: 'mul', parent: 'io', socket: 'C' }, n2: { op: 'add', parent: 'n1', socket: 'L' } };
  const p = plan(tree, ['16', '7', 'e']);
  assert.equal(p.result.values[0], '23e');
  check(p);
});

const chain = (...ops) => Object.fromEntries(ops.map((op, i) => [`n${i + 1}`, i ? { op, parent: `n${i}`, socket: ARITY[ops[i - 1]] === 1 ? 'C' : 'R' } : { op, parent: 'io', socket: 'C' }]));
test('past a cap the run is tooBig, and the exact answer comes with it (6.10)', () => {
  const big = (tree, inputs, values) => {
    for (const pace of ['together', 'level']) {
      const r = planMachine({ tree: typeof tree === 'string' ? one(tree) : tree, inputs, base: 'e', pace });
      assert.equal(r.ok, false, `${inputs} planned`); assert.equal(r.reason, 'tooBig', `${inputs}: ${r.message}`);
      assert.deepEqual(r.result.values, values, `${inputs}`);
    }
  };
  // a tower past level 20, as binary's shl(3, 70)
  big('mul', ['e^12', 'e^12'], ['e^24']);
  big('mule', ['e^12', '12'], ['e^24']);
  big(chain('add', 'add'), ['2980e^12', '2980e^12', '2980e^12'], ['8940e^12']);
  // ×eᵏ counts past −6..12, typed or computed
  big('mule', ['3', '13'], ['3e^13']);
  big('mule', ['3', '-8'], ['3e^-8']);
  big(chain('mule', 'mul'), ['1', '4', '4'], ['e^16']);
  // a light below the rail's reach: 10⁻¹² is a slide-rule light at −27.6, and the fall of
  // 1 + e⁻⁶/10⁶ to its dust ends at −19.8
  big(chain('measure', 'mul'), ['1/1000000', '1/1000000'], ['1/1000000000000']);
  big('measure', ['1+e^-6/1000000'], ['1+e^-6/1000000']);
  assert.equal(planMachine({ tree: one('mul'), inputs: ['e^12', 'e^12'], base: 'e' }).result.text, '[e²⁴]');
});

test('dust-only split leaves validate, and dust alone never hangs a light below the rail', () => {
  // the leaves 10⁻⁶·e⁻³ and 10⁻⁵·e⁻³ are dust below e⁻¹⁴: legitimate towers on the way
  for (const inputs of [['1/1000000', 'e+e^-3'], ['1/100000', 'e^2+e^-3'], ['1/1000000', '-e-e^-3']]) {
    const p = plan('mul', inputs);
    assert.equal(p.result.values[0], evaluate('mul', inputs).values[0]);
    check(p);
  }
  // 5 − e⁻⁶/10⁶ and −3 share their digits' fractional part, so the pile leaves blue bulbs
  // and a red dust of e⁻⁶/10⁶ alone: it joins the blue light instead of hanging at −19.8
  for (const pace of ['together', 'level']) {
    const p = plan('add', ['5-e^-6/1000000', '-3'], pace);
    assert.equal(p.result.values[0], '2-e^-6/1000000');
    for (const s of scenesOf(p)) for (const q of Object.values(s.bulbs)) if (q.k === 'light') assert.ok(Math.floor(q.l) >= -14, `a light at ${q.l}`);
    assert.ok(!kinds(p).includes('meet'), 'one colour of light, so no MEET');
    check(p);
  }
  // a pile of dust alone is still one light, condensing out of the haze
  const d = plan('add', ['1/30', '-1/60']);
  assert.ok(opBeats(d).some(bt => bt.kind === 'fold' && Object.values(bt.motion ?? {}).some(m => m.grow)));
  check(d);
});

test('the fill readout shows where a light rests before it unfolds (3.3)', () => {
  // together pace: the light the FOLD (or MEET, or SLIDE) leaves at rest carries the fill
  // f = x / e^k as its note; the UNFOLD clears it
  for (const [op, inputs, fill] of [['add', ['16', '7'], '≈ 1.15 bulbs’ worth at e³'], ['mul', ['16', '7'], '≈ 2.05 bulbs’ worth at e⁴'], ['sub', ['7', '16'], '≈ 1.22 bulbs’ worth at e²'], ['add', ['e^2', '0'], undefined]]) {
    const p = plan(op, inputs), scenes = scenesOf(p), i = p.beats.findIndex(bt => bt.kind === 'unfold');
    if (fill === undefined) { assert.equal(i, -1, 'a legal pile never unfolds'); continue; }
    const t = Object.keys(scenes[i].towers).find(id => scenes[i].towers[id].form === 'light');
    assert.equal(scenes[i].towers[t].note, fill, `${op} ${inputs}`);
    assert.equal(scenes[i].towers[t].reading, lnText(E.parse(p.result.values[0])), 'the ln reading keeps its line');
    assert.equal(scenes[i + 1].towers[t].note, undefined);
  }
  assert.equal(scenesOf(plan('measure', ['e^3'])).find(s => s.towers.t1?.note), undefined, 'a typed light comes from FANOUT, which 6.5 pins without one');
  // level pace: at every boundary between deposits, the fill of what is left
  const lv = plan('measure', ['112'], 'level'), notes = scenesOf(lv).map(s => s.towers.t1?.note).filter(Boolean);
  assert.deepEqual(notes, ['≈ 1.03 bulbs’ worth at e¹', '≈ 1.72 bulbs’ worth at e⁻³']);
});

// planMachine over random base-e machines: it never throws, a tooBig run brings its exact
// answer, and every plan it accepts passes validatePlan and gives evaluateTree's answer.
test('random base-e machines plan or refuse cleanly, and every accepted plan validates', () => {
  const pool = ['0', '1', '2', '3', '7', '16', '-5', 'e', 'e+1', 'e^2+2', '1/3', '-1/2', '2e+2', '30', '112', '1/30', '1/1000000', '-1/1000000',
    'e^12', 'e^-6', 'e^12+e^11', '999999/1000000', '5-e^-6/1000000', '1+e^-6/1000000', 'e+e^-3', '-e-e^-3', '2721/1001', '3e^2', '-e^2-2', 'e^-3', '13', '-7'];
  const ops = eSpec.palette, seen = {};
  for (let i = 0; i < 160; i++) {
    const tree = { n1: { op: ops[rand(ops.length)], parent: 'io', socket: 'C' } };
    const grow = (id, depth) => { for (const s of ARITY[tree[id].op] === 1 ? ['C'] : ['L', 'R']) if (depth < 3 && Object.keys(tree).length < 5 && rand(2)) {
      const op = ops.filter(o => o !== 'ln')[rand(ops.length - 1)], child = `n${Object.keys(tree).length + 1}`;
      tree[child] = { op, parent: id, socket: s }; grow(child, depth + 1);
    } };
    grow('n1', 1);
    const inputs = openSockets(tree).map(s => tree[s.split('.')[0]].op === 'mule' && s.endsWith('.R') ? String(rand(23) - 8) : pool[rand(pool.length)]);
    const pace = rand(3) ? 'together' : 'level', r = planMachine({ tree, inputs, base: 'e', pace }), what = `${JSON.stringify(tree)} ${inputs} ${pace}`;
    seen[r.ok ? 'ok' : r.reason] = (seen[r.ok ? 'ok' : r.reason] ?? 0) + 1;
    if (!r.ok) { if (r.reason === 'tooBig') assert.ok(r.result, `${what}: tooBig without the answer`); continue; }
    assert.deepEqual(validatePlan(r.plan), [], what);
    assert.deepEqual(r.plan.result.values, evaluateTree(tree, inputs, 'e').values, what);
    for (const bt of r.plan.beats) assert.ok(!bt.caption.includes('-'), `${what}: ${bt.caption}`);
  }
  assert.ok(seen.ok > 80 && seen.tooBig > 2, JSON.stringify(seen));
});

// The base-e scenes for the snapshots (C's scenes.js renders every e-*.json). Regenerate
// them with node tools/make-e-fixture.mjs --plans, which sets MACHINE_E_UPDATE.
const FIXTURE_CASES = {
  'e-add-16-7': ['add', ['16', '7']],                   // pile, fold, unfold
  'e-add-1-e': ['add', ['1', 'e']],                     // pile, legal
  'e-sub-7-16': ['sub', ['7', '16']],                   // negate, pile with bursts, two lights, meet
  'e-mul-16-7': ['mul', ['16', '7']],                   // fold both, slide, unfold
  'e-mul-e1-squared': ['mul', ['e+1', 'e+1']],          // split, shifts, pile, legal: 121ₑ
  'e-mule-3-2': ['mule', ['3', '2']],                   // ×e²: a 1 condenses out of the dust
  'e-cmp-red': ['cmp', ['-16', '-7']],                  // a race of two reds
  'e-ln-112': ['ln', ['112']],                          // fold, read
  'e-measure-112-level': ['measure', ['112'], 'level'], // one deposit a beat
  'e-measure-1-30': ['measure', ['1/30']],              // dust only
};
const formatPlan = p => {
  const j = JSON.stringify, { nodes, towers, bulbs } = p.start;
  return `{"v":1,"base":${j(p.base)},"pace":${j(p.pace)},"tree":${j(p.tree)},"inputs":${j(p.inputs)},\n "start":{"nodes":${j(nodes)},\n  "towers":${j(towers)},\n  "bulbs":${j(bulbs)}},\n "beats":[\n${p.beats.map(bt => ' ' + j(bt)).join(',\n')}],\n "result":${j(p.result)},\n "stats":${j(p.stats)}}\n`;
};
test('the base-e plan fixtures are what the planner makes', () => {
  const update = process.env.MACHINE_E_UPDATE === '1';
  if (update) mkdirSync(fixtures, { recursive: true });
  for (const [name, [op, inputs, pace]] of Object.entries(FIXTURE_CASES)) {
    const p = plan(op, inputs, pace), file = new URL(`${name}.json`, fixtures);
    check(p);
    if (update) { writeFileSync(file, formatPlan(p)); continue; }
    assert.ok(existsSync(file), `${name}.json is missing: run node tools/make-e-fixture.mjs --plans`);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), p, `${name}.json is stale: regenerate it with node tools/make-e-fixture.mjs --plans`);
  }
});

// Reported, never fixed here (6.11): bases.js computes base e in floats.
test('bases.js base-e digits agree with the certified ones for 1..2000 at 3 places', { todo: 'bases.js is not modified in v1 (6.11); disagreements are listed for a separate change' }, () => {
  const bad = [];
  for (let n = 1; n <= 2000; n++) {
    const spec = digitsOf({ n, d: 1 }, 'e'), g = greedy(E.of(n));
    const mine = new Map([...g.digits].filter(([, d]) => d)), theirs = new Map(spec.places.filter(p => p.digit).map(p => [p.exponent, p.digit]));
    if (JSON.stringify([...mine].sort()) !== JSON.stringify([...theirs].sort())) bad.push(n);
  }
  assert.deepEqual(bad, []);
});
