// The machine's goldens (design 6.4, 6.5, 6.5b and 2.4): planMachine must produce exactly
// these plans and beats. The full-plan fixtures are embedded here verbatim from the design;
// when tests/fixtures/machine/*.json exist they are compared too.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {planMachine, validatePlan, evaluateScene} from '../src/machine/plan.js';
import {snapshotAt} from '../src/machine/scene.js';
import {parseExpression, parseInput, defaultMachine} from '../src/machine/tree.js';
import {twos, digits} from '../src/machine/bigmath.js';

const one = (op, inputs, base = 'binary', pace = 'together') => planMachine({tree: {n1: {op, parent: 'io', socket: 'C'}}, inputs, base, pace});
const plan = (...args) => { const r = one(...args); assert.ok(r.ok, r.message); assert.deepEqual(validatePlan(r.plan), []); return r.plan; };
const expression = (text, base = 'binary', inputs) => { const e = parseExpression(text, base); assert.ok(e.ok, e.error); return planMachine({tree: e.tree, inputs: inputs ?? e.inputs, base}); };
const fixture = (name, embedded) => {
  const path = new URL(`./fixtures/machine/${name}.json`, import.meta.url);
  return existsSync(path) ? [embedded, JSON.parse(readFileSync(path, 'utf8'))] : [embedded];
};

