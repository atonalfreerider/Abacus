// Tutor: each lesson shows a worked example step by step, then deals the learner a
// fresh problem of the same shape. Steps come from the model's planner, so the
// narration always matches what the animation shows.
import { EquationModel, math } from './model.js';

export function random(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return (lo, hi) => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return lo + s % (hi - lo + 1); };
}
const pick = (r, items) => items[r(0, items.length - 1)];

export const lessons = [
  { id: 'across', group: 'Moving cards', title: 'Across the mirror', example: 'x+3=7', intro: 'Get x alone. A card that crosses the equals mirror flips its sign.',
    make: r => { const x = r(1, 9), a = r(2, 9); return `x+${a}=${x + a}`; } },
  { id: 'negatives', group: 'Moving cards', title: 'Moving negatives', example: 'x-4=5', intro: 'A red (negative) card turns blue when it crosses.',
    make: r => { const x = r(1, 9), a = r(2, 9); return `x-${a}=${x - a}`; } },
  { id: 'pairs', group: 'Moving cards', title: 'Zero pairs', example: 'x+9-7=6', intro: 'A blue card and a red card cancel. Drop one onto the other.',
    make: r => { const a = r(5, 9), c = r(2, a - 1), x = r(1, 8); return `x+${a}-${c}=${x + a - c}`; } },
  { id: 'groups', group: 'Solving', title: 'Equal groups', example: '3x+2=14', intro: 'Clear the constants, then divide both sides into equal groups.',
    make: r => { const a = r(2, 5), x = r(1, 9), b = r(1, 9); return `${a}x+${b}=${a * x + b}`; } },
  { id: 'both', group: 'Solving', title: 'x on both sides', example: '3x+1=x+9', intro: 'Gather the x cards on one side and the numbers on the other.',
    make: r => { const a = r(3, 6), c = r(1, a - 2), x = r(1, 7), b = r(1, 9); return `${a}x+${b}=${c === 1 ? '' : c}x+${(a - c) * x + b}`; } },
  { id: 'fractions', group: 'Solving', title: 'Fractions', example: 'x/2+1/3=5/6', intro: 'Fractions follow the same balance rules.',
    make: r => { const a = pick(r, [2, 3, 4]), k = r(1, 4), b = pick(r, [2, 3, 5]); return `x/${a}+1/${b}=${k * b + 1}/${b}`; } },
  { id: 'products', group: 'Solving', title: 'Products first', example: '2x+3*4=20', intro: 'Work out a product before moving its card.',
    make: r => { const a = r(2, 4), x = r(1, 6), p = r(2, 5), q = r(2, 5); return `${a}x+${p}*${q}=${a * x + p * q}`; } },
  { id: 'copies', group: 'Multiplying', title: 'Multiply by copying', example: '23*4', intro: 'One factor becomes a line of cards. The other is copied onto every card, and the copies are added. Tap the product to start.',
    make: r => `${r(12, 49)}*${r(2, 5)}` },
  { id: 'tens', group: 'Multiplying', title: 'A two-digit line', example: '23*14', intro: 'A ten-card copies the number one place up: its cards become ten-stacks.',
    make: r => `${r(12, 39)}*${r(11, 19)}` },
  { id: 'decimal-product', group: 'Multiplying', title: 'Decimal copies', example: '2.5*3', intro: 'Copies of a decimal add like any other cards; ten tenths carry into a whole.',
    make: r => `${r(1, 4)}.${r(1, 9)}*${r(2, 4)}` },
  { id: 'long-division', group: 'Dividing', title: 'Long division', example: '156÷12', intro: 'Deal the cards into equal groups, largest place first. Leftover cards unstack into ten of the next place.',
    make: r => { const d = r(3, 9), q = r(12, 60); return `${d * q}÷${d}`; } },
  { id: 'decimal-division', group: 'Dividing', title: 'Remainders become decimals', example: '7÷4', intro: 'A leftover whole card unstacks into ten tenths, and the dealing continues.',
    make: r => { const d = pick(r, [2, 4, 5, 8]); let n = r(d + 1, 9 * d); if (n % d === 0) n++; return `${n}÷${d}`; } },
  { id: 'slices', group: 'Dividing', title: 'Remainders become fractions', example: '7÷3', intro: 'When tenths would never come out even, each leftover card is sliced into equal strips.',
    make: r => { const d = pick(r, [3, 6, 7, 9]); let n = r(d + 1, 5 * d); while (n % d === 0 || math.evaluateStep(math.parseExpression(`${n}÷${d}`)[0]).notation !== 'mixed') n++; return `${n}÷${d}`; } },
  { id: 'fraction-divisor', group: 'Dividing', title: 'Dividing by a fraction', example: '6÷1/2', intro: 'How many halves fit in 6? Turn the fraction over and multiply.',
    make: r => `${r(2, 9)}÷1/${r(2, 5)}` },
  { id: 'carry', group: 'Adding', title: 'Carrying', example: '58+67', intro: 'Ten cards in one place stack into one card of the next place.',
    make: r => { const a = r(15, 89), b = r(15, 89); return (a % 10) + (b % 10) < 10 ? `${a}+${b + (10 - (a % 10 + b % 10))}` : `${a}+${b}`; } },
  { id: 'borrow', group: 'Adding', title: 'Borrowing', example: '503-78', intro: 'A card unstacks into ten of the place below so the red cards have partners.',
    make: r => { const a = r(3, 9) * 100 + r(0, 9), b = r(11, 99); return `${a}-${b}`; } },
];

