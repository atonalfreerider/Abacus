import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutPlan, scenesOf, cameraAt, parsePlace, intersects, bulbOffset, FURNITURE, UNITS } from '../src/machine/layout.js';
import { renderMachine } from '../src/machine/render.js';
import { machineScenes } from '../src/machine/scenes.js';
import { planMachine } from '../src/machine/plan.js';

const { scenes } = await machineScenes();
const planned = (op, inputs, base = 'binary', tree = {n1: {op, parent: 'io', socket: 'C'}}) => planMachine({tree, inputs, base}).plan;
// A 20-level ADD whose carry runs the whole tower and grows it to 21 levels: 1048575 + 1.
function tallAdd(n = 20) {
  const ones = Array.from({length: n}, (_, l) => [`b${l + 1}`, {t: 't1', l, s: 1}]);
  const start = {nodes: {n1: {op: 'add', parent: 'io', socket: 'C'}}, towers: {t1: {at: 'in:0', form: 'coin', value: String(2 ** n - 1), text: String(2 ** n - 1)}, t2: {at: 'in:1', form: 'coin', value: '1', text: '1'}},
    bulbs: {...Object.fromEntries(ones), [`b${n + 1}`]: {t: 't2', l: 0, s: 1}}};
  const flow = (i, kind, node, set) => ({i, kind, node, caption: kind, ledger: {law: 'move'}, set});
  const climb = Object.fromEntries(ones.map(([id, b]) => [id, {l: b.l + 1, s: b.l === n - 1 ? 1 : 0}]));
  return {v: 1, base: 'binary', pace: 'together', tree: {n1: start.nodes.n1}, inputs: [String(2 ** n - 1), '1'], start, result: {values: [String(2 ** n)], text: `[${2 ** n}]`},
    beats: [flow(0, 'input', 'io', {towers: {t1: {at: 'io:0'}, t2: {at: 'io:1'}}}), flow(1, 'deliver', 'n1', {towers: {t1: {at: 'n1.C:0'}, t2: {at: 'n1.C:1'}}}),
      flow(2, 'fanout', 'n1', {towers: {t1: {at: 'n1.L', form: 'tower'}, t2: {at: 'n1.R', form: 'tower'}}}),
      flow(3, 'collide', 'n1', {nodes: {n1: {glyph: 0}}, towers: {t1: {at: 'n1.C', value: String(2 ** n), text: String(2 ** n)}, t2: null}, bulbs: {...climb, [`b${n + 1}`]: {t: 't1', s: 0}}}),
      flow(4, 'return', 'n1', {nodes: {n1: null}, towers: {t1: {at: 'io:0'}}}), flow(5, 'output', 'io', {towers: {t1: {at: 'out:0', form: 'coin'}}})],
    stats: {beats: 6, nodes: 1, maxLevels: n + 1, maxBulbs: n + 1}};
}
const all = [...scenes.map(s => [s.name, s.plan]), ['tall-add', tallAdd()],
  // wide pills at IO: the 6.9 perf inputs, and two results standing in IO
  ['add-4294967295-4294967295', planned('add', ['4294967295', '4294967295'])], ['divmod-9223372036854775807-3', planned('div', ['9223372036854775807', '3'])]];