const PLAN_5x11 = {"v":1,"base":"binary","pace":"together","tree":{"n1":{"op":"mul","parent":"io","socket":"C"}},"inputs":["5","11"],
 "start":{"nodes":{"n1":{"op":"mul","parent":"io","socket":"C"}},
  "towers":{"t1":{"at":"in:0","form":"coin","value":"5","text":"5","digits":"101₂"},"t2":{"at":"in:1","form":"coin","value":"11","text":"11","digits":"1011₂"}},
  "bulbs":{"b1":{"t":"t1","l":0,"s":1},"b2":{"t":"t1","l":1,"s":0},"b3":{"t":"t1","l":2,"s":1},"b4":{"t":"t2","l":0,"s":1},"b5":{"t":"t2","l":1,"s":1},"b6":{"t":"t2","l":2,"s":0},"b7":{"t":"t2","l":3,"s":1}}},
 "beats":[
 {"i":0,"kind":"input","node":"io","caption":"[5, 11] goes in.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"io:0"},"t2":{"at":"io:1"}}}},
 {"i":1,"kind":"deliver","node":"n1","caption":"The numbers ride down the wire to the × block.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.C:0"},"t2":{"at":"n1.C:1"}}}},
 {"i":2,"kind":"fanout","node":"n1","caption":"5 and 11 drop into the sockets and stand up.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.L","form":"tower"},"t2":{"at":"n1.R","form":"tower"}}}},
 {"i":3,"kind":"split","node":"n1","caption":"11 = 8 + 3, so 5 × 11 = 5 × 8 + 5 × 3.","ledger":{"law":"split","a":"5","b":"11","t":"8","r":"3"},"set":{"nodes":{"n1":{"op":"add"},"n2":{"op":"mul","parent":"n1","socket":"L"},"n3":{"op":"mul","parent":"n1","socket":"R"}},"towers":{"t1":{"at":"n2.L"},"t2":{"at":"n2.R","value":"8","text":"8","digits":"1000₂"},"t3":{"at":"n3.L","form":"tower","value":"5","text":"5","digits":"101₂"},"t4":{"at":"n3.R","form":"tower","value":"3","text":"3","digits":"11₂"}},"bulbs":{"b4":{"t":"t4"},"b5":{"t":"t4"},"b8":{"t":"t3","l":0,"s":1},"b9":{"t":"t3","l":1,"s":0},"b10":{"t":"t3","l":2,"s":1},"b11":{"t":"t2","l":0,"s":0},"b12":{"t":"t2","l":1,"s":0}}},"motion":{"b8":{"from":{"t":"t1","l":0}},"b9":{"from":{"t":"t1","l":1}},"b10":{"from":{"t":"t1","l":2}}},"marks":[{"k":"ring","t":"t2","l":1}]},
 {"i":4,"kind":"shift","node":"n2","caption":"5 × 8: 3 dark bulbs slide under 5; it rises 3 levels. 40.","ledger":{"law":"shift","a":"5","m":"8","k":3,"sign":1,"out":"40"},"set":{"nodes":{"n2":{"glyph":0}},"towers":{"t1":{"at":"n2.C","value":"40","text":"40","digits":"101000₂"},"t2":null},"bulbs":{"b1":{"l":3},"b2":{"l":4},"b3":{"l":5},"b6":{"t":"t1"},"b7":null,"b11":{"t":"t1"},"b12":{"t":"t1"}}},"motion":{"b7":{"to":{"t":"t1","l":3},"dissolve":true}}},
 {"i":5,"kind":"return","node":"n2","caption":"40 rides up.","ledger":{"law":"move","value":"40"},"set":{"nodes":{"n2":null},"towers":{"t1":{"at":"n1.L"}}}},
 {"i":6,"kind":"split","node":"n3","caption":"3 = 2 + 1, so 5 × 3 = 5 × 2 + 5 × 1.","ledger":{"law":"split","a":"5","b":"3","t":"2","r":"1"},"set":{"nodes":{"n3":{"op":"add"},"n4":{"op":"mul","parent":"n3","socket":"L"},"n5":{"op":"mul","parent":"n3","socket":"R"}},"towers":{"t3":{"at":"n4.L"},"t4":{"at":"n4.R","value":"2","text":"2","digits":"10₂"},"t5":{"at":"n5.L","form":"tower","value":"5","text":"5","digits":"101₂"},"t6":{"at":"n5.R","form":"tower","value":"1","text":"1","digits":"1₂"}},"bulbs":{"b4":{"t":"t6"},"b13":{"t":"t5","l":0,"s":1},"b14":{"t":"t5","l":1,"s":0},"b15":{"t":"t5","l":2,"s":1},"b16":{"t":"t4","l":0,"s":0}}},"motion":{"b13":{"from":{"t":"t3","l":0}},"b14":{"from":{"t":"t3","l":1}},"b15":{"from":{"t":"t3","l":2}}},"marks":[{"k":"ring","t":"t4","l":0}]},
 {"i":7,"kind":"shift","node":"n4","caption":"5 × 2: 1 dark bulb slides under 5; it rises 1 level. 10.","ledger":{"law":"shift","a":"5","m":"2","k":1,"sign":1,"out":"10"},"set":{"nodes":{"n4":{"glyph":0}},"towers":{"t3":{"at":"n4.C","value":"10","text":"10","digits":"1010₂"},"t4":null},"bulbs":{"b5":null,"b8":{"l":1},"b9":{"l":2},"b10":{"l":3},"b16":{"t":"t3"}}},"motion":{"b5":{"to":{"t":"t3","l":1},"dissolve":true}}},
 {"i":8,"kind":"return","node":"n4","caption":"10 rides up.","ledger":{"law":"move","value":"10"},"set":{"nodes":{"n4":null},"towers":{"t3":{"at":"n3.L"}}}},
 {"i":9,"kind":"shift","node":"n5","caption":"5 × 1: the 1 dissolves; 5 stays put.","ledger":{"law":"shift","a":"5","m":"1","k":0,"sign":1,"out":"5"},"set":{"nodes":{"n5":{"glyph":0}},"towers":{"t5":{"at":"n5.C"},"t6":null},"bulbs":{"b4":null}},"motion":{"b4":{"to":{"t":"t5","l":0},"dissolve":true}}},
 {"i":10,"kind":"return","node":"n5","caption":"5 rides up.","ledger":{"law":"move","value":"5"},"set":{"nodes":{"n5":null},"towers":{"t5":{"at":"n3.R"}}}},
 {"i":11,"kind":"collide","node":"n3","caption":"10 + 5: nothing carries. 15.","ledger":{"law":"sum","a":"10","b":"5","out":"15"},"set":{"nodes":{"n3":{"glyph":0}},"towers":{"t3":{"at":"n3.C","value":"15","text":"15","digits":"1111₂"},"t5":null},"bulbs":{"b9":null,"b13":{"t":"t3"},"b14":null,"b15":{"t":"t3"},"b16":null}},"motion":{"b16":{"to":{"t":"t3","l":0}},"b14":{"to":{"t":"t3","l":1}},"b9":{"to":{"t":"t3","l":2}}}},
 {"i":12,"kind":"return","node":"n3","caption":"15 rides up.","ledger":{"law":"move","value":"15"},"set":{"nodes":{"n3":null},"towers":{"t3":{"at":"n1.R"}}}},
 {"i":13,"kind":"collide","node":"n1","caption":"40 + 15: 1 carry climbs. 55.","ledger":{"law":"sum","a":"40","b":"15","out":"55"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"55","text":"55","digits":"110111₂"},"t3":null},"bulbs":{"b1":{"l":4},"b2":null,"b6":null,"b8":{"t":"t1"},"b10":{"t":"t1","s":0},"b11":null,"b12":null,"b13":{"t":"t1"},"b15":{"t":"t1"}}},"motion":{"b11":{"to":{"t":"t1","l":0}},"b12":{"to":{"t":"t1","l":1}},"b6":{"to":{"t":"t1","l":2}},"b2":{"to":{"t":"t1","l":4}}}},
 {"i":14,"kind":"return","node":"n1","caption":"55 rides up into the triangle.","ledger":{"law":"move","value":"55"},"set":{"nodes":{"n1":null},"towers":{"t1":{"at":"io:0"}}}},
 {"i":15,"kind":"output","node":"io","caption":"Output [55].","ledger":{"law":"move","value":"55"},"set":{"towers":{"t1":{"at":"out:0","form":"coin"}}}}],
 "result":{"values":["55"],"text":"[55]"},
 "stats":{"beats":16,"nodes":5,"maxLevels":6,"maxBulbs":15}};

