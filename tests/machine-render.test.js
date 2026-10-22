import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { renderMachine, renderStatic, machineDefs, blockGlyphSVG, easeOut } from '../src/machine/render.js';
import { layoutPlan, scenesOf, sceneAt, cameraAt } from '../src/machine/layout.js';
import { machineScenes, E_FIXTURES, FIXTURES } from '../src/machine/scenes.js';
import { planMachine } from '../src/machine/plan.js';
import { bulb, socket } from '../src/mvc/view.js';
import { styles, setStyle, ink } from '../src/mvc/theme.js';

// This file keeps well inside the 30 s the machine tests share (6.9): the fixtures, goldens
// and hand-made plans are swept densely; the planner's and base e's many longer plans more
// lightly, with every beat boundary still checked exactly.
const started = performance.now();

// Hand-made plans for the renderer's tests: each exercises picture features the full-plan
// fixtures do not (the sign lamp, owed bulbs and a borrow, the quotient register with scan and
// verdict marks, a ghost tower, notes, a base-e pile with perched bulbs and a badge, a fold).
// They follow the shared formats of 6.2 but are not planner output; the planner's own plans
// replace them as named scenes once it lands.
const flow = (kind, node, set, extra = {}) => ({kind, node, caption: kind, ledger: {law: 'move'}, set, ...extra});
const finish = (base, tree, start, beats, result) => ({v: 1, base, pace: 'together', tree, inputs: [], start, beats: beats.map((b, i) => ({i, ...b})), result, stats: {beats: beats.length, nodes: Object.keys(tree).length, maxLevels: 0, maxBulbs: 0}});

// NOT 5: 101 flips to 010 under a lit (red) lamp at level 3: −6.
const notLamp = finish('binary', {n1: {op: 'not', parent: 'io', socket: 'C'}},
  {nodes: {n1: {op: 'not', parent: 'io', socket: 'C'}}, towers: {t1: {at: 'in:0', form: 'coin', value: '5', text: '5', digits: '101₂'}},
    bulbs: {b1: {t: 't1', l: 0, s: 1}, b2: {t: 't1', l: 1, s: 0}, b3: {t: 't1', l: 2, s: 1}}},
  [flow('input', 'io', {towers: {t1: {at: 'io:0'}}}), flow('deliver', 'n1', {towers: {t1: {at: 'n1.C:0'}}}), flow('fanout', 'n1', {towers: {t1: {at: 'n1.C', form: 'tower'}}}),
    flow('flip', 'n1', {nodes: {n1: {glyph: 0}}, towers: {t1: {value: '-6', text: '−6', digits: '…1010₂'}}, bulbs: {b1: {s: 0}, b2: {s: 1}, b3: {s: 0}, b4: {t: 't1', l: 3, s: -1, k: 'lamp'}}}, {ledger: {law: 'gate', op: 'not', a: '5', out: '-6'}}),
    flow('return', 'n1', {nodes: {n1: null}, towers: {t1: {at: 'io:0'}}}), flow('output', 'io', {towers: {t1: {at: 'out:0', form: 'coin'}}})],
  {values: ['-6'], text: '[−6]'});

// 12 + (−5): L0 is owed, L2 bursts, then the donor at L3 borrows down to L0: 111 = 7.
const owedBorrow = finish('binary', {n1: {op: 'add', parent: 'io', socket: 'C'}},
  {nodes: {n1: {op: 'add', parent: 'io', socket: 'C'}}, towers: {t1: {at: 'n1.L', form: 'tower', value: '12', text: '12', digits: '1100₂'}, t2: {at: 'n1.R', form: 'tower', value: '-5', text: '−5', digits: '−101₂'}},
    bulbs: {b1: {t: 't1', l: 0, s: 0}, b2: {t: 't1', l: 1, s: 0}, b3: {t: 't1', l: 2, s: 1}, b4: {t: 't1', l: 3, s: 1}, b5: {t: 't2', l: 0, s: -1}, b6: {t: 't2', l: 1, s: 0}, b7: {t: 't2', l: 2, s: -1}}},
  [flow('collide', 'n1', {nodes: {n1: {glyph: 0}}, towers: {t1: {at: 'n1.C', value: '7', text: '7', digits: '111₂'}, t2: null}, bulbs: {b1: null, b3: {s: 0}, b5: {t: 't1', o: 1}, b6: null, b7: null}},
    {motion: {b1: {fade: [.3, 1]}, b6: {to: {t: 't1', l: 1}}, b7: {to: {t: 't1', l: 2}, burst: true}, b3: {state: [.6, 1]}}}),
   flow('borrow', 'n1', {bulbs: {b4: {l: 0}, b5: null, b3: {s: 1}, b2: {s: 1}}},
    {motion: {b4: {move: [0, .8]}, b3: {state: [.15, .35]}, b2: {state: [.4, .6]}, b5: {fade: [.8, 1], burst: true}}})],
  {values: ['7'], text: '[7]'});

