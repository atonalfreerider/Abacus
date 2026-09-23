// Drag physics for equation cards. The held card follows the pointer on a critically
// damped spring, so it has weight. The equals mirror resists like a membrane: the
// card slows and the mirror bends until the push passes a threshold, then the card
// pops through and its sign flips. Like terms on the card's side attract it and snap
// (a zero pair or a combination); the other cards spring aside to show where it lands.
// While a card is held off its home side's balance, the equals bars tilt into < or >,
// as the original SWF did. Pure state; the app writes the resulting transforms.
import { layout } from './view.js';
import { math } from './model.js';

export const GAP = 12;          // resistance begins when the card's leading edge is this close to the mirror
export const MEMBRANE = 115;    // pointer travel into the membrane needed to pop through
export const RESISTANCE = .22;  // card travel per unit of push inside the membrane
export const ATTRACT = 175, SNAP = 72, RELEASE = 120; // magnet radii between card centres
const CARD_OMEGA = 30, WORLD_OMEGA = 16, TILT_OMEGA = 12;

// Exact critically damped spring step: stable for any frame time.
export function spring(p, v, target, omega, dt) {
  const e = p - target, f = Math.exp(-omega * dt), g = v + omega * e;
  return [target + (e + g * dt) * f, (v - omega * g * dt) * f];
}
const other = side => side === 'left' ? 'right' : 'left';

