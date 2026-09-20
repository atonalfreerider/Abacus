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
export const term = (kind, value) => ({ id: `t${++sequence}`, kind, value });

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
  }).replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').toLowerCase();
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[x()+\-*/]|\S/g) || [];
  let index = 0;
  const peek = () => tokens[index];
  const scalar = items => items.every(t => t.kind === 'constant');
  const sum = items => items.reduce((value, t) => add(value, t.value), frac(0));
  const scale = (items, factor) => items.map(t => term(t.kind, mul(t.value, factor)));
  function primary() {
    const token = tokens[index++];
    if (token === '(') {
      const value = expression();
      if (tokens[index++] !== ')') throw new Error('Close each parenthesis, for example 2(x + 3).');
      return value;
    }
    if (token === 'x') return [term('variable', frac(1))];
    if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return [term('constant', decimal(token))];
    throw new Error('Use numbers, x, +, −, ×, ÷, and parentheses. Example: 2x + 3 = 11.');
  }
  function unary() {
    if (peek() === '+') { index++; return unary(); }
    if (peek() === '-') { index++; return scale(unary(), frac(-1)); }
    return primary();
  }
  function product() {
    let value = unary();
    while (peek() === '*' || peek() === '/' || peek() === 'x' || peek() === '(') {
      const operator = peek() === '*' || peek() === '/' ? tokens[index++] : '*';
      const right = unary();
      if (operator === '/') {
        if (!scalar(right)) throw new Error('This lab supports linear equations. Divide by a number, such as x/3.');
        value = scale(value, div(frac(1), sum(right)));
      } else if (scalar(right)) value = scale(value, sum(right));
      else if (scalar(value)) value = scale(right, sum(value));
      else throw new Error('This lab supports linear equations with x. Try 3x instead of x × x.');
    }
    return value;
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
  return result.filter(t => t.value.n !== 0);
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
  const isolate = (a, b) => a.length === 1 && a[0].kind === 'variable' && eq(a[0].value, frac(1)) && b.every(t => t.kind === 'constant') && b.length <= 1;
  return isolate(equation.left, equation.right) || isolate(equation.right, equation.left);
}
export function transpose(equation, id, destination) {
  if (!['left', 'right'].includes(destination)) throw new Error('Choose a side of the equation.');
  const source = destination === 'left' ? 'right' : 'left';
  const moved = equation[source].find(t => t.id === id);
  if (!moved) return equation;
  if (equation[destination].length >= 24) throw new Error('Combine some terms first to make room.');
  return { ...equation, [source]: equation[source].filter(t => t.id !== id), [destination]: [...equation[destination], { ...moved, value: neg(moved.value) }] };
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
  const combine = items => Object.entries(totals(items)).filter(([, value]) => value.n).map(([kind, value]) => term(kind, value));
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
    return items.map(t => ({ ...t, value: operation === 'multiply' ? mul(t.value, amount) : div(t.value, amount) }));
  };
  return { left: change(equation.left), right: change(equation.right) };
}
export function termText(t, absolute = false) {
  const value = absolute ? abs(t.value) : t.value;
  if (t.kind === 'constant') return format(value);
  return value.n === value.d ? 'x' : value.n === -value.d ? '−x' : `${format(value)}x`;
}
export function sideText(items) {
  return items.map((t, index) => `${index ? t.value.n < 0 ? ' − ' : ' + ' : t.value.n < 0 ? '−' : ''}${termText(t, true)}`).join('') || '0';
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
