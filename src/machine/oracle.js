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
// 2¹⁴ bits, so every value below 2¹⁶³⁸⁴ in size (that is up to 4 933 decimal digits, but not
// every number of 4 933 digits): every block stays fast at that size, balanced ternary's
// digit-by-digit gates included (about 0.1 s). The budget is the same in both bases.
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
      // a·2^k has exactly bitLength(a) + k bits; 3^k > 2^(1.58·k), so past that count a
      // ternary shift is surely too big, and below it the value is worked out and measured
      // (the budget is a size in bits, and a refusal says so: it must not refuse a value
      // that fits, as the old bound of 2k bits for 3^k did from k = 8 192)
      if (radix === 2n ? BigInt(bitLength(a)) + b > MAX_BITS : b * 158n >= MAX_BITS * 100n) return {error: 'tooBig'};
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
