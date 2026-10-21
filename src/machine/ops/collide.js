// ADD: one collision, every level resolved by the survivor rule (2.1). PRIME's carry is a
// physical bulb: when two lit bulbs meet, the resident climbs and the incoming one stays as
// the 0. A climbing carry is lit in flight (`via`), so a dark resident lights as it rises.
import {fmt, fmtOperand} from '../bigmath.js';
import {caption} from '../captions.js';
import {annihilateCollide, borrowBeats, column, topOf} from './borrow.js';
export {annihilate, column, topOf} from './borrow.js';

// r, i ∈ {−1, 0, 1} or null when absent; c ∈ {−1, 1} or null. s = d + base·c′, where c′ is
// trunc(s/2) in binary and round(s/3) in balanced ternary: both are ±1 exactly when |s| ≥ 2.
export function survivor({base, r = null, i = null, c = null}) {
  const s = (r ?? 0) + (i ?? 0) + (c ?? 0), cOut = s >= 2 ? 1 : s <= -2 ? -1 : 0;
  const d = s - (base === 'ternary' ? 3 : 2) * cOut;
  const present = {R: r !== null, C: c !== null, I: i !== null}, value = {R: r, C: c, I: i};
  let stay, climb = null, via = null;
  if (cOut) {
    // the resident climbs as the carry, lit in flight; C (or else I) stays as the digit
    climb = 'R'; if (r === 0) via = cOut;
    stay = present.C ? 'C' : 'I';
  } else {
    stay = ['R', 'C', 'I'].find(x => present[x] && value[x] === d) ?? (present.R ? 'R' : 'C');
  }
  const fade = ['R', 'C', 'I'].filter(x => present[x] && x !== stay && x !== climb);
  const lit = [r, i, c];
  return {d, cOut, stay, climb, via, fade, burst: lit.includes(1) && lit.includes(-1)};
}
// Together pace: resolve every level at once. With `evaporate` (XOR, SUM) nothing carries:
// a would-be climber rises half a level and fades. Returns the survivors by level, the
// bulbs that fade (with their level), and the number of climbs.
export function ripple(base, R, I, {evaporate = false, carry = null} = {}) {
  const cells = [], fades = [];
  let climbs = 0;
  for (let k = 0; k < R.length || k < I.length || carry; k++) {
    const r = R[k] ?? null, i = I[k] ?? null, c = carry;
    const res = survivor({base, r: r?.s ?? null, i: i?.s ?? null, c: c?.s ?? null});
    const who = {R: r, I: i, C: c};
    carry = null;
    if (res.climb) {
      climbs++;
      if (evaporate) fades.push({id: r.id, l: k + 0.5, up: true, via: res.via});
      else carry = {id: r.id, s: res.cOut, via: res.via};
    }
    cells[k] = {id: who[res.stay].id, s: res.d, burst: res.burst, via: res.stay === 'C' ? c.via : null};
    for (const f of res.fade) fades.push({id: who[f].id, l: k, burst: res.burst, via: f === 'C' ? c.via : null});
  }
  return {cells, fades, climbs};
}
const viaOf = x => x.via ? {via: {s: x.via}} : {};
// Write a together-pace resolution into tower `recv`: survivors take their level and state,
// everything else fades on its way into the column.
export function applyRipple(b, recv, {cells, fades}) {
  const top = topOf(cells);
  cells.forEach((x, k) => {
    if (k <= top) b.bulb(x.id, {t: recv, l: k, s: x.s}, x.via ? viaOf(x) : undefined);
    else b.drop(x.id, {to: {t: recv, l: k}, ...viaOf(x), ...(x.burst ? {burst: true} : {fade: [0.9, 1]})});
  });
  for (const f of fades) b.drop(f.id, {to: {t: recv, l: f.l}, ...viaOf(f), ...(f.burst ? {burst: true} : {})});
}

