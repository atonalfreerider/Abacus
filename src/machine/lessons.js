// Guided lessons for the Machine (design 5.4, phase 5), in the Tutor's style: a worked example
// first, then problems of the same shape for the learner. Each lesson is
//   Watch      the example plays with AUTO, carries one level at a time;
//   Predict    a fresh problem plays, and the machine stops before chosen beats to ask what
//              will happen (tap a level on the stage, or a choice); the beat then shows it;
//   Your turn  another fresh problem, which the learner builds (hang the block, type the
//              numbers, Enter), predicting at the same stops.
// The questions and their answers are read from the plan the machine is about to play, so
// they can never disagree with what the bulbs then do. This list is separate from tutor.js's
// `lessons` (those run through EquationModel in decimal); app.js lists it under a Machine
// heading and opens it with startMachineLesson, which never touches the equation space.
import { random } from '../mvc/tutor.js';
import { planMachine } from './plan.js';
import { snapshotAt } from './scene.js';
import { attach } from './tree.js';

const pick = (r, items) => items[r(0, items.length - 1)];
const minus = v => String(v).replace('-', '−');
const bracket = v => String(v).startsWith('-') ? `(${minus(v)})` : minus(v);
const SYMBOL = { add: '+', sub: '−', mul: '×', div: '÷', shl: '×', shr: '÷', and: 'AND', or: 'OR', xor: 'XOR' };
const BLOCK = { add: 'ADD (+)', sub: 'SUB (−)', mul: 'MULT (×)', div: 'DIV (÷)', shl: 'SHL', shr: 'SHR', and: 'AND', or: 'OR', xor: 'XOR' };
const BASE = { binary: 'base 2', ternary: 'balanced ternary', e: 'base e' };
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = k => String(k).replace(/\d/g, d => SUP[d]).replace('-', '⁻');
const bits = v => { let n = BigInt(v), k = 0; if (n < 0n) n = -n; while (n > 0n) { n >>= 1n; k++; } return k; };
const trits = v => { let n = BigInt(v), out = []; while (n !== 0n) { let d = ((n % 3n) + 3n) % 3n; if (d === 2n) d = -1n; out.push(Number(d)); n = (n - d) / 3n; } return out; };
const levelChoices = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => ({ label: `Level ${lo + i}`, value: lo + i }));
const yesNo = [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }];

// What a beat does to the bulbs: the scenes on either side of it.
const before = (plan, i) => snapshotAt(plan, i), after = (plan, i) => snapshotAt(plan, i + 1);
const towerAt = (scene, at) => Object.keys(scene.towers).find(id => scene.towers[id].at === at) ?? null;
// Level pace: the lowest level of the pending tower that still has bulbs waiting in a lane.
function waitingLevel(scene, node) {
  const t = towerAt(scene, `${node}.C`), lanes = Object.values(scene.bulbs).filter(b => b.t === t && b.slot);
  return lanes.length ? Math.min(...lanes.map(b => b.l)) : null;
}
// The carry that climbs out of level k in beat i, if any: a bulb that rose from k to k + 1.
function climber(plan, i, k) {
  const a = before(plan, i), b = after(plan, i);
  const id = Object.keys(b.bulbs).find(id => a.bulbs[id] && b.bulbs[id].l === k + 1 && b.bulbs[id].slot && (a.bulbs[id].l === k));
  return id ? b.bulbs[id] : null;
}

