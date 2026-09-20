// Each action invokes the original SWF. No replacement arithmetic animations.
const constant = value => ({ kind: 'constant', value });
const variable = (value = 1) => ({ kind: 'x', value });
export const lessons = [
  { id: 'mirror', title: 'Across the equals mirror', equation: 'x+3=7', steps: [
    { before: 'x+3=7', prompt: 'Move +3 across the mirror. It becomes −3.', action: ['move', 1, 1], expected: [[variable()], [constant(7), constant(-3)]] },
    { before: 'x=7-3', prompt: 'Drop the red 3 onto the blue 7. Opposite units neutralize.', action: ['combine', 2, 3], expected: [[variable()], [constant(4)]] },
  ], complete: 'X is isolated and equals 4. The green cards show its value.' },
  { id: 'negative', title: 'Moving a negative term', equation: 'x-4=5', steps: [
    { before: 'x-4=5', prompt: 'Move −4 across the mirror. It becomes +4.', action: ['move', 1, 1], expected: [[variable()], [constant(5), constant(4)]] },
    { before: 'x=5+4', prompt: 'Drop the blue 4 onto the blue 5 to combine them.', action: ['combine', 2, 3], expected: [[variable()], [constant(9)]] },
  ], complete: 'X is isolated and equals 9.' },
  { id: 'carry', title: 'Carry ten', equation: '9+1', steps: [
    { before: '9+1', prompt: 'Drop 1 onto 9. Follow the tenth card into the tens stack.', action: ['combine', 0, 1], expected: [[constant(10)], []] },
  ], complete: 'Ten ones become one ten, using the original stack animation.' },
  { id: 'borrow', title: 'Borrow from the next place', equation: '10-1', steps: [
    { before: '10-1', prompt: 'Drop the red 1 onto 10. One ten opens into ten ones.', action: ['combine', 0, 1], expected: [[constant(9)], []] },
  ], complete: 'One negative unit neutralizes one positive unit. Nine remain.' },
  { id: 'comma', title: 'Thousands groups', equation: '1000+1000', steps: [
    { before: '1000+1000', prompt: 'Combine the thousands. Each comma starts the local stack pattern again.', action: ['combine', 0, 1], expected: [[constant(2000)], []] },
  ], complete: 'Two thousands make 2,000. The 1–10–100 pattern repeats in each comma group.' },
  { id: 'decimal', title: 'Tenths and hundredths', equation: '0.9+0.1', steps: [
    { before: '0.9+0.1', prompt: 'Combine nine tenths and one tenth. Watch them carry into one.', action: ['combine', 0, 1], expected: [[constant(1)], []] },
  ], complete: 'Ten tenths make one whole.' },
];

export function sides(state) {
  return [state.terms.filter(t => !state.hasEquals || t.index < state.equalIndex), state.terms.filter(t => state.hasEquals && t.index > state.equalIndex)];
}
export function matches(state, expected) {
  if (!state || state.dragging || state.busy > 0) return false;
  return sides(state).every((terms, side) => {
    const remaining = [...expected[side]];
    if (terms.length !== remaining.length) return false;
    for (const term of terms) {
      const i = remaining.findIndex(target => term.kind === target.kind && (term.kind !== 'constant' || term.children === 3) && Math.abs(term.value * (term.positive ? 1 : -1) - target.value) < 1e-8);
      if (i < 0) return false;
      remaining.splice(i, 1);
    }
    return true;
  });
}

export function normalizeInput(raw) {
  const input = raw.toLowerCase().replace(/\s/g, '').replace(/[−–]/g, '-').replace(/[×·]/g, '*');
  if (!input || input.length > 80) throw Error('Enter an expression or equation, up to 80 characters.');
  if (/[\/÷()^]/.test(input)) throw Error('Division, fraction bars, parentheses, and powers are unfinished in this SWF. Decimal fractions work.');
  if (/[^0-9xy.+*=,\-]/.test(input)) throw Error('Use numbers, decimals, x, y, +, −, ×, and =.');
  const number = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+';
  const atom = `(?:(?:${number})(?:[xy])?|[xy])`;
  const expression = `[+-]?${atom}(?:[+*-]${atom})*`;
  if (!new RegExp(`^${expression}(?:=${expression})?$`).test(input)) throw Error('Try an equation such as x+3=7, or an expression such as 9+1.');
  if ((input.match(/[xy]/g) || []).length > 6 || (input.match(/[+*-]/g) || []).length > 10) throw Error('Use fewer terms so the cards remain readable.');
  for (const value of input.replaceAll(',', '').match(/\d+(?:\.\d+)?|\.\d+/g) || []) {
    if (Number(value) > 999999999 || (value.split('.')[1]?.length || 0) > 6) throw Error('Use numbers below one billion and up to six decimal places.');
  }
  return input.replaceAll(',', '').replace(/(^|[=+*\-])\./g, '$10.');
}

export function describe(state) {
  if (!state.terms.some(term => Number.isFinite(term.value))) return 'Empty equation';
  const render = terms => terms.map((t, i) => `${t.positive ? (i ? ' + ' : '') : (i ? ' − ' : '−')}${t.kind === 'x' ? `${t.value === 1 ? '' : t.value}x` : t.value}`).join('') || '0';
  const [left, right] = sides(state);
  return render(left) + (state.hasEquals ? ' = ' + render(right) : '');
}
