// Card plans for working out one × or ÷ step. Plans are pure data: which cards exist,
// where they go and when. The view assigns geometry; every step conserves the value.
import { math } from './model.js';
import { numberSpec } from './numbers.js';
import { unitPlanMany } from './units.js';

const specOf = o => numberSpec({ value: math.abs(o.value), notation: o.notation === 'fraction' && o.value.d !== 1 ? 'fraction' : 'decimal', decimalPlaces: o.decimalPlaces });
const digitSum = spec => spec.places.reduce((sum, p) => sum + p.digit, 0);
const pow10 = e => e >= 0 ? math.frac(10 ** e) : math.frac(1, 10 ** -e);

// Multiplication as repeated addition, extending the original Multiplication.Duplicator:
// the factor with fewer cards becomes a horizontal line of cards; the other factor is
// copied once per card (a ten-card copies it one place up) and the copies are added.
export function multiplicationPlan(term) {
  const [a, b] = term.expr.operands;
  if (term.expr.ops[0] !== '×') return null;
  const sa = specOf(a), sb = specOf(b);
  if (!sa || !sb) return null;
  const lineIndex = digitSum(sa) < digitSum(sb) ? 0 : 1, copyIndex = 1 - lineIndex;
  const [copySpec, lineSpec] = lineIndex ? [sa, sb] : [sb, sa], copyOperand = [a, b][copyIndex];
  const cards = lineSpec.places.flatMap(p => Array.from({ length: p.digit }, () => p.exponent));
  if (cards.length > 24 || copySpec.places.length > 7) return null;
  const shift = copySpec.minPlace + lineSpec.minPlace;
  const units = BigInt(copySpec.places.map(p => p.digit).join(''));
  const copies = cards.map((exponent, i) => {
    const value = units * 10n ** BigInt(exponent - lineSpec.minPlace);
    const real = math.mul(math.abs(copyOperand.value), pow10(exponent));
    return { owner: `copy-${i}`, exponent, value, spec: numberSpec({ value: real, notation: 'decimal' }) };
  });
  if (copies.some(c => c.value > BigInt(Number.MAX_SAFE_INTEGER))) return null;
  const sign = Math.sign(a.value.n) * Math.sign(b.value.n) || 1;
  const speed = copies.length > 6 ? Math.min(2.5, copies.length / 5) : 1;
  const plan = unitPlanMany(0, 'result', copies.map((c, i) => ({ value: sign * Number(c.value), owner: c.owner, delay: i * .16 / speed })), { sequential: true, speed });
  plan.placeShift = shift;
  const layout = .75 + Math.min(.5, copies.length * .05), hold = .25;
  return { kind: 'multiply', lineIndex, copyIndex, copies, lineSpec, copySpec, sign, units: plan, layout, sumStart: layout + hold, duration: layout + hold + plan.duration + .45 };
}

// Long division by sharing: each place's cards are dealt round-robin into d groups;
// leftovers are unstacked into ten cards of the next place. Below the ones place the
// dealing continues into tenths while the answer terminates; otherwise the leftover
// cards are sliced into d strips each and the strips are dealt (a mixed number).
export function divisionPlan(term, result) {
  const [a, b] = term.expr.operands;
  if (term.expr.ops[0] !== '÷' || b.value.d !== 1) return null;
  const d = Math.abs(b.value.n), sa = specOf(a);
  if (!sa || d < 1 || d > 12 || sa.places.length > 6) return null;
  const quotient = math.abs(result.value);
  const resultSpec = result.notation === 'mixed' ? null : numberSpec({ ...result, value: quotient });
  const mixed = result.notation === 'mixed' && quotient.d !== 1;
  if (mixed && sa.minPlace < 0) return null;
  const whole = mixed ? math.frac(Math.floor(quotient.n / quotient.d)) : null;
  const groupSpec = mixed ? (whole.n ? numberSpec({ kind: 'constant', value: whole, notation: 'auto' }) : null) : resultSpec;
  const lowest = mixed ? 0 : Math.min(sa.minPlace, groupSpec.minPlace);
  if (lowest < -6) return null;
  let serial = 0;
  const id = () => `c${serial++}`, tokens = [], events = [], cells = {}, groupCells = {};
  const nextCell = place => (cells[place] = (cells[place] ?? -1) + 1);
  for (const p of sa.places) for (let k = 0; k < p.digit; k++) tokens.push({ id: id(), place: p.exponent, cell: nextCell(p.exponent) });
  const dividend = tokens.map(t => ({ ...t })), initial = tokens.map(t => ({ ...t }));
  const rounds = sa.places.reduce((n, p) => n + p.digit, 0) > 40 ? .09 : .14, flight = .42, unstack = .45;
  let time = .7;
  for (let place = sa.maxPlace; place >= lowest; place--) {
    const here = dividend.filter(t => t.place === place && !t.gone);
    const each = Math.floor(here.length / d);
    here.slice(0, each * d).forEach((t, k) => {
      const group = k % d, round = Math.floor(k / d), cell = groupCells[`${group}:${place}`] = (groupCells[`${group}:${place}`] ?? -1) + 1;
      events.push({ type: 'deal', id: t.id, place, group, cell, start: time + round * rounds, end: time + round * rounds + flight });
      t.gone = true;
    });
    if (each) time += (each - 1) * rounds + flight + .08;
    const left = here.slice(each * d);
    if (!left.length) continue;
    if (place > lowest) {
      for (const parent of left) {
        const children = Array.from({ length: 10 }, () => ({ id: id(), place: place - 1, cell: nextCell(place - 1) }));
        events.push({ type: 'unstack', id: parent.id, place, cell: parent.cell, children, start: time, end: time + unstack });
        parent.gone = true; dividend.push(...children);
      }
      time += unstack + .08;
    } else if (mixed) {
      left.forEach((parent, i) => {
        const strips = Array.from({ length: d }, (_, k) => ({ id: id(), index: k }));
        events.push({ type: 'slice', id: parent.id, place, cell: parent.cell, strips, start: time, end: time + .5 });
        strips.forEach((strip, k) => events.push({ type: 'strip', id: strip.id, parent: parent.id, group: k, slot: i, index: k, start: time + .55 + i * rounds, end: time + .55 + i * rounds + flight }));
        parent.gone = true;
      });
      time += .55 + (left.length - 1) * rounds + flight + .08;
    } else return null;
  }
  const gather = time + .25;
  return { kind: 'divide', d, sign: Math.sign(a.value.n) * Math.sign(b.value.n) || 1, dividendSpec: sa, groupSpec, mixed, remainder: mixed ? quotient.n % quotient.d : 0, tokens: initial, events, gather, duration: gather + 1.1 };
}

export function operationPlan(transaction) {
  const { before, after, command } = transaction;
  const term = [...before.left, ...before.right].find(t => t.id === command.id);
  const next = [...after.left, ...after.right].find(t => t.id === command.id);
  if (!term?.expr || !next) return null;
  if (term.expr.ops[0] === '÷' && term.expr.operands[1].value.d !== 1) return { kind: 'flip', duration: 1.1 };
  const first = next.expr ? { ...next, value: next.expr.operands[0].value, notation: next.expr.operands[0].notation, expr: undefined } : next;
  return (term.expr.ops[0] === '×' ? multiplicationPlan(term) : divisionPlan(term, first)) || null;
}
