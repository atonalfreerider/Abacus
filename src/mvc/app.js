import {EquationEntry} from './entry.js';
import { Controller } from './controller.js';
import { math } from './model.js';
import { Surface } from './surface.js';
import { Dragger } from './drag.js';
import { Tutor,lessons,narrate,feedback,finished,dealExamples,exampleOf } from './tutor.js';
import { haptic } from '../haptics.js';
import { initNative } from '../native.js';
import { placeMetadata } from '../place-value.js';
import { setStyle,onStyle,ink } from './theme.js';
import { statusBarStyle } from '../native.js';
import { numeral,setBase,onBase,bases,baseOrder,baseSpec,baseText,placeMeta,digitGlyph } from './bases.js';
import { fingerprintSVG } from '../numbers/fingerprint.js';
import { describe } from '../numbers/primes.js';
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
// Outside decimal a solved x is also written in the cards' base.
function statusText(){
 const text=controller.status(),m=controller.model;if(numeral.id==='decimal')return text;
 if(m.expression){const [only]=m.state.left;return m.state.left.length===1&&!only.expr&&only.kind==='constant'?`${text} = ${baseText(only.value)}`:text;}
 const r=m.result();return math.isSolved(m.state)&&r.type==='unique'?`${text} = ${baseText(r.value)}`:text;
}
function refresh() {
 $('equation-status').textContent=statusText();
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
 onPeek:(id,at)=>peek(id,at),onPeekEnd:()=>{$('peek').hidden=true;},
});
// Peek (firm press or long press): what a card holds, without changing anything. A
// number shows its places as cards; a term still to be worked out shows every step of
// its order of operations through to the answer.
const SUP='⁰¹²³⁴⁵⁶⁷⁸⁹',sup=k=>String(k).replace(/\d/g,d=>SUP[d]).replace('-','⁻');
const short=x=>Number.isInteger(x)?String(x):x.toFixed(x<1?3:2).replace(/0+$/,'');
// A number in another base: each place's digit, what one of its cards is worth and how
// many cards its stack holds.
function basePeek(t){
 const base=numeral.id,b=bases[base],spec=baseSpec(t.value,base),title=`${escapeHtml(math.termText(t,true))} = ${escapeHtml(baseText(t.value))}`;
 if(!spec)return `<h2>${title}</h2><p>This fraction does not end in ${b.name.toLowerCase()}: its denominator is not a power of ${b.radix}. Tap it to divide it out.</p>`;
 const symbol=base==='e'?'e':String(b.radix),rows=spec.places.filter(p=>p.digit).map(p=>{
  const meta=placeMeta(p.exponent,base),worth=b.radix**p.exponent,cards=b.bulbs?`its bulb lit ${p.negative?'red':'blue'}, worth ${p.negative?'−':''}${short(worth)}`:p.exponent<0?`a card ${short(worth)} of a whole`:meta.cardCount===1?'one card':base==='e'?`a stack of ${short(worth)} cards (${Math.floor(worth)} and a slice)`:`a stack of ${short(worth)} cards`;
  return b.bulbs?`<li>${p.signed<0?'T':'1'} × ${symbol}${sup(p.exponent)}: ${cards}</li>`:`<li>${p.signed<0?'−':''}${p.digit} × ${symbol}${sup(p.exponent)}${base==='e'||p.exponent<0?'':` = ${p.signed<0?'−':''}${p.digit*worth}`}: ${p.digit>1?`${p.digit} × `:''}${cards}</li>`;});
 const note=base==='binary'?'Each tray holds one bit, a bulb lit or dark. Two lit bulbs in a place light the bulb of the next place.':base==='ternary'?'Each tray holds one trit: a bulb lit blue (1), dark (0) or lit red (−1, written T), so the number needs no minus sign. Two like bulbs make a zero pair appear, and three like bulbs light the next place.':`e is transcendental: only 0, 1 and 2 end in base e${spec.exact?'':', so these digits run on (…)'}.`;
 return `<h2>${title}</h2><ol>${rows.join('')}</ol><p>${note}</p>`;
}
function peekText(t){
 if(numeral.id!=='decimal'&&!t.expr&&t.kind==='constant')return basePeek(t);
 if(t.expr){const chain=[math.termText(t,true)];let next=t;while((next=math.evaluateStep(next))&&chain.length<12)chain.push(math.termText(next,true));
  return `<h2>Worked out in order</h2><ol>${chain.slice(1).map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol><p>Tap the term to watch each step.</p>`;}
 if(t.kind==='variable')return `<h2>The unknown</h2><p>${escapeHtml(math.termText(t,true))} ${math.eq(math.abs(t.value),math.frac(1))?'is one x: get it alone to find its value.':'is that many groups of x.'}</p>`;
 if(t.value.d!==1&&t.notation!=='decimal')return `<h2>A fraction</h2><p>${escapeHtml(math.termText(t,true))} = ${escapeHtml(math.format(math.abs(t.value)))}; tap it to divide it out.</p>`;
 const digits=[...String(Math.abs(t.value.n))].filter(d=>t.value.d===1),places=digits.map((d,i)=>({d:Number(d),meta:placeMetadata(digits.length-i-1)})).filter(p=>p.d);
 if(!places.length)return `<h2>${escapeHtml(math.termText(t,true))}</h2>`;
 const name=m=>({1:'one',10:'ten',100:'hundred'}[m.magnitude])+(m.mark?` ${({k:'thousand',M:'million',B:'billion',T:'trillion'})[m.mark]}`:'');
 return `<h2>${escapeHtml(math.termText(t,true))} in cards</h2><ol>${places.map(p=>`<li>${p.d} ${name(p.meta)}${p.d>1?'s':''}: ${p.d} ${p.meta.cardCount>1?`stacks of ${p.meta.cardCount} cards`:p.d>1?'cards':'card'}</li>`).join('')}</ol><p>${math.negative(t)?'Red: a negative amount.':'Blue: a positive amount.'}</p>`;
}
const escapeHtml=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// A whole number's prime components, as its marble fingerprint, head the peek.
function fingerprintPeek(t){
 if(t.expr||t.kind!=='constant'||t.value.d!==1||Math.abs(t.value.n)<2)return '';
 const n=Math.abs(t.value.n);
 return `<div class="peek-fingerprint">${fingerprintSVG(n,{palette:ink.marble,unit:11,title:describe(n)})}<p>${escapeHtml(describe(n))}</p></div>`;
}
function peek(id,at){
 const t=terms().find(t=>t.id===id);if(!t)return;
 const box=$('peek'),stage=$('workspace').getBoundingClientRect();box.innerHTML=fingerprintPeek(t)+peekText(t);box.hidden=false;haptic('peek');
 const w=box.offsetWidth,h=box.offsetHeight;box.style.left=`${Math.max(8,Math.min(stage.width-w-8,at.x-stage.left-w/2))}px`;box.style.top=`${Math.max(8,at.y-stage.top-h-28)}px`;
}
refresh();surface.prewarm(controller.options.camera);
// Haptics follow the cards: a light pop as each zero pair cancels, a tick as ten stack.
let felt={plan:null,time:0};
function animationHaptics(){
 const plan=controller.clock.plan,u=plan?.units;if(!u||!controller.clock.playing)return;
 if(felt.plan!==plan)felt={plan,time:-1};
 const time=Math.min(1,controller.clock.progress/.9)*u.duration;
 for(const phase of u.phases)if(phase.start>felt.time&&phase.start<=time&&(phase.type==='neutralize'||phase.type==='carry'))haptic(phase.type==='neutralize'?'pop':'tick');
 felt.time=time;
}
function tick(now){requestAnimationFrame(tick);try{controller.frame(now);dragger.frame(now);animationHaptics();}catch(error){console.error(error);controller.finish();message(error.message);}}requestAnimationFrame(tick);
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

