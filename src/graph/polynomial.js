// Exact polynomials for graph mode. Coefficients are reduced rationals from engine.js;
// a polynomial is an array of coefficients, lowest power first. Equations in x and y
// become curves: y = f(x) for polynomial f, or a vertical line x = c.
import { frac, add, sub, mul, div, neg, eq, numeric, format } from '../engine.js';
import { decimalText } from '../mvc/numbers.js';

export const MAX_DEGREE = 4;
const zero = frac(0), one = frac(1);
export const trim = p => { const q = [...p]; while (q.length > 1 && q.at(-1).n === 0) q.pop(); return q.length ? q : [zero]; };
export const degree = p => { const q = trim(p); return q.length === 1 && q[0].n === 0 ? -Infinity : q.length - 1; };
export const padd = (a, b) => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] || zero, b[i] || zero)));
export const psub = (a, b) => padd(a, b.map(neg));
export const pmul = (a, b) => { const out = Array.from({ length: a.length + b.length - 1 }, () => zero); a.forEach((x, i) => b.forEach((y, j) => { out[i + j] = add(out[i + j], mul(x, y)); })); return trim(out); };
export const pscale = (p, k) => trim(p.map(c => mul(c, k)));
export const derivative = p => trim(p.slice(1).map((c, i) => mul(c, frac(i + 1))));
export const antiderivative = p => [zero, ...p.map((c, i) => div(c, frac(i + 1)))];
export const evaluate = (p, x) => p.reduceRight((acc, c) => add(mul(acc, x), c), zero);
export const evaluateFloat = (p, x) => p.reduceRight((acc, c) => acc * x + numeric(c), 0);
// Exact where the numbers stay within the safe-integer bound, otherwise null.
export function evaluateExact(p, x) { try { return evaluate(p, x); } catch { return null; } }

// ---------- parsing: a small polynomial grammar in x and y ----------
// Bivariate terms are kept as a map "i,j" -> coefficient of x^i y^j.
const bi = entries => new Map(entries.filter(([, c]) => c.n !== 0));
const biAdd = (a, b) => { const out = new Map(a); for (const [k, c] of b) { const s = add(out.get(k) || zero, c); s.n ? out.set(k, s) : out.delete(k); } return out; };
const biMul = (a, b) => { let out = new Map(); for (const [ka, ca] of a) for (const [kb, cb] of b) { const [i, j] = ka.split(',').map(Number), [k, l] = kb.split(',').map(Number); out = biAdd(out, bi([[`${i + k},${j + l}`, mul(ca, cb)]])); } return out; };
const biScale = (a, k) => bi([...a].map(([key, c]) => [key, mul(c, k)]));
const constantOf = a => { if ([...a.keys()].some(k => k !== '0,0')) return null; return a.get('0,0') || zero; };
const bdeg = a => Math.max(0, ...[...a.keys()].map(k => k.split(',').map(Number)).map(([i, j]) => i + j));
const superscripts = { '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5' };

