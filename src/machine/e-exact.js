// Exact numbers in base e: the ring Q[e, 1/e]. e is transcendental, so Z[e, 1/e] is the
// ring of Laurent polynomials and every value has exactly one representation
// Σ c_k·e^k / d. Equality is therefore symbolic, and the only thing that needs numerics
// is a sign: P(e) is enclosed between dyadic bounds of e, which tighten until the sign
// is certain. It always is in the end, because P(e) ≠ 0 whenever P ≠ 0. Floats appear
// only in heights and ≈ readouts, never in a digit or a decision.
const abs = n => n < 0n ? -n : n;
const gcd = (a, b) => { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; };
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = k => String(k).replace(/\d/g, d => SUP[d]).replace('-', '⁻');
const MINUS = '−';

export class PrecisionError extends Error {}

export class E {
  // terms: [k, c] pairs (exponent, integer coefficient), summed and reduced over d > 0.
  constructor(terms = [], d = 1n) {
    const m = new Map();
    for (const [k, c] of terms) if (c) m.set(k, (m.get(k) ?? 0n) + c);
    let t = [...m].filter(([, c]) => c).sort((a, b) => b[0] - a[0]);
    if (d < 0n) { d = -d; t = t.map(([k, c]) => [k, -c]); }
    if (!t.length) d = 1n;
    let g = d; for (const [, c] of t) g = gcd(g, c);
    if (g > 1n) { d /= g; t = t.map(([k, c]) => [k, c / g]); }
    this.t = t; this.d = d; Object.freeze(this);
  }
  static of(v) {
    if (v instanceof E) return v;
    if (typeof v === 'bigint') return new E([[0, v]]);
    if (typeof v === 'number') { if (!Number.isInteger(v)) throw Error(`E.of needs an integer, not ${v}`); return new E([[0, BigInt(v)]]); }
    if (typeof v === 'string') return E.parse(v);
    return new E([[0, BigInt(v.n)]], BigInt(v.d ?? 1));
  }
  static e(k = 1) { return new E([[k, 1n]]); }
  static parse(text) { return parseE(text); }
  add(y) { y = E.of(y); return new E([...this.t.map(([k, c]) => [k, c * y.d]), ...y.t.map(([k, c]) => [k, c * this.d])], this.d * y.d); }
  sub(y) { return this.add(E.of(y).neg()); }
  neg() { return new E(this.t.map(([k, c]) => [k, -c]), this.d); }
  abs() { return sign(this) < 0 ? this.neg() : this; }
  mul(y) {
    y = E.of(y); const out = [];
    for (const [i, a] of this.t) for (const [j, b] of y.t) out.push([i + j, a * b]);
    return new E(out, this.d * y.d);
  }
  shift(k) { return new E(this.t.map(([j, c]) => [j + k, c]), this.d); }
  coeff(k) { const c = this.t.find(([j]) => j === k)?.[1] ?? 0n, g = gcd(c, this.d) || 1n; return { n: c / g, d: this.d / g }; }
  levels() { return this.t.map(([k]) => k); }
  isZero() { return !this.t.length; }
  isInteger() { return this.d === 1n && this.t.every(([k]) => k === 0); }
  // An exact power of e, e^k (positive, coefficient 1): the only values that sit on a level.
  isPower() { return this.d === 1n && this.t.length === 1 && this.t[0][1] === 1n; }
  equals(y) { return this.key() === E.of(y).key(); }
  // Canonical value string: descending exponents, coefficient omitted when 1, rationals p/q.
  // A value whose top term is negative but which has positive terms leads with those, so
  // 3 − e is written "3-e" (the contract's own example) rather than "-e+3".
  key() { return this.#write(false); }
  // Pill text: the same with U+2212, spaced operators and superscript exponents.
  text() { return this.#write(true); }
  #write(pretty) {
    if (!this.t.length) return '0';
    const order = this.t[0][1] < 0n ? [...this.t.filter(([, c]) => c > 0n), ...this.t.filter(([, c]) => c < 0n)] : this.t;
    return order.map(([k, c], i) => {
      const g = gcd(c, this.d), n = abs(c / g), q = this.d / g, neg = c < 0n;
      const body = k === 0 ? (q === 1n ? `${n}` : `${n}/${q}`)
        : `${n === 1n ? '' : n}e${k === 1 ? '' : pretty ? sup(k) : '^' + k}${q === 1n ? '' : '/' + q}`;
      if (!pretty) return (neg ? '-' : i ? '+' : '') + body;
      return (i ? (neg ? ` ${MINUS} ` : ' + ') : neg ? MINUS : '') + body;
    }).join('');
  }
  toString() { return this.key(); }
}
const ZERO = new E();

// ---- parsing: keys, pill text and typed input ("e^2+2", "2e + 2", "3 − e", "1/3", "e⁻¹") ----
const SUPS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
// Terms are counted before they combine, because the typed limit is on what was written.
export function parseTerms(text) {
  let s = String(text).trim().replace(/[−–]/g, '-').replace(/[·×]/g, '*').replace(/\s+/g, '');
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, m => '^(' + [...m].map(c => SUPS[c]).join('') + ')');
  if (!s) throw Error('Type a number');
  let i = 0;
  const peek = () => s[i], eat = c => s[i] === c ? (i++, true) : false;
  const int = () => { const m = /^\d+/.exec(s.slice(i)); if (!m) return null; i += m[0].length; return BigInt(m[0]); };
  const decimal = () => {   // 2, 2.5, .5 → {n, d}
    const m = /^(\d*)(?:\.(\d+))?/.exec(s.slice(i)); if (!m[0] || m[0] === '.') return null;
    i += m[0].length; const frac = m[2] ?? '';
    return { n: BigInt((m[1] || '0') + frac), d: 10n ** BigInt(frac.length) };
  };
  const coefficient = () => {
    if (peek() === '(' && /^\(\d/.test(s.slice(i))) { i++; const c = rational(); if (!eat(')')) throw Error(`Unclosed bracket in ${text}`); return c; }
    return rational();
  };
  const power = () => {   // a number, optionally raised to a whole power: 10^6
    const a = decimal(); if (!a || peek() !== '^') return a;
    i++; const k = exponent(), m = BigInt(Math.abs(k));
    return k < 0 ? { n: a.d ** m, d: a.n ** m } : { n: a.n ** m, d: a.d ** m };
  };
  const rational = () => { const a = power(); if (!a) return null; if (peek() === '/' && /^\/\d/.test(s.slice(i))) { i++; const b = power(); if (!b || !b.n) throw Error('Nothing fits into zero'); return { n: a.n * b.d, d: a.d * b.n }; } return a; };
  const exponent = () => {
    const paren = eat('('); const neg = eat('-') ? true : (eat('+'), false); const k = int();
    if (k === null || paren && !eat(')')) throw Error(`Write the power as e^k with a whole k in ${text}`);
    return Number(neg ? -k : k);
  };
  const terms = [];
  while (i < s.length) {
    const neg = eat('-') ? true : eat('+') ? false : terms.length ? null : false;
    if (neg === null) throw Error(`Cannot read ${text}`);
    let c = coefficient(), k = 0; eat('*');
    if (eat('e')) { k = 1; if (eat('^')) k = exponent(); }
    else if (!c) throw Error(`Cannot read ${text}`);
    c ??= { n: 1n, d: 1n };
    if (peek() === '/' && /^\/\d/.test(s.slice(i))) { i++; const q = decimal(); if (!q || !q.n) throw Error('Nothing fits into zero'); c = { n: c.n * q.d, d: c.d * q.n }; }
    terms.push({ k, n: neg ? -c.n : c.n, d: c.d });
    if (i < s.length && !'+-'.includes(peek())) throw Error(`Cannot read ${text}`);
  }
  return terms;
}
// Planners and the validator read every tower's value string again and again; values are
// immutable, so the parsed forms are kept (a bounded memo, cleared when full).
const parsed = new Map();
function parseE(text) {
  let x = parsed.get(text); if (x) return x;
  x = ZERO;
  for (const { k, n, d } of parseTerms(text)) x = x.add(new E([[k, n]], d));
  if (parsed.size >= 4096) parsed.clear();
  parsed.set(text, x);
  return x;
}

// ---- certified bounds and signs ----
// e lies in [S_N, S_N + 1/(N!·N)] with S_N = Σ_{n≤N} 1/n!; the bounds are rounded outward
// to denominators 2^p, so every later product is exact BigInt arithmetic.
const boundsMemo = new Map();
export function eBounds(p) {
  let b = boundsMemo.get(p); if (b) return b;
  let N = 2n, f = 2n; const target = 1n << BigInt(p + 2);
  while (f * N < target) { N++; f *= N; }
  let a = 0n, term = 1n;   // a = Σ N!/n!, built from n = N down to 0
  for (let n = N; n >= 0n; n--) { a += term; term *= n || 1n; }
  const S = 1n << BigInt(p), lo = a * S / f, hi = ((a * N + 1n) * S + f * N - 1n) / (f * N);
  boundsMemo.set(p, b = { lo: { n: lo, d: S }, hi: { n: hi, d: S } });
  return b;
}
// P(e)·e^-kmin with integer coefficients, lowest power first; the denominator d > 0 never
// changes a sign.
const poly = x => { const lo = x.t.at(-1)[0], c = new Array(x.t[0][0] - lo + 1).fill(0n); for (const [k, v] of x.t) c[k - lo] = v; return { lo, c }; };
// Σ c_j·X^j·S^(deg−j) by Horner: P(X/S)·S^deg, exact.
function horner(c, X, S) {
  let acc = c.at(-1), s = 1n;
  for (let j = c.length - 2; j >= 0; j--) { s *= S; acc = acc * X + c[j] * s; }
  return acc;
}
// An enclosure of P(e)·S^deg: the positive and negative parts are each increasing in e > 0.
function enclose(c, p) {
  const { lo, hi } = eBounds(p), S = 1n << BigInt(p);
  const pos = c.map(v => v > 0n ? v : 0n), neg = c.map(v => v < 0n ? -v : 0n);
  return [horner(pos, lo.n, S) - horner(neg, hi.n, S), horner(pos, hi.n, S) - horner(neg, lo.n, S), S ** BigInt(c.length - 1)];
}
export function sign(x, { maxBits = 8192 } = {}) {
  x = E.of(x);
  if (x.isZero()) return 0;
  const { c } = poly(x);
  if (c.length === 1) return c[0] > 0n ? 1 : -1;
  for (let p = 64; p <= maxBits; p *= 2) {
    const [low, high] = enclose(c, p);
    if (low > 0n) return 1;
    if (high < 0n) return -1;
  }
  throw new PrecisionError(`the sign of ${x.key()} needs more than ${maxBits} bits`);
}
export const compare = (x, y) => sign(E.of(x).sub(y));

// ---- floats for display ----
const bitLength = n => n ? n.toString(2).length : 0;
// n/d as the nearest float, without overflowing on the way.
export function ratio(n, d) {
  if (!n) return 0;
  const neg = (n < 0n) !== (d < 0n); n = abs(n); d = abs(d);
  const s = bitLength(d) - bitLength(n) + 64;
  const q = s >= 0 ? (n << BigInt(s)) / d : n / (d << BigInt(-s));
  return (neg ? -1 : 1) * Number(q) * 2 ** -s;
}
// The value as a float: the enclosure is tightened until its width is far below the value,
// so remainders that nearly cancel (dust) are still read to full float precision.
export function approx(x) {
  x = E.of(x);
  if (x.isZero()) return 0;
  const { lo, c } = poly(x);
  let v;
  if (c.length === 1) v = ratio(c[0], x.d);
  else for (let p = 128; ; p *= 2) {
    const [low, high, scale] = enclose(c, p);
    if (p >= 8192 || (high - low) * (1n << 60n) <= abs(low + high)) { v = ratio(low + high, 2n * scale * x.d); break; }
  }
  return v * Math.exp(lo);
}

// ---- digits ----
// Most digit decisions are far from a tie, so they are taken on a fixed-point enclosure
// (2^-192 units, e bounded to 256 bits): a decision stands only if the whole interval
// agrees. A tie that close is an exact boundary (a finite numeral, or a value equal to a
// power of e), and those are settled by the exact sign() instead.
const Q = 192n, ONE = 1n << Q, powMemo = new Map();
function ePow(k) {   // [lo, hi]·2^-192 ∋ e^k
  let b = powMemo.get(k); if (b) return b;
  const { lo, hi } = eBounds(256), m = BigInt(Math.abs(k)), S = 1n << 256n;
  const L = lo.n ** m, H = hi.n ** m, D = S ** m;
  b = k >= 0 ? [(L << Q) / D, ((H << Q) + D - 1n) / D] : [(D << Q) / H, ((D << Q) + L - 1n) / L];
  powMemo.set(k, b); return b;
}
function fixedEnclosure(x) {
  let L = 0n, H = 0n;
  for (const [k, c] of x.t) { const [l, h] = ePow(k); if (c > 0n) { L += c * l; H += c * h; } else { L += c * h; H += c * l; } }
  return [L >= 0n ? L / x.d : -((-L + x.d - 1n) / x.d), H >= 0n ? (H + x.d - 1n) / x.d : -(-H / x.d)];
}
// a ≥ e^k, certified: the enclosure first, the exact sign on a near-tie.
function atLeast(a, enc, k) {
  const [l, h] = ePow(k);
  if (enc[0] - h >= 0n) return true;
  if (enc[1] - l < 0n) return false;
  return compare(a, E.e(k)) >= 0;
}
// ⌊ln |x|⌋, certified: a float guess, corrected by comparisons with powers of e.
export function top(x) {
  const a = E.of(x).abs(), enc = fixedEnclosure(a);
  let k = Math.floor(Math.log(ratio(enc[0] + enc[1], 2n * ONE) || approx(a)));
  while (atLeast(a, enc, k + 1)) k++;
  while (!atLeast(a, enc, k)) k--;
  return k;
}
// The greedy expansion of |x| from its top level (or 0) down to the floor: at each level
// the largest d with R − d·e^k ≥ 0. It is never more than 2, because R < e^(k+1) < 3e^k.
// rest is the exact remainder below the floor (the dust).
export function greedy(x, { floor = -3 } = {}) {
  x = E.of(x);
  const s = sign(x);
  if (!s) return { sign: 0, top: 0, digits: new Map([[0, 0]]), rest: ZERO, exact: true };
  const a = s < 0 ? x.neg() : x, high = top(a), digits = new Map(), placed = [];
  let enc = fixedEnclosure(a);
  for (let k = Math.max(high, 0); k >= floor; k--) {
    let d = 0;
    if (k <= high) {
      const [l, h] = ePow(k);
      d = Number((enc[0] + enc[1]) / (l + h)); d = Math.max(0, Math.min(2, d));
      while (d > 0 && enc[1] - BigInt(d) * l < 0n) d--;
      if (enc[0] - BigInt(d) * h >= 0n && (d === 2 || enc[1] - BigInt(d + 1) * l < 0n)) { enc = [enc[0] - BigInt(d) * h, enc[1] - BigInt(d) * l]; }
      else {   // too close to call on the enclosure: decide exactly and start a fresh one
        const r = new E([[0, 0n], ...placed].map(([j, c]) => [j, -c])).add(a), p = E.e(k);
        while (d > 0 && sign(r.sub(p.mul(d))) < 0) d--;
        while (d < 2 && sign(r.sub(p.mul(d + 1))) >= 0) d++;
        enc = fixedEnclosure(r.sub(p.mul(d)));
      }
      if (d) placed.push([k, BigInt(d)]);
    }
    digits.set(k, d);
  }
  const rest = a.sub(new E(placed));
  return { sign: s, top: high, digits, rest, exact: rest.isZero() };
}
// A finite numeral the greedy expansion would write: digits 0..2 of one colour, and the
// Parry condition Σ_{j<k} d_j·e^j < e^k at every level up to one above the top.
export function isLegalNumeral(x) {
  x = E.of(x);
  if (x.isZero()) return true;
  if (x.d !== 1n) return false;
  const s = x.t[0][1] > 0n ? 1n : -1n;
  if (x.t.some(([, c]) => c * s < 1n || c * s > 2n)) return false;
  const a = s < 0n ? x.neg() : x, lowest = a.t.at(-1)[0];
  let below = ZERO;
  for (let k = lowest + 1; k <= a.t[0][0] + 1; k++) {
    below = below.add(new E([[k - 1, a.coeff(k - 1).n]]));
    if (compare(below, E.e(k)) >= 0) return false;
  }
  return true;
}

// ---- heights (normative, 3.2) ----
const round4 = v => Math.round(v * 1e4) / 1e4;
// round4(ln |x|), clamped below the next level by the certified top. Only an exact power
// of e sits on a level: any other value is kept at least 0.0001 above its top (see the
// report's contract deviation), so a light never pretends to be a power it is not.
export function height(x) {
  const a = E.of(x).abs();
  if (a.isZero()) throw RangeError('0 has no height: its light would fall forever');
  const k = top(a);
  if (a.isPower()) return k;
  const h = round4(Math.log(approx(a)));
  return Math.min(Math.max(h, (k * 1e4 + 1) / 1e4), (k * 1e4 + 9999) / 1e4);
}
// The natural logarithm as a float (display and the fold function only).
export const ln = x => Math.log(Math.abs(approx(x)));
// Merging a light at h₂ into one at h₁ ≥ h₂ lifts it by ln(1 + e^−(h₁−h₂)), Gauss's
// addition logarithm; a light subtracted from a higher one drops it by ln(1 − e^−Δ). The
// planner never adds rounded heights: it takes height() of exact sums. These are the
// unrounded laws the fold and the meet draw (and the tests hold them to ln within 1e−12).
export const foldHeight = (h1, h2) => { const [hi, lo] = h1 >= h2 ? [h1, h2] : [h2, h1]; return hi + Math.log1p(Math.exp(lo - hi)); };
export const meetHeight = (h1, h2) => { const [hi, lo] = h1 >= h2 ? [h1, h2] : [h2, h1]; return hi + Math.log1p(-Math.exp(lo - hi)); };
const operand = a => a.isInteger() ? ' ' + a.text() : `(${a.text()})`;
// 'ln 3 ≈ 1.0986'; 'ln e² = 2'; more decimals when four would round to a whole number.
export function lnText(x) {
  x = E.of(x);
  const a = x.abs(), arg = sign(x) < 0 ? `|${x.text()}|` : operand(a);   // ln 3, ln(1/3), ln|−3|
  if (a.isPower()) { const k = a.t[0][0]; return k ? `ln e${k === 1 ? '' : sup(k)} = ${String(k).replace('-', MINUS)}` : 'ln 1 = 0'; }
  const v = ln(a);
  let places = 4;
  while (places < 15 && Number.isInteger(Math.round(v * 10 ** places) / 10 ** places)) places++;
  return `ln${arg} ≈ ${fixed(v, places)}`;
}
const fixed = (v, places) => (Math.round(v * 10 ** places) / 10 ** places).toFixed(places).replace('-', MINUS);
// '≈ 9.389', '≈ 0.0333': four significant digits, at most four decimals; integers have none.
export function approxText(x) {
  x = E.of(x);
  if (x.isInteger()) return undefined;
  const v = approx(x), a = Math.abs(v);
  if (a < 1e-4) { const p = Math.floor(Math.log10(a)); return `≈ ${fixed(v / 10 ** p, 2)} × 10${sup(p)}`; }
  return `≈ ${fixed(v, Math.max(0, Math.min(4, 3 - Math.floor(Math.log10(a)))))}`;
}
// The digit line: '20010.001…ₑ', '102ₑ', '0.000…ₑ' (dust only), '−10.020…ₑ'. An inexact
// value shows every place down to the floor; an exact one drops trailing zeros.
export function digitsText(x, { floor = -3 } = {}) {
  const g = greedy(x, { floor });
  if (!g.sign) return '0ₑ';
  const levels = [...g.digits.keys()].sort((a, b) => b - a);
  let low = floor;
  if (g.exact) while (low < 0 && !g.digits.get(low)) low++;
  let text = '';
  for (const k of levels) { if (k < low) break; if (k === -1) text += (text ? '' : '0') + '.'; text += g.digits.get(k); }
  return (g.sign < 0 ? MINUS : '') + text + (g.exact ? '' : '…') + 'ₑ';
}
