import {decimalText,numberSpec} from './mvc/numbers.js';
// Exact, bounded rational arithmetic. BigInt intermediates prevent silent rounding.
const LIMIT = BigInt(Number.MAX_SAFE_INTEGER);
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
export function frac(n, d = 1) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) throw new Error('You cannot divide by zero. Choose a nonzero number.');
  if (d < 0n) { n = -n; d = -d; }
  const factor = gcd(n, d); n /= factor; d /= factor;
  if (n > LIMIT || n < -LIMIT || d > LIMIT) throw new Error('That number is too large for this lab. Try smaller values.');
  return { n: Number(n), d: Number(d) };
}
export const add = (a, b) => frac(BigInt(a.n) * BigInt(b.d) + BigInt(b.n) * BigInt(a.d), BigInt(a.d) * BigInt(b.d));
export const neg = a => frac(-a.n, a.d);
export const sub = (a, b) => add(a, neg(b));
export const mul = (a, b) => frac(BigInt(a.n) * BigInt(b.n), BigInt(a.d) * BigInt(b.d));
export const div = (a, b) => frac(BigInt(a.n) * BigInt(b.d), BigInt(a.d) * BigInt(b.n));
export const eq = (a, b) => a.n === b.n && a.d === b.d;
export const numeric = a => a.n / a.d;
const grouped = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const format = a => a.d === 1 ? grouped(a.n) : `${grouped(a.n)}/${grouped(a.d)}`;
export const abs = a => frac(Math.abs(a.n), a.d);
let sequence = 0;
export const term = (kind, value, notation="auto") => ({ id: `t${++sequence}`, kind, value, notation });
// An operation term is a constant whose value is a left-to-right chain such as 23 × 4 ÷ 2.
// Its sign lives on the first operand, so crossing the mirror negates only that operand.
const apply = (value, op, operand) => op === '×' ? mul(value, operand.value) : div(value, operand.value);
export function operationTerm(operands, ops) {
  if (ops.some(op => !['×', '÷'].includes(op)) || operands.length !== ops.length + 1) throw new Error('Unknown operation.');
  if (operands.length > 6) throw new Error('Use up to six numbers in one product.');
  const value = ops.reduce((v, op, i) => apply(v, op, operands[i + 1]), operands[0].value);
  return { ...term('constant', value, 'auto'), expr: { operands, ops } };
}
export function negateTerm(t) {
  if (!t.expr) return { ...t, value: neg(t.value) };
  const [first, ...rest] = t.expr.operands;
  return { ...t, value: neg(t.value), expr: { ...t.expr, operands: [{ ...first, value: neg(first.value) }, ...rest] } };
}
export function scaleTerm(t, factor, op = '×') {
  if (eq(factor, frac(-1)) && op === '×') return negateTerm(t);
  const value = op === '×' ? mul(t.value, factor) : div(t.value, factor);
  if (!t.expr) return { ...t, value };
  return { ...t, value, expr: { operands: [...t.expr.operands, { value: factor, notation: factor.d === 1 ? 'auto' : 'fraction' }], ops: [...t.expr.ops, op] } };
}
// Result notation: decimals stay decimals, fractions stay fractions, and a division
// that does not terminate becomes a mixed number (whole cards plus a sliced card).
export function resultNotation(value, operands, op) {
  if (value.d === 1) return 'auto';
  if (operands.some(o => o.notation === 'fraction')) return 'fraction';
  const text = decimalText(value), terminating = text !== null && text.split('.')[1].length <= 6;
  return terminating ? 'decimal' : op === '÷' ? 'mixed' : 'fraction';
}
// One visible step: evaluate the first pair of an operation chain, or divide out a fraction.
export function evaluateStep(t) {
  if (t.expr) {
    const [a, b, ...rest] = t.expr.operands, [op, ...ops] = t.expr.ops;
    // Dividing by a fraction first flips it: ÷ 1/2 asks how many halves, which is × 2.
    if (op === '÷' && b.value.d !== 1) return { ...t, expr: { operands: [a, { value: div(frac(1), b.value), notation: b.value.n === 1 || b.value.n === -1 ? 'auto' : 'fraction' }, ...rest], ops: ['×', ...ops] } };
    const value = apply(a.value, op, b), notation = resultNotation(value, [a, b], op);
    const result = { value, notation };
    if (!rest.length) { const { expr, ...plain } = t; return { ...plain, value: t.value, notation, decimalPlaces: undefined }; }
    return { ...t, expr: { operands: [result, ...rest], ops } };
  }
  if (t.kind === 'constant' && t.value.d !== 1 && t.notation === 'fraction') {
    const decimal = decimalText(t.value);
    if (decimal !== null && decimal.split('.')[1].length <= 6) return { ...t, notation: 'decimal', decimalPlaces: undefined };
    if (Math.abs(t.value.n) > t.value.d) return { ...t, notation: 'mixed' };
  }
  return null;
}
export const evaluable = t => evaluateStep(t) !== null;

