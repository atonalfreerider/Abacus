// Registers the two whole-number bases: binary (sign-magnitude; two's complement with a sign
// lamp in logic) and balanced ternary (signed natively). Values are decimal BigInt strings.
import {registerBase} from './registry.js';
import {RADIX, fmt, baseString, digits} from './bigmath.js';
import {evaluate as oracle, OPS} from './oracle.js';
import {expandBaseLiterals} from '../mvc/bases.js';
import {add, sub} from './ops/collide.js';
import {mul} from './ops/multiply.js';
import {div, mod} from './ops/divide.js';
import {cmp} from './ops/compare.js';
import {shl, shr} from './ops/shift.js';
import {gate, not, neg} from './ops/logic.js';

export const INPUT_LIMIT = {binary: (1n << 63n) - 1n, ternary: (3n ** 40n - 1n) / 2n};
export const NAMES = {binary: 'Base 2', ternary: 'Balanced ternary'};
const abs = v => v < 0n ? -v : v;
// Levels whose whole tower sums stay below 2^53 in a Number: 3^32 < 2^51.
const SMALL_LEVEL = {binary: 50, ternary: 31};
const NUMBER_POWERS = {binary: Array.from({length: 51}, (_, k) => 2 ** k), ternary: Array.from({length: 32}, (_, k) => 3 ** k)};
const LIMIT_TEXT = {
  binary: 'Base 2 takes whole numbers below 2⁶³ in size (9 223 372 036 854 775 808).',
  ternary: 'Balanced ternary takes whole numbers of up to 40 trits (±6 078 832 729 528 464 400).',
};

