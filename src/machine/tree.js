// Machine trees: blocks hung from IO's root socket by wires. A node is {op, parent, socket};
// inputs fill the open sockets depth-first, left first. Values pass through the registry, so
// this file knows no base; the sentence line reads only Tower.text.
import {getBase} from './registry.js';
import {fmt} from './bigmath.js';
import {BLOCKS} from './captions.js';

export const ARITY = {add: 2, sub: 2, mul: 2, div: 2, mod: 2, cmp: 2, shl: 2, shr: 2, and: 2, or: 2, xor: 2, not: 1,
  min: 2, max: 2, sum: 2, cons: 2, neg: 1, mule: 2, measure: 1, ln: 1};
export const BASE_NAMES = {binary: 'Base 2', ternary: 'Balanced ternary', e: 'Base e'};
export const socketsOf = op => ARITY[op] === 1 ? ['C'] : ['L', 'R'];
export const palette = base => getBase(base).palette;
export const defaultMachine = () => ({n1: {op: 'mul', parent: 'io', socket: 'C'}});
export const rootOf = nodes => Object.keys(nodes).find(id => nodes[id].parent === 'io') ?? null;
export const childAt = (nodes, id, socket) => Object.keys(nodes).find(n => nodes[n].parent === id && nodes[n].socket === socket) ?? null;
const nextId = tree => `n${Math.max(0, ...Object.keys(tree).map(id => Number(/^n(\d+)$/.exec(id)?.[1] ?? 0))) + 1}`;

// Hang a block on a socket ('io' or `${id}.L|R|C`). A block already there moves into the new
// block's first socket.
export function attach(tree, socket, op) {
  if (!ARITY[op]) throw new Error(`no block ${op}`);
  const [parent, s] = socket === 'io' ? ['io', 'C'] : socket.split('.');
  if (parent !== 'io' && !(tree[parent] && socketsOf(tree[parent].op).includes(s))) throw new Error(`no socket ${socket}`);
  const next = structuredClone(tree), node = nextId(tree), occupant = parent === 'io' ? rootOf(tree) : childAt(tree, parent, s);
  next[node] = {op, parent, socket: s};
  if (occupant) next[occupant] = {...next[occupant], parent: node, socket: socketsOf(op)[0]};
  return {tree: next, node};
}
// Remove a block and everything hanging below it.
export function detach(tree, node) {
  const next = structuredClone(tree), stack = [node];
  while (stack.length) { const id = stack.pop(); delete next[id]; for (const c of Object.keys(next)) if (next[c].parent === id) stack.push(c); }
  return next;
}
export function openSockets(tree) {
  const root = rootOf(tree); if (!root) return ['io'];
  const out = [];
  const walk = id => { for (const s of socketsOf(tree[id].op)) { const c = childAt(tree, id, s); if (c) walk(c); else out.push(`${id}.${s}`); } };
  walk(root);
  return out;
}

// `[16,7]`, `16,7` or `16 7`: brackets are optional, so phones need no bracket key.
export function parseInput(text, base) {
  const spec = getBase(base), body = String(text).trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!body) return {ok: false, error: 'Type the numbers to feed in, such as [16,7].'};
  let items = body.includes(',') ? body.split(',') : [body];
  if (!body.includes(',') && !spec.parseValue(body).ok) items = body.split(/\s+/);
  const values = [];
  for (const item of items) {
    if (!item.trim()) return {ok: false, error: 'There is an empty place in the list: one comma between numbers.'};
    const r = spec.parseValue(item.trim());
    if (!r.ok) return {ok: false, error: r.error};
    values.push(r.value);
  }
  return {ok: true, values};
}

