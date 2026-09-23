// Minimal AVM2 (ABC) parser and disassembler for studying the original SWF.
// The SWF is treated purely as data: constant pools, traits and method bodies are
// decoded and printed; nothing is executed. See tools/swf-disasm.mjs for the CLI.
import { inflateSync } from 'node:zlib';

export function readSwf(input) {
  const data = input.subarray(0, 3).toString() === 'CWS' ? Buffer.concat([input.subarray(0, 8), inflateSync(input.subarray(8))]) : input;
  let p = 8 + Math.ceil((5 + 4 * (data[8] >> 3)) / 8) + 4;
  const header = data.subarray(8, p), tags = [];
  while (p < data.length) {
    const code = data.readUInt16LE(p); p += 2;
    let size = code & 63;
    if (size === 63) { size = data.readUInt32LE(p); p += 4; }
    tags.push({ type: code >> 6, bytes: data.subarray(p, p + size) }); p += size;
  }
  return { header, tags };
}

export function parseAbc(tag) {
  let start = 4; while (tag[start++]); // DoABC2: flags(u32) + name(cstring)
  const b = tag.subarray(start); let p = 4; // minor/major version
  const byte = () => b[p++];
  const u = () => { let n = 0, shift = 0, v; do { v = byte(); n += (v & 127) * 2 ** shift; shift += 7; } while ((v & 128) && shift < 35); return n >>> 0; };
  const s32 = () => u() | 0;
  const pool = f => { const a = [undefined]; for (let n = u(); n > 1; n--) a.push(f()); return a; };
  const ints = pool(s32);
  const uints = pool(u);
  const doubles = pool(() => { const d = b.readDoubleLE(p); p += 8; return d; });
  const strings = pool(() => { const n = u(), s = b.toString('utf8', p, p + n); p += n; return s; });
  const namespaces = pool(() => ({ kind: byte(), name: u() }));
  const nssets = pool(() => { const a = []; for (let n = u(); n > 0; n--) a.push(u()); return a; });
  const multinames = pool(() => {
    const kind = byte();
    if ([0x07, 0x0d].includes(kind)) return { kind, ns: u(), name: u() };
    if ([0x0f, 0x10].includes(kind)) return { kind, name: u() };
    if ([0x11, 0x12].includes(kind)) return { kind };
    if ([0x09, 0x0e].includes(kind)) return { kind, name: u(), nsset: u() };
    if ([0x1b, 0x1c].includes(kind)) return { kind, nsset: u() };
    if (kind === 0x1d) { const base = u(); const params = []; for (let n = u(); n > 0; n--) params.push(u()); return { kind, base, params }; }
    throw Error('Unknown multiname kind ' + kind);
  });
  const nsName = i => { const ns = namespaces[i]; if (!ns) return '*'; return strings[ns.name] ?? ''; };
  const mn = i => {
    if (i === 0) return '*';
    const m = multinames[i]; if (!m) return `#mn${i}?`;
    switch (m.kind) {
      case 0x07: case 0x0d: { const ns = nsName(m.ns); return (ns ? ns + '::' : '') + (strings[m.name] ?? '*'); }
      case 0x0f: case 0x10: return `[rtns]::${strings[m.name] ?? '*'}`;
      case 0x11: case 0x12: return '[rtns]::[rtname]';
      case 0x09: case 0x0e: return strings[m.name] ?? '*';
      case 0x1b: case 0x1c: return '[rtname]';
      case 0x1d: return `${mn(m.base)}.<${m.params.map(mn).join(',')}>`;
    }
  };
  const methods = [];
  for (let n = u(); n > 0; n--) {
    const count = u(); const ret = u(); const params = []; for (let i = 0; i < count; i++) params.push(u());
    const name = u(); const flags = byte(); const optional = [];
    if (flags & 8) for (let n = u(); n > 0; n--) optional.push({ val: u(), kind: byte() });
    const paramNames = [];
    if (flags & 128) for (let i = 0; i < count; i++) paramNames.push(strings[u()]);
    methods.push({ index: methods.length, paramCount: count, ret, params, name: strings[name], flags, optional, paramNames });
  }
  for (let n = u(); n > 0; n--) { u(); for (let n = u(); n > 0; n--) { u(); u(); } } // metadata
  const readTraits = (owner, onMethod) => {
    const out = [];
    for (let n = u(); n > 0; n--) {
      const name = mn(u()), attr = byte(), kind = attr & 15; const t = { name, kind };
      if (kind === 0 || kind === 6) { t.slot = u(); t.type = mn(u()); t.vindex = u(); if (t.vindex) t.vkind = byte(); }
      else if ([1, 2, 3].includes(kind)) { t.disp = u(); t.method = u(); onMethod && onMethod(t.method, owner + '.' + name + (kind === 2 ? '(get)' : kind === 3 ? '(set)' : '')); }
      else if (kind === 5) { t.slot = u(); t.method = u(); onMethod && onMethod(t.method, owner + '.' + name); }
      else if (kind === 4) { t.slot = u(); t.classi = u(); }
      else throw Error('Unknown trait kind ' + kind);
      if (attr & 64) for (let n = u(); n > 0; n--) u();
      out.push(t);
    }
    return out;
  };
  const setOwner = (mi, owner) => { if (!methods[mi].owner) methods[mi].owner = owner; };
  const instances = [];
  for (let n = u(); n > 0; n--) {
    const name = mn(u()); const superName = mn(u()); const flags = byte(); let protectedNs; if (flags & 8) protectedNs = u();
    const ifaces = []; for (let n = u(); n > 0; n--) ifaces.push(u());
    const iinit = u(); setOwner(iinit, name + '.constructor');
    const traits = readTraits(name, setOwner);
    instances.push({ name, superName, iinit, traits });
  }
  const classes = instances.map(inst => { const cinit = u(); setOwner(cinit, inst.name + '.static'); const traits = readTraits(inst.name + '$', setOwner); return { cinit, traits }; });
  const scripts = [];
  for (let n = u(); n > 0; n--) { const init = u(); setOwner(init, 'script' + scripts.length + '.init'); scripts.push({ init, traits: readTraits('script' + scripts.length, setOwner) }); }
  for (let n = u(); n > 0; n--) {
    const m = methods[u()];
    m.maxStack = u(); m.locals = u(); m.initScope = u(); m.maxScope = u();
    const size = u(); m.code = b.subarray(p, p + size); p += size;
    m.exceptions = [];
    for (let n = u(); n > 0; n--) m.exceptions.push({ from: u(), to: u(), target: u(), type: mn(u()), varName: mn(u()) });
    m.bodyTraits = readTraits('body', null);
  }
  if (p !== b.length) throw Error('ABC not fully consumed');
  return { ints, uints, doubles, strings, namespaces, nssets, multinames, mn, methods, instances, classes, scripts };
}