test('the layout keeps towers, blocks, wires and pills apart at every beat boundary', () => {
  for (const [name, plan] of all) {
    const layout = layoutPlan(plan);
    scenesOf(plan).forEach((scene, i) => {
      const where = `${name} beat boundary ${i}`;
      const towers = Object.keys(scene.towers).map(id => ({id, at: parsePlace(scene.towers[id].at), box: layout.towerBox(scene, id), parts: layout.towerParts(scene, id, {gutter: false})}));
      // The towers of one block are kept apart part by part (bulbs, pill, note) and may share
      // their digit gutters (the renderer hides a glyph that would land on a sibling's bulb);
      // towers of different blocks keep their whole boxes apart.
      for (const [j, a] of towers.entries()) for (const b of towers.slice(j + 1)) {
        if (a.at.node && a.at.node === b.at.node) { for (const p of a.parts) for (const q of b.parts) assert.ok(!intersects(p, q), `${where}: towers ${a.id} and ${b.id} overlap`); }
        else assert.ok(!intersects(a.box, b.box), `${where}: towers ${a.id} and ${b.id} overlap`);
      }
      for (const t of towers) {
        for (const id of Object.keys(scene.nodes)) {
          if (layout.nodeAt(id) && t.at.node !== id) assert.ok(!intersects(t.box, layout.nodeBox(id)), `${where}: tower ${t.id} at ${scene.towers[t.id].at} crosses block ${id}`);
          // a tower may stand on the wire it rides: its own node's (IO's places ride the root's)
          const own = t.at.node === id || t.at.io === 'io' && layout.parentOf(id) === 'io';
          if (own) continue;
          const pts = layout.wire(id);
          for (let k = 1; k < pts.length; k++) {
            const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], seg = {x: Math.min(x0, x1) - 1.25, y: Math.min(y0, y1) - 1.25, w: Math.abs(x1 - x0) + 2.5, h: Math.abs(y1 - y0) + 2.5};
            assert.ok(!intersects(t.box, seg), `${where}: tower ${t.id} crosses the wire of ${id}`);
          }
        }
      }
      const pills = Object.keys(scene.towers).flatMap(id => [[id, layout.pillBox(scene, id)], [`${id} note`, layout.noteBox(scene, id)]]).filter(([, box]) => box);
      for (const [j, [a, pa]] of pills.entries()) for (const [b, pb] of pills.slice(j + 1)) assert.ok(!intersects(pa, pb), `${where}: pills ${a} and ${b} overlap`);
      for (const [a, pa] of pills) for (const box of layout.ioBoxes) assert.ok(!intersects(pa, box) || box === layout.ioBoxes[0] && scene.towers[a.split(' ')[0]].at.startsWith('io:'), `${where}: pill ${a} covers the IO furniture`);
      // the Input and Output pills: apart, and clear of every part of IO's own towers (a
      // tower may stand in the triangle's eye, never on a pill)
      const [, input, output] = layout.ioBoxes;
      assert.ok(!intersects(input, output), `${where}: the Input and Output pills overlap`);
      for (const t of towers) if (t.at.io === 'io') for (const part of layout.towerParts(scene, t.id)) for (const pill of [input, output]) assert.ok(!intersects(part, pill), `${where}: tower ${t.id} at ${scene.towers[t.id].at} meets an IO pill`);
    });
  }
});

test('positions are fixed for a plan\'s life and do not depend on anything but the plan', () => {
  for (const [name, plan] of all) {
    const a = layoutPlan(plan), b = layoutPlan(structuredClone(plan)), places = new Set();
    for (const scene of scenesOf(plan)) for (const t of Object.values(scene.towers)) places.add(t.at);
    for (const at of places) {
      assert.deepEqual(a.placeOf(at), b.placeOf(at), `${name}: ${at}`);
      assert.ok(Number.isFinite(a.placeOf(at).x) && Number.isFinite(a.placeOf(at).y), `${name}: ${at} is finite`);
    }
    for (const id of a.nodes) { assert.deepEqual(a.nodeAt(id), b.nodeAt(id)); assert.deepEqual(a.wire(id), b.wire(id)); }
    assert.deepEqual(a.bounds, b.bounds, name);
    // a bulb sits where its tower's place and its level say, in every scene
    for (const scene of scenesOf(plan)) for (const bulb of Object.values(scene.bulbs)) {
      const t = scene.towers[bulb.t], o = a.placeOf(t.at), off = bulbOffset(plan.base, t, bulb);
      assert.ok(Number.isFinite(o.y + off.y), `${name}: bulb in ${t.at}`);
    }
  }
});

