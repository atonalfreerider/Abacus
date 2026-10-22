// The machine's exact digits: round trips, two's complement in lamp normal form, the
// tritwise gates and both division conventions, checked against BigInt and against
// independent definitions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {digits, fromDigits, twos, fromTwos, tritwise, trit, divTrunc, divRound, fmt, fmtOperand, baseString, bitLength} from '../src/machine/bigmath.js';

test('digits and fromDigits round-trip every |n| ≤ 10⁶ in both bases, with normal-form digits', () => {
  for (let n = -1000000; n <= 1000000; n++) {
    const v = BigInt(n), b = digits(v, 'binary'), t = digits(v, 'ternary');
    if (fromDigits(b, 'binary') !== v || fromDigits(t, 'ternary') !== v) assert.fail(`${n} does not round-trip`);
    // no leading zeros (zero is a single 0); binary lit bits carry the sign; trits are −1, 0, 1
    if (b.length > 1 && !b.at(-1) || t.length > 1 && !t.at(-1)) assert.fail(`${n} has a leading zero`);
    if (n && b.some(d => d && Math.sign(d) !== Math.sign(n))) assert.fail(`${n} mixes signs in binary`);
  }
  for (const v of [2n ** 62n + 12345n, -(2n ** 63n - 1n), (3n ** 40n - 1n) / 2n, -((3n ** 40n - 1n) / 2n)]) {
    assert.equal(fromDigits(digits(v, 'binary'), 'binary'), v); assert.equal(fromDigits(digits(v, 'ternary'), 'ternary'), v);
  }
  assert.deepEqual([...digits(0n, 'binary')], [0]); assert.deepEqual([...digits(0n, 'ternary')], [0]);
  assert.deepEqual([...digits(-5n, 'binary')], [-1, 0, -1]);
  assert.deepEqual([...digits(-5n, 'ternary')], [1, 1, -1], '−5 = T11');
  assert.equal(digits((3n ** 40n - 1n) / 2n, 'ternary').length, 40);
  assert.equal(digits(2n ** 63n - 1n, 'binary').length, 63);
});

test('two\'s complement is in lamp normal form: 0, −1, −2, −4, −2^62 and every n in [−4096, 4096]', () => {
  const show = n => { const {bits, lamp} = twos(n); return `${[...bits].reverse().join('')}|${lamp}`; };
  assert.equal(show(0n), '0|0');
  assert.equal(show(-1n), '1|1', '−1 = 1 under a lit lamp at L1');
  assert.equal(show(-2n), '0|1', '−2 = 0 under a lit lamp at L1');
  assert.equal(show(-4n), '00|1', '−4 = 00 under a lit lamp at L2');
  assert.equal(show(-6n), '010|1', 'NOT 5 = 010 under a red lamp');
  assert.equal(show(-(2n ** 62n)), '0'.repeat(62) + '|1');
  assert.equal(show(5n), '101|0');
  for (let n = -4096n; n <= 4096n; n++) {
    const {bits, lamp} = twos(n);
    assert.equal(fromTwos(bits, lamp), n);
    // the top bit differs from the lamp unless only level 0 is left
    if (bits.length > 1) assert.notEqual(bits.at(-1), lamp, `${n}`);
    assert.equal(lamp, n < 0n ? 1 : 0);
  }
  for (const n of [2n ** 62n, -(2n ** 63n), 2n ** 63n - 1n]) assert.equal(fromTwos(twos(n).bits, twos(n).lamp), n);
});