const text = t => math.termText(t);
const typeset = s => s.replace(/(^|[\s(])-(?=[\dx])/g, '$1−');
const find = (state, id) => [...state.left, ...state.right].find(t => t.id === id);
// One sentence for a planned step, in the learner's terms.
export function narrate(command, state) { return typeset(describe(command, state)); }
function describe(command, state) {
  if (!command) return math.isSolved(state) ? 'Solved: x is alone.' : 'Nothing left to do.';
  if (command.type === 'evaluate') {
    const t = find(state, command.id), [a, b] = t.expr ? t.expr.operands : [], op = t.expr?.ops[0];
    const show = o => math.termText({ kind: 'constant', value: o.value, notation: o.notation, decimalPlaces: o.decimalPlaces });
    if (!t.expr) return `Divide out ${text(t)}: deal the cards into ${t.value.d} equal groups.`;
    if (op === '×') return `Work out ${show(a)} × ${show(b)}: one factor becomes a line of cards, the other is copied onto every card, then the copies are added.`;
    if (b.value.d !== 1) return `Dividing by ${show(b)} asks how many ${show(b)}s fit. Turn the fraction over: ÷ ${show(b)} is × ${math.format(math.div(math.frac(1), b.value))}.`;
    return `Work out ${show(a)} ÷ ${show(b)}: deal the cards into ${show(b)} equal groups, largest place first; unstack leftovers into the next place.`;
  }
  if (command.type === 'combine') {
    const a = find(state, command.id), b = find(state, command.target);
    if (Math.sign(a.value.n) !== Math.sign(b.value.n)) return `${text(a)} and ${text(b)} have opposite signs: their cards cancel in zero pairs. Drop ${text(a)} onto ${text(b)}.`;
    return `Combine ${text(a)} with ${text(b)}: drop one onto the other and the cards add, carrying tens.`;
  }
  if (command.type === 'move') {
    const t = find(state, command.id);
    return `Drag ${text(t)} across the equals mirror. Crossing flips its sign: it becomes ${text(math.negateTerm(t))}.`;
  }
  if (command.type === 'operate') return command.operation === 'divide' ? `Divide both sides by ${command.amount} so one x remains.` : `Multiply both sides by ${command.amount} to make x whole.`;
  if (command.type === 'reorder') return 'Rearrange the cards; the value does not change.';
  return 'Simplify.';
}
// Steps the planner needs from a state (used to judge whether a move helped).
export function remaining(state, expression = false) {
  const m = new EquationModel('0'); m.state = state; m.expression = expression; m.hasVariable = [...state.left, ...state.right].some(t => t.kind === 'variable');
  let n = 0, command;
  while ((command = m.nextStep()) && n < 40) { m.dispatch(command); n++; }
  return n;
}
export const finished = model => model.nextStep() === null;
export function feedback(model, before) {
  if (finished(model)) return { tone: 'done', text: model.expression ? `Done: ${math.sideText(model.state.left)}.` : math.isSolved(model.state) ? `Solved: ${math.equationText(model.state)}.` : `Done: ${math.equationText(model.state)}.` };
  const now = remaining(model.state, model.expression), then = remaining(before, model.expression);
  const next = narrate(model.nextStep(), model.state);
  if (now < then) return { tone: 'good', text: `Good. ${next}` };
  if (now > then) return { tone: 'detour', text: `Still balanced, but that is a detour. Undo (↶) or: ${next}` };
  return { tone: 'neutral', text: `Balanced. Next: ${next}` };
}
export class Tutor {
  constructor(lesson, seed = Date.now()) { this.lesson = lesson; this.random = random(seed); this.phase = 'example'; this.problem = lesson.example; this.hints = 0; }
  practice() {
    let next;
    for (let i = 0; i < 20; i++) { next = this.lesson.make(this.random); if (next !== this.lesson.example && next !== this.problem) break; }
    this.phase = 'practice'; this.problem = next; this.hints = 0; return next;
  }
}
