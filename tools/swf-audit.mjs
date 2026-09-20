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
export function readMethods(tag) {
  let start = 4; while (tag[start++]);
  const b = tag.subarray(start); let p = 4;
  const byte = () => b[p++];
  const u = () => { let n = 0, shift = 0, v; do { v = byte(); n |= (v & 127) << shift; shift += 7; } while (v & 128); return n >>> 0; };
  const pool = f => { const a = [null]; for (let n = u(); n > 1; n--) a.push(f()); return a; };
  pool(u); pool(u); pool(() => p += 8);
  const strings = pool(() => { const n = u(), s = b.toString('utf8', p, p + n); p += n; return s; });
  const namespaces = pool(() => ({ kind: byte(), name: u() }));
  pool(() => { for (let n = u(); n > 0; n--) u(); });
  const names = pool(() => {
    const kind = byte();
    if ([7, 13].includes(kind)) return { space: u(), name: u() };
    if ([15, 16, 27, 28].includes(kind)) u();
    else if ([9, 14].includes(kind)) { u(); u(); }
    else if (kind === 29) { u(); for (let n = u(); n > 0; n--) u(); }
    else if (![17, 18].includes(kind)) throw Error('Unknown multiname');
    return {};
  });
  const name = i => `${strings[namespaces[names[i]?.space]?.name] || ''}:${strings[names[i]?.name] || ''}`;
  const methods = [];
  for (let n = u(); n > 0; n--) {
    const begin = p, count = u(); u(); for (let i = 0; i < count; i++) u();
    u(); const flags = byte();
    if (flags & 8) for (let n = u(); n > 0; n--) { u(); byte(); }
    if (flags & 128) for (let i = 0; i < count; i++) u();
    methods.push({ declaration: b.subarray(begin, p) });
  }
  const traits = owner => { for (let n = u(); n > 0; n--) {
    const label = name(u()), attr = byte(), kind = attr & 15;
    if (kind === 0 || kind === 6) { u(); u(); if (u()) byte(); }
    else if ([1, 2, 3, 5].includes(kind)) { u(); methods[u()].owner = owner + '.' + label; }
    else if (kind === 4) { u(); u(); } else throw Error('Unknown trait');
    if (attr & 64) for (let n = u(); n > 0; n--) u();
  } };
  for (let n = u(); n > 0; n--) { u(); for (let n = u() * 2; n > 0; n--) u(); }
  const classes = [];
  for (let n = u(); n > 0; n--) {
    const owner = name(u()); classes.push(owner); u(); if (byte() & 8) u();
    for (let n = u(); n > 0; n--) u(); methods[u()].owner = owner + '.constructor'; traits(owner);
  }
  for (const owner of classes) { methods[u()].owner = owner + '.static'; traits(owner); }
  for (let n = u(); n > 0; n--) { methods[u()].owner = 'script'; traits('script'); }
  for (let n = u(); n > 0; n--) {
    const method = methods[u()]; method.stack = u(); method.locals = u(); method.initScope = u(); method.maxScope = u();
    const size = u(); method.code = b.subarray(p, p + size); p += size;
    const begin = p;
    for (let n = u(); n > 0; n--) for (let i = 0; i < 5; i++) u(); traits('body');
    method.exceptionsAndTraits = b.subarray(begin, p);
  }
  if (p !== b.length) throw Error('ABC not fully consumed');
  return methods;
}
