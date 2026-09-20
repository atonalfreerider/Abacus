import { Controller } from './controller.js';
import { math } from './model.js';
import { renderEquation,layout } from './view.js';
const $=id=>document.getElementById(id);
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
const view={render(state,options,plan,p){$('stage').innerHTML=renderEquation(state,options,plan,p);$('stage').style.setProperty('--zoom',options.zoom);}};
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
controller.addEventListener('change',refresh);refresh();
function tick(now){controller.frame(now);requestAnimationFrame(tick);}requestAnimationFrame(tick);
function point(event) {const svg=$('equation-svg'),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
$('stage').addEventListener('pointerdown',event=>{
  const term=event.target.closest('[data-term]');if(!term||term.classList.contains('placeholder')||controller.busy)return;
  event.preventDefault();const p=point(event);drag={id:term.dataset.term,side:term.dataset.side,start:p,base:[Number(term.dataset.x),Number(term.dataset.y)],node:term};
  selected=drag.id;term.classList.add('dragging');$('stage').setPointerCapture(event.pointerId);
});
$('stage').addEventListener('pointermove',event=>{if(!drag)return;const p=point(event);drag.node.setAttribute('transform',`translate(${drag.base[0]+p.x-drag.start.x} ${drag.base[1]+p.y-drag.start.y})`);});
$('stage').addEventListener('pointerup',event=>{
  if(!drag)return;const current=drag,p=point(event);drag=null;current.node.style.pointerEvents='none';
  const under=document.elementFromPoint(event.clientX,event.clientY),target=under?.closest('[data-term]'),gap=under?.closest('[data-insert]');
  const scene=layout(controller.model.state,{...controller.options,expression:controller.model.expression});
  const side=controller.model.expression?'left':controller.options.orientation==='horizontal'?(p.x<scene.equal.x?'left':'right'):(p.y<scene.equal.y?'left':'right');
  const moved=Math.hypot(p.x-current.start.x,p.y-current.start.y)>5;
  safe(()=>{if(!moved){controller.render();message('Selected. Arrow keys move across; Shift + arrows rearrange.');return;}
    const sideTerms=scene.terms.filter(t=>t.side===side&&!t.term.placeholder&&t.term.id!==current.id);
    const index=gap?Number(gap.dataset.insert):sideTerms.filter(t=>p.x>t.x+t.w/2).length;
    controller.drop(current.id,side,event.shiftKey?null:target?.dataset.term,index);
  });
});
$('stage').addEventListener('pointercancel',()=>{drag=null;controller.render();});
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
$('equation-form').onsubmit=event=>{event.preventDefault();safe(()=>{controller.load($('equation-input').value);$('equation-dialog').close();director=null;$('director-bar').hidden=true;});};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>button.closest('dialog').close();
$('open-view').onclick=()=>$('view-dialog').showModal();
$('camera').onchange=event=>controller.camera(event.target.value);
$('orientation').onchange=event=>{if(event.target.value==='auto')autoLayout();else controller.orientation(event.target.value);};
$('zoom').oninput=event=>{controller.options.zoom=Number(event.target.value);controller.render();};
function autoLayout(){if($('orientation').value==='auto')controller.orientation(window.innerWidth<700?'vertical':'horizontal');}
window.addEventListener('resize',autoLayout);autoLayout();
$('undo').onclick=()=>controller.undo();$('redo').onclick=()=>controller.redo();
$('combine').onclick=()=>safe(()=>controller.execute({type:'simplify'}));
$('solve').onclick=()=>safe(()=>{if(!controller.step())message(controller.status());});
for(const operation of ['multiply','divide'])$(operation).onclick=()=>safe(()=>controller.execute({type:'operate',operation,amount:$('factor').value}));
$('pause').onclick=()=>{if(controller.clock.playing)controller.seek(controller.clock.progress);else controller.clock.resume(performance.now());refresh();};
$('skip').onclick=()=>controller.finish();$('progress').oninput=event=>controller.seek(Number(event.target.value));
$('open-director').onclick=()=>$('lesson-dialog').showModal();
for(const lesson of lessons){const b=document.createElement('button');b.textContent=`${lesson.title} · ${lesson.equation}`;b.onclick=()=>{director=lesson;practice=false;controller.load(lesson.equation);baseline=lesson.equation;$('lesson-dialog').close();$('director-bar').hidden=false;$('director-title').textContent=lesson.title;refresh();};$('lessons').append(b);}
$('watch').onclick=()=>safe(()=>{baseline=math.equationText(controller.model.state);practice=false;controller.step();});
$('try').onclick=()=>{if(baseline)controller.load(baseline);practice=true;refresh();};
$('leave-director').onclick=()=>{director=null;$('director-bar').hidden=true;};
// Original-style number pad builds input; Enter submits into the exact model.
for(let n=1;n<=9;n++){const b=document.createElement('button');b.textContent=n;b.onclick=()=>{$('equation-dialog').showModal();$('equation-input').value+=n;$('equation-input').focus();};$('keypad').append(b);}
$('clear').onclick=()=>safe(()=>controller.load('0=0'));
$('open-tests').onclick=()=>location.href='./tests.html';
