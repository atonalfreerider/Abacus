import {EquationEntry} from './entry.js';
import { Controller } from './controller.js';
import { math } from './model.js';
import { Surface } from './surface.js';
import { Dragger } from './drag.js';
import { Tutor,lessons,narrate,feedback,finished } from './tutor.js';
const $=id=>document.getElementById(id);
const entry=new EquationEntry();
const surface=new Surface($('stage'));
let tutor=null,playing=false,playTimer=0,hint=null;
const view={render(state,options,plan,p){surface.draw(state,options,plan,p);$('stage').style.setProperty('--zoom',options.zoom);decorate();}};
const controller=new Controller(view);
const message=text=>{$('feedback').textContent=text;};
const safe=fn=>{message('');try{return fn();}catch(e){controller.render();message(e.message);}};
const terms=()=>[...controller.model.state.left,...controller.model.state.right];
// Hint highlights survive re-renders: they are reapplied after every frame.
function decorate(){
 if(!hint||controller.busy)return;
 const node=id=>document.querySelector(`#equation-svg [data-term="${CSS.escape(id)}"]`),card=node(hint.id);if(!card)return;
 card.classList.add('hinted');const target=hint.target&&node(hint.target);target?.classList.add('hint-target');
 // A guide arrow: across the mirror for a move, onto the partner for a combination.
 const box=n=>{const w=Number(n.querySelector('.hit').getAttribute('width'))-12;return {x:Number(n.dataset.x)+w/2,y:Number(n.dataset.y)};};
 const from=box(card),mirror=document.querySelector('#equation-svg .equals-mirror text'),vertical=controller.options.orientation==='vertical';
 let to=target?box(target):null;
 if(!to&&hint.type==='move'&&mirror){const mx=Number(mirror.getAttribute('x'));to=vertical?{x:from.x,y:from.y+(hint.side==='right'?300:-300)}:{x:2*mx-from.x,y:from.y};}
 if(!to)return;
 const lift=vertical?0:-70-Math.min(120,Math.abs(to.x-from.x)*.12),path=vertical?`M${from.x+90} ${from.y+75}C${from.x+200} ${from.y+75} ${to.x+200} ${to.y+75} ${to.x+90} ${to.y+75}`:`M${from.x} ${from.y-18}C${from.x} ${from.y+lift} ${to.x} ${to.y+lift} ${to.x} ${to.y-18}`;
 document.querySelector('#equation-svg .scene-root').insertAdjacentHTML('beforeend',`<g class="hint-arrow" pointer-events="none"><path d="${path}"/><circle cx="${vertical?to.x+90:to.x}" cy="${vertical?to.y+75:to.y-18}" r="7"/></g>`);
}
function refresh() {
 $('equation-status').textContent=controller.status();
 $('progress').value=controller.clock.progress;
 $('pause').textContent=controller.clock.playing?'Pause':'Play';
 for(const id of ['combine','solve','multiply','divide','tutor-step','tutor-hint','tutor-show','tutor-action'])$(id).disabled=controller.busy;
 $('undo').disabled=!controller.model.past.length;$('redo').disabled=!controller.model.future.length;
 if(tutor)refreshTutor();
}
controller.addEventListener('change',refresh);
const dragger=new Dragger($('stage'),controller,{
 onTap:id=>safe(()=>{const t=terms().find(t=>t.id===id);if(t&&math.evaluable(t))return controller.evaluate(t.id);controller.render();message(t?.expr?'':'Drag a card across the mirror or onto a like card. Arrow keys also move a focused card.');}),
 onCommit:(id,drop,origin)=>safe(()=>controller.drop(id,drop.side,drop.target,drop.index,performance.now(),origin)),
});
refresh();surface.prewarm(controller.options.camera);
function tick(now){requestAnimationFrame(tick);try{controller.frame(now);dragger.frame(now);}catch(error){console.error(error);controller.finish();message(error.message);}}requestAnimationFrame(tick);
$('stage').addEventListener('pointerdown',event=>{if(dragger.down(event)){entry.active=false;$('entry-bar').hidden=true;}});
$('stage').addEventListener('pointermove',event=>dragger.move(event));
$('stage').addEventListener('pointerup',event=>dragger.up(event));
$('stage').addEventListener('pointercancel',event=>dragger.cancel(event));
$('stage').addEventListener('keydown',event=>{
 const term=event.target.closest('[data-term]');if(!term||term.classList.contains('placeholder'))return;const id=term.dataset.term;
 if(['Enter',' '].includes(event.key)){const t=terms().find(t=>t.id===id);if(t&&math.evaluable(t)){event.preventDefault();safe(()=>controller.evaluate(id));}return;}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
  event.preventDefault();safe(()=>{
   const direction=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
   if(event.shiftKey)controller.execute({type:'reorder',id,side:term.dataset.side,index:Number(term.dataset.index)+direction});
   else controller.drop(id,direction<0?'left':'right',null,null);
  });
 }
});
$('open-equation').onclick=()=>{$('equation-input').value=math.equationText(controller.model.state);$('equation-dialog').showModal();$('equation-input').focus();};
$('equation-form').onsubmit=event=>{event.preventDefault();safe(()=>{controller.load($('equation-input').value);entry.active=false;$('entry-bar').hidden=true;$('equation-dialog').close();leaveTutor();});};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>button.closest('dialog').close();
$('open-view').onclick=()=>$('view-dialog').showModal();
$('camera').onchange=event=>{controller.camera(event.target.value);surface.prewarm(event.target.value);};
$('orientation').onchange=event=>{if(event.target.value==='auto')autoLayout();else controller.orientation(event.target.value);};
$('zoom').oninput=event=>{controller.options.zoom=Number(event.target.value);controller.render();};
function autoLayout(){if($('orientation').value==='auto'&&!dragger.active){const next=window.innerWidth<700?'vertical':'horizontal';if(next!==controller.options.orientation)controller.orientation(next);}}
window.addEventListener('resize',autoLayout);autoLayout();
$('undo').onclick=()=>{hint=null;controller.undo();};$('redo').onclick=()=>controller.redo();
$('combine').onclick=()=>safe(()=>{entry.active=false;$('entry-bar').hidden=true;const step=controller.model.nextStep();if(step?.type==='combine'||step?.type==='evaluate')controller.as('solver',()=>controller.execute(step));else controller.as('solver',()=>controller.execute({type:'simplify'}));});
$('solve').onclick=()=>safe(()=>{if(!controller.as('solver',()=>controller.step()))message(controller.status());});
for(const operation of ['multiply','divide'])$(operation).onclick=()=>safe(()=>controller.execute({type:'operate',operation,amount:$('factor').value}));
$('pause').onclick=()=>{if(controller.clock.playing)controller.seek(controller.clock.progress);else controller.clock.resume(performance.now());refresh();};
$('skip').onclick=()=>controller.finish();$('progress').oninput=event=>controller.seek(Number(event.target.value));

