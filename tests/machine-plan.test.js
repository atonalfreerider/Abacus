// Every binary and ternary block, exhaustively over small operands and at random near the
// limits, and seeded random machines of several blocks: each plan's result equals the oracle
// and validatePlan finds every invariant (I1–I8) holding at every beat. Plans are pure:
// planned twice they are equal, and JSON-safe. The ~49 000 plans are checked by a pool of
// worker threads running this same file, so the file keeps to its 20 s budget (6.9).
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {planMachine, validatePlan, LIMITS} from '../src/machine/plan.js';
import {evaluate, OPS} from '../src/machine/oracle.js';
import {digits} from '../src/machine/bigmath.js';
import {ARITY, parseExpression} from '../src/machine/tree.js';

const started = performance.now();
const tree = op => ({n1: {op, parent: 'io', socket: 'C'}});
const UNARY = ['not', 'neg'], SHIFTS = ['shl', 'shr'], DIVIDE = ['div', 'mod'], QUOTIENTS = ['div', 'mod', 'shr'];
const expected = (op, base, args) => {
  const r = evaluate(op, base, args.map(BigInt));
  if (op === 'div' || op === 'shr') return [String(r.value), String(r.remainder)];
  if (op === 'mod') return [String(r.quotient), String(r.value)];
  return [String(r.value)];
};
// One plan, checked: the oracle's answer, every invariant, MULT's beat count and, when
// asked, purity: planned twice it is equal and JSON-safe, and the faster of the two plans
// took under 50 ms. A worker shares the machine with the rest of the suite, so a plan it
// finds slow is reported as {slow} and timed again on the main thread once the pool is done.
const slowMark = job => `slow ${JSON.stringify(job)}`;
// A JSON round trip deep-equals exactly the data made of strings, finite numbers other than
// −0, booleans, null, arrays and plain objects without undefined values.
function jsonSafe(x) {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return true;
  if (typeof x === 'number') return Number.isFinite(x) && !Object.is(x, -0);
  if (Array.isArray(x)) return x.every(jsonSafe);
  if (typeof x !== 'object' || Object.getPrototypeOf(x) !== Object.prototype) return false;
  for (const k in x) if (x[k] === undefined || !jsonSafe(x[k])) return false;
  return true;
}
// Deep equality of JSON-safe data (key order aside).
function same(x, y) {
  if (x === y) return true;
  if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null || Array.isArray(x) !== Array.isArray(y)) return false;
  const kx = Object.keys(x);
  if (kx.length !== Object.keys(y).length) return false;
  for (const k of kx) if (!(k in y) || !same(x[k], y[k])) return false;
  return true;
}
// A job that throws (a planner or validatePlan bug) is reported as that job's error.
function check(job) {
  try { return job.tree || job.text ? checkMachine(job) : checkBlock(job); }
  catch (e) { return [`${job.text ?? (job.tree ? textOf(job.tree, job.inputs) : `${job.op}(${job.args.join(', ')})`)} in ${job.base}: throws ${e.message}`]; }
}
function checkBlock(job) {
  const {op, base, args, pace = 'together', pure = false} = job;
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
    if (fastest >= 50) errs.push(isMainThread ? `${label}: planned in ${fastest.toFixed(1)} ms` : slowMark(job));
    if (!jsonSafe(r.plan)) errs.push(`${label}: the plan does not survive JSON`);
    else if (!same(again.plan, r.plan)) errs.push(`${label}: a second plan differs`);
  }
  return errs;
}

