// Where a curve meets an axis, one coordinate is zero. On the y axis x = 0, on the x axis
// y = 0. Substituting the zero leaves an equation in the other letter; these steps write
// that solution out the way a learner would, from the equation as it was typed.
import { parseExpression, show, roots, degree } from './polynomial.js';
import { frac, add, sub, div, eq, numeric } from '../engine.js';

const zero = frac(0), one = frac(1);
const pretty = text => text.replace(/\^([0-4])/g, (_, d) => '⁰¹²³⁴'[d]).replace(/\*/g, '×').replace(/-/g, '−').replace(/\s+/g, ' ').trim();
// Each typed letter becomes a parenthesised zero, so the substitution can be read.
const substitute = (text, letter) => pretty(text.replace(new RegExp(`(\\d)\\s*${letter}`, 'gi'), `$1(0)`).replace(new RegExp(letter, 'gi'), '0'));

// a·v + b with v the remaining letter, from a side's coefficient map at the other letter = 0.
function linearAt(map, keep) {
  let a = zero, b = zero;
  for (const [key, c] of map) {
    const [i, j] = key.split(',').map(Number), power = keep === 'x' ? i : j, other = keep === 'x' ? j : i;
    if (other > 0) continue;
    if (power === 0) b = add(b, c); else if (power === 1) a = add(a, c); else return null;
  }
  return { a, b };
}
const term = (a, v) => eq(a, one) ? v : eq(a, frac(-1)) ? `−${v}` : `${show(a)}${v}`;
const side = ({ a, b }, v) => a.n === 0 ? show(b) : b.n === 0 ? term(a, v) : `${term(a, v)} ${b.n < 0 ? '−' : '+'} ${show(b.n < 0 ? frac(-b.n, b.d) : b)}`;
// The value as cards: "4 cards up" or "3 cards left".
export const cardWords = (value, axis) => {
  const n = Math.abs(numeric(value)), many = n <= 1 ? 'card' : 'cards';
  return `${show(value.n < 0 ? frac(-value.n, value.d) : value)} ${many} ${axis === 'y' ? (value.n < 0 ? 'down' : 'up') : (value.n < 0 ? 'left' : 'right')}`;
};

// axis: 'y' for a point on the y axis (x = 0), 'x' for a point on the x axis (y = 0).
// text: the curve's equation as typed; point: the exact crossing { x, y } (fractions).
export function interceptSteps(text, axis, point) {
  const zeroLetter = axis === 'y' ? 'x' : 'y', solveFor = axis === 'y' ? 'y' : 'x';
  const value = axis === 'y' ? point.y : point.x;
  const steps = [`${zeroLetter} = 0`, substitute(text, zeroLetter)];
  const [left, right] = text.split('=').map(parseExpression);
  let l = linearAt(left, solveFor), r = linearAt(right, solveFor);
  if (l && r) {
    // With the letter only on the right, read the equation right to left: 2x + 1 = 0.
    if (l.a.n === 0 && r.a.n !== 0) [l, r] = [r, l];
    // a·v + b = c·v + d, so (a − c)·v = d − b.
    const a = sub(l.a, r.a), d = sub(r.b, l.b);
    const tidy = `${side(l, solveFor)} = ${side(r, solveFor)}`;
    if (tidy !== steps.at(-1)) steps.push(tidy);
    if (a.n === 0) return { setting: steps[0], steps, value: null, note: d.n === 0 ? `Every ${solveFor} works here.` : 'No value works: the curve never meets this axis.' };
    const gathered = `${term(a, solveFor)} = ${show(d)}`;
    if (gathered !== tidy) steps.push(gathered);
    const answer = div(d, a);
    if (eq(a, frac(-1))) steps.push(`${solveFor} = ${show(answer)}`);
    else if (!eq(a, one)) steps.push(`${solveFor} = ${show(d)} ÷ ${a.n < 0 ? `(${show(a)})` : show(a)} = ${show(answer)}`);
    else if (steps.at(-1) !== `${solveFor} = ${show(answer)}`) steps.push(`${solveFor} = ${show(answer)}`);
    return { setting: steps[0], steps, value: answer, answer: `${solveFor} = ${show(answer)}` };
  }
  // Degree two or more in x (y = 0 on a parabola or cubic): name the roots, then check this one.
  const poly = [];
  for (const [key, c] of left) { const [i, j] = key.split(',').map(Number); if (!j) poly[i] = add(poly[i] || zero, c); }
  for (const [key, c] of right) { const [i, j] = key.split(',').map(Number); if (!j) poly[i] = sub(poly[i] || zero, c); }
  for (let i = 0; i < poly.length; i++) poly[i] ||= zero;
  const found = degree(poly) > 0 ? roots(poly) : [];
  const exact = found.filter(r => r.exact).map(r => r.exact);
  if (exact.length && exact.length === found.length) steps.push(exact.map(v => `${solveFor} = ${show(v)}`).join(' or '));
  const at = numeric(value), check = poly.reduceRight((acc, c) => acc * at + numeric(c), 0);
  steps.push(`Here ${solveFor} = ${show(value)}: ${substitute(text, zeroLetter).replace(/x/g, `(${show(value)})`)} ✓`);
  return { setting: steps[0], steps, value, answer: `${solveFor} = ${show(value)}`, check: Math.abs(check) < 1e-9 };
}

// A short sentence for the panel and the tutor.
export function interceptSentence(axis, point) {
  const v = axis === 'y' ? point.y : point.x;
  return axis === 'y'
    ? `On the y axis x is 0, so no x cards: y = ${show(v)}, ${cardWords(v, 'y')}.`
    : `On the x axis y is 0, so no y cards: x = ${show(v)}, ${cardWords(v, 'x')}.`;
}