// operand kinds: mn=multiname, str=string, int, uint, dbl, u30, u8, s8, s24(branch), argc, meth, cls, ns, reg, exc
const OPS = {
  0x01: ['bkpt'], 0x02: ['nop'], 0x03: ['throw'], 0x04: ['getsuper', 'mn'], 0x05: ['setsuper', 'mn'], 0x06: ['dxns', 'str'], 0x07: ['dxnslate'],
  0x08: ['kill', 'reg'], 0x09: ['label'], 0x0c: ['ifnlt', 'br'], 0x0d: ['ifnle', 'br'], 0x0e: ['ifngt', 'br'], 0x0f: ['ifnge', 'br'],
  0x10: ['jump', 'br'], 0x11: ['iftrue', 'br'], 0x12: ['iffalse', 'br'], 0x13: ['ifeq', 'br'], 0x14: ['ifne', 'br'], 0x15: ['iflt', 'br'],
  0x16: ['ifle', 'br'], 0x17: ['ifgt', 'br'], 0x18: ['ifge', 'br'], 0x19: ['ifstricteq', 'br'], 0x1a: ['ifstrictne', 'br'], 0x1b: ['lookupswitch', 'switch'],
  0x1c: ['pushwith'], 0x1d: ['popscope'], 0x1e: ['nextname'], 0x1f: ['hasnext'], 0x20: ['pushnull'], 0x21: ['pushundefined'], 0x23: ['nextvalue'],
  0x24: ['pushbyte', 's8'], 0x25: ['pushshort', 'short'], 0x26: ['pushtrue'], 0x27: ['pushfalse'], 0x28: ['pushnan'], 0x29: ['pop'], 0x2a: ['dup'], 0x2b: ['swap'],
  0x2c: ['pushstring', 'str'], 0x2d: ['pushint', 'int'], 0x2e: ['pushuint', 'uint'], 0x2f: ['pushdouble', 'dbl'], 0x30: ['pushscope'], 0x31: ['pushnamespace', 'ns'],
  0x32: ['hasnext2', 'reg', 'reg'], 0x35: ['li8'], 0x36: ['li16'], 0x37: ['li32'], 0x38: ['lf32'], 0x39: ['lf64'], 0x3a: ['si8'], 0x3b: ['si16'], 0x3c: ['si32'], 0x3d: ['sf32'], 0x3e: ['sf64'],
  0x40: ['newfunction', 'meth'], 0x41: ['call', 'argc'], 0x42: ['construct', 'argc'], 0x43: ['callmethod', 'u30', 'argc'], 0x44: ['callstatic', 'meth', 'argc'],
  0x45: ['callsuper', 'mn', 'argc'], 0x46: ['callproperty', 'mn', 'argc'], 0x47: ['returnvoid'], 0x48: ['returnvalue'], 0x49: ['constructsuper', 'argc'],
  0x4a: ['constructprop', 'mn', 'argc'], 0x4c: ['callproplex', 'mn', 'argc'], 0x4e: ['callsupervoid', 'mn', 'argc'], 0x4f: ['callpropvoid', 'mn', 'argc'],
  0x50: ['sxi1'], 0x51: ['sxi8'], 0x52: ['sxi16'], 0x53: ['applytype', 'argc'], 0x55: ['newobject', 'argc'], 0x56: ['newarray', 'argc'], 0x57: ['newactivation'],
  0x58: ['newclass', 'cls'], 0x59: ['getdescendants', 'mn'], 0x5a: ['newcatch', 'exc'], 0x5d: ['findpropstrict', 'mn'], 0x5e: ['findproperty', 'mn'], 0x5f: ['finddef', 'mn'],
  0x60: ['getlex', 'mn'], 0x61: ['setproperty', 'mn'], 0x62: ['getlocal', 'reg'], 0x63: ['setlocal', 'reg'], 0x64: ['getglobalscope'], 0x65: ['getscopeobject', 'u8'],
  0x66: ['getproperty', 'mn'], 0x67: ['getouterscope', 'u30'], 0x68: ['initproperty', 'mn'], 0x6a: ['deleteproperty', 'mn'], 0x6c: ['getslot', 'slot'], 0x6d: ['setslot', 'slot'],
  0x6e: ['getglobalslot', 'u30'], 0x6f: ['setglobalslot', 'u30'], 0x70: ['convert_s'], 0x71: ['esc_xelem'], 0x72: ['esc_xattr'], 0x73: ['convert_i'], 0x74: ['convert_u'],
  0x75: ['convert_d'], 0x76: ['convert_b'], 0x77: ['convert_o'], 0x78: ['checkfilter'], 0x80: ['coerce', 'mn'], 0x81: ['coerce_b'], 0x82: ['coerce_a'], 0x83: ['coerce_i'],
  0x84: ['coerce_d'], 0x85: ['coerce_s'], 0x86: ['astype', 'mn'], 0x87: ['astypelate'], 0x88: ['coerce_u'], 0x89: ['coerce_o'], 0x90: ['negate'], 0x91: ['increment'],
  0x92: ['inclocal', 'reg'], 0x93: ['decrement'], 0x94: ['declocal', 'reg'], 0x95: ['typeof'], 0x96: ['not'], 0x97: ['bitnot'], 0xa0: ['add'], 0xa1: ['subtract'],
  0xa2: ['multiply'], 0xa3: ['divide'], 0xa4: ['modulo'], 0xa5: ['lshift'], 0xa6: ['rshift'], 0xa7: ['urshift'], 0xa8: ['bitand'], 0xa9: ['bitor'], 0xaa: ['bitxor'],
  0xab: ['equals'], 0xac: ['strictequals'], 0xad: ['lessthan'], 0xae: ['lessequals'], 0xaf: ['greaterthan'], 0xb0: ['greaterequals'], 0xb1: ['instanceof'],
  0xb2: ['istype', 'mn'], 0xb3: ['istypelate'], 0xb4: ['in'], 0xc0: ['increment_i'], 0xc1: ['decrement_i'], 0xc2: ['inclocal_i', 'reg'], 0xc3: ['declocal_i', 'reg'],
  0xc4: ['negate_i'], 0xc5: ['add_i'], 0xc6: ['subtract_i'], 0xc7: ['multiply_i'], 0xd0: ['getlocal0'], 0xd1: ['getlocal1'], 0xd2: ['getlocal2'], 0xd3: ['getlocal3'],
  0xd4: ['setlocal0'], 0xd5: ['setlocal1'], 0xd6: ['setlocal2'], 0xd7: ['setlocal3'], 0xef: ['debug', 'debug'], 0xf0: ['debugline', 'u30'], 0xf1: ['debugfile', 'str'],
  0xf2: ['bkptline', 'u30'], 0xf3: ['timestamp'],
};