// Every lesson: {id, title, base, pace, example, make(r) → {op, inputs}, intro, pauses}.
// A pause {beatKind, limit, ask(plan, i, problem)} returns null to skip that beat, or
// {question, choices: [{label, value}], answer, explain, hint?, tap?: {tower}} where a tap
// on the stage at a level of `tower` answers with that level.
export const lessons = [
  { id: 'machine-split', title: 'Split and shift', base: 'binary', example: { op: 'mul', inputs: ['16', '7'] },
    intro: 'PRIME multiplies by splitting the second number into its lit bulbs: 16 × 7 = 16 × 4 + 16 × 3. Each part is a shift, and the parts are added back up.',
    make: r => { const a = r(5, 27); let b; do b = r(3, 15); while (bits(b) < 2 || [...b.toString(2)].filter(c => c === '1').length < 2); return { op: 'mul', inputs: [String(a), String(b)] }; },
    pauses: [
      { beatKind: 'split', limit: 1, ask(plan, i) {
        const { b, t, r } = plan.beats[i].ledger, k = bits(t) - 1, node = plan.beats[i].node;
        return { question: `${minus(b)} splits into its top lit bulb and the rest. Which level is that top bulb on? Tap it.`, choices: levelChoices(0, bits(b) - 1), answer: k,
          explain: `Level ${k}: ${minus(b)} = ${t} + ${r}.`, hint: 'Count up from the socket: the bottom bulb is level 0.', tap: { tower: towerAt(before(plan, i), `${node}.R`) } };
      } },
      { beatKind: 'shift', limit: 2, ask(plan, i) {
        const { a, m, k } = plan.beats[i].ledger;
        return { question: `${minus(a)} × ${bracket(m)}: how many levels will ${minus(a)} rise?`, choices: Array.from({ length: Math.max(4, k + 2) }, (_, j) => ({ label: String(j), value: j })), answer: k,
          explain: `${k}: ${m} = 2${sup(k)}, so ${minus(a)} rises ${k} level${k === 1 ? '' : 's'}.`, hint: `${m} is one lit bulb: on which level?` };
      } },
    ] },
  { id: 'machine-carry', title: 'Carries climb', base: 'binary', example: { op: 'add', inputs: ['13', '9'] },
    intro: 'Adding is a collision, level by level. Two lit bulbs on one level make 2: the bulb that was there climbs one level as the carry, and a dark bulb stays.',
    make: r => { let a, b; do { a = r(5, 30); b = r(3, 30); } while (!(a & b)); return { op: 'add', inputs: [String(a), String(b)] }; },
    pauses: [
      { beatKind: 'collide', limit: 1, ask(plan, i) {
        const up = climber(plan, i, 0);
        return { question: 'Level 0 resolves first. Will a carry climb out of it?', choices: yesNo, answer: up ? 'yes' : 'no',
          explain: up ? 'Two lit bulbs make 2 = 10₂: one climbs to level 1 as the carry.' : 'At most one lit bulb: level 0 keeps it, and nothing climbs.', hint: 'Two lit bulbs on a level make a carry.' };
      } },
      { beatKind: 'carry', limit: 3, ask(plan, i) {
        const k = waitingLevel(before(plan, i), plan.beats[i].node); if (k === null) return null;
        const up = climber(plan, i, k);
        return { question: `Level ${k}: will a carry climb to level ${k + 1}?`, choices: yesNo, answer: up ? 'yes' : 'no',
          explain: up ? `Level ${k} holds 2 or more lit bulbs, the carry included, so one climbs.` : `Level ${k} holds at most one lit bulb, so nothing climbs.`, hint: 'Count the lit bulbs waiting at that level, the carry included.' };
      } },
    ] },
  { id: 'machine-borrow', title: 'Borrowing', base: 'binary', example: { op: 'sub', inputs: ['12', '5'] },
    intro: 'Subtracting 5 adds −5: red bulbs. A blue and a red bulb on one level cancel. A red bulb on a dark level is owed, and a blue bulb from above comes down to pay it.',
    make: r => { let a, b, plan; do { a = r(9, 40); b = r(3, a - 2); plan = planFor({ op: 'sub', inputs: [String(a), String(b)] }, 'binary'); } while (!plan?.beats.some(x => x.kind === 'borrow')); return { op: 'sub', inputs: [String(a), String(b)] }; },
    pauses: [
      { beatKind: 'borrow', limit: 2, ask(plan, i) {
        const a = before(plan, i), b = after(plan, i), id = Object.keys(b.bulbs).find(id => a.bulbs[id] && b.bulbs[id].l < a.bulbs[id].l);
        if (!id) return null;
        const j = a.bulbs[id].l, k = b.bulbs[id].l, top = Math.max(...Object.values(a.bulbs).filter(x => x.t === a.bulbs[id].t).map(x => x.l));
        return { question: `Level ${k} is owed. Which bulb comes down to pay it? Tap its level.`, choices: levelChoices(k + 1, top), answer: j,
          explain: `Level ${j}: the nearest blue bulb above comes down, lighting the levels it passes.`, hint: 'Look above the owed level for the nearest blue bulb.', tap: { tower: a.bulbs[id].t } };
      } },
    ] },
  { id: 'machine-shift', title: 'Shifts', base: 'binary', example: { op: 'shl', inputs: ['5', '3'] },
    intro: 'Multiplying by 2ᵏ lifts every bulb k levels, and dark bulbs slide in underneath. Dividing by 2ᵏ drops it k levels: the bottom k bulbs fall out as the remainder.',
    make: r => r(0, 1) ? { op: 'shl', inputs: [String(r(3, 25)), String(r(1, 4))] } : { op: 'shr', inputs: [String(r(20, 120)), String(r(1, 3))] },
    pauses: [
      { beatKind: 'shift', limit: 1, ask(plan, i) {
        const { a, k } = plan.beats[i].ledger, node = plan.beats[i].node;
        return { question: `${minus(a)} × 2${sup(k)}: which level will its bottom bulb (level 0) land on? Tap it.`, choices: levelChoices(0, k + 2), answer: k,
          explain: `Level ${k}: every bulb rises ${k}.`, hint: `2${sup(k)} lifts by ${k}.`, tap: { tower: towerAt(before(plan, i), `${node}.L`) } };
      } },
      { beatKind: 'drop', limit: 1, ask(plan, i) {
        const { a, q, r } = plan.beats[i].ledger, k = bits(plan.beats[i].ledger.b) - 1;
        // the remainder, the quotient, and one bulb too many (a likely slip)
        const slip = String(BigInt(a) % (1n << BigInt(k + 1)));
        const choices = [...new Set([r, q, slip])].map(v => ({ label: minus(v), value: v })).sort((x, y) => Number(x.value) - Number(y.value));
        return { question: `${minus(a)} ÷ 2${sup(k)}: what will the remainder be?`, choices, answer: r,
          explain: `${minus(r)}: the bottom ${k} bulb${k === 1 ? '' : 's'} fall out, and ${minus(q)} is left.`, hint: `Read the bottom ${k} bulb${k === 1 ? '' : 's'} as a number.` };
      } },
    ] },
  { id: 'machine-divide', title: 'Long division', base: 'binary', example: { op: 'div', inputs: ['45', '6'] },
    intro: 'Division compares and subtracts, top level first. The divisor is lifted under the dividend\'s top; where it fits it is taken away and that quotient bulb lights, then it drops one level.',
    make: r => { const d = r(3, 7), q = r(3, 15); return { op: 'div', inputs: [String(d * q + r(0, d - 1)), String(d)] }; },
    pauses: [
      { beatKind: 'compare', limit: 3, ask(plan, i) {
        const { a, b, out } = plan.beats[i].ledger;
        return { question: `Does ${b} fit in ${a}?`, choices: yesNo, answer: Number(out) >= 0 ? 'yes' : 'no',
          explain: Number(out) >= 0 ? `${b} ≤ ${a}: it is taken away, and a quotient bulb lights.` : `${b} > ${a}: this quotient bulb stays dark.`, hint: 'Compare from the top level down.' };
      } },
    ] },
  { id: 'machine-gates', title: 'Gates', base: 'binary', example: { op: 'and', inputs: ['12', '10'] },
    intro: 'Logic gates collide level by level too, but nothing climbs. AND keeps a bulb lit only where both are lit, OR where either is, XOR where exactly one is.',
    make: r => { let a, b; do { a = r(5, 31); b = r(5, 31); } while (a === b || new Set([a & b, a | b, a ^ b]).size < 3); return { op: pick(r, ['and', 'or', 'xor']), inputs: [String(a), String(b)] }; },
    pauses: [
      { beatKind: 'gate', limit: 1, ask(plan, i) {
        const { op, a, b, out } = plan.beats[i].ledger, x = BigInt(a), y = BigInt(b);
        const options = [...new Set([x & y, x | y, x ^ y].map(String))];
        const rule = { and: 'a dark bulb wins', or: 'a lit bulb wins', xor: 'two lit bulbs cancel, and the carry evaporates' }[op];
        return { question: `${a} ${op.toUpperCase()} ${b}: what will come out?`, choices: options.sort((p, q) => Number(p) - Number(q)).map(v => ({ label: v, value: v })), answer: out,
          explain: `${out}: ${op.toUpperCase()}, ${rule}.`, hint: `${op.toUpperCase()}: ${rule}.` };
      } },
    ] },
  { id: 'machine-trits', title: 'Trits', base: 'ternary', example: { op: 'add', inputs: ['5', '7'] },
    intro: 'Balanced ternary: each level is worth 3 of the one below, and a bulb is blue (1), dark (0) or red (−1), so no minus sign is needed. Blue and red cancel; two like bulbs make a carry of their colour and leave the other colour behind.',
    make: r => { let a, b, plan; do { a = r(2, 40); b = r(2, 40); plan = planFor({ op: 'add', inputs: [String(a), String(b)] }, 'ternary', 'level'); } while (!plan?.beats.some(x => x.kind === 'carry')); return { op: 'add', inputs: [String(a), String(b)] }; },
    pauses: [
      { beatKind: 'collide', limit: 1, ask(plan, i) { return tritQuestion(plan, i, 0); } },
      { beatKind: 'carry', limit: 2, ask(plan, i) { const k = waitingLevel(before(plan, i), plan.beats[i].node); return k === null ? null : tritQuestion(plan, i, k); } },
    ] },
  { id: 'machine-nearest', title: 'Closest to zero', base: 'ternary', example: { op: 'div', inputs: ['19', '5'] },
    intro: 'Balanced ternary divides to the nearest: each round tries taking the divisor away, and keeps whichever remainder is nearer zero. So the remainder is never more than half the divisor.',
    make: r => { const d = r(2, 9); let a; do a = r(d + 1, 9 * d); while (a % d === 0); return { op: 'div', inputs: [String(a), String(d)] }; },
    pauses: [
      { beatKind: 'judge', limit: 2, ask(plan, i) {
        const tryBeat = plan.beats[i - 1]; if (tryBeat?.kind !== 'try') return null;
        const { a: R, r: G } = tryBeat.ledger, keep = plan.beats[i].ledger.q !== '0';
        return { question: `The try left ${minus(G)}. Keep it, or stay with ${minus(R)}?`, choices: [{ label: `Keep ${minus(G)}`, value: 'keep' }, { label: `Stay with ${minus(R)}`, value: 'stay' }], answer: keep ? 'keep' : 'stay',
          explain: keep ? `Keep ${minus(G)}: it is nearer zero than ${minus(R)}.` : `Stay with ${minus(R)}: ${BigInt(G) === -BigInt(R) ? 'a tie keeps the dividend\'s sign' : `it is nearer zero than ${minus(G)}`}.`, hint: 'Keep whichever is nearer zero.' };
      } },
    ] },
  { id: 'machine-efold', title: 'Base-e fold', base: 'e', example: { op: 'add', inputs: ['16', '7'] },
    intro: 'In base e no whole number of bulbs fills a level. Adding piles the bulbs up and folds them into one light at height ln x; the light falls, leaving a bulb at each level it can afford.',
    make: r => ({ op: 'add', inputs: [String(r(2, 30)), String(r(2, 30))] }),
    pauses: [
      { beatKind: 'unfold', limit: 2, ask(plan, i) {
        const node = plan.beats[i].node, scene = before(plan, i);
        const light = Object.values(scene.bulbs).find(b => b.k === 'light' && scene.towers[b.t]?.at?.startsWith(`${node}.`));
        if (!light) return null;
        const h = light.l, k = Math.floor(h + 1e-9);
        return { question: `The light stands at height ${h.toFixed(2).replace('-', '−')}. Which level gets the next bulb? Tap it.`, choices: levelChoices(Math.max(-3, k - 1), k + 1), answer: k,
          explain: `Level ${minus(k)}: the light falls to the level just below it, e${sup(k)} being the biggest power that fits.`, hint: 'The level just below the light.', tap: { tower: light.t } };
      } },
    ] },
  { id: 'machine-red-copies', title: 'Red copies', base: 'ternary', example: { op: 'mul', inputs: ['16', '7'] },
    intro: 'In balanced ternary 7 = 9 − 3 + 1, so 16 × 7 = 16 × 9 − 16 × 3 + 16. A red bulb in the multiplier makes a copy with every colour swapped.',
    make: r => { let b; do b = r(4, 26); while (trits(b).filter(Boolean).length < 2 || !trits(b).includes(-1)); return { op: 'mul', inputs: [String(r(4, 20)), String(b)] }; },
    pauses: [
      { beatKind: 'shift', limit: 2, ask(plan, i) {
        const { a, m } = plan.beats[i].ledger, swap = m.startsWith('-');
        return { question: `${minus(a)} × ${bracket(m)}: will the copy keep its colours, or swap them?`, choices: [{ label: 'Keep them', value: 'keep' }, { label: 'Swap them', value: 'swap' }], answer: swap ? 'swap' : 'keep',
          explain: swap ? `Swap: ${minus(m)} is a red bulb, so the copy is negated.` : `Keep: ${minus(m)} is a blue bulb.`, hint: 'What colour is the multiplier\'s bulb?' };
      } },
    ] },
];
// A level-pace ternary question: which colour of carry, if any, climbs out of level k.
function tritQuestion(plan, i, k) {
  const up = climber(plan, i, k), answer = !up ? 'none' : up.s > 0 ? 'blue' : 'red';
  return { question: `Level ${k}: what climbs to level ${k + 1}?`, choices: [{ label: 'A blue carry', value: 'blue' }, { label: 'A red carry', value: 'red' }, { label: 'Nothing', value: 'none' }], answer,
    explain: answer === 'none' ? `Nothing: level ${k} adds up to −1, 0 or 1.` : answer === 'blue' ? `A blue carry: level ${k} adds up to 2 or 3, and 2 = 3 − 1.` : `A red carry: level ${k} adds up to −2 or −3, and −2 = −3 + 1.`,
    hint: 'Add the level up: blue is 1, red is −1. 2 or more sends a blue carry, −2 or less a red one.' };
}