const PLAN_5xM4 = {"v":1,"base":"ternary","pace":"together","tree":{"n1":{"op":"mul","parent":"io","socket":"C"}},"inputs":["5","-4"],
 "start":{"nodes":{"n1":{"op":"mul","parent":"io","socket":"C"}},
  "towers":{"t1":{"at":"in:0","form":"coin","value":"5","text":"5","digits":"1TT bal₃"},"t2":{"at":"in:1","form":"coin","value":"-4","text":"−4","digits":"TT bal₃"}},
  "bulbs":{"b1":{"t":"t1","l":0,"s":-1},"b2":{"t":"t1","l":1,"s":-1},"b3":{"t":"t1","l":2,"s":1},"b4":{"t":"t2","l":0,"s":-1},"b5":{"t":"t2","l":1,"s":-1}}},
 "beats":[
 {"i":0,"kind":"input","node":"io","caption":"[5, −4] goes in.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"io:0"},"t2":{"at":"io:1"}}}},
 {"i":1,"kind":"deliver","node":"n1","caption":"The numbers ride down the wire to the × block.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.C:0"},"t2":{"at":"n1.C:1"}}}},
 {"i":2,"kind":"fanout","node":"n1","caption":"5 and −4 drop into the sockets and stand up.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.L","form":"tower"},"t2":{"at":"n1.R","form":"tower"}}}},
 {"i":3,"kind":"split","node":"n1","caption":"−4 = −3 + (−1), so 5 × (−4) = 5 × (−3) + 5 × (−1).","ledger":{"law":"split","a":"5","b":"-4","t":"-3","r":"-1"},"set":{"nodes":{"n1":{"op":"add"},"n2":{"op":"mul","parent":"n1","socket":"L"},"n3":{"op":"mul","parent":"n1","socket":"R"}},"towers":{"t1":{"at":"n2.L"},"t2":{"at":"n2.R","value":"-3","text":"−3","digits":"T0 bal₃"},"t3":{"at":"n3.L","form":"tower","value":"5","text":"5","digits":"1TT bal₃"},"t4":{"at":"n3.R","form":"tower","value":"-1","text":"−1","digits":"T bal₃"}},"bulbs":{"b4":{"t":"t4"},"b6":{"t":"t3","l":0,"s":-1},"b7":{"t":"t3","l":1,"s":-1},"b8":{"t":"t3","l":2,"s":1},"b9":{"t":"t2","l":0,"s":0}}},"motion":{"b6":{"from":{"t":"t1","l":0}},"b7":{"from":{"t":"t1","l":1}},"b8":{"from":{"t":"t1","l":2}}},"marks":[{"k":"ring","t":"t2","l":0}]},
 {"i":4,"kind":"shift","node":"n2","caption":"5 × (−3): 1 dark bulb slides under 5; it rises 1 level and every colour swaps. −15.","ledger":{"law":"shift","a":"5","m":"-3","k":1,"sign":-1,"out":"-15"},"set":{"nodes":{"n2":{"glyph":0}},"towers":{"t1":{"at":"n2.C","value":"-15","text":"−15","digits":"T110 bal₃"},"t2":null},"bulbs":{"b1":{"l":1,"s":1},"b2":{"l":2,"s":1},"b3":{"l":3,"s":-1},"b5":null,"b9":{"t":"t1"}}},"motion":{"b5":{"to":{"t":"t1","l":1},"dissolve":true}}},
 {"i":5,"kind":"return","node":"n2","caption":"−15 rides up.","ledger":{"law":"move","value":"-15"},"set":{"nodes":{"n2":null},"towers":{"t1":{"at":"n1.L"}}}},
 {"i":6,"kind":"shift","node":"n3","caption":"5 × (−1): every colour swaps. −5.","ledger":{"law":"shift","a":"5","m":"-1","k":0,"sign":-1,"out":"-5"},"set":{"nodes":{"n3":{"glyph":0}},"towers":{"t3":{"at":"n3.C","value":"-5","text":"−5","digits":"T11 bal₃"},"t4":null},"bulbs":{"b4":null,"b6":{"s":1},"b7":{"s":1},"b8":{"s":-1}}},"motion":{"b4":{"to":{"t":"t3","l":0},"dissolve":true}}},
 {"i":7,"kind":"return","node":"n3","caption":"−5 rides up.","ledger":{"law":"move","value":"-5"},"set":{"nodes":{"n3":null},"towers":{"t3":{"at":"n1.R"}}}},
 {"i":8,"kind":"collide","node":"n1","caption":"−15 + (−5): 1 carry climbs. −20.","ledger":{"law":"sum","a":"-15","b":"-5","out":"-20"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"-20","text":"−20","digits":"T1T1 bal₃"},"t3":null},"bulbs":{"b1":null,"b6":{"t":"t1"},"b7":{"t":"t1","s":-1},"b8":null,"b9":null}},"motion":{"b9":{"to":{"t":"t1","l":0}},"b1":{"to":{"t":"t1","l":2},"burst":true},"b8":{"to":{"t":"t1","l":2},"burst":true}}},
 {"i":9,"kind":"return","node":"n1","caption":"−20 rides up into the triangle.","ledger":{"law":"move","value":"-20"},"set":{"nodes":{"n1":null},"towers":{"t1":{"at":"io:0"}}}},
 {"i":10,"kind":"output","node":"io","caption":"Output [−20].","ledger":{"law":"move","value":"-20"},"set":{"towers":{"t1":{"at":"out:0","form":"coin"}}}}],
 "result":{"values":["-20"],"text":"[−20]"},
 "stats":{"beats":11,"nodes":3,"maxLevels":4,"maxBulbs":9}};

test('5 × 11 in binary deep-equals the worked plan of 6.4 (PRIME §4.6, label on top)', () => {
  const p = plan('mul', ['5', '11']);
  for (const want of fixture('plan-5x11-binary', PLAN_5x11)) assert.deepEqual(JSON.parse(JSON.stringify(p)), want);
});
test('5 × (−4) in balanced ternary deep-equals the worked plan of 6.5', () => {
  const p = plan('mul', ['5', '-4'], 'ternary');
  for (const want of fixture('plan-5xm4-ternary', PLAN_5xM4)) assert.deepEqual(JSON.parse(JSON.stringify(p)), want);
});

