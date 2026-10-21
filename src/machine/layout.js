// The machine's layout (design 6.3b): a pure function of the plan. It replays every scene
// of the plan once, so positions never depend on the viewport and never change while the
// plan plays; the camera (cameraAt) is the only thing that knows about the screen.
// Machine units, y down. A node's places hang off its centre; a tower stands up from its
// place, level l at y − 84·l (6·l for a coin).
export const UNITS = {block: [176, 88], socketX: {binary: 88, ternary: 88, e: 150}, pitch: 84, coin: 6,
  bulbR: 37, lane: 84, eScale: .8, eSlots: [-34, 34, 102], labelGap: 42, pillLine: 36, charW: 17,
  gutter: 48, placeCol: 56, wire: 2.5, hub: 25, bead: 9, rowGap: 36, qMinX: 264};
// Furniture that the contract leaves to the picture: IO (1.5), coin rows, perched bulbs,
// the sign lamp's ghosts and the camera's limits (4.5).
export const IO = {tip: 60, top: -66, half: 120, eye: 38, pillY: -94, pillX: 162, horizon: 100};
export const FURNITURE = {coinGap: 96, coinY: -88, perch: 30, perchScale: .7, ghosts: [[74, .7, .45], [122, .5, .2]],
  floor: -3, sliver: .718, follow: 62, pad: 24, minScale: 18 / 74, maxScale: 1.2};
const R = UNITS.bulbR;

// ---- scenes: the reference replay of 6.2 (scene.js keeps the arithmetic side's copy; the
// picture imports nothing from it, so it replays plans itself) ----
export function applyDiff(scene, diff) {
  const out = {nodes: scene.nodes, towers: scene.towers, bulbs: scene.bulbs};
  for (const key of ['nodes', 'towers', 'bulbs']) {
    const patch = diff[key]; if (!patch) continue;
    const next = {...scene[key]};
    for (const [id, p] of Object.entries(patch)) {
      if (p === null) { delete next[id]; continue; }
      next[id] = id in next ? {...next[id], ...p} : {...p};
      for (const f in p) if (p[f] === null) delete next[id][f];
    }
    out[key] = next;
  }
  return out;
}
const replays = new WeakMap();
// Every beat boundary: scenes[0] = plan.start, scenes[i + 1] = scenes[i] + beats[i].set.
export function scenesOf(plan) {
  let list = replays.get(plan);
  if (!list) {
    list = [plan.start];
    for (const beat of plan.beats) list.push(applyDiff(list.at(-1), beat.set));
    replays.set(plan, list);
  }
  return list;
}
export const sceneAt = (plan, i) => scenesOf(plan)[Math.max(0, Math.min(plan.beats.length, i))];

// ---- places, bulbs, pills ----
export function parsePlace(at) {
  let m = /^(in|io|out):(\d+)$/.exec(at);
  if (m) return {io: m[1], i: +m[2]};
  m = /^([^.]+)\.([LRCQ])(?::(\d+))?$/.exec(at);
  if (m) return {node: m[1], socket: m[2], i: m[3] === undefined ? null : +m[3]};
  throw Error(`unknown place ${at}`);
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
const floorLevel = (base, tower, bulbs) => base === 'e' && tower.form === 'tower' && !isCollapsed(tower) ? Math.min(FURNITURE.floor, ...bulbs.map(b => Math.floor(b.l))) : null;
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
  return {floor, top: Math.max(0, ...bulbs.map(b => Math.floor(b.l)))};
}
const bulbsOf = (scene, id) => Object.values(scene.bulbs).filter(b => b.t === id);

