// Card plans for working out one × or ÷ step. Plans are pure data: which cards exist,
// where they go and when. The view assigns geometry; every step conserves the value.
import { math } from './model.js';
import { numberSpec } from './numbers.js';
import { unitPlanMany, scheduleUnits } from './units.js';
import { bases, baseSpec } from './bases.js';

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
  if (!mixed && !groupSpec) return null; // a fraction answer has no card layout; use the symbolic transition
  const lowest = mixed ? 0 : Math.min(sa.minPlace, groupSpec.minPlace);
  if (lowest < -6) return null;
  let serial = 0;
  const id = () => `c${serial++}`, tokens = [], events = [], cells = {}, groupCells = {};
  const nextCell = place => (cells[place] = (cells[place] ?? -1) + 1);
  for (const p of sa.places) for (let k = 0; k < p.digit; k++) tokens.push({ id: id(), place: p.exponent, cell: nextCell(p.exponent) });
  const dividend = tokens.map(t => ({ ...t })), initial = tokens.map(t => ({ ...t }));
  const rounds = sa.places.reduce((n, p) => n + p.digit, 0) > 40 ? .09 : .14, flight = .42, unstack = .45;
  let time = .7, pieces = d;
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
      // Each leftover card is cut into q equal strips, q = d / gcd(leftover, d), so every
      // group receives the reduced fraction of a card: 8 ÷ 6 deals thirds, not sixths.
      const gcd = (a, b) => b ? gcd(b, a % b) : a, q = d / gcd(left.length, d);
      left.forEach((parent, i) => {
        const strips = Array.from({ length: q }, (_, k) => ({ id: id(), index: k }));
        events.push({ type: 'slice', id: parent.id, place, cell: parent.cell, strips, start: time, end: time + .5 });
        strips.forEach((strip, k) => { const j = i * q + k; events.push({ type: 'strip', id: strip.id, parent: parent.id, group: j % d, slot: Math.floor(j / d), index: k, start: time + .55 + Math.floor(j / d) * rounds, end: time + .55 + Math.floor(j / d) * rounds + flight }); });
        parent.gone = true;
      });
      pieces = q;
      time += .55 + (left.length - 1) * rounds + flight + .08;
    } else return null;
  }
  const gather = time + .25;
  return { kind: 'divide', d, sign: Math.sign(a.value.n) * Math.sign(b.value.n) || 1, dividendSpec: sa, groupSpec, mixed, pieces, remainder: mixed ? quotient.n % quotient.d : 0, tokens: initial, events, gather, duration: gather + 1.1 };
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