// A division in progress: the remainder at .L, the trial divisor at .R with a note, the
// quotient register at .Q; COMPARE scans and flashes its verdict, then a ghost tries.
const divMarks = finish('ternary', {n1: {op: 'div', parent: 'io', socket: 'C'}},
  {nodes: {n1: {op: 'div', parent: 'io', socket: 'C'}}, towers: {
      t1: {at: 'n1.L', form: 'tower', value: '19', text: '19', digits: '1T01 bal₃'},
      t2: {at: 'n1.R', form: 'tower', value: '15', text: '15', digits: '1TT0 bal₃', note: '×3¹'},
      t3: {at: 'n1.Q', form: 'tower', value: '0', text: 'q', digits: '00 bal₃'}},
    bulbs: {b1: {t: 't1', l: 0, s: 1}, b2: {t: 't1', l: 1, s: 0}, b3: {t: 't1', l: 2, s: -1}, b4: {t: 't1', l: 3, s: 1},
      b5: {t: 't2', l: 0, s: 0}, b6: {t: 't2', l: 1, s: -1}, b7: {t: 't2', l: 2, s: -1}, b8: {t: 't2', l: 3, s: 1}, b9: {t: 't3', l: 0, s: 0}, b10: {t: 't3', l: 1, s: 0}}},
  [flow('compare', 'n1', {}, {marks: [{k: 'scan', node: 'n1', from: 3, stop: 1}, {k: 'verdict', node: 'n1', s: 1}]}),
   flow('try', 'n1', {towers: {t4: {at: 'n1.C', form: 'tower', value: '4', text: '4', digits: '11 bal₃', ghost: true}}, bulbs: {b11: {t: 't4', l: 0, s: 1}, b12: {t: 't4', l: 1, s: 1}}},
    {motion: {b11: {from: {t: 't1', l: 0}}, b12: {from: {t: 't1', l: 1}}}}),
   flow('judge', 'n1', {towers: {t1: {value: '4', text: '4', digits: '11 bal₃'}, t4: null, t3: {value: '3', text: 'q 1', digits: '10 bal₃'}}, bulbs: {b3: null, b4: null, b1: null, b2: null, b11: {t: 't1'}, b12: {t: 't1'}, b10: {s: 1}}},
    {motion: {b3: {fade: [0, .6]}, b4: {fade: [0, .6]}, b1: {fade: [0, .6]}, b2: {fade: [0, .6]}}, marks: [{k: 'ring', t: 't3', l: 1}]})],
  {values: ['3', '4'], text: '[3, 4]', label: 'q 3 · r 4'});

// Base e: two towers pile into one (four bulbs at level 0, one perched; eight at level 1,
// shown with a badge), then the pile folds into one light on its rail.
const ePile = finish('e', {n1: {op: 'add', parent: 'io', socket: 'C'}},
  {nodes: {n1: {op: 'add', parent: 'io', socket: 'C'}}, towers: {
      t1: {at: 'n1.L', form: 'tower', value: '2e+2', text: '2e + 2', approx: '≈ 7.437', digits: '22ₑ'},
      t2: {at: 'n1.R', form: 'tower', value: '2e+2', text: '2e + 2', approx: '≈ 7.437', digits: '22ₑ', dust: true}},
    bulbs: {b1: {t: 't1', l: 0, s: 1, slot: 0}, b2: {t: 't1', l: 0, s: 1, slot: 1}, b3: {t: 't1', l: 1, s: 1, slot: 0}, b4: {t: 't1', l: 1, s: 1, slot: 1},
      b5: {t: 't2', l: 0, s: 1, slot: 0}, b6: {t: 't2', l: 0, s: 1, slot: 1}, b7: {t: 't2', l: 1, s: 1, slot: 0}, b8: {t: 't2', l: 1, s: 1, slot: 1}}},
  [flow('pile', 'n1', {nodes: {n1: {glyph: 0}}, towers: {t1: {at: 'n1.C', value: '4e+4', text: '2e + 2 + 2e + 2', approx: '≈ 14.87', digits: null, pile: true, dust: true}, t2: null},
      bulbs: {b5: {t: 't1', slot: 2}, b6: {t: 't1', slot: 3}, b7: {t: 't1', slot: 2}, b8: {t: 't1', slot: 3}, b9: {t: 't1', l: 1, s: 1, slot: 4}, b10: {t: 't1', l: 1, s: 1, slot: 5}, b11: {t: 't1', l: 1, s: 1, slot: 6}, b12: {t: 't1', l: 1, s: 1, slot: 7}}}),
   flow('fold', 'n1', {towers: {t1: {form: 'light', text: '4e + 4', reading: 'ln(4e + 4) ≈ 2.6995', pile: null, dust: null}},
      bulbs: {b1: null, b2: null, b3: null, b4: null, b5: null, b6: null, b7: null, b8: null, b9: null, b10: null, b11: null, b12: null, b13: {t: 't1', l: 2.6995, s: 1, k: 'light'}}},
    {motion: {b13: {from: {t: 't1', l: 1}}, ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(k => [`b${k}`, {to: {t: 't1', l: 2.6995}, fade: [.4, 1]}]))}}),
   // a level at a time: the light leaves its deposit at level 2 and rests lower on a shorter rail
   flow('unfold', 'n1', {towers: {t1: {pending: true, reading: '≈ 1.09 bulbs’ worth at e¹'}}, bulbs: {b13: {l: 1.0384}, b14: {t: 't1', l: 2, s: 1, slot: 0}}},
    {motion: {b13: {path: [[0, 2.6995], [.9, 1.0384]]}, b14: {in: [.2, .28], grow: true}}})],
  {values: ['4e+4'], text: '[4e + 4]'});

