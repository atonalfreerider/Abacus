// Base-e planners and the base's registry entry (registered by e-base.js). A base-e tower
// stands on the radix point: integer levels from the floor (−3) up, each with two sockets
// and a 0.718 sliver, plus the dust, the exact remainder below the floor. A light is one
// bulb at a fractional height, ln of its value. Nothing ever climbs: three bulbs are not
// exactly anything in base e, so addition piles, and a pile that is not already a numeral
// folds into a light and unfolds again, greedily (section 3 of docs/machine-design.md).
// Planners write through the PlanBuilder they are given (6.6) and read only its scene.
import { E, sign, compare, greedy, isLegalNumeral, approx, height, lnText, approxText, digitsText, parseTerms, sup, top as topOf, ln } from '../e-exact.js';

export const FLOOR = -3, CEILING = 20, MAX_EXP = 12, MIN_EXP = -6;
const MINUS = '−', r4 = v => Math.round(v * 1e4) / 1e4, s2 = v => String(v).replace('-', MINUS);
const ZERO = E.of(0);
const val = (b, t) => E.parse(b.scene.towers[t].value);
const bulbsOf = (b, t) => b.bulbsOf(t);
const isLight = q => q.k === 'light';
// A value as an operand in a caption: negatives and sums in brackets.
const opnd = x => sign(x) < 0 || x.t.length > 1 ? `(${x.text()})` : x.text();
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const fit = (...options) => options.find(c => c.length <= 110) ?? options.at(-1).slice(0, 109) + '…';

// ---- reading values: LN gives ln x, which is no element of Q[e, 1/e] ----
// It is carried as the value string 'ln(<key>)' and can only go to Output.
const READING = /^ln\((.*)\)$/;
export const readingOf = value => { const m = READING.exec(value); return m ? E.parse(m[1]) : null; };

// ---- greedy towers ----
// The bulbs of a greedy tower, bottom-up: d bulbs in slots 0..d−1 of each level.
export function digitBulbs(x) {
  const g = greedy(x);
  if (!g.sign) return [{ l: 0, s: 0, slot: 0 }];
  const out = [];
  for (const [l, d] of [...g.digits].sort((a, b) => a[0] - b[0])) for (let slot = 0; slot < d; slot++) out.push({ l, s: g.sign, slot });
  return out;
}
const sumOf = list => { let s = ZERO; for (const [, q] of list) if (!isLight(q) && q.s) s = s.add(E.e(q.l).mul(q.s)); return s; };
// The digit line of a pile: bulb counts per level ('2|2|2.1|2|2…ₑ'); red levels carry a minus.
function pileDigits(list, dust) {
  const count = new Map();
  for (const [, q] of list) if (q.s) count.set(q.l, (count.get(q.l) ?? 0) + q.s);
  if (!count.size) return dust ? '0.000…ₑ' : '0ₑ';
  const levels = [...count.keys()], hi = Math.max(0, ...levels), lo = Math.min(0, ...levels);
  const at = k => { const c = count.get(k) ?? 0; return c < 0 ? MINUS + -c : String(c); };
  const whole = [], frac = [];
  for (let k = hi; k >= lo; k--) (k >= 0 ? whole : frac).push(at(k));
  return whole.join('|') + (frac.length ? '.' + frac.join('|') : '') + (dust ? '…' : '') + 'ₑ';
}

// ---- the registry entry (6.6) ----
const TYPED = 10n ** 6n;
export function parseValue(text) {
  try {
    const terms = parseTerms(text);
    if (terms.length > 6) return { ok: false, error: 'A base-e number may have at most 6 terms' };
    for (const { k, n, d } of terms) {
      if (k < MIN_EXP || k > MAX_EXP) return { ok: false, error: `Powers of e run from e${sup(MIN_EXP)} to e${sup(MAX_EXP)}` };
      if ((n < 0n ? -n : n) > TYPED || d > TYPED) return { ok: false, error: 'Fractions may use numbers up to 1 000 000' };
    }
    let x = ZERO; for (const { k, n, d } of terms) x = x.add(E.e(k).mul({ n, d }));
    const limit = checkLimits(x.key());
    return limit ? { ok: false, error: limit } : { ok: true, value: x.key() };
  } catch (error) { return { ok: false, error: error.message }; }
}
export function checkLimits(value) {
  if (readingOf(value)) return null;
  const x = E.parse(value);
  if (x.isZero()) return null;
  const k = topOf(x);
  if (compare(x.abs(), E.e(CEILING)) > 0) return `${x.text()} is past e²⁰, the top of a base-e tower`;
  if (k < -14) return `${x.text()} is below e⁻¹⁴, past the end of the rail`;
  return null;
}
const NO = {
  div: 'A quotient of e-numerals is usually not an e-numeral.', mod: 'A quotient of e-numerals is usually not an e-numeral.',
  shl: 'Base e shifts by powers of e: use ×eᵏ.', shr: 'Base e shifts by powers of e: use ×eᵏ.',
};
export function evaluate(op, args) {
  if (args.some(a => readingOf(a))) return { ok: false, reason: 'domain', message: 'ln gives a reading, not a number: it can only go to Output.' };
  if (!E_OPS[op]) return { ok: false, reason: 'domain', message: NO[op] ?? 'Logic needs whole-number levels; base e has none.' };
  const [a, b] = args.map(v => E.parse(v));
  switch (op) {
    case 'add': return { ok: true, values: [a.add(b).key()] };
    case 'sub': return { ok: true, values: [a.sub(b).key()] };
    case 'mul': return { ok: true, values: [a.mul(b).key()] };
    case 'mule': {
      // The count k, as typed. After FANOUT the socket holds the power e^k instead (like
      // SHL's 2^k), and a scene evaluates that by multiplying; a power that cannot be a
      // count (e, e², e⁻¹, …) is accepted here as that multiplier too.
      if (!b.isInteger() && b.abs().isPower()) return { ok: true, values: [a.mul(b).key()] };
      const k = shiftOf(b);
      if (k === null) return { ok: false, reason: 'domain', message: `×eᵏ needs a whole k from ${s2(MIN_EXP)} to ${MAX_EXP}: ${b.text()} is not one` };
      return { ok: true, values: [a.shift(k).key()] };
    }
    case 'cmp': return { ok: true, values: [String(compare(a, b))] };
    case 'measure': return { ok: true, values: [a.key()] };
    case 'ln': return sign(a) > 0 ? { ok: true, values: [`ln(${a.key()})`] }
      : { ok: false, reason: 'domain', message: `ln needs a positive number: ${a.text()} has no logarithm; its light would fall forever.` };
  }
}
// ×eᵏ's count: a whole k in range.
const shiftOf = x => { if (!x.isInteger()) return null; const k = Number(x.coeff(0).n); return k >= MIN_EXP && k <= MAX_EXP ? k : null; };
// The power a count stands for: ×eᵏ's right socket holds e^k once it has fanned out.
export const power = k => E.e(Number(k)).key();

