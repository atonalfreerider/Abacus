import test from 'node:test';
import assert from 'node:assert/strict';
import { factor, isPrime, classify, shorthand, describe } from '../src/numbers/primes.js';
import { flat, shapeOf, Gap } from '../src/numbers/marbles.js';
import { Fingerprint, fingerprintSVG, BigPrime } from '../src/numbers/fingerprint.js';
import { styles } from '../src/mvc/theme.js';
import { renderEquation } from '../src/mvc/view.js';
import { EquationModel } from '../src/mvc/model.js';
const palette = styles.sketchpad.marble;

test('primality and factoring agree with a sieve and multiply back', () => {
  const sieve = Array(10001).fill(true); sieve[0] = sieve[1] = false;
  for (let i = 2; i * i <= 10000; i++) if (sieve[i]) for (let j = i * i; j <= 10000; j += i) sieve[j] = false;
  for (let n = 0; n <= 10000; n++) assert.equal(isPrime(n), sieve[n], String(n));
  for (const n of [360, 1001, 1024, 600851475143, 999999999999989, 2 ** 52, 9007199254740881, 1e15, 304250263527210]) {
    const f = factor(n);
    assert.equal(f.reduce((a, { p, k }) => a * BigInt(p) ** BigInt(k), 1n), BigInt(n), String(n));
    assert.ok(f.every(({ p }) => isPrime(p)) && f.every((x, i) => !i || f[i - 1].p < x.p), String(n));
  }
  assert.deepEqual(factor(1), []); assert.deepEqual(factor(-12), [{ p: 2, k: 2 }, { p: 3, k: 1 }]);
});

test('the colour language: gold prime, deep red p², blue pronic, grey composite, white unit', () => {
  assert.deepEqual([1, 2, 3, 4, 6, 8, 9, 12, 49, 90, 91, 360].map(classify), ['unit', 'prime', 'prime', 'square', 'pronic', 'composite', 'square', 'pronic', 'square', 'pronic', 'composite', 'composite']);
  assert.equal(shorthand(360), '2³ · 3² · 5');
  assert.equal(describe(90), '90 = 2 · 3² · 5 = 9 · 10: pronic');
  assert.equal(describe(12), '12 = 2² · 3 = 3 · 4: pronic');
  assert.equal(describe(91), '91 = 7 · 13: composite');
  assert.equal(describe(97), '97: prime');
});

test('marbles lie in symmetric spirals a marble apart', () => {
  for (const n of [2, 3, 5, 7, 11, 13, 97, 360, 1001]) {
    const { center, arms } = shapeOf(n), pts = flat(n, arms, center);
    assert.equal(pts.length, n);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) >= Gap - .031, `${n}: ${i}, ${j}`);
  }
  assert.deepEqual(shapeOf(7), { center: true, arms: 6 });
  assert.deepEqual(shapeOf(13), { center: true, arms: 6 });
  assert.deepEqual(shapeOf(5), { center: false, arms: 5 });
});

const marbles = svg => (svg.match(/<circle cx="[^"]+" cy="[^"]+" r="[^"]+" fill="url\(#fp/g) || []).length;
const rings = svg => (svg.match(/class="fp-ring"/g) || []).length / 2;
test('a fingerprint: badge, one container per prime, the exponent as tilted rings, and unpacked the whole volume', () => {
  const f = new Fingerprint(360);
  assert.deepEqual(f.factors, [2, 2, 2, 3, 3, 5]);
  const packed = f.render(0, { palette }).body;
  assert.equal(marbles(packed), 1 + 2 + 3 + 5, 'the badge and one container each of 2, 3 and 5');
  assert.equal(rings(packed), 2 + 1, 'two tilted rings round the 2, one round the 3');
  const opened = f.render(1, { palette }).body;
  assert.equal(marbles(opened), 1 + 2 + 2 + 2 + 3 + 3 + 5, 'the opened string: a container per factor');
  assert.equal(rings(opened), 0);
  const volume = f.render(f.phases, { palette }).body;
  assert.equal(marbles(volume), 1 + 360, 'the badge and all 360 marbles');
  // every phase in between draws without gaps in its numbers
  for (let ph = 0; ph <= f.phases; ph += .137) assert.doesNotMatch(f.render(ph, { palette, spin: ph * 40, digits: true }).body, /NaN|undefined/, String(ph));
  assert.equal(marbles(new Fingerprint(97).render(0, { palette }).body), 1 + 97);
  assert.equal(rings(new Fingerprint(2 ** 10).render(0, { palette }).body), 9, '2¹⁰ is a pair of marbles inside nine tilted rings');
});

test('a prime too big for marbles is written in its container, and huge numbers do not unpack', () => {
  const big = new Fingerprint(999983);
  assert.ok(999983 > BigPrime && big.volumeTooBig && !big.unpackable);
  assert.match(big.render(0, { palette }).body, /class="fp-big"[^>]*>999983</);
  assert.equal(new Fingerprint(1e15).volumeTooBig, true);
  assert.match(fingerprintSVG(1, { palette }), /<svg/);
  assert.match(fingerprintSVG(360, { palette, title: '360' }), /aria-label="360"/);
});

test('prime fingerprints can be drawn under every whole number in the equation space', () => {
  const state = new EquationModel('x + 91 = 360 - 49').state;
  const on = renderEquation(state, { fingerprints: true }), off = renderEquation(state, {});
  assert.equal((on.match(/class="term-fingerprint"/g) || []).length, 3);
  assert.doesNotMatch(off, /term-fingerprint/);
  assert.ok(Number(on.match(/viewBox="[^ ]+ [^ ]+ [^ ]+ ([^"]+)"/)[1]) > Number(off.match(/viewBox="[^ ]+ [^ ]+ [^ ]+ ([^"]+)"/)[1]), 'the band adds height');
});
