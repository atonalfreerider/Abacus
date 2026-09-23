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

import {multiplicationPlan,divisionPlan} from '../src/mvc/operations.js';
import {unitValue} from '../src/mvc/units.js';
test('multiplication copies one factor once per card of the other and conserves the product',()=>{
 let seed=7;const next=n=>{seed=(seed*1103515245+12345)%2147483648;return seed%n;};
 for(let i=0;i<150;i++){
  const a=next(999)+1,b=next(99)+1,sign=next(2)?-1:1,[term]=math.parseExpression(`${sign*a}*${b}`),plan=multiplicationPlan(term);
  const sum=n=>[...String(n)].reduce((s,d)=>s+Number(d),0);
  if(Math.min(sum(a),sum(b))>24){assert.equal(plan,null);continue;}
  assert.equal(plan.copies.length,Math.min(sum(a),sum(b)));
  assert.equal(unitValue(plan.units.final),BigInt(sign*a*b),`${sign*a}×${b}`);
  for(const phase of plan.units.phases)assert.ok(phase.after.filter(t=>t.owner==='result').every(t=>t.cell<20),'a place never piles past 20 cards');
 }
 const decimal=multiplicationPlan(math.parseExpression('2.5*1.5')[0]);assert.equal(unitValue(decimal.units.final)*10n**0n,375n);assert.equal(decimal.units.placeShift,-2);
 assert.equal(multiplicationPlan(math.parseExpression('1/3*2')[0]),null,'fractions use the symbolic transition');
});
test('long division deals equal groups, unstacks leftovers and slices the last remainder',()=>{
 const shares=(input)=>{
  const t=math.parseExpression(input)[0],result=math.evaluateStep(t),plan=divisionPlan(t,result);
  const groups=Array.from({length:plan.d},()=>math.frac(0));
  for(const e of plan.events){if(e.type==='deal')groups[e.group]=math.add(groups[e.group],e.place>=0?math.frac(10**e.place):math.frac(1,10**-e.place));if(e.type==='strip')groups[e.group]=math.add(groups[e.group],math.frac(1,plan.d));}
  for(const g of groups)assert.deepEqual(g,math.abs(result.value),input);
  // Every card is either dealt or unstacked/sliced; nothing is left in the dividend.
  const made=[...plan.tokens.map(t=>t.id),...plan.events.filter(e=>e.type==='unstack').flatMap(e=>e.children.map(c=>c.id))];
  const used=new Set(plan.events.filter(e=>['deal','unstack','slice'].includes(e.type)).map(e=>e.id));
  assert.deepEqual(made.filter(id=>!used.has(id)),[],input);
  return plan;
 };
 for(const input of ['156÷12','7÷4','7÷3','1÷3','999÷9','100÷8','12÷12','5÷1','0.9÷3','123456÷7']){const plan=shares(input);assert.ok(plan.duration<16,input+' duration '+plan.duration);}
 assert.equal(divisionPlan(math.parseExpression('12÷13')[0],math.evaluateStep(math.parseExpression('12÷13')[0])),null,'13 groups use the symbolic transition');
});
test('operation animations render every frame in both layouts and all cameras',()=>{
 for(const input of ['23*4','14*23=x','2.5*1.5','156÷12','7÷4','7÷3','6÷1/2','x=23*4*2','0*5','-3*4'])for(const orientation of ['horizontal','vertical'])for(const camera of ['front','spread']){
  const c=new Controller({render(){}},input);c.orientation(orientation);c.camera(camera);const t=[...c.model.state.left,...c.model.state.right].find(t=>t.expr);c.evaluate(t.id,0);
  for(const p of [0,.2,.4,.6,.8,.97,1]){const svg=renderEquation(c.model.state,c.options,c.clock.plan,p);assert.doesNotMatch(svg,/NaN|undefined|Infinity/,`${input} ${orientation} ${camera} ${p}`);}
 }
});
