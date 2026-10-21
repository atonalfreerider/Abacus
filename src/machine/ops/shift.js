// SHL and SHR take a count k. It arrives as a coin and expands into the tower b^k (one lit
// bulb at level k over k darks, noted ×2³) when it lands in the count socket; SHL is then
// MULT's SHIFT leaf, and SHR one DROP: the bottom k bulbs fall out as the remainder and the
// rest descends k levels. SHR(a, k) = DIV(a, b^k) in each base's convention.
import {RADIX, divTrunc, divRound} from '../bigmath.js';
import {caption, sup} from '../captions.js';
import {getBase} from '../registry.js';
import {column, topOf} from './borrow.js';
import {leaf, zero} from './multiply.js';

export const COUNT_OPS = {shl: '×', shr: '÷', mule: '×'};
const symbol = base => base === 'e' ? 'e' : String(RADIX[base]);
// The value string of b^k: base e spells e^k through its own parser.
export function powerValue(base, k) {
  if (RADIX[base]) return String(RADIX[base] ** BigInt(k));
  const parsed = getBase(base).parseValue(k === 0 ? '1' : k === 1 ? 'e' : `e^${k}`);
  return parsed.value;
}
// Inside an open beat: tower t holds the count k; rewrite it as b^k and note it. The node
// remembers the multiplier in `arg`, so the tree's value never depends on the expansion.
export function expandCount(b, node, t) {
  const op = b.scene.nodes[node].op, k = Number(b.scene.towers[t].value), power = powerValue(b.base, k);
  for (const [id] of b.bulbsOf(t)) b.drop(id);
  b.tower(t, {value: power, note: `${COUNT_OPS[op]}${symbol(b.base)}${sup(k)}`});
  getBase(b.base).place(b, t, power, {});
  b.node(node, {arg: power});
  return {k, power};
}
export function shl(b, node, [A, M]) {
  return b.valueOf(A) === 0n ? zero(b, node, A, M) : leaf(b, node, A, M);
}
export function shr(b, node, [A, M]) {
  const a = b.valueOf(A), m = b.valueOf(M), Mc = column(b, M), k = Mc.length - 1;
  const {q, r} = b.base === 'binary' ? divTrunc(a, m) : divRound(a, m);
  b.begin('drop', node, {caption: caption.drop(a, `${symbol(b.base)}${sup(k)}`, k, q, r), ledger: {law: 'divstep', a: String(a), b: String(m), q: String(q), r: String(r)}});
  b.node(node, {glyph: 0});
  const Ac = column(b, A), rest = b.id('t'), fall = Ac.slice(0, k), top = topOf(fall);
  b.dropTower(M);
  b.tower(rest, {at: `${node}.R`, form: 'tower', value: String(r)});
  b.tower(A, {value: String(q)});
  // the bottom k bulbs slide across into the remainder; its leading darks trim
  fall.forEach((x, l) => { if (l <= top) b.bulb(x.id, {t: rest}); else b.drop(x.id, {to: {t: rest, l}, fade: [0.9, 1]}); });
  if (!fall.length) b.bulb(b.id('b'), {t: rest, l: 0, s: 0});
  for (let l = k; l < Ac.length; l++) b.bulb(Ac[l].id, {l: l - k});
  if (Ac.length <= k) b.bulb(b.id('b'), {t: A, l: 0, s: 0});
  b.end();
  return {result: A, other: rest};
}
