// The survivor rule (design 2.1) over every possible level: the tables of 2.2 row by row,
// the opposite-colour rule of 2.3, and the gates of 2.8, each conserving value, leaving one
// bulb at the level (the climber one level up), lit in flight, and bursting fading carries.
import test from 'node:test';
import assert from 'node:assert/strict';
import {survivor, annihilate} from '../src/machine/ops/collide.js';
import {gateCell} from '../src/machine/ops/logic.js';

const T = -1, X = null;   // X: absent
// [r, i, c, d, c′, stay, climb?, fade[], burst?] from the tables of 2.2 (blue binary)
const BINARY = [
  [0, 0, X, 0, 0, 'R', [], 'R stays dark; I fades', ['I']],
  [0, 1, X, 1, 0, 'I', [], 'I stays lit; R fades', ['R']],
  [1, 0, X, 1, 0, 'R', [], 'R stays; I fades', ['I']],
  [1, 1, X, 0, 1, 'I', ['R'], 'R climbs (the carry); I stays and goes dark', []],
  [0, 0, 1, 1, 0, 'C', [], 'C stays lit; R and I fade', ['R', 'I']],
  [0, 1, 1, 0, 1, 'C', ['R'], 'R lights blue and climbs; C goes dark and stays; I fades', ['I']],
  [1, 0, 1, 0, 1, 'C', ['R'], 'R climbs; C goes dark and stays; I fades', ['I']],
  [1, 1, 1, 1, 1, 'C', ['R'], 'R climbs; C stays lit; I fades', ['I']],
  [0, X, X, 0, 0, 'R', [], 'R stays', []],
  [1, X, X, 1, 0, 'R', [], 'R stays', []],
  [0, X, 1, 1, 0, 'C', [], 'C stays lit; R fades', ['R']],
  [1, X, 1, 0, 1, 'C', ['R'], 'R climbs; C goes dark and stays', []],
  [X, X, 1, 1, 0, 'C', [], 'C stays: a new level', []],
];
// [r, i, c, s, d, c′, stay, climb, what you see, fade, burst] (balanced ternary, T = −1)
const TERNARY = [
  [T, T, X, -2, 1, T, 'I', 'R', 'R climbs red; I turns blue and stays', [], false],
  [T, T, T, -3, 0, T, 'C', 'R', 'R climbs red; C goes dark and stays; I fades', ['I'], false],
  [T, T, 1, -1, T, 0, 'R', X, 'R stays; C and I fade (burst)', ['C', 'I'], true],
  [T, 0, X, -1, T, 0, 'R', X, 'R stays; I fades', ['I'], false],
  [T, 0, T, -2, 1, T, 'C', 'R', 'R climbs red; C turns blue and stays; I fades', ['I'], false],
  [T, 0, 1, 0, 0, 0, 'I', X, 'I stays; R and C fade (burst)', ['R', 'C'], true],
  [T, 1, X, 0, 0, 0, 'R', X, 'R goes dark and stays; I fades (burst)', ['I'], true],
  [T, 1, T, -1, T, 0, 'R', X, 'R stays; C and I fade (burst)', ['C', 'I'], true],
  [T, 1, 1, 1, 1, 0, 'C', X, 'C stays; R and I fade (burst)', ['R', 'I'], true],
  [0, T, X, -1, T, 0, 'I', X, 'I stays; R fades', ['R'], false],
  [0, T, T, -2, 1, T, 'C', 'R', 'R lights red and climbs; C turns blue and stays; I fades', ['I'], false],
  [0, T, 1, 0, 0, 0, 'R', X, 'R stays; C and I fade (burst)', ['C', 'I'], true],
  [0, 0, X, 0, 0, 0, 'R', X, 'R stays; I fades', ['I'], false],
  [0, 0, T, -1, T, 0, 'C', X, 'C stays; R and I fade', ['R', 'I'], false],
  [0, 0, 1, 1, 1, 0, 'C', X, 'C stays; R and I fade', ['R', 'I'], false],
  [0, 1, X, 1, 1, 0, 'I', X, 'I stays; R fades', ['R'], false],
  [0, 1, T, 0, 0, 0, 'R', X, 'R stays; C and I fade (burst)', ['C', 'I'], true],
  [0, 1, 1, 2, T, 1, 'C', 'R', 'R lights blue and climbs; C turns red and stays; I fades', ['I'], false],
  [1, T, X, 0, 0, 0, 'R', X, 'R goes dark and stays; I fades (burst)', ['I'], true],
  [1, T, T, -1, T, 0, 'C', X, 'C stays; R and I fade (burst)', ['R', 'I'], true],
  [1, T, 1, 1, 1, 0, 'R', X, 'R stays; C and I fade (burst)', ['C', 'I'], true],
  [1, 0, X, 1, 1, 0, 'R', X, 'R stays; I fades', ['I'], false],
  [1, 0, T, 0, 0, 0, 'I', X, 'I stays; R and C fade (burst)', ['R', 'C'], true],
  [1, 0, 1, 2, T, 1, 'C', 'R', 'R climbs blue; C turns red and stays; I fades', ['I'], false],
  [1, 1, X, 2, T, 1, 'I', 'R', 'R climbs blue; I turns red and stays', [], false],
  [1, 1, T, 1, 1, 0, 'R', X, 'R stays; C and I fade (burst)', ['C', 'I'], true],
  [1, 1, 1, 3, 0, 1, 'C', 'R', 'R climbs blue; C goes dark and stays; I fades', ['I'], false],
  // the donor shorter (I absent)
  [T, X, T, -2, 1, T, 'C', 'R', 'R climbs red; C turns blue and stays', [], false],
  [T, X, 1, 0, 0, 0, 'R', X, 'R goes dark and stays; C fades (burst)', ['C'], true],
  [0, X, T, -1, T, 0, 'C', X, 'C stays; R fades', ['R'], false],
  [0, X, 1, 1, 1, 0, 'C', X, 'C stays; R fades', ['R'], false],
  [1, X, T, 0, 0, 0, 'R', X, 'R goes dark and stays; C fades (burst)', ['C'], true],
  [1, X, 1, 2, T, 1, 'C', 'R', 'R climbs blue; C turns red and stays', [], false],
  [X, X, T, -1, T, 0, 'C', X, 'C stays: a new level', [], false],
  [X, X, 1, 1, 1, 0, 'C', X, 'C stays: a new level', [], false],
  [T, X, X, -1, T, 0, 'R', X, 'R stays', [], false],
  [0, X, X, 0, 0, 0, 'R', X, 'R stays', [], false],
  [1, X, X, 1, 1, 0, 'R', X, 'R stays', [], false],
];
// The properties every case must have, whatever the table says.
function sound(base, {r, i, c}, res, label) {
  const radix = base === 'ternary' ? 3 : 2, s = (r ?? 0) + (i ?? 0) + (c ?? 0);
  assert.equal(s, res.d + radix * res.cOut, `${label}: conserves value`);
  const present = ['R', 'I', 'C'].filter(x => ({R: r, I: i, C: c})[x] !== null);
  assert.deepEqual([res.stay, ...(res.climb ? [res.climb] : []), ...res.fade].sort(), present.sort(), `${label}: every bulb has one fate`);
  assert.equal(!!res.climb, res.cOut !== 0, `${label}: the resident climbs exactly when a carry leaves`);
  if (res.climb) {
    const flight = res.via ?? r;
    assert.equal(flight, res.cOut, `${label}: the climber shows the carry's state in flight`);
    assert.equal(res.via !== null, r === 0, `${label}: via exactly when R is dark`);
  } else assert.equal(res.via, null);
  if (res.fade.includes('C')) assert.ok(res.burst, `${label}: a fading carry fades in a burst`);
  const lit = [r, i, c].filter(x => x);
  assert.equal(res.burst, lit.includes(1) && lit.includes(-1), `${label}: burst exactly when both colours meet`);
}

