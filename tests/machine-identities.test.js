// The algebra behind the blocks, at the oracle level (design 2.6, 2.8): the half-adder
// identities in both bases, De Morgan, involutions, absorption, Kleene XOR, the division
// conventions, SHR as division, the gates against BigInt, and the borrow schedule's bound.
import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../src/machine/oracle.js';
import {digits, fromDigits, twos, fromTwos, trit} from '../src/machine/bigmath.js';
import {annihilateCells, borrowSchedule} from '../src/machine/ops/borrow.js';

const ev = (op, base, ...args) => evaluate(op, base, args).value;
const span = function* (lo, hi) { for (let a = BigInt(lo); a <= BigInt(hi); a++) yield a; };
const abs = v => v < 0n ? -v : v;

test('a + b = XOR + 2·AND (binary) and SUM + 3·CONS (ternary) for a, b ∈ [−130, 130]', () => {
  for (const a of span(-130, 130)) for (const b of span(-130, 130)) {
    if (ev('xor', 'binary', a, b) + 2n * ev('and', 'binary', a, b) !== a + b) assert.fail(`${a}, ${b} in binary`);
    if (ev('sum', 'ternary', a, b) + 3n * ev('cons', 'ternary', a, b) !== a + b) assert.fail(`${a}, ${b} in ternary`);
  }
});
test('iterating (x, y) ← (SUM, 3·CONS) adds any two numbers in at most 7 rounds for |a|, |b| ≤ 400', () => {
  let most = 0;
  for (let a = -400n; a <= 400n; a++) for (let b = a; b <= 400n; b++) {    // SUM and CONS commute
    let x = a, y = b, rounds = 0;
    while (y !== 0n) { [x, y] = [ev('sum', 'ternary', x, y), 3n * ev('cons', 'ternary', x, y)]; rounds++; }
    if (x !== a + b) assert.fail(`${a} + ${b}`);
    most = Math.max(most, rounds);
  }
  assert.ok(most <= 7, `${most} rounds`);
});
test('De Morgan, involutions and absorption in both bases', () => {
  for (const a of span(-130, 130)) {
    assert.equal(ev('not', 'binary', ev('not', 'binary', a)), a, 'NOT∘NOT = id');
    assert.equal(ev('neg', 'ternary', ev('neg', 'ternary', a)), a, 'NEG∘NEG = id');
    for (const b of span(-130, 130)) {
      const not = x => ev('not', 'binary', x), neg = x => ev('neg', 'ternary', x);
      if (not(ev('and', 'binary', a, b)) !== ev('or', 'binary', not(a), not(b))) assert.fail(`¬(${a} ∧ ${b})`);
      if (not(ev('or', 'binary', a, b)) !== ev('and', 'binary', not(a), not(b))) assert.fail(`¬(${a} ∨ ${b})`);
      if (neg(ev('min', 'ternary', a, b)) !== ev('max', 'ternary', neg(a), neg(b))) assert.fail(`−MIN(${a}, ${b})`);
      if (neg(ev('max', 'ternary', a, b)) !== ev('min', 'ternary', neg(a), neg(b))) assert.fail(`−MAX(${a}, ${b})`);
      if (ev('min', 'ternary', a, ev('max', 'ternary', a, b)) !== a || ev('max', 'ternary', a, ev('min', 'ternary', a, b)) !== a) assert.fail(`absorption ${a}, ${b}`);
    }
  }
  // tritwise min and max are not numeric min and max
  assert.equal(ev('min', 'ternary', 2n, 1n), -1n); assert.equal(ev('max', 'ternary', 2n, 1n), 4n);
});
test('Kleene XOR max(min(a, −b), min(−a, b)) is −a·b trit by trit, with T as its two-sided identity, and no carry partner', () => {
  const kleene = (x, y) => trit('max', trit('min', x, -y), trit('min', -x, y)) || 0;
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) assert.equal(kleene(x, y), -x * y || 0);
  for (const x of [-1, 0, 1]) { assert.equal(kleene(x, -1), x); assert.equal(kleene(-1, x), x); }
  // on the Boolean subset {T = false, 1 = true} it is exactly XOR
  assert.deepEqual([[-1, -1], [-1, 1], [1, 1]].map(([x, y]) => kleene(x, y)), [-1, 1, -1]);
  // at the oracle level: MAX(MIN(a, NEG b), MIN(NEG a, b)) has the trits −a_k·b_k, and the
  // all-T number of a's length is an identity
  for (const a of span(-130, 130)) for (const b of span(-130, 130)) {
    const k = ev('max', 'ternary', ev('min', 'ternary', a, -b), ev('min', 'ternary', -a, b));
    const da = digits(a, 'ternary'), db = digits(b, 'ternary');
    const want = fromDigits(Array.from({length: Math.max(da.length, db.length)}, (_, n) => -(da[n] ?? 0) * (db[n] ?? 0) || 0), 'ternary');
    if (k !== want) assert.fail(`Kleene XOR of ${a}, ${b}`);
  }
  for (const a of span(-130, 130)) {
    const t = -(3n ** BigInt(digits(a, 'ternary').length) - 1n) / 2n;   // T…T
    assert.equal(ev('max', 'ternary', ev('min', 'ternary', a, -t), ev('min', 'ternary', -a, t)), a);
  }
  // (0, 1): a + b − XOR_K(a, b) = 1 is no multiple of 3, so no "Kleene AND" pairs with it
  assert.notEqual((0 + 1 - kleene(0, 1)) % 3, 0);
});
test('a = q·b + r with each convention\'s bounds, and SHR(a, k) = DIV(a, b^k)', () => {
  for (const a of span(-130, 130)) for (const b of span(-130, 130)) {
    if (!b) continue;
    const t = evaluate('div', 'binary', [a, b]), r3 = evaluate('div', 'ternary', [a, b]);
    if (t.value * b + t.remainder !== a || abs(t.remainder) >= abs(b) || t.remainder && (t.remainder < 0n) !== (a < 0n)) assert.fail(`binary ${a} ÷ ${b}`);
    if (r3.value * b + r3.remainder !== a || 2n * abs(r3.remainder) > abs(b)) assert.fail(`ternary ${a} ÷ ${b}`);
    if (2n * abs(r3.remainder) === abs(b) && r3.remainder && (r3.remainder < 0n) !== (a < 0n)) assert.fail(`ternary tie ${a} ÷ ${b}`);
    if (evaluate('mod', 'ternary', [a, b]).value !== r3.remainder || evaluate('mod', 'binary', [a, b]).value !== t.remainder) assert.fail(`mod ${a}, ${b}`);
  }
  // the shapes of 6.6: {value, remainder?} | {error}; MOD's value is the remainder
  assert.deepEqual(evaluate('mod', 'ternary', [19n, 5n]), {value: -1n});
  assert.deepEqual(evaluate('div', 'binary', [45n, 6n]), {value: 7n, remainder: 3n});
  assert.deepEqual(evaluate('shr', 'binary', [-13n, 2n]), {value: -3n, remainder: -1n});
  assert.deepEqual(evaluate('div', 'binary', [1n, 0n]), {error: 'zeroDivision'});
  assert.deepEqual(evaluate('shl', 'binary', [1n, -1n]), {error: 'domain'});
  assert.deepEqual(evaluate('min', 'binary', [1n, 2n]), {error: 'domain'});
  assert.deepEqual(evaluate('shl', 'binary', [1n, 5000n]), {error: 'tooBig'}, 'a count no tower could hold (6.10)');
  assert.equal(evaluate('mod', 'ternary', [19n, 5n]).value, -1n, '19 mod 5 = −1');
  assert.equal(evaluate('mod', 'ternary', [14n, 4n]).value, 2n, '14 mod 4 = 2');
  for (const base of ['binary', 'ternary']) for (const a of span(-300, 300)) for (let k = 0n; k <= 8n; k++) {
    const s = evaluate('shr', base, [a, k]), d = evaluate('div', base, [a, (base === 'binary' ? 2n : 3n) ** k]);
    if (s.value !== d.value || s.remainder !== d.remainder) assert.fail(`shr(${a}, ${k}) in ${base}`);
  }
  assert.deepEqual([evaluate('shr', 'binary', [-13n, 2n]).value, evaluate('shr', 'binary', [-13n, 2n]).remainder], [-3n, -1n]);
  assert.equal(-13n >> 2n, -4n, 'two\'s complement >> floors, which is why the machine refuses it');
});
test('gates are BigInt & | ^ ~, bit by bit through the sign lamp', () => {
  // AND, OR, XOR on lamp-form towers extended to a common height, lamps combined alike
  const gate = (op, a, b) => {
    const x = twos(a), y = twos(b), n = Math.max(x.bits.length, y.bits.length) + 1;
    const bit = (t, k) => k < t.bits.length ? t.bits[k] : t.lamp;
    const f = {and: (p, q) => p & q, or: (p, q) => p | q, xor: (p, q) => p ^ q}[op];
    return fromTwos(Uint8Array.from({length: n}, (_, k) => f(bit(x, k), bit(y, k))), f(x.lamp, y.lamp));
  };
  for (const a of span(-130, 130)) {
    const x = twos(a);
    assert.equal(fromTwos(x.bits.map(v => 1 - v), 1 - x.lamp), ~a, 'NOT flips every bit and the lamp');
    assert.equal(ev('not', 'binary', a), ~a);
    for (const b of span(-130, 130)) for (const op of ['and', 'or', 'xor']) {
      const want = {and: a & b, or: a | b, xor: a ^ b}[op];
      if (ev(op, 'binary', a, b) !== want || gate(op, a, b) !== want) assert.fail(`${a} ${op} ${b}`);
    }
  }
  assert.equal(ev('and', 'binary', -5n, 3n), 3n);
  assert.deepEqual([ev('and', 'binary', 12n, 10n), ev('or', 'binary', 12n, 10n), ev('xor', 'binary', 12n, 10n)], [8n, 14n, 6n]);
});
test('the pure borrow schedule: a donor always exists, at most 10 borrow beats for 0 ≤ i < r < 2000', () => {
  const bits = v => { const out = []; for (; v; v >>= 1) out.push(v & 1); return out.length ? out : [0]; };
  let most = 0;
  for (let r = 1; r < 2000; r++) {
    const rb = bits(r);
    for (let i = 0; i < r; i++) {
      const {steps, cells} = borrowSchedule(annihilateCells(rb, bits(i)));
      if (steps.length > most) most = steps.length;
      let v = 0; for (let k = cells.length - 1; k >= 0; k--) v = v * 2 + cells[k];
      if (v !== r - i || cells.length > 1 && !cells.at(-1)) assert.fail(`${r} − ${i}`);
    }
  }
  assert.equal(most, 10);
  // 12 − 5: L0 is owed, L2 bursts, and the donor at L3 lights L2 and L1 on its way down
  assert.deepEqual(borrowSchedule(annihilateCells(bits(12), bits(5))), {steps: [{k: 0, j: 3, shrink: true}], cells: [1, 1, 1]});
});
