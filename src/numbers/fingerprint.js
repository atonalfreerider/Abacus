// Marble fingerprints: a whole number written by its prime components, in the marble
// language of the riemann-zeta-visualization games (MarbleFingerprint.cs), drawn flat in SVG.
// Read left to right along a thin string:
// * a badge marble in the number's own colour (gold prime, deep red p², blue pronic, grey composite);
// * one round gold container per prime factor, holding as many marbles as the prime in a
//   symmetric spiral;
// * the exponent in the container itself: more rings round it, each tilted out of the
//   picture into a plane of its own, their tilts fanned by half a turn like the rings of an
//   armillary sphere. Count all of a container's rings, its own flat ring included: that is
//   how many times its prime is multiplied in. 360 = 2³ · 3² · 5 has two tilted rings round
//   the 2 and one round the 3. The rings precess; from the fourth ring on they rock.
// Unpacking (phase 0 → 1 + m for m prime factors) plays the multiplication: the tilted rings
// slide out along the string and become containers of their own (0 → 1); the first
// container pours into the volume; every next container p sends one marble to each of p
// spots, a copy of the volume so far blooms at each, and the copies swirl into p arms.
import { factor, classify } from './primes.js';
import { flat, flatAngles, radius, containerFlat, armsFor } from './marbles.js';
const StringGap = 1.1, Rim = .45, RingGap = .5, VolumeCap = 9, SymmetricUpTo = 13, MaxVolume = 40000;
// A prime past BigPrime is too many marbles to lay out: its container is a ring with the prime written in it.
export const BigPrime = 2000;
const marblesOf = p => p > BigPrime ? [] : containerFlat(p);
const ease = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
const lerp = (a, b, t) => a + (b - a) * t;
const r3 = n => Math.round(n * 1000) / 1000;
const cupRadius = p => p > BigPrime ? 1.1 + .32 * String(p).length : radius(containerFlat(p)) + Rim;
const ringRadius = (p, i) => cupRadius(p) + i * RingGap;
const outerRadius = (p, k) => ringRadius(p, k - 1);
// Alternate arms a little darker, so the spiral's arms show in one colour.
const shadeOf = (arm, arms) => arms <= 1 ? 1 : arms % 2 === 1 && arm === arms - 1 ? .8 : arm % 2 === 0 ? 1 : .6;
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => t <= 0 ? a : t >= 1 ? b : toHex(hex(a).map((v, i) => lerp(v, hex(b)[i], t)));
const shade = (c, k) => k === 1 ? c : toHex(hex(c).map(v => v * k));