test('binary, blue: the 13 cases of 2.2', () => {
  assert.equal(BINARY.length, 13);
  for (const [r, i, c, d, cOut, stay, climb, see, fade] of BINARY) {
    const res = survivor({base: 'binary', r, i, c}), label = `(${r}, ${i}, ${c}): ${see}`;
    assert.deepEqual({d: res.d, cOut: res.cOut, stay: res.stay, climb: res.climb ? [res.climb] : [], fade: res.fade}, {d, cOut, stay, climb, fade}, label);
    sound('binary', {r, i, c}, res, label);
  }
});
test('binary, red: the 13 mirrors', () => {
  const neg = x => x === null ? null : -x || 0;
  for (const [r, i, c, d, cOut, stay, climb, see, fade] of BINARY) {
    const res = survivor({base: 'binary', r: neg(r), i: neg(i), c: neg(c)}), label = `red (${r}, ${i}, ${c}): ${see}`;
    assert.deepEqual({d: res.d, cOut: res.cOut, stay: res.stay, climb: res.climb ? [res.climb] : [], fade: res.fade}, {d: neg(d), cOut: neg(cOut), stay, climb, fade}, label);
    sound('binary', {r: neg(r), i: neg(i), c: neg(c)}, res, label);
  }
});
test('binary, opposite colours: the 12 annihilation cases of 2.3', () => {
  let n = 0;
  for (const sigma of [1, -1]) for (const r of [0, sigma]) for (const i of [0, -sigma, null]) {
    const res = annihilate({r, i}), label = `σ ${sigma}: (${r}, ${i})`;
    n++;
    if (r && i) assert.deepEqual(res, {stay: 'R', d: 0, fade: ['I'], owed: false, burst: true}, `${label}: burst; R goes dark; I fades`);
    else if (i) assert.deepEqual(res, {stay: 'I', d: -sigma, fade: ['R'], owed: true, burst: false}, `${label}: I stays, owed, in its own colour`);
    else assert.deepEqual(res, {stay: 'R', d: r, fade: i === null ? [] : ['I'], owed: false, burst: false}, `${label}: R stays`);
    assert.equal(res.d, r + (i ?? 0), `${label}: conserves value`);
  }
  assert.equal(n, 12);
});
test('balanced ternary: the 38 cases of 2.2', () => {
  assert.equal(TERNARY.length, 38);
  const seen = new Set();
  for (const [r, i, c, s, d, cOut, stay, climb, see, fade, burst] of TERNARY) {
    seen.add(`${r},${i},${c}`);
    const res = survivor({base: 'ternary', r, i, c}), label = `(${r}, ${i}, ${c}): ${see}`;
    assert.equal((r ?? 0) + (i ?? 0) + (c ?? 0), s, label);
    assert.deepEqual({d: res.d, cOut: res.cOut, stay: res.stay, climb: res.climb, fade: res.fade, burst: res.burst}, {d, cOut, stay, climb, fade, burst}, label);
    sound('ternary', {r, i, c}, res, label);
  }
  // every possible level: r ∈ {T,0,1}, i ∈ {T,0,1,∅}, c ∈ {T,1,∅}, plus (∅, ∅, ±1)
  for (const r of [T, 0, 1]) for (const i of [T, 0, 1, X]) for (const c of [T, 1, X]) assert.ok(seen.has(`${r},${i},${c}`), `${r},${i},${c}`);
});
test('XOR (6 cases) and SUM (12 cases): the same rule with the carry thrown away', () => {
  let n = 0;
  for (const r of [0, 1]) for (const i of [0, 1, X]) {
    const g = gateCell('xor', r, i ?? 0), res = survivor({base: 'binary', r, i});
    assert.equal(g.d, r ^ (i ?? 0)); assert.equal(res.d, g.d);
    assert.equal(!!g.up, r === 1 && i === 1, 'two lit bulbs make a carry that evaporates');
    sound('binary', {r, i, c: null}, res, `xor (${r}, ${i})`);
    n++;
  }
  for (const r of [T, 0, 1]) for (const i of [T, 0, 1, X]) {
    const g = gateCell('sum', r, i ?? 0), res = survivor({base: 'ternary', r, i}), s = r + (i ?? 0);
    assert.equal(g.d, s > 1 ? s - 3 : s < -1 ? s + 3 : s, 'the balanced sum mod 3');
    assert.equal(!!g.up, Math.abs(s) === 2);
    sound('ternary', {r, i, c: null}, res, `sum (${r}, ${i})`);
    n++;
  }
  assert.equal(n, 18);
});
test('the other gates of 2.8 keep their survivors: AND, OR, MIN, MAX, CONS', () => {
  const rows = (op, pairs) => pairs.map(([r, i]) => { const g = gateCell(op, r, i); return `${g.stay}${g.d}`; });
  // AND: dark wins; OR: lit wins (binary, R then I)
  assert.deepEqual(rows('and', [[1, 1], [1, 0], [0, 1], [0, 0]]), ['R1', 'R0', 'R0', 'R0']);
  assert.deepEqual(rows('or', [[1, 1], [1, 0], [0, 1], [0, 0]]), ['R1', 'R1', 'I1', 'R0']);
  assert.deepEqual(rows('xor', [[1, 1], [1, 0], [0, 1], [0, 0]]), ['I0', 'R1', 'I1', 'R0']);
  for (const r of [T, 0, 1]) for (const i of [T, 0, 1]) {
    const min = gateCell('min', r, i), max = gateCell('max', r, i), cons = gateCell('cons', r, i);
    assert.equal(min.d, Math.min(r, i)); assert.equal(max.d, Math.max(r, i)); assert.equal(cons.d, r === i ? r : 0);
    assert.equal(min.stay, i < r ? 'I' : 'R', 'red beats dark beats blue; on a tie R stays');
    assert.equal(max.stay, i > r ? 'I' : 'R', 'blue beats dark beats red; on a tie R stays');
    assert.equal(cons.stay, 'R', 'equal: R stays; unequal: R darkens');
  }
});