// ── expressions ─────────────────────────────────────────────────
// C-like precedence, loosest first: | ^ & <=> << + − × ÷ %, then unary − and ~. In balanced
// ternary & | ^ ~ mean MIN, MAX, SUM and NEG; `>>` is refused because the machine's right
// shift truncates like ÷ while two's complement >> floors.
const FUNCTIONS = {...Object.fromEntries(Object.keys(ARITY).map(op => [op, op])), comp: 'cmp', compare: 'cmp'};
const SYMBOLS = {binary: {'&': 'and', '|': 'or', '^': 'xor', '~': 'not'}, ternary: {'&': 'min', '|': 'max', '^': 'sum', '~': 'neg'}, e: {}};
function tokenize(src) {
  const s = src.replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/'), out = [];
  for (let i = 0; i < s.length;) {
    const rest = s.slice(i);
    if (/^\s/.test(rest)) { i++; continue; }
    const m = /^(0b[01]+|0t[01T]+|\d+)/.exec(rest) ?? /^[a-zA-Z]+/.exec(rest) ?? /^(<=>|<<|>>|[-+*/%&|^~(),])/.exec(rest);
    if (!m) return {error: `The expression has a stray “${rest[0]}”.`};
    out.push({t: /^\d/.test(m[0]) ? 'num' : /^[a-zA-Z]/.test(m[0]) ? 'name' : 'op', v: m[0]});
    i += m[0].length;
  }
  return {tokens: out};
}
class Refusal extends Error {}
function parser(tokens, base) {
  const spec = getBase(base);
  let i = 0;
  const peek = () => tokens[i], take = () => tokens[i++];
  const is = v => tokens[i]?.v === v;
  const expect = v => { if (!is(v)) throw new Refusal(`The expression needs “${v}” here.`); i++; };
  const leafOf = text => { const r = spec.parseValue(text); if (!r.ok) throw new Refusal(r.error); return {leaf: r.value}; };
  const node = (op, args) => ({op, args});
  const binary = (next, ops) => () => {
    let left = next();
    while (peek()?.t === 'op' && ops[peek().v]) {
      const sym = take().v, right = next();
      if (ops[sym] === '>>') {
        const show = (x, d) => x.leaf !== undefined ? fmt(x.leaf) : d;
        throw new Refusal(`In the machine a right shift truncates toward zero like ÷: write shr(${show(left, '−13')}, ${show(right, '2')}).`);
      }
      // base e writes rationals p/q as values, not as a ÷ block
      if (base === 'e' && sym === '/' && left.leaf !== undefined && right.leaf !== undefined && left.int && right.int) { left = leafOf(`${left.leaf}/${right.leaf}`); continue; }
      left = node(ops[sym], [left, right]);
    }
    return left;
  };
  const sym = SYMBOLS[base] ?? {};
  // −x: a negative number when x is one, else the NEG block. A base without NEG (binary,
  // base e) writes it as 0 − x, which its − block plays as NEGATE then ADD.
  const minus = x => spec.palette.includes('neg') || !spec.palette.includes('sub') ? node('neg', [x]) : node('sub', [leafOf('0'), x]);
  const unary = () => {
    if (is('+')) { take(); return unary(); }
    if (is('-')) { take(); const x = unary(); return x.leaf !== undefined ? {...leafOf(`-${x.leaf}`.replace('--', '')), int: x.int} : minus(x); }
    if (is('~')) { take(); if (!sym['~']) throw new Refusal('This base has no NOT block.'); return node(sym['~'], [unary()]); }
    return primary();
  };
  const primary = () => {
    const tok = take();
    if (!tok) throw new Refusal('The expression ends too early.');
    if (tok.t === 'num') return {...leafOf(tok.v), int: true};
    if (tok.v === '(') { const x = expr(); expect(')'); return x; }
    if (tok.t === 'name') {
      const name = tok.v.toLowerCase();
      if (base === 'e' && name === 'e') {
        if (!is('^')) return leafOf('e');
        take(); let k = '';
        if (is('-')) { take(); k = '-'; }
        const n = take(); if (n?.t !== 'num') throw new Refusal('Write a whole power of e, such as e^2.');
        return leafOf(`e^${k}${n.v}`);
      }
      const op = FUNCTIONS[name];
      if (!op) throw new Refusal(`There is no block called ${tok.v}.`);
      expect('(');
      const args = [expr()];
      while (is(',')) { take(); args.push(expr()); }
      expect(')');
      if (args.length !== ARITY[op]) throw new Refusal(`${name} takes ${ARITY[op]} number${ARITY[op] > 1 ? 's' : ''}.`);
      return node(op, args);
    }
    throw new Refusal(`The expression has a stray “${tok.v}”.`);
  };
  const product = binary(unary, {'*': 'mul', '/': 'div', '%': 'mod'});
  const sum = binary(product, {'+': 'add', '-': 'sub'});
  const shift = binary(sum, {'<<': 'shl', '>>': '>>'});
  const compare = binary(shift, {'<=>': 'cmp'});
  const and = binary(compare, sym['&'] ? {'&': sym['&']} : {});
  const xor = binary(and, sym['^'] ? {'^': sym['^']} : {});
  const expr = binary(xor, sym['|'] ? {'|': sym['|']} : {});
  return {parse() { const x = expr(); if (i < tokens.length) throw new Refusal(`The expression has a stray “${tokens[i].v}”.`); return x; }};
}
export function parseExpression(text, base) {
  const {tokens, error} = tokenize(String(text));
  if (error) return {ok: false, error};
  if (!tokens.length) return {ok: false, error: 'Type an expression, such as 16*7.'};
  let ast;
  try { ast = parser(tokens, base).parse(); } catch (e) { if (e instanceof Refusal) return {ok: false, error: e.message}; throw e; }
  if (ast.leaf !== undefined) return {ok: false, error: 'An expression needs a block, such as 16*7.'};
  const tree = {}, inputs = [], spec = getBase(base);
  let n = 0, missing = null;
  const build = (x, parent, socket) => {
    if (x.leaf !== undefined) { inputs.push(x.leaf); return; }
    const id = `n${++n}`;
    tree[id] = {op: x.op, parent, socket};
    if (!spec.palette.includes(x.op)) missing ??= x.op;
    x.args.forEach((a, k) => build(a, id, socketsOf(x.op)[k]));
  };
  build(ast, 'io', 'C');
  if (missing) return {ok: false, error: `${BASE_NAMES[base] ?? base} has no ${BLOCKS[missing]}.`};
  return {ok: true, tree, inputs};
}