export class Fingerprint {
  constructor(n, { beside = false } = {}) {
    this.beside = beside;
    this.n = typeof n === 'bigint' ? n : BigInt(Math.trunc(Math.abs(Number(n))));
    if (this.n < 0n) this.n = -this.n;
    this.kind = classify(this.n);
    this.groups = factor(this.n);
    this.factors = this.groups.flatMap(({ p, k }) => Array(k).fill(p));
    this.badge = { x: -.2, y: 0 };
    // the shorthand: one container per distinct prime, wearing its exponent's rings
    let x = this.badge.x + .8 + .5; this.shortX = [];
    for (const { p, k } of this.groups) { const r = outerRadius(p, k); this.shortX.push(x + r); x += 2 * r + StringGap; }
    this.shortEnd = x - StringGap;
    // the opened string: one container per factor
    x = this.badge.x + .8 + .5; this.longX = []; let topOfCups = 1;
    for (const p of this.factors) { const r = cupRadius(p); this.longX.push(x + r); x += 2 * r + StringGap; topOfCups = Math.max(topOfCups, r); }
    this.longEnd = x - StringGap;
    this.buildVolume();
    let reach = 1; for (let j = 1; j < this.count.length; j++) reach = Math.max(reach, radius(this.flatOf[j]));
    this.reach = reach; this.volumeScale = Math.min(1, VolumeCap / Math.max(1, reach));
    const scaled = reach * this.volumeScale;
    this.volumeAt = beside ? { x: this.longEnd + 1.6 + scaled, y: 0 } : { x: (this.badge.x + Math.max(this.longEnd, this.shortEnd)) * .5, y: topOfCups + 1.6 + scaled };
  }
  get phases() { return 1 + this.factors.length; }
  get unpackable() { return this.factors.length > 0 && !this.volumeTooBig; }
  buildVolume() {
    this.count = [1]; this.flatOf = [[]]; this.angleOf = [[]]; this.armsOf = [1]; this.copySpots = [null];
    const total = this.factors.reduce((a, p) => a * p, 1);
    this.volumeTooBig = total > MaxVolume || this.factors.some(p => p > BigPrime);
    if (!this.factors.length || this.volumeTooBig) return;
    const p0 = this.factors[0];
    this.count.push(p0); this.flatOf.push(containerFlat(p0)); this.armsOf.push(1); this.copySpots.push(null);
    for (let j = 1; j < this.factors.length; j++) {
      const p = this.factors[j], before = this.count[j], after = before * p;
      this.copySpots[j] = spotsFor(p, radius(this.flatOf[j]));
      // p copies wind into p arms (copy c → arm c); past thirteen the volume takes arms of its own
      const m = p <= SymmetricUpTo ? p : armsFor(after);
      this.count.push(after); this.flatOf.push(flat(after, m, false, true)); this.angleOf[j + 1] = flatAngles(after, m, false, true); this.armsOf.push(m); this.copySpots.push(null);
    }
  }
  // Draw at phase ph (0: the shorthand … 1: the opened string … 1 + m: the whole volume).
  // spin is the rings' precession in degrees. Returns SVG (y down, marble units) and bounds.
  render(ph = 0, { spin = 0, digits = false, palette } = {}) {
    const P = palette, gold = P.gold, own = P[this.kind], m = this.factors.length;
    const out = { rings: [], marbles: [], strings: [], labels: [], big: [] }, lo = { x: 1e9, y: 1e9 }, hi = { x: -1e9, y: -1e9 };
    const mark = (x, y, d) => { lo.x = Math.min(lo.x, x - d / 2); lo.y = Math.min(lo.y, y - d / 2); hi.x = Math.max(hi.x, x + d / 2); hi.y = Math.max(hi.y, y + d / 2); };
    const put = (x, y, d, color) => { if (d <= .01) return; out.marbles.push([x, y, d, color]); mark(x, y, d); };
    const cup = (x, y, r, alpha) => { if (alpha <= .01) return; out.rings.push(`<circle class="fp-cup" cx="${r3(x)}" cy="${r3(-y)}" r="${r3(r)}" fill="none" stroke="${P.ring}" stroke-width=".1" opacity="${r3(alpha)}"/>`); mark(x, y, 2 * r); };
    const label = (text, x, y, size, color, alpha = 1) => { if (!digits || alpha <= .02) return; out.labels.push(`<text x="${r3(x)}" y="${r3(-y)}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="${color}" opacity="${r3(alpha)}">${text}</text>`); mark(x, y, size); };
    put(this.badge.x, this.badge.y, 1.6, own);
    let endX;
    if (m && ph < 1) {
      // shorthand → opened: copy c of group g becomes long container (start of g) + c
      const open = ease(ph); let fi = 0;
      endX = lerp(this.shortEnd, this.longEnd, open);
      this.groups.forEach(({ p, k }, g) => {
        const cf = marblesOf(p), r = cupRadius(p), from = this.shortX[g];
        if (p > BigPrime) out.big.push([from, r, p]);
        for (let c = 0; c < k; c++) {
          // copy 0 is the container itself; copy c (≥ 1) is its c-th ring, which slides out along the
          // string, closes, shrinks onto the container's size and fills with p marbles
          const ox = lerp(from, this.longX[fi + c], open), grow = c === 0 ? 1 : open;
          for (let i = 0; i < cf.length; i++) put(ox + cf[i].x * grow, cf[i].y * grow, grow, gold);
          if (c === 0) cup(ox, 0, r, 1);
          else out.rings.push(this.exponentRing(ox, 0, lerp(ringRadius(p, c), r, open), c, k, open, spin, P, mark));
        }
        label(String(p), from, -r - .75, 1, P.gold, 1);
        if (k > 1) { const ro = outerRadius(p, k); label(String(k), from + Math.cos(.6) * (ro + .7), Math.sin(.6) * (ro + .7), .8, P.exponent || P.ring, 1 - open); }
        fi += k;
      });
    } else if (m) {
      endX = this.longEnd;
      const lv = ph - 1;
      // the opened string: container j is spent as level j opens (container 0 pours into the volume)
      for (let j = 0; j < m; j++) {
        const p = this.factors[j], ox = this.longX[j], spent = j === 0 ? ease(lv * 1.6) : ease((lv - j) * 2.8), r = cupRadius(p), cf = marblesOf(p);
        if (p > BigPrime) out.big.push([ox, r, p]);
        cup(ox, 0, r, Math.max(.25, 1 - spent));
        if (j > 0 && spent < 1 && !this.volumeTooBig) {
          // container j's marbles fly out, one to each copy of the volume, and bloom there
          const u = Math.max(0, Math.min(1, lv - j)), fly = ease(u / .3), fade = 1 - ease((u - .2) / .2), spots = this.copySpots[j], vs = this.volumeScale;
          for (let i = 0; i < p; i++) put(lerp(ox + cf[i].x, this.volumeAt.x + spots[i].x * vs, fly), lerp(cf[i].y, this.volumeAt.y + spots[i].y * vs, fly), fade * lerp(1, vs, fly), gold);
        } else if (j > 0 && (lv < j || this.volumeTooBig)) for (let i = 0; i < cf.length; i++) put(ox + cf[i].x, cf[i].y, 1, gold);
        label(String(p), ox, -r - .75, 1, P.gold, Math.max(.3, 1 - spent));
      }
      if (!this.volumeTooBig) this.renderVolume(lv, gold, own, put);
      if (!this.volumeTooBig) { const vr = radius(this.flatOf[m]) * this.volumeScale, alpha = ease((lv - (m - 1) - .5) * 2); if (this.beside) label(String(this.n), this.volumeAt.x, this.volumeAt.y + vr + 1.3, 1.6, own, alpha); else label(String(this.n), this.volumeAt.x - vr - .9 - .5 * String(this.n).length, this.volumeAt.y, 1.6, own, alpha); }
    } else endX = this.badge.x + .8;
    // the string, from the badge to the last container, behind the marbles
    if (m) out.strings.push(`<path class="fp-string" d="M${r3(this.badge.x + .8)} 0H${r3(endX + .3)}" stroke="${P.string}" stroke-width=".07" opacity=".6"/>`);
    mark(endX + .3, 0, .1);
    // a prime too big for marbles is written in its container
    for (const [x, r, p] of out.big) out.labels.push(`<text class="fp-big" x="${r3(x)}" y="0" font-size="${r3(Math.min(1.1, 2 * (r - .3) / (.62 * String(p).length)))}" text-anchor="middle" dominant-baseline="central" fill="${P.gold}">${p}</text>`);
    // marbles: one radial gradient per colour, so each reads as a lit sphere
    const fills = new Map(); let defs = '';
    const fill = c => { if (!fills.has(c)) { const id = `fp${fills.size}-${c.slice(1)}`; fills.set(c, id); defs += `<radialGradient id="${id}" cx=".36" cy=".32" r=".7"><stop offset="0" stop-color="${mix(c, '#ffffff', .55)}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, .55)}"/></radialGradient>`; } return fills.get(c); };
    const marbles = out.marbles.map(([x, y, d, c]) => `<circle cx="${r3(x)}" cy="${r3(-y)}" r="${r3(d / 2)}" fill="url(#${fill(c)})"/>`).join('');
    const body = `<defs>${defs}</defs><g class="fp-strings">${out.strings.join('')}</g><g class="fp-back">${out.rings.map(r => r.back || '').join('')}</g><g class="fp-marbles">${marbles}</g><g class="fp-rings">${out.rings.map(r => typeof r === 'string' ? r : r.front).join('')}</g><g class="fp-labels">${out.labels.join('')}</g>`;
    return { body, bounds: { x: lo.x, y: -hi.y, width: hi.x - lo.x, height: hi.y - lo.y } };
  }
  // Exponent ring i (1 … k − 1) round a container at (x, y), radius r: a circle tilted out of
  // the picture, the tilt axes fanned by half a turn over the rings. Seen flat it is an
  // ellipse, its near half bright (in front of the marbles) and its far half faint (behind).
  // close (0 … 1): the ring settles flat into the picture, a whole container ring.
  exponentRing(x, y, r, i, k, close, spin, P, mark) {
    const open = 1 - close;
    let tilt = 62; if (i >= 3) tilt += 16 * Math.sin(spin * Math.PI / 180 * 1.6 + i * 1.7);
    tilt *= open;
    const axis = (90 + 180 * (i - 1) / Math.max(1, k - 1) + spin * (i % 2 === 0 ? .5 : -.5)) * Math.PI / 180, t = tilt * Math.PI / 180;
    const ca = Math.cos(axis), sa = Math.sin(axis), ct = Math.cos(t), st = Math.sin(t);
    let near = '', far = '', prevNear = null;
    const segs = 72;
    for (let s = 0; s <= segs; s++) {
      const a = Math.PI * 2 * s / segs, px = Math.cos(a) * r, py = Math.sin(a) * r * ct, z = Math.sin(a) * r * st;
      const X = x + px * ca - py * sa, Y = y + px * sa + py * ca, isNear = z <= 0;
      const pt = `${r3(X)} ${r3(-Y)}`;
      if (isNear !== prevNear) { if (isNear) near += `M${pt}`; else far += `M${pt}`; if (prevNear !== null) { if (prevNear) near += `L${pt}`; else far += `L${pt}`; } }
      else if (isNear) near += `L${pt}`; else far += `L${pt}`;
      prevNear = isNear;
    }
    mark(x, y, 2 * r);
    const bright = lerp(.95, 1, close), faint = lerp(.34, 1, close);
    return { back: `<path class="fp-ring" d="${far}" fill="none" stroke="${P.ring}" stroke-width="${r3(lerp(.07, .1, close))}" opacity="${r3(faint)}"/>`, front: `<path class="fp-ring" d="${near}" fill="none" stroke="${P.ring}" stroke-width="${r3(lerp(.12, .1, close))}" opacity="${r3(bright)}"/>` };
  }
  // The volume at level lv: it pours in from container 0 (0 → 1); at level j it moves to copy
  // 0's spot while copies 1 … p − 1 bloom where container j's marbles landed, then the copies
  // wind into the arms of the next volume.
  renderVolume(lv, gold, own, put) {
    const m = this.factors.length, vs = this.volumeScale, V = this.volumeAt;
    const c = mix(gold, own, ease((lv - (m - 1) - .5) * 2));
    if (lv < 1) {
      const ox = this.longX[0], u = ease(lv);
      for (const s of this.flatOf[1]) put(lerp(ox + s.x, V.x + s.x * vs, u), lerp(s.y, V.y + s.y * vs, u), lerp(1, vs, u), m === 1 ? c : gold);
      return;
    }
    const level = Math.min(Math.floor(lv), m);
    if (level >= m) { const arms = this.armsOf[m]; this.flatOf[m].forEach((s, i) => put(V.x + s.x * vs, V.y + s.y * vs, vs, shade(c, shadeOf(i % arms, arms)))); return; }
    // level j: multiply the volume by p_j
    const j = level, p = this.factors[j], before = this.count[j], w = lv - j;
    const bloom = ease((w - .15) / .3), gather = ease((w - .5) / .45), toSpot = ease(w / .45);
    const armsBefore = this.armsOf[j], armsAfter = this.armsOf[j + 1], swirl = armsAfter === p, spots = this.copySpots[j];
    for (let cpy = 0; cpy < p; cpy++) {
      const grow = cpy === 0 ? 1 : bloom; if (grow <= .01) continue;
      const toward = cpy === 0 ? toSpot : 1, hx = spots[cpy].x * toward, hy = spots[cpy].y * toward, arm0 = Math.PI / 2 + Math.PI * 2 * cpy / p;
      for (let t = 0; t < before; t++) {
        const slot = t * p + cpy, start = { x: hx + this.flatOf[j][t].x * grow, y: hy + this.flatOf[j][t].y * grow }, end = this.flatOf[j + 1][slot];
        let at;
        if (swirl && gather > 0 && gather < 1) {
          // from the copy round the ring to the arm, swirling the way the arm winds
          const r1 = Math.hypot(start.x, start.y), r2 = Math.hypot(end.x, end.y);
          let a1 = Math.atan2(start.y, start.x); a1 += Math.round((arm0 - a1) / (2 * Math.PI)) * 2 * Math.PI;
          const a2 = this.angleOf[j + 1][slot], rr = lerp(r1, r2, gather), aa = lerp(a1, a2, gather);
          at = { x: Math.cos(aa) * rr, y: Math.sin(aa) * rr };
        } else at = { x: lerp(start.x, end.x, gather), y: lerp(start.y, end.y, gather) };
        const k = lerp(lerp(shadeOf(t % armsBefore, armsBefore), shadeOf(cpy, p), ease(w / .3)), shadeOf(slot % armsAfter, armsAfter), gather);
        put(V.x + at.x * vs, V.y + at.y * vs, grow * vs, shade(j === m - 1 ? mix(gold, own, gather) : gold, k));
      }
    }
  }
}
// Where p copies of a disc of radius r sit: a ring of p (copy 0 at the top), or past
// thirteen, p's own spiral.
function spotsFor(p, r) {
  const pitch = 2 * r + .7;
  if (p <= SymmetricUpTo) { const ring = p === 1 ? 0 : pitch * .5 / Math.sin(Math.PI / p); return Array.from({ length: p }, (_, c) => { const a = Math.PI / 2 + Math.PI * 2 * c / p; return { x: Math.cos(a) * ring, y: Math.sin(a) * ring }; }); }
  const f = containerFlat(p); return f.map(q => ({ x: q.x * pitch / 1.1, y: q.y * pitch / 1.1 }));
}
// A whole fingerprint as an <svg>, sized to its bounds plus a margin (marble units scaled by `unit` px).
export function fingerprintSVG(n, { ph = 0, spin = 0, digits = false, palette, unit = 14, margin = .6, className = 'fingerprint', beside = false, title = '' } = {}) {
  const f = n instanceof Fingerprint ? n : new Fingerprint(n, { beside });
  const { body, bounds: b } = f.render(ph, { spin, digits, palette });
  const x = b.x - margin, y = b.y - margin, w = b.width + 2 * margin, h = b.height + 2 * margin;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="${r3(x)} ${r3(y)} ${r3(w)} ${r3(h)}" width="${r3(w * unit)}" height="${r3(h * unit)}" role="img"${title ? ` aria-label="${title}"` : ''}>${body}</svg>`;
}
