// The equation space's row form of PRIME's split (design 4.6, phase 5): × and ÷ of whole
// numbers in base 2 and balanced ternary, planned by the Machine's planner and drawn in rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EquationModel, math } from '../src/mvc/model.js';
import { planTransition } from '../src/mvc/animation.js';
import { renderEquation } from '../src/mvc/view.js';
import { setBase, wholeDigits } from '../src/mvc/bases.js';
import { unitValue } from '../src/mvc/units.js';
import { useRowForm, rowPlan } from '../src/mvc/operations.js';
import { rowForm, rowMultiplicationPlan, rowDivisionPlan } from '../src/mvc/row-split.js';
import { planMachine } from '../src/machine/plan.js';

const RADIX = { binary: 2n, ternary: 3n };
const evaluate = (input, base) => { setBase(base); const m = new EquationModel(input); return planTransition(m.dispatch({ type: 'evaluate', id: m.state.left[0].id }), base); };
const term = (a, op, b) => new EquationModel(`${a}${op}${b}`.replace(/-(\d+)$/, '(-$1)').replace(/^\((-\d+)\)/, '$1')).state.left[0];
// One row per non-zero digit of the multiplier, top first: a lit bulb (binary) or trit.
const digitsTopFirst = (b, base) => wholeDigits(BigInt(b), base).filter(d => d.digit).map(d => ({ k: d.place, sign: base === 'ternary' ? d.digit : Math.sign(b) })).reverse();

test('× splits into one shifted copy per lit bulb of the multiplier, and the copies add up as the machine adds them', () => {
  useRowForm(rowForm(planMachine));
  for (const base of ['binary', 'ternary']) for (let a = -20; a <= 20; a++) for (let b = -20; b <= 20; b++) {
    const op = rowMultiplicationPlan(term(a, '*', b), base, planMachine), where = `${base} ${a} × ${b}`;
    assert.ok(op, where); assert.equal(op.kind, 'rows-multiply');
    assert.equal(op.product, String(a * b), where);
    const want = a === 0 ? [] : digitsTopFirst(b, base);
    assert.deepEqual(op.copies.map(c => [c.k, c.value]), want.map(d => [d.k, String(BigInt(a) * BigInt(d.sign) * RADIX[base] ** BigInt(d.k))]), where);
    // the ledger conserves every token; its final tokens write the product
    assert.equal(op.units.total, String(a * b), where);
    assert.equal(unitValue(op.units.final, RADIX[base]), BigInt(a * b), where);
    // each copy lands only once the sum so far has settled (the machine's order, lowest first)
    const ownerOf = ph => ph.type === 'transfer' ? ph.before.find(t => t.id === ph.removed[0])?.owner : null;
    const firsts = [...op.copies].reverse().map(c => op.units.phases.findIndex(ph => ownerOf(ph) === c.owner));
    for (let j = 1; j < firsts.length; j++) {
      const settled = Math.max(...op.units.phases.slice(firsts[j - 1], firsts[j]).map(ph => ph.end));
      assert.ok(op.units.phases[firsts[j]].start >= settled - 1e-9, `${where}: copy ${j} waits`);
    }
    // the additions are the machine's own, in its order: 32 + 16 = 48, then 64 + 48 = 112
    const sums = planMachine({ tree: { n1: { op: 'mul', parent: 'io', socket: 'C' } }, inputs: [String(a), String(b)], base }).plan.beats.filter(x => x.ledger.law === 'sum').map(x => x.ledger.out);
    let partial = 0n; const ours = [...op.copies].reverse().map(c => partial += BigInt(c.value)).slice(1).map(String);
    assert.deepEqual(ours, sums, where);
  }
  const op = rowMultiplicationPlan(term(16, '*', 7), 'binary', planMachine);
  assert.deepEqual(op.captions.map(c => c.text), ['7 = 4 + 2 + 1: a copy of 16 for each lit bulb, shifted to its place.', '16 × 1 = 16', '32 + 16 = 48', '64 + 48 = 112', '16 × 7 = 112']);
  assert.equal(rowMultiplicationPlan(term(16, '*', 7), 'ternary', planMachine).captions[0].text, '7 = 9 − 3 + 1: a copy of 16 for each lit bulb, shifted to its place; red ones swap.');
});

