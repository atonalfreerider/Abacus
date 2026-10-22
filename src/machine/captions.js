// Caption templates for the flow beats and the binary/ternary blocks. Captions are part of
// the plan, so a subtitle can never disagree with the arithmetic. Each is at most 110
// characters (I8): when a long number would overflow a template, a shorter one is used.
import {fmt, fmtOperand} from './bigmath.js';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = k => String(k).replace(/\d/g, d => SUP[d]).replace('-', '⁻');
export const MAX_CAPTION = 110;
export const BLOCKS = {
  add: '+ block', sub: '− block', mul: '× block', div: '÷ block', mod: 'mod block', cmp: 'comparator',
  shl: 'shift block', shr: 'shift block', and: 'AND gate', or: 'OR gate', xor: 'XOR gate', not: 'NOT gate',
  min: 'MIN gate', max: 'MAX gate', sum: 'SUM gate', cons: 'CONS gate', neg: 'NEG block',
  mule: '×eᵏ block', measure: 'ruler', ln: 'ruler',
};
const fit = (...options) => options.find(s => s.length <= MAX_CAPTION) ?? options.at(-1).slice(0, MAX_CAPTION - 1) + '…';
const list = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const abs = v => String(v).replace(/^-/, '');
const colour = s => s > 0 ? 'blue' : 'red';
const lit = x => x !== null && x !== 0;
const plus = (a, b) => `${fmt(a)} + ${fmtOperand(b)}`;

// One level of a level-pace ADD, from its inputs {r, i, c} and the survivor rule's verdict.
function levelPhrase(base, {r, i, c}, res, first) {
  if (r === null) return 'the carry lands above the top and the tower grows.';
  if (base === 'binary') {
    if (c === null) {
      if (lit(r) && lit(i)) return first ? '1 + 1, the resident climbs.' : '1 + 1: the resident climbs; the newcomer stays, dark.';
      if (lit(r)) return 'only a dark bulb arrives; the 1 stays.';
      if (lit(i)) return 'a lit bulb lands on a dark level and stays.';
      return 'only a dark bulb arrives; the level stays dark.';
    }
    if (!lit(r) && !lit(i)) return 'the carry lands on a dark level and stays.';
    if (lit(r) && lit(i)) return 'three lit bulbs: the resident climbs; the carry stays lit.';
    if (lit(r)) return 'the carry meets a lit bulb: the resident climbs on; the carry stays, dark.';
    return 'the carry and the newcomer make 2: the dark resident lights and climbs; the carry stays, dark.';
  }
  const terms = [r, i, c].filter(lit), s = terms.reduce((x, y) => x + y, 0);
  const sum = terms.map((x, k) => k ? fmtOperand(x) : fmt(x)).join(' + ');
  if (res.cOut) {
    if (Math.abs(s) === 3) return `three ${colour(s)} bulbs make ${fmt(s)}: the resident climbs, the carry goes dark.`;
    const climb = `${sum} = ${s > 0 ? '3 − 1' : '−3 + 1'}: ${r === 0 ? 'the dark resident lights and climbs' : 'the resident climbs'}`;
    if (first) return climb + '.';
    return `${climb}, the ${res.stay === 'C' ? 'carry' : 'newcomer'} ${res.d ? `turns ${colour(res.d)}` : 'goes dark'}.`;
  }
  if (res.burst) return `${sum} = ${fmt(s)}: blue and red cancel.`;
  if (!terms.length) return 'only a dark bulb arrives; the level stays dark.';
  if (c !== null && !lit(r) && !lit(i)) return 'the carry lands on a dark level and stays.';
  if (lit(r)) return `only a dark bulb arrives; the ${colour(r)} bulb stays.`;
  return `a ${colour(s)} bulb lands on a dark level and stays.`;
}

