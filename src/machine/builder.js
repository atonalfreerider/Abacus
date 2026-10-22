// PlanBuilder: the only way planners write beats. A planner opens a beat, edits the working
// scene (bulbs, towers, nodes, motion overrides, marks) and closes it; the builder records
// the diff, fills every tower's display strings through the base registry and checks I2 and
// I3 on each tower the beat touched, so a planner bug fails at the beat that made it.
//
// Entries of the working scene are replaced, never mutated, and the first touch of an id in
// a beat remembers its old entry, so closing a beat costs only what the beat changed.
import {getBase} from './registry.js';

export class LimitError extends Error {
  constructor(message) { super(message); this.name = 'LimitError'; }
}
const RADIX = {binary: 2n, ternary: 3n}, POWERS = {binary: [1n], ternary: [1n]};
const SMALL_LEVEL = {binary: 50, ternary: 31};    // towers this low sum exactly in a Number
const NUMBER_POWERS = {binary: Array.from({length: 51}, (_, k) => 2 ** k), ternary: Array.from({length: 32}, (_, k) => 3 ** k)};
const DISPLAY = ['text', 'approx', 'digits', 'reading'];
const KINDS = ['nodes', 'towers', 'bulbs'];
const clean = props => { const out = {}; for (const f in props) if (props[f] !== null && props[f] !== undefined) out[f] = props[f]; return out; };
const unchanged = (old, props) => {
  for (const f in props) { const v = props[f]; if (v === null || v === undefined ? f in old : old[f] !== v) return false; }
  return true;
};
const merge = (old, props) => {
  const out = {...old};
  for (const f in props) { if (props[f] === null || props[f] === undefined) delete out[f]; else out[f] = props[f]; }
  return out;
};

export class PlanBuilder {
  #base; #spec; #pace; #limits; #check;
  #s = {nodes: {}, towers: {}, bulbs: {}};
  #next = {b: 0, t: 0, n: 0};
  #index = new Map();                 // tower id → Set of its bulb ids
  #sorted = new Map();                // tower id → its bulbs by level and slot
  #start = null; #beats = [];
  #beat = null; #motion = null; #marks = null;
  // per beat, cleared at each begin: first-touch entries, planner-written texts, towers whose
  // lamp or bulbs changed
  #orig = {nodes: new Map(), towers: new Map(), bulbs: new Map()};
  #texts = new Set(); #lamps = new Set(); #bulbTowers = new Set(); #towers = new Set();
  #stats = {nodes: new Set(), maxLevels: 0, maxBulbs: 0, bulbs: 0};

