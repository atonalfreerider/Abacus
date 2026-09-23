import test from 'node:test';
import assert from 'node:assert/strict';
import * as math from '../src/engine.js';
import {EquationModel,preservesResidual} from '../src/mvc/model.js';
import {Controller} from '../src/mvc/controller.js';
import {renderEquation} from '../src/mvc/view.js';

const value=text=>math.format(math.parseScalar(text));
test('× and ÷ between numbers stay as one unevaluated term with the exact value',()=>{
 for(const [input,text,result] of [['23*4','23 × 4','92'],['2*3*4','2 × 3 × 4','24'],['156÷12','156 ÷ 12','13'],['156:12','156 ÷ 12','13'],['7÷4','7 ÷ 4','7/4'],['2*(3+4)','2 × 7','14'],['-2*3','−2 × 3','-6'],['3*(-4)','3 × (−4)','-12'],['6÷1/2','6 ÷ 1/2','12']]){
  const [t]=math.parseExpression(input);assert.ok(t.expr,input);assert.equal(math.sideText([t]),text);assert.equal(math.format(t.value),result);
  assert.equal(value(math.sideText([t]).replace('−','-')),result,'text round-trips: '+input);
 }
 for(const [input,text] of [['1/3','1/3'],['2(x+3)','2x + 6'],['3*x','3x'],['x/2','1/2x'],['0.5/2','0.25']])assert.equal(math.sideText(math.parseExpression(input)),text);
});
test('evaluation works left to right, flips fraction divisors and chooses result notation',()=>{
 const steps=input=>{const out=[];let t=math.parseExpression(input)[0];while(t){out.push(math.termText(t)+':'+t.notation);t=math.evaluateStep(t);}return out;};
 assert.deepEqual(steps('23*4*2'),['23 × 4 × 2:auto','92 × 2:auto','184:auto']);
 assert.deepEqual(steps('6÷1/2'),['6 ÷ 1/2:auto','6 × 2:auto','12:auto']);
 assert.deepEqual(steps('7÷4'),['7 ÷ 4:auto','1.75:decimal']);
 assert.deepEqual(steps('7÷3'),['7 ÷ 3:auto','7/3:mixed']);
 assert.deepEqual(steps('2.5*1.2'),['2.5 × 1.2:auto','3:auto']);
 assert.deepEqual(steps('1/2÷2'),['1/2 ÷ 2:auto','1/4:fraction','0.25:decimal']);
 assert.deepEqual(steps('3/4'),['3/4:fraction','0.75:decimal']);
 assert.deepEqual(steps('7/3'),['7/3:fraction','7/3:mixed']);
});
test('crossing the mirror, scaling both sides and simplifying keep products exact',()=>{
 const m=new EquationModel('23*4=x+2'),id=m.state.left[0].id;
 m.dispatch({type:'move',id,side:'right'});const moved=m.state.right.find(t=>t.id===id);assert.equal(math.termText(moved),'−23 × 4');assert.equal(moved.value.n,-92);
 m.dispatch({type:'operate',operation:'multiply',amount:'2'});assert.equal(math.termText(m.state.right.find(t=>t.id===id)),'−23 × 4 × 2');
 m.dispatch({type:'operate',operation:'divide',amount:'2'});assert.deepEqual(m.result().value,math.frac(90));
 assert.throws(()=>m.dispatch({type:'combine',id,target:m.state.right.find(t=>t.kind==='constant'&&!t.expr).id}),/Work out/);
});
test('an unevaluated product never counts as solved',()=>{
 assert.equal(math.isSolved(math.parseEquation('x=23*4')),false);
 const m=new EquationModel('x=23*4');m.dispatch(m.nextStep());assert.ok(math.isSolved(m.state));assert.equal(math.equationText(m.state),'x = 92');
});
test('the planner works products out first, prefers zero pairs and keeps x positive',()=>{
 const m=new EquationModel('x+9-7+2*3=6+x+x');const first=m.nextStep();assert.equal(first.type,'evaluate');m.dispatch(first);
 const second=m.nextStep();assert.equal(second.type,'combine');const pair=[second.id,second.target].map(id=>m.state.left.find(t=>t.id===id).value.n).sort((a,b)=>a-b);assert.ok(pair[0]<0&&pair[1]>0,'cancels opposite signs first');
 const r=new EquationModel('7=x+3');r.dispatch(r.nextStep());assert.equal(math.equationText(r.state),'7 − 3 = x');
 for(const [input,answer] of [['x+3=7','4'],['7=x+3','4'],['3x+1=x+9','4'],['x+1=3x-9','5'],['x/2+1/3=5/6','1'],['2/3x=4','6'],['5-2x=11','-3'],['4x-1=2','3/4'],['2x+3*4=20','4'],['x=156÷12','13'],['3x=6÷1/2','4'],['x+1=x+2',null],['2(x+1)=2x+2',null]]){
  const m=new EquationModel(input);let steps=0,command;
  while((command=m.nextStep())){const tx=m.dispatch(command);assert.ok(preservesResidual(tx.before,tx.after,command),input);assert.ok(++steps<25,input);}
  if(answer===null)assert.notEqual(m.result().type,'unique');else{assert.ok(math.isSolved(m.state),input+' → '+math.equationText(m.state));assert.deepEqual(m.result().value,math.parseScalar(answer));}
 }
 const e=new EquationModel('3+4*2');let c;while((c=e.nextStep()))e.dispatch(c);assert.equal(math.equationText(e.state).split(' =')[0],'11');
});
test('dropping a card on an unlike or unworked term rearranges instead of failing',()=>{
 const c=new Controller({render(){}},'x+3=7');const [x,three]=c.model.state.left;
 c.drop(three.id,'left',x.id,0,0);assert.equal(math.equationText(c.model.state),'3 + x = 7');c.finish();
 const p=new Controller({render(){}},'2*3+4=x');const [product,four]=p.model.state.left;p.drop(four.id,'left',product.id,0,0);assert.equal(math.equationText(p.model.state),'4 + 2 × 3 = x');
 const q=new Controller({render(){}},'x+3=7');q.drop(q.model.state.left[1].id,'right',null,0,0);assert.equal(math.equationText(q.model.state),'x = −3 + 7');
});
test('operation terms and mixed numbers render without invalid geometry',()=>{
 for(const input of ['23*4-3*(-2)+7÷3=x+156÷12','x=7/3','x=-7/3']){const m=new EquationModel(input);const svg=renderEquation(m.state);assert.doesNotMatch(svg,/NaN|undefined/);if(input.includes('*'))assert.match(svg,/class="operation-frame"/);}
 const mixed=new EquationModel('x=7÷3');mixed.dispatch(mixed.nextStep());const svg=renderEquation(mixed.state);assert.match(svg,/slice-label[^>]*>1\/3</);assert.match(svg,/>2</);
});
