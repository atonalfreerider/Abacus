import test from 'node:test';
import assert from 'node:assert/strict';
import { frac, add, sub, mul, div, parseEquation, parseScalar, equationText, solution, isSolved, transpose, cancelPair, simplify, operate, evaluate, lessons, eq, format } from '../src/engine.js';

test('fractions are normalized and exact through operations',()=>{
  assert.deepEqual(frac(-2,-4),frac(1,2));
  assert.deepEqual(add(frac(1,3),frac(1,6)),frac(1,2));
  assert.deepEqual(sub(frac(1,2),frac(2,3)),frac(-1,6));
  assert.deepEqual(mul(frac(4,9),frac(3,8)),frac(1,6));
  assert.deepEqual(div(frac(2,3),frac(-4,5)),frac(-5,6));
  assert.throws(()=>frac(1,0),/zero/);
});
test('parser preserves additive blocks, handles decimals, fractions, unary signs and parentheses',()=>{
  assert.equal(equationText(parseEquation('2(x + 3) = 18')),'2x + 6 = 18');
  assert.equal(equationText(parseEquation('x/2 + 1/3 = 5/6')),'1/2x + 1/3 = 5/6');
  assert.equal(equationText(parseEquation('-(x - 2) = .5')),'−x + 2 = 1/2');
  assert.deepEqual(parseScalar('0.1 + 0.2'),frac(3,10));
  assert.deepEqual(parseScalar('2 * (3 + 4)'),frac(14));
  assert.deepEqual(solution(parseEquation('3/4x − 1/2 = 1')), {type:'unique',value:frac(2)});
});
test('invalid, nonlinear and executable expressions are rejected',()=>{
  for(const input of ['x=','x+1','x=2=3','x*x=2','2/x=1','x^2=1','alert(1)=1','x+ =2','x/(1-1)=2','y+1=2','(x+1=2','x=2)']) assert.throws(()=>parseEquation(input),undefined,input);
  assert.throws(()=>parseScalar('2x'),/number/);
});
test('moving +3 across equals produces -3 and solves the first lesson',()=>{
  const original=parseEquation('x+3=7');
  const moved=transpose(original,original.left[1].id,'right');
  assert.equal(equationText(moved),'x = 7 − 3');
  const done=simplify(moved);
  assert.equal(equationText(done),'x = 4');
  assert.ok(isSolved(done));
  assert.deepEqual(solution(done),solution(original));
  assert.equal(equationText(original),'x + 3 = 7');
});
test('zero pairs cancel fully or leave an exact remainder',()=>{
  const original=parseEquation('x+7-3=4');
  const next=cancelPair(original,original.left[1].id,original.left[2].id);
  assert.equal(equationText(next),'x + 4 = 4');
  const fractions=parseEquation('x+1/3-1/3=0');
  const result=cancelPair(fractions,fractions.left[1].id,fractions.left[2].id);
  assert.ok(isSolved(result));
  assert.equal(equationText(result),'x = 0');
  assert.throws(()=>cancelPair(original,original.left[0].id,original.left[2].id),/same kind/);
});
test('zero multiplication and division are blocked to preserve solution sets',()=>{
  for(const op of ['multiply','divide']) assert.throws(()=>operate(parseEquation('x=2'),op,frac(0)),/nonzero/);
  assert.throws(()=>operate(parseEquation('x=2'),'unknown',frac(1)),/operation/);
});
test('identity, impossible equations, negative and fractional answers are distinct',()=>{
  assert.deepEqual(solution(parseEquation('x+2=x+2')),{type:'identity'});
  assert.deepEqual(solution(parseEquation('x+2=x+3')),{type:'impossible'});
  assert.deepEqual(solution(parseEquation('5-2x=11')),{type:'unique',value:frac(-3)});
  assert.deepEqual(solution(parseEquation('4x-1=2')),{type:'unique',value:frac(3,4)});
  assert.ok(isSolved(parseEquation('3/4=x')));
  assert.ok(!isSolved(parseEquation('2x=4')));
  assert.ok(!isSolved(parseEquation('x=2+2')));
});
test('all lessons have expected answers, and substitutions satisfy both sides',()=>{
  const expected=['4','9','4','4','1','6','-3','3/4'];
  for(const [index,lesson] of lessons.entries()){
    const equation=parseEquation(lesson.equation), result=solution(equation);
    assert.equal(format(result.value),expected[index],lesson.id);
    assert.deepEqual(evaluate(equation.left,result.value),evaluate(equation.right,result.value));
  }
});
test('all legal transformations preserve solutions across every lesson and rational factor',()=>{
  for(const lesson of lessons){
    const equation=parseEquation(lesson.equation), expected=solution(equation);
    for(const amount of [frac(2),frac(-3),frac(1,3),frac(-2,7)]){
      for(const op of ['add','subtract','multiply','divide']){
        const changed=operate(equation,op,amount);
        assert.deepEqual(solution(changed),expected,`${lesson.id} ${op}`);
        assert.deepEqual(solution(simplify(changed)),expected);
      }
    }
    for(const side of ['left','right'])for(const item of equation[side])assert.deepEqual(solution(transpose(equation,item.id,side==='left'?'right':'left')),expected);
  }
});
test('large intermediate fractions reduce exactly without float overflow',()=>{
  assert.deepEqual(mul(frac(999999999,999999998),frac(999999998,999999999)),frac(1));
  assert.throws(()=>frac(1000000001),/large/);
});