export function disassemble(abc, m, { skipDebugLines = true } = {}) {
  const c = m.code; let p = 0;
  const byte = () => c[p++];
  const u = () => { let n = 0, shift = 0, v; do { v = byte(); n += (v & 127) * 2 ** shift; shift += 7; } while ((v & 128) && shift < 35); return n >>> 0; };
  const s24 = () => { let v = c[p] | (c[p + 1] << 8) | (c[p + 2] << 16); p += 3; if (v & 0x800000) v -= 0x1000000; return v; };
  const regNames = {};
  // body trait slot names (activation object slots)
  const slotNames = {}; for (const t of m.bodyTraits || []) if (t.slot) slotNames[t.slot] = t.name;
  const lines = []; const targets = new Set();
  const q = s => JSON.stringify(s);
  while (p < c.length) {
    const at = p; const op = byte(); const def = OPS[op];
    if (!def) { lines.push({ at, text: `UNKNOWN_0x${op.toString(16)}` }); continue; }
    const [name, ...kinds] = def; const args = [];
    try {
      for (const k of kinds) {
        switch (k) {
          case 'mn': args.push(abc.mn(u())); break;
          case 'str': { const i = u(); args.push(q(abc.strings[i])); break; }
          case 'int': args.push(String(abc.ints[u()])); break;
          case 'uint': args.push(String(abc.uints[u()])); break;
          case 'dbl': args.push(String(abc.doubles[u()])); break;
          case 'ns': { const i = u(); args.push('ns:' + q(abc.strings[abc.namespaces[i]?.name])); break; }
          case 'u30': args.push(String(u())); break;
          case 'u8': args.push(String(byte())); break;
          case 's8': { let v = byte(); if (v > 127) v -= 256; args.push(String(v)); break; }
          case 'short': { let v = u(); if (v & 0x8000) v = (v & 0xffff) - 0x10000; args.push(String(v)); break; }
          case 'argc': args.push('argc=' + u()); break;
          case 'reg': { const r = u(); args.push('r' + r + (regNames[r] ? `(${regNames[r]})` : '')); break; }
          case 'slot': { const s = u(); args.push(s + (slotNames[s] ? `(${slotNames[s]})` : '')); break; }
          case 'meth': { const i = u(); const tm = abc.methods[i]; args.push(`method#${i}` + (tm?.owner ? `<${tm.owner}>` : tm?.name ? `<${tm.name}>` : '')); break; }
          case 'cls': args.push('class#' + u()); break;
          case 'exc': args.push('exc#' + u()); break;
          case 'br': { const off = s24(); const t = p + off; targets.add(t); args.push('L' + t); break; }
          case 'switch': { const base = at; const def = base + s24(); targets.add(def); const n = u(); const cs = []; for (let i = 0; i <= n; i++) { const t = base + s24(); targets.add(t); cs.push('L' + t); } args.push('default:L' + def, '[' + cs.join(',') + ']'); break; }
          case 'debug': { const type = byte(); const si = u(); const reg = byte(); u(); if (type === 1) regNames[reg + 1] = abc.strings[si]; args.push(`${type} ${q(abc.strings[si])} r${reg + 1}`); break; }
        }
      }
    } catch (e) { lines.push({ at, text: `${name} <decode error ${e.message}>` }); break; }
    let text = name + (args.length ? ' ' + args.join(', ') : '');
    if (/^(get|set)local[0-3]$/.test(name)) { const r = +name.slice(-1); if (regNames[r]) text += ` (${regNames[r]})`; }
    if (skipDebugLines && (name === 'debugline' || name === 'debugfile')) { lines.push({ at, text, dbg: true }); continue; }
    lines.push({ at, text });
  }
  // Re-annotate local register names for early getlocal_n uses (debug opcodes appear at start typically)
  const out = [];
  for (const l of lines) {
    if (targets.has(l.at)) out.push(`L${l.at}:`);
    if (l.dbg && skipDebugLines) { if (l.text.startsWith('debugline')) out.push(`    ; line ${l.text.split(' ')[1]}`); continue; }
    out.push(`    ${String(l.at).padStart(5)}  ${l.text}`);
  }
  return out.join('\n');
}