  constructor({base, tree = {}, inputs = [], pace = 'together', limits = {}, check = true}) {
    this.#base = base; this.#spec = getBase(base); this.#pace = pace;
    this.#limits = {levels: Infinity, nodes: Infinity, beats: Infinity, ...limits}; this.#check = check;
    this.tree = Object.fromEntries(Object.entries(tree).map(([id, node]) => [id, {...node}])); this.inputs = inputs.map(String);
    for (const [id, node] of Object.entries(tree)) {
      const m = /^n(\d+)$/.exec(id); if (m) this.#next.n = Math.max(this.#next.n, Number(m[1]));
      this.#s.nodes[id] = {...node}; this.#stats.nodes.add(id);
    }
    // Inputs become towers t1, t2, … in the Input pill, their bulbs numbered bottom-up.
    this.inputs.forEach((value, i) => {
      const t = this.id('t');
      this.tower(t, {at: `in:${i}`, form: 'coin', value});
      this.#spec.place(this, t, value, {asLight: true});
    });
    for (const id in this.#s.towers) this.#fill(id);
  }
  get scene() { return this.#s; }
  get base() { return this.#base; }
  get pace() { return this.#pace; }
  get beats() { return this.#beats; }
  id(kind) { return kind + ++this.#next[kind]; }

  begin(kind, node, {caption, ledger, dur = 1} = {}) {
    if (this.#beat) throw new Error(`beat ${this.#beats.length} (${this.#beat.kind}) is still open`);
    if (this.#beats.length >= this.#limits.beats) throw new LimitError(`more than ${this.#limits.beats} beats`);
    if (!this.#start) this.#freeze();
    this.#beat = {i: this.#beats.length, kind, node, dur, caption, ledger};
    for (const kind of KINDS) this.#orig[kind].clear();
    this.#texts.clear(); this.#lamps.clear(); this.#bulbTowers.clear();
    this.#motion = {}; this.#marks = [];
    return this;
  }
  // Caption and ledger may be settled once the beat's work is known.
  describe({caption, ledger}) {
    if (caption !== undefined) this.#beat.caption = caption;
    if (ledger !== undefined) this.#beat.ledger = ledger;
    return this;
  }
  #touch(kind, id) {
    if (!this.#beat) { if (this.#start) throw new Error('scene edits after the start need a beat'); return; }
    const orig = this.#orig[kind];
    if (!orig.has(id)) orig.set(id, this.#s[kind][id]);
  }
  #motionFor(id, motion) {
    if (!motion || !this.#beat) return;
    const prev = this.#motion[id];
    this.#motion[id] = prev ? {...prev, ...motion} : motion;
  }

  bulb(id, props = {}, motion) {
    const old = this.#s.bulbs[id];
    // a patch that changes nothing (a survivor written back where it stands, as a collision
    // writes its whole column) leaves the bulb, its tower and the diff alone
    if (old && unchanged(old, props)) { this.#motionFor(id, motion); return id; }
    this.#touch('bulbs', id);
    const next = old ? merge(old, props) : clean(props);
    if (next.s === 0) next.s = 0;       // never −0: plans are compared after a JSON round trip
    if (old?.t !== next.t) {
      if (old) this.#index.get(old.t)?.delete(id);
      let set = this.#index.get(next.t); if (!set) this.#index.set(next.t, set = new Set()); set.add(id);
    }
    if (!old) this.#stats.bulbs++;
    this.#s.bulbs[id] = next;
    this.#noteBulb(old, next);
    this.#motionFor(id, motion);
    return id;
  }
  drop(id, motion) {
    const old = this.#s.bulbs[id]; if (!old) throw new Error(`no bulb ${id}`);
    this.#touch('bulbs', id);
    delete this.#s.bulbs[id]; this.#index.get(old.t)?.delete(id); this.#stats.bulbs--;
    this.#noteBulb(old, null);
    this.#motionFor(id, motion);
  }
  #noteBulb(old, next) {
    if (old) this.#sorted.delete(old.t);
    if (next) this.#sorted.delete(next.t);
    if (!this.#beat) return;
    for (const b of [old, next]) if (b) { this.#bulbTowers.add(b.t); if (b.k === 'lamp') this.#lamps.add(b.t); }
  }
  tower(id, props = {}) {
    const old = this.#s.towers[id];
    this.#touch('towers', id);
    this.#s.towers[id] = old ? merge(old, props) : clean(props);
    if ('text' in props && this.#beat) this.#texts.add(id);
    return id;
  }
  dropTower(id) {
    for (const [b] of this.bulbsOf(id)) this.drop(b);
    this.#touch('towers', id);
    delete this.#s.towers[id];
  }
  node(id, props = {}) {
    const old = this.#s.nodes[id];
    this.#touch('nodes', id);
    if (!old) {
      this.#stats.nodes.add(id);
      if (this.#stats.nodes.size > this.#limits.nodes) throw new LimitError(`more than ${this.#limits.nodes} nodes`);
    }
    this.#s.nodes[id] = old ? merge(old, props) : clean(props);
    return id;
  }
  dropNode(id) { this.#touch('nodes', id); delete this.#s.nodes[id]; }
  mark(m) { this.#marks.push(m); }
  motion(id, motion) { this.#motionFor(id, motion); }

  // [id, bulb] by level, then slot. The list is cached until one of the tower's bulbs
  // changes, so callers read it and never modify it.
  bulbsOf(towerId) {
    let out = this.#sorted.get(towerId);
    if (out) return out;
    const ids = this.#index.get(towerId); if (!ids) return [];
    out = []; for (const id of ids) out.push([id, this.#s.bulbs[id]]);
    out.sort((a, b) => a[1].l - b[1].l || (a[1].slot ?? 0) - (b[1].slot ?? 0));
    this.#sorted.set(towerId, out);
    return out;
  }
  // The bigint a tower's bulbs sum to (6.6), for the whole-number bases. A base-e tower has
  // no bigint value (its levels are powers of e), so its planners read Tower.value instead.
  valueOf(towerId) {
    const radix = RADIX[this.#base];
    if (!radix) throw new Error(`valueOf sums whole-number levels; base ${this.#base} reads Tower.value`);
    const ids = this.#index.get(towerId) || [], small = SMALL_LEVEL[this.#base];
    let fits = true;
    for (const id of ids) if (this.#s.bulbs[id].l > small) { fits = false; break; }
    if (fits) {     // exact in a Number: the sum stays below 2^53
      const p = NUMBER_POWERS[this.#base];
      let v = 0;
      for (const id of ids) { const b = this.#s.bulbs[id]; if (b.s) v += b.s * p[b.l]; }
      return BigInt(v);
    }
    const powers = POWERS[this.#base];
    let v = 0n;
    for (const id of ids) {
      const b = this.#s.bulbs[id]; if (!b.s) continue;
      while (powers.length <= b.l) powers.push(powers.at(-1) * radix);
      v += b.s > 0 ? powers[b.l] : -powers[b.l];
    }
    return v;
  }
  // Levels a tower occupies, as LIMITS counts them (the lamp and a base-e light excluded;
  // a base-e tower is drawn from the floor, level −3, up to max(top, 0)).
  levelsOf(towerId) {
    let top = -Infinity, bottom = Infinity;
    for (const id of this.#index.get(towerId) || []) {
      const b = this.#s.bulbs[id]; if (b.k) continue;
      if (b.l > top) top = b.l; if (b.l < bottom) bottom = b.l;
    }
    if (this.#base === 'e') return this.#s.towers[towerId]?.form === 'tower' ? Math.max(top, 0) + 4 : 0;
    return top === -Infinity ? 0 : top - Math.min(0, bottom) + 1;
  }

  // Display strings come from the registry whenever the value, the form, the lamp or the
  // pending flag changed, unless the planner wrote the text itself (a pending sum).
  #fill(id) {
    const t = this.#s.towers[id];
    const lamp = this.bulbsOf(id).some(([, b]) => b.k === 'lamp');
    const shown = this.#spec.display(t.value, {form: t.form, lamp});
    const props = {};
    for (const f of DISPLAY) props[f] = shown[f] ?? null;
    if (this.#beat) this.#touch('towers', id);
    this.#s.towers[id] = merge(t, props);
  }
  #freeze() {
    this.#start = {nodes: {...this.#s.nodes}, towers: {...this.#s.towers}, bulbs: {...this.#s.bulbs}};
    for (const id in this.#s.towers) this.#measure(id);
    this.#stats.maxBulbs = Math.max(this.#stats.maxBulbs, this.#stats.bulbs);
  }
  #measure(id) {
    const levels = this.levelsOf(id);
    if (levels > this.#limits.levels) throw new LimitError(`tower ${id} would need ${levels} levels`);
    if (levels > this.#stats.maxLevels) this.#stats.maxLevels = levels;
  }

  // A tower that only moved (bulbs, value and flags as they were) keeps its levels and its
  // validity; leaving a quotient register's place ends an exemption, so that move counts.
  #moved(id) {
    if (this.#bulbTowers.has(id)) return false;
    const was = this.#orig.towers.get(id), now = this.#s.towers[id];
    if (!was) return !this.#orig.towers.has(id);
    for (const f in now) if (f !== 'at' && f !== 'note' && was[f] !== now[f]) return false;
    for (const f in was) if (!(f in now)) return false;
    return !was.at.endsWith('.Q');
  }
  end() {
    const beat = this.#beat; if (!beat) throw new Error('no beat is open');
    const towers = this.#towers;
    towers.clear();
    for (const id of this.#orig.towers.keys()) towers.add(id);
    for (const id of this.#bulbTowers) towers.add(id);
    for (const id of towers) {
      const now = this.#s.towers[id]; if (!now || now.pending || this.#texts.has(id)) continue;
      const was = this.#orig.towers.has(id) ? this.#orig.towers.get(id) : now;
      if (!was || was.value !== now.value || was.form !== now.form || was.pending || this.#lamps.has(id)) this.#fill(id);
    }
    for (const id of towers) if (this.#s.towers[id] && !this.#moved(id)) this.#measure(id);
    if (this.#check) {
      const errors = [];
      for (const id of towers) if (this.#s.towers[id] && !this.#moved(id)) errors.push(...this.#spec.validateTower(this.#s, id, this.bulbsOf(id)));
      if (errors.length) throw new Error(`beat ${beat.i} (${beat.kind} at ${beat.node}): ${errors.join('; ')}`);
    }
    this.#stats.maxBulbs = Math.max(this.#stats.maxBulbs, this.#stats.bulbs);
    const set = {};
    for (const kind of KINDS) {
      let patch = null;
      for (const [id, was] of this.#orig[kind]) {
        const now = this.#s[kind][id]; if (was === now) continue;
        let d;
        if (!now) d = null;
        else if (!was) d = {...now};
        else {
          d = null;
          for (const f in now) if (was[f] !== now[f]) (d ??= {})[f] = now[f];
          for (const f in was) if (!(f in now)) (d ??= {})[f] = null;
          if (!d) continue;
        }
        (patch ??= {})[id] = d;
      }
      if (patch) set[kind] = patch;
    }
    const out = {i: beat.i, kind: beat.kind, node: beat.node};
    if (beat.dur !== 1) out.dur = beat.dur;
    out.caption = beat.caption; out.ledger = beat.ledger; out.set = set;
    if (Object.keys(this.#motion).length) out.motion = this.#motion;
    if (this.#marks.length) out.marks = this.#marks;
    this.#beats.push(out);
    this.#beat = null;
    return out;
  }
  finish(result) {
    if (this.#beat) throw new Error('a beat is still open');
    if (!this.#start) this.#freeze();
    return {v: 1, base: this.#base, pace: this.#pace, tree: this.tree, inputs: this.inputs, start: this.#start,
      beats: this.#beats, result,
      stats: {beats: this.#beats.length, nodes: this.#stats.nodes.size, maxLevels: this.#stats.maxLevels, maxBulbs: this.#stats.maxBulbs}};
  }
}