// ── algebra text ────────────────────────────────────────────────
const INFIX = {add: ['+', 2], sub: ['−', 2], mul: ['×', 3], div: ['÷', 3], mod: ['mod', 3], cmp: ['<=>', 0], and: ['AND', 1], or: ['OR', 1], xor: ['XOR', 1]};
const NAMED = {min: 'MIN', max: 'MAX', sum: 'SUM', cons: 'CONS', shl: 'shl', shr: 'shr', mule: 'mule', measure: 'measure', ln: 'ln'};
export const leafText = text => ({text, prec: / [+−×÷] /.test(text) ? 2 : 9, neg: text.startsWith('−')});
export function compose(op, parts) {
  if (INFIX[op]) {
    const [sym, p] = INFIX[op], [l, r] = parts;
    return {text: `${l.prec < p ? `(${l.text})` : l.text} ${sym} ${r.prec <= p || r.neg ? `(${r.text})` : r.text}`, prec: p};
  }
  if (op === 'not' || op === 'neg') { const x = parts[0], inner = x.prec < 9 || x.neg ? `(${x.text})` : x.text; return {text: op === 'not' ? `NOT ${inner}` : `−${inner}`, prec: 4}; }
  return {text: `${NAMED[op] ?? op}(${parts.map(x => x.text).join(', ')})`, prec: 9};
}