test('13 + 3 pins the lit in-flight carry (6.5b)', () => {
  assert.deepEqual(plan('add', ['13', '3']).beats[3],
    {"i":3,"kind":"collide","node":"n1","caption":"13 + 3: 4 carries climb. 16.","ledger":{"law":"sum","a":"13","b":"3","out":"16"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"16","text":"16","digits":"10000₂"},"t2":null},"bulbs":{"b1":{"l":1,"s":0},"b2":{"l":2},"b3":{"l":3,"s":0},"b4":{"l":4},"b5":{"t":"t1","s":0},"b6":null}},"motion":{"b2":{"via":{"s":1}},"b6":{"to":{"t":"t1","l":1}}}});
});
test('ternary 10 + (−5): a dark resident lights as it climbs, and the burst has a visible partner (6.5b)', () => {
  assert.deepEqual(plan('add', ['10', '-5'], 'ternary').beats[3],
    {"i":3,"kind":"collide","node":"n1","caption":"10 + (−5): 2 carries climb. 5.","ledger":{"law":"sum","a":"10","b":"-5","out":"5"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"5","text":"5","digits":"1TT bal₃"},"t2":null},"bulbs":{"b1":{"l":1,"s":-1},"b2":null,"b4":{"t":"t1","s":-1},"b5":null,"b6":null}},"motion":{"b2":{"to":{"t":"t1","l":2},"via":{"s":1},"burst":true},"b5":{"to":{"t":"t1","l":1}},"b6":{"to":{"t":"t1","l":2},"burst":true}}});
});
test('13 + 9 in level pace: the bulbs wait in lanes and every level is its own half beat (6.5b)', () => {
  const p = plan('add', ['13', '9'], 'binary', 'level');
  assert.deepEqual(p.beats.slice(3, 8), [
    {"i":3,"kind":"collide","node":"n1","caption":"13 + 9: the bulbs wait beside their levels. Level 0: 1 + 1, the resident climbs.","ledger":{"law":"sum","a":"13","b":"9","out":"22"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C","value":"22","text":"13 + 9","digits":null,"pending":true},"t2":null},"bulbs":{"b1":{"l":1,"slot":1},"b5":{"t":"t1","s":0},"b6":{"t":"t1","slot":2},"b7":{"t":"t1","slot":2},"b8":{"t":"t1","slot":2}}}},
    {"i":4,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 1: the carry lands on a dark level and stays.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b1":{"slot":null},"b2":null,"b6":null}},"motion":{"b6":{"to":{"t":"t1","l":1}}}},
    {"i":5,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 2: only a dark bulb arrives; the 1 stays.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b7":null}},"motion":{"b7":{"to":{"t":"t1","l":2}}}},
    {"i":6,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 3: 1 + 1: the resident climbs; the newcomer stays, dark.","ledger":{"law":"regroup","value":"22"},"set":{"bulbs":{"b4":{"l":4,"slot":1},"b8":{"slot":null,"s":0}}}},
    {"i":7,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 4: the carry lands above the top and the tower grows. 22.","ledger":{"law":"regroup","value":"22"},"set":{"towers":{"t1":{"pending":null,"text":"22","digits":"10110₂"}},"bulbs":{"b4":{"slot":null}}}},
  ]);
  assert.equal(p.result.text, '[22]');
});
test('ternary 4 + 4 in level pace: the tie goes right, so the left donor waits in lane 1 (6.5b)', () => {
  const p = plan('add', ['4', '4'], 'ternary', 'level');
  assert.deepEqual(p.beats.slice(3, 6), [
    {"i":3,"kind":"collide","node":"n1","caption":"4 + 4: the bulbs wait beside their levels. Level 0: 1 + 1 = 3 − 1: the resident climbs.","ledger":{"law":"sum","a":"4","b":"4","out":"8"},"set":{"nodes":{"n1":{"glyph":0}},"towers":{"t2":{"at":"n1.C","value":"8","text":"4 + 4","digits":null,"pending":true},"t1":null},"bulbs":{"b3":{"l":1,"slot":2},"b1":{"t":"t2","s":-1},"b2":{"t":"t2","slot":1}}}},
    {"i":4,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 1: three blue bulbs make 3: the resident climbs, the carry goes dark.","ledger":{"law":"regroup","value":"8"},"set":{"bulbs":{"b4":{"l":2,"slot":2},"b3":{"slot":null,"s":0},"b2":null}},"motion":{"b2":{"to":{"t":"t2","l":1}}}},
    {"i":5,"kind":"carry","node":"n1","dur":0.5,"caption":"Level 2: the carry lands above the top and the tower grows. 8.","ledger":{"law":"regroup","value":"8"},"set":{"towers":{"t2":{"pending":null,"text":"8","digits":"10T bal₃"}},"bulbs":{"b4":{"slot":null}}}},
  ]);
});
test('0 × 9: the zero absorbs the other operand, then RETURN and OUTPUT [0], in both bases (6.5b)', () => {
  for (const base of ['binary', 'ternary']) {
    const p = plan('mul', ['0', '9'], base), gone = base === 'binary' ? ['b2', 'b3', 'b4', 'b5'] : ['b2', 'b3', 'b4'];
    assert.deepEqual(p.beats[3], {"i":3,"kind":"zero","node":"n1","caption":"Nothing to multiply: 0 × 9 = 0.","ledger":{"law":"zero","a":"0","b":"9","out":"0"},
      "set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"at":"n1.C"},"t2":null},"bulbs":Object.fromEntries(gone.map(b => [b, null]))},
      "motion":Object.fromEntries(gone.map(b => [b, {"to":{"t":"t1","l":0}}]))});
    assert.deepEqual(p.beats.slice(4).map(b => b.kind), ['return', 'output']);
    assert.equal(p.result.text, '[0]');
  }
});

// The user's run: MULT with [16,7] gives the 12 beats PRIME shows, then [112], in both bases.
const BINARY_16x7 = [
  ['split', '7 = 4 + 3, so 16 × 7 = 16 × 4 + 16 × 3.'],
  ['shift', '16 × 4: 2 dark bulbs slide under 16; it rises 2 levels. 64.', '1000000'],
  ['return', '64 rides up.'],
  ['split', '3 = 2 + 1, so 16 × 3 = 16 × 2 + 16 × 1.'],
  ['shift', '16 × 2: 1 dark bulb slides under 16; it rises 1 level. 32.', '100000'],
  ['return', '32 rides up.'],
  ['shift', '16 × 1: the 1 dissolves; 16 stays put.', '10000'],
  ['return', '16 rides up.'],
  ['collide', '32 + 16: nothing carries. 48.', '110000'],
  ['return', '48 rides up.'],
  ['collide', '64 + 48: nothing carries. 112.', '1110000'],
  ['return', '112 rides up into the triangle.'],
];
const TERNARY_16x7 = {
  3: ['split', '7 = 9 + (−2), so 16 × 7 = 16 × 9 + 16 × (−2).'],
  4: ['shift', '16 × 9: 2 dark bulbs slide under 16; it rises 2 levels. 144.', '1TT100'],
  6: ['split', '−2 = −3 + 1, so 16 × (−2) = 16 × (−3) + 16 × 1.'],
  7: ['shift', '16 × (−3): 1 dark bulb slides under 16; it rises 1 level and every colour swaps. −48.', 'T11T0'],
  9: ['shift', '16 × 1: the 1 dissolves; 16 stays put.', '1TT1'],
  11: ['collide', '−48 + 16: 2 carries climb. −32.', 'TT11'],
  13: ['collide', '144 + (−32): 2 carries climb. 112.', '11011'],
  15: ['output', 'Output [112].'],
};
// The tower a beat leaves at its node's centre, read as digits from its bulbs.
function towerDigits(p, i) {
  const scene = snapshotAt(p, i + 1), beat = p.beats[i];
  const t = Object.keys(scene.towers).find(id => scene.towers[id].at === `${beat.node}.C`);
  const bulbs = Object.values(scene.bulbs).filter(b => b.t === t).sort((x, y) => y.l - x.l);
  return bulbs.map(b => b.s < 0 ? (p.base === 'ternary' ? 'T' : '1') : String(b.s)).join('');
}
test('[16,7] with MULT plays the 12 beats PRIME shows and outputs [112] in binary', () => {
  const p = plan('mul', ['16', '7']);
  assert.equal(p.beats.length, 16);
  assert.deepEqual(p.beats.slice(0, 3).map(b => b.kind), ['input', 'deliver', 'fanout']);
  BINARY_16x7.forEach(([kind, cap, digits], n) => {
    const beat = p.beats[3 + n];
    assert.equal(beat.kind, kind); assert.equal(beat.caption, cap, `beat ${3 + n}`);
    if (digits) assert.equal(towerDigits(p, 3 + n), digits, `beat ${3 + n}`);
  });
  assert.deepEqual([p.beats[15].kind, p.beats[15].caption], ['output', 'Output [112].']);
  assert.deepEqual(p.result, {values: ['112'], text: '[112]'});
  assert.deepEqual(p.beats.slice(3, 15).map(b => b.node), ['n1', 'n2', 'n2', 'n3', 'n4', 'n4', 'n5', 'n5', 'n3', 'n3', 'n1', 'n1']);
});
test('[16,7] with MULT in balanced ternary: 7 = 9 − 3 + 1, the same 12 beats, and [112]', () => {
  const p = plan('mul', ['16', '7'], 'ternary');
  assert.equal(p.beats.length, 16);
  for (const [i, [kind, cap, digits]] of Object.entries(TERNARY_16x7)) {
    assert.equal(p.beats[i].kind, kind); assert.equal(p.beats[i].caption, cap, `beat ${i}`);
    if (digits) assert.equal(towerDigits(p, Number(i)), digits, `beat ${i}`);
  }
  for (const i of [5, 8, 10, 12, 14]) assert.equal(p.beats[i].kind, 'return');
  assert.deepEqual(p.beats.slice(3, 15).map(b => b.node), ['n1', 'n2', 'n2', 'n3', 'n4', 'n4', 'n5', 'n5', 'n3', 'n3', 'n1', 'n1']);
  assert.deepEqual(p.result, {values: ['112'], text: '[112]'});
});
test('[7,16] is one SHIFT; 9 × 0 and 0 × 0 are two beats', () => {
  for (const base of ['binary', 'ternary']) {
    assert.deepEqual(plan('mul', ['7', '16'], 'binary').beats.slice(3, -1).map(b => b.kind), ['shift', 'return']);
    for (const inputs of [['9', '0'], ['0', '0']]) {
      const p = plan('mul', inputs, base);
      assert.deepEqual(p.beats.slice(3, -1).map(b => b.kind), ['zero', 'return']);
      assert.equal(p.result.text, '[0]');
    }
  }
  assert.equal(plan('mul', ['16', '0']).beats[3].caption, '16 × 0: no lit bulbs to shift. 0.');
});
test('[45,6] divides in 16 beats to [7, 3], labelled q 7 · r 3', () => {
  for (const op of ['div', 'mod']) {
    const p = plan(op, ['45', '6']), work = p.beats.slice(3, -1);
    assert.equal(work.length, 16);
    assert.deepEqual(work.map(b => b.kind), ['prep', 'compare', 'descend', 'compare', 'collide', 'borrow', 'descend',
      'compare', 'collide', 'borrow', 'descend', 'compare', 'collide', 'borrow', 'borrow', 'return']);
    assert.deepEqual(p.result, {values: ['7', '3'], text: '[7, 3]', label: 'q 7 · r 3'});
  }
});
test('balanced ternary division rounds to nearest, ties keeping the dividend\'s sign', () => {
  assert.deepEqual(plan('div', ['19', '5'], 'ternary').result, {values: ['4', '-1'], text: '[4, −1]', label: 'q 4 · r −1'});
  assert.deepEqual(plan('mod', ['14', '4'], 'ternary').result.values, ['3', '2']);
  assert.deepEqual(plan('div', ['17', '5'], 'ternary').result.values, ['3', '2']);
  assert.deepEqual(plan('div', ['100', '7'], 'ternary').result.values, ['14', '2']);
  assert.deepEqual(plan('div', ['15', '4'], 'ternary').result.values, ['4', '-1']);
  assert.deepEqual(plan('div', ['15', '4'], 'binary').result.values, ['3', '3']);
  // 100 ÷ 7: the remainders 100 → −89 → −26 → −5 → 2
  const kept = plan('div', ['100', '7'], 'ternary').beats.filter(b => b.kind === 'judge').map(b => b.ledger.r);
  assert.deepEqual(kept, ['-89', '-26', '-5', '2']);
});
test('ternary JUDGE scans |G| against |R| (a red-topped tower flipped) and stops where they first differ', () => {
  // the stop, read independently: the top level where the trits of |R| and |G| differ
  const stopOf = (R, G) => {
    const x = digits(R < 0n ? -R : R, 'ternary'), y = digits(G < 0n ? -G : G, 'ternary');
    for (let l = Math.max(x.length, y.length) - 1; l >= 0; l--) if ((x[l] ?? 0) !== (y[l] ?? 0)) return l;
    return null;
  };
  let judges = 0;
  for (let a = -60; a <= 60; a++) for (let d = -7; d <= 7; d++) {
    if (!d) continue;
    const beats = one('div', [String(a), String(d)], 'ternary').plan.beats;
    beats.forEach((beat, i) => {
      if (beat.kind !== 'judge') return;
      const {a: R, r: G} = beats[i - 1].ledger, scan = beat.marks.find(m => m.k === 'scan');
      assert.equal(scan.stop, stopOf(BigInt(R), BigInt(G)), `${a} ÷ ${d}: R ${R}, G ${G}`);
      judges++;
    });
  }
  assert.ok(judges > 3000, `${judges} judges`);
  // R = −60 (T1T10) against G = 48 (1TT10): flipped, R reads 1T1T0, and the scan stops at level 2
  const judge = one('div', ['-60', '4'], 'ternary').plan.beats.find(b => b.kind === 'judge');
  assert.deepEqual(judge.marks, [{k: 'scan', node: 'n1', from: 4, stop: 2}]);
});
test('SHR truncates like ÷ in binary: [−13,2] → [−3, −1] and [5,4] → [0, 5]', () => {
  assert.deepEqual(plan('shr', ['-13', '2']).result.values, ['-3', '-1']);
  assert.deepEqual(plan('shr', ['5', '4']).result.values, ['0', '5']);
  assert.deepEqual(plan('shr', ['45', '2']).result.values, ['11', '1']);
  assert.deepEqual(plan('shr', ['19', '1'], 'ternary').result.values, ['6', '1']);
  assert.deepEqual(plan('shr', ['20', '1'], 'ternary').result.values, ['7', '-1']);
  assert.deepEqual(plan('shr', ['5', '4'], 'ternary').result.values, ['0', '5']);
  assert.deepEqual(plan('shl', ['5', '3']).result.values, ['40']);
});
test('domain errors are caught before planning and name their block', () => {
  const zero = expression('9/(3-3)');
  assert.equal(zero.ok, false); assert.equal(zero.reason, 'zeroDivision'); assert.equal(zero.node, 'n1');
  assert.equal(zero.message, 'Nothing fits into zero: the ÷ block\'s divisor is 3 − 3 = 0');
  const mod = expression('(3-3)%2');
  assert.ok(mod.ok); assert.deepEqual(mod.plan.result.values, ['0', '0']); assert.equal(mod.plan.result.text, '[0, 0]');
  assert.deepEqual(validatePlan(mod.plan), []);
  const shift = expression('shl(5, 1-3)');
  assert.equal(shift.ok, false); assert.equal(shift.reason, 'domain'); assert.equal(shift.node, 'n1');
  const typed = one('shl', ['5', '-2']);
  assert.equal(typed.reason, 'domain');
});
// A count fed by a division is a fraction (Q + R/arg) until the division's RETURN, and a
// fraction, or a negative one, is no count: the shift stays symbolic, constant, till then.
test('evaluateScene keeps a shift symbolic while a running division feeds its count', () => {
  const p = expression('shl(5, 7/2)').plan;
  const seen = [...new Set(Array.from({length: p.beats.length + 1}, (_, i) => evaluateScene(snapshotAt(p, i), 'binary')[0]))];
  assert.deepEqual(seen, ['shl(5, 7/2)', '40']);
  assert.deepEqual(validatePlan(p), []);
  for (const [text, base, values] of [['shr(-5, 2/(-11))', 'ternary', ['-5', '0']], ['shr(shl(16,3), 4%(-12))', 'binary', ['8', '0']]]) {
    const r = expression(text, base);
    assert.deepEqual(r.plan.result.values, values, text); assert.deepEqual(validatePlan(r.plan), [], text);
  }
});
test('COMPLEMENT ends in lamp normal form for −1, −2, −4 and −2^62; NOT 0 = −1 and NOT −1 = 0', () => {
  for (const v of [-1n, -2n, -4n, -(2n ** 62n), -6n, -5n]) {
    const p = plan('and', [String(v), String(v)]);
    const flips = p.beats.filter(b => b.kind === 'addone');
    assert.equal(flips.length, 2);
    // after the first conversion the left tower is v in lamp normal form
    const i = p.beats.indexOf(flips[0]) + 1, scene = snapshotAt(p, i), t = p.beats[i - 1].set.towers && Object.keys(p.beats[i - 1].set.towers)[0];
    const bulbs = Object.values(scene.bulbs).filter(b => b.t === t), lamp = bulbs.find(b => b.k === 'lamp'), bits = bulbs.filter(b => !b.k).sort((x, y) => x.l - y.l);
    const want = twos(v);
    assert.deepEqual(bits.map(b => b.s), [...want.bits], String(v));
    assert.equal(lamp.s, -want.lamp); assert.equal(lamp.l, want.bits.length);
    assert.deepEqual(p.result.values, [String(v)]);
  }
  assert.deepEqual(plan('not', ['0']).result.values, ['-1']);
  assert.deepEqual(plan('not', ['-1']).result.values, ['0']);
  assert.deepEqual(plan('not', ['5']).result, {values: ['-6'], text: '[−6]'});
  const notFive = plan('not', ['5']), out = snapshotAt(notFive, notFive.beats.length);
  assert.equal(Object.values(out.towers)[0].digits, '…1010₂');
});
// The registry seam (6.6): a base registered from outside plays through plan.js's flow beats
// and the builder exactly as 6.5's MEASURE 3 fixture. This stub stands in for base e (B's
// e-base.js); it knows only the one value it is asked about.
const PLAN_E_MEASURE_3 = {"v":1,"base":"e","pace":"together","tree":{"n1":{"op":"measure","parent":"io","socket":"C"}},"inputs":["3"],
 "start":{"nodes":{"n1":{"op":"measure","parent":"io","socket":"C"}},
  "towers":{"t1":{"at":"in:0","form":"light","value":"3","text":"3","reading":"ln 3 ≈ 1.0986"}},
  "bulbs":{"b1":{"t":"t1","l":1.0986,"s":1,"k":"light"}}},
 "beats":[
 {"i":0,"kind":"input","node":"io","caption":"[3] goes in.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"io:0"}}}},
 {"i":1,"kind":"deliver","node":"n1","caption":"3 rides down the wire to the ruler.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.C:0"}}}},
 {"i":2,"kind":"fanout","node":"n1","caption":"3 arrives as one light at height ln 3 ≈ 1.0986.","ledger":{"law":"move"},"set":{"towers":{"t1":{"at":"n1.C"}}}},
 {"i":3,"kind":"unfold","node":"n1","caption":"The light falls and leaves the bulbs that fit: 3 = 10.020…ₑ.","ledger":{"law":"unfold","value":"3"},
  "set":{"nodes":{"n1":{"glyph":0}},"towers":{"t1":{"form":"tower","dust":true,"digits":"10.020…ₑ","reading":null}},
         "bulbs":{"b1":null,"b2":{"t":"t1","l":1,"s":1,"slot":0},"b3":{"t":"t1","l":-2,"s":1,"slot":0},"b4":{"t":"t1","l":-2,"s":1,"slot":1}}},
  "motion":{"b1":{"path":[[0,1.0986],[0.45,-1.2668],[0.9,-4.5055]],"fade":[0.9,1]},
            "b2":{"in":[0.0095,0.0905],"grow":true},"b3":{"in":[0.5042,0.5852],"grow":true},"b4":{"in":[0.5042,0.5852],"grow":true}}},
 {"i":4,"kind":"return","node":"n1","caption":"3 rides up into the triangle.","ledger":{"law":"move","value":"3"},"set":{"nodes":{"n1":null},"towers":{"t1":{"at":"io:0"}}}},
 {"i":5,"kind":"output","node":"io","caption":"Output [3].","ledger":{"law":"move","value":"3"},"set":{"towers":{"t1":{"at":"out:0","form":"coin"}}}}],
 "result":{"values":["3"],"text":"[3]"},
 "stats":{"beats":6,"nodes":1,"maxLevels":5,"maxBulbs":3}};
test('a base registered from outside plays through the flow beats exactly as the MEASURE 3 fixture (6.5)', async () => {
  const {registerBase, hasBase} = await import('../src/machine/registry.js');
  if (hasBase('e')) return;     // the real base e is loaded: its own tests cover this
  registerBase('e', {
    id: 'e', palette: ['measure'],
    parseValue: text => text === '3' ? {ok: true, value: '3'} : {ok: false, error: 'stub'},
    evaluate: (op, args) => ({ok: true, values: [args[0]]}),
    display: (value, {form}) => form === 'light' ? {text: '3', reading: 'ln 3 ≈ 1.0986'} : {text: '3', digits: '10.020…ₑ'},
    checkLimits: () => null, validateTower: () => [],
    place(b, t, value, {asLight}) {
      if (!asLight || b.scene.towers[t].form === 'light') return;
      b.tower(t, {form: 'light'}); b.bulb(b.id('b'), {t, l: 1.0986, s: 1, k: 'light'});
    },
    ops: {measure(b, node, [t]) {
      b.begin('unfold', node, {caption: 'The light falls and leaves the bulbs that fit: 3 = 10.020…ₑ.', ledger: {law: 'unfold', value: '3'}});
      b.node(node, {glyph: 0});
      b.tower(t, {form: 'tower', dust: true});
      const [[light]] = b.bulbsOf(t);
      b.drop(light, {path: [[0, 1.0986], [0.45, -1.2668], [0.9, -4.5055]], fade: [0.9, 1]});
      b.bulb(b.id('b'), {t, l: 1, s: 1, slot: 0}, {in: [0.0095, 0.0905], grow: true});
      b.bulb(b.id('b'), {t, l: -2, s: 1, slot: 0}, {in: [0.5042, 0.5852], grow: true});
      b.bulb(b.id('b'), {t, l: -2, s: 1, slot: 1}, {in: [0.5042, 0.5852], grow: true});
      b.end();
      return {result: t};
    }},
  });
  const r = planMachine({tree: {n1: {op: 'measure', parent: 'io', socket: 'C'}}, inputs: ['3'], base: 'e'});
  assert.ok(r.ok, r.message);
  for (const want of fixture('e-measure-3', PLAN_E_MEASURE_3)) assert.deepEqual(JSON.parse(JSON.stringify(r.plan)), want);
  assert.deepEqual(validatePlan(r.plan), []);
});
// 6.10: a computed value past a base's reach is tooBig before planning, and the exact answer
// comes with it when the base can still give it with {limits: false} (base e's e²⁰, as
// binary's shl(5, 70) does through its tower cap). A base that ignores the option refuses
// without an answer.
test('a computed value past a base\'s reach is tooBig, with the exact answer when the base gives it unlimited', async () => {
  const {registerBase} = await import('../src/machine/registry.js');
  const capped = honours => ({
    id: 'capped', palette: ['add', 'mul'],
    parseValue: text => /^-?\d+$/.test(text) ? {ok: true, value: text} : {ok: false, error: 'not whole'},
    evaluate(op, args, {limits = true} = {}) {
      const v = op === 'add' ? BigInt(args[0]) + BigInt(args[1]) : BigInt(args[0]) * BigInt(args[1]);
      return v > 100n && (limits || !honours) ? {ok: false, reason: 'tooBig', message: `${v} is past 100`} : {ok: true, values: [String(v)]};
    },
    display: value => ({text: value}), checkLimits: () => null, validateTower: () => [], place() {}, ops: {},
  });
  const tree = {n1: {op: 'add', parent: 'io', socket: 'C'}, n2: {op: 'mul', parent: 'n1', socket: 'L'}};
  registerBase('capped', capped(true));
  assert.deepEqual(planMachine({tree, inputs: ['20', '6', '1'], base: 'capped'}),
    {ok: false, reason: 'tooBig', message: 'Too big to animate step by step; here is the exact answer.', node: 'n2', result: {values: ['121'], text: '[121]'}});
  registerBase('capped', capped(false));
  assert.deepEqual(planMachine({tree, inputs: ['20', '6', '1'], base: 'capped'}), {ok: false, reason: 'tooBig', message: '120 is past 100', node: 'n2'});
});
// A split's partial product may lie past the base's reach though the whole product does not:
// 1/1000000 × e⁻³ is below base e's rail. validatePlan must still return its findings, not throw.
test('validatePlan reads a base-e plan whose split makes a part the base will not evaluate', async () => {
  await import('../src/machine/e-base.js');
  for (const text of ['1/1000000*(e+e^-3)', '1/100000*(e^2+e^-3)', '1/1000000*(-e-e^-3)']) {
    const e = parseExpression(text, 'e'), r = planMachine({tree: e.tree, inputs: e.inputs, base: 'e'});
    assert.ok(r.ok, r.message);
    assert.deepEqual(validatePlan(r.plan), [], text);
  }
});
test('PRIME regressions: 7 + 5 = 12, 9 + 5 = 14, the 40 + 15 label on top, 257, 1024, 0 + 0, [5, 3]', () => {
  assert.equal(plan('add', ['7', '5']).result.text, '[12]');
  assert.equal(plan('add', ['9', '5']).result.text, '[14]');
  const p = plan('add', ['40', '15']), end = snapshotAt(p, 4), t = Object.values(end.towers)[0];
  assert.equal(t.text, '55');
  assert.equal(Math.max(...Object.values(end.bulbs).map(b => b.l)), 5, 'the label sits on 110111, not inside it');
  assert.equal(plan('add', ['256', '1']).result.text, '[257]');
  assert.equal(plan('add', ['1023', '1']).result.text, '[1024]');
  assert.equal(plan('mul', ['32', '32']).result.text, '[1024]');
  assert.equal(plan('add', ['0', '0']).result.text, '[0]');
  assert.deepEqual(parseInput('[5, 3]', 'binary').values, ['5', '3']);
  assert.deepEqual(planMachine({tree: defaultMachine(), inputs: '[5, 3]', base: 'binary'}).plan.result.values, ['15']);
});
