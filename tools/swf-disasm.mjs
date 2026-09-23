// Print the AVM2 bytecode of methods in the original SWF, for reference work.
// Usage: npm run swf:disasm -- [--list] [--swf path] ownerPrefix...
//   npm run swf:disasm -- absrc::Multiplication    (Multiplier, Base10Factor, Duplicator, Sum)
//   npm run swf:disasm -- absrc::PolyNom$.mouseUpHandler
// Closures created with newfunction are followed and printed too.
import { readFileSync } from 'node:fs';
import { readSwf, parseAbc, disassemble, describe } from './avm2.mjs';
const args = process.argv.slice(2), at = args.indexOf('--swf');
const swfPath = at >= 0 ? args.splice(at, 2)[1] : 'public/ABACUS.swf';
const list = args.includes('--list'), prefixes = args.filter(a => !a.startsWith('--'));
if (!list && !prefixes.length) { console.error('Give an owner prefix such as absrc::Multiplication, or --list.'); process.exit(1); }
for (const tag of readSwf(readFileSync(swfPath)).tags.filter(t => t.type === 82)) {
  const abc = parseAbc(tag.bytes);
  if (list) { for (const m of abc.methods) if (m.owner) console.log(`method#${m.index} ${m.owner}`); continue; }
  const queue = abc.methods.filter(m => m.owner && prefixes.some(p => m.owner.startsWith(p))), seen = new Set();
  while (queue.length) {
    const m = queue.shift(); if (seen.has(m.index) || !m.code) continue; seen.add(m.index);
    const text = disassemble(abc, m);
    console.log(describe(abc, m) + '\n' + text + '\n');
    for (const match of text.matchAll(/newfunction method#(\d+)/g)) { const inner = abc.methods[+match[1]]; inner.owner ||= `closure-in(${m.owner})#${inner.index}`; queue.push(inner); }
  }
}