export function parseExpression(text) {
  const input = text.replace(/[⁰¹²³⁴⁵]/g, c => superscripts[c]).replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/\s+/g, '').toLowerCase();
  if (!input) throw Error('Enter an expression on each side, such as y = x^2 - 3.');
  if (input.length > 160) throw Error('Keep each equation under 160 characters.');
  const tokens = input.match(/\d+(?:\.\d+)?|\.\d+|[xy()+\-*/^]|./g);
  let i = 0;
  const peek = () => tokens[i];
  function number(token) {
    const [whole, dec = ''] = token.split('.');
    if (dec.length > 6) throw Error('Use up to six decimal places.');
    return frac(BigInt((whole || '0') + dec), 10n ** BigInt(dec.length));
  }
  function atom() {
    const token = tokens[i++];
    if (token === '(') { const v = sum(); if (tokens[i++] !== ')') throw Error('Close each parenthesis, for example (x + 1)^2.'); return v; }
    if (token === 'x') return bi([['1,0', one]]);
    if (token === 'y') return bi([['0,1', one]]);
    if (token && /^(\d|\.)/.test(token)) return bi([['0,0', number(token)]]);
    throw Error(token ? `“${token}” is not supported. Use numbers, x, y, + − × ÷, ^ and parentheses.` : 'The expression ends too early.');
  }
  function power() {
    let base = atom();
    while (peek() === '^') {
      i++;
      let sign = 1; if (peek() === '-') { sign = -1; i++; }
      const e = tokens[i++];
      if (!e || !/^\d+$/.test(e) || sign < 0) throw Error('Use whole-number powers such as x^2.');
      const n = Number(e);
      if (n > MAX_DEGREE) throw Error(`Use powers up to ${MAX_DEGREE}.`);
      let out = bi([['0,0', one]]); for (let k = 0; k < n; k++) out = biMul(out, base); base = out;
    }
    return base;
  }
  function unary() { if (peek() === '-') { i++; return biScale(unary(), frac(-1)); } if (peek() === '+') { i++; return unary(); } return power(); }
  function product() {
    let value = unary();
    while (['*', '/', 'x', 'y', '('].includes(peek())) {
      const op = peek() === '*' || peek() === '/' ? tokens[i++] : '*';
      const right = unary();
      if (op === '/') { const c = constantOf(right); if (!c) throw Error('Divide by numbers only, such as x/2.'); if (!c.n) throw Error('You cannot divide by zero.'); value = biScale(value, div(one, c)); }
      else value = biMul(value, right);
      if (bdeg(value) > MAX_DEGREE) throw Error(`Graph mode handles powers of x up to ${MAX_DEGREE}.`);
    }
    return value;
  }
  function sum() {
    let value = product();
    while (peek() === '+' || peek() === '-') { const op = tokens[i++], right = product(); value = biAdd(value, op === '-' ? biScale(right, frac(-1)) : right); }
    return value;
  }
  const result = sum();
  if (i < tokens.length) throw Error(`“${tokens[i]}” is not supported here.`);
  return result;
}
const toPoly = (map, j) => { const out = []; for (const [k, c] of map) { const [a, b] = k.split(',').map(Number); if (b === j) out[a] = c; } return trim(Array.from({ length: out.length || 1 }, (_, n) => out[n] || zero)); };

// An equation becomes one or two curves. y must appear to the first power with a
// constant coefficient (y = …, 2x + 3y = 12). With no y, "x = c" is a vertical line
// and anything else is graphed as both sides, whose crossings are the solutions.
export function parseCurves(text) {
  const sides = text.split('=');
  if (sides.length !== 2) throw Error('Use one equals sign, for example y = x^2 - 2x - 3.');
  const [left, right] = sides.map(parseExpression), all = biAdd(left, biScale(right, frac(-1)));
  if ([...left.keys(), ...right.keys()].every(k => k === '0,0')) throw Error('That equation has no x or y to graph.');
  const keys = [...all.keys()].map(k => k.split(',').map(Number));
  if (keys.some(([i, j]) => j > 1 || (j === 1 && i > 0))) throw Error('y must appear on its own, as in y = x^2 + 1 or 2x + 3y = 12 (no y², no x·y).');
  const cy = all.get('0,1');
  if (cy) { const rest = toPoly(all, 0); return [{ kind: 'function', poly: pscale(rest, div(frac(-1), cy)), source: text.trim() }]; }
  const onlyX = side => [...side.keys()].length === 1 && side.get('1,0') && eq(side.get('1,0'), one);
  const constant = side => [...side.keys()].every(k => k === '0,0');
  if ((onlyX(left) && constant(right)) || (onlyX(right) && constant(left))) {
    const c = constantOf(onlyX(left) ? right : left) || zero;
    return [{ kind: 'vertical', x: c, source: text.trim() }];
  }
  return [{ kind: 'function', poly: toPoly(left, 0), source: `y = ${sides[0].trim()}`, side: 'left' }, { kind: 'function', poly: toPoly(right, 0), source: `y = ${sides[1].trim()}`, side: 'right' }];
}

