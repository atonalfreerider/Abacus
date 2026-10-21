// Where the marbles of the counting language sit, in marble diameters (1 = one marble
// across), about their centre: a symmetric spiral. A centre marble (for odd counts) and m
// arms that wind out together, an m-start spiral, each arm turned τ/m from the last; small
// counts are rings (a pair, a triangle, a pentagon), 7 is a centre and six round it.
// Marbles are listed from the centre out: the centre (if any), then ring t holds marble t
// of every arm, at index t·m + a. So when p copies of a disc merge into p arms, copy c's
// marble t goes to index t·p + c: the copy becomes arm c.
// A port of MarbleLayout.cs (flat layouts) from the riemann-zeta-visualization games.
export const Gap = 1.1, ArmGap = 1.22, VolumeArmGap = 1.5;
const Tol = .03;
const flatCache = new Map(), angleCache = new Map();
export const ringRadius = m => m <= 1 ? 0 : Gap * .5 / Math.sin(Math.PI / m);
// m for n marbles in m equal arms: six, five, eight, seven or three if they divide n, then
// nine to thirteen; four only for long arms (four short bent arms look like a hooked cross);
// else two, else one.
export function armsFor(n) {
  for (const m of [6, 5, 8, 7, 3, 9, 10, 11, 12, 13]) if (n % m === 0) return m;
  if (n % 4 === 0 && n / 4 >= 7) return 4;
  return n % 2 === 0 ? 2 : 1;
}
// A container's shape for p marbles: up to six, a ring of p; an odd count, a centre and
// m arms of (p − 1)/m; an even one, m arms of p/m.
export function shapeOf(count) {
  if (count <= 1) return { center: true, arms: 1 };
  if (count <= 6) return { center: false, arms: count };
  if (count % 2 === 1) return { center: true, arms: armsFor(count - 1) };
  return { center: false, arms: armsFor(count) };
}
class Grid {
  constructor(cell) { this.cell = cell; this.cells = new Map(); }
  key(x, y) { return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`; }
  add(p) { const k = this.key(p.x, p.y); if (!this.cells.has(k)) this.cells.set(k, []); this.cells.get(k).push(p); }
  clear(p, d) {
    const cx = Math.floor(p.x / this.cell), cy = Math.floor(p.y / this.cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of this.cells.get(`${cx + i},${cy + j}`) || []) if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 < d * d) return false;
    return true;
  }
}
// count marbles in an m-start spiral, with a centre marble or not; adjacent arms ArmGap
// apart, or VolumeArmGap for a wide (volume) spiral. Returns [{x, y}] (y up).
export function flat(count, m, center, wide = false) {
  m = Math.max(1, m);
  const key = `${count},${m},${center},${wide}`;
  if (flatCache.has(key)) return flatCache.get(key);
  const pts = [], angles = [];
  if (center && count > 0) { pts.push({ x: 0, y: 0 }); angles.push(Math.PI / 2); }
  const q = Math.floor((count - pts.length) / m);
  const b = m * (wide ? VolumeArmGap : ArmGap) / (Math.PI * 2);   // radius gained per radian
  const r0 = Math.max(ringRadius(m), center ? Gap : 0, m === 1 ? .5 * Gap : 0);
  const grid = new Grid(Gap); for (const p of pts) grid.add(p);
  let phi = 0, last = { x: 0, y: 0 };
  for (let t = 0; t < q; t++) {
    let rr, at;
    for (;;) {
      // walk out along arm 0 until a gap from its last marble and clear of everything placed
      rr = r0 + b * phi;
      at = { x: rr * Math.cos(Math.PI / 2 + phi), y: rr * Math.sin(Math.PI / 2 + phi) };
      if (t === 0 || ((at.x - last.x) ** 2 + (at.y - last.y) ** 2 >= Gap * Gap && grid.clear(at, Gap - Tol))) break;
      phi += .004;
    }
    last = at;
    const a0 = Math.PI / 2 + phi;
    for (let a = 0; a < m; a++) {
      const ang = a0 + Math.PI * 2 * a / m, p = { x: rr * Math.cos(ang), y: rr * Math.sin(ang) };
      pts.push(p); angles.push(ang); grid.add(p);
    }
  }
  // a count that is not centre + m·q still gets every marble: the rest on a ring outside
  const extra = count - pts.length, rx = (pts.length ? radius(pts) : 0) + Gap;
  for (let i = 0; i < extra; i++) { const ang = Math.PI / 2 + Math.PI * 2 * i / extra; pts.push({ x: rx * Math.cos(ang), y: rx * Math.sin(ang) }); angles.push(ang); }
  flatCache.set(key, pts); angleCache.set(key, angles);
  return pts;
}
// Each marble's angle about the centre, unwrapped along its arm: so a marble can swirl
// into its place the way the arm winds.
export function flatAngles(count, m, center, wide = false) {
  m = Math.max(1, m); const key = `${count},${m},${center},${wide}`;
  if (!angleCache.has(key)) flat(count, m, center, wide);
  return angleCache.get(key);
}
export function radius(pts) { let r = 0; for (const p of pts) r = Math.max(r, Math.hypot(p.x, p.y)); return r + .5; }
// A lone count (a container of p): its symmetric shape.
export const containerFlat = p => { const { center, arms } = shapeOf(p); return flat(p, arms, center); };
