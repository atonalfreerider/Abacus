import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInput, matches, lessons } from '../src/lessons.js';
test('typing preserves terms and translates supported keyboard input', () => {
  assert.equal(normalizeInput('X + 3 = 7'), 'x+3=7');
  assert.equal(normalizeInput('1,000 + .5'), '1000+0.5');
  assert.equal(normalizeInput('3 × 4'), '3*4');
  for (const lesson of lessons) for (const step of lesson.steps) assert.doesNotThrow(() => normalizeInput(step.before));
});
test('unsupported or malformed input is rejected before changing the SWF', () => {
  for (const input of ['1/2', 'x^2', '(x+1)', 'alert(1)', 'x++1', 'x=', '1,00', '1000000000', '']) assert.throws(() => normalizeInput(input));
});
test('director requires an idle, correctly signed, fully combined result', () => {
  const expected = [[{kind:'constant',value:10}],[]];
  const state = {busy:0,dragging:false,hasEquals:false,equalIndex:1,terms:[{index:0,kind:'constant',value:10,positive:true,children:3}]};
  assert.ok(matches(state, expected));
  for (const patch of [{busy:1}, {dragging:true}, {terms:[{...state.terms[0],positive:false}]}, {terms:[{...state.terms[0],children:5}]}]) assert.equal(matches({...state,...patch},expected),false);
});
test('crossing practice accepts either order on one side without losing duplicate terms', () => {
  const state = {busy:0,dragging:false,hasEquals:true,equalIndex:1,terms:[
    {index:0,kind:'x',value:1,positive:true,children:5},
    {index:2,kind:'constant',value:3,positive:false,children:3},
    {index:3,kind:'constant',value:7,positive:true,children:3},
  ]};
  assert.ok(matches(state, lessons[0].steps[0].expected));
  state.terms[2] = {...state.terms[1],index:3};
  assert.equal(matches(state, lessons[0].steps[0].expected),false);
});