function parseValue(text) {
  const shown = String(text).trim();
  let s = shown.replace(/[−–]/g, '-').replace(/^\+/, ''), negative = false;
  if (s.startsWith('-')) { negative = true; s = s.slice(1).trim(); }
  if (/^0b[01]+$/i.test(s) || /^0t[01T]+$/.test(s)) s = expandBaseLiterals(s).replace(/^\((.*)\)$/, '$1');
  if (!/^-?\d+$/.test(s)) return {ok: false, error: `${shown || 'An empty place'} is not a whole number.`};
  const v = BigInt(s);
  return {ok: true, value: String(negative ? -v : v)};
}
function evaluate(base) {
  return (op, args) => {
    const r = oracle(op, base, args.map(BigInt));
    if (r.error === 'zeroDivision') return {ok: false, reason: 'zeroDivision', message: 'Nothing fits into zero.'};
    if (r.error === 'tooBig') return {ok: false, reason: 'tooBig', message: 'That shift is too long for a tower.'};
    if (r.error) return {ok: false, reason: 'domain', message: OPS[base].includes(op) ? 'A shift needs a whole number of levels: the count is negative.' : `${NAMES[base]} has no ${op} block.`};
    if (op === 'div' || op === 'shr') return {ok: true, values: [String(r.value), String(r.remainder)]};
    if (op === 'mod') return {ok: true, values: [String(r.quotient), String(r.value)]};
    return {ok: true, values: [String(r.value)]};
  };
}
// I2 (the bulbs encode the value) and I3 (normal form) for one tower. Errors carry their
// invariant; `list` ([id, bulb][]) spares the scan for callers that have it.
function validateTower(base) {
  const radix = RADIX[base], powers = [1n];
  const power = l => { while (powers.length <= l) powers.push(powers.at(-1) * radix); return powers[l]; };
  return (scene, id, list) => {
    const t = scene.towers[id], errs = [], name = `tower ${id}`;
    if (!t) return [`I2: ${name} is missing`];
    if (!t.text) errs.push(`I2: ${name} has no text`);
    const bulbs = list ?? Object.entries(scene.bulbs).filter(([, x]) => x.t === id);
    // exact in a Number while every level is low enough; BigInt otherwise
    let small = true;
    for (const [, x] of bulbs) if (x.l > SMALL_LEVEL[base]) { small = false; break; }
    let sum;
    if (small) { sum = 0; for (const [, x] of bulbs) if (x.s && Number.isInteger(x.l) && x.l >= 0) sum += x.s * NUMBER_POWERS[base][x.l]; sum = String(sum); }
    else { let big = 0n; for (const [, x] of bulbs) if (x.s && Number.isInteger(x.l) && x.l >= 0) big += x.s > 0 ? power(x.l) : -power(x.l); sum = String(big); }
    if (sum !== t.value) errs.push(`I2: ${name} holds ${sum} but reads ${t.value}`);
    if (t.pending) return errs;
    const col = [], lamps = [];
    for (const [bid, x] of bulbs) {
      if (x.slot) { errs.push(`I3: ${name} has bulb ${bid} waiting in a lane`); continue; }
      if (x.k === 'lamp') { lamps.push(x); continue; }
      if (x.k) { errs.push(`I3: ${name} has a ${x.k} bulb ${bid}`); continue; }
      if (x.o && base !== 'binary') errs.push(`I3: ${name} has an owed bulb in balanced ternary`);
      if (!Number.isInteger(x.l) || x.l < 0) errs.push(`I3: ${name} has bulb ${bid} at level ${x.l}`);
      else if (col[x.l]) errs.push(`I3: ${name} has two bulbs at level ${x.l}`);
      else col[x.l] = x;
    }
    if (!col.length) return [...errs, `I3: ${name} has no bulbs`];
    for (let l = 0; l < col.length; l++) if (!col[l]) errs.push(`I3: ${name} has no bulb at level ${l}`);
    const top = col.length - 1;
    if (lamps.length) {
      const lamp = lamps[0];
      if (base !== 'binary' || lamps.length > 1) errs.push(`I3: ${name} has ${lamps.length} lamps`);
      if (lamp.l !== top + 1) errs.push(`I3: ${name} has its lamp at level ${lamp.l}, not above its top`);
      if (lamp.s !== 0 && lamp.s !== -1) errs.push(`I3: ${name} has a blue lamp`);
      if (col.some(x => x?.s < 0 || x?.o)) errs.push(`I3: ${name} mixes red bits with a lamp`);
      if (top > 0 && col[top] && Math.abs(col[top].s) === Math.abs(lamp.s)) errs.push(`I3: ${name} has a top bit equal to its lamp`);
    } else {
      // the quotient register keeps its leading darks until its node's RETURN
      if (top > 0 && col[top] && !col[top].s && !/\.Q$/.test(t.at)) errs.push(`I3: ${name} has a leading dark bulb`);
      if (base === 'binary' && new Set(col.filter(x => x?.s && !x.o).map(x => x.s)).size > 1) errs.push(`I3: ${name} mixes blue and red`);
    }
    return errs;
  };
}
// Write a value's bulbs into a tower, bottom up; a tower that already shows it is left alone.
function place(base) {
  return (b, t, value) => {
    const want = digits(value, base), have = b.bulbsOf(t);
    const same = have.length === want.length && have.every(([, x], l) => !x.k && !x.slot && x.l === l && x.s === want[l]);
    if (!same) { for (const [id] of have) b.drop(id); want.forEach((s, l) => b.bulb(b.id('b'), {t, l, s})); }
    if (b.scene.towers[t].value !== String(value)) b.tower(t, {value: String(value)});
  };
}
const common = {add, sub, mul, div, mod, cmp, shl, shr};
const OPS_OF = {
  binary: {...common, and: gate('and'), or: gate('or'), xor: gate('xor'), not},
  ternary: {...common, min: gate('min'), max: gate('max'), sum: gate('sum'), cons: gate('cons'), neg},
};
for (const base of ['binary', 'ternary']) registerBase(base, {
  id: base, palette: OPS[base],
  parseValue, evaluate: evaluate(base),
  display: (value, {lamp} = {}) => ({text: fmt(value), digits: baseString(value, base, {lamp})}),
  checkLimits: value => abs(BigInt(value)) > INPUT_LIMIT[base] ? LIMIT_TEXT[base] : null,
  validateTower: validateTower(base), place: place(base), ops: OPS_OF[base],
});
