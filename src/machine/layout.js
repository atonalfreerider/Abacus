// The machine's layout (design 6.3b): a pure function of the plan. It replays every scene
// of the plan once, so positions never depend on the viewport and never change while the
// plan plays; the camera (cameraAt) is the only thing that knows about the screen.
// Machine units, y down. A node's places hang off its centre; a tower stands up from its
// place, level l at y − 84·l (6·l for a coin).
import { snapshotAt } from './scene.js';
export const UNITS = {block: [176, 88], socketX: {binary: 88, ternary: 88, e: 150}, pitch: 84, coin: 6,
  bulbR: 37, lane: 84, eScale: .8, eSlots: [-34, 34, 102], labelGap: 42, pillLine: 36, charW: 17,
  gutter: 48, placeCol: 56, wire: 2.5, hub: 25, bead: 9, rowGap: 36, qMinX: 264};
// Furniture that the contract leaves to the picture: IO (1.5), coin rows, perched bulbs,
// the sign lamp's ghosts and the camera's limits (4.5).
export const IO = {tip: 60, top: -66, half: 120, eye: 38, pillY: -94, pillX: 162, horizon: 100};
export const FURNITURE = {coinGap: 96, coinY: -88, perch: 30, perchScale: .7, ghosts: [[74, .7, .45], [122, .5, .2]],
  floor: -3, sliver: .718, follow: 62, pad: 24, minScale: 18 / 74, maxScale: 1.2};
const R = UNITS.bulbR;

// ---- scenes: scene.js's replay of 6.2 (diffs only, no arithmetic), so the picture and the
// mode share one set of scene objects and every cache keyed on them ----
const replays = new WeakMap();
// Every beat boundary: scenes[0] = plan.start, scenes[i + 1] = scenes[i] + beats[i].set.
export function scenesOf(plan) {
  let list = replays.get(plan);
  if (!list) replays.set(plan, list = Array.from({length: plan.beats.length + 1}, (_, i) => snapshotAt(plan, i)));
  return list;
}
export const sceneAt = (plan, i) => scenesOf(plan)[Math.max(0, Math.min(plan.beats.length, i))];
// A scene's bulbs grouped by tower, in the scene's own order. Scenes share their bulbs object
// while no bulb changes, so one index serves every scene between two bulb edits; without it
// every tower box scans every bulb (seconds for a 64-level product).
const NONE = Object.freeze([]);
const indexes = new WeakMap();
function indexOf(bulbs) {
  let index = indexes.get(bulbs);
  if (!index) {
    index = {bulbs: new Map(), ids: new Map()};
    for (const [id, b] of Object.entries(bulbs)) {
      const list = index.bulbs.get(b.t);
      if (list) { list.push(b); index.ids.get(b.t).push(id); } else { index.bulbs.set(b.t, [b]); index.ids.set(b.t, [id]); }
    }
    indexes.set(bulbs, index);
  }
  return index;
}
export const bulbsOf = (scene, id) => indexOf(scene.bulbs).bulbs.get(id) || NONE;
export const bulbIdsOf = (scene, id) => indexOf(scene.bulbs).ids.get(id) || NONE;
// A light's level along its keyframes, eased per segment (6.3).
export function pathLevel(path, u) {
  if (u <= path[0][0]) return path[0][1];
  for (let j = 0; j < path.length - 1; j++) {
    const [u0, l0] = path[j], [u1, l1] = path[j + 1];
    if (u <= u1) return u1 <= u0 ? l1 : l0 + (l1 - l0) * (1 - (1 - (u - u0) / (u1 - u0)) ** 2);
  }
  return path.at(-1)[1];
}

// ---- places, bulbs, pills ----
const parsed = new Map();
export function parsePlace(at) {
  let p = parsed.get(at);
  if (p) return p;
  let m = /^(in|io|out):(\d+)$/.exec(at);
  if (m) p = {io: m[1], i: +m[2]};
  else if ((m = /^([^.]+)\.([LRCQ])(?::(\d+))?$/.exec(at))) p = {node: m[1], socket: m[2], i: m[3] === undefined ? null : +m[3]};
  else throw Error(`unknown place ${at}`);
  parsed.set(at, Object.freeze(p));
  return p;
}
export const isCoinPlace = at => { const p = parsePlace(at); return !!p.io || p.i !== null; };
// A coin is a collapsed number; a base-e light rides the wires as an amber coin too.
export const isCollapsed = tower => tower.form === 'coin' || tower.form === 'light' && isCoinPlace(tower.at);
// A bulb's centre and scale relative to its tower's place.
export function bulbOffset(base, tower, b) {
  if (isCollapsed(tower)) return {x: 0, y: b.k === 'light' ? 0 : -UNITS.coin * b.l, scale: base === 'e' ? UNITS.eScale : 1};
  const y = -UNITS.pitch * b.l;
  if (base === 'e') {
    if (b.k === 'light' || b.slot === undefined) return {x: 0, y, scale: UNITS.eScale};
    if (b.slot <= 2) return {x: UNITS.eSlots[b.slot], y, scale: UNITS.eScale};
    // a pile's 4th and later bulbs perch above the level, overlapping like a heap of coins
    const m = Math.min(b.slot, 5) - 3;
    return {x: UNITS.eSlots[0] + FURNITURE.perch * m, y: y - UNITS.labelGap, scale: FURNITURE.perchScale};
  }
  if (b.slot === 1) return {x: -UNITS.lane, y, scale: 1};
  if (b.slot === 2) return {x: UNITS.lane, y, scale: 1};
  return {x: 0, y, scale: 1};
}
const chars = s => [...String(s ?? '')].length;
export const textWidth = s => 24 + UNITS.charW * chars(s);
// Pill lines top to bottom. The digit line shows only in the Digits view; the layout always
// reserves it (the worst case), so turning Digits on never makes anything overlap.
export function pillLines(tower, digits = true) {
  const lines = [tower.text ?? ''];
  if (tower.approx) lines.push(tower.approx);
  if (tower.reading) lines.push(tower.reading);
  if (digits && tower.digits) lines.push(tower.digits);
  return lines;
}
export const pillWidth = lines => Math.max(...lines.map(textWidth));
// Digit bulbs (not the light) of a base-e tower; a light that is unfolding a level at a time
// already holds its deposits.
const digitBulbs = bulbs => bulbs.filter(b => b.k !== 'light');
const floorLevel = (base, tower, bulbs) => base === 'e' && !isCollapsed(tower) && (tower.form === 'tower' || tower.form === 'light' && digitBulbs(bulbs).length) ? Math.min(FURNITURE.floor, ...digitBulbs(bulbs).map(b => Math.floor(b.l))) : null;
// The rail of a light: integer ticks from min(−3, ⌊h⌋) to ⌊h⌋ + 1.
export function railOf(tower, bulbs) {
  if (tower.form !== 'light' || isCollapsed(tower)) return null;
  const h = Math.max(...bulbs.filter(b => b.k === 'light').map(b => b.l), 0);
  return {from: Math.min(FURNITURE.floor, Math.floor(h)), to: Math.floor(h) + 1};
}
// Base-e furniture: two sockets and the sliver at every level from the floor to max(top, 0).
export function furnitureOf(base, tower, bulbs) {
  const floor = floorLevel(base, tower, bulbs);
  if (floor === null) return null;
  return {floor, top: Math.max(0, ...digitBulbs(bulbs).map(b => Math.floor(b.l)))};
}

