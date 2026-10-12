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
// Operands can carry order-of-operations structure. A group is a parenthesised sum,
// { value, group: [terms] }; a power is { value, base, power: n }. Each keeps its exact
// value; `negated` records a minus written outside the parentheses or before a power
// (−(4 + 3), −3²), so the text keeps the minus where it was typed.
export const structured = o => !!(o && (o.group || o.base));
const sumOf = items => items.reduce((v, t) => add(v, t.value), frac(0));
const notationOf = items => items.some(t => t.notation === 'decimal') ? 'decimal' : items.some(t => t.notation === 'fraction') ? 'fraction' : 'auto';
export const groupOperand = items => ({ value: sumOf(items), notation: notationOf(items), group: items });
export function powerOperand(base, power) {
  let value = frac(1);
  for (let k = 0; k < power; k++) value = mul(value, base.value);
  return { value, notation: value.d === 1 ? 'auto' : base.notation === 'decimal' ? 'decimal' : 'fraction', base, power };
}
const negateOperand = o => structured(o) ? { ...o, value: neg(o.value), negated: !o.negated } : { ...o, value: neg(o.value) };
export const operandNegative = o => structured(o) ? !!o.negated : o.value.n < 0;
const hasGroup = o => !!(o.group || o.base?.group || o.base?.base);
// A term still holding parentheses or a power, ranked for the order of operations.
export const pemdasRank = t => !t.expr ? 3 : t.expr.operands.some(hasGroup) ? 0 : t.expr.operands.some(o => o.base) ? 1 : 2;
export function operationTerm(operands, ops) {
  if (ops.some(op => !['×', '÷'].includes(op)) || operands.length !== ops.length + 1) throw new Error('Unknown operation.');
  if (operands.length > 6) throw new Error('Use up to six numbers in one product.');
  const value = ops.reduce((v, op, i) => apply(v, op, operands[i + 1]), operands[0].value);
  return { ...term('constant', value, 'auto'), expr: { operands, ops } };
}
export function negateTerm(t) {
  if (!t.expr) return { ...t, value: neg(t.value) };
  const [first, ...rest] = t.expr.operands;
  return { ...t, value: neg(t.value), expr: { ...t.expr, operands: [negateOperand(first), ...rest] } };
}
export function scaleTerm(t, factor, op = '×') {
  if (eq(factor, frac(-1)) && op === '×') return negateTerm(t);
  const value = op === '×' ? mul(t.value, factor) : div(t.value, factor);
  if (!t.expr) return { ...t, value };
  if (t.expr.operands.length >= 6) { const { expr, ...plain } = t; return { ...plain, value, notation: value.d === 1 ? 'auto' : 'fraction' }; }
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
// Inside parentheses: a product comes before the sums, then the sums go left to right.
// When one number is left the parentheses open and it becomes a plain operand.
function stepGroup(o) {
  const holder = o.group ? o : o.base?.group ? o.base : o.base;
  if (!holder.group) return { ...o, base: stepGroup(holder) };
  const items = holder.group, k = items.findIndex(t => t.expr);
  let next;
  if (k >= 0) next = items.map((t, i) => i === k ? evaluateStep(t) : t);
  else {
    const [a, b, ...rest] = items, places = Math.max(a.decimalPlaces || 0, b.decimalPlaces || 0);
    next = [{ ...a, value: add(a.value, b.value), notation: notationOf([a, b]), ...(places ? { decimalPlaces: places } : {}) }, ...rest];
  }
  const open = next.length > 1 || !!next[0].expr;
  const inner = open ? { ...holder, group: next } : { value: holder === o ? o.value : next[0].value, notation: next[0].notation, ...(next[0].decimalPlaces ? { decimalPlaces: next[0].decimalPlaces } : {}) };
  return holder === o ? inner : { ...o, base: inner };
}
// One worked chain, or the plain number it has become.
function rebuild(t, operands, ops) {
  if (operands.length === 1 && !structured(operands[0])) { const { expr, ...plain } = t; return { ...plain, value: t.value, notation: operands[0].notation, decimalPlaces: operands[0].decimalPlaces }; }
  return { ...t, expr: { operands, ops } };
}
// One visible step, in the order of operations: parentheses, then powers, then the
// first pair of × and ÷ from the left. A fraction on its own divides out.
export function evaluateStep(t) {
  if (t.expr) {
    const operands = t.expr.operands, g = operands.findIndex(hasGroup);
    if (g >= 0) return rebuild(t, operands.map((o, i) => i === g ? stepGroup(o) : o), t.expr.ops);
    const e = operands.findIndex(o => o.base);
    if (e >= 0) {
      const o = operands[e];
      // A power standing alone is written out as repeated multiplication (3² = 3 × 3),
      // so the copies can be shown. Inside a chain it is worked out where it stands.
      if (operands.length === 1 && o.power <= 6) {
        const base = { value: o.base.value, notation: o.base.notation, ...(o.base.decimalPlaces ? { decimalPlaces: o.base.decimalPlaces } : {}) };
        const copies = Array.from({ length: o.power }, (_, i) => i === 0 && o.negated ? negateOperand(base) : base);
        return { ...t, expr: { operands: copies, ops: Array(o.power - 1).fill('×') } };
      }
      return rebuild(t, operands.map((x, i) => i === e ? { value: x.value, notation: x.notation } : x), t.expr.ops);
    }
    if (operands.length === 1) return rebuild(t, operands, []);
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
  }).replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/[÷:]/g, '÷').replace(/[²³⁴⁵⁶]/g, m => '^' + '²³⁴⁵⁶'.indexOf(m) + 2).toLowerCase();
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[x()+\-*/÷^]|\S/g) || [];
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
      // Numbers added inside parentheses stay grouped, so they can be worked out first.
      if (scalar(value) && (value.length > 1 || value[0]?.expr && value[0].expr.ops.length)) return [operationTerm([groupOperand(value)], [])];
      return value;
    }
    if (token === 'x') return [term('variable', frac(1))];
    if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return [{...term('constant', decimal(token),token.includes('.')?'decimal':'auto'),...(token.includes('.')?{decimalPlaces:token.split('.')[1].length}:{})}];
    throw new Error('Use numbers, x, +, −, ×, ÷, and parentheses. Example: 2x + 3 = 11.');
  }
  function unary() {
    if (peek() === '+') { index++; return unary(); }
    if (peek() === '-') { index++; return scale(unary(), frac(-1)); }
    return power();
  }
  // A whole-number exponent binds tighter than a minus sign: −3² is −(3²).
  function power() {
    const items = primary();
    if (peek() !== '^') return items;
    index++;
    const exponent = tokens[index++];
    if (!/^\d+$/.test(exponent || '') || Number(exponent) < 2 || Number(exponent) > 6) throw new Error('Use a whole-number exponent from 2 to 6, such as 3^2.');
    if (!scalar(items)) throw new Error('This lab supports linear equations, so x cannot be raised to a power.');
    if (peek() === '^') throw new Error('Use one exponent at a time, such as (2^3)^2.');
    return [operationTerm([powerOperand(baseOf(items), Number(exponent))], [])];
  }
  function baseOf(items) {
    if (items.length === 1 && items[0].expr && !items[0].expr.ops.length) return items[0].expr.operands[0];
    if (items.length === 1 && !items[0].expr) return { value: items[0].value, notation: items[0].notation, ...(items[0].decimalPlaces ? { decimalPlaces: items[0].decimalPlaces } : {}) };
    return groupOperand(items);
  }
  function product() {
    const factors = [unary()], ops = [];
    while (['*', '/', '÷', 'x', '('].includes(peek())) {
      ops.push(['*', '/', '÷'].includes(peek()) ? tokens[index++] : '*');
      factors.push(unary());
    }
    // A slash between two plain numbers is a fraction bar and binds first (x ÷ 1/2 = x ÷ ½),
    // except after another slash, which keeps x/2/3 = x/6 read left to right.
    const number = items => items.length === 1 && items[0].kind === 'constant' && !items[0].expr;
    for (let i = 0; i < ops.length; i++) if (ops[i] === '/' && number(factors[i]) && number(factors[i + 1]) && (i === 0 || ops[i - 1] !== '/') && !factors.every(scalar)) {
      const [a, b] = [factors[i][0], factors[i + 1][0]];
      factors.splice(i, 2, [{ ...term('constant', div(a.value, b.value), a.notation === 'decimal' || b.notation === 'decimal' ? 'decimal' : 'fraction') }]); ops.splice(i, 1); i--;
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
    if (items.length === 1 && items[0].expr && !items[0].expr.ops.length) return items[0].expr.operands[0];
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
  return result.filter(t => t.value.n !== 0 || t.notation==='decimal' || t.expr);
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
const superscript = n => [...String(n)].map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
function structureText(o) {
  if (o.group) return `(${sideText(o.group)})`;
  const b = o.base, inner = structured(b) ? (b.base ? `(${structureText(b)})` : structureText(b)) : b.value.n < 0 ? `(${operandText(b, true, false)})` : operandText(b, true, false);
  return inner + superscript(o.power);
}
function operandText(o, first, absolute) {
  if (structured(o)) { const body = structureText(o); return !o.negated || (first && absolute) ? body : first ? '−' + body : `(−${body})`; }
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
// What one parentheses or exponent step did, for the caption over the cards.
export function stepCaption(before, after) {
  const a = before.expr.operands, b = after?.expr?.operands || [{ value: after.value, notation: after.notation }];
  if (a.length === 1 && a[0].base && b.length > 1) return `${operandText(a[0], true, true)} = ${b.map((o, i) => operandText(o, !i, true)).join(' × ')}`;
  const i = a.findIndex((o, k) => b.length !== a.length || operandText(o, !k, true) !== operandText(b[k], !k, true));
  if (i < 0) return '';
  const from = operandText(a[i], true, true), to = operandText(b.length === a.length ? b[i] : b[0], true, true);
  const o = a[i];
  if (o.base && !structured(o.base) && !hasGroup(o)) return `${from} = ${Array(o.power).fill(operandText(o.base, true, true)).join(' × ')} = ${to}`;
  return `${from} = ${to}`;
}
export const negative = t => t.expr ? operandNegative(t.expr.operands[0]) : t.value.n < 0;
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