// An example as the learner will see it: 3 + 5 × 3, 2 × (9 − 4), 2³.
function typesetExample(example){
 return [example].flat().map(text=>{try{if(/y/.test(text))throw 0;return text.includes('=')?math.equationText(math.parseEquation(text)):math.sideText(math.parseExpression(text));}catch{return text.replace(/\*/g,' × ').replace(/\^(\d)/g,(_,d)=>'⁰¹²³⁴⁵⁶'[d]).replace(/-/g,'−');}}).join(' and ');
}
const answer=()=>controller.model.expression?`The answer is ${controller.status()}`:controller.status();
// Tutor: a worked example step by step, then a fresh problem of the same shape.
// Every launch deals new worked examples, so the lessons differ each time the app opens.
// (?examples=written keeps the written examples, for tests and recorded videos.)
if(new URLSearchParams(location.search).get('examples')!=='written')dealExamples(crypto.getRandomValues(new Uint32Array(1))[0]);
$('open-tutor').onclick=()=>$('lesson-dialog').showModal();
{let group='';for(const lesson of lessons){
 if(lesson.group!==group){group=lesson.group;const h=document.createElement('h2');h.textContent=group;$('lessons').append(h);}
 const b=document.createElement('button');b.innerHTML=`<span>${lesson.title}</span><small>${typesetExample(exampleOf(lesson))}</small>`;b.onclick=()=>{$('lesson-dialog').close();startLesson(lesson);};$('lessons').append(b);
}}
// Lessons count in tens: a lesson shows decimal cards and gives the base back afterwards.
let lessonBase=null;
async function startLesson(lesson){
 if(numeral.id!=='decimal'){lessonBase=numeral.id;setBase('decimal');}
 stopPlaying();tutor=new Tutor(lesson);tutor.found=new Set();hint=null;entry.active=false;$('entry-bar').hidden=true;
 $('tutor-bar').classList.toggle('graph-lesson',!!lesson.graph);controller.model.leftToRight=!!lesson.pemdas;
 if(lesson.graph){(await showGraph(true)).setEquations(exampleOf(lesson));}
 else{if(!$('graph-mode').hidden)showGraph(false);safe(()=>controller.load(exampleOf(lesson)));}
 $('tutor-bar').hidden=false;$('tutor-title').textContent=lesson.title;
 say(`${lesson.intro} Watch: press Next step, or Play all.`);refresh();
}
function say(text,tone=''){$('tutor-prompt').textContent=text;$('tutor-prompt').dataset.tone=tone;}
function leaveTutor(){if(lessonBase&&tutor){const base=lessonBase;lessonBase=null;setBase(base);}stopPlaying();tutor=null;hint=null;controller.model.leftToRight=false;$('tutor-bar').hidden=true;$('tutor-bar').classList.remove('graph-lesson');controller.render();}
const lessonDone=()=>tutor.lesson.graph?(tutor.phase==='example'?!!tutor.shown:!!tutor.solved):finished(controller.model);
function refreshTutor(){
 const example=tutor.phase==='example',done=lessonDone();
 $('tutor-phase').textContent=example?'Example':'Your turn';$('tutor-phase').dataset.phase=tutor.phase;
 for(const [id,show] of [['tutor-step',example],['tutor-play',example],['tutor-turn',example],['tutor-hint',!example&&!done],['tutor-show',!example&&!done],['tutor-new',!example],['tutor-next',!example&&done]])$(id).hidden=!show;
 $('tutor-step').disabled=controller.busy||done;$('tutor-play').disabled=done&&!playing;$('tutor-turn').classList.toggle('ready',done);$('tutor-play').hidden||=!!tutor.lesson.graph;
 const next=tutor.lesson.graph?null:controller.model.nextStep(),action=!example&&!done&&next?.type==='operate'?next:null;
 $('tutor-action').hidden=!action;if(action)$('tutor-action').textContent=`${action.operation==='divide'?'÷':'×'} both sides by ${action.amount}`;$('tutor-action').onclick=()=>safe(()=>controller.execute(action));
}
// A graph lesson visits one or more goal points in order (the intercepts lesson: y axis, then x axis).
const goalsOf=lesson=>lesson.goals||[lesson.goal];
const goalPrompt=lesson=>{const goals=goalsOf(lesson);return goals.includes('y-intercept')?'Drag the point to where the line crosses the y axis, then to where it crosses the x axis.':goals[0]==='root'?'Drag the point to where the curve meets the x axis.':'Drag the point along a line to where the lines cross.';};
function exampleStep(){
 if(tutor.lesson.graph){
  const goals=goalsOf(tutor.lesson),i=tutor.shownCount||0,kind=goals[i],goal=graph.goal(kind);if(goal)graph.goTo(goal);
  tutor.shownCount=i+1;tutor.shown=tutor.shownCount>=goals.length;const worked=goal?graph.interceptText(goal):'';
  say(`${goal?tutor.lesson.watch(graph.pointText(goal),kind).replace(/-/g,'−'):'Nothing to find.'}${worked?` ${worked}.`:''} ${tutor.shown?'Now try one yourself: press Your turn.':'Press Next step for the other axis.'}`,tutor.shown?'done':'');refresh();return false;}
 const command=controller.model.nextStep();
 if(!command){say(`${answer()}. Now try one yourself: press Your turn.`,'done');stopPlaying();refresh();return false;}
 say(narrate(command,controller.model.state,controller.model.leftToRight));
 safe(()=>controller.as('tutor',()=>controller.execute(command)));return true;
}
$('tutor-step').onclick=()=>{stopPlaying();exampleStep();};
function stopPlaying(){playing=false;clearTimeout(playTimer);playTimer=0;$('tutor-play').setAttribute('aria-pressed','false');$('tutor-play').textContent='Play all';}
$('tutor-play').onclick=()=>{if(playing)return stopPlaying();playing=true;$('tutor-play').setAttribute('aria-pressed','true');$('tutor-play').textContent='Pause';exampleStep();};
// While playing, advance once each animation settles, with a pause to read the narration.
controller.addEventListener('change',()=>{
 if(tutor&&!controller.busy&&!finished(controller.model))tutor.announced=false;
 if(tutor?.phase==='example'&&!controller.busy&&finished(controller.model)&&!tutor.announced){tutor.announced=true;stopPlaying();say(`${answer()}. Now try one yourself: press Your turn.`,'done');refresh();}
 if(playing&&!controller.busy&&!playTimer)playTimer=setTimeout(()=>{playTimer=0;if(playing&&!controller.busy&&!dragger.active)exampleStep();else if(playing)controller.dispatchEvent(new Event('change'));},1100);
});
function practice(){
 if(tutor.lesson.graph){tutor.solved=true;const equations=tutor.practice();graph.setEquations(equations);tutor.solved=false;tutor.found=new Set();say(`Your turn: ${equations.join('  and  ').replace(/\*/g,'×').replace(/-/g,'−')}. ${goalPrompt(tutor.lesson)}`);refresh();return;}
 stopPlaying();hint=null;const problem=tutor.practice();safe(()=>controller.load(problem));say(`Your turn: ${math.equationText(controller.model.state).replace(/ = 0$/,'')}. ${controller.model.expression?'Tap the product to work it out, or drag like cards together.':'Drag cards to get x alone.'} Ask for a hint any time.`);refresh();}