const round4 = x => Math.round(x * 1e4) / 1e4;
// NEGATE: every lit bulb swaps colour in a bottom-up wave, 0.04 beat per level, capped at 0.4.
export function wave(b, t) {
  for (const [id, x] of b.bulbsOf(t)) if (x.s && !x.k) {
    const d = Math.min(0.04 * x.l, 0.4);
    b.bulb(id, {s: -x.s}, {state: [round4(d), round4(d + 0.6)]});
  }
}
// SUB: NEGATE the right operand while the block's minus turns into a plus, then ADD.
export function sub(b, node, [L, R]) {
  const v = b.valueOf(R), neg = -v;
  b.begin('negate', node, {caption: caption.negate(v, neg), ledger: {law: 'negate', a: String(v), out: String(neg)}});
  b.node(node, {op: 'add'});
  b.tower(R, {value: String(neg)});
  wave(b, R);
  b.end();
  return add(b, node, [L, R]);
}
// The receiver is the larger magnitude; a tie goes to the right operand (PRIME §3.1).
export function receiver(b, [L, R]) {
  const a = b.valueOf(L), c = b.valueOf(R), abs = v => v < 0n ? -v : v;
  return abs(a) > abs(c) ? {recv: L, donor: R} : {recv: R, donor: L};
}
export function add(b, node, [L, R]) {
  const a = b.valueOf(L), c = b.valueOf(R), out = a + c;
  const {recv, donor} = receiver(b, [L, R]);
  const ledger = {law: 'sum', a: String(a), b: String(c), out: String(out)};
  if (b.base === 'binary' && a * c < 0n) {
    annihilateCollide(b, node, {recv, donor, ledger, text: [fmt(a), fmtOperand(c)]});
    borrowBeats(b, node, recv);
    return {result: recv};
  }
  const Rc = column(b, recv), Ic = column(b, donor);
  if (b.pace === 'level') {
    const first = survivor({base: b.base, r: Rc[0].s, i: Ic[0].s});
    if (Ic.length > 1 || first.climb) { collideLevel(b, node, {recv, donor, L, Rc, Ic, ledger}); return {result: recv}; }
  }
  const res = ripple(b.base, Rc, Ic);
  b.begin('collide', node, {caption: caption.collide(a, c, res.climbs, out), ledger});
  b.node(node, {glyph: 0});
  b.tower(recv, {at: `${node}.C`, value: String(out)});
  applyRipple(b, recv, res);
  b.dropTower(donor);
  b.end();
  return {result: recv};
}
// Level pace: the donor's bulbs wait in the incoming lane beside their own levels, level 0
// resolves at once, and then one half-length carry beat per level that holds a waiting bulb.
// Incoming bulbs wait on the donor's side, carries on the other (lanes 1 = left, 2 = right).
function collideLevel(b, node, {recv, donor, L, Rc, Ic, ledger}) {
  const base = b.base, laneIn = donor === L ? 1 : 2, laneUp = 3 - laneIn, {a, b: c, out} = ledger;
  const step = (k, carry) => {
    const r = Rc[k] ?? null, i = Ic[k] ?? null, cell = {r: r?.s ?? null, i: i?.s ?? null, c: carry?.s ?? null};
    const res = survivor({base, ...cell});
    return {k, r, i, carry, cell, res, next: res.climb ? {id: r.id, s: res.cOut} : null};
  };
  const write = ({k, r, i, carry, res}) => {
    const who = {R: r, I: i, C: carry};
    // a climber waits in the carry lane one level up, lit in its carry's colour
    if (res.climb) b.bulb(r.id, {l: k + 1, slot: laneUp, s: res.cOut}, res.via ? {via: {s: res.via}} : undefined);
    b.bulb(who[res.stay].id, {t: recv, l: k, s: res.d, slot: null});
    for (const f of res.fade) {
      // waiting bulbs slide into the column as they fade; a resident fades where it stands
      const burst = res.burst ? {burst: true} : {};
      b.drop(who[f].id, k === 0 || f !== 'R' ? {to: {t: recv, l: k}, ...burst} : res.burst ? burst : undefined);
    }
  };
  let s = step(0, null);
  b.begin('collide', node, {caption: caption.levelStart(base, a, c, s), ledger});
  b.node(node, {glyph: 0});
  b.tower(recv, {at: `${node}.C`, value: out, text: `${fmt(a)} + ${fmtOperand(c)}`, digits: null, approx: null, pending: true});
  write(s);
  for (let k = 1; k < Ic.length; k++) b.bulb(Ic[k].id, {t: recv, slot: laneIn});
  b.dropTower(donor);
  b.end();
  for (let k = 1; k < Ic.length || s.next; k++) {
    s = step(k, s.next);
    const last = k + 1 >= Ic.length && !s.next;
    b.begin('carry', node, {dur: 0.5, caption: caption.levelStep(base, k, s, last ? fmt(out) : null), ledger: {law: 'regroup', value: out}});
    write(s);
    if (last) {
      b.tower(recv, {pending: null});
      // a cancellation at the top leaves dark levels: they trim with the last carry
      const cells = column(b, recv), top = topOf(cells);
      for (let l = top + 1; l < cells.length; l++) if (cells[l]) b.drop(cells[l].id, {fade: [0.9, 1]});
    }
    b.end();
  }
}
