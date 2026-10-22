// Reference results for every binary and ternary block, with no animation: the planners'
// outputs and the identities are checked against this, and this against BigInt.
//
// evaluate(op, base, args) → {value, remainder?} | {error: 'zeroDivision'|'domain'|'tooBig'}
// (6.6). DIV and SHR give the remainder beside the quotient; MOD's value is the remainder.
// Values far past any tower are still computed exactly, so a run that is too big to animate
// still shows its answer (6.10: cmp(shl(1, 5000), 3) is [1]). 'tooBig' is a value past
// MAX_BITS, a size no Output could show and no machine needs: a shift is refused before it
// is multiplied out, so an absurd count (2⁶²) costs nothing.
import {RADIX, divTrunc, divRound, tritwise, signOf, bitLength} from './bigmath.js';

export const OPS = {
  binary: ['add', 'sub', 'mul', 'div', 'mod', 'cmp', 'shl', 'shr', 'and', 'or', 'xor', 'not'],
  ternary: ['add', 'sub', 'mul', 'div', 'mod', 'cmp', 'shl', 'shr', 'min', 'max', 'sum', 'cons', 'neg'],
};
// 2¹⁴ bits (4 933 decimal digits): every block stays fast at that size, balanced ternary's
// digit-by-digit gates included (about 0.1 s).
export const MAX_BITS = 1n << 14n;
const fits = v => BigInt(bitLength(v)) <= MAX_BITS ? {value: v} : {error: 'tooBig'};
const divide = (base, a, b) => base === 'binary' ? divTrunc(a, b) : divRound(a, b);
export function evaluate(op, base, args) {
  if (!OPS[base]?.includes(op)) return {error: 'domain'};
  const [a, b] = args.map(BigInt), radix = RADIX[base];
  switch (op) {
    case 'add': return fits(a + b);
    case 'sub': return fits(a - b);
    case 'mul': return BigInt(bitLength(a) + bitLength(b)) > MAX_BITS + 1n ? {error: 'tooBig'} : fits(a * b);
    case 'div': case 'mod': {
      if (b === 0n) return {error: 'zeroDivision'};
      const {q, r} = divide(base, a, b);
      return op === 'div' ? {value: q, remainder: r} : {value: r};
    }
    case 'cmp': return {value: BigInt(signOf(a - b))};
    case 'shl':
      if (b < 0n) return {error: 'domain'};
      if (a === 0n) return {value: 0n};
      // 3^k has fewer than 2k bits
      if (BigInt(bitLength(a)) + b * (radix === 2n ? 1n : 2n) > MAX_BITS) return {error: 'tooBig'};
      return fits(a * radix ** b);
    case 'shr': {
      if (b < 0n) return {error: 'domain'};
      // a count past the dividend's length leaves everything in the remainder
      if (b > BigInt(bitLength(a) + 1)) return {value: 0n, remainder: a};
      const {q, r} = divide(base, a, radix ** b);
      return {value: q, remainder: r};
    }
    case 'and': return {value: a & b};
    case 'or': return {value: a | b};
    case 'xor': return {value: a ^ b};
    case 'not': return {value: ~a};
    case 'min': case 'max': case 'sum': case 'cons': return {value: tritwise(op, a, b)};
    case 'neg': return {value: -a};
  }
  return {error: 'domain'};
}
