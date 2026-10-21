import test from 'node:test';
import assert from 'node:assert/strict';
import { setStyle, ink, styles, patternDefs } from '../src/mvc/theme.js';
import { face, stackContent, textureDefs } from '../src/mvc/view.js';
import { placeMetadata } from '../src/place-value.js';
import { COLORS } from '../src/graph/graph-view.js';

test('the cyber style recolours card faces, edges, patterns and curves, and switches back exactly', () => {
  const sketch = face(0, 0, 43, 'red', placeMetadata(3)), sketchStack = stackContent('stack-blue-2-front'), sketchDefs = textureDefs();
  assert.match(sketchDefs, /swf-25\.jpg/);
  setStyle('cyber');
  try {
    assert.equal(ink.name, 'cyber');
    const neon = face(0, 0, 43, 'red', placeMetadata(3));
    assert.match(neon, new RegExp(`stroke="${styles.cyber.stroke.red}"`));
    assert.doesNotMatch(neon, /#191a16/);
    assert.notEqual(stackContent('stack-blue-2-front'), sketchStack, 'cached stacks are redrawn in the new style');
    assert.doesNotMatch(textureDefs(), /<image/);
    assert.match(patternDefs('g-'), /id="g-blue"/);
    assert.deepEqual(COLORS, styles.cyber.curves);
  } finally { setStyle('sketchpad'); }
  assert.equal(face(0, 0, 43, 'red', placeMetadata(3)), sketch);
  assert.equal(stackContent('stack-blue-2-front'), sketchStack);
  assert.equal(textureDefs(), sketchDefs);
  assert.deepEqual(COLORS, styles.sketchpad.curves);
  assert.throws(() => setStyle('vaporwave'));
});