// A machine of several blocks, against the oracle block by block: below the root DIV and SHR
// pass q up and MOD passes r; the root's DIV, MOD and SHR give [q, r]. A machine the oracle
// cannot run (a zero divisor, a negative count) must be refused for that reason on that block.
const socketsOf = op => ARITY[op] === 1 ? ['C'] : ['L', 'R'];
function oracleOf(tree, inputs, base) {
  const ids = Object.keys(tree), root = ids.find(id => tree[id].parent === 'io');
  const child = (id, s) => ids.find(c => tree[c].parent === id && tree[c].socket === s);
  let next = 0;
  const visit = id => {
    const op = tree[id].op, args = [];
    for (const s of socketsOf(op)) {
      const c = child(id, s), v = c ? visit(c) : {value: BigInt(inputs[next++])};
      if (v.error) return v;
      args.push(v.value);
    }
    const quotient = id === root && QUOTIENTS.includes(op), r = evaluate(op === 'mod' && quotient ? 'div' : op, base, args);
    return r.error ? {error: r.error, node: id} : quotient ? {values: [r.value, r.remainder]} : {value: r.value};
  };
  const r = visit(root);
  return r.error ? r : {values: (r.values ?? [r.value]).map(String)};
}
const textOf = (tree, inputs) => {
  const ids = Object.keys(tree);
  let next = 0;
  const visit = id => `${tree[id].op}(${socketsOf(tree[id].op).map(s => {
    const c = ids.find(x => tree[x].parent === id && tree[x].socket === s);
    return c ? visit(c) : inputs[next++];
  }).join(', ')})`;
  return visit(ids.find(id => tree[id].parent === 'io'));
};
function checkMachine({text, tree, inputs, base, pace = 'together'}) {
  if (text) {
    const e = parseExpression(text, base);
    if (!e.ok) return [`${text} in ${base}: ${e.error}`];
    ({tree, inputs} = e);
  }
  const label = `${textOf(tree, inputs)} in ${base}, ${pace}`, want = oracleOf(tree, inputs, base);
  const r = planMachine({tree, inputs, base, pace});
  if (want.error) {
    const right = !r.ok && r.reason === want.error && (r.reason === 'tooBig' || r.node === want.node);
    return right ? [] : [`${label}: should be refused (${want.error} at ${want.node}), not ${r.ok ? 'planned' : `${r.reason} at ${r.node}`}`];
  }
  if (!r.ok) {
    // a value past the tower cap is refused, with the exact answer
    if (r.reason === 'tooBig' && JSON.stringify(r.result?.values) === JSON.stringify(want.values)) return [];
    return [`${label}: ${r.reason}: ${r.message}`];
  }
  const errs = [];
  if (JSON.stringify(r.plan.result.values) !== JSON.stringify(want.values)) errs.push(`${label}: gives ${r.plan.result.values}, not ${want.values}`);
  for (const e of validatePlan(r.plan).slice(0, 3)) errs.push(`${label}: ${e}`);
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
// Seeded random machines of two to five blocks: gates and comparisons feeding arithmetic,
// DIV, MOD and SHR feeding divisors and shift counts (where a running division reads as a
// fraction), NOT and NEG inside, and level pace in the children; and the trees the reviews
// found, whose running divisions once fed a count.
const NESTED = 400;
const REGRESSIONS = [['shr(-5, 2/(-11))', 'ternary'], ['shl(-10, -18/39)', 'ternary'], ['shr(shl(16,3), 4%(-12))', 'binary'],
  ['shl(5, 7/2)', 'binary'], ['shr(45, 2%3)', 'ternary'], ['(12&10)+((12^10)<<1)', 'binary'], ['-(3+4)*5', 'binary'], ['5*-(2+1)', 'binary']];
function nestedJobs() {
  let seed = 72026;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick = xs => xs[int(0, xs.length - 1)];
  const jobs = REGRESSIONS.map(([text, base]) => ({text, base}));
  for (const base of ['binary', 'ternary']) for (let n = 0; n < NESTED; n++) {
    let tree, inputs;
    do {
      tree = {}; inputs = [];
      let id = 0, blocks = int(2, 5);
      // a count socket takes a small whole number, or a block whose answer may be one
      const grow = (parent, socket, count) => {
        if (parent !== 'io' && (blocks <= 0 || rand() < 0.3)) { inputs.push(String(count ? int(0, 4) : int(-12, 12))); return; }
        blocks--;
        const op = count ? pick(['div', 'mod', 'shr', 'add', 'sub', 'cmp']) : pick(OPS[base]), node = `n${++id}`;
        tree[node] = {op, parent, socket};
        for (const s of socketsOf(op)) grow(node, s, SHIFTS.includes(op) && s === 'R');
      };
      grow('io', 'C', false);
    } while (Object.keys(tree).length < 2);
    jobs.push({tree, inputs, base, pace: rand() < 0.25 ? 'level' : 'together'});
  }
  return jobs;
}
// The sweeps share one pool, dealt round-robin to worker threads running this file: as many
// as the machine has CPUs, up to 4 (the main thread only waits), so a two-CPU machine still
// splits the work; one CPU checks everything here. The 20 s budget is the reference
// machine's (4 cores, 8 threads); a machine with fewer CPUs gets it in proportion.
const WORKERS = Math.min(4, availableParallelism()), BUDGET = 20000 * Math.max(1, 4 / WORKERS);
function tally(jobs) {
  const out = {};
  for (const job of jobs) { const r = out[job.sweep] ??= {errors: [], count: 0}; r.count++; r.errors.push(...check(job)); }
  return out;
}
async function pool(jobs) {
  if (WORKERS < 2) return tally(jobs);
  const shares = Array.from({length: WORKERS}, (_, k) => jobs.filter((_, i) => i % WORKERS === k));
  const parts = await Promise.all(shares.map(share => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {workerData: {jobs: share}});
    worker.once('message', resolve); worker.once('error', reject);
  })));
  const out = {};
  for (const part of parts) for (const [sweep, {errors, count}] of Object.entries(part)) {
    const r = out[sweep] ??= {errors: [], count: 0}; r.count += count; r.errors.push(...errors);
  }
  return out;
}