// The extent of a tower about its place at a beat boundary: bulbs, lamp ghosts, lanes, the
// digit gutter, base-e furniture, rail and dust. topEdge is what the pill stands on. Shapes
// are kept per (tower, bulb list): both are shared, unchanged, from scene to scene.
const shapes = new WeakMap();
export function towerShape(base, tower, bulbs, {gutter = true} = {}) {
  let byBulbs = shapes.get(tower);
  if (!byBulbs) shapes.set(tower, byBulbs = new WeakMap());
  let pair = byBulbs.get(bulbs);
  if (!pair) byBulbs.set(bulbs, pair = {});
  const key = `${base}${gutter ? 1 : 0}`;
  return pair[key] ??= shapeOf(base, tower, bulbs, gutter);
}
function shapeOf(base, tower, bulbs, gutter) {
  const box = {left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity};
  const add = (x, y, r) => { box.left = Math.min(box.left, x - r); box.right = Math.max(box.right, x + r); box.top = Math.min(box.top, y - r); box.bottom = Math.max(box.bottom, y + r); };
  const collapsed = isCollapsed(tower);
  for (const b of bulbs) {
    const p = bulbOffset(base, tower, b);
    add(p.x, p.y, R * p.scale);
    if (b.k === 'lamp' && !collapsed) for (const [dy, s] of FURNITURE.ghosts) add(p.x, p.y - dy, R * s);
  }
  if (!bulbs.length) add(0, 0, R);
  const furniture = furnitureOf(base, tower, bulbs);
  if (furniture) for (let l = furniture.floor; l <= furniture.top; l++) { add(UNITS.eSlots[0], -UNITS.pitch * l, R * UNITS.eScale); add(UNITS.eSlots[2], -UNITS.pitch * l, R * UNITS.eScale); }
  const topEdge = box.top;
  if (gutter && tower.form === 'tower' && !collapsed) box.right = Math.max(box.right, (base === 'e' ? UNITS.eSlots[2] + R * UNITS.eScale : R) + UNITS.gutter);
  const rail = railOf(tower, bulbs);
  if (rail) { box.top = Math.min(box.top, -UNITS.pitch * rail.to - 8); box.bottom = Math.max(box.bottom, -UNITS.pitch * rail.from + 8); box.left = Math.min(box.left, -R); }
  if (tower.dust && !collapsed) box.bottom = Math.max(box.bottom, dustBox().bottom);
  return {...box, topEdge, furniture, rail};
}
// The dust haze under the floor, about the tower's place.
export const dustBox = () => ({x: 34, y: -UNITS.pitch * FURNITURE.floor + 64, rx: 92, ry: 26, bottom: -UNITS.pitch * FURNITURE.floor + 90});