export function display(value, { form = 'tower' } = {}) {
  const r = readingOf(value);
  if (r) return { text: lnText(r) };
  const x = E.parse(value), out = { text: x.text() }, approx = approxText(x);
  if (approx) out.approx = approx;
  if (form === 'light') { if (!x.isZero()) out.reading = lnText(x); }
  else out.digits = digitsText(x);
  return out;
}

// I2 and I3 for one base-e tower (6.9). Lights are checked against the very height()
// the planner used; digits are checked against the certified greedy expansion.
export function validateTower(scene, id) {
  const t = scene.towers[id], errors = [], say = m => errors.push(`tower ${id}: ${m}`);
  if (!t) return [`tower ${id} does not exist`];
  if (!t.text) say('has no text');
  const list = Object.entries(scene.bulbs).filter(([, q]) => q.t === id);
  const lights = list.filter(([, q]) => isLight(q)), digits = list.filter(([, q]) => !isLight(q));
  const reading = readingOf(t.value);
  if (reading) {
    if (lights.length !== 1 || digits.length) say('a reading is one light and nothing else');
    else if (lights[0][1].l !== height(reading)) say(`its light stands at ${lights[0][1].l}, not at ${height(reading)}`);
    return errors;
  }
  const x = E.parse(t.value), s = sign(x);
  for (const [bid, q] of digits) {
    if (!Number.isInteger(q.l) || q.l < FLOOR || q.l > CEILING) say(`bulb ${bid} is at level ${q.l}, off the tower`);
    if (!Number.isInteger(q.slot) || q.slot < 0) say(`bulb ${bid} has no socket`);
    if (![-1, 0, 1].includes(q.s)) say(`bulb ${bid} has state ${q.s}`);
  }
  const placed = sumOf(digits), rest = x.sub(placed);
  if (lights.length) {
    if (t.dust) say('a light carries its own dust');
    if (lights.length === 1) {
      const [lid, q] = lights[0];
      if (digits.length && !t.pending) say('digits beside a light outside a level-pace unfold');
      if (rest.isZero()) say('a light worth nothing');
      else { if (q.l !== height(rest)) say(`light ${lid} stands at ${q.l}, not at ${height(rest)}`); if (q.s !== sign(rest)) say(`light ${lid} has the wrong colour`); }
    } else if (lights.length === 2 && !digits.length && t.pending && lights[0][1].s === -lights[1][1].s) {
      // Two colours folded, not yet met: some P > 0 and N > 0 with P − N = x must stand
      // at those heights. Heights are rounded, so this is a float check with slack.
      const [hb, hr] = [1, -1].map(c => lights.find(([, q]) => q.s === c)[1].l), v = approx(x);
      if (v < Math.exp(hb - 2e-4) - Math.exp(hr + 2e-4) || v > Math.exp(hb + 2e-4) - Math.exp(hr - 2e-4)) say('its two lights cannot add up to its value');
    } else say(`holds ${lights.length} lights`);
    return errors;
  }
  // Digit towers: Σ s·e^l over the bulbs plus the exact dust is the value.
  if (!!t.dust !== !rest.isZero()) say(t.dust ? 'shows dust but has none' : `has dust ${rest.text()} but does not show it`);
  const darks = digits.filter(([, q]) => !q.s);
  if (darks.length && (!x.isZero() || darks.length > 1 || digits.length > 1 || darks[0][1].l !== 0)) say('a dark bulb is only zero, alone at level 0');
  if (x.isZero() && !t.pile && digits.length !== 1) say('zero is one dark bulb');
  const levels = new Map();
  for (const [, q] of digits) if (q.s) { const at = levels.get(q.l) ?? { s: q.s, slots: [] }; if (at.s !== q.s) say(`level ${q.l} holds both colours`); at.slots.push(q.slot); levels.set(q.l, at); }
  for (const [l, { slots }] of levels) if (slots.sort((a, b) => a - b).some((v, i) => v !== i)) say(`level ${l} has a gap in its sockets`);
  if (!t.pile && !t.pending && s) {
    // I3: a normal tower is the greedy expansion, in the value's colour.
    const g = greedy(x);
    for (const [l, d] of g.digits) { const at = levels.get(l); if ((at?.slots.length ?? 0) !== d || (d && at.s !== g.sign)) say(`level ${l} should hold ${d} bulb${d === 1 ? '' : 's'}`); }
    for (const l of levels.keys()) if (!g.digits.has(l)) say(`level ${l} lies outside the expansion`);
  }
  return errors;
}

