// Two engines, one arithmetic (design 4.6): the digits a machine ADD leaves equal the final
// tokens of the equation space's unitPlanMany, in base 2 and balanced ternary. Every pair
// with |a|, |b| ≤ 20 is checked, and a lattice of the |a|, |b| ≤ 200 square, (7a + b) ≡ 0
// (mod 23), that meets every a and every b about seventeen times: the whole square would
// take some fifty seconds.
import test from 'node:test';
import assert from 'node:assert/strict';
import {unitPlanMany} from '../src/mvc/units.js';
import {planMachine} from '../src/machine/plan.js';
import {snapshotAt} from '../src/machine/scene.js';

const add = {n1: {op: 'add', parent: 'io', socket: 'C'}};
function machineDigits(a, b, base, pace) {
  const r = planMachine({tree: add, inputs: [String(a), String(b)], base, pace});
  assert.ok(r.ok, r.message);
  const end = snapshotAt(r.plan, r.plan.beats.length), out = [];
  for (const bulb of Object.values(end.bulbs)) out[bulb.l] = bulb.s;
  return out;
}
function cardDigits(a, b, base) {
  const out = [];
  for (const t of unitPlanMany(a, 'target', [{value: b, owner: 'source'}], {base}).final) out[t.place] = (out[t.place] ?? 0) + t.sign;
  return out;
}
const same = (x, y) => { for (let k = 0; k < Math.max(x.length, y.length); k++) if ((x[k] ?? 0) !== (y[k] ?? 0)) return false; return true; };
function* pairs() {
  for (let a = -200; a <= 200; a++) for (let b = -200; b <= 200; b++)
    if (Math.abs(a) <= 20 && Math.abs(b) <= 20 || ((7 * a + b) % 23 + 23) % 23 === 0) yield [a, b];
}
for (const base of ['binary', 'ternary']) {
  test(`a machine ADD ends with the digits unitPlanMany ends with, in ${base}`, () => {
    let n = 0;
    for (const [a, b] of pairs()) {
      const m = machineDigits(a, b, base), c = cardDigits(a, b, base);
      if (!same(m, c)) assert.fail(`${a} + ${b}: the machine shows ${m.join(',')}, the cards ${c.join(',')}`);
      n++;
    }
    assert.ok(n > 8000, `${n} pairs`);
  });
}
test('level pace ends with the same digits as together pace', () => {
  for (const base of ['binary', 'ternary']) for (let a = -60; a <= 60; a += 3) for (let b = -60; b <= 60; b += 7)
    assert.ok(same(machineDigits(a, b, base, 'level'), machineDigits(a, b, base, 'together')), `${a} + ${b} in ${base}`);
});