if (!isMainThread) parentPort.postMessage(tally(workerData.jobs));
else {
  const tag = (sweep, jobs) => jobs.map(job => ({...job, sweep}));
  const sweeps = pool([...tag('exhaustive', exhaustive()), ...tag('random', randomJobs()), ...tag('nested', nestedJobs())]);
  test('every block in both bases over [−20, 20] (k ∈ [0, 6] for shifts, b ≠ 0 for ÷ and %; ADD, SUB and MULT in both paces)', async () => {
    const {errors, count} = (await sweeps).exhaustive;
    assert.deepEqual(errors.slice(0, 10), []);
    assert.equal(count, 43091);
  });
  test(`${NESTED} seeded random machines of two to five blocks per base, and the reviews' trees, match the oracle block by block`, async () => {
    const {errors, count} = (await sweeps).nested;
    assert.deepEqual(errors.slice(0, 10), []);
    assert.equal(count, 2 * NESTED + REGRESSIONS.length);
  });
  test(`${RANDOM_PAIRS} seeded random operands per block and base, near the limits: exact, pure, and planned in under 50 ms`, async () => {
    const {errors, count} = (await sweeps).random;
    const slow = errors.filter(e => e.startsWith('slow ')).map(e => JSON.parse(e.slice(5)));
    assert.deepEqual(errors.filter(e => !e.startsWith('slow ')).slice(0, 10), []);
    assert.equal(count, RANDOM_PAIRS * (OPS.binary.length + OPS.ternary.length));
    // best of three on this thread, now that the pool is idle
    for (const job of slow) {
      let best = Infinity;
      for (let n = 0; n < 3; n++) { const t0 = performance.now(); planMachine({tree: tree(job.op), inputs: job.args, base: job.base}); best = Math.min(best, performance.now() - t0); }
      assert.ok(best < 50, `${job.op}(${job.args.join(', ')}) in ${job.base} plans in ${best.toFixed(1)} ms`);
    }
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
  test(`machine-plan.test.js runs in under ${BUDGET / 1000} s`, () => {
    assert.ok(performance.now() - started < BUDGET, `${Math.round(performance.now() - started)} ms`);
  });
}