export class DragBody {
  constructor(equation, options, id, pointer) {
    this.equation = equation; this.options = { ...options }; this.id = id;
    this.expression = !!options.expression;
    this.base = layout(equation, this.options);
    this.slot = this.base.terms.find(t => t.term.id === id);
    if (!this.slot) throw Error('Unknown card.');
    this.term = this.slot.term; this.home = this.slot.side; this.side = this.home;
    this.grab = { x: pointer.x - this.slot.x, y: pointer.y - this.slot.y };
    this.pos = { x: this.slot.x, y: this.slot.y }; this.vel = { x: 0, y: 0 };
    this.world = new Map(this.base.terms.filter(t => t.term.id !== id).map(t => [t.term.id, { x: t.x, y: t.y, vx: 0, vy: 0, slot: t }]));
    this.equal = this.base.equal && { x: this.base.equal.x, y: this.base.equal.y, vx: 0, vy: 0 };
    this.snap = null; this.merging = false; this.insert = this.slot.index; this.strain = 0;
    this.tilt = 0; this.tiltVelocity = 0; this.events = [];
    this.retarget();
  }
  get crossed() { return this.side !== this.home; }
  // The value the card would have where it is now.
  get value() { return this.crossed ? math.neg(this.term.value) : this.term.value; }
  get axis() { return this.options.orientation === 'vertical' ? 'y' : 'x'; }
  half(axis = this.axis) { return axis === 'x' ? this.slot.w / 2 : 75; }
  centre(p = this.pos) { return { x: p.x + this.slot.w / 2, y: p.y + 75 }; }
  // The layout the other cards spring toward. Nothing moves away from the pointer:
  // the held card's own slot stays reserved as a hole, a merge opens no gap, and only
  // the row the card would join makes room at the insertion point.
  hypothetical() {
    const rows = { left: [...this.equation.left], right: [...this.equation.right] };
    if (this.snap || this.merging) return rows;
    if (!this.crossed) { const row = rows[this.home].filter(t => t.id !== this.id); row.splice(Math.min(this.insert, row.length), 0, this.term); rows[this.home] = row; return rows; }
    rows[this.side] = [...rows[this.side]];rows[this.side].splice(Math.min(this.insert, rows[this.side].length), 0, { ...math.negateTerm(this.term), id: 'landing' });
    return rows;
  }
  // The mirror stays put: a growing left row extends leftward, a right row rightward.
  retarget() {
    const scene = layout(this.hypothetical(), this.options), row = (s, side) => s.terms.filter(t => t.side === side);
    const start = r => r[0].x, end = r => r.at(-1).x + r.at(-1).w, shift = { left: 0, right: 0 };
    for (const side of ['left', 'right']) {
      const was = row(this.base, side), now = row(scene, side);
      if (was.length && now.length) shift[side] = side === 'left' && !this.expression && this.options.orientation !== 'vertical' ? end(was) - end(now) : start(was) - start(now);
    }
    for (const [id, body] of this.world) { const slot = scene.terms.find(t => t.term.id === id); body.target = slot ? { x: slot.x + shift[slot.side], y: slot.y } : { x: body.slot.x, y: body.slot.y }; }
    this.equalTarget = this.base.equal;
    const landing = this.snap || this.merging ? null : scene.terms.find(t => t.term.id === (this.crossed ? 'landing' : this.id));
    this.landing = landing ? { ...landing, x: landing.x + shift[landing.side] } : null;
  }
  candidates() {
    if (this.term.expr) return [];
    return [...this.world.entries()].filter(([, b]) => b.slot.side === this.side && !b.slot.term.placeholder && b.slot.term.kind === this.term.kind && !b.slot.term.expr).map(([id, b]) => ({ id, body: b, term: b.slot.term }));
  }
  update(pointer, dt) {
    const desired = { x: pointer.x - this.grab.x, y: pointer.y - this.grab.y };
    const before = { side: this.side, insert: this.insert, snap: this.snap?.id };
    this.strain = 0;
    if (this.equal && !this.expression) {
      const axis = this.axis, mirror = this.equal[axis], half = this.half(axis), toward = this.side === 'left' ? 1 : -1;
      const push = (desired[axis] + half + toward * half - mirror) * toward + GAP;
      if (push > MEMBRANE) {
        // Pop: the card clears the mirror completely and the grip slides along it.
        const jump = mirror + toward * (GAP + half) - half - desired[axis];
        this.grab[axis] -= jump; desired[axis] += jump;
        this.side = other(this.side); this.snap = null; this.events.push('cross');
      } else if (push > 0) { desired[axis] = mirror - toward * (GAP + half) - half + toward * push * RESISTANCE; this.strain = push / MEMBRANE; }
    }
    // Magnet: the nearest like term on this side pulls; close enough, the card snaps onto it.
    const c = this.centre(desired);
    let best = null;
    for (const cand of this.candidates()) { const cc = { x: cand.body.x + cand.body.slot.w / 2, y: cand.body.y + 75 }, d = Math.hypot(cc.x - c.x, cc.y - c.y); if (!best || d < best.d) best = { ...cand, d, cc }; }
    if (this.snap && (!best || best.id !== this.snap.id || best.d > RELEASE)) { this.snap = null; this.events.push('unsnap'); }
    if (best && !this.snap && best.d < SNAP) { this.snap = { id: best.id, kind: Math.sign(best.term.value.n) === Math.sign(this.value.n) ? 'combine' : 'cancel' }; this.events.push('snap'); }
    const merging = this.merging;
    this.merging = !!best && best.d < ATTRACT;
    if (this.snap) { desired.x = best.body.x - 14; desired.y = best.body.y - 14; }
    else if (this.merging) { const w = (1 - best.d / ATTRACT) ** 2 * .55; desired.x += (best.cc.x - c.x) * w; desired.y += (best.cc.y - c.y) * w; }
    // The insertion point is always tracked (a release commits it), but a pending merge opens no gap.
    const centre = this.centre(desired).x;
    this.insert = [...this.world.values()].filter(b => b.slot.side === this.side && !b.slot.term.placeholder && b.slot.term.id !== this.id).filter(b => b.slot.x + b.slot.w / 2 < centre).length;
    if (before.side !== this.side || before.snap !== this.snap?.id || merging !== this.merging || before.insert !== this.insert && !this.merging && !this.snap) this.retarget();
    [this.pos.x, this.vel.x] = spring(this.pos.x, this.vel.x, desired.x, CARD_OMEGA, dt);
    [this.pos.y, this.vel.y] = spring(this.pos.y, this.vel.y, desired.y, CARD_OMEGA, dt);
    this.step(dt);
    return this;
  }
  // Springs for everything except the held card; also used alone while settling back.
  step(dt) {
    for (const body of this.world.values()) { [body.x, body.vx] = spring(body.x, body.vx, body.target.x, WORLD_OMEGA, dt); [body.y, body.vy] = spring(body.y, body.vy, body.target.y, WORLD_OMEGA, dt); }
    if (this.equal && this.equalTarget) { [this.equal.x, this.equal.vx] = spring(this.equal.x, this.equal.vx, this.equalTarget.x, WORLD_OMEGA, dt); [this.equal.y, this.equal.vy] = spring(this.equal.y, this.equal.vy, this.equalTarget.y, WORLD_OMEGA, dt); }
    // Holding a card off its home side unbalances it: + lifted from the left makes the left lighter (<).
    const target = this.crossed || this.snap ? 0 : Math.sign(this.term.value.n) * (this.home === 'left' ? 1 : -1);
    [this.tilt, this.tiltVelocity] = spring(this.tilt, this.tiltVelocity, target * (1 - this.strain * .5), TILT_OMEGA, dt);
  }
  // Where a release would commit; null means the card returns home.
  drop() {
    if (this.snap) return { side: this.side, target: this.snap.id, index: null };
    if (this.crossed) return { side: this.side, target: null, index: this.insert };
    return this.insert !== this.slot.index ? { side: this.side, target: null, index: this.insert } : null;
  }
  // Settling back home after a release that changes nothing.
  settle(dt) {
    this.side = this.home; this.snap = null; this.merging = false; this.insert = this.slot.index; this.strain = 0;
    this.retarget();
    [this.pos.x, this.vel.x] = spring(this.pos.x, this.vel.x, this.slot.x, CARD_OMEGA * .7, dt);
    [this.pos.y, this.vel.y] = spring(this.pos.y, this.vel.y, this.slot.y, CARD_OMEGA * .7, dt);
    this.step(dt);
    return Math.hypot(this.pos.x - this.slot.x, this.pos.y - this.slot.y) < .5 && Math.hypot(this.vel.x, this.vel.y) < 5;
  }
}
