// Every binary and ternary block, exhaustively over small operands and at random near the
// limits: each plan's result equals the oracle and validatePlan finds every invariant (I1–I8)
// holding at every beat. Plans are pure: planned twice they are equal, and JSON-safe.
// The ~48 000 plans are checked by a pool of worker threads running this same file, so the
// file keeps to its 20 s budget (6.9).
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {planMachine, validatePlan, LIMITS} from '../src/machine/plan.js';
import {evaluate, OPS} from '../src/machine/oracle.js';
import {digits} from '../src/machine/bigmath.js';

const started = performance.now();
const tree = op => ({n1: {op, parent: 'io', socket: 'C'}});
const UNARY = ['not', 'neg'], SHIFTS = ['shl', 'shr'], DIVIDE = ['div', 'mod'];
const expected = (op, base, args) => {
  const r = evaluate(op, base, args.map(BigInt));
  if (op === 'div' || op === 'shr') return [String(r.value), String(r.remainder)];
  if (op === 'mod') return [String(r.quotient), String(r.value)];
  return [String(r.value)];
};
// One plan, checked: the oracle's answer, every invariant, MULT's beat count and, when
// asked, purity: planned twice it is equal and JSON-safe, and the faster of the two plans
// took under 50 ms (the slower may include the worker's JIT warm-up).
function check({op, base, args, pace = 'together', pure = false}) {
  const label = `${op}(${args.join(', ')}) in ${base}, ${pace}`, errs = [];
  const t0 = performance.now(), r = planMachine({tree: tree(op), inputs: args, base, pace}), ms = performance.now() - t0;
  if (!r.ok) return [`${label}: ${r.reason}: ${r.message}`];
  const values = expected(op, base, args);
  if (JSON.stringify(r.plan.result.values) !== JSON.stringify(values)) errs.push(`${label}: gives ${r.plan.result.values}, not ${values}`);
  for (const e of validatePlan(r.plan).slice(0, 3)) errs.push(`${label}: ${e}`);
  if (op === 'mul') {
    const nz = [...digits(BigInt(args[1]), base)].filter(Boolean).length, want = BigInt(args[0]) && BigInt(args[1]) ? 5 * nz - 3 : 2;
    const got = r.plan.beats.filter(b => b.kind !== 'carry').length - 4;
    if (got !== want) errs.push(`${label}: ${got} beats between FANOUT and OUTPUT, not 5·nz(B) − 3 = ${want}`);
  }
  if (pure) {
    const t1 = performance.now(), again = planMachine({tree: tree(op), inputs: args, base, pace}), fastest = Math.min(ms, performance.now() - t1);
    if (fastest >= 50) errs.push(`${label}: planned in ${fastest.toFixed(1)} ms`);
    try { assert.deepEqual(again.plan, r.plan); } catch { errs.push(`${label}: a second plan differs`); }
    try { assert.deepEqual(JSON.parse(JSON.stringify(r.plan)), r.plan); } catch { errs.push(`${label}: the plan does not survive JSON`); }
  }
  return errs;
}

const range = (lo, hi) => Array.from({length: hi - lo + 1}, (_, i) => String(lo + i));
function exhaustive() {
  const jobs = [];
  for (const base of ['binary', 'ternary']) for (const op of OPS[base]) for (const a of range(-20, 20)) {
    if (UNARY.includes(op)) { jobs.push({op, base, args: [a]}); continue; }
    for (const b of SHIFTS.includes(op) ? range(0, 6) : range(-20, 20)) {
      if (DIVIDE.includes(op) && b === '0') continue;
      jobs.push({op, base, args: [a, b]});
      if (['add', 'sub', 'mul'].includes(op)) jobs.push({op, base, args: [a, b], pace: 'level'});
    }
  }
  return jobs;
}
// Seeded random operands near the limits (6.10): sums, comparisons, gates and quotients up to
// the typed limit, MULT within len(a) + len(b) ≤ the tower cap, shifts within their counts.
const RANDOM_PAIRS = 200;
function randomJobs() {
  let seed = 20261021;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const sized = (base, levels) => {
    let v = 1n;
    for (let k = 1; k < levels; k++) v = base === 'binary' ? v * 2n + BigInt(int(0, 1)) : v * 3n + BigInt(int(-1, 1));
    return String(rand() < 0.5 ? -v : v);
  };
  const jobs = [];
  for (const base of ['binary', 'ternary']) {
    const cap = LIMITS[base].levels - 1;             // the typed limit: 63 bits, 40 trits
    for (const op of OPS[base]) for (let n = 0; n < RANDOM_PAIRS; n++) {
      let args;
      if (UNARY.includes(op)) args = [sized(base, int(cap - 20, cap))];
      else if (op === 'mul') { const la = int(1, cap - 1); args = [sized(base, la), sized(base, int(1, cap - la))]; }
      else if (op === 'shl') { const la = int(1, cap - 1); args = [sized(base, la), String(int(0, cap - la))]; }
      else if (op === 'shr') args = [sized(base, int(1, cap)), String(int(0, LIMITS[base].shr))];
      else args = [sized(base, int(cap - 20, cap)), sized(base, int(1, cap))];
      jobs.push({op, base, args, pure: true});
    }
  }
  return jobs;
}
// Deal the jobs round-robin to worker threads running this file.
async function pool(jobs) {
  const n = Math.max(1, Math.min(4, availableParallelism() - 1));
  if (n === 1) return {errors: jobs.flatMap(check), count: jobs.length};
  const shares = Array.from({length: n}, (_, k) => jobs.filter((_, i) => i % n === k));
  const errors = await Promise.all(shares.map(share => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {workerData: {jobs: share}});
    worker.once('message', resolve); worker.once('error', reject);
  })));
  return {errors: errors.flat(), count: jobs.length};
}

