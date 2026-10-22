// Named machine plans for the snapshots (tools/machine-visual-tests.mjs) and the test bench.
// * the full-plan fixtures of 6.4 and 6.5 (tests/fixtures/machine);
// * the golden beats of 6.5b, wrapped in the standard flow (INPUT, DELIVER, FANOUT … RETURN,
//   OUTPUT) so that the picture of each edge case is pinned before and after the planner lands;
// * base-e plans from tests/fixtures/machine/e-*.json, when present;
// * the binary and ternary scenes 6.9 names, planned by planMachine once plan.js is present.
// Every entry is {name, plan, beats, view}: beats are the beat indices to snapshot (each at
// u ∈ {0, .25, .5, .75, 1}); view is merged into the renderer's view (highlight, active, digits).
import { applyDiff } from './layout.js';

export const FIXTURES = ['plan-5x11-binary', 'plan-5xm4-ternary', 'e-measure-3'];

// A golden: the operands' towers as literal strings and bulbs [level, state], the golden
// beats of 6.5b verbatim, the receiver that rides up, and the result.
const tower = (value, text, digits, bulbs) => ({value, text, digits, bulbs});
export const GOLDENS = {
  'golden-13+3-via': {base: 'binary', op: 'add', operands: [tower('13', '13', '1101₂', [[0, 1], [1, 0], [2, 1], [3, 1]]), tower('3', '3', '11₂', [[0, 1], [1, 1]])], receiver: 't1', result: ['16', '[16]', '10000₂'],
    beats: [{"i":3,"kind":"collide","node":"n1","caption":"13 + 3: 4 carries climb. 16.","ledger":{"law":"sum","a":"13","b":"3","out":"16"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"16","text":"16","digits":"10000₂"},"t2":null},"bulbs":{"b1":{"l":1,"s":0},"b2":{"l":2},"b3":{"l":3,"s":0},"b4":{"l":4},"b5":{"t":"t1","s":0},"b6":null}},"motion":{"b2":{"via":{"s":1}},"b6":{"to":{"t":"t1","l":1}}}}]},
  'golden-ternary-10+m5': {base: 'ternary', op: 'add', operands: [tower('10', '10', '101 bal₃', [[0, 1], [1, 0], [2, 1]]), tower('-5', '−5', 'T11 bal₃', [[0, 1], [1, 1], [2, -1]])], receiver: 't1', result: ['5', '[5]', '1TT bal₃'],
    beats: [{"i":3,"kind":"collide","node":"n1","caption":"10 + (−5): 2 carries climb. 5.","ledger":{"law":"sum","a":"10","b":"-5","out":"5"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"5","text":"5","digits":"1TT bal₃"},"t2":null},"bulbs":{"b1":{"l":1,"s":-1},"b2":null,"b4":{"t":"t1","s":-1},"b5":null,"b6":null}},"motion":{"b2":{"to":{"t":"t1","l":2},"via":{"s":1},"burst":true},"b5":{"to":{"t":"t1","l":1}},"b6":{"to":{"t":"t1","l":2},"burst":true}}}]},
  'golden-13+9-level': {base: 'binary', op: 'add', pace: 'level', operands: [tower('13', '13', '1101₂', [[0, 1], [1, 0], [2, 1], [3, 1]]), tower('9', '9', '1001₂', [[0, 1], [1, 0], [2, 0], [3, 1]])], receiver: 't1', result: ['22', '[22]', '10110₂'],
    beats: [
      {"i":3,"kind":"collide","node":"n1","caption":"13 + 9: the bulbs wait beside their levels. Level 0: 1 + 1, the resident climbs.","ledger":{"law":"sum","a":"13","b":"9","out":"22"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"22","text":"13 + 9","digits":null,"pending":true},"t2":null},"bulbs":{"b1":{"l":1,"slot":1},"b5":{"t":"t1","s":0},"b6":{"t":"t1","slot":2},"b7":{"t":"t1","slot":2},"b8":{"t":"t1","slot":2}}}},
      {"i":4,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 1: the carry lands on a dark level and stays.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b1":{"slot":null},"b2":null,"b6":null}},"motion":{"b6":{"to":{"t":"t1","l":1}}}},
      {"i":5,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 2: only a dark bulb arrives; the 1 stays.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b7":null}},"motion":{"b7":{"to":{"t":"t1","l":2}}}},
      {"i":6,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 3: 1 + 1: the resident climbs; the newcomer stays, dark.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b4":{"l":4,"slot":1},"b8":{"slot":null,"s":0}}}},
      {"i":7,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 4: the carry lands above the top and the tower grows. 22.","ledger":{"law":"regroup","value":"22"},"set":{"towers":{"t1":{"pending":null,"text":"22","digits":"10110₂"}},"bulbs":{"b4":{"slot":null}}}}]},
  'golden-ternary-4+4-level': {base: 'ternary', op: 'add', pace: 'level', operands: [tower('4', '4', '11 bal₃', [[0, 1], [1, 1]]), tower('4', '4', '11 bal₃', [[0, 1], [1, 1]])], receiver: 't2', result: ['8', '[8]', '10T bal₃'],
    beats: [
      {"i":3,"kind":"collide","node":"n1","caption":"4 + 4: the bulbs wait beside their levels. Level 0: 1 + 1 = 3 − 1: the resident climbs.","ledger":{"law":"sum","a":"4","b":"4","out":"8"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t2":{"at":"n1.C","value":"8","text":"4 + 4","digits":null,"pending":true},"t1":null},"bulbs":{"b3":{"l":1,"slot":2},"b1":{"t":"t2","s":-1},"b2":{"t":"t2","slot":1}}}},
      {"i":4,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 1: three blue bulbs make 3: the resident climbs, the carry goes dark.","ledger":{"law":"regroup","value":"8"},"set":{"bulbs":{"b4":{"l":2,"slot":2},"b3":{"slot":null,"s":0},"b2":null}},"motion":{"b2":{"to":{"t":"t2","l":1}}}},
      {"i":5,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 2: the carry lands above the top and the tower grows. 8.","ledger":{"law":"regroup","value":"8"},"set":{"towers":{"t2":{"pending":null,"text":"8","digits":"10T bal₃"}},"bulbs":{"b4":{"slot":null}}}}]},
  'golden-0x9-zero': {base: 'binary', op: 'mul', operands: [tower('0', '0', '0₂', [[0, 0]]), tower('9', '9', '1001₂', [[0, 1], [1, 0], [2, 0], [3, 1]])], receiver: 't1', result: ['0', '[0]', '0₂'],
    beats: [{"i":3,"kind":"zero","node":"n1","caption":"Nothing to multiply: 0 × 9 = 0.","ledger":{"law":"zero","a":"0","b":"9","out":"0"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C"},"t2":null},"bulbs":{"b2":null,"b3":null,"b4":null,"b5":null}},"motion":{"b2":{"to":{"t":"t1","l":0}},"b3":{"to":{"t":"t1","l":0}},"b4":{"to":{"t":"t1","l":0}},"b5":{"to":{"t":"t1","l":0}}}}]},
};
const BLOCK = {add: '+ block', mul: '× block'};
// The golden beats inside the standard flow, so a golden can be played and drawn whole.
export function goldenPlan(name) {
  const g = GOLDENS[name], pace = g.pace || 'together', tree = {n1: {op: g.op, parent: 'io', socket: 'C'}};
  const start = {nodes: {n1: {...tree.n1}}, towers: {}, bulbs: {}};
  let b = 0;
  g.operands.forEach((o, i) => {
    start.towers[`t${i + 1}`] = {at: `in:${i}`, form: 'coin', value: o.value, text: o.text, digits: o.digits};
    for (const [l, s] of o.bulbs) start.bulbs[`b${++b}`] = {t: `t${i + 1}`, l, s};
  });
  const ids = Object.keys(start.towers), list = '[' + g.operands.map(o => o.text).join(', ') + ']', [value, text] = g.result;
  const flow = (i, kind, node, caption, set) => ({i, kind, node, caption, ledger: {law: 'move'}, set});
  const beats = [
    flow(0, 'input', 'io', `${list} goes in.`, {towers: Object.fromEntries(ids.map((t, i) => [t, {at: `io:${i}`}]))}),
    flow(1, 'deliver', 'n1', `The numbers ride down the wire to the ${BLOCK[g.op]}.`, {towers: Object.fromEntries(ids.map((t, i) => [t, {at: `n1.C:${i}`}]))}),
    flow(2, 'fanout', 'n1', `${g.operands.map(o => o.text).join(' and ')} drop into the sockets and stand up.`, {towers: {t1: {at: 'n1.L', form: 'tower'}, t2: {at: 'n1.R', form: 'tower'}}}),
    ...g.beats.map(beat => structuredClone(beat)),
  ];
  const n = beats.length;
  beats.push({...flow(n, 'return', 'n1', `${text.replace(/^\[|\]$/g, '')} rides up into the triangle.`, {nodes: {n1: null}, towers: {[g.receiver]: {at: 'io:0'}}}), ledger: {law: 'move', value}});
  beats.push({...flow(n + 1, 'output', 'io', `Output ${text}.`, {towers: {[g.receiver]: {at: 'out:0', form: 'coin'}}}), ledger: {law: 'move', value}});
  const plan = {v: 1, base: g.base, pace, tree, inputs: g.operands.map(o => o.value), start, beats, result: {values: [value], text}, stats: {beats: beats.length, nodes: 1, maxLevels: 0, maxBulbs: b}};
  let scene = start;
  for (const beat of beats) {
    scene = applyDiff(scene, beat.set);
    for (const t of Object.keys(scene.towers)) plan.stats.maxLevels = Math.max(plan.stats.maxLevels, ...Object.values(scene.bulbs).filter(x => x.t === t).map(x => x.l + 1));
  }
  return plan;
}
// The scenes of 6.9 that need the planner: [name, base, tree ops (root first; children hang
// left first), inputs, beat kinds to snapshot (the first of each), {pace, all, highlight}].
const chain = (...ops) => { const tree = {n1: {op: ops[0], parent: 'io', socket: 'C'}}; ops.slice(1).forEach((op, i) => tree[`n${i + 2}`] = {op, parent: 'n1', socket: 'R'}); return tree; };
export const PLANNED = [
  ['mul-16x7-binary', 'binary', chain('mul'), ['16', '7'], ['split', 'shift', 'return', 'collide']],
  ['mul-16x7-ternary', 'ternary', chain('mul'), ['16', '7'], ['split', 'shift', 'collide']],
  ['add-13-9-together', 'binary', chain('add'), ['13', '9'], ['collide']],
  ['add-13-9-level', 'binary', chain('add'), ['13', '9'], [], {pace: 'level', all: true}],
  ['add-1048575-1', 'binary', chain('add'), ['1048575', '1'], ['collide']],
  ['sub-12-5-borrow', 'binary', chain('sub'), ['12', '5'], ['negate', 'collide', 'borrow']],
  ['cmp-5-3', 'binary', chain('cmp'), ['5', '3'], ['compare']],
  ['div-45-6', 'binary', chain('div'), ['45', '6'], ['prep', 'compare', 'collide', 'borrow', 'descend', 'return']],
  ['shl-5-3', 'binary', chain('shl'), ['5', '3'], ['fanout', 'shift']],
  ['shr-45-2', 'binary', chain('shr'), ['45', '2'], ['drop']],
  ['and-12-10', 'binary', chain('and'), ['12', '10'], ['gate']],
  ['xor-12-10', 'binary', chain('xor'), ['12', '10'], ['gate']],
  ['not-5-lamp', 'binary', chain('not'), ['5'], ['flip']],
  ['and-m4-7-fold', 'binary', chain('and'), ['-4', '7'], ['flip', 'addone', 'gate']],
  ['add-5-7-ternary', 'ternary', chain('add'), ['5', '7'], ['collide']],
  ['div-19-5-ternary', 'ternary', chain('div'), ['19', '5'], ['try', 'judge', 'clear']],
  ['sum-5-7-ternary', 'ternary', chain('sum'), ['5', '7'], ['gate']],
  ['div-by-zero-highlight', 'binary', chain('div', 'sub'), ['9', '3', '3'], [], {highlight: true}],
];

// Reads a fixture: Node reads the file, a browser fetches it next to the app.
async function readFixture(name) {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const fs = await import('node:fs');
    return JSON.parse(fs.readFileSync(new URL(`../../tests/fixtures/machine/${name}.json`, import.meta.url), 'utf8'));
  }
  return (await fetch(new URL(`../../tests/fixtures/machine/${name}.json`, import.meta.url))).json();
}
async function listFixtures() {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const fs = await import('node:fs');
    return fs.readdirSync(new URL('../../tests/fixtures/machine/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
  }
  return FIXTURES;
}
const every = plan => plan.beats.map((_, i) => i);
const firstOf = (plan, kinds) => [...new Set(kinds.map(k => plan.beats.findIndex(b => b.kind === k)).filter(i => i >= 0))].sort((a, b) => a - b);

// All scenes available here. Missing modules (the planner before it lands) are reported in
// `skipped`, never thrown.
export async function machineScenes({read = readFixture, list = listFixtures, planner} = {}) {
  const scenes = [], skipped = [];
  for (const name of FIXTURES) { const plan = await read(name); scenes.push({name, plan, beats: every(plan), view: {}, source: 'fixture'}); }
  for (const name of Object.keys(GOLDENS)) { const plan = goldenPlan(name); scenes.push({name, plan, beats: every(plan), view: {}, source: 'golden'}); }
  for (const name of (await list()).filter(n => n.startsWith('e-') && !FIXTURES.includes(n)).sort()) {
    const plan = await read(name);
    scenes.push({name, plan, beats: every(plan), view: {}, source: 'e-fixture'});
  }
  let api = planner;
  if (!api) {
    try { api = {...await import('./plan.js'), ...await import('./builder.js')}; }
    catch (error) { skipped.push(...PLANNED.map(([name]) => `${name} (planner not available: ${error.message.split('\n')[0]})`)); return {scenes, skipped}; }
  }
  for (const [name, base, tree, inputs, kinds, opt = {}] of PLANNED) {
    try {
      const out = api.planMachine({tree, inputs, base, pace: opt.pace || 'together'});
      if (opt.highlight) {
        if (out.ok) { skipped.push(`${name} (expected a domain error)`); continue; }
        const plan = new api.PlanBuilder({base, tree, inputs, pace: 'together'}).finish({values: [], text: '[—]'});
        scenes.push({name, plan, beats: [], view: {highlight: out.node}, source: 'planner'});
        continue;
      }
      if (!out.ok) { skipped.push(`${name} (${out.reason}: ${out.message})`); continue; }
      scenes.push({name, plan: out.plan, beats: opt.all ? every(out.plan) : firstOf(out.plan, kinds), view: {}, source: 'planner'});
    } catch (error) { skipped.push(`${name} (${error.message})`); }
  }
  return {scenes, skipped};
}