// FANOUT and the start scene: a value's bulbs, or one light when the socket wants one.
export function place(b, t, value, { asLight = false } = {}) {
  const x = E.parse(value);
  if (asLight && !x.isZero()) { b.tower(t, { form: 'light' }); b.bulb(b.id('b'), { t, l: height(x), s: sign(x), k: 'light' }); return; }
  for (const q of digitBulbs(x)) b.bulb(b.id('b'), { t, ...q });
  if (!greedy(x).exact) b.tower(t, { dust: true });
}

// ---- beats ----
// The node's glyph fades in its first working beat (as in the binary planners).
const working = (b, node) => { if (b.scene.nodes[node]?.glyph !== 0) b.node(node, { glyph: 0 }); };
const splitBorn = new WeakMap();   // builder → the × nodes a split created
const born = b => { let s = splitBorn.get(b); if (!s) splitBorn.set(b, s = new Set()); return s; };

// PILE: the donor's bulbs fly across and stack at their own levels, slots 0, 1, then the
// overhanging sliver bulb, then perched ones. Opposite colours at a level cancel in pairs.
function pile(b, node, left, right) {
  const a = val(b, left), c = val(b, right), sum = a.add(c);
  const [rec, don] = compare(a.abs(), c.abs()) > 0 ? [left, right] : [right, left];
  const residents = bulbsOf(b, rec), incoming = bulbsOf(b, don);
  const pairs = [];
  // plan the levels first: which bulbs cancel, and where the incoming ones sit
  const byLevel = list => { const m = new Map(); for (const [id, q] of list) if (q.s) { if (!m.has(q.l)) m.set(q.l, []); m.get(q.l).push([id, q]); } return m; };
  const R = byLevel(residents), I = byLevel(incoming), moves = [], drops = [];
  for (const l of new Set([...R.keys(), ...I.keys()])) {
    const res = (R.get(l) ?? []).sort((x, y) => x[1].slot - y[1].slot), inc = (I.get(l) ?? []).sort((x, y) => x[1].slot - y[1].slot);
    let keepRes = res, keepInc = inc;
    if (res.length && inc.length && res[0][1].s !== inc[0][1].s) {
      const m = Math.min(res.length, inc.length);
      keepRes = res.slice(0, res.length - m); keepInc = inc.slice(0, inc.length - m);
      for (const [id] of [...res.slice(res.length - m), ...inc.slice(inc.length - m)]) drops.push([id, { to: { t: rec, l }, burst: true }]);
      pairs.push(m);
    }
    keepInc.forEach(([id], j) => moves.push([id, { t: rec, slot: keepRes.length + j }]));
  }
  for (const [id, q] of [...residents, ...incoming]) if (!q.s) drops.push([id, { to: { t: rec, l: 0 } }]);   // a zero's dark bulb
  const cancelled = pairs.reduce((s, m) => s + m, 0);
  const caption = fit(cancelled
    ? `${a.text()} + ${opnd(c)}: ${plural(cancelled, 'opposite pair')} cancel${cancelled === 1 ? 's' : ''}; the rest pile up.`
    : `${a.text()} + ${opnd(c)}: the bulbs pile up level by level; nothing climbs.`, `Pile: ${cancelled ? 'opposite pairs cancel' : 'nothing climbs'}.`);
  b.begin('pile', node, { caption, ledger: { law: 'sum', a: a.key(), b: c.key(), out: sum.key() } });
  working(b, node);
  for (const [id, props] of moves) b.bulb(id, props);
  for (const [id, motion] of drops) b.drop(id, motion);
  b.dropTower(don);
  // The pile's digit line counts its bulbs, so the planner writes the text itself (the
  // builder would otherwise fill in the greedy digits of the sum).
  const left2 = bulbsOf(b, rec), dust = !sum.sub(sumOf(left2)).isZero(), shown = display(sum.key());
  b.tower(rec, { at: `${node}.C`, value: sum.key(), pile: true, dust: dust || null, text: shown.text, approx: shown.approx ?? null, digits: pileDigits(left2, dust), reading: null });
  b.end();
  return rec;
}

