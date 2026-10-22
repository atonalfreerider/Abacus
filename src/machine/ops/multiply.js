// MULT (PRIME §4): A is the multiplicand, the only operand ever shifted; B is the multiplier,
// the only one decomposed. A zero absorbs the other operand; a one-digit B = t·b^k is a
// SHIFT; otherwise the node SPLITs in place into + over two × nodes, peeling B's top digit:
// A × B = A × T + A × R. The children are solved depth-first, left first, by plan.js.
import {RADIX} from '../bigmath.js';
import {caption} from '../captions.js';
import {column, topOf} from './borrow.js';

export function mul(b, node, [A, B]) {
  const a = b.valueOf(A), m = b.valueOf(B);
  if (a === 0n || m === 0n) return zero(b, node, A, B);
  const Bc = column(b, B);
  if (Bc.filter(x => x.s).length === 1) return leaf(b, node, A, B);
  split(b, node, A, B, Bc);
  return {result: null};
}
// A zero operand's dark bulb moves to the node centre and the other's bulbs slide down into
// it and fade: nothing rises, so no tower of leading darks appears.
export function zero(b, node, A, B) {
  const a = b.valueOf(A), m = b.valueOf(B), aZero = a === 0n, z = aZero ? A : B, other = aZero ? B : A;
  b.begin('zero', node, {caption: caption.zero(a, m, aZero), ledger: {law: 'zero', a: String(a), b: String(m), out: '0'}});
  b.node(node, {glyph: 0});
  b.tower(z, {at: `${node}.C`});
  for (const [id] of b.bulbsOf(other)) b.drop(id, {to: {t: z, l: 0}});
  b.dropTower(other);
  b.end();
  return {result: z};
}
// B's bulbs slide into A's column at their levels while A slides to the centre and rises k
// levels; B's k darks fill levels 0..k−1 and its lead dissolves where A's units land (×1).
// A red lead is the identity negated: A's colours swap as it dissolves.
export function leaf(b, node, A, B) {
  const a = b.valueOf(A), m = b.valueOf(B), Bc = column(b, B), k = Bc.length - 1, lead = Bc[k], sign = lead.s, out = a * m;
  b.begin('shift', node, {caption: caption.shift(a, m, k, sign, out), ledger: {law: 'shift', a: String(a), m: String(m), k, sign, out: String(out)}});
  b.node(node, {glyph: 0});
  b.tower(A, {at: `${node}.C`, value: String(out)});
  for (const [id, x] of b.bulbsOf(A)) b.bulb(id, sign < 0 && x.s ? {l: x.l + k, s: -x.s} : {l: x.l + k});
  for (let l = 0; l < k; l++) b.bulb(Bc[l].id, {t: A});
  b.drop(lead.id, {to: {t: A, l: k}, dissolve: true});
  b.dropTower(B);
  b.end();
  return {result: A};
}
// The node turns into + in place and two × nodes slide out of its centre. A and B (now T)
// ride to the left child; a copy A′ peels off A for the right child; B's lit bulbs below k
// travel to the right child as R, and dark bulbs fade in behind them.
function split(b, node, A, B, Bc) {
  const a = b.valueOf(A), m = b.valueOf(B), k = Bc.length - 1;
  const T = BigInt(Bc[k].s) * RADIX[b.base] ** BigInt(k), R = m - T, rTop = topOf(Bc.slice(0, k));
  b.begin('split', node, {caption: caption.split(a, m, T, R), ledger: {law: 'split', a: String(a), b: String(m), t: String(T), r: String(R)}});
  const left = b.id('n'), right = b.id('n');
  b.node(node, {op: 'add'});
  b.node(left, {op: 'mul', parent: node, socket: 'L'});
  b.node(right, {op: 'mul', parent: node, socket: 'R'});
  b.tower(A, {at: `${left}.L`});
  b.tower(B, {at: `${left}.R`, value: String(T)});
  const copy = b.id('t'), rest = b.id('t');
  b.tower(copy, {at: `${right}.L`, form: 'tower', value: String(a)});
  b.tower(rest, {at: `${right}.R`, form: 'tower', value: String(R)});
  for (const [, x] of b.bulbsOf(A)) b.bulb(b.id('b'), {t: copy, l: x.l, s: x.s}, {from: {t: A, l: x.l}});
  for (let l = 0; l < k; l++) {
    if (Bc[l].s) { b.bulb(Bc[l].id, {t: rest}); b.bulb(b.id('b'), {t: B, l, s: 0}); }
    else if (l < rTop) b.bulb(b.id('b'), {t: rest, l, s: 0});
  }
  b.mark({k: 'ring', t: B, l: rTop});
  b.end();
}