test('rows and columns follow 6.3b: elbows through the row gap, children under their sockets in order', () => {
  const plan = scenes.find(s => s.name === 'plan-5x11-binary').plan, L = layoutPlan(plan);
  assert.deepEqual(L.nodes, ['n1', 'n2', 'n3', 'n4', 'n5']);
  assert.equal(L.nodeAt('n1').x, 0, 'the root is at x = 0');
  assert.equal(L.nodeAt('n1').y, 60 + L.rows[1].up + 36, 'y₁ = 60 + up₁ + 36');
  assert.equal(L.nodeAt('n2').y, L.nodeAt('n1').y + L.rows[1].down + 36 + L.rows[2].up);
  assert.ok(L.nodeAt('n2').x < L.nodeAt('n3').x && L.nodeAt('n4').x < L.nodeAt('n5').x, 'children in socket order');
  assert.deepEqual(L.wire('n1'), [[0, 0], [0, L.nodeAt('n1').y - 44]], 'IO drops straight to the root hub');
  const w = L.wire('n2'), mid = L.nodeAt('n1').y + L.rows[1].down + 18;
  assert.deepEqual(w, [[-88, L.nodeAt('n1').y], [-88, mid], [L.nodeAt('n2').x, mid], [L.nodeAt('n2').x, L.nodeAt('n2').y - 44]]);
  // 36 units between the contours of n2 and n3
  assert.ok(L.nodeAt('n3').x - L.nodeAt('n2').x >= 2 * 88 + 36);
  // base e: sockets at ±150
  const e = layoutPlan(scenes.find(s => s.name === 'e-measure-3').plan);
  assert.equal(e.socketX, 150);
});

test('pills shift outward; .Q stands clear of every .R pill', () => {
  for (const [name, plan] of all) {
    const L = layoutPlan(plan);
    for (const scene of scenesOf(plan)) for (const [id, t] of Object.entries(scene.towers)) {
      const p = parsePlace(t.at); if (!p.node || p.i !== null) continue;
      const box = L.pillBox(scene, id), x = L.nodeAt(p.node).x;
      if (p.socket === 'L') assert.ok(box.x + box.w <= x - 14 + 1e-9, `${name}: ${id} at .L`);
      if (p.socket === 'R') assert.ok(box.x >= x + 14 - 1e-9, `${name}: ${id} at .R`);
    }
  }
  assert.ok(UNITS.qMinX === 264);
});

test('cameraAt is pure, stays within the layout, and follows at a readable scale', () => {
  const viewports = [{width: 1280, height: 800}, {width: 390, height: 844}, {width: 844, height: 390}, {width: 540, height: 960}];
  for (const [name, plan] of all) {
    const L = layoutPlan(plan), n = plan.beats.length;
    for (const viewport of viewports) for (let k = 0; k <= 4 * n; k++) {
      const t = k / 4, cam = cameraAt(plan, L, t, viewport);
      assert.deepEqual(cameraAt(plan, L, t, viewport), cam, `${name} t ${t}: pure`);
      const scale = viewport.width / cam.w, cx = cam.x + cam.w / 2, cy = cam.y + cam.h / 2;
      assert.ok(scale >= FURNITURE.minScale - 1e-9 && scale <= FURNITURE.maxScale + 1e-4, `${name} t ${t}: scale ${scale}`);
      assert.ok(Math.abs(cam.h * scale - viewport.height) < .01, 'the viewBox keeps the viewport\'s aspect');
      // (the viewBox is rounded to 3 decimals)
      const b = L.bounds, e = 2e-3;
      assert.ok(cx >= b.x - e && cx <= b.x + b.w + e && cy >= b.y - e && cy <= b.y + b.h + e, `${name} ${viewport.width}×${viewport.height} t ${t}: centre (${cx}, ${cy}) outside the layout`);
    }
    // reduced motion cuts: a beat holds one camera until its middle, then the one it ends on
    for (let k = 0; k < n; k++) {
      const hold = cameraAt(plan, L, k + .05, viewports[0], {reduced: true});
      for (const u of [.2, .45]) assert.deepEqual(cameraAt(plan, L, k + u, viewports[0], {reduced: true}), hold, `${name} beat ${k}: before the cut`);
      for (const u of [.5, .8]) assert.deepEqual(cameraAt(plan, L, k + u, viewports[0], {reduced: true}), cameraAt(plan, L, k + 1, viewports[0]), `${name} beat ${k}: after the cut`);
    }
    // and the hold is where the beat before ended unless its movers start out of that view
    assert.deepEqual(cameraAt(plan, L, .2, viewports[0], {reduced: true}), cameraAt(plan, L, 0, viewports[0]), `${name}: the opening frame holds`);
  }
});

