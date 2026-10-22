// Machine lessons (src/machine/lessons.js, design 5.4): every lesson's example and 200 fresh
// problems plan, stop where the lesson says, and ask questions whose answers are among the
// choices and agree with arithmetic done here independently of the planner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons, problemOf, problemText, pausesOf, matches, MachineTutor, describe } from '../src/machine/lessons.js';
import { lessons as tutorLessons } from '../src/mvc/tutor.js';
import { planMachine } from '../src/machine/plan.js';
import { snapshotAt } from '../src/machine/scene.js';
import { BeatClock } from '../src/machine/clock.js';
import '../src/machine/e-base.js';

const big = v => BigInt(v), abs = v => v < 0n ? -v : v, sgn = v => v > 0n ? 1n : v < 0n ? -1n : 0n;
const bitLength = v => abs(big(v)).toString(2).length;
const levelOf = text => Number(/Level (−?\d+)/.exec(text)[1].replace('−', '-'));
const trits = v => { let n = big(v); const out = []; while (n !== 0n) { let d = ((n % 3n) + 3n) % 3n; if (d === 2n) d = -1n; out.push(Number(d)); n = (n - d) / 3n; } return out; };
// The answers each lesson's stops should have, in order, worked out from the inputs alone.
const expected = {
  'machine-split': ([a, b], kinds) => { const lit = [...abs(big(b)).toString(2)].reverse().map((c, k) => c === '1' ? k : -1).filter(k => k >= 0).reverse(); let s = 0; return kinds.map(k => k === 'split' ? bitLength(b) - 1 : lit[s++]); },
  'machine-carry': ([a, b], kinds, qs) => qs.map(q => { const k = q.kind === 'collide' ? 0 : levelOf(q.question), m = 1n << big(k + 1); return big(a) % m + big(b) % m >= m ? 'yes' : 'no'; }),
  'machine-borrow': ([a, b], kinds, qs) => {
    // annihilate, then pay the owed levels from the top: the donor is the nearest lit level above
    const A = big(a), B = big(b), n = A.toString(2).length, lit = [], owed = [];
    for (let l = 0; l < n; l++) { const x = (A >> big(l)) & 1n, y = (B >> big(l)) & 1n; lit[l] = x === 1n && y === 0n; if (x === 0n && y === 1n) owed.push(l); }
    const donors = [];
    for (const k of owed.reverse()) { let j = k + 1; while (!lit[j]) j++; donors.push(j); lit[j] = false; for (let l = k; l < j; l++) lit[l] = true; }
    return qs.map((q, i) => { assert.equal(levelOf(q.question), owed[i], 'the owed level asked about'); return donors[i]; });
  },
  'machine-shift': ([a, k], kinds) => kinds.map(kind => kind === 'shift' ? Number(k) : String(big(a) % (1n << big(k)))),
  'machine-divide': ([a, d], kinds) => { let R = big(a); const D = big(d), K = Math.max(0, bitLength(a) - bitLength(d)), out = []; for (let k = K; k >= 0; k--) { const Dk = D << big(k), fits = R >= Dk; out.push(fits ? 'yes' : 'no'); if (fits) R -= Dk; } return out.slice(0, kinds.length); },
  'machine-gates': ([a, b], kinds, qs, op) => [String({ and: big(a) & big(b), or: big(a) | big(b), xor: big(a) ^ big(b) }[op])],
  'machine-trits': ([a, b], kinds, qs) => {
    const x = trits(a), y = trits(b), carries = [0];
    for (let k = 0; k < Math.max(x.length, y.length) + 1; k++) { const s = (x[k] ?? 0) + (y[k] ?? 0) + carries[k]; carries.push(s >= 2 ? 1 : s <= -2 ? -1 : 0); }
    return qs.map(q => { const k = q.kind === 'collide' ? 0 : levelOf(q.question); return ({ 1: 'blue', '-1': 'red', 0: 'none' })[carries[k + 1]]; });
  },
  'machine-nearest': ([a, d], kinds) => {
    const A = big(a), D = abs(big(d)); let K = 0; while (2n * abs(A) > 3n ** big(K + 1) * D) K++;
    let R = A; const out = [];
    for (let k = K; k >= 0 && R !== 0n; k--) { const G = R - sgn(R) * D * 3n ** big(k), keep = abs(G) < abs(R) || abs(G) === abs(R) && sgn(G) === sgn(A); out.push(keep ? 'keep' : 'stay'); if (keep) R = G; }
    return out.slice(0, kinds.length);
  },
  'machine-efold': ([a, b], kinds, qs) => { let x = Number(a) + Number(b); return qs.map(() => { const k = Math.floor(Math.log(x) + 1e-12), d = Math.min(2, Math.floor(x / Math.E ** k + 1e-12)); x -= d * Math.E ** k; return k; }); },
  'machine-red-copies': ([a, b], kinds) => trits(b).map((t, k) => ({ t, k })).filter(x => x.t).reverse().map(x => x.t < 0 ? 'swap' : 'keep').slice(0, kinds.length),
};

