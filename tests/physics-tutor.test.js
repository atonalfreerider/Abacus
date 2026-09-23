import test from 'node:test';
import assert from 'node:assert/strict';
import {DragBody,spring,GAP,MEMBRANE} from '../src/mvc/physics.js';
import {EquationModel,math} from '../src/mvc/model.js';
import {layout} from '../src/mvc/view.js';
import {lessons,Tutor,narrate,feedback,remaining,finished} from '../src/mvc/tutor.js';

const run=(body,pointer,frames=40)=>{for(let i=0;i<frames;i++)body.update(pointer,1/60);return body;};
test('the spring is critically damped and stable for long frames',()=>{
 let p=0,v=0;for(let i=0;i<120;i++)[p,v]=spring(p,v,100,30,1/60);assert.ok(Math.abs(p-100)<1e-3);
 let q=0,w=0,max=0;for(let i=0;i<50;i++){[q,w]=spring(q,w,100,30,.5);max=Math.max(max,q);}assert.ok(max<=100.0001,'no overshoot');
});
test('the mirror resists, bends, then pops the card through and flips its sign once',()=>{
 for(const orientation of ['horizontal','vertical']){
  const m=new EquationModel('x+3=7'),options={orientation},scene=layout(m.state,options),slot=scene.terms.find(t=>t.term.value.n===3),axis=orientation==='vertical'?'y':'x',half=axis==='x'?slot.w/2:75;
  const grab={x:slot.x+20,y:slot.y+20},body=new DragBody(m.state,options,slot.term.id,grab),mirror=scene.equal[axis];
  const at=centre=>({...grab,[axis]:grab[axis]+(centre-(slot[axis]+half))});
  const contact=mirror-2*half-GAP+half; // card centre when its leading edge meets the membrane
  run(body,at(contact+MEMBRANE*.7));
  assert.equal(body.side,'left',orientation);assert.ok(body.strain>.5);
  assert.ok(body.pos[axis]+2*half<mirror-GAP+MEMBRANE*.7*.3,'the card yields a little and never touches the mirror');
  run(body,at(contact+MEMBRANE+10));
  assert.equal(body.side,'right');assert.deepEqual(body.events,['cross']);assert.equal(body.value.n,-3);assert.ok(body.tilt<.05,'balanced once crossed');
  assert.ok(body.pos[axis]>=mirror+GAP-1,'the card clears the mirror completely');
  const back={x:body.pos.x+body.grab.x,y:body.pos.y+body.grab.y};back[axis]-=20;run(body,back);
  assert.equal(body.side,'right','a small step back meets the membrane again instead of flipping');assert.ok(Number.isFinite(body.pos.x+body.pos.y));
  const drop=body.drop();assert.equal(drop.side,'right');assert.equal(drop.target,null);assert.ok(Number.isInteger(drop.index));
  if(orientation==='horizontal')assert.equal(drop.index,0,'it lands just past the mirror, before 7');
 }
});
test('like terms attract and snap; opposite signs are classified as a zero pair',()=>{
 const m=new EquationModel('x+9-7=6'),scene=layout(m.state,{}),[,nine,seven]=scene.terms;
 const body=new DragBody(m.state,{},seven.term.id,{x:seven.x+10,y:seven.y+10});
 run(body,{x:nine.x+10+5,y:nine.y+10+5});
 assert.deepEqual(body.snap,{id:nine.term.id,kind:'cancel'});assert.deepEqual(body.drop(),{side:'left',target:nine.term.id,index:null});
 run(body,{x:nine.x+10,y:nine.y+400});assert.equal(body.snap,null,'pulling away releases the magnet');
 const same=new EquationModel('x+2+3=6'),s=layout(same.state,{}),b=new DragBody(same.state,{},s.terms[2].term.id,{x:s.terms[2].x,y:s.terms[2].y});run(b,{x:s.terms[1].x,y:s.terms[1].y});assert.equal(b.snap.kind,'combine');
 const x=new EquationModel('x+3=7'),xs=layout(x.state,{}),held=new DragBody(x.state,{},xs.terms[1].term.id,{x:xs.terms[1].x,y:xs.terms[1].y});run(held,{x:xs.terms[0].x,y:xs.terms[0].y});assert.equal(held.snap,null,'unlike terms never snap');
});
test('other cards open a gap where the held card will land',()=>{
 const m=new EquationModel('x+3+2=9'),scene=layout(m.state,{}),[x,three,two]=scene.terms,body=new DragBody(m.state,{},two.term.id,{x:two.x,y:two.y});
 run(body,{x:x.x-40,y:x.y},90);assert.equal(body.insert,0);assert.deepEqual(body.drop(),{side:'left',target:null,index:0});
 assert.ok(body.world.get(x.term.id).x>x.x+100,'x slid right to make room');
 for(let i=0;i<200&&!body.settle(1/60);i++);assert.ok(Math.abs(body.pos.x-two.x)<1,'released without a change, the card springs home');
});
test('every graph lesson example and 200 generated problems have an exact goal point',async()=>{
 const {parseCurves,specialPoints}=await import('../src/graph/polynomial.js');
 for(const lesson of lessons.filter(l=>l.graph)){
  const tutor=new Tutor(lesson,23),seen=new Set();
  for(let i=0;i<=200;i++){const equations=i?tutor.practice():lesson.example;seen.add(equations.join(';'));
   const goals=specialPoints(equations.flatMap(parseCurves)).filter(p=>p.kind===lesson.goal);
   assert.ok(goals.length>=1,`${lesson.id}: ${equations.join(' ; ')}`);assert.ok(goals.every(p=>p.exact),`${lesson.id}: exact goal for ${equations}`);}
  assert.ok(seen.size>20,`${lesson.id} varies`);
 }
});
test('every lesson example and 200 generated problems solve, with a sentence for each step',()=>{
 for(const lesson of lessons.filter(l=>!l.graph)){
  const tutor=new Tutor(lesson,17),seen=new Set();
  for(let i=0;i<=200;i++){
   const problem=i?tutor.practice():lesson.example;seen.add(problem);
   const m=new EquationModel(problem);let steps=0,command;
   while((command=m.nextStep())){assert.ok(narrate(command,m.state).length>10);m.dispatch(command);assert.ok(++steps<20,problem);}
   assert.ok(finished(m));if(!m.expression)assert.ok(math.isSolved(m.state)||m.result().type!=='unique',problem);
   else assert.ok(math.isSimplified(m.state.left),problem);
  }
  assert.ok(seen.size>5,`${lesson.id} generates varied problems`);
 }
});
test('feedback distinguishes progress, detours and completion',()=>{
 const m=new EquationModel('x+3=7'),start=m.state,three=start.left[1].id;
 m.dispatch({type:'move',id:three,side:'right'});assert.equal(feedback(m,start).tone,'good');
 const detour=new EquationModel('x+3=7');detour.dispatch({type:'move',id:detour.state.left[0].id,side:'right'});assert.equal(feedback(detour,start).tone,'detour');
 const done=new EquationModel('x=7-3');const before=done.state;done.dispatch(done.nextStep());assert.equal(feedback(done,before).tone,'done');
 assert.equal(remaining(start),2);
});