// LEGAL: the pile is one colour, has no dust and already obeys the greedy condition, so by
// the pile theorem it is the numeral: a certified tick runs up the levels.
function legal(b, node, t, caption) {
  const x = val(b, t), list = bulbsOf(b, t), levels = list.map(([, q]) => q.l);
  b.begin('legal', node, { caption, ledger: { law: 'regroup', value: x.key() } });
  working(b, node);
  if (x.isZero() && !list.length) b.bulb(b.id('b'), { t, l: 0, s: 0, slot: 0 });
  b.tower(t, { pile: null, dust: null, digits: display(x.key()).digits });
  b.mark({ k: 'scan', node, from: Math.min(0, ...levels), stop: Math.max(0, ...levels) });
  b.end();
}
const isNumeral = (b, t) => {
  const x = val(b, t), list = bulbsOf(b, t);
  return x.sub(sumOf(list)).isZero() && isLegalNumeral(x) && new Set(list.map(([, q]) => q.s).filter(Boolean)).size <= 1;
};

// FOLD (inside the current beat): each colour's bulbs merge bottom-up into one light, the
// dust first. The light passes through height(partial sum) at each merge: merging a light
// at h₂ into one at h₁ lifts it by ln(1 + e^−(h₁−h₂)), Gauss's addition logarithm.
function foldInto(b, t) {
  const x = val(b, t), list = bulbsOf(b, t).filter(([, q]) => q.s && !isLight(q)), dust = x.sub(sumOf(list));
  const groups = [];
  for (const s of [1, -1]) {
    const items = list.filter(([, q]) => q.s === s), d = sign(dust) === s ? dust.abs() : null;
    if (!items.length && !d) continue;
    if (!items.length) {   // only dust of this colour: the light condenses out of the haze
      const id = b.id('b'), h = height(d);
      b.bulb(id, { t, l: h, s, k: 'light' }, { in: [0, 0.9], grow: true });
      groups.push({ s, id, value: d, h }); continue;
    }
    const [[first, q0], ...rest] = items;
    let S = E.e(q0.l); const events = [];
    if (d) { S = S.add(d); events.push({ h: height(S) }); }
    for (const [id, q] of rest) { S = S.add(E.e(q.l)); events.push({ id, h: height(S) }); }
    const n = events.length, path = [[0, q0.l]];
    events.forEach((ev, j) => {
      const u0 = r4(0.9 * j / n), u1 = r4(0.9 * (j + 1) / n);
      path.push([u1, ev.h]);
      if (ev.id) b.drop(ev.id, { to: { t, l: ev.h }, move: [u0, u1], fade: [u0, u1] });
    });
    const h = n ? events.at(-1).h : q0.l;
    b.bulb(first, { k: 'light', l: h, slot: null }, n ? { path } : undefined);
    groups.push({ s, id: first, value: S, h });
  }
  b.tower(t, { form: 'light', dust: null, pile: null });
  if (groups.length > 1) b.tower(t, { pending: true, digits: null, reading: groups.map(g => `${g.s > 0 ? 'blue' : 'red'} ≈ ${s2(g.h.toFixed(4))}`).join(' · ') });
  return groups;
}
// Towers that are already lights (a base-e number can arrive as one) are not folded again.
const lit = (b, t) => bulbsOf(b, t).some(([, q]) => isLight(q));
const lightGroups = (b, t) => bulbsOf(b, t).filter(([, q]) => isLight(q)).map(([id, q]) => ({ s: q.s, id, value: val(b, t).abs(), h: q.l }));
function fold(b, node, towers, caption) {
  const todo = towers.filter(t => !lit(b, t));
  if (todo.length) {
    const x = val(b, todo[0]);
    b.begin('fold', node, { caption, ledger: { law: 'fold', value: x.key(), h: height(x) } });
    working(b, node);
    for (const t of todo) foldInto(b, t);
    b.end();
  }
  return towers.map(t => lightGroups(b, t));
}
// A light where a tower is needed (a pile, a shift) unfolds first.
const expand = (b, node, towers) => { for (const t of towers) if (lit(b, t)) unfold(b, node, t); };
const foldCaption = (x, groups) => groups.length > 1
  ? `Fold each colour into its own light: blue rises to ≈ ${groups[0].h.toFixed(2)}, red to ≈ ${groups[1].h.toFixed(2)}.`
  : `Fold: the bulbs merge into one light at height ${lnText(x)}.`;

// MEET: the smaller light subtracts from the larger, which drops to
// h_max + ln(1 − e^−Δ), the subtraction logarithm. Which is larger is certified, never
// read off the rounded heights.
function meet(b, node, t, groups) {
  const x = val(b, t), [blue, red] = groups, s = compare(blue.value, red.value);
  const [win, lose] = s > 0 ? [blue, red] : [red, blue];
  b.begin('meet', node, {
    caption: s ? fit(`The smaller light subtracts from the larger: ${x.text()} stands at ${lnText(x)}.`, `The smaller light subtracts from the larger.`)
      : 'The two lights are equal: they cancel, and nothing is left. 0.',
    ledger: { law: 'sum', a: blue.value.key(), b: red.value.neg().key(), out: x.key() },
  });
  if (!s) {
    for (const g of groups) b.drop(g.id, { burst: true });
    b.bulb(b.id('b'), { t, l: 0, s: 0, slot: 0 });
    b.tower(t, { form: 'tower', pending: null, reading: null, digits: '0ₑ' });
  } else {
    const h = height(x);
    b.drop(lose.id, { to: { t, l: h }, dissolve: true });
    b.bulb(win.id, { l: h, s: sign(x) });
    b.tower(t, { pending: null, reading: lnText(x) });
  }
  b.end();
  return s !== 0;
}