test('÷ takes shifted copies of the divisor away round by round, and its rounds account for the exact quotient', () => {
  for (const base of ['binary', 'ternary']) for (let a = -40; a <= 40; a++) for (let b = -9; b <= 9; b++) {
    if (!b) continue;
    const op = rowDivisionPlan(term(a, '÷', b), base, planMachine), where = `${base} ${a} ÷ ${b}`;
    assert.ok(op, where); assert.equal(op.kind, 'rows-divide');
    const q = BigInt(op.q), r = BigInt(op.r), A = BigInt(a), B = BigInt(b);
    assert.equal(q * B + r, A, `${where}: a = q·b + r`);
    if (base === 'binary') { assert.equal(q, A / B, where); assert.equal(r, A % B, where); }
    else assert.ok(2n * (r < 0n ? -r : r) <= (B < 0n ? -B : B), `${where}: the balanced remainder`);
    let R = A, Q = 0n;
    for (const x of op.rounds) {
      assert.equal(BigInt(x.before), R, where);
      if (x.units) {
        assert.equal(BigInt(x.after) - BigInt(x.before), BigInt(x.trial), `${where}: round ${x.k} takes the trial copy away`);
        assert.equal(unitValue(x.units.final, RADIX[base]), BigInt(x.after), where);
        assert.ok(x.collide[0] >= x.start && x.light[0] < x.collide[1] + 1e-9, where);
      }
      Q += BigInt(x.q) * RADIX[base] ** BigInt(x.k); R = BigInt(x.after);
      if (x.descend) assert.ok(x.descend[0] >= (x.collide?.[1] ?? x.start), where);
    }
    assert.equal(R, r, `${where}: the last remainder`); assert.equal(Q, q, `${where}: the quotient bulbs`);
    assert.equal(op.exact, r === 0n);
  }
  const op = rowDivisionPlan(term(45, '÷', 6), 'binary', planMachine);
  assert.equal(op.captions[0].text, '45 ÷ 6: shift 6 left 3 places, to 48; 4 dark bulbs wait for the quotient.');
  assert.equal(op.captions.at(-1).text, '45 = 7 × 6 + 3, so 45 ÷ 6 = 7 + 3/6.');
  assert.equal(rowDivisionPlan(term(19, '÷', 5), 'ternary', planMachine).captions.at(-1).text, '19 = 4 × 5 − 1, so 19 ÷ 5 = 4 − 1/5.');
});

test('frames of the row form are finite in both layouts, and settle on the answer', () => {
  useRowForm(rowForm(planMachine));
  for (const [base, input] of [['binary', '16*7'], ['ternary', '16*7'], ['binary', '13*11'], ['ternary', '5*(-4)'], ['binary', '0*9'], ['binary', '45÷6'], ['ternary', '19÷5'], ['binary', '12÷3*5'], ['ternary', '-100÷7']]) {
    const plan = evaluate(input, base), state = plan.after;
    assert.ok(plan.op?.kind.startsWith('rows-'), `${base} ${input}`);
    for (const orientation of ['horizontal', 'vertical']) for (let i = 0; i <= 24; i++) {
      const svg = renderEquation(state, { orientation }, plan, i / 24);
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${base} ${input} ${orientation} ${i}/24`);
      if (i > 0 && i < 24) assert.match(svg, /data-operation="rows-(multiply|divide)"/);
    }
    assert.equal(renderEquation(state, {}, plan, 1), renderEquation(state, {}, null, 1), 'the last frame is the settled equation');
  }
  setBase('decimal');
});

test('decimal and every case the row form does not cover keep their transitions', () => {
  useRowForm(rowForm(planMachine));
  setBase('decimal');
  const m = new EquationModel('16*7'), t = m.dispatch({ type: 'evaluate', id: m.state.left[0].id });
  assert.equal(planTransition(t, 'decimal').op.kind, 'multiply');
  assert.equal(rowPlan(t, 'decimal'), null);
  assert.equal(rowPlan(t, 'e'), null);
  for (const [base, input] of [['binary', '2.5*3'], ['ternary', '7÷1/2'], ['binary', '3^2']]) {
    setBase(base); const x = new EquationModel(input), tx = x.dispatch({ type: 'evaluate', id: x.state.left[0].id });
    assert.equal(planTransition(tx, base).op, undefined, `${base} ${input} cross-fades`);
  }
  useRowForm(null);
  setBase('binary'); const y = new EquationModel('16*7');
  assert.deepEqual(planTransition(y.dispatch({ type: 'evaluate', id: y.state.left[0].id }), 'binary').events, [{ type: 'evaluate' }], 'without the planner, a cross-fade');
  useRowForm(rowForm(planMachine)); setBase('decimal');
});

test('the equation space never imports the machine statically: app.js hands the planner over after a dynamic import', () => {
  for (const file of ['src/mvc/operations.js', 'src/mvc/row-split.js', 'src/mvc/row-view.js', 'src/mvc/animation.js', 'src/mvc/operation-view.js', 'src/mvc/view.js', 'src/mvc/app.js'])
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /^\s*import[^;(]*['"]\.\.\/machine\//m, file);
  // nor the row form itself: it comes with the planner
  for (const file of ['src/mvc/operations.js', 'src/mvc/animation.js', 'src/mvc/operation-view.js', 'src/mvc/view.js', 'src/mvc/app.js'])
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /^\s*import[^;(]*['"]\.\/row-(split|view)\.js/m, file);
  assert.match(fs.readFileSync('src/mvc/app.js', 'utf8'), /Promise\.all\(\[import\('\.\.\/machine\/plan\.js'\),import\('\.\/row-split\.js'\)\]\)\.then\(\(\[m,r\]\)=>useRowForm\(r\.rowForm\(m\.planMachine\)\)\)/);
});
