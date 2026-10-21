// Prime components of whole numbers: the classification and factoring behind the marble
// fingerprints (ported from the riemann-zeta-visualization games' NumberKind.cs).
// The colour language: gold is always a prime, deep red a prime squared, blue a pronic
// number k(k + 1), grey any other composite, white the unit 1.
const SMALL = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
const big = n => typeof n === 'bigint' ? n : BigInt(n);
const powMod = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
// Deterministic below 3.3 · 10²⁴ (Miller–Rabin with the first twelve primes as witnesses).
export function isPrime(n) {
  n = big(n); if (n < 2n) return false;
  for (const p of SMALL) { if (n === p) return true; if (n % p === 0n) return false; }
  let d = n - 1n, s = 0; while (!(d & 1n)) { d >>= 1n; s++; }
  witness: for (const a of SMALL) {
    let x = powMod(a, d, n); if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) { x = x * x % n; if (x === n - 1n) continue witness; }
    return false;
  }
  return true;
}
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
// A factor of a composite n (Pollard's rho, Brent's cycle detection).
function rho(n) {
  if (n % 2n === 0n) return 2n;
  for (let c = 1n; ; c++) {
    let y = 2n, x = 2n, g = 1n, q = 1n, ys = 2n, r = 1n; const f = v => (v * v + c) % n;
    while (g === 1n) {
      x = y; for (let i = 0n; i < r; i++) y = f(y);
      for (let k = 0n; k < r && g === 1n; k += 64n) { ys = y; for (let i = 0n; i < 64n && i < r - k; i++) { y = f(y); q = q * (x > y ? x - y : y - x) % n; } g = gcd(q, n); }
      r *= 2n;
    }
    if (g === n) { do { ys = f(ys); g = gcd(x > ys ? x - ys : ys - x, n); } while (g === 1n); }
    if (g !== n) return g;
  }
}
function split(n, into) {
  if (n === 1n) return;
  if (isPrime(n)) { into.push(n); return; }
  const d = rho(n); split(d, into); split(n / d, into);
}
// The prime factorization, ascending: [{p, k}] with n = Π p^k (empty for 0 and ±1). Signs are ignored.
export function factor(n) {
  n = big(n); if (n < 0n) n = -n; if (n < 2n) return [];
  const primes = [];
  for (let p = 2n; p < 1000n && p * p <= n; p += p === 2n ? 1n : 2n) while (n % p === 0n) { primes.push(p); n /= p; }
  split(n, primes);
  primes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out = [];
  for (const p of primes) { const last = out.at(-1); if (last && last.p === Number(p)) last.k++; else out.push({ p: Number(p), k: 1 }); }
  return out;
}
const isqrt = n => { if (n < 2n) return n; let x = big(Math.floor(Math.sqrt(Number(n)))); while (x * x > n) x--; while ((x + 1n) * (x + 1n) <= n) x++; return x; };
export const isPronic = n => { n = big(n); if (n < 2n) return false; const k = isqrt(n); return k * (k + 1n) === n; };
// unit, prime, square (of a prime), pronic or composite, in that order of precedence.
export function classify(n) {
  n = big(n); if (n < 0n) n = -n;
  if (n <= 1n) return 'unit';
  if (isPrime(n)) return 'prime';
  const r = isqrt(n); if (r * r === n && isPrime(r)) return 'square';
  if (isPronic(n)) return 'pronic';
  return 'composite';
}
export const className = { unit: 'the unit', prime: 'prime', square: 'a prime squared', pronic: 'pronic', composite: 'composite' };
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const superscript = k => String(k).replace(/\d/g, d => SUP[d]);
// The shorthand a fingerprint compresses to: 2³ · 3² · 5.
export function shorthand(n) {
  const f = factor(n); if (!f.length) return String(big(n) < 0n ? -big(n) : big(n));
  return f.map(({ p, k }) => p + (k > 1 ? superscript(k) : '')).join(' · ');
}
// One line about n: its building blocks and its kind.
export function describe(n) {
  n = big(n); if (n < 0n) n = -n;
  const kind = classify(n);
  if (kind === 'unit') return n === 0n ? '0: no prime components' : '1: the unit, no building blocks';
  if (kind === 'prime') return `${n}: prime`;
  const k = isqrt(n), pronic = isPronic(n) ? ` = ${k} · ${k + 1n}` : '';
  return `${n} = ${shorthand(n)}${pronic && shorthand(n) !== `${k} · ${k + 1n}` ? pronic : ''}: ${className[kind]}`;
}
