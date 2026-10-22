// The row form of PRIME's split in the equation space (design 4.6, phase 5): × and ÷ of whole
// numbers in base 2 and balanced ternary. The Machine's planner (src/machine/plan.js) does the
// arithmetic: which shifted copies a product splits into and the depth-first order they are
// added in, and which shifted copies of the divisor a quotient takes away. app.js loads this
// module with the planner (dynamic imports, once a bulb base is chosen) and hands
// rowForm(planMachine) to operations.js, so the equation space starts without either.
import { math } from './model.js';
import { unitPlanMany, scheduleUnits } from './units.js';
import { bases, baseSpec } from './bases.js';
import { rowMultiplyStage, rowDivideStage } from './row-view.js';

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
export function rowMultiplicationPlan(term, base, planner) {
  const [a, b] = term.expr.operands;
  if (!planner || !bases[base]?.bulbs || term.expr.ops[0] !== '×' || a.value.d !== 1 || b.value.d !== 1) return null;
  const plan = planOf('mul', a, b, base, planner);
  if (!plan) return null;
  const A = String(a.value.n), B = String(b.value.n), product = String(BigInt(A) * BigInt(B));
  const copies = plan.beats.filter(x => x.kind === 'shift').map((x, i) => ({ owner: `copy-${i}`, k: x.ledger.k, m: x.ledger.m, value: x.ledger.out, label: `${minus(A)} × ${bracket(x.ledger.m)}` }));
  const sums = plan.beats.filter(x => x.ledger.law === 'sum').map(x => `${minus(x.ledger.a)} + ${bracket(x.ledger.b)} = ${minus(x.ledger.out)}`);
  if (copies.length > ROW_LIMIT.rows || [product, ...copies.map(c => c.value)].some(v => !Number.isSafeInteger(Number(v)) || placesOf(v, base) > ROW_LIMIT.places)) return null;
  const n = copies.length, speed = n > 4 ? Math.min(3, n / 3) : 1;
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
export function rowDivisionPlan(term, base, planner) {
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
export function rowPlan(transaction, base, planner) {
  const { before, command } = transaction;
  const term = [...before.left, ...before.right].find(t => t.id === command.id);
  if (!term?.expr || term.expr.operands.length < 2) return null;
  return term.expr.ops[0] === '×' ? rowMultiplicationPlan(term, base, planner) : rowDivisionPlan(term, base, planner);
}
// What operations.js's useRowForm takes: the plans, made with this planner, and their frames.
export const rowForm = planner => ({ plan: (transaction, base) => rowPlan(transaction, base, planner), stage: context => (context.op.kind === 'rows-multiply' ? rowMultiplyStage : rowDivideStage)(context) });