function decimal(text) {
  const [whole, dec = ''] = text.split('.');
  if (dec.length > 6) throw new Error('Use up to six decimal places, or enter an exact fraction.');
  return frac(BigInt((whole || '0') + dec), 10n ** BigInt(dec.length));
}

// Recursive descent linear-expression parser. No eval or dynamically executed input.
export function parseExpression(text) {
  if (text.length > 180) throw new Error('Keep your expression under 180 characters.');
  const input = text.replace(/\d[\d,]*(?:\.\d*)?/g, number => {
    if(number.includes(',') && !/^\d{1,3}(?:,\d{3})+(?:\.\d*)?$/.test(number)) throw new Error('Group digits in threes at commas, for example 1,234,567.');
    return number.replaceAll(',','');
  }).replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/[÷:]/g, '÷').toLowerCase();
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[x()+\-*/÷]|\S/g) || [];
  let index = 0;
  const peek = () => tokens[index];
  const scalar = items => items.every(t => t.kind === 'constant');
  const sum = items => items.reduce((value, t) => add(value, t.value), frac(0));
  const scale = (items, factor) => items.map(t => ({...scaleTerm(t, factor), id: term(t.kind, t.value).id}));
  function primary() {
    const token = tokens[index++];
    if (token === '(') {
      const value = expression();
      if (tokens[index++] !== ')') throw new Error('Close each parenthesis, for example 2(x + 3).');
      return value;
    }
    if (token === 'x') return [term('variable', frac(1))];
    if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return [{...term('constant', decimal(token),token.includes('.')?'decimal':'auto'),...(token.includes('.')?{decimalPlaces:token.split('.')[1].length}:{})}];
    throw new Error('Use numbers, x, +, −, ×, ÷, and parentheses. Example: 2x + 3 = 11.');
  }
  function unary() {
    if (peek() === '+') { index++; return unary(); }
    if (peek() === '-') { index++; return scale(unary(), frac(-1)); }
    return primary();
  }
  function product() {
    const factors = [unary()], ops = [];
    while (['*', '/', '÷', 'x', '('].includes(peek())) {
      ops.push(['*', '/', '÷'].includes(peek()) ? tokens[index++] : '*');
      factors.push(unary());
    }
    if (ops.length && factors.every(scalar)) return [chain(factors, ops)];
    let value = factors[0];
    ops.forEach((operator, i) => {
      const right = factors[i + 1];
      if (operator !== '*') {
        if (!scalar(right)) throw new Error('This lab supports linear equations. Divide by a number, such as x/3.');
        value = scale(value, div(frac(1), sum(right))).map(t=>({...t,notation:t.notation==='decimal'||right.some(r=>r.notation==='decimal')?'decimal':'fraction'}));
      } else if (scalar(right)) value = scale(value, sum(right)).map(t=>({...t,notation:t.notation==='decimal'||right.some(r=>r.notation==='decimal')?'decimal':t.notation}));
      else if (scalar(value)) value = scale(right, sum(value));
      else throw new Error('This lab supports linear equations with x. Try 3x instead of x × x.');
    });
    return value;
  }
  // Numbers joined by × or ÷ stay one unevaluated term, so the work can be shown.
  // A slash between two numbers is a fraction literal, as before.
  function chain(factors, ops) {
    const operands = [], kept = [];
    factors.forEach((items, i) => {
      const next = operandOf(items);
      if (i && ops[i - 1] === '/') {
        const previous = operands.pop();
        operands.push({ value: div(previous.value, next.value), notation: previous.notation === 'decimal' || next.notation === 'decimal' ? 'decimal' : 'fraction' });
      } else { if (i) kept.push(ops[i - 1] === '*' ? '×' : '÷'); operands.push(next); }
    });
    if (operands.length === 1) return { ...term('constant', operands[0].value, operands[0].notation), ...(operands[0].decimalPlaces ? { decimalPlaces: operands[0].decimalPlaces } : {}) };
    return operationTerm(operands, kept);
  }
  function operandOf(items) {
    if (items.length === 1 && !items[0].expr) return { value: items[0].value, notation: items[0].notation, ...(items[0].decimalPlaces ? { decimalPlaces: items[0].decimalPlaces } : {}) };
    const notation = items.some(t => t.notation === 'decimal') ? 'decimal' : items.some(t => t.notation === 'fraction') ? 'fraction' : 'auto';
    return { value: sum(items), notation };
  }
  function expression() {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const operator = tokens[index++];
      const right = product();
      value = value.concat(operator === '-' ? scale(right, frac(-1)) : right);
    }
    return value;
  }
  if (!tokens.length) throw new Error('Enter a number or expression on each side of the equals sign.');
  const result = expression();
  if (index < tokens.length) throw new Error(`“${tokens[index]}” is not supported. Use one variable, x, and arithmetic operations.`);
  if (result.length > 16) throw new Error('Use up to 16 terms on each side so the blocks have room.');
  return result.filter(t => t.value.n !== 0 || t.notation==='decimal');
}
export function parseEquation(text) {
  const sides = text.split('=');
  if (sides.length !== 2) throw new Error('Use exactly one equals sign, for example x + 3 = 7.');
  return { left: parseExpression(sides[0]), right: parseExpression(sides[1]) };
}
export function parseScalar(text) {
  const items = parseExpression(text);
  if (items.some(t => t.kind === 'variable')) throw new Error('Enter a number or fraction, such as 2 or 1/3.');
  return items.reduce((a, t) => add(a, t.value), frac(0));
}
export const totals = items => items.reduce((a, t) => ({ ...a, [t.kind]: add(a[t.kind], t.value) }), { variable: frac(0), constant: frac(0) });
export function evaluate(items, x) { const value = totals(items); return add(mul(value.variable, x), value.constant); }
export function solution(equation) {
  const l = totals(equation.left), r = totals(equation.right);
  const a = sub(l.variable, r.variable), b = sub(r.constant, l.constant);
  if (a.n === 0) return { type: b.n === 0 ? 'identity' : 'impossible' };
  return { type: 'unique', value: div(b, a) };
}
export function isSolved(equation) {
  const isolate = (a, b) => a.length === 1 && a[0].kind === 'variable' && eq(a[0].value, frac(1)) && b.every(t => t.kind === 'constant' && !t.expr) && b.length <= 1;
  return isolate(equation.left, equation.right) || isolate(equation.right, equation.left);
}
// An expression is fully worked out when no products remain and each kind appears once.
export const isSimplified = items => items.every(t => !t.expr) && new Set(items.map(t => t.kind)).size === items.length;
export function transpose(equation, id, destination, index = null) {
  if (!['left', 'right'].includes(destination)) throw new Error('Choose a side of the equation.');
  const source = destination === 'left' ? 'right' : 'left';
  const moved = equation[source].find(t => t.id === id);
  if (!moved) return equation;
  if (equation[destination].length >= 24) throw new Error('Combine some terms first to make room.');
  const arrived = [...equation[destination]];
  arrived.splice(Number.isInteger(index) ? Math.max(0, Math.min(index, arrived.length)) : arrived.length, 0, negateTerm(moved));
  return { ...equation, [source]: equation[source].filter(t => t.id !== id), [destination]: arrived };
}
export function cancelPair(equation, firstId, secondId) {
  for (const side of ['left', 'right']) {
    const first = equation[side].find(t => t.id === firstId), second = equation[side].find(t => t.id === secondId);
    if (!first || !second || first.id === second.id) continue;
    if (first.kind !== second.kind || Math.sign(first.value.n) === Math.sign(second.value.n)) throw new Error('A zero pair needs opposite signs and the same kind of block.');
    const combined = add(first.value, second.value);
    return { ...equation, [side]: equation[side].filter(t => t.id !== firstId && t.id !== secondId).concat(combined.n ? [term(first.kind, combined)] : []) };
  }
  throw new Error('Bring the opposite blocks to the same side first.');
}
export function simplify(equation) {
  const combine = items => Object.entries(totals(items)).filter(([, value]) => value.n).map(([kind, value]) => term(kind, value,items.some(t=>t.kind===kind&&t.notation==='decimal')?'decimal':items.some(t=>t.kind===kind&&t.notation==='fraction')?'fraction':'auto'));
  return { left: combine(equation.left), right: combine(equation.right) };
}
export function operate(equation, operation, amount) {
  if (!['add', 'subtract', 'multiply', 'divide'].includes(operation)) throw new Error('Choose an arithmetic operation.');
  if ((operation === 'multiply' || operation === 'divide') && amount.n === 0) throw new Error('Use a nonzero factor so the equation keeps the same solutions.');
  const change = items => {
    if (operation === 'add' || operation === 'subtract') {
      if (items.length >= 24) throw new Error('Combine some terms first to make room.');
      const value = operation === 'subtract' ? neg(amount) : amount;
      return value.n ? [...items, term('constant', value)] : items;
    }
    return items.map(t => scaleTerm(t, amount, operation === 'multiply' ? '×' : '÷'));
  };
  return { left: change(equation.left), right: change(equation.right) };
}
function operandText(o, first, absolute) {
  const value = first && absolute ? abs(o.value) : o.value;
  const text = o.notation === 'decimal' ? (numberSpec({ ...o, value })?.text ?? format(value)) : format(value);
  return value.n < 0 ? (first ? '−' + text.replace('-', '') : `(−${text.replace('-', '')})`) : text;
}
export function termText(t, absolute = false) {
  if (t.expr) return t.expr.operands.map((o, i) => (i ? ` ${t.expr.ops[i - 1]} ` : '') + operandText(o, !i, absolute)).join('');
  const value = absolute ? abs(t.value) : t.value;
  const text=t.notation==='decimal'?(numberSpec({...t,value})?.text??format(value)):format(value);
  if (t.kind === 'constant') return text;
  return value.n === value.d ? 'x' : value.n === -value.d ? '−x' : `${text}x`;
}
// The sign printed before a term; a product shows the sign of its first operand.
export const negative = t => (t.expr ? t.expr.operands[0].value.n : t.value.n) < 0;
export function sideText(items) {
  return items.map((t, index) => `${index ? negative(t) ? ' − ' : ' + ' : negative(t) ? '−' : ''}${termText(t, true)}`).join('') || '0';
}
export const equationText = equation => `${sideText(equation.left)} = ${sideText(equation.right)}`;