export const lessonById = id => lessons.find(l => l.id === id) ?? null;
const treeOf = op => attach({}, 'io', op).tree;
const planCache = new Map();
function planFor({ op, inputs }, base, pace = 'level') {
  const key = `${base}|${pace}|${op}|${inputs}`;
  if (!planCache.has(key)) { if (planCache.size > 400) planCache.clear(); const r = planMachine({ tree: treeOf(op), inputs, base, pace }); planCache.set(key, r.ok ? r.plan : null); }
  return planCache.get(key);
}
// A problem as the machine loads it.
export function problemOf(lesson, made) {
  const { op, inputs } = made;
  return { op, inputs: inputs.map(String), base: lesson.base, pace: 'level', tree: treeOf(op), text: problemText(op, inputs), block: BLOCK[op] };
}
export function problemText(op, [a, b]) {
  if (op === 'shl') return `${minus(a)} × 2${sup(b)}`;
  if (op === 'shr') return `${minus(a)} ÷ 2${sup(b)}`;
  return `${minus(a)} ${SYMBOL[op] ?? op} ${bracket(b)}`;
}
export const describe = lesson => `${problemText(lesson.example.op, lesson.example.inputs)} in ${BASE[lesson.base]}`;
// The stops in a plan, in order: one per chosen beat, up to each pause's limit.
export function pausesOf(lesson, plan) {
  const out = [];
  for (const pause of lesson.pauses) {
    let used = 0;
    plan.beats.forEach((beat, i) => {
      if (beat.kind !== pause.beatKind || used >= (pause.limit ?? 1)) return;
      const q = pause.ask(plan, i); if (!q) return;
      used++; out.push({ i, kind: beat.kind, ...q });
    });
  }
  return out.sort((a, b) => a.i - b.i);
}
// Does a machine the learner built work out this problem? One block of the right kind under
// the triangle, and the same numbers in Input.
export function matches(problem, tree, inputs) {
  const nodes = Object.values(tree);
  if (nodes.length !== 1 || nodes[0].op !== problem.op || nodes[0].parent !== 'io') return false;
  try { return inputs.length === problem.inputs.length && inputs.every((v, i) => BigInt(v) === BigInt(problem.inputs[i])); } catch { return false; }
}

// One lesson's progress: phase, the problem in play, and the score of predictions.
export class MachineTutor {
  constructor(lesson, seed = Date.now()) {
    this.lesson = lesson; this.random = random(seed); this.phase = 'watch'; this.problem = problemOf(lesson, lesson.example);
    this.right = 0; this.asked = 0; this.hints = 0;
  }
  // A fresh problem of the lesson's shape, never the example or the last one.
  fresh() {
    let made;
    for (let n = 0; n < 20; n++) { made = this.lesson.make(this.random); const p = problemOf(this.lesson, made); if (p.text !== this.problem.text && p.text !== problemOf(this.lesson, this.lesson.example).text) break; }
    return problemOf(this.lesson, made);
  }
  predict() { this.phase = 'predict'; this.problem = this.fresh(); this.right = this.asked = 0; return this.problem; }
  turn() { this.phase = 'turn'; this.problem = this.fresh(); this.right = this.asked = 0; this.hints = 0; return this.problem; }
  answer(q, value) { const ok = String(value) === String(q.answer); this.asked++; if (ok) this.right++; return ok; }
}