// ── exact evaluation ────────────────────────────────────────────
// Every node's operands and results, depth-first, left first. At the root DIV, MOD and SHR
// give [q, r]; below it DIV and SHR pass q up and MOD passes r. `limits: false` asks the
// base for the exact value even past its reach (planMachine's tooBig answer); a base that
// has no such limit ignores it.
export const QUOTIENT_OPS = ['div', 'mod', 'shr'];
export function evaluateNodes(tree, inputs, base, {limits = true} = {}) {
  const spec = getBase(base), root = rootOf(tree), nodes = {};
  if (!root) return {ok: false, reason: 'arity', node: null, message: 'Hang a block under the triangle first: drag one from the palette, or tap the triangle\'s socket and then a block'};
  let next = 0;
  const show = v => leafText(spec.display(v, {form: 'coin'}).text);
  const visit = id => {
    const node = tree[id], args = [], parts = [];
    for (const s of socketsOf(node.op)) {
      const c = childAt(tree, id, s);
      if (c) { const r = visit(c); if (!r.ok) return r; args.push(r.value); parts.push(r.part); }
      else { if (next >= inputs.length) return {ok: false, reason: 'arity', node: id, message: 'Not enough numbers for the machine'}; const v = inputs[next++]; args.push(v); parts.push(show(v)); }
    }
    const res = spec.evaluate(node.op, args, {limits});
    if (!res.ok) return {ok: false, reason: res.reason, node: id, message: explain(node.op, res, parts, args)};
    nodes[id] = {args, values: res.values};
    const value = QUOTIENT_OPS.includes(node.op) ? res.values[node.op === 'mod' ? 1 : 0] : res.values[0];
    return {ok: true, value, part: compose(node.op, parts)};
  };
  const r = visit(root);
  if (!r.ok) return r;
  const op = tree[root].op, values = QUOTIENT_OPS.includes(op) ? nodes[root].values : [r.value];
  return {ok: true, values, text: `[${values.map(v => spec.display(v, {form: 'coin'}).text).join(', ')}]`, nodes, root};
}
// A domain error names its cause, with the subexpression that produced the bad operand.
function explain(op, res, parts, args) {
  const said = (part, v) => { const shown = fmt(v); return part.text === shown ? shown : `${part.text} = ${shown}`; };
  if (res.reason === 'zeroDivision') return `Nothing fits into zero: the ${BLOCKS[op]}'s divisor is ${said(parts[1], args[1])}`;
  if (res.reason === 'domain' && ['shl', 'shr', 'mule'].includes(op)) return `A shift needs a whole number of levels ≥ 0: the ${BLOCKS[op]}'s count is ${said(parts[1], args[1])}`;
  if (res.reason === 'domain' && op === 'ln') return `ln needs a positive number: ${said(parts[0], args[0])} has no logarithm; its light would fall forever.`;
  return res.message;
}
export const takes = n => `This machine takes ${n} number${n === 1 ? '' : 's'}`;
// → {ok:true, values, text} | {ok:false, reason, node, message}. Beside 6.6's zeroDivision
// and domain, reason is 'arity' (no block, or a count of inputs the sockets do not take;
// node null) or 'tooBig' (a value past the base's reach, 6.10), as planMachine reports them.
export function evaluateTree(tree, inputs, base) {
  const open = rootOf(tree) ? openSockets(tree).length : 0;
  if (open && inputs.length !== open) return {ok: false, reason: 'arity', node: null, message: takes(open)};
  const r = evaluateNodes(tree, inputs, base);
  if (!r.ok) return {ok: false, reason: r.reason, node: r.node, message: r.message};
  return {ok: true, values: r.values, text: r.text};
}

// ── the sentence line ───────────────────────────────────────────
const placeIndex = at => Number(/:(\d+)$/.exec(at)?.[1] ?? 0);
const isFree = at => /^(in|io|out):\d+$/.test(at) || /\.C:\d+$/.test(at);
// The tree as algebra after each beat: `16 × 7` → `16 × 4 + 16 × 3` → `64 + 16 × 3` → … → `112`.
export function sentence(scene) {
  const nodes = scene.nodes, towers = Object.values(scene.towers).filter(t => !t.ghost);
  const at = new Map(towers.map(t => [t.at, t])), root = rootOf(nodes);
  const free = towers.filter(t => isFree(t.at)).sort((x, y) => placeIndex(x.at) - placeIndex(y.at));
  const text = t => t.reading ?? t.text;
  if (!root) return free.map(text).join(', ');
  let next = 0;
  const visit = id => {
    const node = nodes[id], C = at.get(`${id}.C`), Q = at.get(`${id}.Q`);
    if (Q || node.op === 'shr' && node.glyph === 0) {
      const q = Q ?? at.get(`${id}.L`), r = Q ? at.get(`${id}.L`) : at.get(`${id}.R`);
      if (q && r && node.arg && /^-?\d+$/.test(q.value) && /^-?\d+$/.test(r.value)) {
        const a = BigInt(q.value) * BigInt(node.arg) + BigInt(r.value);
        if (id === root) return {text: `${fmt(a)} = ${compose('mul', [leafText(fmt(node.arg)), leafText(q.text)]).text} + ${r.text.startsWith('−') ? `(${r.text})` : r.text}`, prec: 0};
        return leafText(`${q.text} r ${r.text}`);
      }
    }
    if (C && (node.glyph === 0 || socketsOf(node.op).length === 2)) return leafText(text(C));
    const parts = socketsOf(node.op).map(s => {
      const c = childAt(nodes, id, s); if (c) return visit(c);
      const t = at.get(`${id}.${s}`) ?? free[next++];
      return leafText(t ? text(t) : '?');
    });
    if (node.arg && node.op === 'shl') return compose('mul', parts);
    if (node.arg && node.op === 'shr') return compose('div', parts);
    return compose(node.op, parts);
  };
  return visit(root).text;
}
