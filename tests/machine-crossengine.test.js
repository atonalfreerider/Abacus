// Two engines, one arithmetic (design 4.6): the digits a machine ADD leaves equal the final
// tokens of the equation space's unitPlanMany, in base 2 and balanced ternary.
//  * Every pair with |a|, |b| ≤ 20 runs the whole planMachine, flow beats and all.
//  * The |a|, |b| ≤ 200 square (6.9) runs the ADD planner itself, on a builder that skips its
//    per-beat checks (the bulbs are the same, as the first test shows; machine-plan.test.js
//    proves the checks). By default that is the lattice (7a + b) ≡ 0 (mod 11), which meets
//    every a and every b about 36 times. MACHINE_FULL_SQUARE=1 checks all 2 × 401² pairs:
//    about as much CPU as machine-plan.test.js, too much for the suite's 30 s budget.
// The rows are shared out to worker threads running this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {unitPlanMany} from '../src/mvc/units.js';
import {planMachine} from '../src/machine/plan.js';
import {PlanBuilder} from '../src/machine/builder.js';
import {getBase} from '../src/machine/registry.js';
import {snapshotAt} from '../src/machine/scene.js';

const FULL = process.env.MACHINE_FULL_SQUARE === '1';
const add = {n1: {op: 'add', parent: 'io', socket: 'C'}};
const digitsOf = bulbs => { const out = []; for (const bulb of bulbs) out[bulb.l] = bulb.s; return out; };
// The whole run: the bulbs left in Output after the last beat.
function machineDigits(a, b, base, pace) {
  const r = planMachine({tree: add, inputs: [String(a), String(b)], base, pace});
  assert.ok(r.ok, r.message);
  return digitsOf(Object.values(snapshotAt(r.plan, r.plan.beats.length).bulbs));
}
// The ADD block's beats alone: the inputs stand as towers and the base's own ADD planner plays.
function plannerDigits(a, b, base) {
  const builder = new PlanBuilder({base, tree: add, inputs: [String(a), String(b)], check: false});
  const {result} = getBase(base).ops.add(builder, 'n1', ['t1', 't2']);
  return digitsOf(builder.bulbsOf(result).map(([, bulb]) => bulb));
}
function cardDigits(a, b, base) {
  const out = [];
  for (const t of unitPlanMany(a, 'target', [{value: b, owner: 'source'}], {base}).final) out[t.place] = (out[t.place] ?? 0) + t.sign;
  return out;
}
const same = (x, y) => { for (let k = 0; k < Math.max(x.length, y.length); k++) if ((x[k] ?? 0) !== (y[k] ?? 0)) return false; return true; };
const shown = d => Array.from({length: d.length}, (_, k) => d[k] ?? 0).join(',');
const inSquare = (a, b) => FULL || ((7 * a + b) % 11 + 11) % 11 === 0;
// Rows [base, a] of the square, checked: per base, the pairs and the first few disagreements.
function rows(list) {
  const out = {};
  for (const [base, a] of list) {
    const r = out[base] ??= {errors: [], pairs: 0};
    for (let b = -200; b <= 200; b++) {
      if (!inSquare(a, b)) continue;
      const m = plannerDigits(a, b, base), c = cardDigits(a, b, base);
      if (!same(m, c) && r.errors.length < 5) r.errors.push(`${a} + ${b} in ${base}: the machine shows ${shown(m)}, the cards ${shown(c)}`);
      r.pairs++;
    }
  }
  return out;
}
// Both bases' rows share one pool, dealt round-robin: up to three workers, or the main
// thread alone on one CPU. Three leave the rest of a 4-core machine to machine-plan.test.js,
// whose pool runs at the same time and holds its own time budget.
const WORKERS = Math.min(3, availableParallelism());
async function square() {
  const list = [];
  for (let a = -200; a <= 200; a++) for (const base of ['binary', 'ternary']) list.push([base, a]);
  if (WORKERS < 2) return rows(list);
  const parts = await Promise.all(Array.from({length: WORKERS}, (_, k) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {workerData: list.filter((_, i) => i % WORKERS === k)});
    worker.once('message', resolve); worker.once('error', reject);
  })));
  const out = {};
  for (const part of parts) for (const [base, {errors, pairs}] of Object.entries(part)) {
    const r = out[base] ??= {errors: [], pairs: 0}; r.errors.push(...errors); r.pairs += pairs;
  }
  return out;
}

if (!isMainThread) parentPort.postMessage(rows(workerData));
else {
  const checked = square();
  let want = 0;
  for (let a = -200; a <= 200; a++) for (let b = -200; b <= 200; b++) if (inSquare(a, b)) want++;
  test('every pair with |a|, |b| ≤ 20: the whole run leaves the ADD planner\'s digits, and the cards\'', () => {
    for (const base of ['binary', 'ternary']) for (let a = -20; a <= 20; a++) for (let b = -20; b <= 20; b++) {
      const m = machineDigits(a, b, base), c = cardDigits(a, b, base);
      if (!same(m, plannerDigits(a, b, base))) assert.fail(`${a} + ${b} in ${base}: the run and the planner differ`);
      if (!same(m, c)) assert.fail(`${a} + ${b} in ${base}: the machine shows ${shown(m)}, the cards ${shown(c)}`);
    }
  });
  for (const base of ['binary', 'ternary']) {
    test(`a machine ADD ends with the digits unitPlanMany ends with, on ${FULL ? 'every pair of' : 'a lattice of'} the |a|, |b| ≤ 200 square in ${base}`, async () => {
      const {errors, pairs} = (await checked)[base];
      assert.deepEqual(errors, []);
      assert.equal(pairs, want);
    });
  }
  test('level pace ends with the same digits as together pace', () => {
    for (const base of ['binary', 'ternary']) for (let a = -60; a <= 60; a += 3) for (let b = -60; b <= 60; b += 7)
      assert.ok(same(machineDigits(a, b, base, 'level'), machineDigits(a, b, base, 'together')), `${a} + ${b} in ${base}`);
  });
}
