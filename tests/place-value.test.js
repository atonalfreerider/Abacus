import test from 'node:test';
import assert from 'node:assert/strict';
import { digitPlaces, placeMetadata } from '../src/place-value.js';
import { grid } from '../src/blocks.js';
import { parseEquation, equationText, solution, frac } from '../src/engine.js';

test('local 1/10/100 card depth cycles reset at every comma',()=>{
  const number=digitPlaces('1,234,567,890');
  assert.deepEqual(number.places.map(p=>p.supportCards),[0,10,1,0,10,1,0,10,1,0]);
  assert.deepEqual(number.places.map(p=>p.mark),['B','M','M','M','k','k','k','','','']);
  assert.deepEqual(placeMetadata(6),{exponent:6,group:2,local:0,magnitude:1,supportCards:0,mark:'M',name:'millions'});
});
test('each occupied cell has the correct under-stack, including each support face inscription',()=>{
  const hundreds=grid(2,'blue',{exponent:5});
  assert.equal((hundreds.match(/class="support-card"/g)||[]).length,20);
  assert.equal((hundreds.match(/class="unit-card"/g)||[]).length,2);
  assert.equal((hundreds.match(/>k<\/text>/g)||[]).length,22);
  const million=grid(3,'blue',{exponent:6});
  assert.equal((million.match(/class="support-card"/g)||[]).length,0);
  assert.equal((million.match(/>M<\/text>/g)||[]).length,3);
});
test('comma input is accepted and malformed grouping is rejected',()=>{
  assert.equal(equationText(parseEquation('x + 1,234 = 2,234')),'x + 1,234 = 2,234');
  assert.deepEqual(solution(parseEquation('x + 1,234 = 2,234')).value,frac(1000));
  for(const value of ['12,34','1,2,345','1.2','hello','1000000000000000'])assert.throws(()=>digitPlaces(value));
  assert.throws(()=>parseEquation('x=12,34'),/commas/);
  assert.equal(digitPlaces('-0001234').formatted,'-1,234');
});
