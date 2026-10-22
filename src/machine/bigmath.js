// Exact BigInt digits for the machine's whole-number bases. Binary is sign-magnitude (a
// negative number's lit bits are −1) except in logic, where it is infinite two's complement
// drawn with a sign lamp; balanced ternary is signed natively. Every digit string is built
// here from BigInt arithmetic; only the suffixes come from bases.js.
import {bases} from '../mvc/bases.js';

export const RADIX = {binary: 2n, ternary: 3n};
const abs = n => n < 0n ? -n : n;
export const signOf = n => n > 0n ? 1 : n < 0n ? -1 : 0;
export const bitLength = n => n === 0n ? 0 : abs(n).toString(2).length;

// Below 2^31 the digits come from exact Number arithmetic; the answer is the same.
const SMALL = 2n ** 31n;
// LSB first; [0] for 0.
export function digits(n, base) {
  n = BigInt(n);
  if (n === 0n) return Int8Array.of(0);
  if (n < SMALL && n > -SMALL) {
    let m = Number(n), k = 0;
    const out = new Int8Array(32);
    if (base === 'ternary') while (m !== 0) { let r = m % 3; if (r < 0) r += 3; if (r === 2) r = -1; out[k++] = r; m = (m - r) / 3; }
    else { const s = m < 0 ? -1 : 1; for (m = Math.abs(m); m; m >>>= 1) out[k++] = m & 1 ? s : 0; }
    return out.slice(0, k);
  }
  const out = [];
  if (base === 'ternary') for (let m = n; m !== 0n;) { let r = Number(((m % 3n) + 3n) % 3n); if (r === 2) r = -1; out.push(r); m = (m - BigInt(r)) / 3n; }
  else { const s = signOf(n); for (const c of abs(n).toString(2)) out.push(c === '1' ? s : 0); out.reverse(); }
  return Int8Array.from(out);
}
export function fromDigits(d, base) {
  const r = RADIX[base];
  if (d.length <= 19) {          // 3^19 < 2^31: exact in a Number
    let v = 0; const radix = Number(r);
    for (let k = d.length - 1; k >= 0; k--) v = v * radix + d[k];
    return BigInt(v);
  }
  let v = 0n;
  for (let k = d.length - 1; k >= 0; k--) v = v * r + BigInt(d[k]);
  return v;
}
// Lamp normal form: n = Σ bits_i·2^i − lamp·2^len, and the top bit differs from the lamp
// unless only level 0 is left (0 = 0|dark, −1 = 1|lit, −2 = 0|lit, −4 = 00|lit).
export function twos(n) {
  n = BigInt(n);
  if (n >= 0n) { const bits = digits(n, 'binary'); return {bits: Uint8Array.from(bits), lamp: 0}; }
  const len = Math.max(1, bitLength(-n - 1n)), rest = n + (1n << BigInt(len)), bits = new Uint8Array(len);
  for (let k = 0; k < len; k++) bits[k] = Number((rest >> BigInt(k)) & 1n);
  return {bits, lamp: 1};
}
export function fromTwos(bits, lamp) {
  let v = 0n;
  for (let k = bits.length - 1; k >= 0; k--) v = v * 2n + BigInt(bits[k]);
  return lamp ? v - (1n << BigInt(bits.length)) : v;
}
// Trit by trit: min, max, sum (balanced, the carry thrown away) and cons (the consensus).
const TRIT = {
  min: (x, y) => Math.min(x, y),
  max: (x, y) => Math.max(x, y),
  sum: (x, y) => { const s = x + y; return s > 1 ? s - 3 : s < -1 ? s + 3 : s; },
  cons: (x, y) => x === y ? x : 0,
};
export const trit = (op, x, y) => TRIT[op](x, y);
export function tritwise(op, a, b) {
  const da = digits(a, 'ternary'), db = digits(b, 'ternary'), f = TRIT[op], out = [];
  for (let k = 0; k < Math.max(da.length, db.length); k++) out.push(f(da[k] ?? 0, db[k] ?? 0));
  return fromDigits(out, 'ternary');
}
// Binary divides like BigInt: q truncates and r takes the dividend's sign.
export function divTrunc(a, b) { a = BigInt(a); b = BigInt(b); return {q: a / b, r: a % b}; }
// Balanced ternary rounds to nearest, ties toward zero: |r| ≤ |b|/2, a tie keeps a's sign.
export function divRound(a, b) {
  a = BigInt(a); b = BigInt(b);
  const q = BigInt(signOf(a) * signOf(b)) * ((2n * abs(a) + abs(b) - 1n) / (2n * abs(b)));
  return {q, r: a - b * q};
}
export const fmt = v => String(v).replace('-', '−');
export const fmtOperand = v => String(v).startsWith('-') ? `(${fmt(v)})` : fmt(v);
const sub = base => bases[base].sub;
export function baseString(v, base, {lamp} = {}) {
  v = BigInt(v);
  if (base === 'ternary') {
    const d = digits(v, base); let s = '';
    for (let k = d.length - 1; k >= 0; k--) s += d[k] < 0 ? 'T' : String(d[k]);
    return s + sub(base);
  }
  if (lamp) { const t = twos(v); let s = '…' + t.lamp; for (let k = t.bits.length - 1; k >= 0; k--) s += t.bits[k]; return s + sub(base); }
  return (v < 0n ? '−' : '') + abs(v).toString(2) + sub(base);
}
