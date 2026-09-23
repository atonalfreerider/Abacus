import {EquationEntry} from './entry.js';
import { Controller } from './controller.js';
import { math } from './model.js';
import { layout } from './view.js';
import { Surface } from './surface.js';
const $=id=>document.getElementById(id);
const entry=new EquationEntry();
let controller,drag=null,selected=null,director=null,lessonIndex=0,practice=false,baseline=null;
const lessons=[
  {title:'Across the mirror',equation:'x+3=7'},
  {title:'Moving negatives',equation:'x-4=5'},
  {title:'Equal groups',equation:'3x+2=14'},
  {title:'Variables on both sides',equation:'3x+1=x+9'},
  {title:'Fractions',equation:'x/2+1/3=5/6'},
  {title:'Carry across a comma',equation:'999+1=1000'},
  {title:'Borrow',equation:'1000-1=999'},
];
const surface=new Surface($('stage'));
const view={render(state,options,plan,p){surface.draw(state,options,plan,p);$('stage').style.setProperty('--zoom',options.zoom);}};
controller=new Controller(view);
const message=text=>{$('feedback').textContent=text;};
const safe=fn=>{message('');try{fn();}catch(e){controller.render();message(e.message);}};
function hint(command) {
  if(!command)return controller.status();
  return command.type==='move'?'Drag the term across the equals mirror to change its sign.':command.type==='combine'?'Drop like terms together. Red and blue units neutralize.':`Divide both sides by ${command.amount} to isolate x.`;
}
function refresh() {
  $('equation-status').textContent=controller.status();
  $('progress').value=controller.clock.progress;
  $('pause').textContent=controller.clock.playing?'Pause':'Play';
  for(const id of ['combine','solve','multiply','divide','watch','try'])$(id).disabled=controller.busy;
  $('undo').disabled=!controller.model.past.length;$('redo').disabled=!controller.model.future.length;
  if(director && !controller.busy){$('director-prompt').textContent=(practice?'Your turn: ':'')+hint(controller.model.nextStep());if(math.isSolved(controller.model.state))$('director-prompt').textContent=controller.status();}
}
controller.addEventListener('change',refresh);refresh();surface.prewarm(controller.options.camera);
function tick(now){controller.frame(now);requestAnimationFrame(tick);}requestAnimationFrame(tick);
function point(event) {const svg=$('equation-svg'),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
$('stage').addEventListener('pointerdown',event=>{
  const term=event.target.closest('[data-term]');if(!term||term.classList.contains('placeholder')||controller.busy)return;
  event.preventDefault();entry.active=false;const p=point(event);drag={id:term.dataset.term,side:term.dataset.side,start:p,base:[Number(term.dataset.x),Number(term.dataset.y)],node:term};
  selected=drag.id;term.classList.add('dragging');$('stage').setPointerCapture(event.pointerId);
});
function dragPosition(event){const p=point(event),x=drag.base[0]+p.x-drag.start.x,y=drag.base[1]+p.y-drag.start.y;const scene=layout(controller.model.state,{...controller.options,expression:controller.model.expression}),slot=scene.terms.find(t=>t.term.id===drag.id);const side=controller.model.expression?'left':controller.options.orientation==='horizontal'?(x+slot.w/2<scene.equal.x?'left':'right'):(y+75<scene.equal.y?'left':'right');return {x,y,side};}
$('stage').addEventListener('pointermove',event=>{if(!drag)return;const pose=dragPosition(event);controller.previewDrag(drag.id,pose.x,pose.y,pose.side);drag.node=document.querySelector(`[data-term="${drag.id}"]`);drag.node.classList.add('dragging');});
$('stage').addEventListener('pointerup',event=>{
  if(!drag)return;const origin=dragPosition(event),current=drag,p=point(event);drag=null;delete controller.options.drag;current.node.style.pointerEvents='none';
  const under=document.elementFromPoint(event.clientX,event.clientY),target=under?.closest('[data-term]'),gap=under?.closest('[data-insert]');
  const scene=layout(controller.model.state,{...controller.options,expression:controller.model.expression});
  const side=origin.side;
  const moved=Math.hypot(p.x-current.start.x,p.y-current.start.y)>5;
  safe(()=>{if(!moved){controller.render();message('Selected. Arrow keys move across; Shift + arrows rearrange.');return;}
    const sideTerms=scene.terms.filter(t=>t.side===side&&!t.term.placeholder&&t.term.id!==current.id);
    const index=gap?Number(gap.dataset.insert):sideTerms.filter(t=>p.x>t.x+t.w/2).length;
    const picked=scene.terms.find(t=>t.term.id===current.id);const collision=sideTerms.filter(t=>t.term.kind===picked.term.kind).map(t=>({id:t.term.id,area:Math.max(0,Math.min(origin.x+picked.w,t.x+t.w)-Math.max(origin.x,t.x))*Math.max(0,Math.min(origin.y+150,t.y+150)-Math.max(origin.y,t.y))})).filter(t=>t.area>0).sort((a,b)=>b.area-a.area)[0];
    controller.drop(current.id,side,event.shiftKey?null:(target?.dataset.term||collision?.id),index,performance.now(),{x:origin.x,y:origin.y});
  });
});
$('stage').addEventListener('pointercancel',()=>{drag=null;delete controller.options.drag;controller.render();});
$('stage').addEventListener('keydown',event=>{
  const term=event.target.closest('[data-term]');if(!term)return;selected=term.dataset.term;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
    event.preventDefault();safe(()=>{
      const direction=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
      if(event.shiftKey)controller.execute({type:'reorder',id:selected,side:term.dataset.side,index:Number(term.dataset.index)+direction});
      else controller.drop(selected,direction<0?'left':'right',null,null);
    });
  }
});
$('open-equation').onclick=()=>{$('equation-input').value=math.equationText(controller.model.state);$('equation-dialog').showModal();$('equation-input').focus();};
$('equation-form').onsubmit=event=>{event.preventDefault();safe(()=>{controller.load($('equation-input').value);entry.active=false;$('entry-bar').hidden=true;$('equation-dialog').close();director=null;$('director-bar').hidden=true;});};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>button.closest('dialog').close();
$('open-view').onclick=()=>$('view-dialog').showModal();
$('camera').onchange=event=>{controller.camera(event.target.value);surface.prewarm(event.target.value);};
$('orientation').onchange=event=>{if(event.target.value==='auto')autoLayout();else controller.orientation(event.target.value);};
$('zoom').oninput=event=>{controller.options.zoom=Number(event.target.value);controller.render();};
function autoLayout(){if($('orientation').value==='auto')controller.orientation(window.innerWidth<700?'vertical':'horizontal');}
window.addEventListener('resize',autoLayout);autoLayout();
$('undo').onclick=()=>controller.undo();$('redo').onclick=()=>controller.redo();
$('combine').onclick=()=>safe(()=>{entry.active=false;$('entry-bar').hidden=true;const step=controller.model.nextStep();if(step?.type==='combine')controller.execute(step);else controller.execute({type:'simplify'});});
$('solve').onclick=()=>safe(()=>{if(!controller.step())message(controller.status());});
for(const operation of ['multiply','divide'])$(operation).onclick=()=>safe(()=>controller.execute({type:'operate',operation,amount:$('factor').value}));
$('pause').onclick=()=>{if(controller.clock.playing)controller.seek(controller.clock.progress);else controller.clock.resume(performance.now());refresh();};
$('skip').onclick=()=>controller.finish();$('progress').oninput=event=>controller.seek(Number(event.target.value));
$('open-director').onclick=()=>$('lesson-dialog').showModal();
for(const lesson of lessons){const b=document.createElement('button');b.textContent=`${lesson.title} · ${lesson.equation}`;b.onclick=()=>{entry.active=false;$('entry-bar').hidden=true;director=lesson;practice=false;controller.load(lesson.equation);baseline=lesson.equation;$('lesson-dialog').close();$('director-bar').hidden=false;$('director-title').textContent=lesson.title;refresh();};$('lessons').append(b);}
$('watch').onclick=()=>safe(()=>{baseline=math.equationText(controller.model.state);practice=false;controller.step();});
$('try').onclick=()=>{if(baseline)controller.load(baseline);practice=true;refresh();};
$('leave-director').onclick=()=>{director=null;$('director-bar').hidden=true;};
// Pad and hardware keys stage the same input; the up triangle deploys it.
function enterKey(key){
 if(drag||['Enter','ArrowUp'].includes(key)&&!entry.active)return;
 const text=entry.key(key);if(key==='Escape')$('entry-bar').hidden=true;if(text===null)return;
 $('entry-text').textContent=entry.text||'0';$('entry-bar').hidden=!entry.active;
 if(['Enter','ArrowUp'].includes(key)){try{controller.load(text||'0');message('');}catch(e){entry.active=true;$('entry-bar').hidden=false;message(e.message);}return;}
 message('');
}
const cells=[];
function illuminate(n){$('pad-numeral').textContent=String(n);cells.forEach((b,i)=>b.classList.toggle('lit',i<n));}
for(let n=1;n<=9;n++){const b=document.createElement('button');b.dataset.inputKey=String(n);b.setAttribute('aria-label',`Input ${n}`);b.title=String(n);b.onpointerenter=()=>illuminate(n);b.onfocus=()=>illuminate(n);cells.push(b);$('keypad').append(b);}
$('keypad').onpointerleave=()=>illuminate(0);
for(const b of document.querySelectorAll('[data-input-key]'))b.onclick=()=>enterKey(b.dataset.inputKey);
$('entry-done').onclick=()=>enterKey('ArrowUp');
document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,dialog'))return;if(/^[0-9xX.+\-*/=(),]$/.test(event.key)||['Backspace','Enter','ArrowUp','Escape'].includes(event.key)){event.preventDefault();enterKey(event.key);}});
$('clear').onclick=()=>{entry.clear();$('entry-text').textContent='0';$('entry-bar').hidden=false;safe(()=>controller.load('0'));};
$('open-tests').onclick=()=>location.href='./tests.html';