// ---- the layout ----
const SOCKET_ORDER = {L: 0, C: 1, R: 2};
const union = (a, b) => a ? {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y)} : {...b};
export const intersects = (a, b, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
const boxOf = (left, top, right, bottom) => ({x: left, y: top, w: right - left, h: bottom - top});

export function layoutPlan(plan) {
  const base = plan.base, sx = UNITS.socketX[base] ?? 88, scenes = scenesOf(plan);
  const blockW = Math.max(UNITS.block[0], 2 * sx), blockH = UNITS.block[1];
  // 1. The union tree: every node of every scene (a node's parent never changes).
  const nodes = new Map();
  for (const scene of scenes) for (const [id, n] of Object.entries(scene.nodes)) if (!nodes.has(id)) nodes.set(id, {id, parent: n.parent, socket: n.socket, children: []});
  for (const n of nodes.values()) if (n.parent !== 'io' && nodes.has(n.parent)) nodes.get(n.parent).children.push(n);
  const byId = (a, b) => a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const n of nodes.values()) n.children.sort((a, b) => SOCKET_ORDER[a.socket] - SOCKET_ORDER[b.socket] || byId(a, b));
  const roots = [...nodes.values()].filter(n => n.parent === 'io' || !nodes.has(n.parent)).sort(byId);
  const depthOf = (n, d) => { n.depth = d; for (const c of n.children) depthOf(c, d + 1); };
  for (const r of roots) depthOf(r, 1);

  // 2. Everything ever shown at each place: tower shapes and pill widths, over all scenes.
  const seen = new Map();   // place → [{shape, lines, note}]
  for (const scene of scenes) for (const [id, t] of Object.entries(scene.towers)) {
    const shape = towerShape(base, t, bulbsOf(scene, id));
    if (!seen.has(t.at)) seen.set(t.at, []);
    seen.get(t.at).push({shape, width: pillWidth(pillLines(t)), lines: pillLines(t).length, note: t.note ? textWidth(t.note) : 0});
  }
  const atNode = new Map();
  for (const [at, list] of seen) { const p = parsePlace(at); if (p.node) { if (!atNode.has(p.node)) atNode.set(p.node, []); atNode.get(p.node).push({at, p, list}); } }
  // Coin rows: as many slots as are ever used, spaced so their pills never touch.
  const coinRow = (list, count) => ({count, gap: Math.max(FURNITURE.coinGap, ...list.map(e => e.width + 12))});
  const coinRows = new Map();
  for (const [at, list] of seen) {
    const p = parsePlace(at), key = p.io ? p.io : p.i !== null ? `${p.node}.C` : null;
    if (!key) continue;
    const row = coinRows.get(key) || {list: [], count: 0, tower: false};
    row.list.push(...list); row.count = Math.max(row.count, p.i + 1); row.tower ||= list.some(e => e.shape.right > 60);
    coinRows.set(key, row);
  }
  const rowGap = key => { const r = coinRows.get(key); if (!r) return FURNITURE.coinGap; const g = coinRow(r.list, r.count).gap; return key === 'io' && r.tower ? Math.max(g, 2 * R + UNITS.gutter + UNITS.placeCol + UNITS.rowGap) : g; };
  const rowCount = key => coinRows.get(key)?.count ?? 1;
  // Pills shift outward so siblings never overlap: .L keeps its right edge ≤ −14, .R its left
  // edge ≥ +14; the quotient register stands clear of every .R pill.
  const rRight = new Map();
  for (const [id, places] of atNode) {
    let right = 14;
    for (const {p, list} of places) if (p.socket === 'R' && p.i === null) for (const e of list) right = Math.max(right, Math.max(sx + e.width / 2, 14 + e.width) + (e.note ? 6 + e.note : 0));
    rRight.set(id, right);
  }
  const xQ = id => Math.max(UNITS.qMinX, (rRight.get(id) ?? 14) + 8 + R);
  const offset = (id, socket, i) => {
    if (i !== null) { const n = rowCount(`${id}.C`), g = rowGap(`${id}.C`); return {x: g * (i - (n - 1) / 2), y: FURNITURE.coinY}; }
    return {x: socket === 'L' ? -sx : socket === 'R' ? sx : socket === 'Q' ? xQ(id) : 0, y: 0};
  };
  const pillX = (id, socket, i, px, w) => {
    if (i !== null || socket === 'C') return px;
    if (socket === 'L') return Math.min(px, -14 - w / 2);
    if (socket === 'R') return Math.max(px, 14 + w / 2);
    return Math.max(px, (rRight.get(id) ?? 14) + 8 + w / 2);
  };

  // The Input and Output pills (their x is settled below, once IO's towers are known).
  const inputsText = '[' + Object.entries(plan.start.towers).filter(([, t]) => t.at.startsWith('in:')).sort((a, b) => parsePlace(a[1].at).i - parsePlace(b[1].at).i).map(([, t]) => t.text).join(', ') + ']';
  const result = plan.result || {values: [], text: ''};
  const inW = Math.max(...[inputsText, 'Input'].map(textWidth)), outW = Math.max(...[result.text, result.label || '', 'Output'].map(textWidth));
  const ioPills = {
    in: {x: -IO.pillX, lines: [inputsText], w: inW},
    out: {x: IO.pillX, lines: result.label ? [result.text, result.label] : [result.text], w: outW},
  };
  for (const p of Object.values(ioPills)) { p.bottom = IO.pillY + UNITS.pillLine / 2; p.top = p.bottom - UNITS.pillLine * p.lines.length; }
  // IO's coin rows: io:0 sits in the eye, so a single result stands in it; the rest take
  // turns right and left. in:i and out:i stand on their pills, never across the centre line.
  const ioGap = rowGap('io'), ioX = i => i === 0 ? 0 : ioGap * Math.ceil(i / 2) * (i % 2 ? 1 : -1);
  const pillRow = (key, pill, sign) => {
    const n = rowCount(key), g = rowGap(key);
    const centre = sign * Math.max(sign * pill.x, g * (n - 1) / 2 + g / 2 + 10);
    return i => centre + g * (i - (n - 1) / 2);
  };
  let inX, outX;
  const standY = pill => pill.top - 8 - R;
  // A place relative to its node's centre (IO's places are relative to IO, at the origin).
  const relPlace = at => {
    const p = parsePlace(at);
    if (p.io === 'io') return {x: ioX(p.i), y: 0};
    if (p.io === 'in') return {x: inX(p.i), y: standY(ioPills.in)};
    if (p.io === 'out') return {x: outX(p.i), y: standY(ioPills.out)};
    return offset(p.node, p.socket, p.i);
  };
  // A tower's pill relative to its node: 42 above its top bulb, centred, shifted outward at
  // .L, .R and .Q. A .C pill that would meet a sibling tower or its pill (COMP's verdict and
  // DIV's ghost stand between A and B) climbs above them; the picture draws a leader.
  // Pills are kept per scene: siblings ask for each other's, and the renderer asks every frame.
  const pills = new WeakMap();
  function relPill(scene, id, digits = true) {
    let memo = pills.get(scene);
    if (!memo) pills.set(scene, memo = new Map());
    const key = digits ? id : id + '\u0000';
    let pill = memo.get(key);
    if (!pill) memo.set(key, pill = pillOf(scene, id, digits));
    return pill;
  }
  function pillOf(scene, id, digits) {
    const t = scene.towers[id], p = parsePlace(t.at), o = relPlace(t.at), shape = towerShape(base, t, bulbsOf(scene, id));
    const lines = pillLines(t, digits), w = pillWidth(lines), h = UNITS.pillLine * lines.length;
    const cx = p.io ? o.x : pillX(p.node, p.socket, p.i, o.x, w);
    const natural = o.y + shape.topEdge - (UNITS.labelGap - R);
    let bottom = natural;
    if (p.node && p.socket === 'C' && p.i === null) {
      // siblings: their bulbs (without the shared gutter) and their pills
      const others = Object.keys(scene.towers).filter(sid => { const q = parsePlace(scene.towers[sid].at); return sid !== id && q.node === p.node && q.i === null && q.socket !== 'C'; }).flatMap(sid => {
        const so = relPlace(scene.towers[sid].at), ss = towerShape(base, scene.towers[sid], bulbsOf(scene, sid), {gutter: false});
        return [boxOf(so.x + ss.left, so.y + ss.top, so.x + ss.right, so.y + ss.bottom), relPill(scene, sid, digits)];
      });
      for (let moved = true, k = 0; moved && k <= others.length; k++) {
        moved = false;
        for (const b of others) if (cx - w / 2 < b.x + b.w && b.x < cx + w / 2 && bottom - h < b.y + b.h && b.y < bottom) { bottom = b.y - 6; moved = true; }
      }
    }
    return {x: cx - w / 2, y: bottom - h, w, h, lines, lift: bottom - natural};
  }
  const relNote = (scene, id, digits = true) => {
    const t = scene.towers[id]; if (!t.note) return null;
    const pill = relPill(scene, id, digits), w = textWidth(t.note), p = parsePlace(t.at), left = p.socket === 'L' && p.i === null ? pill.x - 6 - w : pill.x + pill.w + 6;
    return {x: left, y: pill.y + pill.h - UNITS.pillLine, w, h: UNITS.pillLine};
  };
  // The Input and Output pills stand at ∓162 while nothing is in their way, and shift outward
  // (6.3b rule 3, as .L and .R pills do) past IO's own towers wherever those reach the pills'
  // height: numbers riding in, a result standing in the eye, results beside it. They never
  // meet each other, and Input stays clear of the place values left of the eye.
  let inRight = -(R + UNITS.placeCol), outLeft = R + UNITS.gutter;
  for (const scene of scenes) for (const [id, t] of Object.entries(scene.towers)) {
    if (parsePlace(t.at).io !== 'io') continue;
    const o = relPlace(t.at), shape = towerShape(base, t, bulbsOf(scene, id));
    for (const box of [boxOf(o.x + shape.left, o.y + shape.top, o.x + shape.right, o.y + shape.bottom), relPill(scene, id), relNote(scene, id)]) {
      if (!box) continue;
      if (box.x < 0 && box.y < ioPills.in.bottom && box.y + box.h > ioPills.in.top) inRight = Math.min(inRight, box.x - 12);
      if (box.x + box.w > 0 && box.y < ioPills.out.bottom && box.y + box.h > ioPills.out.top) outLeft = Math.max(outLeft, box.x + box.w + 12);
    }
  }
  ioPills.in.x = -Math.max(IO.pillX, inW / 2 - inRight);
  ioPills.out.x = Math.max(IO.pillX, outLeft + outW / 2);
  inX = pillRow('in', ioPills.in, -1); outX = pillRow('out', ioPills.out, 1);

  // 3. Extents per node over every scene: half-width W (with the place-value column left of
  // the leftmost tower), up above the centre line and down below it.
  for (const n of nodes.values()) Object.assign(n, {W: blockW / 2, up: 44, down: 44, minLeft: Infinity});
  for (const scene of scenes) for (const [id, t] of Object.entries(scene.towers)) {
    const p = parsePlace(t.at), n = nodes.get(p.node); if (!n) continue;
    const o = relPlace(t.at), s = towerShape(base, t, bulbsOf(scene, id)), pill = relPill(scene, id), note = relNote(scene, id);
    n.minLeft = Math.min(n.minLeft, o.x + s.left);
    n.W = Math.max(n.W, -(o.x + s.left), o.x + s.right, -pill.x, pill.x + pill.w, ...(note ? [-note.x, note.x + note.w] : []));
    n.up = Math.max(n.up, -(o.y + s.top), -pill.y);
    n.down = Math.max(n.down, o.y + s.bottom);
  }
  for (const n of nodes.values()) { if (n.minLeft < Infinity) n.W = Math.max(n.W, -(n.minLeft - UNITS.placeCol)); delete n.minLeft; }
  // 4. Rows: every node at depth d shares row d.
  const rows = [];
  for (const n of nodes.values()) { const r = rows[n.depth] ||= {up: 44, down: 44}; r.up = Math.max(r.up, n.up); r.down = Math.max(r.down, n.down); }
  const rowY = [];
  for (let d = 1; d < rows.length; d++) rowY[d] = d === 1 ? IO.tip + rows[1].up + UNITS.rowGap : rowY[d - 1] + rows[d - 1].down + UNITS.rowGap + rows[d].up;
  // 5. Columns: a Reingold–Tilford tidy tree; contours are [left, right] per depth below.
  const tidy = n => {
    const kids = n.children.map(tidy);
    let acc = null; const xs = [];
    for (const k of kids) {
      let shift = 0;
      if (acc) for (let d = 0; d < Math.min(acc.length, k.contour.length); d++) shift = Math.max(shift, acc[d][1] - k.contour[d][0] + UNITS.rowGap);
      xs.push(shift);
      const moved = k.contour.map(([l, r]) => [l + shift, r + shift]);
      acc = acc ? moved.map((c, d) => d < acc.length ? [Math.min(acc[d][0], c[0]), Math.max(acc[d][1], c[1])] : c).concat(acc.slice(moved.length)) : moved;
    }
    const centre = xs.length ? (xs[0] + xs.at(-1)) / 2 : 0;
    kids.forEach((k, j) => k.dx = xs[j] - centre);
    n.kids = kids;
    return {node: n, contour: [[-n.W, n.W], ...(acc || []).map(([l, r]) => [l - centre, r - centre])]};
  };
  const place = (t, x) => { t.node.x = x; t.node.y = rowY[t.node.depth]; for (const k of t.node.kids) place(k, x + k.dx); };
  let rootX = 0, prev = null;
  for (const r of roots) {
    const t = tidy(r);
    if (prev) { let shift = 0; for (let d = 0; d < Math.min(prev.length, t.contour.length); d++) shift = Math.max(shift, prev[d][1] - t.contour[d][0] + UNITS.rowGap); rootX = shift; }
    place(t, rootX);
    prev = t.contour.map(([l, r]) => [l + rootX, r + rootX]);
  }
  for (const n of nodes.values()) delete n.kids;


  const nodeAt = id => { const n = nodes.get(id); return n ? {x: n.x, y: n.y, depth: n.depth} : null; };
  const originOf = at => { const p = parsePlace(at); if (p.io) return {x: 0, y: 0}; const n = nodes.get(p.node); if (!n) throw Error(`no node ${p.node} for ${at}`); return n; };
  function placeAt(at) { const n = originOf(at), o = relPlace(at); return {x: n.x + o.x, y: n.y + o.y}; }
  const placeMemo = new Map();
  const placeOf = at => { let v = placeMemo.get(at); if (!v) placeMemo.set(at, v = placeAt(at)); return v; };
  // place(at, slot): a lane (binary/ternary) or a base-e socket; slot omitted = the column.
  const placeSlot = (at, slot) => {
    const o = placeOf(at);
    if (slot === undefined || slot === null) return {x: o.x, y: o.y};
    if (base === 'e') return {x: o.x + (UNITS.eSlots[Math.min(slot, 2)]), y: o.y};
    return {x: o.x + (slot === 1 ? -UNITS.lane : slot === 2 ? UNITS.lane : 0), y: o.y};
  };
  // Where a pill sits for a tower of that width at that place (x of its centre).
  const pillCentre = (at, w) => {
    const p = parsePlace(at), o = placeOf(at);
    if (p.io) return o.x;
    const n = nodes.get(p.node);
    return n.x + pillX(p.node, p.socket, p.i, o.x - n.x, w);
  };
  const nodeBox = id => { const n = nodes.get(id); return boxOf(n.x - blockW / 2, n.y - blockH / 2, n.x + blockW / 2, n.y + blockH / 2); };
  const socketPoint = n => n.parent === 'io' || !nodes.has(n.parent) ? {x: 0, y: 0} : (() => { const p = nodes.get(n.parent); return {x: p.x + (n.socket === 'L' ? -sx : n.socket === 'R' ? sx : 0), y: p.y}; })();
  const wires = new Map();
  for (const n of nodes.values()) {
    const s = socketPoint(n), hub = {x: n.x, y: n.y - blockH / 2};
    if (n.parent === 'io' || !nodes.has(n.parent)) { wires.set(n.id, s.x === hub.x ? [[s.x, s.y], [hub.x, hub.y]] : [[s.x, s.y], [s.x, (s.y + hub.y) / 2], [hub.x, (s.y + hub.y) / 2], [hub.x, hub.y]]); continue; }
    const p = nodes.get(n.parent), mid = p.y + rows[p.depth].down + UNITS.rowGap / 2;
    wires.set(n.id, s.x === hub.x ? [[s.x, s.y], [hub.x, hub.y]] : [[s.x, s.y], [s.x, mid], [hub.x, mid], [hub.x, hub.y]]);
  }
  // Pills and boxes at a beat boundary.
  const shift = (box, at) => box && {...box, x: box.x + originOf(at).x, y: box.y + originOf(at).y};
  const pillBox = (scene, id, digits = true) => shift(relPill(scene, id, digits), scene.towers[id].at);
  const noteBox = (scene, id, digits = true) => shift(relNote(scene, id, digits), scene.towers[id].at);
  // How far a pill climbs (0 or less) above where it would stand on its own tower.
  const pillLift = (scene, id, digits = true) => relPill(scene, id, digits).lift;
  // gutter: false leaves out the digit gutter, which the towers of one block may share
  // A tower's parts: its bulbs and furniture, its pill and its note (a raised pill stands
  // apart from its tower, so siblings are kept apart part by part).
  function towerParts(scene, id, {gutter = true} = {}) {
    const t = scene.towers[id], shape = towerShape(base, t, bulbsOf(scene, id), {gutter}), o = placeOf(t.at);
    return [boxOf(o.x + shape.left, o.y + shape.top, o.x + shape.right, o.y + shape.bottom), pillBox(scene, id), noteBox(scene, id)].filter(Boolean);
  }
  const towerBox = (scene, id, options) => towerParts(scene, id, options).reduce(union, null);
  // Furniture boxes: the triangle and the IO pills.
  const ioBoxes = [boxOf(-IO.half, IO.top, IO.half, IO.tip), ...Object.values(ioPills).map(p => boxOf(p.x - p.w / 2, p.top, p.x + p.w / 2, p.bottom))];
  // what the camera frames of IO: the triangle, and the pills with their INPUT and OUTPUT
  // captions outside them (14 px small capitals, about 11 units a letter)
  const caption = text => 10 + 11 * text.length, [, inBox, outBox] = ioBoxes;
  const ioFrame = [ioBoxes[0], {...inBox, x: inBox.x - caption('INPUT'), w: inBox.w + caption('INPUT')}, {...outBox, w: outBox.w + caption('OUTPUT')}];
  let bounds = null;
  for (const b of ioFrame) bounds = union(bounds, b);
  for (const id of nodes.keys()) bounds = union(bounds, nodeBox(id));
  for (const scene of scenes) for (const id of Object.keys(scene.towers)) bounds = union(bounds, towerBox(scene, id));
  // a falling light can pass below its floor during a beat
  plan.beats.forEach((beat, i) => {
    for (const [id, m] of Object.entries(beat.motion || {})) {
      const b = scenes[i].bulbs[id], t = b && scenes[i].towers[b.t];
      if (!m.path || !t) continue;
      const o = placeOf(t.at);
      for (const [, l] of m.path) bounds = union(bounds, boxOf(o.x - R, o.y - UNITS.pitch * l - R, o.x + R, o.y - UNITS.pitch * l + R));
    }
  });
  const P = FURNITURE.pad;
  bounds = {x: bounds.x - P, y: bounds.y - P, w: bounds.w + 2 * P, h: bounds.h + 2 * P};
  return {
    base, socketX: sx, blockW, blockH, result, ioPills, inputsText, rows, rowY,
    nodes: [...nodes.values()].sort(byId).map(n => n.id),
    parentOf: id => nodes.get(id)?.parent, socketOf: id => nodes.get(id)?.socket,
    socketPoint: id => socketPoint(nodes.get(id)),
    place: placeSlot, placeOf, pillCentre, nodeAt, nodeBox, towerBox, towerParts, pillBox, noteBox, pillLift,
    wire: id => wires.get(id), ioBoxes, ioFrame, bounds,
  };
}