// Tutor: a worked example step by step, then a fresh problem of the same shape.
$('open-tutor').onclick=()=>$('lesson-dialog').showModal();
{let group='';for(const lesson of lessons){
 if(lesson.group!==group){group=lesson.group;const h=document.createElement('h2');h.textContent=group;$('lessons').append(h);}
 const b=document.createElement('button');b.innerHTML=`<span>${lesson.title}</span><small>${[lesson.example].flat().join(' and ').replace(/\*/g,' × ').replace(/÷/g,' ÷ ').replace(/\^2/g,'²')}</small>`;b.onclick=()=>{$('lesson-dialog').close();startLesson(lesson);};$('lessons').append(b);
}}
async function startLesson(lesson){
 stopPlaying();tutor=new Tutor(lesson);hint=null;entry.active=false;$('entry-bar').hidden=true;
 $('tutor-bar').classList.toggle('graph-lesson',!!lesson.graph);
 if(lesson.graph){(await showGraph(true)).setEquations(lesson.example);}
 else{if(!$('graph-mode').hidden)showGraph(false);safe(()=>controller.load(lesson.example));}
 $('tutor-bar').hidden=false;$('tutor-title').textContent=lesson.title;
 say(`${lesson.intro} Watch: press Next step, or Play all.`);refresh();
}
function say(text,tone=''){$('tutor-prompt').textContent=text;$('tutor-prompt').dataset.tone=tone;}
function leaveTutor(){stopPlaying();tutor=null;hint=null;$('tutor-bar').hidden=true;$('tutor-bar').classList.remove('graph-lesson');controller.render();}
const lessonDone=()=>tutor.lesson.graph?(tutor.phase==='example'?!!tutor.shown:!!tutor.solved):finished(controller.model);
function refreshTutor(){
 const example=tutor.phase==='example',done=lessonDone();
 $('tutor-phase').textContent=example?'Example':'Your turn';$('tutor-phase').dataset.phase=tutor.phase;
 for(const [id,show] of [['tutor-step',example],['tutor-play',example],['tutor-turn',example],['tutor-hint',!example&&!done],['tutor-show',!example&&!done],['tutor-new',!example],['tutor-next',!example&&done]])$(id).hidden=!show;
 $('tutor-step').disabled=controller.busy||done;$('tutor-play').disabled=done&&!playing;$('tutor-turn').classList.toggle('ready',done);$('tutor-play').hidden||=!!tutor.lesson.graph;
 const next=tutor.lesson.graph?null:controller.model.nextStep(),action=!example&&!done&&next?.type==='operate'?next:null;
 $('tutor-action').hidden=!action;if(action)$('tutor-action').textContent=`${action.operation==='divide'?'÷':'×'} both sides by ${action.amount}`;$('tutor-action').onclick=()=>safe(()=>controller.execute(action));
}
function exampleStep(){
 if(tutor.lesson.graph){const goal=graph.goal(tutor.lesson.goal);if(goal)graph.goTo(goal);tutor.shown=true;say(`${goal?tutor.lesson.watch(graph.pointText(goal)).replace(/-/g,'−'):'Nothing to find.'} Now try one yourself: press Your turn.`,'done');refresh();return false;}
 const command=controller.model.nextStep();
 if(!command){say(`${controller.status()}. Now try one yourself: press Your turn.`,'done');stopPlaying();refresh();return false;}
 say(narrate(command,controller.model.state));
 safe(()=>controller.as('tutor',()=>controller.execute(command)));return true;
}
$('tutor-step').onclick=()=>{stopPlaying();exampleStep();};
function stopPlaying(){playing=false;clearTimeout(playTimer);playTimer=0;$('tutor-play').setAttribute('aria-pressed','false');$('tutor-play').textContent='Play all';}
$('tutor-play').onclick=()=>{if(playing)return stopPlaying();playing=true;$('tutor-play').setAttribute('aria-pressed','true');$('tutor-play').textContent='Pause';exampleStep();};
// While playing, advance once each animation settles, with a pause to read the narration.
controller.addEventListener('change',()=>{
 if(tutor&&!controller.busy&&!finished(controller.model))tutor.announced=false;
 if(tutor?.phase==='example'&&!controller.busy&&finished(controller.model)&&!tutor.announced){tutor.announced=true;stopPlaying();say(`${controller.status()}. Now try one yourself: press Your turn.`,'done');refresh();}
 if(playing&&!controller.busy&&!playTimer)playTimer=setTimeout(()=>{playTimer=0;if(playing&&!controller.busy&&!dragger.active)exampleStep();else if(playing)controller.dispatchEvent(new Event('change'));},1100);
});
function practice(){
 if(tutor.lesson.graph){tutor.solved=true;const equations=tutor.practice();graph.setEquations(equations);tutor.solved=false;say(`Your turn: ${equations.join('  and  ').replace(/\*/g,'×').replace(/-/g,'−')}. ${tutor.lesson.goal==='root'?'Drag the point to where the curve meets the x axis.':'Drag the point along a line to where the lines cross.'}`);refresh();return;}
 stopPlaying();hint=null;const problem=tutor.practice();safe(()=>controller.load(problem));say(`Your turn: ${math.equationText(controller.model.state).replace(/ = 0$/,'')}. ${controller.model.expression?'Tap the product to work it out, or drag like cards together.':'Drag cards to get x alone.'} Ask for a hint any time.`);refresh();}
