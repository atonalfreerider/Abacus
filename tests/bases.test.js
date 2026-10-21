import test from 'node:test';
import assert from 'node:assert/strict';
import { digitsOf, baseText, baseSpec, wholeDigits, expandBaseLiterals, placeMeta, setBase, numeral, bases } from '../src/mvc/bases.js';
import { unitPlan, unitValue } from '../src/mvc/units.js';
import { planTransition } from '../src/mvc/animation.js';
import { EquationModel } from '../src/mvc/model.js';
import { renderEquation, parseStackId, stackId, stackContent, tray } from '../src/mvc/view.js';

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
// The exact value of a digit list: Σ digit · radix^exponent as a reduced fraction.
function valueOf(places, radix) {
  let n = 0n, d = 1n;
  for (const { digit, exponent } of places) {
    const [pn, pd] = exponent >= 0 ? [BigInt(digit) * BigInt(radix) ** BigInt(exponent), 1n] : [BigInt(digit), BigInt(radix) ** BigInt(-exponent)];
    n = n * pd + pn * d; d *= pd; const g = gcd(n, d) || 1n; n /= g; d /= g;
  }
  return { n, d };
}

test('base 2 and balanced ternary write every terminating rational exactly', () => {
  let seed = 7; const rand = k => (seed = (seed * 1103515245 + 12345) % 2147483648) % k;
  for (let i = 0; i < 400; i++) {
    for (const [base, radix] of [['binary', 2], ['ternary', 3]]) {
      const n = rand(20001) - 10000, d = radix ** rand(5), g = Number(gcd(BigInt(n), BigInt(d))) || 1, value = { n: n / g, d: d / g };
      const spec = digitsOf(value, base);
      assert.ok(spec?.exact, `${n}/${d} in ${base}`);
      assert.deepEqual(valueOf(spec.places, radix), { n: BigInt(value.n), d: BigInt(value.d) }, `${n}/${d} in ${base}`);
      for (const p of spec.places) assert.ok(base === 'ternary' ? [-1, 0, 1].includes(p.digit) : Math.abs(p.digit) <= 1);
    }
  }
});

test('digits and text in each base', () => {
  assert.equal(baseText({ n: 13, d: 1 }, 'binary'), '1101₂');
  assert.equal(baseText({ n: -13, d: 1 }, 'binary'), '−1101₂');
  assert.equal(baseText({ n: 1, d: 4 }, 'binary'), '0.01₂');
  assert.equal(digitsOf({ n: 1, d: 3 }, 'binary'), null, 'a third never ends in base 2');
  assert.equal(baseText({ n: 1, d: 3 }, 'binary'), '1/11₂');
  assert.equal(baseText({ n: -5, d: 1 }, 'ternary'), 'T11 bal₃', 'balanced ternary needs no minus sign');
  assert.equal(baseText({ n: 8, d: 1 }, 'ternary'), '10T bal₃');
  assert.equal(baseText({ n: 1, d: 3 }, 'ternary'), '0.1 bal₃');
  assert.equal(baseText({ n: 0, d: 1 }, 'ternary'), '0 bal₃');
  assert.deepEqual(wholeDigits(-27, 'ternary').map(x => x.digit), [0, 0, 0, -1]);
  assert.equal(baseText({ n: 30, d: 1 }, 'e'), '1102.11…ₑ');
  assert.equal(baseText({ n: 2, d: 1 }, 'e'), '2ₑ', 'only 0, 1 and 2 end in base e');
  assert.equal(baseText({ n: 1, d: 1 }, 'e'), '1ₑ');
});

test('base e is the greedy expansion: digits 0 to 2, close to the value, never exact past 2', () => {
  for (const v of [3, 7, 10, 30, 100, 1000, 0.5, 2.5, 12345]) {
    const spec = digitsOf({ n: v * 2, d: 2 }, 'e', { fraction: 12 });
    const sum = spec.places.reduce((s, p) => s + p.digit * Math.E ** p.exponent, 0);
    assert.ok(spec.places.every(p => p.digit >= 0 && p.digit <= 2), String(v));
    assert.ok(Math.abs(sum - v) < Math.E ** -11, `${v}: ${sum}`);
    assert.equal(spec.exact, false, String(v));
  }
});

test('typed 0b and 0t literals become decimal', () => {
  assert.equal(expandBaseLiterals('x + 0b1011 = 0t1T0'), 'x + 11 = 6');
  assert.equal(expandBaseLiterals('0tT11 + x = 3'), '(-5) + x = 3');
  assert.equal(new EquationModel(expandBaseLiterals('x+0b101=0t1T0')).nextStep().type, 'move');
});

