// DIV and MOD. PREP lifts a trial divisor D = |B| K levels in the right socket and lays the
// quotient register Q (K + 1 dark bulbs) at node.Q; the node keeps the divisor in `arg`, so
// the tree's value Q + R/arg is constant through every round.
//  * Binary truncates (BigInt / and %): per round COMPARE in magnitude, and where D fits a
//    COLLIDE of a copy of D in the colour opposite to R, its BORROWs, and quotient bulb k.
//  * Balanced ternary rounds to nearest, ties toward zero: per round TRY a ghost
//    G = R − t·B·3^k and JUDGE whether it is nearer zero than R (a tie keeps A's sign).
// D DESCENDs a level between rounds. The node's RETURN (plan.js) trims Q's leading darks.
import {RADIX, signOf, bitLength, fmt, digits} from '../bigmath.js';
import {caption} from '../captions.js';
import {column, annihilateInto, borrowBeats} from './borrow.js';

const abs = v => v < 0n ? -v : v;
export const div = (b, node, towers) => divide(b, node, towers, 'div');
export const mod = (b, node, towers) => divide(b, node, towers, 'mod');

// The first level, from the top, where two magnitude columns differ (null when equal).
function scanStop(x, y) {
  for (let l = Math.max(x.length, y.length) - 1; l >= 0; l--) if (Math.abs(x[l]?.s ?? 0) !== Math.abs(y[l]?.s ?? 0)) return l;
  return null;
}
function divide(b, node, [A, B], op) {
  const ternary = b.base === 'ternary', radix = RADIX[b.base];
  const a = b.valueOf(A), d = b.valueOf(B), absB = abs(d);
  let K = 0;
  if (ternary) while (2n * abs(a) > radix ** BigInt(K + 1) * absB) K++;
  else K = Math.max(0, Math.max(1, bitLength(a)) - bitLength(d));
  const lift = radix ** BigInt(K), D = absB * lift;
  b.begin('prep', node, {caption: caption.prep(a, d, K, D, ternary), ledger: {law: 'shift', a: String(absB), m: String(lift), k: K, sign: 1, out: String(D)}});
  b.node(node, {arg: String(d)});
  b.tower(B, {value: String(D)});
  for (const [id, x] of b.bulbsOf(B)) b.bulb(id, {l: x.l + K, s: d < 0n && x.s ? -x.s : x.s});
  for (let l = 0; l < K; l++) b.bulb(b.id('b'), {t: B, l, s: 0});
  const Q = b.id('t');
  b.tower(Q, {at: `${node}.Q`, form: 'tower', value: '0', note: 'q'});
  for (let l = 0; l <= K; l++) b.bulb(b.id('b'), {t: Q, l, s: 0});
  b.end();
  let R = A;
  const finish = () => {
    const q = b.valueOf(Q), r = b.valueOf(R);
    b.tower(R, {note: `r ${fmt(r)}`}); b.tower(Q, {note: `q ${fmt(q)}`});
  };
  const light = (k, s) => { b.bulb(column(b, Q)[k].id, {s}); b.tower(Q, {value: String(b.valueOf(Q))}); };
  for (let k = K; k >= 0; k--) {
    const Dk = absB * radix ** BigInt(k), last = k === 0;
    if (ternary) {
      const Rv = b.valueOf(R);
      if (Rv === 0n) {
        b.begin('clear', node, {caption: caption.clear(), ledger: {law: 'move', value: '0'}}); finish(); b.end();
        break;
      }
      const t = signOf(Rv) * signOf(d), G = Rv - BigInt(signOf(Rv)) * Dk, ledger = {law: 'divstep', a: String(Rv), b: String(d * radix ** BigInt(k)), q: String(t), r: String(G)};
      // TRY: a ghost of R peels off to the centre and lands as G
      b.begin('try', node, {caption: caption.try(Rv, Dk, G), ledger});
      const ghost = b.id('t'), Rc = column(b, R), Dc = column(b, B);
      b.tower(ghost, {at: `${node}.C`, form: 'tower', value: String(G), ghost: true});
      [...digits(G, 'ternary')].forEach((s, l) => b.bulb(b.id('b'), {t: ghost, l, s}, Rc[l] ? {from: {t: R, l}} : Dc[l] ? {from: {t: B, l}} : undefined));
      b.end();
      // JUDGE: keep whichever is nearer zero; a tie keeps the dividend's sign
      const tie = abs(G) === abs(Rv), keep = abs(G) < abs(Rv) || tie && signOf(G) === signOf(a);
      b.begin('judge', node, {caption: caption.judge(Rv, G, k, t, keep, tie), ledger: keep ? ledger : {law: 'divstep', a: String(Rv), b: String(d * radix ** BigInt(k)), q: '0', r: String(Rv)}});
      const Gc = column(b, ghost);
      b.mark({k: 'scan', node, from: Math.max(Rc.length, Gc.length) - 1, stop: scanStop(Rc, Gc)});
      if (keep) {
        b.dropTower(R);
        b.tower(ghost, {at: `${node}.L`, ghost: null});
        light(k, t);
        R = ghost;
      } else b.dropTower(ghost);
      if (last) finish();
      b.end();
    } else {
      const Rv = b.valueOf(R), fits = abs(Rv) >= Dk, Rc = column(b, R), Dc = column(b, B);
      b.begin('compare', node, {caption: caption.fits(Dk, Rv, k, fits), ledger: {law: 'compare', a: String(abs(Rv)), b: String(Dk), out: String(signOf(abs(Rv) - Dk))}});
      b.mark({k: 'scan', node, from: Math.max(Rc.length, Dc.length) - 1, stop: scanStop(Rc, Dc)});
      b.mark({k: 'verdict', node, s: fits ? 1 : 0});
      if (last && !fits) finish();
      b.end();
      if (fits) {
        const sigma = signOf(Rv), R2 = Rv - BigInt(sigma) * Dk, qd = signOf(a) * signOf(d);
        b.begin('collide', node, {caption: caption.take(Dk, k, R2), ledger: {law: 'divstep', a: String(Rv), b: String(d * radix ** BigInt(k)), q: String(qd), r: String(R2)}});
        b.tower(R, {value: String(R2)});
        // D's own bulbs fly across in the colour opposite to R, and D regrows behind them
        const flying = Dc.map(x => ({id: x.id, s: x.s ? -sigma : 0, via: x.s && x.s !== -sigma ? -sigma : null}));
        const owed = annihilateInto(b, R, flying);
        Dc.forEach((x, l) => b.bulb(b.id('b'), {t: B, l, s: x.s}));
        light(k, qd);
        if (last && !owed) finish();
        b.end();
        borrowBeats(b, node, R, last ? finish : null);
      }
      if (!last) {
        b.begin('descend', node, {caption: caption.descend(Dk / radix), ledger: {law: 'move', value: String(Dk / radix)}});
        descend(b, B, Dk / radix);
        b.end();
      }
    }
    if (ternary && !last) {
      b.begin('descend', node, {caption: caption.descend(Dk / radix), ledger: {law: 'move', value: String(Dk / radix)}});
      descend(b, B, Dk / radix);
      b.end();
    }
  }
  return op === 'div' ? {result: Q, other: R} : {result: R, other: Q};
}
// D drops one level and its bottom dark bulb fades.
function descend(b, D, value) {
  const Dc = column(b, D);
  b.tower(D, {value: String(value)});
  b.drop(Dc[0].id);
  for (let l = 1; l < Dc.length; l++) b.bulb(Dc[l].id, {l: l - 1});
}