// UNFOLD: the light falls; at each level with d_k > 0, d_k bulbs condense out of it, and
// each time it comes to rest it is at ln of what is left. Keyframes, deposit times and the
// inverted ease follow 6.3 exactly; in level pace each deposit is its own beat.
export function unfoldPlan(x) {
  const g = greedy(x), events = [];
  let R = x.abs();
  for (const [k, d] of [...g.digits].sort((p, q) => q[0] - p[0])) if (d) { events.push({ k, d, h: height(R) }); R = R.sub(E.e(k).mul(d)); }
  const end = g.exact ? events.at(-1)?.k ?? height(x) : height(g.rest);
  return { g, events, start: height(x), end };
}
// A deposit crosses at f = (h₀ − k)/(h₀ − h₁) of its segment and is born at the inverse of
// the ease there. What is left can be exactly e^k: then the light already rests on the
// level (h₀ = h₁ = k), and the bulb condenses at once.
function deposits(b, t, s, u0, u1, h0, h1, k, d) {
  const f = h0 === h1 ? 0 : Math.min(1, Math.max(0, (h0 - k) / (h0 - h1))), c = r4(u0 + (u1 - u0) * (1 - Math.sqrt(1 - f)));
  for (let slot = 0; slot < d; slot++) b.bulb(b.id('b'), { t, l: k, s, slot }, { in: [c, r4(c + 0.081)], grow: true });
}
function unfold(b, node, t) {
  const x = val(b, t), s = sign(x), light = bulbsOf(b, t).find(([, q]) => isLight(q))[0];
  const { g, events, end } = unfoldPlan(x), n = events.length;
  const hs = [...events.map(e => e.h), end];
  const caption = n ? fit(`The light falls and leaves the bulbs that fit: ${x.text()} = ${digitsText(x)}.`, `The light falls and leaves the bulbs that fit: ${digitsText(x)}.`)
    : fit(`${x.text()} has no bulb above the floor: the light falls and fades into dust. ${digitsText(x)}`, `The light fades into dust: ${digitsText(x)}`);
  const finish = () => b.tower(t, { form: 'tower', pending: null, dust: g.exact ? null : true });
  if (b.pace !== 'level' || n <= 1) {
    b.begin('unfold', node, { caption, ledger: { law: 'unfold', value: x.key() } });
    working(b, node);
    const path = n ? hs.map((h, j) => [r4(0.9 * j / n), h]) : undefined;
    events.forEach((e, j) => deposits(b, t, s, r4(0.9 * j / n), r4(0.9 * (j + 1) / n), hs[j], hs[j + 1], e.k, e.d));
    b.drop(light, { ...(path ? { path } : {}), fade: [0.9, 1] });
    finish(); b.end();
    return;
  }
  // Level pace: one beat per deposit; between beats the light rests at ln of what is left.
  let R = x.abs();
  events.forEach((e, j) => {
    const last = j === n - 1, h0 = hs[j], h1 = hs[j + 1];
    R = R.sub(E.e(e.k).mul(e.d));
    const where = `level ${s2(e.k)}`, left = last ? (g.exact ? 'Nothing is left: it lands.' : 'The rest is dust.') : `The rest rests at height ${s2(h1.toFixed(4))}.`;
    b.begin('unfold', node, { caption: fit(`The light falls past ${where} and leaves ${plural(e.d, 'bulb')} there. ${left}`, `${where}: ${plural(e.d, 'bulb')}. ${left}`), ledger: { law: 'unfold', value: x.key() } });
    working(b, node);
    deposits(b, t, s, 0, 0.9, h0, h1, e.k, e.d);
    if (last) { b.drop(light, { path: [[0, h0], [0.9, h1]], fade: [0.9, 1] }); finish(); }
    else {
      b.bulb(light, { l: h1 }, { path: [[0, h0], [0.9, h1]] });
      const lv = Math.floor(h1), fill = approx(R) / Math.exp(lv);
      b.tower(t, { pending: true, reading: `≈ ${fill.toFixed(2)} bulbs’ worth at e${sup(lv)}` });
    }
    b.end();
  });
}
// After a pile: LEGAL if it is already a numeral, otherwise FOLD, MEET when both colours
// are left, then UNFOLD in the winner's colour.
function normalise(b, node, t) {
  const x = val(b, t);
  if (isNumeral(b, t)) {
    legal(b, node, t, x.isZero() ? 'Everything cancels: nothing is left. 0.'
      : fit(`Every level is legal, so the pile is already a numeral: ${x.text()} = ${digitsText(x)} exactly.`, `Every level is legal: ${digitsText(x)} exactly.`));
    return;
  }
  b.begin('fold', node, { caption: foldCaption(x, foldPreview(b, t)), ledger: { law: 'fold', value: x.key(), h: height(x) } });
  working(b, node);
  const groups = foldInto(b, t);
  b.end();
  if (groups.length > 1 && !meet(b, node, t, groups)) return;
  unfold(b, node, t);
}
// The groups a fold will make, for its caption (heights of each colour's total).
function foldPreview(b, t) {
  const x = val(b, t), list = bulbsOf(b, t).filter(([, q]) => q.s && !isLight(q)), dust = x.sub(sumOf(list));
  return [1, -1].map(s => { let S = sign(dust) === s ? dust.abs() : ZERO; for (const [, q] of list) if (q.s === s) S = S.add(E.e(q.l)); return { s, h: S.isZero() ? null : height(S) }; }).filter(g => g.h !== null);
}