test('Machine lessons are their own list: none is in tutor.js lessons (which run through EquationModel in decimal)', () => {
  const ids = new Set(tutorLessons.map(l => l.id));
  assert.ok(lessons.length >= 8);
  assert.equal(new Set(lessons.map(l => l.id)).size, lessons.length);
  for (const l of lessons) { assert.ok(!ids.has(l.id), l.id); assert.ok(l.id.startsWith('machine-')); assert.ok(['binary', 'ternary', 'e'].includes(l.base)); }
  for (const id of ['machine-split', 'machine-carry', 'machine-borrow', 'machine-shift', 'machine-divide', 'machine-gates', 'machine-trits', 'machine-nearest', 'machine-efold'])
    assert.ok(lessons.some(l => l.id === id), id);
  assert.equal(describe(lessons[0]), '16 × 7 in base 2');
  assert.equal(problemText('shl', ['5', '3']), '5 × 2³'); assert.equal(problemText('sub', ['5', '-3']), '5 − (−3)');
});

test('every lesson example and 200 generated problems plan, stop where the lesson says, and ask what the arithmetic answers', () => {
  const started = performance.now();
  for (const lesson of lessons) {
    const tutor = new MachineTutor(lesson, 29), seen = new Set();
    for (let n = 0; n <= 200; n++) {
      const problem = n ? tutor.predict() : problemOf(lesson, lesson.example);
      seen.add(problem.text);
      const r = planMachine({ tree: problem.tree, inputs: problem.inputs, base: problem.base, pace: problem.pace });
      assert.ok(r.ok, `${lesson.id} ${problem.text}: ${r.message}`);
      const plan = r.plan, qs = pausesOf(lesson, plan);
      assert.ok(qs.length >= 1, `${lesson.id} ${problem.text}: no stop`);
      const counts = {};
      qs.forEach((q, j) => {
        const where = `${lesson.id} ${problem.text} stop ${j}`;
        assert.equal(plan.beats[q.i].kind, q.kind, where);
        if (j) assert.ok(q.i > qs[j - 1].i, `${where}: stops in beat order`);
        assert.ok(q.choices.some(c => String(c.value) === String(q.answer)), `${where}: the answer ${q.answer} is a choice`);
        assert.equal(new Set(q.choices.map(c => String(c.value))).size, q.choices.length, `${where}: choices differ`);
        assert.ok(q.question.length > 10 && q.explain.length > 5 && q.hint, where);
        if (q.tap) assert.ok(snapshotAt(plan, q.i).towers[q.tap.tower], `${where}: the tower to tap is on stage`);
        counts[q.kind] = (counts[q.kind] ?? 0) + 1;
      });
      for (const p of lesson.pauses) assert.ok((counts[p.beatKind] ?? 0) <= (p.limit ?? 1), `${lesson.id}: at most ${p.limit} ${p.beatKind} stops`);
      const want = expected[lesson.id](problem.inputs, qs.map(q => q.kind), qs, problem.op);
      assert.deepEqual(qs.map(q => String(q.answer)), want.map(String), `${lesson.id} ${problem.text}`);
    }
    assert.ok(seen.size > 40, `${lesson.id}: fresh problems vary (${seen.size})`);
  }
  assert.ok(performance.now() - started < 15000, 'lessons plan quickly');
});

test('a lesson goes Watch → Predict → Your turn with fresh problems, and checks the machine the learner built', () => {
  const lesson = lessons.find(l => l.id === 'machine-split'), a = new MachineTutor(lesson, 5), b = new MachineTutor(lesson, 5);
  assert.equal(a.phase, 'watch'); assert.equal(a.problem.text, '16 × 7'); assert.equal(a.problem.base, 'binary'); assert.equal(a.problem.pace, 'level');
  const p = a.predict(); assert.equal(a.phase, 'predict'); assert.notEqual(p.text, '16 × 7'); assert.deepEqual(b.predict(), p, 'seeded');
  const t = a.turn(); assert.equal(a.phase, 'turn'); assert.notEqual(t.text, p.text);
  assert.ok(matches(t, t.tree, t.inputs));
  assert.ok(matches(t, { n7: { op: 'mul', parent: 'io', socket: 'C' } }, t.inputs.map(v => ` ${v}`)), 'ids and spacing do not matter');
  assert.ok(!matches(t, { n1: { op: 'add', parent: 'io', socket: 'C' } }, t.inputs), 'another block');
  assert.ok(!matches({ ...t, inputs: ['13', '6'] }, t.tree, ['6', '13']), 'the numbers in order');
  assert.ok(!matches(t, { ...t.tree, n2: { op: 'mul', parent: 'n1', socket: 'L' } }, t.inputs), 'one block only');
  const q = { answer: 3 }; assert.equal(a.answer(q, 3), true); assert.equal(a.answer(q, '2'), false); assert.equal(a.right, 1); assert.equal(a.asked, 2);
});

test('the clock rests before a held beat under AUTO, and Step plays it on', () => {
  const plan = { beats: Array.from({ length: 6 }, (_, i) => ({ i, kind: 'k', caption: `b${i}` })) };
  const c = new BeatClock(plan, { auto: true }); c.holds = new Set([3]);
  c.start(0); assert.equal(c.t(10000), 3); assert.equal(c.playing, false); assert.equal(c.done, false);
  c.step(10000); assert.equal(c.t(10500), 3.5); assert.equal(c.t(20000), 6, 'AUTO carries on after the held beat');
});