$('tutor-turn').onclick=practice;$('tutor-new').onclick=practice;
$('tutor-next').onclick=()=>{const i=lessons.indexOf(tutor.lesson);startLesson(lessons[(i+1)%lessons.length]);};
$('tutor-close').onclick=leaveTutor;
$('tutor-hint').onclick=()=>{if(tutor.lesson.graph){tutor.hints++;say(`Hint: ${tutor.lesson.hint}`,'hint');return;}const command=controller.model.nextStep();if(!command)return;tutor.hints++;hint=command.type==='operate'?null:command;controller.render();say(`Hint: ${narrate(command,controller.model.state,controller.model.leftToRight)}`,'hint');};
$('tutor-show').onclick=()=>{if(tutor.lesson.graph){const kind=goalsOf(tutor.lesson).find(k=>!tutor.found?.has(k))||goalsOf(tutor.lesson)[0],goal=graph.goal(kind);tutor.found?.add(kind);tutor.solved=goalsOf(tutor.lesson).every(k=>tutor.found?.has(k)??true);if(goal){graph.goTo(goal);const worked=graph.interceptText(goal);say(`Here it is: (${graph.pointText(goal).replace(/-/g,'−')}).${worked?` ${worked}.`:''} ${tutor.solved?'Try New problem to find one yourself.':'Now find the other one.'}`,'hint');}refresh();return;}const command=controller.model.nextStep();if(!command)return;hint=null;say(`Watch: ${narrate(command,controller.model.state,controller.model.leftToRight)}`,'hint');safe(()=>controller.as('tutor',()=>controller.execute(command)));};
controller.addEventListener('commit',event=>{
 hint=null;if(!tutor||tutor.phase!=='practice')return;
 const {transaction,source}=event.detail;if(source!=='learner'&&!finished(controller.model))return;
 const result=feedback(controller.model,transaction.before);say(result.tone==='done'?`${result.text} Well done — New problem for another, or Next lesson.`:result.text,result.tone);if(result.tone==='done')haptic('success');
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
document.addEventListener('keydown',event=>{if(document.body.classList.contains('graph-active')||document.body.classList.contains('numbers-active')||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,dialog'))return;if(/^[0-9xX.+\-*/=(),:÷]$/.test(event.key)||['Backspace','Enter','ArrowUp','Escape'].includes(event.key)){event.preventDefault();enterKey(event.key);}});
$('clear').onclick=()=>{entry.clear();$('entry-text').textContent='0';$('entry-bar').hidden=false;safe(()=>{controller.load('0');leaveTutor();});};
$('open-tests').onclick=()=>location.href='./tests.html';
// Graph mode loads on first use and shares the page; card-space input pauses while it is open.
let graph=null;
async function showGraph(on){
 if(on&&!$('numbers-mode').hidden)showNumbers(false);
 document.body.classList.toggle('graph-active',on);$('graph-mode').hidden=!on;$('open-graph').setAttribute('aria-pressed',String(on));
 if(on){entry.active=false;$('entry-bar').hidden=true;if(tutor&&!tutor.lesson.graph)leaveTutor();if(!graph){const {Graph}=await import('../graph/graph-app.js');graph=new Graph({cardsEquation:()=>math.equationText(controller.model.state)});graph.addEventListener('point',graphPoint);}graph.show();}
 else{graph?.hide();if(tutor?.lesson.graph)leaveTutor();controller.render();}
 return graph;
}
// A graph lesson is done when the learner's point has reached each of its goals.
function graphPoint(event){
 if(!tutor?.lesson.graph||tutor.phase!=='practice'||tutor.solved)return;
 const {kinds,exact,x,y,group}=event.detail,goals=goalsOf(tutor.lesson);tutor.found??=new Set();
 const kind=goals.find(k=>kinds.includes(k)&&!tutor.found.has(k));if(!kind)return;
 tutor.found.add(kind);tutor.solved=goals.every(k=>tutor.found.has(k));
 const at=exact?`${exact.x.d===1?exact.x.n:math.format(exact.x)}, ${exact.y.d===1?exact.y.n:math.format(exact.y)}`:`${x}, ${y}`,worked=group?graph.interceptText(group):'';
 const why=kind==='root'?(goals.length>1?'Zero y cards: y = 0 on the x axis.':'Zero y cards: that x is a root.'):kind==='y-intercept'?'Zero x cards: x = 0 on the y axis.':'Every equation checks out here.';
 if(tutor.solved)haptic('success');
 say(`Found it: (${at.replace(/-/g,'−')}). ${why}${worked?` ${worked}.`:''} ${tutor.solved?'Well done: New problem for another, or Next lesson.':'Now find where it crosses the x axis.'}`,tutor.solved?'done':'good');refresh();
}
$('open-graph').onclick=()=>showGraph($('graph-mode').hidden);
for(const id of ['open-equation','open-tutor'])$(id).addEventListener('click',()=>{if(!$('graph-mode').hidden)showGraph(false);if(!$('numbers-mode').hidden)showNumbers(false);});
// Numbers: one whole number taken apart into its prime components (the marble fingerprint),
// and written in every base. It opens on the biggest whole number in the equation.
let numbers=null;
function numberFromCards(){const whole=terms().filter(t=>!t.expr&&t.kind==='constant'&&t.value.d===1&&Math.abs(t.value.n)>=2).map(t=>Math.abs(t.value.n));return whole.length?Math.max(...whole):undefined;}
async function showNumbers(on,n){
 if(on&&!$('graph-mode').hidden)await showGraph(false);
 document.body.classList.toggle('numbers-active',on);$('numbers-mode').hidden=!on;$('open-numbers').setAttribute('aria-pressed',String(on));
 if(on){entry.active=false;$('entry-bar').hidden=true;if(tutor)leaveTutor();
  if(!numbers){const {NumbersView}=await import('../numbers/numbers-app.js');numbers=new NumbersView();numbers.addEventListener('cards',event=>{showNumbers(false);safe(()=>controller.load(String(event.detail.n)));});}
  numbers.show(n??numberFromCards());}
 else{numbers?.hide();controller.render();}
 return numbers;
}
$('open-numbers').onclick=()=>showNumbers($('numbers-mode').hidden);

// Native apps: quick actions and shortcuts open a place; Android's back button closes
// what is open before it leaves the app.
initNative({
 open:place=>{
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  if(place==='graph'){leaveTutor();showGraph(true);}
  else if(place==='numbers'){leaveTutor();showNumbers(true);}
  else if(place==='lessons'){if(!$('graph-mode').hidden)showGraph(false);$('lesson-dialog').showModal();}
  else if(place==='pemdas'){startLesson(lessons.find(l=>l.id==='pemdas-all'));}
  else if(place==='equation'){if(!$('graph-mode').hidden)showGraph(false);leaveTutor();$('open-equation').click();}
 },
 back:()=>{
  const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return true;}
  if(!$('peek').hidden){$('peek').hidden=true;return true;}
  if(tutor){leaveTutor();return true;}
  if(!$('graph-mode').hidden){showGraph(false);return true;}
  if(!$('numbers-mode').hidden){showNumbers(false);return true;}
  if(entry.active){enterKey('Escape');return true;}
  return false;
 },
});

// Style: the school sketchpad or the cyber look, for every view. Saved per device.
onStyle(name=>{surface.restyle();graph?.restyle();controller.render();surface.prewarm(controller.options.camera);$('style').value=name;statusBarStyle(name);});
$('style').onchange=event=>{setStyle(event.target.value);try{localStorage.setItem('abacus-style',event.target.value);}catch{}};
if(document.documentElement.dataset.style==='cyber')setStyle('cyber');
$('style').value=ink.name;
// Numerals: the base the cards are drawn and regrouped in. Saved per device.
onBase(id=>{controller.clock.finish();controller.clock.plan=null;controller.render();surface.prewarm(controller.options.camera);$('numerals').value=id;$('base-cycle').textContent=bases[id].short;$('base-cycle').title=`Cards in ${bases[id].name.toLowerCase()}: tap for the next base`;});
const chooseBase=id=>{lessonBase=null;setBase(id);try{localStorage.setItem('abacus-base',id);}catch{}};
$('numerals').onchange=event=>chooseBase(event.target.value);
$('base-cycle').onclick=()=>chooseBase(baseOrder[(baseOrder.indexOf(numeral.id)+1)%baseOrder.length]);
{let saved=null;try{saved=new URLSearchParams(location.search).get('base')||localStorage.getItem('abacus-base');}catch{}if(bases[saved])setBase(saved);}
// View ▸ Prime fingerprints: each whole number's prime components under its cards.
$('fingerprints').onchange=event=>{controller.options.fingerprints=event.target.checked;controller.render();try{localStorage.setItem('abacus-fingerprints',event.target.checked?'1':'');}catch{}};
{let on=false;try{on=new URLSearchParams(location.search).has('fingerprints')||localStorage.getItem('abacus-fingerprints')==='1';}catch{}if(on){$('fingerprints').checked=true;controller.options.fingerprints=true;controller.render();}}