const SYNTHETIC = {notLamp, owedBorrow, divMarks, ePile};

const { scenes } = await machineScenes();
const plans = [...scenes.map(s => [s.name, s.plan]), ...Object.entries(SYNTHETIC)];
// dense: fixtures, goldens, hand-made plans; light: planner and base-e scenes
const light = new Set(scenes.filter(s => s.source === 'planner' || s.source === 'e-fixture').map(s => s.name));
const fixture = name => scenes.find(s => s.name === name).plan;
const VIEWS = [{}, {digits: true}, {motion: 'reduced'}, {digits: true, motion: 'reduced'}];
// The first element that names an attribute twice: HTML keeps the first, XML (an <img>, a
// standalone frame) refuses the whole picture.
const repeated = svg => {
  for (const [tag, attrs] of svg.matchAll(/<[\w-]+((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
    const names = [...attrs.matchAll(/\s([\w:-]+)=/g)].map(m => m[1]);
    if (new Set(names).size !== names.length) return tag;
  }
  return null;
};
// Every <g data-b> in a frame: id, state shown, level, position and opacity.
const bulbsIn = svg => [...svg.matchAll(/<g class="mb" data-b="([^"]+)" data-s="(-?\d)" data-l="([^"]+)" data-t="[^"]*" transform="translate\(([^ ]+) ([^)]+)\)[^"]*"(?: opacity="([^"]+)")?>/g)]
  .map(m => ({id: m[1], s: +m[2], l: +m[3], x: +m[4], y: +m[5], o: m[6] === undefined ? 1 : +m[6]}));

test('frames are pure and finite, in both styles, at every eighth of every beat (every quarter for planner scenes)', () => {
  for (const [name, plan] of plans) {
    const layout = layoutPlan(plan), n = plan.beats.length, steps = light.has(name) ? 4 : 8;
    const views = light.has(name) ? [{digits: true}, {motion: 'reduced'}] : VIEWS;
    for (const palette of [styles.sketchpad, styles.cyber]) for (const view of views) for (let k = 0; k <= steps * n; k++) {
      const t = k / steps, a = renderMachine(plan, t, layout, palette, view);
      assert.deepEqual(renderMachine(plan, t, layout, palette, view), a, `${name} t ${t}: pure`);
      assert.doesNotMatch(a.svg, /NaN|undefined|Infinity|\[object/, `${name} t ${t} ${JSON.stringify(view)}`);
      // (structure, not colour: one palette, the Digits view in full motion)
      if (palette === styles.cyber && view.digits && !view.motion) assert.equal(repeated(a.svg), null, `${name} t ${t}: an attribute twice`);
      assert.match(a.viewBox, /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/);
    }
  }
});

test('the beat-boundary property: the frame at integer t = i is the static drawing of scene i', async () => {
  let reference = null;
  try { reference = await import('../src/machine/scene.js'); } catch {}
  for (const [name, plan] of plans) {
    const layout = layoutPlan(plan), list = scenesOf(plan);
    for (let i = 0; i <= plan.beats.length; i++) {
      if (reference) assert.deepEqual(reference.snapshotAt(plan, i), list[i], `${name}: scene ${i} replays as scene.js does`);
      const views = light.has(name) ? [{}, {digits: true, active: plan.beats[Math.max(0, i - 1)]?.node}, {motion: 'reduced'}] : [...VIEWS, {digits: true, active: plan.beats[Math.max(0, i - 1)]?.node}, {highlight: 'n1', selected: 'n1.L'}];
      for (const palette of [styles.sketchpad, styles.cyber]) for (const view of views)
        assert.equal(renderMachine(plan, i, layout, palette, view).svg, renderStatic(sceneAt(plan, i), layout, palette, view), `${name}: boundary ${i} ${JSON.stringify(view)}`);
    }
    assert.equal(renderMachine(plan, 0, layout).svg, renderStatic(plan.start, layout), `${name}: t = 0 is the start`);
  }
});

test('each live bulb is drawn once, and every bulb of the scene is drawn at the boundary', () => {
  for (const [name, plan] of plans) {
    const layout = layoutPlan(plan), list = scenesOf(plan), steps = light.has(name) ? 4 : 10;
    for (let k = 0; k <= steps * plan.beats.length; k++) {
      const t = k / steps, drawn = bulbsIn(renderMachine(plan, t, layout).svg), ids = drawn.map(b => b.id);
      assert.equal(new Set(ids).size, ids.length, `${name} t ${t}: a bulb drawn twice`);
      if (Number.isInteger(t)) assert.deepEqual(new Set(ids), new Set(Object.keys(list[t].bulbs)), `${name} boundary ${t}`);
    }
  }
});

test('a climbing carry is lit in flight: never dark between u 0.3 and 0.6', () => {
  let checked = 0;
  for (const [name, plan] of plans) {
    const layout = layoutPlan(plan), list = scenesOf(plan);
    plan.beats.forEach((beat, i) => {
      if (!['collide', 'carry', 'gate', 'addone'].includes(beat.kind)) return;
      const before = list[i], after = list[i + 1];
      const climbers = Object.keys(before.bulbs).filter(id => {
        const a = before.bulbs[id], z = after.bulbs[id], to = beat.motion?.[id]?.to;
        return z ? z.l === a.l + 1 : to && to.l === a.l + 1;
      });
      for (const u of [.3, .4, .5, .6]) {
        const drawn = new Map(bulbsIn(renderMachine(plan, i + u, layout).svg).map(b => [b.id, b]));
        for (const id of climbers) { assert.notEqual(drawn.get(id)?.s, 0, `${name} beat ${i} u ${u}: ${id} climbs dark`); checked++; }
      }
    });
  }
  assert.ok(checked > 20, 'climbers were checked (13 + 3, 10 + (−5), 5 × 11, level pace)');
});

test('UNFOLD: every deposit is born within 0.05 level of the falling light', () => {
  const plan = fixture('e-measure-3'), layout = layoutPlan(plan), i = plan.beats.findIndex(b => b.kind === 'unfold'), beat = plan.beats[i];
  const born = Object.entries(beat.motion).filter(([, m]) => m.in);
  assert.equal(born.length, 3);
  for (const [id, m] of born) {
    const u = m.in[0] + 1e-3, drawn = bulbsIn(renderMachine(plan, i + u, layout).svg);
    const light = drawn.find(b => b.id === 'b1'), bulb = drawn.find(b => b.id === id);
    assert.ok(bulb && bulb.o > 0, `${id} is being born at u ${u}`);
    assert.ok(Math.abs(light.l - beat.set.bulbs[id].l) <= .05, `${id} at level ${beat.set.bulbs[id].l}, light at ${light.l}`);
  }
  // before its moment a deposit is not there; the light has faded by u 1
  assert.ok(!bulbsIn(renderMachine(plan, i + .3, layout).svg).some(b => b.id === 'b3'));
  assert.ok(!bulbsIn(renderMachine(plan, i + 1, layout).svg).some(b => b.id === 'b1'));
});

test('reduced motion holds, crossfades and holds: no bulb ever between levels', () => {
  for (const [name, plan] of plans) {
    const layout = layoutPlan(plan), list = scenesOf(plan);
    plan.beats.forEach((beat, i) => {
      for (const u of light.has(name) ? [.1, .45, .5, .55, .95] : [.1, .3, .45, .48, .5, .53, .55, .7, .95]) {
        const svg = renderMachine(plan, i + u, layout, ink, {motion: 'reduced'}).svg;
        const drawn = [...svg.matchAll(/data-(?:b|was)="([^"]+)" data-s="-?\d" data-l="([^"]+)"/g)].map(m => [m[1], +m[2]]);
        for (const [id, l] of drawn) {
          const levels = [list[i].bulbs[id]?.l, list[i + 1].bulbs[id]?.l].filter(x => x !== undefined).map(x => Math.round(x * 1000) / 1000);
          assert.ok(levels.includes(l), `${name} beat ${i} u ${u}: ${id} at ${l}, between ${levels}`);
        }
        // before the crossfade the scene before is held, after it the scene after
        const held = u < .45 ? list[i] : u > .55 ? list[i + 1] : null;
        if (held) assert.deepEqual(new Map(drawn), new Map(Object.entries(held.bulbs).map(([id, b]) => [id, Math.round(b.l * 1000) / 1000])), `${name} beat ${i} u ${u}`);
      }
    });
  }
  // shifts, carries and borrows leave ghost arrows
  const carry = fixture('golden-13+3-via');
  assert.match(renderMachine(carry, 3.5, layoutPlan(carry), ink, {motion: 'reduced'}).svg, /ghost-arrow/);
});

test('transients play inside their beat only: bursts, marks, beads', () => {
  const tern = fixture('golden-ternary-10+m5'), L = layoutPlan(tern);
  assert.doesNotMatch(renderMachine(tern, 3.5, L).svg, /#m-burst/, 'no burst before 0.6');
  assert.equal((renderMachine(tern, 3.7, L).svg.match(/#m-burst/g) || []).length, 1, 'one burst per meeting level (b2 and b6 meet at level 2)');
  assert.doesNotMatch(renderMachine(tern, 4, L).svg, /#m-burst/, 'gone at the boundary');
  const D = layoutPlan(divMarks);
  assert.match(renderMachine(divMarks, .5, D).svg, /mark-scan/);
  assert.doesNotMatch(renderMachine(divMarks, .5, D).svg, /mark-verdict/, 'the verdict flashes over [0.8, 1]');
  assert.match(renderMachine(divMarks, .85, D).svg, /mark-verdict/);
  assert.doesNotMatch(renderMachine(divMarks, 1, D).svg, /mark-/);
  assert.match(renderMachine(divMarks, 2.5, D).svg, /mark-ring/);
  const five = fixture('plan-5x11-binary'), F = layoutPlan(five);
  for (const [t, kind] of [[.5, 'input'], [1.5, 'deliver'], [5.5, 'return'], [15.5, 'output']]) {
    assert.equal(five.beats[Math.floor(t)].kind, kind);
    assert.match(renderMachine(five, t, F).svg, /class="bead"/, `${kind} rides a bead`);
  }
  assert.doesNotMatch(renderMachine(five, 6, F).svg, /class="bead"/);
  assert.match(renderMachine(five, 3.5, F).svg, /mark-ring/, 'the split marks R\'s top level');
});

test('the label switches at u 0.9 and always ends on top of its tower', () => {
  const plan = fixture('plan-5x11-binary'), L = layoutPlan(plan), i = 13;   // 40 + 15 = 55
  const label = t => [...renderMachine(plan, t, L).svg.matchAll(/<g class="pill" data-t="t1"[^>]*><rect x="[^"]+" y="([^"]+)"[^>]*\/><text[^>]*>([^<]*)</g)].map(m => [m[2], +m[1]])[0];
  assert.equal(label(i + .85)[0], '40');
  assert.equal(label(i + .9)[0], '55');
  const [, y] = label(i + 1), top = Math.min(...bulbsIn(renderMachine(plan, i + 1, L).svg).filter(b => sceneAt(plan, i + 1).bulbs[b.id].t === 't1').map(b => b.y));
  assert.equal(Math.round(top - 37 - (y + 36)), 5, 'the pill ends 42 above the top bulb\'s centre, never inside the stack');
});

test('pictures of the lamp, owed bulbs, the register, ghosts, notes, base-e piles and lights', () => {
  const lampSvg = renderMachine(notLamp, 4, layoutPlan(notLamp), ink, {digits: true}).svg;
  assert.match(lampSvg, /data-b="b4" data-s="-1"[^>]*>(?:<use[^>]*>)*<use href="#m-lamp"/, 'a lit lamp, red, with its collar');
  assert.equal((lampSvg.match(/href="#m-bulb-red" transform="translate\(0 -\d+\) scale\(0?\.\d\)"/g) || []).length, 2, 'two ghost bulbs above the lamp');
  assert.match(lampSvg, />…1</, 'the lamp\'s digit');
  const B = layoutPlan(owedBorrow);
  assert.match(renderMachine(owedBorrow, 1, B).svg, /data-b="b5" data-s="-1"[^>]*>(?:<use[^>]*>)*<use href="#m-owed"/, 'the owed bulb is ringed');
  assert.equal(bulbsIn(renderMachine(owedBorrow, 1.5, B).svg).find(b => b.id === 'b3').s, 1, 'a level lights as the donor passes it');
  const div = renderMachine(divMarks, 0, layoutPlan(divMarks)).svg;
  assert.match(div, /stroke-dasharray="6 6"/, 'the quotient register');
  assert.match(div, /class="note"[^]*×3¹/, 'a note beside its pill');
  assert.match(renderMachine(divMarks, 2, layoutPlan(divMarks)).svg, /data-t="t4" transform="[^"]+" opacity="0.55"/, 'a ghost tower at .55');
  const P = layoutPlan(ePile), pile = renderMachine(ePile, 1, P, ink, {digits: true}).svg;
  assert.match(pile, />×8</, 'a badge for more than six bulbs at a level');
  assert.match(pile, /#m-overhang/, 'the third bulb overhangs the sliver');
  assert.match(pile, /scale\(0\.7\)/, 'perched bulbs');
  assert.match(pile, /class="dust"/);
  const light = renderMachine(ePile, 2, P).svg;
  assert.match(light, /#m-halo/);
  assert.match(light, /class="rail"/);
  assert.match(light, /href="#m-bulb-amber"/, 'a positive light is amber');
  const e = fixture('e-measure-3'), E = layoutPlan(e);
  assert.match(renderMachine(e, 0, E).svg, /href="#m-bulb-amber"/, 'the light rides in as an amber coin');
  assert.equal((renderMachine(e, 4, E).svg.match(/#m-sliver/g) || []).length, 5, 'sockets and a sliver at every level from the floor to the top');
  assert.match(renderMachine(e, 4, E).svg, /class="dust"/);
});

test('the Digits view: glyphs right of column bulbs, T barred, place values left of the active node', () => {
  const plan = fixture('plan-5xm4-ternary'), L = layoutPlan(plan);
  const svg = renderMachine(plan, 9, L, ink, {digits: true, active: 'n1'}).svg;
  assert.match(svg, /class="digit"/);
  assert.match(svg, /3⁰[^]*3¹[^]*3²[^]*3³/);
  assert.match(svg, /<path d="M\d+ -24h22"/, 'T is a barred 1');
  assert.doesNotMatch(renderMachine(plan, 9, L, ink, {}).svg, /class="digit"/);
  const cyber = renderMachine(plan, 9, L, styles.cyber, {digits: true, active: 'n1'}).svg;
  assert.match(cyber, new RegExp(`class="digit"[^>]*fill="${styles.cyber.machine.glyph}"`), 'light digit glyphs on the cyber stage');
  assert.doesNotMatch(cyber, /#050504/, 'never bulbNumeral\'s hard-coded ink');
  // pending towers in level pace show no glyphs, and their lanes none either
  const level = fixture('golden-13+9-level');
  assert.doesNotMatch(renderMachine(level, 4, layoutPlan(level), ink, {digits: true}).svg, /class="digit"/);
});

test('both styles draw from their own tokens', () => {
  const plan = fixture('plan-5x11-binary'), L = layoutPlan(plan);
  for (const name of ['sketchpad', 'cyber']) {
    const p = styles[name], svg = renderMachine(plan, 3.5, L, p).svg;
    for (const token of [p.machine.block, p.machine.blockEdge, p.machine.wire, p.machine.labelFill]) assert.ok(svg.includes(token), `${name}: ${token}`);
    const defs = machineDefs(p);
    for (const token of [p.bulb.blue.body, p.bulb.red.body, p.bulb.amber.body, p.bulb.off.fill]) assert.ok(defs.includes(token), `${name} defs: ${token}`);
  }
  // the live palette is the default, and follows setStyle
  setStyle('cyber');
  try { assert.equal(renderMachine(plan, 3.5, L).svg, renderMachine(plan, 3.5, L, styles.cyber).svg); } finally { setStyle('sketchpad'); }
  assert.match(renderMachine(plan, 3.5, L, styles.cyber, {active: 'n1'}).svg, /class="hud"/, 'HUD brackets round the active node (cyber)');
  assert.doesNotMatch(renderMachine(plan, 3.5, L, styles.sketchpad, {active: 'n1'}).svg, /class="hud"/);
});

test('machineDefs symbols use bulb() and socket() geometry; block glyphs for every op', () => {
  for (const p of [styles.sketchpad, styles.cyber]) {
    const defs = machineDefs(p, 'x-');
    assert.ok(defs.includes(`<symbol id="x-bulb-blue" overflow="visible">${bulb(-21.5, -21.5, 'blue', 1, p)}</symbol>`));
    assert.ok(defs.includes(bulb(-21.5, -21.5, 'red', 1, p)));
    assert.ok(defs.includes(bulb(-21.5, -21.5, 'amber', 1, p)));
    assert.ok(defs.includes(`<symbol id="x-socket" overflow="visible">${socket(-21.5, -21.5, p)}</symbol>`));
    for (const id of ['lamp', 'sliver', 'halo', 'burst', 'overhang', 'owed']) assert.ok(defs.includes(`id="x-${id}"`), id);
    assert.equal(repeated(defs), null);
  }
  for (const op of ['add', 'sub', 'mul', 'div', 'mod', 'cmp', 'shl', 'shr', 'and', 'or', 'xor', 'not', 'min', 'max', 'sum', 'cons', 'neg', 'mule', 'measure', 'ln']) {
    const svg = blockGlyphSVG(op, ink, 'ternary');
    assert.match(svg, /^<svg [^>]*viewBox="[^"]+"[^>]*>.*<\/svg>$/s, op);
    assert.doesNotMatch(svg, /undefined|NaN|>\?</, op);
    assert.equal(repeated(svg), null, `${op}: an attribute twice`);
  }
  assert.match(blockGlyphSVG('shl', ink, 'ternary'), /×3ᵏ/);
  assert.match(blockGlyphSVG('shr', ink, 'binary'), /÷2ᵏ/);
  assert.equal(easeOut(0), 0); assert.equal(easeOut(1), 1); assert.equal(easeOut(.5), .75);
});

test('bulb() and socket() default output is byte-identical to before the palette parameter', () => {
  assert.equal(bulb(0, 0, 'blue'), '<g class="bulb bulb-blue" opacity="1"><circle cx="21.5" cy="21.5" r="52.54" fill="#4aa3ff" opacity=".14"/><circle cx="21.5" cy="21.5" r="45.14" fill="#4aa3ff" opacity=".26"/><circle cx="21.5" cy="21.5" r="37" fill="#2f7fc4" stroke="#4aa3ff" stroke-width="2"/><circle cx="21.5" cy="21.5" r="21.46" fill="#e2f3ff" opacity=".85"/><ellipse cx="8.18" cy="5.96" rx="9.62" ry="5.55" transform="rotate(-35 8.18 5.96)" fill="#fff" opacity=".75"/></g>');
  assert.equal(socket(0, 0), '<g class="bulb-socket"><circle cx="21.5" cy="21.5" r="37" fill="#ebe5d2" stroke="#7b7564" stroke-width="2"/><path d="M8.5 32.5v-9l4.6 -8l4.2 8l4.2 -8l4.2 8l4.2 -8l4.6 8v9" fill="none" stroke="#a79f88" stroke-width="2" stroke-linejoin="round"/><ellipse cx="8.18" cy="5.96" rx="8.88" ry="4.81" transform="rotate(-35 8.18 5.96)" fill="#fff" opacity=".35"/></g>');
  // a grid of positions, colours and opacities in both styles, hashed before the change
  const grid = () => { let s = ''; for (const x of [0, 12.3456, -21.5, 100.0004]) for (const y of [0, -7.1, 40.25]) for (const o of [1, .5, 0.12345, 0]) { for (const c of ['blue', 'red', 'green', 'off', 'nope']) s += bulb(x, y, c, o); s += socket(x, y); } return s; };
  const hash = s => crypto.createHash('sha256').update(s).digest('hex');
  assert.equal(hash(grid()), '7c65a821c4cc63726cf79f62f4e7115268db0804a03795f89643ca321ecc4f3e');
  setStyle('cyber');
  try { assert.equal(hash(grid()), '094f8749e1eb87b141ce170588924f040907f75f92f8babb12bf423a840bccad'); } finally { setStyle('sketchpad'); }
  // and the palette parameter draws a style without switching to it
  const live = (() => { setStyle('cyber'); try { return bulb(3, 4, 'red', .5) + socket(3, 4); } finally { setStyle('sketchpad'); } })();
  assert.equal(bulb(3, 4, 'red', .5, styles.cyber) + socket(3, 4, styles.cyber), live);
});

test('machine tokens and bulb.amber exist in both styles', () => {
  const keys = o => Object.keys(o).sort();
  assert.deepEqual(keys(styles.sketchpad.machine), keys(styles.cyber.machine));
  assert.deepEqual(keys(styles.sketchpad.bulb.amber), keys(styles.cyber.bulb.amber));
  for (const k of ['wire', 'wireActive', 'hub', 'block', 'blockEdge', 'glyph', 'label', 'labelFill', 'rail', 'scan', 'dust', 'error']) for (const s of ['sketchpad', 'cyber']) assert.match(styles[s].machine[k], /^#[0-9a-f]{6}$/, `${s} machine.${k}`);
  assert.equal(styles.sketchpad.machine.scan, styles.sketchpad.curves[1], 'the sketchpad scan is curves[1]');
  setStyle('cyber');
  try { assert.equal(ink.machine.glyph, '#c9f8ff'); assert.equal(ink.bulb.amber.body, '#ffb21e'); } finally { setStyle('sketchpad'); }
  assert.equal(ink.machine.glyph, '#25241e');
});

test('render.js and layout.js import no arithmetic module', () => {
  for (const file of ['render.js', 'layout.js']) {
    const source = fs.readFileSync(new URL(`../src/machine/${file}`, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^\s*import\b[^'"]*['"]([^'"]+)['"]/gm), ...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
    // scene.js is the shared diff replay of 6.2: scenes, not numbers
    for (const spec of imports) assert.ok(['../mvc/theme.js', '../mvc/view.js', './layout.js', './scene.js'].includes(spec), `${file} imports ${spec}`);
    assert.doesNotMatch(source, /bigmath|e-exact|bases\.js|oracle|BigInt/, file);
  }
});

test('a viewport: the camera\'s viewBox, culling off-camera towers, coins far away', () => {
  const plan = fixture('plan-5x11-binary'), L = layoutPlan(plan), viewport = {width: 390, height: 844};
  const out = renderMachine(plan, 7.5, L, ink, {viewport}), cam = cameraAt(plan, L, 7.5, viewport);
  assert.equal(out.viewBox, `${cam.x} ${cam.y} ${cam.w} ${cam.h}`);
  assert.equal(out.beat, 7); assert.equal(out.u, .5);
  assert.equal(renderMachine(plan, 7.5, L, ink, {viewport, camera: {x: 0, y: 0, w: 10, h: 10}}).viewBox, '0 0 10 10');
  // far out, towers away from the active node collapse to coins; the active node's never do
  const wide = {x: L.bounds.x, y: L.bounds.y, w: L.bounds.w * 3, h: L.bounds.h * 3};
  const far = bulbsIn(renderMachine(plan, 12.5, L, ink, {viewport: {width: 300, height: 300}, camera: wide}).svg);
  const near = bulbsIn(renderMachine(plan, 12.5, L, ink).svg);
  const span = list => { const ys = list.map(b => b.y); return Math.max(...ys) - Math.min(...ys); };
  const forty = b => sceneAt(plan, 12).bulbs[b.id]?.t === 't1';   // 40 rests at n1.L, away from the active n3
  assert.ok(span(far.filter(forty)) < span(near.filter(forty)) / 5, 'a far tower collapses');
  // a camera on one corner skips what it cannot see
  const corner = renderMachine(plan, 12.5, L, ink, {viewport: {width: 300, height: 300}, camera: {x: L.nodeAt('n5').x - 50, y: L.nodeAt('n5').y - 50, w: 100, h: 100}}).svg;
  assert.ok(bulbsIn(corner).length < near.length);
});

test('frames are fast enough to animate', () => {
  const plan = fixture('plan-5x11-binary'), L = layoutPlan(plan), start = performance.now();
  for (let k = 0; k < 400; k++) renderMachine(plan, (k % 160) / 10, L, ink, {viewport: {width: 1280, height: 720}, digits: true, active: 'n1'});
  const ms = (performance.now() - start) / 400;
  assert.ok(ms < 4, `${ms.toFixed(2)} ms a frame`);
});

// The perf scene of 6.9: (2³² − 1)², 161 beats, its widest ADD with 1489 bulbs on stage. The
// browser has 16.7 ms a frame for this and the DOM together.
test('a 64-level product lays out and draws its widest ADD fast enough', () => {
  const {plan} = planMachine({tree: {n1: {op: 'mul', parent: 'io', socket: 'C'}}, inputs: ['4294967295', '4294967295'], base: 'binary'});
  const t0 = performance.now(), L = layoutPlan(plan), layoutMs = performance.now() - t0;
  assert.ok(layoutMs < 1500, `layoutPlan took ${layoutMs.toFixed(0)} ms`);
  const beat = plan.beats.reduce((best, b, i) => b.kind === 'collide' && Object.keys(sceneAt(plan, i + 1).bulbs).length > Object.keys(sceneAt(plan, best + 1).bulbs).length ? i : best, plan.beats.findIndex(b => b.kind === 'collide'));
  assert.ok(Object.keys(sceneAt(plan, beat + 1).bulbs).length > 1400, 'the widest ADD');
  for (const [style, digits] of [['sketchpad', false], ['cyber', true]]) {
    // the best of three rounds' medians, so a burst of load on a shared machine does not count
    const view = {viewport: {width: 1280, height: 720}, digits, active: plan.beats[beat].node};
    renderMachine(plan, beat + .5, L, styles[style], view);
    const round = () => { const times = []; for (let k = 1; k <= 15; k++) { const s = performance.now(); renderMachine(plan, beat + k / 15, L, styles[style], view); times.push(performance.now() - s); } return times.sort((a, b) => a - b)[7]; };
    const median = Math.min(round(), round(), round());
    assert.ok(median < 10, `${style}: ${median.toFixed(2)} ms a frame`);
  }
});

test('the browser bench lists every base-e fixture', () => {
  const files = fs.readdirSync(new URL('./fixtures/machine/', import.meta.url)).filter(f => f.startsWith('e-') && f.endsWith('.json')).map(f => f.slice(0, -5));
  assert.deepEqual([...E_FIXTURES].sort(), files.filter(f => !FIXTURES.includes(f)).sort());
  assert.ok(scenes.filter(s => s.source === 'e-fixture').length === E_FIXTURES.length);
});

test('machine-render.test.js runs in under 20 s, as machine-plan.test.js does', () => {
  assert.ok(performance.now() - started < 20000, `${Math.round(performance.now() - started)} ms`);
});