export function describe(abc, m) {
  const cv = o => { const k = o.kind, v = o.val; return k === 3 ? abc.ints[v] : k === 4 ? abc.uints[v] : k === 6 ? abc.doubles[v] : k === 1 ? JSON.stringify(abc.strings[v]) : k === 10 ? 'false' : k === 11 ? 'true' : k === 12 ? 'null' : k === 0 ? 'undefined' : `kind${k}#${v}`; };
  const firstOpt = m.params.length - (m.optional || []).length;
  const params = m.params.map((t, i) => `${m.paramNames[i] || 'p' + (i + 1)}:${abc.mn(t)}` + (i >= firstOpt ? ' = ' + cv(m.optional[i - firstOpt]) : '')).join(', ');
  const head = `=== method#${m.index} ${m.owner || '(anonymous' + (m.name ? ' ' + m.name : '') + ')'} (${params}):${abc.mn(m.ret)}  locals=${m.locals} maxStack=${m.maxStack}`;
  const traits = (m.bodyTraits || []).length ? `  activation slots: ${m.bodyTraits.map(t => `${t.slot}=${t.name}`).join(', ')}` : '';
  const exc = (m.exceptions || []).length ? `  exceptions: ${JSON.stringify(m.exceptions)}` : '';
  return [head, traits, exc].filter(Boolean).join('\n');
}