export const caption = {
  input: texts => fit(`[${texts.join(', ')}] goes in.`, 'The numbers go in.'),
  deliver: (texts, op) => fit(texts.length === 1 ? `${texts[0]} rides down the wire to the ${BLOCKS[op]}.` : `The numbers ride down the wire to the ${BLOCKS[op]}.`, `It rides down the wire to the ${BLOCKS[op]}.`),
  fanout(items) {
    if (items.length === 1 && items[0].reading) return fit(`${items[0].text} arrives as one light at height ${items[0].reading}.`, 'It arrives as one light.');
    const texts = items.map(x => x.text), powers = items.filter(x => x.note).map(x => `; ${x.count} becomes ${x.note}`).join('');
    return fit(items.length === 1 ? `${texts[0]} drops into the socket and stands up${powers}.` : `${list(texts)} drop into the sockets and stand up${powers}.`,
      `The numbers drop into the sockets and stand up${powers}.`, 'The numbers drop into the sockets and stand up.');
  },
  ret: (text, root) => fit(root ? `${text} rides up into the triangle.` : `${text} rides up.`, root ? 'The answer rides up into the triangle.' : 'The answer rides up.'),
  quotientReturn(q, r, {root, mod}) {
    if (root) return fit(`${fmt(q)} and ${fmt(r)} ride up into the triangle.`, 'The quotient and the remainder ride up into the triangle.');
    return fit(mod ? `${fmt(r)} rides up; the quotient ${fmt(q)} fades.` : `${fmt(q)} rides up; the remainder ${fmt(r)} fades.`, mod ? 'The remainder rides up.' : 'The quotient rides up.');
  },
  output: text => fit(`Output ${text}.`, 'Output.'),

  collide: (a, b, climbs, out) => fit(`${plus(a, b)}: ${climbs ? n(climbs, 'carry climbs', 'carries climb') : 'nothing carries'}. ${fmt(out)}.`,
    `${climbs ? n(climbs, 'carry climbs', 'carries climb') : 'Nothing carries'}. ${fmt(out)}.`),
  levelStart: (base, a, b, step) => fit(`${plus(a, b)}: the bulbs wait beside their levels. Level 0: ${levelPhrase(base, step.cell, step.res, true)}`,
    `The bulbs wait beside their levels. Level 0: ${levelPhrase(base, step.cell, step.res, true)}`),
  levelStep: (base, k, step, out) => fit(`Level ${k}: ${levelPhrase(base, step.cell, step.res, false)}${out ? ` ${out}.` : ''}`, `Level ${k} resolves.${out ? ` ${out}.` : ''}`),
  annihilate: ([a, b], owed, out) => fit(`${a} + ${b}: opposite colours cancel${owed ? `, and ${n(owed, 'bulb is', 'bulbs are')} owed` : ''}. ${fmt(out)}.`,
    `Opposite colours cancel${owed ? `, and ${n(owed, 'bulb is', 'bulbs are')} owed` : ''}. ${fmt(out)}.`),
  borrow(k, j, value) {
    const passing = j - k === 1 ? '' : j - k === 2 ? `, lighting level ${k + 1},` : j - k === 3 ? `, lighting levels ${k + 1} and ${k + 2},` : `, lighting levels ${k + 1} to ${j - 1},`;
    return fit(`Level ${k} is owed: the bulb at level ${j} comes down${passing} and pays it.${value ? ` ${fmt(value)}.` : ''}`, `Level ${k} is owed: a bulb comes down and pays it.`);
  },
  negate: (b, out) => fit(String(b) === '0' ? 'Subtracting 0 adds 0: there is no colour to swap.' : `Subtracting ${fmtOperand(b)} adds ${fmtOperand(out)}: every lit bulb swaps colour.`, 'Subtracting is adding the negative: every lit bulb swaps colour.'),

  split: (a, b, t, r) => fit(`${fmt(b)} = ${plus(t, r)}, so ${fmt(a)} × ${fmtOperand(b)} = ${fmt(a)} × ${fmtOperand(t)} + ${fmtOperand(a)} × ${fmtOperand(r)}.`,
    `${fmt(b)} = ${plus(t, r)}: split into two products.`, 'Split the multiplier into its top bulb and the rest.'),
  shift(a, m, k, sign, out) {
    if (!k) return fit(sign > 0 ? `${fmt(a)} × 1: the 1 dissolves; ${fmt(a)} stays put.` : `${fmt(a)} × (−1): every colour swaps. ${fmt(out)}.`, sign > 0 ? 'The 1 dissolves; the number stays put.' : `Every colour swaps. ${fmt(out)}.`);
    const swap = sign < 0 ? ' and every colour swaps' : '';
    return fit(`${fmt(a)} × ${fmtOperand(m)}: ${n(k, 'dark bulb slides', 'dark bulbs slide')} under ${fmt(a)}; it rises ${n(k, 'level', 'levels')}${swap}. ${fmt(out)}.`,
      `${n(k, 'dark bulb slides', 'dark bulbs slide')} under it; it rises ${n(k, 'level', 'levels')}${swap}. ${fmt(out)}.`);
  },
  zero: (a, b, aZero) => fit(aZero ? `Nothing to multiply: 0 × ${fmtOperand(b)} = 0.` : `${fmt(a)} × 0: no lit bulbs to shift. 0.`, 'Nothing to multiply. 0.'),
  drop(a, power, k, q, r) {
    if (!k) return fit(`${fmt(a)} ÷ 1: nothing falls out. ${fmt(q)} r 0.`, 'Nothing falls out.');
    return fit(`${fmt(a)} ÷ ${power}: the bottom ${n(k, 'bulb falls', 'bulbs fall')} out as the remainder; the rest descends. ${fmt(q)} r ${fmt(r)}.`,
      `The bottom ${n(k, 'bulb falls', 'bulbs fall')} out as the remainder. ${fmt(q)} r ${fmt(r)}.`);
  },

  prep(a, b, K, D, ternary) {
    const head = `${fmt(a)} ÷ ${fmtOperand(b)}: `, q = ternary ? `${n(K + 1, 'dark trit waits', 'dark trits wait')} for the quotient` : `${n(K + 1, 'dark bulb waits', 'dark bulbs wait')} for the quotient`;
    return fit(K ? `${head}lift ${abs(b)} by ${n(K, 'level', 'levels')} to ${fmt(D)}; ${q}.` : `${head}${abs(b)} stays at its height; ${q}.`,
      K ? `Lift the divisor ${n(K, 'level', 'levels')}; ${q}.` : `The divisor stays at its height; ${q}.`);
  },
  fits: (D, R, k, fits) => fit(`Does ${fmt(D)} fit in ${abs(R)}? ${fits ? 'Yes.' : `No: quotient bulb ${k} stays dark.`}`, fits ? 'It fits.' : `It does not fit: quotient bulb ${k} stays dark.`),
  take: (D, k, R) => fit(`${fmt(D)} fits: take it away and light quotient bulb ${k}. ${fmt(R)}.`, `Take it away and light quotient bulb ${k}. ${fmt(R)}.`),
  descend: D => fit(`Drop the divisor one level: ${fmt(D)}.`, 'Drop the divisor one level.'),
  try: (R, D, G) => fit(`Try: ${fmt(R)} ${String(R).startsWith('-') ? '+' : '−'} ${fmt(D)} = ${fmt(G)}.`, `Try taking the divisor: ${fmt(G)}.`),
  judge(R, G, k, t, keep, tie) {
    if (tie) return fit(`${fmt(G)} and ${fmt(R)} are equally near zero: keep ${fmt(keep ? G : R)}, which has the dividend's sign.`, `A tie: keep the one with the dividend's sign.`);
    if (keep) return fit(`${fmt(G)} is nearer zero than ${fmt(R)}: keep it, and quotient trit ${k} lights ${colour(t)}.`, `Nearer zero: keep it, and quotient trit ${k} lights ${colour(t)}.`);
    return fit(`${fmt(R)} is nearer zero than ${fmt(G)}: the try fades.`, 'The remainder is nearer zero: the try fades.');
  },
  clear: () => 'Nothing left to share: the remaining quotient trits stay dark.',

  compare(a, b, v, why) {
    const sym = v > 0 ? '>' : v < 0 ? '<' : '=';
    return fit(`${fmt(a)} ${sym} ${fmtOperand(b)}: ${why}.`, `${sym}: ${why}.`);
  },
  gate(op, a, b, out) {
    const name = op.toUpperCase(), res = fmt(out);
    const how = {and: 'a dark bulb wins', or: 'a lit bulb wins', xor: 'two lit bulbs make a carry that evaporates',
      min: 'each level keeps the lower state', max: 'each level keeps the higher state',
      sum: 'each level adds, and the carry evaporates', cons: 'a level stays only where both agree'}[op];
    const head = ['and', 'or', 'xor'].includes(op) ? `${fmt(a)} ${name} ${fmtOperand(b)}` : `${name}(${fmt(a)}, ${fmt(b)})`;
    return fit(`${head}: ${how}. ${res}.`, `${name}: ${how}. ${res}.`);
  },
  not: (a, out) => fit(`NOT ${fmtOperand(a)}: every bulb and the lamp flip. ${fmt(out)}.`, `NOT: every bulb and the lamp flip. ${fmt(out)}.`),
  neg: (a, out) => fit(`NEG ${fmtOperand(a)}: every colour swaps. ${fmt(out)}.`, `NEG: every colour swaps. ${fmt(out)}.`),
  complement(step, inward, out) {
    if (inward) return fit(step === 'flip' ? `Into the gate: every bulb flips, and the lamp above lights red. ${fmt(out)}.` : `Add one: ${fmt(out)} in lamp form.`, 'Add one.');
    return fit(step === 'flip' ? `Back to red bulbs: every bulb flips, and the lamp goes out. ${fmt(out)}.` : `Add one red bulb: ${fmt(out)}.`, 'Add one red bulb.');
  },
};