// RETURN inside a split: the leaf's result rides up into its parent's socket.
function ride(b, child, t) {
  const { parent, socket } = b.scene.nodes[child], x = val(b, t);
  b.begin('return', child, { caption: `${x.text()} rides up.`, ledger: { law: 'move', value: x.key() } });
  b.dropNode(child);
  b.tower(t, { at: `${parent}.${socket}` });
  b.end();
}

// SHIFT (×eᵏ, and every leaf of a split): A rises k levels while the multiplier's bulb
// dissolves where A's units land. The greedy expansion of x·e^k is x's shifted, so the
// levels that climb above the floor condense out of the dust, and levels that sink below
// it merge into the dust. A red multiplier swaps every colour.
function shift(b, node, ta, tm, mult = val(b, tm)) {
  const a = val(b, ta), sm = sign(mult), k = mult.abs().t[0][0];
  const out = a.mul(mult), g = greedy(out);
  const condensed = [];
  const caption = () => {
    const head = `${opnd(a)} × ${opnd(mult)}`, sw = sm < 0 ? ' and every colour swaps' : '';
    if (!k) return sm < 0 ? `${head}: every colour swaps. ${out.text()}.` : `${head}: the 1 dissolves; ${a.text()} stays put.`;
    const dust = condensed.length ? `; ${plural(condensed.length, 'bulb')} condense${condensed.length === 1 ? 's' : ''} out of the dust` : '';
    return fit(k > 0 ? `${head}: ${a.text()} rises ${plural(k, 'level')}${sw}${dust}. ${out.text()}.` : `${head}: ${a.text()} descends ${plural(-k, 'level')}${sw}; the lowest sink into the dust. ${out.text()}.`,
      `${head}: ${k > 0 ? 'rises' : 'descends'} ${plural(Math.abs(k), 'level')}${sw}. ${out.text()}.`);
  };
  // work out the bulbs first so the caption can count what condenses
  const moved = new Map(), plan = [];
  for (const [id, q] of bulbsOf(b, ta)) {
    if (!q.s) { plan.push(['drop', id, { to: { t: ta, l: 0 } }]); continue; }   // never: zero takes the ZERO beat
    const l = q.l + k;
    if (l < FLOOR) { plan.push(['drop', id, { to: { t: ta, l } }]); continue; }
    plan.push(['move', id, { l, ...(sm < 0 ? { s: -q.s } : {}) }]);
    moved.set(l, (moved.get(l) ?? 0) + 1);
  }
  for (const [l, d] of g.digits) for (let slot = moved.get(l) ?? 0; slot < d; slot++) condensed.push({ l, slot });
  b.begin('shift', node, { caption: caption(), ledger: { law: 'shift', a: a.key(), m: mult.key(), k, sign: sm, out: out.key() } });
  working(b, node);
  for (const [what, id, props] of plan) what === 'drop' ? b.drop(id, props) : b.bulb(id, props);
  for (const { l, slot } of condensed) b.bulb(b.id('b'), { t: ta, l, s: g.sign, slot }, { in: [0.6, 0.9], grow: true });
  const lead = bulbsOf(b, tm);
  lead.forEach(([id], j) => b.drop(id, { to: { t: ta, l: j ? 0 : k }, dissolve: true }));
  b.dropTower(tm);
  b.tower(ta, { at: `${node}.C`, value: out.key(), dust: g.exact ? null : true });
  b.end();
  return { result: ta };
}

// ZERO: the zero operand's dark bulb moves to the centre; the other's bulbs slide down
// into it and fade. 0 is never folded.
function zero(b, node, ta, tb) {
  const a = val(b, ta), c = val(b, tb), [z, other] = a.isZero() ? [ta, tb] : [tb, ta];
  b.begin('zero', node, {
    caption: a.isZero() ? `Nothing to multiply: 0 × ${opnd(c)} = 0.` : `${opnd(a)} × 0: no bulbs to shift. 0.`,
    ledger: { law: 'zero', a: a.key(), b: c.key(), out: '0' },
  });
  working(b, node);
  b.tower(z, { at: `${node}.C` });
  for (const [id] of bulbsOf(b, other)) b.drop(id, { to: { t: z, l: 0 } });
  b.dropTower(other);
  b.end();
  return { result: z };
}