// ---- the camera (4.5): a pure function of t ----
// A camera is {lam, c: [x, y], top}: lam machine units per CSS px, c the machine point at the
// centre of the framed area, top that area's top inset in px. Every beat ends on a
// keyframe chosen so that the bulbs that moved are in view, then (when they fit) the next
// beat's movers where they start, the block, and the rest of the beat's frame. In between,
// the camera rides the movers' own bounding box: on each axis its centre is
//   lerp(lo − pad + v/2, hi + pad − v/2, ρ),
// which for ρ ∈ [0, 1] keeps the whole box in view whenever it fits, and keeps the view inside
// the box (ρ = 0 its top or left end, 1 its bottom or right end) when it does not. ρ eases
// from the start keyframe's to the end keyframe's, so a mover is never lost on the way; a
// box too big to show sweeps from one end to the other in the middle of the beat (the pan).
const ease = u => 1 - (1 - u) ** 2;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp = (a, b, e) => (1 - e) * a + e * b;
const win = (u, [a, b]) => u <= a ? 0 : u >= b ? 1 : (u - a) / (b - a);
// the pan: the near end held through the first fifth, the far end from four fifths on
const sweep = u => { const v = clamp01((u - .2) / .6); return v * v * (3 - 2 * v); };

// What a beat moves: every bulb whose drawn position changes, from where it starts to where
// it ends, with its move window and light path, placed as the renderer places it (6.3). Only
// bulbs the diff touches, or whose tower it moves, can move.
const moverCache = new WeakMap();
function beatMovers(plan, layout, k) {
  let cache = moverCache.get(layout);
  if (!cache) moverCache.set(layout, cache = []);
  if (cache[k]) return cache[k];
  const scenes = scenesOf(plan), a = scenes[k], z = scenes[k + 1], beat = plan.beats[k], motion = beat.motion || {};
  const at = (scene, b) => {
    const t = scene.towers[b.t]; if (!t) return null;
    const o = layout.placeOf(t.at), off = bulbOffset(layout.base, t, b), pitch = isCollapsed(t) ? UNITS.coin : UNITS.pitch;
    return {x: o.x + off.x, y: o.y + off.y, s: off.scale, oy: o.y, pitch, perch: off.y + pitch * (b.k === 'light' && isCollapsed(t) ? 0 : b.l)};
  };
  const ids = new Set([...Object.keys(beat.set?.bulbs || {}), ...Object.keys(motion)]);
  for (const [tid, p] of Object.entries(beat.set?.towers || {})) if (p && ('at' in p || 'form' in p)) for (const id of [...bulbIdsOf(a, tid), ...bulbIdsOf(z, tid)]) ids.add(id);
  const list = [], from = new Set(), to = new Set();
  let dx = 0, dy = 0;
  for (const id of ids) {
    const ba = a.bulbs[id], bz = z.bulbs[id], mo = motion[id] || {};
    let p0 = null, p1 = null, t0 = null, t1 = null;
    if (ba && bz) { p0 = at(a, ba); p1 = at(z, bz); t0 = ba.t; t1 = bz.t; }
    else if (ba) { p0 = at(a, ba); t0 = ba.t; p1 = mo.to ? at(z.towers[mo.to.t] ? z : a, {...mo.to, k: ba.k}) : z.towers[ba.t] ? at(z, ba) : p0; t1 = mo.to?.t ?? ba.t; }
    else if (bz) {
      p1 = at(z, bz); t1 = bz.t; t0 = mo.from?.t ?? bz.t;
      if (mo.from) p0 = at(a.towers[mo.from.t] ? a : z, {...mo.from, k: bz.k});
      else if (p1 && a.towers[bz.t]) { const oa = layout.placeOf(a.towers[bz.t].at), oz = layout.placeOf(z.towers[bz.t].at); p0 = {...p1, x: p1.x + oa.x - oz.x, y: p1.y + oa.y - oz.y, oy: oa.y}; }
      else p0 = p1;
    }
    if (!p0 || !p1 || !(mo.path || Math.hypot(p1.x - p0.x, p1.y - p0.y) >= 1)) continue;
    list.push({x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, r: UNITS.bulbR * Math.max(p0.s, p1.s), w: mo.move || [0, 1], path: mo.path || null, oy0: p0.oy, oy1: p1.oy, pitch: p1.pitch, perch0: p0.perch, perch1: p1.perch});
    dx += p1.x - p0.x; dy += p1.y - p0.y;
    from.add(t0); to.add(t1);
  }
  const out = {list, dx, dy};
  if (list.length) {
    // the movers' towers whole, pills and digit gutters too, where they start and end: in
    // between their box eases from one to the other with the bulbs (a light falling down a
    // tower that stays put keeps the whole tower in view)
    const whole = (u, scene, towers) => { let box = moversBox(out, u); for (const t of towers) if (scene.towers[t]) box = union(box, layout.towerBox(scene, t)); return box; };
    out.towers = [whole(0, a, from), whole(1, z, to)];
    out.s0 = moversBox(out, 0); out.s1 = moversBox(out, 1);
  }
  return cache[k] = out;
}
// The movers' bounding box at u, bulb rims included, and (once known) their towers'.
function moversBox({list, towers}, u) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of list) {
    const e = ease(win(u, m.w));
    const x = lerp(m.x0, m.x1, e), y = m.path && u < 1 ? lerp(m.oy0, m.oy1, e) - m.pitch * pathLevel(m.path, u) + lerp(m.perch0, m.perch1, e) : lerp(m.y0, m.y1, e);
    if (x - m.r < x0) x0 = x - m.r; if (x + m.r > x1) x1 = x + m.r;
    if (y - m.r < y0) y0 = y - m.r; if (y + m.r > y1) y1 = y + m.r;
  }
  if (towers) {
    const e = ease(u), [p, q] = towers;
    x0 = Math.min(x0, lerp(p.x, q.x, e)); y0 = Math.min(y0, lerp(p.y, q.y, e));
    x1 = Math.max(x1, lerp(p.x + p.w, q.x + q.w, e)); y1 = Math.max(y1, lerp(p.y + p.h, q.y + q.h, e));
  }
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
}
// The beat's frame: its block and the parent socket, the block's towers and pills wherever
// they start or end (a split sends them into its children, a return up to the parent), and
// any block born or spent in the beat. For IO's beats: IO and its towers.
function contextOf(plan, layout, k) {
  const scenes = scenesOf(plan);
  if (k < 0) {
    let box = null;
    for (const b of layout.ioFrame) box = union(box, b);
    for (const id of Object.keys(plan.start.towers)) box = union(box, layout.towerBox(plan.start, id));
    let all = box;
    for (const id of Object.keys(plan.start.nodes)) if (layout.nodeAt(id)) all = union(all, layout.nodeBox(id));
    return {core: box, box: all, want: null};
  }
  const beat = plan.beats[k], node = beat.node, before = scenes[k], after = scenes[k + 1];
  const mine = at => { const p = parsePlace(at); return node === 'io' ? !!p.io : p.node === node; };
  let box = null, core = null, want;
  if (node === 'io' || !layout.nodeAt(node)) { for (const b of layout.ioFrame) box = union(box, b); want = {x: 0, y: -FURNITURE.follow}; }
  else {
    const n = layout.nodeAt(node), s = layout.socketPoint(node);
    if (after.nodes[node]) core = layout.nodeBox(node);
    box = union(layout.nodeBox(node), {x: s.x - 1, y: s.y - 1, w: 2, h: 2});
    want = {x: n.x, y: n.y - FURNITURE.follow};
  }
  for (const id of new Set([...Object.keys(before.towers), ...Object.keys(after.towers)])) {
    if (![before, after].some(s => s.towers[id] && mine(s.towers[id].at))) continue;
    for (const scene of [before, after]) if (scene.towers[id]) box = union(box, layout.towerBox(scene, id));
  }
  for (const id of new Set([...Object.keys(before.nodes), ...Object.keys(after.nodes)])) if (!before.nodes[id] !== !after.nodes[id] && layout.nodeAt(id)) box = union(box, layout.nodeBox(id));
  return {core, box, want};
}