$('tutor-turn').onclick=practice;$('tutor-new').onclick=practice;
$('tutor-next').onclick=()=>{const i=lessons.indexOf(tutor.lesson);startLesson(lessons[(i+1)%lessons.length]);};
$('tutor-close').onclick=leaveTutor;
$('tutor-hint').onclick=()=>{if(tutor.lesson.graph){tutor.hints++;say(`Hint: ${tutor.lesson.hint}`,'hint');return;}const command=controller.model.nextStep();if(!command)return;tutor.hints++;hint=command.type==='operate'?null:command;controller.render();say(`Hint: ${narrate(command,controller.model.state)}`,'hint');};
$('tutor-show').onclick=()=>{if(tutor.lesson.graph){const goal=graph.goal(tutor.lesson.goal);tutor.solved=true;if(goal){graph.goTo(goal);say(`Here it is: (${graph.pointText(goal).replace(/-/g,'−')}). Try New problem to find one yourself.`,'hint');}refresh();return;}const command=controller.model.nextStep();if(!command)return;hint=null;say(`Watch: ${narrate(command,controller.model.state)}`,'hint');safe(()=>controller.as('tutor',()=>controller.execute(command)));};
controller.addEventListener('commit',event=>{
 hint=null;if(!tutor||tutor.phase!=='practice')return;
 const {transaction,source}=event.detail;if(source!=='learner'&&!finished(controller.model))return;
 const result=feedback(controller.model,transaction.before);say(result.tone==='done'?`${result.text} Well done — New problem for another, or Next lesson.`:result.text,result.tone);
});

