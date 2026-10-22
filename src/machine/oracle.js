// Reference results for every binary and ternary block, with no animation: the planners'
// outputs and the identities are checked against this, and this against BigInt.
//
// evaluate(op, base, args) → {value, remainder?} | {error: 'zeroDivision'|'domain'|'tooBig'}
// (6.6). DIV and SHR give the remainder beside the quotient; MOD's value is the remainder.
// 'tooBig' is 6.10's computed shift count past any tower: such a count cannot even be
// multiplied out, so it is refused here rather than computed.
import {RADIX, divTrunc, divRound, tritwise, signOf, bitLength} from './bigmath.js';

export const OPS = {
  binary: ['add', 'sub', 'mul', 'div', 'mod', 'cmp', 'shl', 'shr', 'and', 'or', 'xor', 'not'],
  ternary: ['add', 'sub', 'mul', 'div', 'mod', 'cmp', 'shl', 'shr', 'min', 'max', 'sum', 'cons', 'neg'],
};
// No tower holds more than 64 levels, so a larger count is refused rather than computed.
const MAX_SHIFT = 4096n;
const divide = (base, a, b) => base === 'binary' ? divTrunc(a, b) : divRound(a, b);
export function evaluate(op, base, args) {
  if (!OPS[base]?.includes(op)) return {error: 'domain'};
  const [a, b] = args.map(BigInt), radix = RADIX[base];
  switch (op) {
    case 'add': return {value: a + b};
    case 'sub': return {value: a - b};
    case 'mul': return {value: a * b};
    case 'div': case 'mod': {
      if (b === 0n) return {error: 'zeroDivision'};
      const {q, r} = divide(base, a, b);
      return op === 'div' ? {value: q, remainder: r} : {value: r};
    }
    case 'cmp': return {value: BigInt(signOf(a - b))};
    case 'shl':
      if (b < 0n) return {error: 'domain'};
      if (a === 0n) return {value: 0n};
      if (b > MAX_SHIFT) return {error: 'tooBig'};
      return {value: a * radix ** b};
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