// SPLIT (PRIME's, one bulb per split): B = T + R with T its top bulb. The node turns into
// + in place, and two × nodes slide out of it: A × T on the left, a copy of A times R on
// the right. A + born here piles without normalising (Node.pile).
function split(b, node, ta, tb) {
  const a = val(b, ta), m = val(b, tb), s = sign(m), list = bulbsOf(b, tb);
  const k = Math.max(...list.map(([, q]) => q.l)), T = E.e(k).mul(s), R = m.sub(T);
  const head = list.find(([, q]) => q.l === k && q.slot === 0)[0];
  const tx = x => digitsText(x);
  b.begin('split', node, {
    caption: fit(`${tx(m)} = ${tx(T)} + ${tx(R)}, so ${opnd(a)} × ${opnd(m)} = ${opnd(a)} × ${opnd(T)} + ${opnd(a)} × ${opnd(R)}.`,
      `${tx(m)} = ${tx(T)} + ${tx(R)}: one × for the top bulb, one for the rest.`),
    ledger: { law: 'split', a: a.key(), b: m.key(), t: T.key(), r: R.key() },
  });
  const nl = b.id('n'), nr = b.id('n');
  b.node(node, { op: 'add', ...(born(b).has(node) ? { pile: true } : {}) });
  b.node(nl, { op: 'mul', parent: node, socket: 'L' });
  b.node(nr, { op: 'mul', parent: node, socket: 'R' });
  born(b).add(nl); born(b).add(nr);
  b.tower(ta, { at: `${nl}.L` });
  const copy = b.id('t'), rest = b.id('t');
  b.tower(copy, { at: `${nr}.L`, form: 'tower', value: a.key(), ...(b.scene.towers[ta].dust ? { dust: true } : {}) });
  for (const [, q] of bulbsOf(b, ta)) b.bulb(b.id('b'), { t: copy, l: q.l, s: q.s, slot: q.slot }, { from: { t: ta, l: q.l, slot: q.slot } });
  b.tower(rest, { at: `${nr}.R`, form: 'tower', value: R.key() });
  const slots = new Map();
  for (const [id, q] of list) if (id !== head) { const slot = slots.get(q.l) ?? 0; slots.set(q.l, slot + 1); b.bulb(id, { t: rest, slot }); }
  b.tower(tb, { at: `${nl}.R`, value: T.key() });
  b.mark({ k: 'ring', t: tb, l: Math.max(...[...slots.keys()]) });
  b.end();
  const left = multiply(b, nl, ta, tb);
  ride(b, nl, left);
  const right = multiply(b, nr, copy, rest);
  ride(b, nr, right);
  return add(b, node, [ta, right]);
}
// The × planner for one node: ZERO, a SHIFT leaf, a SPLIT, or the slide rule.
function multiply(b, node, ta, tb) {
  const a = val(b, ta), m = val(b, tb);
  if (a.isZero() || m.isZero()) return zero(b, node, ta, tb).result;
  if (m.abs().isPower()) { expand(b, node, [ta]); return shift(b, node, ta, tb).result; }
  const g = greedy(m), count = g.exact ? [...g.digits.values()].reduce((s, d) => s + d, 0) : Infinity;
  if (count <= 6) { expand(b, node, [ta, tb]); return split(b, node, ta, tb).result; }
  return slide(b, node, ta, tb).result;
}
// The slide rule: FOLD both, then B's light flies onto A's rail and dissolves while A's
// light rises by B's height, to height(ab): logarithms add. The planner stores height(ab),
// never a sum of rounded heights; the caption adds the displayed two-decimal values.
function slide(b, node, ta, tb) {
  const a = val(b, ta), m = val(b, tb), out = a.mul(m);
  const [ga] = fold(b, node, [ta, tb], fit(`Fold both: ${lnText(a.abs())} and ${lnText(m.abs())}.`, 'Fold both into lights.'))[0];
  const lb = bulbsOf(b, tb)[0][0], ha = height(a), hb = height(m), h = height(out);
  const cents = v => Math.round(v * 100), add2 = (cents(ha) + cents(hb)) / 100;
  const carried = topOf(out) > topOf(a) + topOf(m);
  const say = `Multiplying adds heights: ${s2(ha.toFixed(2))} + ${s2(hb.toFixed(2))} = ${s2(add2.toFixed(2))}`;
  b.begin('slide', node, {
    caption: fit(carried ? `${say}; levels ${s2(topOf(a))} + ${s2(topOf(m))} = ${s2(topOf(a) + topOf(m))}, yet ${out.text()} stands at level ${s2(topOf(out))}.` : `${say}.`, `${say}.`),
    ledger: { law: 'slide', a: a.key(), b: m.key(), out: out.key() },
  });
  b.drop(lb, { to: { t: ta, l: hb }, dissolve: true });
  b.dropTower(tb);
  b.bulb(ga.id, { l: h, s: sign(out) });
  b.tower(ta, { at: `${node}.C`, value: out.key() });
  b.end();
  unfold(b, node, ta);
  return { result: ta };
}

