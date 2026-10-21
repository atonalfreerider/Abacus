// An independent oracle for base e: plain fixed-point decimal arithmetic at 80 digits
// (plus guard digits), sharing no code with src/machine/e-exact.js. It writes the greedy
// digits of the integers 0..2000 and of k/7 and k/10 up to 20, to 8 places below the
// point, with ln to 20 decimals, into tests/fixtures/base-e.json. The certified digits
// must agree with it everywhere (tests/machine-e.test.js).
//   node tools/make-e-fixture.mjs           write the fixture
//   node tools/make-e-fixture.mjs --check   compare with the committed file
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIGITS = 80, GUARD = 12, ONE = 10n ** BigInt(DIGITS + GUARD), PLACES = 8;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'base-e.json');

// e = Σ 1/n!, summed until the terms vanish below the guard digits.
let e = 0n; for (let term = ONE, n = 1n; term; n++) { e += term; term /= n; }
const mul = (a, b) => a * b / ONE, div = (a, b) => a * ONE / b;
const pow = new Map([[0, ONE]]);
for (let k = 1; k <= 12; k++) pow.set(k, mul(pow.get(k - 1), e));
for (let k = 1; k <= PLACES; k++) pow.set(-k, div(pow.get(1 - k), e));

// ln y for y in [1, e): 2·atanh((y − 1)/(y + 1)), whose series converges fast there.
function lnFixed(y) {
  const z = div(y - ONE, y + ONE), z2 = mul(z, z);
  let sum = 0n, p = z;
  for (let n = 1n; p; n += 2n) { sum += p / n; p = mul(p, z2); }
  return 2n * sum;
}
const decimal = (v, places) => {   // fixed-point to text, rounded half up at `places`
  const neg = v < 0n, scale = 10n ** BigInt(DIGITS + GUARD - places);
  let a = (neg ? -v : v); a = (a + scale / 2n) / scale;
  const s = a.toString().padStart(places + 1, '0');
  return (neg ? '-' : '') + s.slice(0, -places) + '.' + s.slice(-places);
};

function entry(n, d) {
  const label = d === 1 ? String(n) : `${n}/${d}`;
  let r = BigInt(n) * ONE / BigInt(d);
  if (!n) return [label, 0, '0', 1, null];
  let top = 0; while (top < 12 && pow.get(top + 1) <= r) top++;
  while (top > -PLACES && pow.get(top) > r) top--;
  let digits = '';
  for (let k = Math.max(top, 0); k >= -PLACES; k--) { const p = pow.get(k); let q = 0n; while (q < 2n && r >= p * (q + 1n)) q++; r -= q * p; digits += q; }
  // Fixed point drops at most a few units in the last guard digit; a remainder that small
  // after eight places means the expansion ended (only 0, 1 and 2 do).
  const exact = r < 10n ** BigInt(GUARD - 2);
  const y = div(BigInt(n) * ONE / BigInt(d), pow.get(top)), lnx = BigInt(top) * ONE + lnFixed(y);
  return [label, top, digits, exact ? 1 : 0, decimal(lnx, 20)];
}

const values = [];
for (let n = 0; n <= 2000; n++) values.push(entry(n, 1));
for (const d of [7, 10]) for (let n = 1; n < 20 * d; n++) if (n % d) { const g = gcd(n, d); values.push(entry(n / g, d / g)); }
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
const seen = new Set(), unique = values.filter(v => !seen.has(v[0]) && seen.add(v[0]));

const json = JSON.stringify({
  about: 'Greedy base-e digits from an independent 80-digit fixed-point oracle (tools/make-e-fixture.mjs). Rows are [x, top, digits from level max(top, 0) down to level -8, exact (the expansion ended), ln x to 20 decimals].',
  precision: DIGITS, places: PLACES, values: unique,
}).replace(/\],\[/g, '],\n[');
if (process.argv.includes('--check')) {
  const same = readFileSync(out, 'utf8') === json + '\n';
  console.log(same ? 'base-e.json matches the oracle' : 'base-e.json differs from the oracle'); process.exit(same ? 0 : 1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, json + '\n');
console.log(`wrote ${unique.length} values to ${out}`);
