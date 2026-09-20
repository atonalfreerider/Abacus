import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readSwf, readMethods } from '../tools/swf-audit.mjs';
const original = fs.readFileSync('public/ABACUS.swf');
const patched = fs.readFileSync('public/abacus-director.swf');
const a = readSwf(original), b = readSwf(patched);
test('the reference SWF remains the supplied file', () => {
  assert.equal(crypto.createHash('sha256').update(original).digest('hex'), 'c2749b7d0d685ea82c6b812de82ef469ec57843e037be16b2c8c278111e0b781');
});
test('every original drawing, texture, font and timeline tag is byte-identical', () => {
  assert.deepEqual(a.header, b.header);
  assert.equal(a.tags.length, b.tags.length);
  for (let i = 0; i < a.tags.length; i++) {
    assert.equal(a.tags[i].type, b.tags[i].type);
    if (a.tags[i].type !== 82) assert.deepEqual(a.tags[i].bytes, b.tags[i].bytes, `Tag ${i}`);
  }
});
test('635 original methods are unchanged; two keep their original prefix plus documented hooks', () => {
  const old = readMethods(a.tags.find(t => t.type === 82).bytes);
  const next = readMethods(b.tags.find(t => t.type === 82).bytes);
  assert.ok(next.length > old.length);
  let hooks = 0;
  old.forEach((method, i) => {
    const after = next[i];
    assert.deepEqual(method.declaration, after.declaration);
    assert.equal(method.owner, after.owner);
    assert.deepEqual(method.exceptionsAndTraits, after.exceptionsAndTraits);
    if (['absrc:ABMain.:ABMainInit', 'absrc:Operator.:SwitchSign'].includes(method.owner)) {
      hooks++;
      assert.deepEqual(method.code.subarray(0, -1), after.code.subarray(0, method.code.length - 1));
    } else assert.deepEqual(method.code, after.code, method.owner);
  });
  assert.equal(hooks, 2);
});
test('provenance identifies the exact shipped director SWF', () => {
  const report = JSON.parse(fs.readFileSync('public/swf-provenance.json'));
  assert.equal(report.outputSha256, crypto.createHash('sha256').update(patched).digest('hex'));
});