// The extent of a tower about its place at a beat boundary: bulbs, lamp ghosts, lanes, the
// digit gutter, base-e furniture, rail and dust. topEdge is what the pill stands on.
export function towerShape(base, tower, bulbs, {gutter = true} = {}) {
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

  // IO's coin rows: io:0 sits in the eye, so a single result stands in it; the rest take
  // turns right and left. in:i and out:i stand on their pills, never across the centre line.
  const ioGap = rowGap('io'), ioX = i => i === 0 ? 0 : ioGap * Math.ceil(i / 2) * (i % 2 ? 1 : -1);
  const pillRow = (key, sign) => {
    const n = rowCount(key), g = rowGap(key);
    const centre = sign * Math.max(IO.pillX, g * (n - 1) / 2 + g / 2 + 10);
    return i => centre + g * (i - (n - 1) / 2);
  };
  const inX = pillRow('in', -1), outX = pillRow('out', 1);
  const inputsText = '[' + Object.entries(plan.start.towers).filter(([, t]) => t.at.startsWith('in:')).sort((a, b) => parsePlace(a[1].at).i - parsePlace(b[1].at).i).map(([, t]) => t.text).join(', ') + ']';
  const result = plan.result || {values: [], text: ''};
  const ioPills = {
    in: {x: -IO.pillX, lines: [inputsText], w: Math.max(...[inputsText, 'Input'].map(textWidth))},
    out: {x: IO.pillX, lines: result.label ? [result.text, result.label] : [result.text], w: Math.max(...[result.text, result.label || '', 'Output'].map(textWidth))},
  };
  for (const p of Object.values(ioPills)) { p.bottom = IO.pillY + UNITS.pillLine / 2; p.top = p.bottom - UNITS.pillLine * p.lines.length; }
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
  function relPill(scene, id, digits = true) {
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
  // The place-value column stands left of a node's leftmost tower.
  const placeColumnX = (scene, id) => {
    let left = Infinity;
    for (const [tid, t] of Object.entries(scene.towers)) {
      const p = parsePlace(t.at);
      if ((id === 'io' ? p.io === 'io' : p.node === id) && !isCollapsed(t)) left = Math.min(left, placeOf(t.at).x + towerShape(base, t, bulbsOf(scene, tid)).left);
    }
    return left === Infinity ? null : left - UNITS.placeCol / 2;
  };
  // Furniture boxes: the triangle and the IO pills.
  const ioBoxes = [boxOf(-IO.half, IO.top, IO.half, IO.tip), ...Object.values(ioPills).map(p => boxOf(p.x - p.w / 2, p.top, p.x + p.w / 2, p.bottom))];
  let bounds = null;
  for (const b of ioBoxes) bounds = union(bounds, b);
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
    place: placeSlot, placeOf, pillCentre, nodeAt, nodeBox, towerBox, towerParts, pillBox, noteBox, pillLift, placeColumnX,
    wire: id => wires.get(id), ioBoxes, bounds,
  };
}