test('an inset frames the action in what is left of the viewport', () => {
  const plan = scenes.find(s => s.name === 'plan-5x11-binary').plan, L = layoutPlan(plan);
  const full = cameraAt(plan, L, 4, {width: 1280, height: 720}), inset = cameraAt(plan, L, 4, {width: 1280, height: 720}, {inset: {bottom: 120}});
  assert.ok(inset.w >= full.w, 'the camera pulls back for the caption band');
  const box = L.nodeBox('n2'), scale = 1280 / inset.w;
  assert.ok((box.y + box.h - inset.y) * scale <= 720 - 120 + 1e-6, 'the active block stays above the band');
});

test('a tall carry pans: every moving bulb is at least 18 px and on screen in two of five frames', () => {
  const plan = tallAdd(), L = layoutPlan(plan), scenesList = scenesOf(plan), beat = 3;
  for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}]) {
    const before = scenesList[beat], after = scenesList[beat + 1], seen = new Map();
    for (const u of [.1, .3, .5, .7, .9]) {
      const cam = cameraAt(plan, L, beat + u, viewport), scale = viewport.width / cam.w;
      assert.ok(2 * UNITS.bulbR * scale >= 18 - 1e-9, 'bulbs at least 18 px across');
      for (const [id, b] of Object.entries(after.bulbs)) {
        const a = before.bulbs[id]; if (!a || a.l === b.l && a.t === b.t) continue;
        const pa = L.placeOf(before.towers[a.t].at), pz = L.placeOf(after.towers[b.t].at), e = 1 - (1 - u) ** 2;
        const x = pa.x + (pz.x - pa.x) * e, y = pa.y - 84 * a.l + (pz.y - 84 * b.l - (pa.y - 84 * a.l)) * e;
        if (x >= cam.x && x <= cam.x + cam.w && y >= cam.y && y <= cam.y + cam.h) seen.set(id, (seen.get(id) || 0) + 1);
      }
    }
    for (const id of Object.keys(after.bulbs)) if (before.bulbs[id] && before.bulbs[id].l !== after.bulbs[id].l) assert.ok((seen.get(id) || 0) >= 2, `${viewport.width}×${viewport.height}: ${id} on screen in ${seen.get(id) || 0} frames`);
  }
});

// Browser check 6 (6.9), in Node: the stage the app gives the camera on a 390×844 and an
// 844×390 phone (measured in headless Chrome), the rendered bulbs mapped through the viewBox.
// Every moving bulb is on stage and at least 18 px across at u .1, .5 and .9 of its beat for
// [16,7] in both bases, and in at least 2 of 5 frames for the 21-level [1048575,1].
const PHONES = [{width: 374, height: 614}, {width: 568, height: 322}];
function moversOnStage(plan, viewport, us, inset = {}) {
  const L = layoutPlan(plan), list = scenesOf(plan), ease = u => 1 - (1 - u) ** 2, out = [];
  const at = (scene, b) => { const t = scene.towers[b.t]; if (!t) return null; const p = L.place(t.at, b.slot); return {x: p.x, y: p.y - (t.form === 'coin' ? 6 : 84) * b.l, tower: t.form !== 'coin'}; };
  plan.beats.forEach((beat, i) => {
    const a = list[i], z = list[i + 1], m = beat.motion || {}, moving = [];
    for (const id of new Set([...Object.keys(a.bulbs), ...Object.keys(z.bulbs)])) {
      const A = a.bulbs[id], B = z.bulbs[id]; let p0 = null, p1 = null;
      if (A && B) { p0 = at(a, A); p1 = at(z, B); } else if (A && m[id]?.to) { p0 = at(a, A); p1 = at(z, m[id].to); } else if (B && m[id]?.from) { p0 = at(a, m[id].from); p1 = at(z, B); }
      if (p0 && p1 && (p0.tower || p1.tower) && Math.hypot(p1.x - p0.x, p1.y - p0.y) >= 1) moving.push([id, p0, p1]);
    }
    if (!moving.length) return;
    const seen = new Map(moving.map(([id]) => [id, 0]));
    for (const u of us) {
      const {svg, viewBox} = renderMachine(plan, i + u, L, undefined, {viewport, inset}), [x0, y0, w] = viewBox.split(' ').map(Number), s = viewport.width / w;
      const drawn = new Map([...svg.matchAll(/data-(?:b|was)="([^"]+)"[^>]*transform="translate\(([^ ]+) ([^)]+)\)/g)].map(q => [q[1], [+q[2], +q[3]]]));
      const on = (x, y) => { const X = (x - x0) * s, Y = (y - y0) * s; return X >= 0 && X <= viewport.width && Y >= 0 && Y <= viewport.height; };
      for (const [id, p0, p1] of moving) {
        const k = ease(u), d = drawn.get(id);
        if (74 * s >= 18 - 1e-9 && on(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k) && (!d || on(...d))) seen.set(id, seen.get(id) + 1);
      }
    }
    out.push({i, kind: beat.kind, least: Math.min(...seen.values())});
  });
  return out;
}
test('phones: every moving bulb of [16,7] and [1048575,1] stays on stage at a readable size (check 6)', () => {
  for (const viewport of PHONES) for (const inset of [{}, {hud: {width: 160, height: 70}}]) {
    const where = `${viewport.width}×${viewport.height}${inset.hud ? ' with the HUD' : ''}`;
    for (const base of ['binary', 'ternary']) for (const b of moversOnStage(planned('mul', ['16', '7'], base), viewport, [.1, .5, .9], inset)) assert.equal(b.least, 3, `${where} ${base} [16,7] beat ${b.i} (${b.kind})`);
    const tall = moversOnStage(planned('add', ['1048575', '1']), viewport, [.1, .3, .5, .7, .9], inset);
    assert.ok(tall.some(b => b.kind === 'return'), 'the return beat is checked');
    for (const b of tall) assert.ok(b.least >= 2, `${where} [1048575,1] beat ${b.i} (${b.kind}): a mover on stage in ${b.least} of 5 frames`);
  }
});