test('tritwise min, max, sum and cons work trit by trit', () => {
  const rows = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]];
  assert.deepEqual(rows.map(([x, y]) => trit('sum', x, y)), [1, -1, 0, -1, 0, 1, 0, 1, -1], 'the balanced sum mod 3');
  assert.deepEqual(rows.map(([x, y]) => trit('cons', x, y)), [-1, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(rows.map(([x, y]) => trit('min', x, y)), [-1, -1, -1, -1, 0, 0, -1, 0, 1]);
  assert.equal(tritwise('min', 2n, 1n), -1n, 'MIN(1T, 01) = 0T');
  assert.equal(tritwise('max', 2n, 1n), 4n, 'MAX(1T, 01) = 11');
  assert.equal(tritwise('sum', 5n, 7n), -6n);
  assert.equal(tritwise('cons', 5n, 7n), 6n);
  for (let a = -200; a <= 200; a += 3) for (let b = -200; b <= 200; b += 7) {
    const da = digits(BigInt(a), 'ternary'), db = digits(BigInt(b), 'ternary');
    for (const op of ['min', 'max', 'sum', 'cons']) {
      const want = Array.from({length: Math.max(da.length, db.length)}, (_, k) => trit(op, da[k] ?? 0, db[k] ?? 0));
      assert.equal(tritwise(op, BigInt(a), BigInt(b)), fromDigits(want, 'ternary'));
    }
  }
});

test('divTrunc is BigInt / and %; divRound is the nearest quotient with ties toward zero, odd-symmetric', () => {
  for (let a = -300n; a <= 300n; a++) for (let b = -40n; b <= 40n; b++) if (b) assert.deepEqual(divTrunc(a, b), {q: a / b, r: a % b});
  assert.deepEqual(divTrunc(2n ** 63n - 1n, 3n), {q: (2n ** 63n - 1n) / 3n, r: 1n});
  for (let a = -2000n; a <= 2000n; a++) for (let b = -60n; b <= 60n; b++) {
    if (!b) continue;
    const {q, r} = divRound(a, b);
    // independently: of the two integers around a/b, the nearer; a tie goes toward zero
    const lo = (a - ((a % b) + b) % b) / b, hi = lo + 1n;    // lo = ⌊a/b⌋ for either sign of b
    const far = x => { const d = a - x * b; return d < 0n ? -d : d; };
    const want = far(lo) < far(hi) ? lo : far(hi) < far(lo) ? hi : (lo < 0n ? -lo : lo) < (hi < 0n ? -hi : hi) ? lo : hi;
    if (q !== want || a !== q * b + r) assert.fail(`${a} ÷ ${b}: ${q} r ${r}, not ${want}`);
    if (2n * (r < 0n ? -r : r) > (b < 0n ? -b : b)) assert.fail(`${a} ÷ ${b}: |r| > |b|/2`);
    if (2n * (r < 0n ? -r : r) === (b < 0n ? -b : b) && r && (r < 0n) !== (a < 0n)) assert.fail(`${a} ÷ ${b}: a tie must keep a's sign`);
    const neg = divRound(-a, b);
    if (neg.q !== -q || neg.r !== -r) assert.fail(`${a} ÷ ${b}: not odd-symmetric`);
  }
  assert.deepEqual(divRound(19n, 5n), {q: 4n, r: -1n});
  assert.deepEqual(divRound(14n, 4n), {q: 3n, r: 2n});
  assert.deepEqual(divRound(17n, 5n), {q: 3n, r: 2n});
  assert.deepEqual(divRound(15n, 4n), {q: 4n, r: -1n});
});

test('formatting: U+2212, parenthesised negative operands, digit strings with bases.js suffixes', () => {
  assert.equal(fmt('-20'), '−20'); assert.equal(fmt(7n), '7');
  assert.equal(fmtOperand('-20'), '(−20)'); assert.equal(fmtOperand(20n), '20');
  assert.equal(baseString(112n, 'binary'), '1110000₂');
  assert.equal(baseString(112n, 'ternary'), '11011 bal₃');
  assert.equal(baseString(-5n, 'ternary'), 'T11 bal₃');
  assert.equal(baseString(-13n, 'binary'), '−1101₂');
  assert.equal(baseString(-6n, 'binary', {lamp: true}), '…1010₂');
  assert.equal(baseString(8n, 'binary', {lamp: true}), '…01000₂');
  assert.equal(baseString(0n, 'binary'), '0₂'); assert.equal(baseString(0n, 'ternary'), '0 bal₃');
  assert.equal(baseString(257n, 'binary'), '100000001₂', 'PRIME read 257 as 256');
  assert.equal(bitLength(0n), 0); assert.equal(bitLength(-8n), 4);
});