// Base 2 and balanced ternary: × and ÷ of whole numbers play PRIME's split in rows (design
// 4.6, phase 5). The Machine's planner (src/machine/plan.js) does the arithmetic: which
// shifted copies a product splits into and the depth-first order they are added in, and
// which shifted copies of the divisor a quotient takes away. It is handed over by app.js
// once a bulb base is chosen (a dynamic import), so nothing here imports src/machine and the
// equation space starts without it. Until it arrives × and ÷ cross-fade, as decimal never does.
let machinePlanner = null;
export const useMachinePlanner = planner => { machinePlanner = planner; };
export const hasMachinePlanner = () => !!machinePlanner;
const minus = v => String(v).replace('-', '−');
const bracket = v => String(v).startsWith('-') ? `(${minus(v)})` : minus(v);
const ROW_LIMIT = { rows: 12, places: 20, rounds: 12 };
const placesOf = (v, base) => baseSpec(math.frac(Number(v)), base).places.length;
const planOf = (op, a, b, base, planner) => {
  try { const r = planner({ tree: { n1: { op, parent: 'io', socket: 'C' } }, inputs: [String(a.value.n), String(b.value.n)], base }); return r.ok ? r.plan : null; }
  catch { return null; }
};
// Sequential sources still overlap a little (the next one waits only for the last one's
// regrouping to start). Here each row lands only once the sum so far has settled, so every
// addition can be read on its own, in the machine's order. Phases are appended source by
// source, so a source's segment runs from its first transfer to the next source's.
function oneAtATime(units, owners, gap) {
  const ownerOf = ph => ph.type === 'transfer' ? ph.before.find(t => t.id === ph.removed[0])?.owner : null;
  const firsts = owners.map(o => units.phases.findIndex(ph => ownerOf(ph) === o));
  for (let j = 1; j < owners.length; j++) {
    const segment = units.phases.slice(firsts[j - 1], firsts[j]), settled = Math.max(...segment.map(ph => ph.end));
    const mine = units.phases.filter(ph => ownerOf(ph) === owners[j]), first = Math.min(...mine.map(ph => ph.start));
    if (first >= settled + gap - 1e-9) continue;
    for (const ph of mine) ph.delay = Math.max(ph.delay || 0, settled + gap);
    scheduleUnits(units);
  }
}
// A × B: one copy of A for each lit bulb of B, shifted to that bulb's place (a red bulb makes
// a swapped copy), then the copies are added from the lowest up, as the machine reassembles
// its split: 16 × 7 = 64 + (32 + 16).
export function rowMultiplicationPlan(term, base, planner = machinePlanner) {
  const [a, b] = term.expr.operands;
  if (!planner || !bases[base]?.bulbs || term.expr.ops[0] !== '×' || a.value.d !== 1 || b.value.d !== 1) return null;
  const plan = planOf('mul', a, b, base, planner);
  if (!plan) return null;
  const A = String(a.value.n), B = String(b.value.n), product = String(BigInt(A) * BigInt(B));
  const copies = plan.beats.filter(x => x.kind === 'shift').map((x, i) => ({ owner: `copy-${i}`, k: x.ledger.k, m: x.ledger.m, value: x.ledger.out, label: `${minus(A)} × ${bracket(x.ledger.m)}` }));
  const sums = plan.beats.filter(x => x.ledger.law === 'sum').map(x => `${minus(x.ledger.a)} + ${bracket(x.ledger.b)} = ${minus(x.ledger.out)}`);
  if (copies.length > ROW_LIMIT.rows || [product, ...copies.map(c => c.value)].some(v => !Number.isSafeInteger(Number(v)) || placesOf(v, base) > ROW_LIMIT.places)) return null;
  const n = copies.length, speed = n > 6 ? Math.min(2.5, n / 5) : 1;
  // The lowest copy lands first; each later copy collides with the sum so far.
  const order = copies.map((_, i) => i).reverse();
  const units = unitPlanMany(0, 'result', order.map((i, j) => ({ value: Number(copies[i].value), owner: copies[i].owner, delay: j * .16 / speed })), { sequential: true, speed, base });
  oneAtATime(units, order.map(i => copies[i].owner), .2 / speed);
  const terms = copies.map((c, i) => i ? (c.m.startsWith('-') ? ` − ${minus(c.m.slice(1))}` : ` + ${c.m}`) : minus(c.m)).join('');
  const split = !n ? (a.value.n === 0 ? `Nothing to multiply: 0 × ${bracket(B)} = 0.` : `${minus(A)} × 0: no lit bulbs, so no copies. 0.`)
    : n === 1 ? `${minus(B)} has one lit bulb: one copy of ${minus(A)}, shifted ${copies[0].k} place${copies[0].k === 1 ? '' : 's'}.`
    : `${minus(B)} = ${terms}: a copy of ${minus(A)} for each lit bulb, shifted to its place${copies.some(c => c.m.startsWith('-')) ? '; red ones swap' : ''}.`;
  const stagger = n > 1 ? Math.min(.45, 1.6 / (n - 1)) : 0, layout = n ? .35 + (n - 1) * stagger + .7 : .6, hold = .3;
  // Captions: the split, then each copy as it lands and each addition as it starts.
  const arrive = order.map(i => units.phases.find(ph => ph.type === 'transfer' && ph.before.find(t => t.id === ph.removed[0])?.owner === copies[i].owner)?.start ?? 0);
  const captions = [{ from: 0, text: split }];
  order.forEach((i, j) => captions.push({ from: layout + hold + arrive[j], text: j ? sums[j - 1] ?? '' : `${copies[i].label} = ${minus(copies[i].value)}` }));
  const sumStart = layout + hold, duration = sumStart + units.duration + .45;
  captions.push({ from: duration - .45, text: `${minus(A)} × ${bracket(B)} = ${minus(product)}` });
  return { kind: 'rows-multiply', base, a: A, b: B, product, copies, units, layout, stagger, sumStart, duration, captions };
}
// A ÷ B: the machine's long division, in rows. The divisor is shifted under the dividend's
// top; each round a copy of it is taken away where it fits (base 2: truncating) or where that
// leaves a remainder nearer zero (balanced ternary: rounding to nearest), lighting that
// place's quotient bulb, and it moves one place right. The cards then show A ÷ B exactly:
// the quotient, or the quotient and what the remainder adds.
export function rowDivisionPlan(term, base, planner = machinePlanner) {
  const [a, b] = term.expr.operands;
  if (!planner || !bases[base]?.bulbs || term.expr.ops[0] !== '÷' || a.value.d !== 1 || b.value.d !== 1 || !b.value.n) return null;
  const plan = planOf('div', a, b, base, planner);
  if (!plan) return null;
  const A = String(a.value.n), B = String(b.value.n), radix = BigInt(bases[base].radix), absB = BigInt(B) < 0n ? -BigInt(B) : BigInt(B);
  const prep = plan.beats.find(x => x.kind === 'prep'), K = prep.ledger.k, [q, r] = plan.result.values;
  const rounds = [];
  let R = A, k = K, round = null;
  for (const beat of plan.beats) {
    if (beat.kind === 'compare' || beat.kind === 'try') rounds.push(round = { k, before: R, after: R, q: 0, look: beat.caption, verdict: '' });
    else if (beat.kind === 'collide' && round) { round.after = R = beat.ledger.r; round.q = Number(beat.ledger.q); round.verdict = beat.caption; }
    else if (beat.kind === 'judge' && round) { if (beat.ledger.q !== '0') { round.after = R = beat.ledger.r; round.q = Number(beat.ledger.q); } round.verdict = beat.caption; }
    else if (beat.kind === 'clear') { rounds.push({ k, before: R, after: R, q: 0, look: beat.caption, verdict: '', clear: true }); break; }
    else if (beat.kind === 'descend') k--;
  }
  const D = k => absB * radix ** BigInt(k), sign = v => BigInt(v) < 0n ? -1n : 1n;
  for (const x of rounds) { x.divisor = String(D(x.k)); x.trial = String(-(sign(x.before === '0' ? A : x.before)) * D(x.k)); }
  const values = [A, B, q, r, String(D(K)), ...rounds.flatMap(x => [x.before, x.after])];
  if (rounds.length > ROW_LIMIT.rounds || values.some(v => !Number.isSafeInteger(Number(v)) || placesOf(v, base) > ROW_LIMIT.places)) return null;
  const speed = rounds.length > 3 ? Math.min(2.5, rounds.length / 3) : 1, pace = x => x / speed;
  const captions = [], times = { lift: [.3, .3 + pace(.9)] };
  const say = (from, text) => { if (text) captions.push({ from, text }); };
  const places = n => `${n} place${n === 1 ? '' : 's'}`, quotient = `${K + 1} dark bulb${K ? 's wait' : ' waits'} for the quotient`;
  say(0, K ? `${minus(A)} ÷ ${bracket(B)}: shift ${absB} left ${places(K)}, to ${D(K)}; ${quotient}.` : `${minus(A)} ÷ ${bracket(B)}: ${absB} stays where it is; ${quotient}.`);
  let t = times.lift[1] + pace(.25);
  rounds.forEach((x, j) => {
    x.start = t; say(t, x.look); t += pace(.6);
    if (x.after !== x.before) {
      x.units = unitPlanMany(Number(x.before), 'rem', [{ value: Number(x.after) - Number(x.before), owner: 'copy' }], { base, speed });
      x.collide = [t, t + x.units.duration]; say(t, x.verdict); t += x.units.duration; x.light = [t - pace(.2), t + pace(.15)]; t += pace(.25);
    } else if (!x.clear) { x.dim = [t, t + pace(.45)]; say(t, x.verdict); t += pace(.5); }
    if (j < rounds.length - 1) { x.descend = [t, t + pace(.45)]; say(t, `Shift the divisor one place right: ${D(x.k - 1)}.`); t += pace(.55); }
    x.end = t;
  });
  const exact = r === '0', share = x => x.startsWith('-') ? `− ${minus(x.slice(1))}` : `+ ${x}`;
  say(t, exact ? `${minus(A)} ÷ ${bracket(B)} = ${minus(q)}.` : `${minus(A)} = ${minus(q)} × ${bracket(B)} ${share(r)}, so ${minus(A)} ÷ ${bracket(B)} = ${minus(q)} ${share(r)}/${bracket(B)}.`);
  times.answer = [t + pace(.2), t + pace(.2) + .7];
  const duration = times.answer[1] + (exact ? .45 : 1.2);
  return { kind: 'rows-divide', base, a: A, b: B, K, divisor: String(D(K)), q, r, exact, rounds, times, captions, duration };
}
// The row form of one × or ÷ step in a bulb base, or null (a cross-fade).
export function rowPlan(transaction, base) {
  const { before, command } = transaction;
  const term = [...before.left, ...before.right].find(t => t.id === command.id);
  if (!term?.expr || term.expr.operands.length < 2) return null;
  return term.expr.ops[0] === '×' ? rowMultiplicationPlan(term, base) : rowDivisionPlan(term, base);
}
