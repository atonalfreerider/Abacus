import test from 'node:test';
import assert from 'node:assert/strict';
import {unitPlan,unitFrame,unitValue} from '../src/mvc/units.js';
import {EquationModel,math} from '../src/mvc/model.js';
import {Controller} from '../src/mvc/controller.js';
import {planTransition} from '../src/mvc/animation.js';
import {renderEquation} from '../src/mvc/view.js';
import {decimalText,numberSpec} from '../src/mvc/numbers.js';
import {EquationEntry} from '../src/mvc/entry.js';

test('all digit transfers begin together and independent carries share one timeline',()=>{
 const p=unitPlan(555,555,'a','b'),transfers=p.phases.filter(p=>p.type==='transfer');assert.equal(transfers.length,15);assert.ok(transfers.every(p=>p.start===0));assert.ok(p.duration<2.5);
 const starts=p.phases.filter(p=>p.type==='carry').map(p=>p.start);assert.equal(new Set(starts).size,1);
});
test('parallel frame tokens conserve signed weight including concurrent active operations',()=>{
 for(const [a,b] of [[555,555],[999,999],[1000,-999],[123,-456],[55,-55],[12,34]]){const p=unitPlan(a,b,'a','b');for(let i=0;i<=100;i++){const f=unitFrame(p,i/100);let value=unitValue(f.tokens);for(const {phase} of f.active)value+=unitValue(phase.type==='settle'?phase.before:phase.before.filter(t=>phase.removed.includes(t.id)));assert.equal(value,BigInt(a+b),`${a}+${b} at ${i}`);}}
});
test('decimal representation is exact, grouped to the right and explicit fractions remain fractions',()=>{
 const m=new EquationModel('1234.123456+1/3=0');const spec=numberSpec(m.state.left[0]);assert.equal(spec.text,'1234.123456');assert.deepEqual(spec.places.map(p=>p.exponent),[3,2,1,0,-1,-2,-3,-4,-5,-6]);assert.equal(spec.markers.length,4);assert.equal(spec.markers.filter(m=>m.decimal).length,1);assert.equal(numberSpec(m.state.left[1]),null);assert.equal(decimalText(math.frac(1,8)),'0.125');assert.equal(decimalText(math.frac(1,3)),null);assert.match(math.equationText(m.state),/1234.123456/);
 const zeros=new EquationModel('0.00=1.20');assert.equal(numberSpec(zeros.state.left[0]).text,'0.00');assert.equal(numberSpec(zeros.state.right[0]).text,'1.20');
 const svg=renderEquation(m.state);assert.match(svg,/class="decimal-comma"/);assert.match(svg,/data-inner-area="0.01"/);assert.match(svg,/fill-opacity=".16"/);assert.match(svg,/dominant-baseline="central"/);
});
test('decimal carry and borrow use exact scaled unit plans',()=>{
 for(const input of ['0.99+0.01=1','1-0.01=0.99','0.123+0.877=1']){const m=new EquationModel(input);const p=planTransition(m.dispatch({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id}));assert.ok(p.units);assert.ok(p.units.placeShift<0);for(const t of [0,.25,.5,.75,1])assert.doesNotMatch(renderEquation(m.state,{},p,t),/NaN|undefined/);}
});
test('crossing onto a matching term transposes and combines immediately from release coordinates',()=>{
 const c=new Controller({render(){}},'x+3=7'),source=c.model.state.left[1].id,target=c.model.state.right[0].id,origin={x:600,y:100};c.drop(source,'right',target,0,0,origin);assert.equal(math.equationText(c.model.state),'x = 4');assert.equal(c.clock.plan.command.type,'combine');assert.deepEqual(c.clock.plan.origin,origin);assert.equal(c.clock.plan.units.total,'4');c.undo();assert.equal(math.equationText(c.model.state),'x + 3 = 7');
});
test('typing and keypad share incremental decimal, zero, operator and backspace behavior',()=>{
 const entry=new EquationEntry();for(const key of '0.25+0.75=1')entry.key(key);assert.equal(entry.preview(),'0.25+0.75=1');entry.key('Backspace');assert.equal(entry.preview(),'0.25+0.75=0');entry.key('1');assert.equal(entry.key('Enter'),'0.25+0.75=1');entry.key('7');assert.equal(entry.text,'7');entry.clear();entry.key('0');assert.equal(entry.preview(),'0');
});