// ---- the camera (4.5): a pure function of t ----
const ease = u => 1 - (1 - u) ** 2;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const DOWNWARD = new Set(['borrow', 'unfold', 'drop', 'descend', 'zero']);
// The box a beat must show: its node, the node's towers and pills before and after, and the
// socket the node hangs from.
const frames = new WeakMap();
function beatFrame(plan, layout, k) {
  let cache = frames.get(layout);
  if (!cache) frames.set(layout, cache = new Map());
  if (!cache.has(k)) cache.set(k, frameOf(plan, layout, k));
  return cache.get(k);
}
function frameOf(plan, layout, k) {
  const scenes = scenesOf(plan);
  if (k < 0) {
    // the opening frame: IO, the inputs and the machine as built
    let box = null;
    for (const b of layout.ioBoxes) box = union(box, b);
    for (const id of Object.keys(plan.start.nodes)) if (layout.nodeAt(id)) box = union(box, layout.nodeBox(id));
    for (const id of Object.keys(plan.start.towers)) box = union(box, layout.towerBox(plan.start, id));
    return {box, centre: null, front: null};
  }
  const beat = plan.beats[k], node = beat.node, before = scenes[k], after = scenes[k + 1];
  let box = null, centre;
  const mine = at => { const p = parsePlace(at); return node === 'io' ? !!p.io : p.node === node; };
  if (node === 'io' || !layout.nodeAt(node)) { for (const b of layout.ioBoxes) box = union(box, b); centre = {x: 0, y: 0}; }
  else { box = layout.nodeBox(node); const s = layout.socketPoint(node); box = union(box, {x: s.x - 1, y: s.y - 1, w: 2, h: 2}); centre = layout.nodeAt(node); }
  let top = Infinity, bottom = -Infinity;
  // the node's towers wherever they start or end (a split sends them into its children, a
  // return up to the parent socket), and any node born or spent in the beat
  for (const id of new Set([...Object.keys(before.towers), ...Object.keys(after.towers)])) {
    if (![before, after].some(s => s.towers[id] && mine(s.towers[id].at))) continue;
    for (const scene of [before, after]) if (scene.towers[id]) box = union(box, layout.towerBox(scene, id));
  }
  for (const id of new Set([...Object.keys(before.nodes), ...Object.keys(after.nodes)])) if (!before.nodes[id] !== !after.nodes[id] && layout.nodeAt(id)) box = union(box, layout.nodeBox(id));
  // the motion front: bulbs that move or change in this beat
  for (const [id, b] of Object.entries({...before.bulbs, ...after.bulbs})) {
    const a = before.bulbs[id], z = after.bulbs[id];
    if (a && z && a.t === z.t && a.l === z.l && a.s === z.s && a.slot === z.slot && before.towers[a.t]?.at === after.towers[z.t]?.at) continue;
    for (const [scene, bb] of [[before, a], [after, z]]) if (bb && scene.towers[bb.t] && mine(scene.towers[bb.t].at)) {
      const t = scene.towers[bb.t], o = layout.placeOf(t.at), off = bulbOffset(layout.base, t, bb), y = o.y + off.y;
      top = Math.min(top, y - R * off.scale); bottom = Math.max(bottom, y + R * off.scale);
    }
  }
  return {box, centre, front: top < Infinity ? {top, bottom, down: DOWNWARD.has(beat.kind)} : null};
}
function fit(frame, W, H, {overview = false, bounds} = {}) {
  const P = FURNITURE.pad, box = overview ? bounds : frame.box;
  let s = Math.min((W - 2 * P) / box.w, (H - 2 * P) / box.h);
  if (!overview) s = Math.min(FURNITURE.maxScale, Math.max(FURNITURE.minScale, s));
  const vw = W / s, vh = H / s, pad = P / s;
  const axis = (want, lo, hi, v) => {
    const min = hi + pad - v / 2, max = lo - pad + v / 2;   // centres that keep [lo, hi] in view
    return min <= max ? Math.min(max, Math.max(min, want)) : null;
  };
  const cx0 = frame.centre ? frame.centre.x : box.x + box.w / 2, cy0 = frame.centre ? frame.centre.y - FURNITURE.follow : box.y + box.h / 2;
  const cx = axis(cx0, box.x, box.x + box.w, vw) ?? box.x + box.w / 2;
  const cy = axis(cy0, box.y, box.y + box.h, vh);
  return {s, cx, cy, vw, vh, pans: cy === null, box};
}
// cameraAt → the viewBox {x, y, w, h} in machine units for the whole viewport; inset (CSS px)
// shrinks the part the camera frames into (recording mode's caption band).
export function cameraAt(plan, layout, t, viewport, {reduced = false, inset = {}, overview = false} = {}) {
  const left = inset.left || 0, right = inset.right || 0, top = inset.top || 0, bottom = inset.bottom || 0;
  const W = Math.max(1, viewport.width - left - right), H = Math.max(1, viewport.height - top - bottom);
  const n = plan.beats.length, tt = Math.max(0, Math.min(n, t));
  const k = tt <= 0 ? -1 : Math.ceil(tt) - 1, u = tt <= 0 ? 1 : tt - k;
  const at = (j, v) => {
    const f = fit(beatFrame(plan, layout, j), W, H, {overview, bounds: layout.bounds});
    let cy = f.cy;
    if (cy === null) {
      // The frame does not fit at the smallest scale: pan, eased like the beat, from the frame's
      // foot to the top of the motion front (a carry ripple, a rising shift), or from the top
      // of the front down to the foot (a borrow, a falling light).
      const fr = beatFrame(plan, layout, j).front, half = f.vh / 2, pad = FURNITURE.pad / f.s;
      const foot = f.box.y + f.box.h + pad - half, head = f.box.y - pad + half;
      const crest = fr ? Math.min(foot, Math.max(head, fr.top - 8 + half)) : head;
      const [a, b] = fr?.down ? [crest, foot] : [foot, crest];
      cy = a + (b - a) * ease(clamp01(v));
    }
    return {s: f.s, cx: f.cx, cy, pans: f.cy === null};
  };
  const from = at(k - 1, 1), to = at(k, reduced ? 1 : u);
  // a panning beat swoops onto its path in the first tenth of the beat, then rides it
  const e = reduced ? (u >= .5 ? 1 : 0) : to.pans ? ease(clamp01(u / .1)) : ease(u);
  const s = from.s + (to.s - from.s) * e, cx = from.cx + (to.cx - from.cx) * e, cy = from.cy + (to.cy - from.cy) * e;
  // sizes round down, so the scale never drops below its floor
  const r = v => Math.round(v * 1000) / 1000, down = v => Math.floor(v * 1000) / 1000;
  return {x: r(cx - (left + W / 2) / s), y: r(cy - (top + H / 2) / s), w: down(viewport.width / s), h: down(viewport.height / s)};
}