test('the HUD: the opening frame and every beat\'s movers keep clear of the corner it covers', () => {
  const plan = planned('mul', ['16', '7']), L = layoutPlan(plan), viewport = PHONES[0], hud = {width: 160, height: 70};
  const list = scenesOf(plan);
  for (let k = 0; k <= plan.beats.length; k++) {
    const cam = cameraAt(plan, L, k, viewport, {inset: {hud}}), s = viewport.width / cam.w;
    // the towers that rest at the end of the beat, by their boxes (bulbs and pills)
    const scene = list[k], ids = k ? [...new Set(Object.keys(plan.beats[k - 1].set.bulbs || {}))].map(id => scene.bulbs[id]?.t).filter(Boolean) : Object.keys(scene.towers);
    for (const id of new Set(ids)) {
      const box = L.towerBox(scene, id), X = (box.x - cam.x) * s, Y = (box.y - cam.y) * s;
      assert.ok(!(X < hud.width && Y < hud.height && X + box.w * s > 0 && Y + box.h * s > 0) || k > 0 && box.h * s > viewport.height - hud.height - 2 * FURNITURE.pad, `boundary ${k}: tower ${id} under the HUD`);
    }
  }
});

test('an empty machine and a machine without inputs lay out', () => {
  const empty = {v: 1, base: 'binary', pace: 'together', tree: {}, inputs: [], start: {nodes: {}, towers: {}, bulbs: {}}, beats: [], result: {values: [], text: ''}};
  const L = layoutPlan(empty);
  assert.deepEqual(L.nodes, []);
  assert.ok(L.bounds.w > 0 && L.bounds.h > 0);
  assert.ok(Number.isFinite(cameraAt(empty, L, 0, {width: 800, height: 600}).x));
  const built = {...empty, tree: {n1: {op: 'div', parent: 'io', socket: 'C'}, n2: {op: 'sub', parent: 'n1', socket: 'R'}}, start: {nodes: {n1: {op: 'div', parent: 'io', socket: 'C'}, n2: {op: 'sub', parent: 'n1', socket: 'R'}}, towers: {}, bulbs: {}}};
  const B = layoutPlan(built);
  assert.deepEqual(B.nodes, ['n1', 'n2']);
  assert.ok(B.nodeAt('n2').y > B.nodeAt('n1').y && B.nodeAt('n2').x > B.nodeAt('n1').x - 1e-9);
});
