// Machine trees: typed input and expressions, building by attach and detach, the order in
// which inputs fill sockets, exact evaluation with domain errors on their block, and the
// sentence line that reads the tree as algebra after every beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ARITY, palette, defaultMachine, attach, detach, openSockets, parseInput, parseExpression, evaluateTree, sentence} from '../src/machine/tree.js';
import {planMachine} from '../src/machine/plan.js';
import {snapshotAt} from '../src/machine/scene.js';

test('Input takes [16,7], 16,7 or 16 7, with U+2212 and base literals; [5, 3] is two numbers', () => {
  for (const text of ['[16,7]', '16,7', '16 7', ' [ 16 , 7 ] ']) assert.deepEqual(parseInput(text, 'binary'), {ok: true, values: ['16', '7']});
  assert.deepEqual(parseInput('[5, 3]', 'binary').values, ['5', '3']);
  assert.deepEqual(parseInput('[5,−4]', 'ternary').values, ['5', '-4']);
  assert.deepEqual(parseInput('0b101, 0tT1', 'binary').values, ['5', '-2']);
  assert.deepEqual(parseInput('[3]', 'binary').values, ['3']);
  for (const bad of ['', '[]', '5,,3', '[abc]', '1.5']) assert.equal(parseInput(bad, 'binary').ok, false, bad);
});
test('expressions build trees whose inputs fill the sockets depth-first, left first', () => {
  const shape = (text, base = 'binary') => { const e = parseExpression(text, base); assert.ok(e.ok, e.error); return [Object.fromEntries(Object.entries(e.tree).map(([id, n]) => [id, `${n.op}@${n.parent}.${n.socket}`])), e.inputs]; };
  assert.deepEqual(shape('16*7'), [{n1: 'mul@io.C'}, ['16', '7']]);
  assert.deepEqual(shape('(5+3)*7'), [{n1: 'mul@io.C', n2: 'add@n1.L'}, ['5', '3', '7']]);
  assert.deepEqual(shape('45/6'), [{n1: 'div@io.C'}, ['45', '6']]);
  assert.deepEqual(shape('45%6'), [{n1: 'mod@io.C'}, ['45', '6']]);
  assert.deepEqual(shape('12&10'), [{n1: 'and@io.C'}, ['12', '10']]);
  assert.deepEqual(shape('~5'), [{n1: 'not@io.C'}, ['5']]);
  assert.deepEqual(shape('7<=>9'), [{n1: 'cmp@io.C'}, ['7', '9']]);
  assert.deepEqual(shape('5<<3'), [{n1: 'shl@io.C'}, ['5', '3']]);
  assert.deepEqual(shape('shr(45,2)'), [{n1: 'shr@io.C'}, ['45', '2']]);
  assert.deepEqual(shape('min(2,1)', 'ternary'), [{n1: 'min@io.C'}, ['2', '1']]);
  assert.deepEqual(shape('sum(5,7)+(cons(5,7)<<1)', 'ternary'), [{n1: 'add@io.C', n2: 'sum@n1.L', n3: 'shl@n1.R', n4: 'cons@n3.L'}, ['5', '7', '5', '7', '1']]);
  assert.deepEqual(shape('(12^10)+((12&10)<<1)'), [{n1: 'add@io.C', n2: 'xor@n1.L', n3: 'shl@n1.R', n4: 'and@n3.L'}, ['12', '10', '12', '10', '1']]);
  assert.deepEqual(shape('16×7−0b11'), [{n1: 'sub@io.C', n2: 'mul@n1.L'}, ['16', '7', '3']]);
  assert.deepEqual(shape('0t1T0*-4', 'ternary'), [{n1: 'mul@io.C'}, ['6', '-4']]);
  assert.deepEqual(shape('-(5*3)', 'ternary'), [{n1: 'neg@io.C', n2: 'mul@n1.C'}, ['5', '3']]);
  assert.deepEqual(shape('2*3+4*5-6'), [{n1: 'sub@io.C', n2: 'add@n1.L', n3: 'mul@n2.L', n4: 'mul@n2.R'}, ['2', '3', '4', '5', '6']]);
});
test('>> is refused with its message, and so are blocks a base lacks', () => {
  assert.deepEqual(parseExpression('-13>>2', 'binary'), {ok: false, error: 'In the machine a right shift truncates toward zero like ÷: write shr(−13, 2).'});
  assert.match(parseExpression('45 >> 2', 'binary').error, /truncates toward zero like ÷: write shr\(45, 2\)/);
  assert.match(parseExpression('(1+2)>>1', 'ternary').error, /right shift truncates toward zero/);
  assert.equal(parseExpression('min(2,1)', 'binary').error, 'Base 2 has no MIN gate.');
  assert.equal(parseExpression('12&10', 'ternary').ok, true, 'in balanced ternary & is MIN');
  assert.equal(parseExpression('frob(2,1)', 'binary').ok, false);
  assert.equal(parseExpression('5', 'binary').ok, false, 'an expression needs a block');
  assert.equal(parseExpression('(5+3', 'binary').ok, false);
  assert.equal(parseExpression('5 $ 3', 'binary').ok, false);
});
test('attach, detach and the open sockets', () => {
  assert.equal(ARITY.not, 1); assert.equal(ARITY.mul, 2); assert.deepEqual(palette('binary').slice(0, 3), ['add', 'sub', 'mul']);
  assert.ok(palette('ternary').includes('cons') && !palette('ternary').includes('xor'));
  assert.deepEqual(defaultMachine(), {n1: {op: 'mul', parent: 'io', socket: 'C'}});
  assert.deepEqual(openSockets({}), ['io']);
  let {tree, node} = attach({}, 'io', 'mul');
  assert.equal(node, 'n1'); assert.deepEqual(openSockets(tree), ['n1.L', 'n1.R']);
  ({tree, node} = attach(tree, 'n1.L', 'add'));
  assert.equal(node, 'n2'); assert.deepEqual(openSockets(tree), ['n2.L', 'n2.R', 'n1.R']);
  // dropping on an occupied socket pushes the block there into the new block's first socket
  ({tree, node} = attach(tree, 'n1.L', 'not'));
  assert.deepEqual(tree.n3, {op: 'not', parent: 'n1', socket: 'L'}); assert.deepEqual(tree.n2, {op: 'add', parent: 'n3', socket: 'C'});
  ({tree} = attach(tree, 'io', 'neg'));
  assert.deepEqual(tree.n1, {op: 'mul', parent: 'n4', socket: 'C'});
  assert.deepEqual(openSockets(tree), ['n2.L', 'n2.R', 'n1.R']);
  assert.deepEqual(Object.keys(detach(tree, 'n3')).sort(), ['n1', 'n4']);
  assert.deepEqual(detach(tree, 'n4'), {});
  assert.throws(() => attach(defaultMachine(), 'n1.C', 'add'));
  assert.throws(() => attach({}, 'io', 'frob'));
});
test('evaluateTree is exact, and a domain error names its block and its cause', () => {
  const run = (text, base = 'binary') => { const e = parseExpression(text, base); return evaluateTree(e.tree, e.inputs, base); };
  assert.deepEqual(run('(5+3)*7'), {ok: true, values: ['56'], text: '[56]'});
  assert.deepEqual(run('45/6'), {ok: true, values: ['7', '3'], text: '[7, 3]'}, 'DIV at the root gives [q, r]');
  assert.deepEqual(run('(45/6)+1'), {ok: true, values: ['8'], text: '[8]'}, 'below the root DIV passes q');
  assert.deepEqual(run('(45%6)+1'), {ok: true, values: ['4'], text: '[4]'}, 'below the root MOD passes r');
  assert.deepEqual(run('19%5', 'ternary').values, ['4', '-1']);
  assert.deepEqual(run('(3-3)%2'), {ok: true, values: ['0', '0'], text: '[0, 0]'});
  assert.deepEqual(run('9/(3-3)'), {ok: false, reason: 'zeroDivision', node: 'n1', message: 'Nothing fits into zero: the ÷ block\'s divisor is 3 − 3 = 0'});
  assert.deepEqual(run('1+9/(3-3)'), {ok: false, reason: 'zeroDivision', node: 'n2', message: 'Nothing fits into zero: the ÷ block\'s divisor is 3 − 3 = 0'});
  assert.equal(run('9%0').message, 'Nothing fits into zero: the mod block\'s divisor is 0');
  const shift = run('shl(5, 1-3)');
  assert.equal(shift.reason, 'domain'); assert.equal(shift.node, 'n1'); assert.match(shift.message, /1 − 3 = −2/);
  assert.deepEqual(evaluateTree(defaultMachine(), ['16'], 'binary'), {ok: false, reason: 'arity', node: null, message: 'This machine takes 2 numbers'});
});
test('the sentence line reads the tree as algebra after every beat of [16,7]', () => {
  const p = planMachine({tree: defaultMachine(), inputs: ['16', '7'], base: 'binary'}).plan;
  const lines = Array.from({length: p.beats.length + 1}, (_, i) => sentence(snapshotAt(p, i)));
  assert.deepEqual(lines, ['16 × 7', '16 × 7', '16 × 7', '16 × 7', '16 × 4 + 16 × 3', '64 + 16 × 3', '64 + 16 × 3', '64 + (16 × 2 + 16 × 1)',
    '64 + (32 + 16 × 1)', '64 + (32 + 16 × 1)', '64 + (32 + 16)', '64 + (32 + 16)', '64 + 48', '64 + 48', '112', '112', '112']);
  const t = planMachine({tree: defaultMachine(), inputs: ['16', '7'], base: 'ternary'}).plan;
  assert.equal(sentence(snapshotAt(t, 4)), '16 × 9 + 16 × (−2)');
  assert.equal(sentence(snapshotAt(t, 12)), '144 + (−32)');
  // division shows its invariant
  const d = planMachine({tree: {n1: {op: 'div', parent: 'io', socket: 'C'}}, inputs: ['100', '7'], base: 'binary'}).plan;
  const seen = new Set(Array.from({length: d.beats.length + 1}, (_, i) => sentence(snapshotAt(d, i))));
  assert.ok(seen.has('100 = 7 × 12 + 16'), [...seen].join(' | '));
  assert.ok(seen.has('14, 2'));
});
