import test from 'node:test';
import assert from 'node:assert/strict';
import {unitPlan,unitValue} from '../src/mvc/units.js';
import {Controller} from '../src/mvc/controller.js';
import {renderEquation,layout,stackGeometry} from '../src/mvc/view.js';

test('singleton animation conserves exact signed weight through every transfer, carry, borrow and cancellation',()=>{
 const cases=[[999,1],[1000,-1],[100,-99],[7,-30],[-1000,1],[-99,-1],[7,-7],[999999,1],[1000000,-1]];
 for(let i=0;i<100;i++)cases.push([i*997-40000,25000-i*719]);
 for(const [a,b] of cases){const p=unitPlan(a,b,'target','source'),total=BigInt(a)+BigInt(b);assert.equal(unitValue(p.initial),total);assert.equal(unitValue(p.final),total);
  for(const phase of p.phases){assert.equal(unitValue(phase.before),total);assert.equal(unitValue(phase.after),total);if(phase.type==='carry'){assert.equal(phase.removed.length,10);assert.equal(phase.created.length,1);}if(phase.type==='borrow'){assert.equal(phase.removed.length,1);assert.equal(phase.created.length,10);}}
  for(let place=0;place<16;place++)assert.ok(p.final.filter(t=>t.place===place).length<=9);
 }
});
test('carry and borrow assemble the exact reusable stack depth without a seam',()=>{
 for(const camera of ['front','depth','spread'])for(const exp of [0,1,3,4,6,7,9,10]){
  const low=stackGeometry(exp,camera),high=stackGeometry(exp+1,camera);
  assert.equal(low.cardCount*10,high.cardCount);assert.ok(Math.abs(low.depth*10-high.depth)<1e-12);
  const layers=Array.from({length:10},(_,i)=>Array.from({length:low.cardCount},(_,j)=>i*low.cardCount+j+1)).flat();assert.deepEqual(layers,Array.from({length:high.cardCount},(_,i)=>i+1));
 }
});
test('drag preview flips immediately on both axes and repeated crossings never change committed math',()=>{
 for(const orientation of ['horizontal','vertical']){const c=new Controller({render(){}},'x+3=7');c.orientation(orientation);const initial=c.model.state,id=initial.left[1].id;
  for(const side of ['right','left','right','left']){c.previewDrag(id,200,200,side);const svg=renderEquation(initial,c.options);assert.match(svg,new RegExp(`aria-label="${side==='right'?'-3':'3'}, left side"`));assert.equal(c.model.state,initial);}
 }
});
test('release animation begins at the actual drop position with the already flipped sign',()=>{
 for(const orientation of ['horizontal','vertical']){const c=new Controller({render(){}},'x+3=7');c.orientation(orientation);const id=c.model.state.left[1].id,scene=layout(c.model.state,c.options),origin={x:scene.equal.x+31,y:scene.equal.y+45};
  c.drop(id,'right',null,0,0,origin);const svg=renderEquation(c.model.state,c.options,c.clock.plan,0);
  assert.match(svg,new RegExp(`data-term="${id}"[^>]*transform="translate\\(${origin.x} ${origin.y}\\)"[^>]*aria-label="-3`));
  assert.equal(c.model.state.right.find(t=>t.id===id).value.n,-3);
 }
});
test('unit animations use tray-level units, reusable stack definitions and no floating carry legend',()=>{
 const c=new Controller({render(){}},'99+1=100');c.execute({type:'combine',id:c.model.state.left[1].id,target:c.model.state.left[0].id},0);
 for(const p of [0,.2,.4,.6,.8,.99]){const svg=renderEquation(c.model.state,c.options,c.clock.plan,p);assert.match(svg,/class="unit-animation"/);assert.doesNotMatch(svg,/next place|previous place|data-motion=/);assert.match(svg,/href="#stack-/);assert.doesNotMatch(svg,/NaN|undefined/);}
});