// Pad and hardware keys stage the same input; the up triangle deploys it.
function enterKey(key){
 if(dragger.active||['Enter','ArrowUp'].includes(key)&&!entry.active)return;
 const text=entry.key(key);if(key==='Escape')$('entry-bar').hidden=true;if(text===null)return;
 $('entry-text').textContent=entry.text||'0';$('entry-bar').hidden=!entry.active;
 if(['Enter','ArrowUp'].includes(key)){try{controller.load(text||'0');leaveTutor();message('');}catch(e){entry.active=true;$('entry-bar').hidden=false;message(e.message);}return;}
 message('');
}
const cells=[];
function illuminate(n){$('pad-numeral').textContent=String(n);cells.forEach((b,i)=>b.classList.toggle('lit',i<n));}
for(let n=1;n<=9;n++){const b=document.createElement('button');b.dataset.inputKey=String(n);b.setAttribute('aria-label',`Input ${n}`);b.title=String(n);b.onpointerenter=()=>illuminate(n);b.onfocus=()=>illuminate(n);cells.push(b);$('keypad').append(b);}
$('keypad').onpointerleave=()=>illuminate(0);
for(const b of document.querySelectorAll('[data-input-key]'))b.onclick=()=>enterKey(b.dataset.inputKey);
$('entry-done').onclick=()=>enterKey('ArrowUp');
document.addEventListener('keydown',event=>{if(document.body.classList.contains('graph-active')||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,dialog'))return;if(/^[0-9xX.+\-*/=(),:÷]$/.test(event.key)||['Backspace','Enter','ArrowUp','Escape'].includes(event.key)){event.preventDefault();enterKey(event.key);}});
$('clear').onclick=()=>{entry.clear();$('entry-text').textContent='0';$('entry-bar').hidden=false;safe(()=>{controller.load('0');leaveTutor();});};
$('open-tests').onclick=()=>location.href='./tests.html';
// Graph mode loads on first use and shares the page; card-space input pauses while it is open.
let graph=null;
async function showGraph(on){
 document.body.classList.toggle('graph-active',on);$('graph-mode').hidden=!on;$('open-graph').setAttribute('aria-pressed',String(on));
 if(on){entry.active=false;$('entry-bar').hidden=true;if(tutor&&!tutor.lesson.graph)leaveTutor();if(!graph){const {Graph}=await import('../graph/graph-app.js');graph=new Graph({cardsEquation:()=>math.equationText(controller.model.state)});graph.addEventListener('point',graphPoint);}graph.show();}
 else{graph?.hide();if(tutor?.lesson.graph)leaveTutor();controller.render();}
 return graph;
}
// A graph lesson is done when the learner's point reaches its goal (a crossing or a root).
function graphPoint(event){
 if(!tutor?.lesson.graph||tutor.phase!=='practice'||tutor.solved)return;
 const {kinds,exact,x,y}=event.detail;if(!kinds.includes(tutor.lesson.goal))return;
 tutor.solved=true;const at=exact?`${exact.x.d===1?exact.x.n:math.format(exact.x)}, ${exact.y.d===1?exact.y.n:math.format(exact.y)}`:`${x}, ${y}`;
 say(`Found it: (${at.replace(/-/g,'−')}). ${tutor.lesson.goal==='root'?'Zero y cards: that x is a root.':'Every equation checks out here.'} Well done: New problem for another, or Next lesson.`,'done');refresh();
}
$('open-graph').onclick=()=>showGraph($('graph-mode').hidden);
for(const id of ['open-equation','open-tutor'])$(id).addEventListener('click',()=>{if(!$('graph-mode').hidden)showGraph(false);});