// ---------- roots ----------
const gcdBig = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
function integerCoefficients(p) {
  const lcm = p.reduce((m, c) => { const d = BigInt(c.d); return m / gcdBig(m, d) * d; }, 1n);
  return p.map(c => BigInt(c.n) * (lcm / BigInt(c.d)));
}
function divisors(n) {
  n = n < 0n ? -n : n; if (n === 0n || n > 1000000n) return [];
  const out = []; for (let k = 1n; k * k <= n; k++) if (n % k === 0n) { out.push(k); if (k * k !== n) out.push(n / k); }
  return out;
}
// Synthetic division by (x − r), exact.
function deflate(p, r) { const out = []; let carry = zero; for (let k = p.length - 1; k >= 1; k--) { carry = add(mul(carry, r), p[k]); out.unshift(carry); } return trim(out); }
function numericRoots(coeffs) {
  const n = coeffs.length - 1; if (n < 1) return [];
  if (n === 1) return [-coeffs[0] / coeffs[1]];
  const f = x => coeffs.reduceRight((a, c) => a * x + c, 0);
  const d = coeffs.slice(1).map((c, i) => c * (i + 1));
  const bound = 1 + Math.max(...coeffs.slice(0, -1).map(c => Math.abs(c / coeffs[n])));
  const cuts = [-bound, ...numericRoots(d).filter(x => Math.abs(x) < bound).sort((a, b) => a - b), bound], out = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    let lo = cuts[k], hi = cuts[k + 1], flo = f(lo), fhi = f(hi);
    if (Math.abs(flo) < 1e-10 * (1 + Math.abs(lo))) { out.push(lo); continue; }
    if (flo * fhi > 0) continue;
    for (let it = 0; it < 90; it++) { const mid = (lo + hi) / 2, fm = f(mid); if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; } }
    out.push((lo + hi) / 2);
  }
  if (Math.abs(f(cuts.at(-1))) < 1e-10 * (1 + bound)) out.push(cuts.at(-1));
  return out;
}
// Real roots, exact rationals where they exist (rational root theorem), else floats.
export function roots(p) {
  let q = trim(p); const found = [];
  if (degree(q) < 1) return [];
  while (degree(q) >= 1 && q[0].n === 0) { found.push(zero); q = trim(q.slice(1)); }
  if (degree(q) >= 1) {
    const ints = integerCoefficients(q), candidates = [];
    for (const a of divisors(ints[0])) for (const b of divisors(ints.at(-1))) for (const s of [1n, -1n]) candidates.push(frac(s * a, b));
    for (const r of candidates) { while (degree(q) >= 1 && evaluate(q, r).n === 0) { found.push(r); q = deflate(q, r); } }
  }
  const exact = found.map(r => ({ x: numeric(r), exact: r }));
  const rest = degree(q) >= 1 ? numericRoots(q.map(numeric)).map(x => ({ x, exact: null })) : [];
  const all = [...exact, ...rest].sort((a, b) => a.x - b.x);
  return all.filter((r, k) => !k || Math.abs(r.x - all[k - 1].x) > 1e-9 || (r.exact && !all[k - 1].exact));
}
// Distinct roots (a repeated root appears once).
export const distinctRoots = p => roots(p).filter((r, k, all) => !k || Math.abs(r.x - all[k - 1].x) > 1e-9);

// ---------- display ----------
export function show(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') { const r = Math.round(value * 1000) / 1000; return (Object.is(r, -0) ? 0 : r).toString().replace('-', '−'); }
  const d = decimalText(value);
  return (d !== null && d.replace('-', '').length <= 10 ? d : format(value)).replace('-', '−');
}
export const approx = (exact, x) => exact ? show(exact) : `≈ ${show(x)}`;
const sup = n => n === 1 ? '' : String(n).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
export function polyText(p) {
  const parts = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const c = p[k]; if (!c.n) continue;
    const mag = show(frac(Math.abs(c.n), c.d)), body = k === 0 ? mag : `${mag === '1' ? '' : mag}x${sup(k)}`;
    parts.push({ sign: c.n < 0, body });
  }
  if (!parts.length) return '0';
  return parts.map((t, i) => (i ? (t.sign ? ' − ' : ' + ') : t.sign ? '−' : '') + t.body).join('');
}
export const curveText = c => c.kind === 'vertical' ? `x = ${show(c.x)}` : `y = ${polyText(c.poly)}`;

