// COMP: one COMPARE beat, then RETURN. The verdict is a one-bulb tower born at the node
// centre with value sign(a − b), blue for >, dark for =, red for <, so it can feed other
// blocks. Binary decides by colour first (blue > dark > red) and scans only same-coloured
// towers, inverting the verdict for two reds; balanced ternary reads lexicographically from
// the top with T < 0 < 1, which is exact because the lower trits differ by less than 3^k.
import {signOf} from '../bigmath.js';
import {caption} from '../captions.js';
import {column} from './borrow.js';

const NAMES = {1: 'blue', 0: 'dark', [-1]: 'red'};
export function cmp(b, node, [A, B]) {
  const a = b.valueOf(A), c = b.valueOf(B), v = signOf(a - c), sa = signOf(a), sc = signOf(c);
  const Ac = column(b, A), Bc = column(b, B), top = Math.max(Ac.length, Bc.length) - 1;
  let why, scan = true, stop = null;
  if (b.base === 'binary' && sa !== sc) { why = `${NAMES[Math.max(sa, sc)]} beats ${NAMES[Math.min(sa, sc)]}`; scan = false; }
  else if (b.base === 'binary' && !sa) { why = 'both are dark'; scan = false; }
  else {
    for (let l = top; l >= 0 && stop === null; l--) if ((Ac[l]?.s ?? 0) !== (Bc[l]?.s ?? 0)) stop = l;
    why = stop === null ? 'every level agrees' : `reading from the top, level ${stop} decides${b.base === 'binary' && sa < 0 ? '; two reds flip the verdict' : ''}`;
  }
  b.begin('compare', node, {caption: caption.compare(a, c, v, why), ledger: {law: 'compare', a: String(a), b: String(c), out: String(v)}});
  if (scan) b.mark({k: 'scan', node, from: top, stop});
  b.node(node, {tilt: v});
  const verdict = b.id('t');
  b.tower(verdict, {at: `${node}.C`, form: 'tower', value: String(v)});
  b.bulb(b.id('b'), {t: verdict, l: 0, s: v}, {in: [0.8, 1]});
  b.end();
  return {result: verdict};
}