export const lessons = [
  { id: 'first', title: 'Find the missing piece', category: 'Getting started', equation: 'x + 3 = 7', tag: 'One step', description: 'Get the green x block on its own. Whatever remains on the other side is its value.', hint: 'Move +3 across the equals sign. It becomes −3. Then combine the blue and red blocks.', skill: 'Moving a term', goal: 'Isolate x', steps: 2 },
  { id: 'negative', title: 'Opposites make zero', category: 'Getting started', equation: 'x - 4 = 5', tag: 'Zero pairs', description: 'A positive and a negative of the same size neutralize one another.', hint: 'Move −4 to the right. Its sign becomes positive. Combine +5 and +4.', skill: 'Working with negatives', goal: 'Isolate x', steps: 2 },
  { id: 'groups', title: 'Share it equally', category: 'Building confidence', equation: '3x + 2 = 14', tag: 'Two steps', description: 'First clear the constants. Then divide both sides into equal groups.', hint: 'Move +2 right, combine the constants, then divide both sides by 3.', skill: 'Dividing both sides', goal: 'Find one x', steps: 3 },
  { id: 'both', title: 'Meet in the middle', category: 'Building confidence', equation: '3x + 1 = x + 9', tag: 'Both sides', description: 'Bring the variables together, and the constants together.', hint: 'Move the right-side x left and +1 right. Combine, then divide by 2.', skill: 'Collecting like terms', goal: 'One variable, one side', steps: 4 },
  { id: 'fractions', title: 'A little of the whole', category: 'Go a little further', equation: 'x/2 + 1/3 = 5/6', tag: 'Fractions', description: 'Fractions are exact pieces of a block. The same balance rules still apply.', hint: 'Move +1/3 right, combine to get 1/2, then multiply both sides by 2.', skill: 'Fraction arithmetic', goal: 'Make x whole', steps: 3 },
  { id: 'distribute', title: 'Open the brackets', category: 'Go a little further', equation: '2(x + 3) = 18', tag: 'Distribute', description: 'Two groups of (x + 3) become 2x + 6. Now work backwards to one x.', hint: 'The input expands brackets into blocks. Move +6 right, combine, then divide by 2.', skill: 'Distributive property', goal: 'Unpack the groups', steps: 3 },
  { id: 'negative-x', title: 'Turn things around', category: 'Go a little further', equation: '5 - 2x = 11', tag: 'Negative x', description: 'A negative coefficient needs a negative divisor. Watch both colors change.', hint: 'Move +5 right and combine. Divide both sides by −2 to get a positive x.', skill: 'Negative coefficients', goal: 'Make one positive x', steps: 3 },
  { id: 'fraction-answer', title: 'Between the integers', category: 'Go a little further', equation: '4x - 1 = 2', tag: 'Fraction answer', description: 'Not every solution is a whole number. Part of a block can be the answer.', hint: 'Move −1 right, combine to 3, then divide both sides by 4.', skill: 'Rational solutions', goal: 'Find the fraction', steps: 3 },
];
