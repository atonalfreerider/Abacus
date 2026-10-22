// Binary, opposite colours: the larger magnitude receives, a lit pair cancels in a burst,
// and a donor bulb over a dark level stays as an owed bulb (`o: 1`). Then one BORROW beat
// per owed bulb, highest first: the nearest receiver-coloured bulb above comes down, lights
// every dark level it passes and splits into a pair at the owed level, one half paying the
// debt: 2^j = 2^(j−1) + … + 2^(k+1) + 2·2^k. Ternary never borrows; its carries can be red.
import {caption} from '../captions.js';

// A tower's column by level: [{id, s, o?}] (lanes and the lamp excluded).
export function column(b, t) {
  const out = [];
  for (const [id, x] of b.bulbsOf(t)) if (!x.k && !x.slot) out[x.l] = x.o ? {id, s: x.s, o: 1} : {id, s: x.s};
  return out;
}
// The top lit level (zero keeps its single dark bulb at level 0).
export function topOf(cells) {
  let top = 0;
  cells.forEach((x, k) => { if (x && x.s) top = k; });
  return top;
}
// r ∈ {0, σ}; i ∈ {0, −σ} or null when the donor is shorter.
export function annihilate({r, i = null}) {
  if (i && r) return {stay: 'R', d: 0, fade: ['I'], owed: false, burst: true};
  if (i) return {stay: 'I', d: i, fade: ['R'], owed: true, burst: false};
  return {stay: 'R', d: r, fade: i === null ? [] : ['I'], owed: false, burst: false};
}
// The pure schedule, on per-level magnitudes after the collision: 1 a receiver-coloured bulb,
// −1 an owed one, 0 dark. Returns each borrow {k, j, shrink} and the final levels.
export function annihilateCells(r, i) {
  const cells = r.map((x, k) => { const res = annihilate({r: x, i: k < i.length ? -i[k] : null}); return res.owed ? -1 : res.d; });
  while (cells.length > 1 && !cells.at(-1)) cells.pop();
  return cells;
}
export function borrowSchedule(cells) {
  cells = [...cells]; const steps = [];
  for (let k = cells.lastIndexOf(-1); k >= 0; k = cells.lastIndexOf(-1)) {
    let j = k + 1; while (j < cells.length && cells[j] !== 1) j++;
    if (j >= cells.length) throw new Error('an owed bulb has no donor above it');
    const shrink = j === cells.length - 1;
    for (let m = k; m < j; m++) cells[m] = 1;
    if (shrink) cells.pop(); else cells[j] = 0;
    steps.push({k, j, shrink});
  }
  return {steps, cells};
}
// Resolve donor bulbs I (by level; s already in the donor's colour, `via` an in-flight colour
// for DIV's copy of D) against the receiver's column inside the open beat. Returns the
// number of owed bulbs.
export function annihilateInto(b, recv, I) {
  const R = column(b, recv), cells = [], fades = [];
  let owed = 0;
  for (let k = 0; k < R.length; k++) {
    const r = R[k], i = I[k] ?? null, res = annihilate({r: r.s, i: i ? i.s : null});
    cells[k] = {...(res.stay === 'R' ? r : i), s: res.d, owed: res.owed, burst: res.burst};
    if (res.owed) owed++;
    for (const f of res.fade) fades.push({...(f === 'R' ? r : i), l: k, burst: res.burst});
  }
  const top = topOf(cells), fly = x => x.via ? {via: {s: x.via}} : {};
  cells.forEach((x, k) => {
    if (k <= top) b.bulb(x.id, {t: recv, l: k, s: x.s, o: x.owed ? 1 : null}, x.via ? fly(x) : undefined);
    else b.drop(x.id, {to: {t: recv, l: k}, ...fly(x), ...(x.burst ? {burst: true} : {fade: [0.9, 1]})});
  });
  for (const f of fades) b.drop(f.id, {to: {t: recv, l: f.l}, ...fly(f), ...(f.burst ? {burst: true} : {})});
  return owed;
}
// ADD of opposite colours: the receiver slides to the node centre and the donor flies in.
export function annihilateCollide(b, node, {recv, donor, ledger, text}) {
  b.begin('collide', node, {ledger});
  b.node(node, {glyph: 0});
  b.tower(recv, {at: `${node}.C`, value: ledger.out});
  const owed = annihilateInto(b, recv, column(b, donor));
  b.dropTower(donor);
  b.describe({caption: caption.annihilate(text, owed, ledger.out)});
  b.end();
  return owed;
}
const round4 = x => Math.round(x * 1e4) / 1e4;
// One BORROW beat per owed bulb in tower t, highest first; `onLast` runs inside the last.
export function borrowBeats(b, node, t, onLast = null) {
  const cells = column(b, t), sigma = cells.find(x => x && x.s && !x.o)?.s;
  const {steps} = borrowSchedule(cells.map(x => x.o ? -1 : x.s ? 1 : 0));
  steps.forEach(({k, j, shrink}, n) => {
    const now = column(b, t), value = String(b.valueOf(t));
    b.begin('borrow', node, {caption: caption.borrow(k, j, n === steps.length - 1 ? value : null), ledger: {law: 'regroup', value}});
    b.bulb(now[j].id, {l: k}, {move: [0, 0.8]});
    // each dark level lights as the donor passes it on its eased way down over [0, 0.8]
    for (let m = k + 1; m < j; m++) {
      const at = round4(0.8 * (1 - Math.sqrt(1 - (j - m) / (j - k))));
      b.bulb(now[m].id, {s: sigma}, {state: [at, Math.min(1, round4(at + 0.1))]});
    }
    b.drop(now[k].id, {burst: true, fade: [0.8, 1]});
    if (!shrink) b.bulb(b.id('b'), {t, l: j, s: 0});
    if (n === steps.length - 1) onLast?.();
    b.end();
  });
  return steps.length;
}