if (!isMainThread) parentPort.postMessage(workerData.jobs.flatMap(check));
else {
  test('every block in both bases over [−20, 20] (k ∈ [0, 6] for shifts, b ≠ 0 for ÷ and %; ADD, SUB and MULT in both paces)', async () => {
    const {errors, count} = await pool(exhaustive());
    assert.deepEqual(errors.slice(0, 10), []);
    assert.equal(count, 43091);
  });
  test(`${RANDOM_PAIRS} seeded random operands per block and base, near the limits: exact, pure, and planned in under 50 ms`, async () => {
    const {errors, count} = await pool(randomJobs());
    assert.deepEqual(errors.slice(0, 10), []);
    assert.equal(count, RANDOM_PAIRS * (OPS.binary.length + OPS.ternary.length));
  });
  test('the goldens plan twice to equal, JSON-safe plans in under 50 ms each', () => {
    const goldens = [['mul', 'binary', [5, 11]], ['mul', 'ternary', [5, -4]], ['add', 'binary', [13, 3]], ['add', 'ternary', [10, -5]],
      ['add', 'binary', [13, 9], 'level'], ['add', 'ternary', [4, 4], 'level'], ['mul', 'binary', [0, 9]], ['mul', 'ternary', [0, 9]],
      ['mul', 'binary', [16, 7]], ['mul', 'ternary', [16, 7]], ['div', 'binary', [45, 6]], ['div', 'ternary', [19, 5]], ['mod', 'ternary', [14, 4]],
      ['shr', 'binary', [-13, 2]], ['shr', 'binary', [5, 4]], ['not', 'binary', [5]], ['and', 'binary', [-5, 3]]];
    for (const [op, base, args, pace = 'together'] of goldens) assert.deepEqual(check({op, base, args: args.map(String), pace, pure: true}), []);
  });
  test('runs past the limits are refused, with the exact answer when there is one', () => {
    const big = planMachine({tree: tree('shl'), inputs: ['5', '70'], base: 'binary'});
    assert.equal(big.reason, 'tooBig'); assert.deepEqual(big.result.values, [String(5n << 70n)]);
    assert.equal(big.message, 'Too big to animate step by step; here is the exact answer.');
    assert.equal(planMachine({tree: tree('add'), inputs: [String(2n ** 63n), '1'], base: 'binary'}).reason, 'input');
    assert.equal(planMachine({tree: tree('add'), inputs: [String((3n ** 40n - 1n) / 2n + 1n), '1'], base: 'ternary'}).reason, 'input');
    assert.ok(planMachine({tree: tree('add'), inputs: [String(2n ** 63n - 1n), String(2n ** 63n - 1n)], base: 'binary'}).ok);
    assert.ok(planMachine({tree: tree('mul'), inputs: [String(2n ** 32n - 1n), String(2n ** 32n - 1n)], base: 'binary'}).ok);
    assert.equal(planMachine({tree: {}, inputs: ['1'], base: 'binary'}).reason, 'arity');
    assert.equal(planMachine({tree: tree('add'), inputs: ['1'], base: 'binary'}).message, 'This machine takes 2 numbers');
    assert.equal(planMachine({tree: tree('min'), inputs: ['1', '2'], base: 'binary'}).reason, 'input');
    assert.equal(planMachine({tree: tree('add'), inputs: '[16,7]', base: 'binary'}).plan.result.text, '[23]');
  });
  test('machine-plan.test.js runs in under 20 s', () => {
    assert.ok(performance.now() - started < 20000, `${Math.round(performance.now() - started)} ms`);
  });
}