// ---- the ops (6.6: (b, node, operands) → {result, other?}) ----
function add(b, node, [left, right]) {
  expand(b, node, [left, right]);
  const t = pile(b, node, left, right);
  if (!b.scene.nodes[node]?.pile) normalise(b, node, t);
  return { result: t };
}
// SUB: B's bulbs swap colour in a bottom-up wave while the minus turns into a plus.
function sub(b, node, [left, right]) {
  expand(b, node, [left, right]);
  const c = val(b, right), n = c.neg(), list = bulbsOf(b, right), levels = [...new Set(list.map(([, q]) => q.l))].sort((p, q) => p - q);
  b.begin('negate', node, {
    caption: c.isZero() ? 'Subtracting 0 adds 0: there is nothing to swap.' : fit(`Subtracting ${c.text()} adds ${n.text()}: its bulbs turn ${sign(n) < 0 ? 'red' : 'blue'}.`, `Subtracting adds the opposite: the bulbs turn ${sign(n) < 0 ? 'red' : 'blue'}.`),
    ledger: { law: 'negate', a: c.key(), out: n.key() },
  });
  b.node(node, { op: 'add' });
  for (const [id, q] of list) if (q.s) { const w = r4(Math.min(0.04 * levels.indexOf(q.l), 0.4)); b.bulb(id, { s: -q.s }, { state: [w, r4(w + 0.6)] }); }
  b.tower(right, { value: n.key() });
  b.end();
  return add(b, node, [left, right]);
}
const mul = (b, node, [ta, tb]) => ({ result: multiply(b, node, ta, tb) });
// ×eᵏ: the right socket holds the count k as typed, or, once FANOUT has expanded it as
// it does SHL's count, the power e^k itself, labelled with its note (×e²).
function mule(b, node, [ta, tk]) {
  const a = val(b, ta), t = b.scene.towers[tk], m = val(b, tk);
  if (a.isZero()) return zero(b, node, ta, tk);
  expand(b, node, [ta]);
  return shift(b, node, ta, tk, t.note?.startsWith('×') ? m : E.e(shiftOf(m)));
}
// COMP: colours decide when they differ or one side is 0; otherwise FOLD both and RACE.
// The verdict is the certified compare(); heights only draw it.
function cmp(b, node, [ta, tb]) {
  const a = val(b, ta), c = val(b, tb), v = compare(a, c), sa = sign(a), sc = sign(c);
  const rel = v > 0 ? '>' : v < 0 ? '<' : '=', said = `${a.text()} ${rel} ${c.text()}`;
  const colour = s => s > 0 ? 'blue' : s < 0 ? 'red' : 'dark';
  let kind = 'compare', caption = `Colours decide: ${colour(sa)} against ${colour(sc)}, so ${said}.`;
  if (sa && sc && sa === sc) {
    fold(b, node, [ta, tb], fit(`Fold both: ${lnText(a.abs())} and ${lnText(c.abs())}.`, 'Fold both into lights.'));
    kind = 'race';
    const close = Math.abs(ln(a) - ln(c)) < 1e-9;
    caption = close && v ? `Equal as far as the eye can see; the exact test decides: ${said}.`
      : !v ? `The two lights stand level: ${said}.`
        : sa < 0 ? `Both red: the higher light is the more negative, so ${said}.` : `Race: the higher light is the larger number, so ${said}.`;
  }
  const verdict = b.id('t');
  b.begin(kind, node, { caption: fit(caption, said), ledger: { law: 'compare', a: a.key(), b: c.key(), out: String(v) } });
  working(b, node);
  b.node(node, { tilt: v });
  if (kind === 'race') b.mark({ k: 'scan', node, from: Math.floor(Math.max(height(a), height(c))) + 1, stop: Math.max(height(a), height(c)) });
  for (const t of [ta, tb]) { for (const [id] of bulbsOf(b, t)) b.drop(id, { fade: [0.8, 1] }); b.dropTower(t); }
  b.tower(verdict, { at: `${node}.C`, form: 'tower', value: String(v) });
  b.bulb(b.id('b'), { t: verdict, l: 0, s: v, slot: 0 }, { in: [0.8, 1] });
  b.end();
  return { result: verdict };
}
// MEASURE: unfold any value into its digit tower. A typed value arrives as a light.
function measure(b, node, [t]) {
  const x = val(b, t);
  if (x.isZero()) { legal(b, node, t, '0 is exact: one dark bulb.'); return { result: t }; }
  fold(b, node, [t], foldCaption(x, foldPreview(b, t)));
  unfold(b, node, t);
  return { result: t };
}
// LN: FOLD, then READ the height off the rail. The result is a reading, not a tower.
function lnOp(b, node, [t]) {
  const x = val(b, t);
  if (sign(x) <= 0) throw RangeError(`ln of ${x.text()}: the pre-check should have refused it`);
  fold(b, node, [t], foldCaption(x, foldPreview(b, t)));
  b.begin('read', node, { caption: `${lnText(x)}: the height of the folded light.`, ledger: { law: 'read', value: x.key(), h: height(x) } });
  working(b, node);
  b.tower(t, { value: `ln(${x.key()})` });
  b.end();
  return { result: t };
}
export const E_OPS = { add, sub, mul, mule, cmp, measure, ln: lnOp };

export const eSpec = {
  id: 'e', palette: ['add', 'sub', 'mul', 'mule', 'cmp', 'measure', 'ln'],
  parseValue, evaluate, display, checkLimits, validateTower, place, power, ops: E_OPS,
};
