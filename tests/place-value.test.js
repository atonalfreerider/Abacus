import test from 'node:test';
import assert from 'node:assert/strict';
import { digitPlaces, placeMetadata } from '../src/place-value.js';
import { stackContent } from '../src/mvc/view.js';
import { parseEquation, equationText, solution, frac } from '../src/engine.js';

test('local 1/10/100 card depth cycles reset at every comma',()=>{
  const number=digitPlaces('1,234,567,890');
  assert.deepEqual(number.places.map(p=>p.supportCards),[0,99,9,0,99,9,0,99,9,0]);
  assert.deepEqual(number.places.map(p=>p.mark),['B','M','M','M','k','k','k','','','']);
  assert.deepEqual(placeMetadata(6),{exponent:6,group:2,local:0,magnitude:1,cardCount:1,supportCards:0,mark:'M',name:'millions'});
});
test('each stack has the correct number of faces in its group, the top face inscribed',()=>{
  const hundredThousands=stackContent('stack-blue-5-front');
  assert.equal((hundredThousands.match(/class="card-face"/g)||[]).length,100);
  // Every card belongs to the k group; only the top face is visible enough to print it.
  assert.equal((hundredThousands.match(/data-group="k"/g)||[]).length,100);
  assert.equal((hundredThousands.match(/>k<\/text>/g)||[]).length,1);
  const million=stackContent('stack-blue-6-front');
  assert.equal((million.match(/class="card-face"/g)||[]).length,1);
  assert.equal((million.match(/>M<\/text>/g)||[]).length,1);
});
test('support cards show card-stock edges, with a coloured line every ten cards',()=>{
  const hundred=stackContent('stack-red-2-depth');
  assert.doesNotMatch(hundred,/data-layer="(?:[2-9]|\d\d+)"[^>]*><rect[^>]*fill="url\(#red\)"/,'only the top card is textured');
  assert.equal((hundred.match(/stroke="#b0432b"/g)||[]).length,9,'nine lines split a hundred into ten tens');
  assert.doesNotMatch(hundred,/#191a16"[^>]*\/><\/g><g class="card-face" data-layer="2"/);
});
test('comma input is accepted and malformed grouping is rejected',()=>{
  assert.equal(equationText(parseEquation('x + 1,234 = 2,234')),'x + 1,234 = 2,234');
  assert.deepEqual(solution(parseEquation('x + 1,234 = 2,234')).value,frac(1000));
  for(const value of ['12,34','1,2,345','1.2','hello','1000000000000000'])assert.throws(()=>digitPlaces(value));
  assert.throws(()=>parseEquation('x=12,34'),/commas/);
  assert.equal(digitPlaces('-0001234').formatted,'-1,234');
});