// ---------- special points ----------
// Roots, the y-intercept and turning points of each curve, and every crossing between
// curves (the solutions of the system). Exact where possible.
export function specialPoints(curves) {
  const points = [];
  curves.forEach((c, i) => {
    if (c.kind === 'vertical') { points.push({ kind: 'root', curves: [i], x: numeric(c.x), exact: { x: c.x, y: zero }, y: 0 }); return; }
    if (degree(c.poly) < 0) return;
    for (const r of distinctRoots(c.poly)) points.push({ kind: 'root', curves: [i], x: r.x, y: 0, exact: r.exact ? { x: r.exact, y: zero } : null });
    points.push({ kind: 'y-intercept', curves: [i], x: 0, y: numeric(c.poly[0]), exact: { x: zero, y: c.poly[0] } });
    if (degree(c.poly) >= 2) for (const r of distinctRoots(derivative(c.poly))) {
      const y = r.exact ? evaluateExact(c.poly, r.exact) : null;
      points.push({ kind: degree(c.poly) === 2 ? 'vertex' : 'turning point', curves: [i], x: r.x, y: y ? numeric(y) : evaluateFloat(c.poly, r.x), exact: r.exact && y ? { x: r.exact, y } : null });
    }
  });
  for (let i = 0; i < curves.length; i++) for (let j = i + 1; j < curves.length; j++) for (const s of intersections(curves[i], curves[j]).points) points.push({ kind: 'solution', curves: [i, j], ...s });
  return points;
}
// Crossings of two curves: unique points, none (parallel) or all (the same curve).
export function intersections(a, b) {
  if (a.kind === 'vertical' && b.kind === 'vertical') return eq(a.x, b.x) ? { type: 'same', points: [] } : { type: 'none', points: [] };
  if (a.kind === 'vertical' || b.kind === 'vertical') {
    const [v, f] = a.kind === 'vertical' ? [a, b] : [b, a], y = evaluateExact(f.poly, v.x);
    return { type: 'points', points: [{ x: numeric(v.x), y: y ? numeric(y) : evaluateFloat(f.poly, numeric(v.x)), exact: y ? { x: v.x, y } : null }] };
  }
  const difference = psub(a.poly, b.poly);
  if (degree(difference) < 0) return { type: 'same', points: [] };
  if (degree(difference) === 0) return { type: 'none', points: [] };
  const points = distinctRoots(difference).map(r => { const y = r.exact ? evaluateExact(a.poly, r.exact) : null; return { x: r.x, y: y ? numeric(y) : evaluateFloat(a.poly, r.x), exact: r.exact && y ? { x: r.exact, y } : null }; });
  return { type: points.length ? 'points' : 'none', points };
}

// ---------- area ----------
// Riemann sum with exact rational samples: columns of card strips Δx wide.
export function riemann(p, a, b, dx, rule = 'left') {
  const columns = []; let total = zero;
  const n = Math.round(numeric(div(sub(b, a), dx)));
  for (let k = 0; k < n; k++) {
    const left = add(a, mul(frac(k), dx)), sample = rule === 'left' ? left : rule === 'right' ? add(left, dx) : add(left, div(dx, frac(2)));
    const height = evaluateExact(p, sample), area = height && mul(height, dx);
    columns.push({ left, sample, height, area, h: height ? numeric(height) : evaluateFloat(p, numeric(sample)) });
    total = total && area ? add(total, area) : null;
  }
  return { columns, total };
}
export function integral(p, a, b) { const F = antiderivative(p); try { return sub(evaluate(F, b), evaluate(F, a)); } catch { return null; } }
