import test from 'node:test';
import assert from 'node:assert/strict';
import {EquationModel,math,preservesResidual} from '../src/mvc/model.js';
import {Controller} from '../src/mvc/controller.js';
import {AnimationClock,planTransition,regroup,operationGroups} from '../src/mvc/animation.js';
import {stackGeometry,renderEquation,layout} from '../src/mvc/view.js';

test('every linear lesson solves exactly and each step preserves the residual',()=>{
 for(const [input,answer] of [['x+3=7','4'],['x-4=5','9'],['3x+2=14','4'],['3x+1=x+9','4'],['x/2+1/3=5/6','1'],['2(x+3)=18','6'],['5-2x=11','-3'],['4x-1=2','3/4']]){
  const m=new EquationModel(input);let steps=0;
  while(!math.isSolved(m.state)){const command=m.nextStep();assert.ok(command,input);const tx=m.dispatch(command);assert.ok(preservesResidual(tx.before,tx.after,command));assert.ok(++steps<20);}
  assert.deepEqual(m.result().value,math.parseScalar(answer));
 }
});
test('carry, borrow, neutralization, exact fractions and billion values are functional',()=>{
 for(const [input,answer] of [['999+1=1000',1000],['1000-1=999',999],['0.9+0.1=1',1],['1000000000+1=1000000001',1000000001],['1/3+1/6=1/2',.5],['-7+3=-4',-4]]){
  const m=new EquationModel(input);m.dispatch({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id});assert.equal(math.numeric(math.totals(m.state.left).constant),answer);
 }
});
test('multiply and divide preserve exact values and reject zero atomically',()=>{
 const m=new EquationModel('x/3=1/7');m.dispatch({type:'operate',operation:'multiply',amount:'3'});assert.deepEqual(m.result().value,math.frac(3,7));m.dispatch({type:'operate',operation:'divide',amount:'-2/5'});assert.deepEqual(m.result().value,math.frac(3,7));
 const before=m.state;for(const operation of ['divide','multiply'])assert.throws(()=>m.dispatch({type:'operate',operation,amount:'0'}));assert.equal(m.state,before);
});
test('crossings flip exactly once; rearrangement does not; undo and redo are exact',()=>{
 const m=new EquationModel('x+3=7');const id=m.state.left[1].id,initial=m.state;
 m.dispatch({type:'move',id,side:'right'});assert.equal(m.state.right[1].value.n,-3);
 m.dispatch({type:'reorder',id,side:'right',index:0});assert.equal(m.state.right[0].value.n,-3);
 m.dispatch({type:'move',id,side:'left'});assert.equal(m.state.left[1].value.n,3);
 m.undo();m.undo();m.undo();assert.equal(m.state,initial);m.redo();assert.equal(m.state.right[1].value.n,-3);
 assert.throws(()=>m.state.left.push({}));
});
test('contradictions and identities are distinct; illegal edits fail without committing',()=>{
 assert.equal(new EquationModel('x+1=x+2').result().type,'impossible');assert.equal(new EquationModel('2(x+1)=2x+2').result().type,'identity');
 const m=new EquationModel('x+3=7'),before=m.state;assert.throws(()=>m.dispatch({type:'combine',id:m.state.left[0].id,target:m.state.left[1].id}));assert.equal(m.state,before);
 assert.equal(preservesResidual(math.parseEquation('1=2'),math.parseEquation('1=3'),{type:'simplify'}),false);
});
test('stack geometry has 10 and 100 faces, exact 10x depth, down-right projection and comma reset',()=>{
 for(const camera of ['front','depth','spread'])for(let group=0;group<4;group++){
  const ten=stackGeometry(group*3+1,camera),hundred=stackGeometry(group*3+2,camera);
  assert.equal(ten.cardCount,10);assert.equal(hundred.cardCount,100);assert.ok(Math.abs(hundred.depth/ten.depth-10)<1e-12);assert.ok(hundred.dx>0&&hundred.dy>0);assert.equal(stackGeometry(group*3,camera).cardCount,1);
 }
});
test('all cards carry k/M/B marks and progressively thick nested outlines',()=>{
 for(const [n,mark,count] of [[10000,'k',10],[100000000,'M',100],[1000000000,'B',1]]){
  const svg=renderEquation(new EquationModel(n+'=0').state,{camera:'depth'});
  assert.equal((svg.match(new RegExp('data-group="'+mark+'"','g'))||[]).length,count);
  assert.ok(svg.includes('>'+mark+'</text>'));
 }
});
test('clock scrubbing and camera/layout changes never mutate mathematical state',()=>{
 const c=new Controller({render(){}},'9+1=10');const tx=c.execute({type:'combine',id:c.model.state.left[1].id,target:c.model.state.left[0].id},0),committed=c.model.state;
 for(const camera of ['front','depth','spread'])for(const orientation of ['horizontal','vertical'])for(const p of [0,.25,.5,.75,1]){
  c.camera(camera);c.orientation(orientation);c.seek(p);assert.equal(c.model.state,committed);assert.equal(math.totals(c.model.state.left).constant.n,10);
  const svg=renderEquation(committed,c.options,c.clock.plan,p);assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('undefined'));
 }
 const clock=new AnimationClock();clock.start(planTransition(tx),100);clock.sample(200);clock.seek(.5);clock.resume(500);assert.equal(clock.sample(500),.5);clock.sample(10000);assert.equal(clock.progress,1);
});
test('carry and borrow cascades visit digits in mathematical order',()=>{
 assert.deepEqual(regroup(999,1).map(e=>e.place),[0,1,2]);assert.deepEqual(regroup(1000,-1).filter(e=>e.type==='borrow').map(e=>e.place),[3,2,1]);
});
test('multiplication and division animation groups have exact conserved weights on both sides',()=>{
 for(const operation of ['multiply','divide']){
  const m=new EquationModel('12=12'),plan=planTransition(m.dispatch({type:'operate',operation,amount:'3'}));
  const groups=operationGroups(plan);assert.equal(groups.length,2);
  for(const group of groups)assert.deepEqual(math.mul(group.term.value,math.frac(group.count)),math.frac(operation==='multiply'?36:12));
 }
});
test('seeded arithmetic transformations preserve 500 exact rational solutions',()=>{
 let seed=94251;const next=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
 for(let i=0;i<500;i++){
  const a=next()%39+1,b=next()%99-49,c=next()%99-49,d=next()%11+1;
  const m=new EquationModel(`${a}x+(${b})=${c}/${d}`),answer=m.result();
  const factor=(next()%11+1)+'/'+(next()%7+1);for(const operation of ['multiply','divide','add','subtract'])m.dispatch({type:'operate',operation,amount:factor});assert.deepEqual(m.result(),answer);
 }
});