test('trays: one LED bulb per bit or trit, and e^k cards with the last one sliced', () => {
  assert.deepEqual([0, 1, 4, -2].map(k => placeMeta(k, 'binary').cardCount), [1, 1, 1, 1], 'a bulb, whatever its place');
  assert.deepEqual([0, 4, -2].map(k => placeMeta(k, 'binary').name), ['2⁰', '2⁴', '2⁻²']);
  assert.equal(placeMeta(3, 'ternary').name, '3³');
  const lit = tray(1, 'blue', 3, 'front', '1', false, 'binary'), dark = tray(0, 'blue', 3, 'front', '0', false, 'binary'), trit = tray(1, 'red', 2, 'front', 'T', false, 'ternary');
  assert.match(lit, /data-lit="blue"/); assert.match(lit, /class="bulb bulb-blue"/); assert.match(lit, /2³/);
  assert.match(dark, /data-lit="off"/); assert.doesNotMatch(dark, /class="bulb /); assert.match(dark, /bulb-socket/);
  assert.match(trit, /class="bulb bulb-red"/); assert.match(trit, /numeral-bar/);
  assert.doesNotMatch(lit + dark + trit, /unit-stack/, 'no card stacks in a bulb tray');
  const e2 = placeMeta(2, 'e');
  assert.equal(e2.cardCount, 8); assert.ok(Math.abs(e2.partial - (Math.E ** 2 - 7)) < 1e-12);
  for (const id of [stackId('red', -2, 'depth', 'binary'), stackId('blue', 4, 'front', 'e'), stackId('green', 0, 'spread', 'decimal')]) {
    const { meta, base } = parseStackId(id);
    assert.equal(stackId(parseStackId(id).color, meta.exponent, parseStackId(id).camera, base), id);
  }
  assert.equal((stackContent('stack-blue-e1-front').match(/data-layer/g) || []).length, 3);
});

test('cards regroup in base 2 and balanced ternary without losing value', () => {
  for (const [base, radix] of [['binary', 2n], ['ternary', 3n]]) {
    for (const [a, b] of [[1, 1], [13, 9], [7, -12], [-5, 13], [255, 1], [100, -101], [-40, -41], [364, 1]]) {
      const plan = unitPlan(a, b, 'target', 'source', base);
      assert.equal(unitValue(plan.final, radix), BigInt(a + b), `${a} + ${b} in ${base}`);
      for (const phase of plan.phases) assert.equal(unitValue(phase.after, radix), BigInt(a + b));
      const perPlace = new Map(); for (const t of plan.final) perPlace.set(t.place, (perPlace.get(t.place) || 0) + 1);
      assert.ok([...perPlace.values()].every(c => c === 1), `one card per place: ${a} + ${b} in ${base}`);
      if (base === 'binary') assert.ok(plan.final.every(t => t.sign === Math.sign(a + b)));
      // the cards end as the digits of the sum
      const digits = wholeDigits(a + b, base).filter(x => x.digit).map(x => `${x.place}:${base === 'ternary' ? x.digit : x.digit * Math.sign(a + b)}`).sort();
      assert.deepEqual(plan.final.map(t => `${t.place}:${t.sign}`).sort(), digits);
    }
  }
  assert.ok(unitPlan(1, 1, 't', 's', 'ternary').phases.some(p => p.type === 'pair'), 'two like trits open a zero pair');
  assert.throws(() => unitPlan(1, 1, 't', 's', 'e'));
});

test('transitions follow the base; every base renders every scenario', () => {
  const m = new EquationModel('13+9=x'), tx = m.dispatch({ type: 'combine', id: m.state.left[1].id, target: m.state.left[0].id });
  assert.equal(planTransition(tx, 'binary').units.base, 'binary');
  assert.equal(planTransition(tx, 'e').units, null);
  assert.equal(planTransition(tx).units.base, 'decimal');
  try {
    for (const base of Object.keys(bases)) {
      setBase(base);
      for (const input of ['x+3=7', '2x-345+12.5=1208+3*4', '1/3+x=5/6', '-7+3=-4', 'x=0.375', '2(x+3)=18', '1000000=x', '7/3+x=1']) {
        const svg = renderEquation(new EquationModel(input).state, { orientation: 'horizontal', camera: 'depth' });
        assert.match(svg, /<svg/, `${input} in ${base}`);
        assert.doesNotMatch(svg, /NaN|undefined/, `${input} in ${base}`);
      }
    }
  } finally { setBase('decimal'); }
  assert.equal(numeral.id, 'decimal');
});
