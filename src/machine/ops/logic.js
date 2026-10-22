// Logic. Binary gates work on exact infinite two's complement: bits are blue or dark and a
// sign lamp one level above the top stands for every level above it, forever; lit, it is red
// and worth −2^L. A red sign-magnitude operand enters a gate by COMPLEMENT (flip, then add
// one); a blue one gains a dark lamp inside the gate. A lit-lamp operand leaves for an
// arithmetic socket the same way back. Balanced ternary needs no lamp: MIN, MAX, SUM (the
// carry-less sum, XOR's analog) and CONS (the consensus, AND's carry partner); NEG swaps
// colours. Nothing ever climbs, except XOR's and SUM's carry, which evaporates.
import {evaluate} from '../oracle.js';
import {caption} from '../captions.js';
import {survivor, ripple, applyRipple, wave} from './collide.js';
import {column, topOf} from './borrow.js';

export const GATES = ['and', 'or', 'xor', 'not'];
export function lampOf(b, t) {
  for (const [id, x] of b.bulbsOf(t)) if (x.k === 'lamp') return {id, s: x.s, l: x.l};
  return null;
}
// One level: who stays and in which state; `up` when R rises half a level and evaporates
// (the discarded carry). Binary states (and lamps, lit = 1) are 0/1; trits −1/0/1.
export function gateCell(op, r, i) {
  switch (op) {
    case 'and': return {stay: 'R', d: r & i};
    case 'or': return r === 0 && i === 1 ? {stay: 'I', d: 1} : {stay: 'R', d: r | i};
    case 'xor': return r && i ? {stay: 'I', d: 0, up: true} : !r && i ? {stay: 'I', d: 1} : {stay: 'R', d: r};
    case 'min': return i < r ? {stay: 'I', d: i} : {stay: 'R', d: r};
    case 'max': return i > r ? {stay: 'I', d: i} : {stay: 'R', d: r};
    case 'cons': return {stay: 'R', d: r === i ? r : 0};
    case 'sum': { const res = survivor({base: 'ternary', r, i}); return {stay: res.climb ? 'I' : res.stay, d: res.d, up: !!res.climb, burst: res.burst}; }
  }
  throw new Error(`no gate ${op}`);
}
// A two-socket gate. The taller tower receives (a tie goes right); the shorter one grows to
// its height with bulbs lent by its lamp, then every level and the lamp resolve at once,
// and at u 0.9 the fold runs: top bits equal to the lamp fade into it as it descends.
export const gate = op => (b, node, [A, B]) => {
  const binary = b.base === 'binary', a = b.valueOf(A), c = b.valueOf(B), out = evaluate(op, b.base, [a, c]).value;
  const Ac = column(b, A), Bc = column(b, B);
  const [recv, donor, R, I] = Ac.length > Bc.length ? [A, B, Ac, Bc] : [B, A, Bc, Ac];
  const Rl = binary ? lampOf(b, recv) : null, Il = binary ? lampOf(b, donor) : null;
  const lit = x => x?.s ? 1 : 0, lend = lit(Il), h = R.length, cells = [], fades = [];
  for (let k = 0; k < h + (binary ? 1 : 0); k++) {
    const lamp = k === h;
    const r = lamp ? {id: Rl?.id, s: lit(Rl)} : {id: R[k].id, s: R[k].s};
    const i = lamp ? {id: Il?.id, s: lit(Il)} : I[k] ? {id: I[k].id, s: I[k].s} : {id: null, s: binary ? lend : 0};
    const g = gateCell(op, r.s, i.s);
    let [keep, lose] = g.stay === 'R' ? [r, i] : [i, r], up = g.up;
    // a survivor that does not exist yet: a real partner takes its state, unless it is a
    // lit bulb the donor's lamp lends, which grows out of the donor's column
    if (!keep.id && lose.id && !(g.d && !lamp)) { [keep, lose] = [lose, keep]; up = false; }
    cells[k] = {id: keep.id, d: g.d, lamp, lent: !keep.id && !lamp};
    if (lose.id) fades.push({id: lose.id, l: up && lose === r ? k + 0.5 : k, burst: g.burst});
  }
  // the fold (binary) or the leading-dark trim (ternary)
  let top = h;
  if (binary) while (top > 1 && cells[top - 1].d === cells[h].d) top--;
  else top = topOf(cells.map(x => ({s: x.d}))) + 1;
  b.begin('gate', node, {caption: caption.gate(op, a, c, out), ledger: {law: 'gate', op, a: String(a), b: String(c), out: String(out)}});
  b.node(node, {glyph: 0});
  b.tower(recv, {at: `${node}.C`, value: String(out)});
  cells.forEach((x, k) => {
    if (x.lamp) {
      const props = {t: recv, l: top, s: -x.d, k: 'lamp'};
      if (x.id) b.bulb(x.id, props); else b.bulb(b.id('b'), props, {grow: true});
    } else if (k < top) {
      if (x.id) b.bulb(x.id, {t: recv, l: k, s: x.d});
      else b.bulb(b.id('b'), {t: recv, l: k, s: x.d}, x.lent ? {from: {t: donor, l: k}, grow: true} : {grow: true});
    } else if (x.id) b.drop(x.id, {to: {t: recv, l: k}, fade: [0.9, 1]});
  });
  for (const f of fades) b.drop(f.id, {to: {t: recv, l: f.l}, ...(f.burst ? {burst: true} : {})});
  b.dropTower(donor);
  b.end();
  return {result: recv};
};
// NOT: every bulb and the lamp toggle (a blue tower's missing dark lamp lights), then the
// fold. NOT x = −x − 1.
export function not(b, node, [A]) {
  const a = b.valueOf(A), out = ~a, bits = column(b, A), lamp = lampOf(b, A), lampLit = lamp?.s ? 0 : 1;
  const flipped = bits.map(x => x.s ? 0 : 1);
  let top = bits.length;
  while (top > 1 && flipped[top - 1] === lampLit) top--;
  b.begin('flip', node, {caption: caption.not(a, out), ledger: {law: 'gate', op: 'not', a: String(a), out: String(out)}});
  b.node(node, {glyph: 0});
  b.tower(A, {value: String(out)});
  bits.forEach((x, k) => k < top ? b.bulb(x.id, {s: flipped[k]}) : b.drop(x.id, {fade: [0.9, 1]}));
  if (lamp) b.bulb(lamp.id, {l: top, s: -lampLit});
  else b.bulb(b.id('b'), {t: A, l: top, s: -lampLit, k: 'lamp'}, {grow: true});
  b.end();
  return {result: A};
}
export function neg(b, node, [A]) {
  const a = b.valueOf(A);
  b.begin('negate', node, {caption: caption.neg(a, -a), ledger: {law: 'negate', a: String(a), out: String(-a)}});
  b.node(node, {glyph: 0});
  b.tower(A, {value: String(-a)});
  wave(b, A);
  b.end();
  return {result: A};
}
// COMPLEMENT on the way into a gate, for a red tower of magnitude M ≠ 0: `flip` toggles every
// bulb to blue and lights a red lamp above (−M − 1); `addone` flies a lit bulb into level 0
// by the survivor rule, then folds (exactly when M is a power of two).
export function complementIn(b, node, t) {
  const v = b.valueOf(t), bits = column(b, t), flipped = v - 1n;
  b.begin('flip', node, {caption: caption.complement('flip', true, flipped), ledger: {law: 'complement', step: 'flip', a: String(v), out: String(flipped)}});
  b.tower(t, {value: String(flipped)});
  for (const x of bits) b.bulb(x.id, {s: x.s ? 0 : 1});
  const lamp = b.bulb(b.id('b'), {t, l: bits.length, s: -1, k: 'lamp'}, {grow: true});
  b.end();
  const one = b.id('b'), {cells, fades} = ripple('binary', column(b, t), [{id: one, s: 1}]);
  let top = cells.length;
  while (top > 1 && cells[top - 1].s === 1) top--;
  b.begin('addone', node, {caption: caption.complement('addone', true, v), ledger: {law: 'complement', step: 'addone', a: String(flipped), out: String(v)}});
  b.tower(t, {value: String(v)});
  cells.forEach((x, k) => {
    const via = x.via ? {via: {s: x.via}} : null;
    if (k < top) b.bulb(x.id, {t, l: k, s: x.s}, x.id === one ? {grow: true} : via ?? undefined);
    else b.drop(x.id, {to: {t, l: k}, fade: [0.9, 1], ...via});
  });
  for (const f of fades) b.drop(f.id, {to: {t, l: f.l}, ...(f.via ? {via: {s: f.via}} : {})});
  b.bulb(lamp, {l: top});
  b.end();
}
// Back to sign-magnitude for an arithmetic socket: `flip` toggles every bit, turns them red
// and puts the lamp out (v + 1); `addone` adds a red bulb, whose carry may grow the tower.
export function complementOut(b, node, t) {
  const v = b.valueOf(t), bits = column(b, t), lamp = lampOf(b, t), up = v + 1n;
  b.begin('flip', node, {caption: caption.complement('flip', false, up), ledger: {law: 'complement', step: 'flip', a: String(v), out: String(up)}});
  b.tower(t, {value: String(up)});
  for (const x of bits) b.bulb(x.id, {s: x.s ? 0 : -1});
  b.drop(lamp.id, {fade: [0, 0.6]});
  b.end();
  const one = b.id('b'), res = ripple('binary', column(b, t), [{id: one, s: -1}]);
  b.begin('addone', node, {caption: caption.complement('addone', false, v), ledger: {law: 'complement', step: 'addone', a: String(up), out: String(v)}});
  b.tower(t, {value: String(v)});
  applyRipple(b, t, res);
  b.motion(one, {grow: true});
  b.end();
}