// The keyframes of every beat for one viewport and inset, computed once in order: each beat
// starts where the last one ended.
const chains = new WeakMap();
function chainOf(plan, layout, viewport, inset) {
  const hud = inset.hud && inset.hud.width > 0 && inset.hud.height > 0 ? inset.hud : null;
  const key = [viewport.width, viewport.height, inset.left || 0, inset.right || 0, inset.top || 0, inset.bottom || 0, hud?.width, hud?.height].join(' ');
  let byView = chains.get(layout);
  if (!byView) chains.set(layout, byView = new Map());
  if (byView.has(key)) return byView.get(key);
  if (byView.size >= 8) byView.delete(byView.keys().next().value);   // a resize makes many
  const G = geometry(viewport, inset);
  const P = FURNITURE.pad, lo = 1 / FURNITURE.maxScale, hi = 1 / FURNITURE.minScale, b = layout.bounds;
  const clampLam = l => Math.min(hi, Math.max(lo, l));
  const need = (box, top) => Math.max(box.w / Math.max(1, G.W - 2 * P), box.h / Math.max(1, G.H(top) - 2 * P));
  const fits = (l, h, v, p) => h - l + 2 * p <= v + 1e-9;
  const centre = (l, h, v, p, rho) => lerp(l - p + v / 2, h + p - v / 2, rho);
  const rhoOf = (c, l, h, v, p) => { const a = l - p + v / 2, z = h + p - v / 2; return Math.abs(z - a) < 1e-9 ? 0 : (c - a) / (z - a); };
  const inBounds = (c, axis) => axis ? Math.min(b.y + b.h, Math.max(b.y, c)) : Math.min(b.x + b.w, Math.max(b.x, c));
  const ext = (box, axis) => axis ? [box.y, box.y + box.h] : [box.x, box.x + box.w];
  const sizes = (lam, top) => ({v: [G.W * lam, G.H(top) * lam], p: P * lam});
  // The end of a beat at a given top inset: the largest of the nested boxes that fits is
  // framed as close to `want` as it allows, and that sets ρ against the first box. When the
  // first box does not fit, ρ is the pan's end: the far end if the beat started too big to
  // show as well (so the sweep crosses all of it), else the end the movers head for.
  const solve = (boxes, want, top, start, dir) => {
    const lam = clampLam(need(boxes.at(-1), top)), {v, p} = sizes(lam, top), first = boxes[0];
    const out = {lam, top, c: [0, 0], rho: [0, 0], slide: [false, false]};
    for (const axis of [0, 1]) {
      const [l, h] = ext(first, axis), over = !!start?.over[axis];
      out.slide[axis] = over;
      if (!fits(l, h, v[axis], p)) { out.rho[axis] = over ? (start.rho[axis] <= .5 ? 1 : 0) : dir[axis] < 0 ? 0 : 1; out.slide[axis] = true; }
      else {
        let c = null;
        for (let j = boxes.length - 1; j >= 0 && c === null; j--) {
          const [bl, bh] = ext(boxes[j], axis);
          if (fits(bl, bh, v[axis], p)) c = Math.min(bl - p + v[axis] / 2, Math.max(bh + p - v[axis] / 2, want ? (axis ? want.y : want.x) : (bl + bh) / 2));
        }
        out.rho[axis] = clamp01(rhoOf(c, l, h, v[axis], p));
      }
      out.c[axis] = inBounds(centre(l, h, v[axis], p, out.rho[axis]), axis);
    }
    return out;
  };
  // Is a box under the HUD in the corner of the viewport?
  const underHud = (box, cam) => {
    if (!hud) return false;
    const H = G.H(cam.top), X = G.left + G.W / 2 + (box.x - cam.c[0]) / cam.lam, Y = cam.top + H / 2 + (box.y - cam.c[1]) / cam.lam;
    return X < hud.width && Y < hud.height && X + box.w / cam.lam > 0 && Y + box.h / cam.lam > 0;
  };
  const end = (boxes, want, start, dir) => {
    let out = solve(boxes, want, G.top, start, dir);
    if (underHud(boxes[0], out) && hud.height > G.top) out = solve(boxes, want, hud.height, start, dir);
    return out;
  };
  // the opening frame: IO, the inputs, the machine as built (too wide to show: the Input end)
  const open = contextOf(plan, layout, -1), first = plan.beats.length ? beatMovers(plan, layout, 0) : null;
  const opening = end([open.core, ...(first?.s0 ? [union(open.core, first.s0)] : []), open.box], open.want, null, [-1, 1]);
  const keys = [{lam: opening.lam, top: opening.top, c: opening.c}], beats = [];
  for (let k = 0; k < plan.beats.length; k++) {
    const prev = keys[k], mv = beatMovers(plan, layout, k), ctx = contextOf(plan, layout, k);
    const s0 = mv.s0 || ctx.box, s1 = mv.s1 || ctx.box;
    // the start: where the last beat ended, zoomed out if the movers do not fit there, and
    // moved just enough to take them in (a box too big to show starts at its nearer end)
    let lamA = prev.lam;
    { const {v, p} = sizes(lamA, prev.top); if (![0, 1].every(axis => { const [l, h] = ext(s0, axis); return fits(l, h, v[axis], p); })) lamA = clampLam(Math.max(lamA, need(s0, prev.top))); }
    const A = {lam: lamA, top: prev.top, c: [0, 0], rho: [0, 0], over: [false, false]}, sa = sizes(lamA, prev.top);
    for (const axis of [0, 1]) {
      const [l, h] = ext(s0, axis), rel = rhoOf(prev.c[axis], l, h, sa.v[axis], sa.p);
      A.over[axis] = !fits(l, h, sa.v[axis], sa.p);
      A.rho[axis] = A.over[axis] ? (clamp01(rel) <= .5 ? 0 : 1) : clamp01(rel);
      A.c[axis] = inBounds(centre(l, h, sa.v[axis], sa.p, A.rho[axis]), axis);
    }
    const swoop = A.lam !== prev.lam || Math.abs(A.c[0] - prev.c[0]) > 1e-6 || Math.abs(A.c[1] - prev.c[1]) > 1e-6;
    // the end: these movers, then the next beat's where they start, the block, the frame
    const next = k + 1 < plan.beats.length ? beatMovers(plan, layout, k + 1).s0 : null;
    const boxes = [s1];
    if (next) boxes.push(union(boxes.at(-1), next));
    if (ctx.core) boxes.push(union(boxes.at(-1), ctx.core));
    boxes.push(union(boxes.at(-1), ctx.box));
    const K = end(boxes, ctx.want, A, [mv.dx, mv.dy]);
    keys.push({lam: K.lam, top: K.top, c: K.c});
    beats.push({A, K, swoop, mv, focus: ctx.box});
  }
  const chain = {G, keys, beats, sizes, centre, inBounds, ext};
  byView.set(key, chain);
  return chain;
}
// The framed area for a viewport and inset (CSS px); hud is a box in the top-left corner that
// the beat's movers keep clear of.
function geometry(viewport, inset) {
  const left = inset.left || 0, right = inset.right || 0, bottom = inset.bottom || 0, top = inset.top || 0;
  return {vw: viewport.width, vh: viewport.height, left, top, W: Math.max(1, viewport.width - left - right), H: t => Math.max(1, viewport.height - t - bottom)};
}
// cameraAt → the viewBox {x, y, w, h} in machine units for the whole viewport. inset (CSS px)
// shrinks the part the camera frames into (the recording band, a palette over the stage);
// inset.hud {width, height} is the DOM HUD in the top-left corner.
export function cameraAt(plan, layout, t, viewport, {reduced = false, inset = {}, overview = false} = {}) {
  const n = plan.beats.length, tt = Math.max(0, Math.min(n, t));
  let cam;
  if (overview) {
    const G = geometry(viewport, inset), P = FURNITURE.pad, b = layout.bounds;
    const lam = Math.max(b.w / Math.max(1, G.W - 2 * P), b.h / Math.max(1, G.H(G.top) - 2 * P));
    cam = {lam, top: G.top, c: [b.x + b.w / 2, b.y + b.h / 2]};
    return viewBoxOf(G, cam);
  }
  const chain = chainOf(plan, layout, viewport, inset), G = chain.G;
  if (tt <= 0) return viewBoxOf(G, chain.keys[0]);
  const k = Math.ceil(tt) - 1, u = tt - k, beat = chain.beats[k], {A, K} = beat;
  if (reduced) return viewBoxOf(G, u < .5 ? A : K);
  if (u >= 1) return viewBoxOf(G, K);
  // the path: zoom and inset ease like the beat, ρ eases (or sweeps), the box is the movers'
  const e = ease(u), lam = lerp(A.lam, K.lam, e), top = lerp(A.top, K.top, e), {v, p} = chain.sizes(lam, top);
  const box = beat.mv.list.length ? moversBox(beat.mv, u) : beat.focus;
  const c = [0, 1].map(axis => { const [l, h] = chain.ext(box, axis); return chain.inBounds(chain.centre(l, h, v[axis], p, lerp(A.rho[axis], K.rho[axis], K.slide[axis] ? sweep(u) : e)), axis); });
  cam = {lam, top, c};
  // a beat that cannot start where the last one ended glides onto its path in its first tenth
  if (beat.swoop && u < .1) {
    const prev = chain.keys[k], w = ease(u / .1);
    cam = {lam: lerp(prev.lam, lam, w), top: lerp(prev.top, top, w), c: [lerp(prev.c[0], c[0], w), lerp(prev.c[1], c[1], w)]};
  }
  return viewBoxOf(G, cam);
}
// sizes round down, so the scale never drops below its floor
function viewBoxOf(G, cam) {
  const r = v => Math.round(v * 1000) / 1000, down = v => Math.floor(v * 1000) / 1000, H = G.H(cam.top);
  return {x: r(cam.c[0] - (G.left + G.W / 2) * cam.lam), y: r(cam.c[1] - (cam.top + H / 2) * cam.lam), w: down(G.vw * cam.lam), h: down(G.vh * cam.lam)};
}
