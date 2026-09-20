import { frac, format, numeric, parseEquation, parseScalar, transpose, cancelPair, simplify, operate, solution, isSolved, equationText, sideText, termText, evaluate, lessons, eq } from './engine.js';
import { escape, icon, block, grid } from './blocks.js';
import { arithmeticPanel, placeValuePanel } from './arithmetic.js';
import { digitPlaces } from './place-value.js';

const app = document.querySelector('#app');
let saved = [];
try { const value = JSON.parse(localStorage.getItem('abacus.completed.v1') || '[]'); if (Array.isArray(value)) saved = value.filter(id => lessons.some(l => l.id === id)); } catch { /* Storage is optional. */ }
const state = {
  view: 'equations', lesson: lessons[0], equation: parseEquation(lessons[0].equation),
  initial: lessons[0].equation, history: [], steps: [], completed: new Set(saved),
  selected: null, hint: false, preview: frac(1), busy: false, expanded: false,
  demo: 'carry', stage: 0, running: false, speed: 1500, modal: null,
  placeNumber:'1,234,567', placeExponent:6, exploded:false,
};
let demoTimer, toastTimer, drag = null, suppressClick = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const currentTerm = () => [...state.equation.left, ...state.equation.right].find(t => t.id === state.selected);
const sideOf = id => state.equation.left.some(t => t.id === id) ? 'left' : 'right';
function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message; toast.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
  document.querySelector('#announcer').textContent = message;
}
function persist() { try { localStorage.setItem('abacus.completed.v1', JSON.stringify([...state.completed])); } catch { /* Private browsing still works. */ } }
function header() {
  return `<header class="topbar"><a class="brand" href="./" aria-label="Abacus home"><span class="brand-mark"><i></i><i></i><i></i><i></i><i></i><i></i></span>abacus<span class="brand-dot">.</span></a><nav class="main-nav" aria-label="Main navigation"><button data-view="equations" class="${state.view==='equations'?'active':''}" ${state.view==='equations'?'aria-current="page"':''}>Equation lab</button><button data-view="arithmetic" class="${state.view==='arithmetic'?'active':''}" ${state.view==='arithmetic'?'aria-current="page"':''}>Number workshop</button></nav><button class="help-button" data-action="help">${icon('help',18)} <span>How to play</span></button></header>`;
}
function sidebar() {
  let category = '';
  return `<aside class="sidebar"><div class="sidebar-top"><span class="eyebrow">A LITTLE PRACTICE. A BIG IDEA.</span><h2>Let’s make it click.</h2><p>Move the pieces.<br>Find your own way to <i>x</i>.</p></div><div class="lesson-list"><div class="list-title">${icon('book',16)} YOUR LEARNING PATH</div>${lessons.slice(0,state.expanded?lessons.length:5).map((l,i)=>{let heading=l.category!==category?`<h3 class="lesson-category">${l.category}</h3>`:''; category=l.category; return `${heading}<button class="lesson ${state.lesson?.id===l.id?'selected':''}" data-lesson="${l.id}" aria-pressed="${state.lesson?.id===l.id}"><span class="lesson-number ${state.completed.has(l.id)?'complete':''}">${state.completed.has(l.id)?icon('check',14):String(i+1).padStart(2,'0')}</span><span><strong>${l.title}</strong><small>${l.tag}</small></span>${state.lesson?.id===l.id?'<span class="active-dot"></span>':''}</button>`;}).join('')}<button class="more-lessons" data-action="more-lessons">${state.expanded?'Show less':'Explore all 8 lessons'} ${icon('chevron',13)}</button></div><div class="progress-card"><div><span>Your discoveries</span><strong>${state.completed.size}<span> / ${lessons.length}</span></strong></div><div class="progress-track"><i style="width:${state.completed.size/lessons.length*100}%"></i></div><p>Small steps add up.</p></div><button class="free-play" data-action="free-play">${icon('spark',17)} Make your own equation ${icon('arrow',15)}</button><div class="sidebar-foot"><span class="tiny-block"></span> A hands-on way to understand.</div></aside>`;
}
function termCard(t, side) {
  const negative = t.value.n < 0;
  return `<button class="term ${t.kind==='variable'?'variable':negative?'negative':'positive'} ${state.selected===t.id?'is-selected':''}" data-term="${t.id}" data-side="${side}" aria-label="${escape(termText(t))}, ${side} side. Select to move, or drag across the equals sign." aria-pressed="${state.selected===t.id}" title="Drag to move · click for actions"><span class="term-grip">⠿</span>${block(t)}<span class="term-value">${t.kind==='constant' && !negative?'+':''}${escape(termText(t))}</span><span class="term-kind">${t.kind==='variable'?'unknown':t.value.d!==1?'fraction':negative?'negative':'positive'}</span></button>`;
}
function getBalance() {
  const left=evaluate(state.equation.left,state.preview), right=evaluate(state.equation.right,state.preview);
  const l=numeric(left),r=numeric(right);
  const difference=BigInt(left.n)*BigInt(right.d)-BigInt(right.n)*BigInt(left.d);
  const relation=difference===0n?'=':difference>0n?'>':'<';
  const amount=Math.max(.3,Math.min(5,Math.abs(r-l)/Math.max(1,Math.abs(l),Math.abs(r))*5));
  const delta=difference===0n?0:difference>0n?-amount:amount;
  return {l,r,delta,relation};
}
function equationLab() {
  const solved = isSolved(state.equation), result = solution(state.equation), balance = getBalance();
  const selected = currentTerm();
  const selectedSide = selected ? sideOf(selected.id) : null;
  const opposite = selectedSide==='left'?'right':'left';
  const pair = selected && state.equation[selectedSide].find(t => t.id!==selected.id && t.kind===selected.kind && Math.sign(t.value.n)!==Math.sign(selected.value.n));
  const text = equationText(state.equation);
  return `<div class="lab-heading"><div><div class="breadcrumb">THE EQUATION LAB <span>/</span> ${state.lesson ? `LESSON ${String(lessons.indexOf(state.lesson)+1).padStart(2,'0')}` : 'FREE EXPLORATION'}</div><h1>${state.lesson?.title || 'What will you discover?'}</h1><p>${state.lesson?.description || 'Type a linear equation, move the blocks, and follow your curiosity.'}</p></div><span class="goal-pill">${icon('balance',16)} ${state.lesson?.goal || 'Explore & balance'}</span></div>
    <form id="equation-form" class="equation-input"><span class="input-icon">${icon('keyboard',19)}</span><label class="sr-only" for="equation-input">Type your equation</label><input id="equation-input" name="equation" value="${escape(state.initial)}" maxlength="360" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="input-error"/><button type="submit">Build equation ${icon('arrow',16)}</button></form><div id="input-error" class="input-error" role="alert"></div>
    <section class="balance-lab panel ${solved?'solved':''}" aria-label="Interactive equation balance"><div class="canvas-topline"><div class="live-label"><i></i> ${solved?'YOU FOUND THE BALANCE':'YOUR WORKSPACE'}</div><div class="canvas-tools"><button data-action="undo" title="Undo (Ctrl+Z)" aria-label="Undo last move" ${state.history.length?'':'disabled'}>${icon('undo',17)}</button><button data-action="reset" title="Start this equation over" aria-label="Reset equation">${icon('reset',17)}</button><span class="toolbar-divider"></span><button class="hint-button ${state.hint?'active':''}" data-action="hint">${icon('hint',16)} Hint</button></div></div>
      <div class="equation-readout" aria-label="Current equation: ${escape(text)}"><span class="readout-left">${escape(sideText(state.equation.left))}</span><span class="readout-equal">=</span><span class="readout-right">${escape(sideText(state.equation.right))}</span></div>
      <div class="balance-stage" style="--tilt:${balance.delta}deg"><span class="stage-axis"></span><div class="beam-assembly"><div class="term-area" data-drop="left" role="group" aria-label="Left side of equation"><div class="terms">${state.equation.left.map(t=>termCard(t,'left')).join('') || '<span class="empty-side"><b>0</b><small>Zero is a balance, too.</small></span>'}</div><span class="side-label">LEFT SIDE</span></div><div class="balance-center" aria-hidden="true"><span>=</span></div><div class="term-area" data-drop="right" role="group" aria-label="Right side of equation"><div class="terms">${state.equation.right.map(t=>termCard(t,'right')).join('') || '<span class="empty-side"><b>0</b><small>Zero is a balance, too.</small></span>'}</div><span class="side-label">RIGHT SIDE</span></div><div class="balance-beam"><i></i></div></div><div class="fulcrum"><span></span></div><div class="fulcrum-shadow"></div></div>
      <div class="workspace-message" aria-live="polite">${solved ? `<span class="solved-message">${icon('check',18)} You’ve got it. <strong>x = ${escape(format(result.value))}</strong></span><button class="next-lesson" data-action="next-lesson">Next discovery ${icon('arrow',15)}</button>` : selected ? `<span><b>${escape(termText(selected))}</b> selected</span><button data-action="move" data-destination="${opposite}">Move ${opposite} ${icon('arrow',14)}</button>${pair?`<button data-action="neutralize" data-pair="${pair.id}">Neutralize opposites</button>`:''}<button class="deselect" data-action="deselect" aria-label="Deselect term">${icon('close',14)}</button>` : `${icon('cube',17)} <span>Drag a block across <b>=</b> to flip its sign. <span class="optional-copy">Opposites cancel out.</span></span>`}</div>
      <div class="balance-preview"><label for="preview-x">Try a value for x <input id="preview-x" inputmode="decimal" value="${escape(format(state.preview))}" aria-label="Preview value for x"/></label><span class="preview-result">${escape(format(evaluate(state.equation.left,state.preview)))} ${balance.relation} ${escape(format(evaluate(state.equation.right,state.preview)))} <i>·</i> ${balance.delta===0?'balanced':'watch the balance tip'}</span><span class="preview-note">Preview only</span></div>
    </section>
    ${state.hint?`<div class="hint-panel">${icon('hint',20)}<p>${escape(state.lesson?.hint || 'Collect the x terms on one side and the constants on the other. Combine like terms, then divide by the coefficient of x.')}</p></div>`:''}
    ${result.type!=='unique'?`<div class="equation-notice">${result.type==='identity'?'Both sides are equivalent. Every value of x works!':'This equation has no solution: the x terms cancel, but the constants disagree.'}</div>`:''}
    <section class="operation-bar panel" aria-label="Equation operations"><div><strong>Keep it equal.</strong><span>Do the same to both sides.</span></div><form id="operation-form"><label class="sr-only" for="operation">Operation</label><select id="operation" aria-label="Operation"><option value="divide">÷ Divide</option><option value="multiply">× Multiply</option><option value="add">+ Add</option><option value="subtract">− Subtract</option></select><label class="sr-only" for="amount">Amount</label><input id="amount" aria-label="Operation amount" value="2" inputmode="text" maxlength="30"/><button class="button" type="submit">Apply ${icon('arrow',15)}</button></form><span class="operation-divider"></span><button class="button combine-button" data-action="combine">${icon('spark',17)} Combine like terms</button></section>
    <div class="lower-panels"><section class="panel concept-card"><span class="eyebrow">THE IDEA BEHIND THE BLOCKS</span><h2>Different colors. Same rules.</h2><div class="block-legend"><div><span class="legend-tile blue"></span><span><b>Positive</b><small>One more</small></span></div><div><span class="legend-tile red"></span><span><b>Negative</b><small>One less</small></span></div><div><span class="legend-tile green">x</span><span><b>Variable</b><small>The unknown</small></span></div></div><p>A blue and a red unit make zero. Move a term across the equals sign to add its opposite to both sides.</p><button class="text-link" data-view="arithmetic">See how numbers stack up ${icon('arrow',15)}</button></section><section class="panel steps-card"><div class="steps-heading"><span class="eyebrow">YOUR THINKING, STEP BY STEP</span><span class="step-count">${state.steps.length} ${state.steps.length===1?'move':'moves'}</span></div><ol class="history"><li><span class="history-dot"></span><div><b>${escape(state.initial)}</b><small>The starting point</small></div></li>${state.steps.slice(-3).map((step,i)=>`<li><span class="history-dot ${i===Math.min(state.steps.length,3)-1?'latest':''}"></span><div><b>${escape(step.equation)}</b><small>${escape(step.label)}</small></div></li>`).join('')}</ol>${state.steps.length?'':'<p class="history-placeholder">Every move tells a story.<br>Make your first one above.</p>'}</section></div>`;
}
function render() {
  app.innerHTML = `${header()}<div class="app-layout">${sidebar()}<main id="main-content">${state.view==='equations'?equationLab():state.demo==='place'?placeValuePanel(state.placeNumber,state.placeExponent,state.exploded):arithmeticPanel(state.demo,state.stage,state.running,state.speed)}<footer class="main-footer"><span>Made for the <i>aha!</i> moment.</span><span>Explore. Make a move. Ask why.</span></footer></main></div>`;
  bind();
}
function setEquation(text, lesson = null) {
  const parsed = parseEquation(text);
  solution(parsed); // Reject out-of-range results before changing the workspace.
  state.equation = parsed; state.lesson = lesson; state.initial = text;
  state.history = []; state.steps = []; state.selected = null; state.hint = false; state.preview = frac(1); state.view='equations';
  stopDemo(); render();
}
function stopDemo() { clearTimeout(demoTimer); state.running = false; }
function record(next, label) {
  // Ensure every legal move preserves the exact solution set.
  const before = solution(state.equation), after = solution(next);
  if (before.type!==after.type || (before.type==='unique' && !eq(before.value, after.value))) throw new Error('That move would change the equation. Try applying it to both sides.');
  state.history.push({ equation: structuredClone(state.equation), steps: structuredClone(state.steps), preview: state.preview });
  state.equation = next; state.selected = null;
  state.steps.push({ label, equation: equationText(next) });
  if (isSolved(next)) {
    state.preview = after.value;
    if (state.lesson) { state.completed.add(state.lesson.id); persist(); }
    notify(`Solved! x = ${format(after.value)}. Substitute it into the original equation to check.`);
  } else notify(label);
}
function commit(next, label, animation = 'combine', detail = {}) {
  if (state.busy) return;
  state.busy = true;
  const stage = document.querySelector('.balance-stage');
  const finish = () => {
    try { record(next,label); } catch (error) { notify(error.message); }
    state.busy=false; render();
  };
  if (!stage || reducedMotion.matches) { finish(); return; }
  const equationBefore = state.equation;
  stage.classList.add(`anim-${animation}`);
  if (animation==='multiply' || animation==='divide') {
    const amount = detail.amount;
    const literalGroups=amount.d===1 && amount.n>0 && amount.n<=4;
    const count = literalGroups ? amount.n : 1;
    const visual = document.createElement('div'); visual.className=`operation-visual ${animation}`;
    visual.innerHTML = `<div class="operation-explanation">${literalGroups?(animation==='multiply'?'Make equal copies on both sides':'Split both sides into equal shares'):'Scale every term on both sides'} <b>${animation==='multiply'?'×':'÷'} ${escape(format(amount))}</b></div><div class="operation-sides">${['left','right'].map(side=>`<div class="operation-groups">${Array.from({length:count},(_,i)=>`<span class="operation-group" style="--group:${i}">${icon('cube',26)}<b>${literalGroups?escape(sideText(animation==='multiply'?equationBefore[side]:next[side])):`${escape(sideText(equationBefore[side]))} → ${escape(sideText(next[side]))}`}</b></span>`).join('')}</div>`).join('<span class="operation-equals">=</span>')}</div><small>${!literalGroups ? 'Every coefficient changes by the same exact factor.' : `Each side ${animation==='multiply'?'gets '+format(amount)+' copies':'is divided by '+format(amount)}. The equality is preserved.`}</small>`;
    stage.append(visual);
  }
  setTimeout(finish,animation==='multiply'||animation==='divide'?1600:430);
}
function move(id, destination) {
  const current = [...state.equation.left,...state.equation.right].find(t=>t.id===id);
  if (!current || sideOf(id)===destination) return;
  commit(transpose(state.equation,id,destination),`Moved ${termText(current)} ${destination}; its sign flipped.`, 'transpose');
}
function guarded(action) { try { action(); } catch (error) { notify(error.message); } }
function bind() {
  document.querySelector('#equation-form')?.addEventListener('submit',event=>{
    event.preventDefault(); if(state.busy) return;
    const input=document.querySelector('#equation-input');
    try { setEquation(input.value.trim()); notify('Your equation is ready. Start moving the blocks.'); }
    catch(error) { const target=document.querySelector('#input-error'); target.textContent=error.message; input.setAttribute('aria-invalid','true'); input.focus(); }
  });
  document.querySelector('#operation-form')?.addEventListener('submit',event=>{
    event.preventDefault(); if(state.busy) return;
    guarded(()=>{const operation=document.querySelector('#operation').value, amount=parseScalar(document.querySelector('#amount').value); const label=`${{add:'Added',subtract:'Subtracted',multiply:'Multiplied by',divide:'Divided by'}[operation]} ${format(amount)} ${operation==='subtract'?'from':'on'} both sides.`; commit(operate(state.equation,operation,amount),label,operation,{amount});});
  });
  document.querySelector('#preview-x')?.addEventListener('change',event=>{
    guarded(()=>{ const preview=parseScalar(event.target.value); evaluate(state.equation.left,preview); evaluate(state.equation.right,preview); state.preview=preview; render(); });
  });
  document.querySelector('#animation-speed')?.addEventListener('change',event=>{state.speed=Number(event.target.value); if(state.running) scheduleDemo();});
  document.querySelector('#place-form')?.addEventListener('submit',event=>{event.preventDefault();try{const number=digitPlaces(document.querySelector('#place-number').value);state.placeNumber=number.formatted;state.placeExponent=number.places[0].exponent;render();}catch(error){document.querySelector('#place-error').textContent=error.message;}});
  document.querySelector('#explode-cards')?.addEventListener('change',event=>{state.exploded=event.target.checked;render();});
}
app.addEventListener('click',event=>{
  const target=event.target.closest('button'); if(!target || state.busy || suppressClick) return;
  guarded(()=>{
    if(target.dataset.view) {stopDemo(); state.view=target.dataset.view; render(); return;}
    if(target.dataset.lesson) {const lesson=lessons.find(l=>l.id===target.dataset.lesson);setEquation(lesson.equation,lesson);return;}
    if(target.dataset.term) {state.selected=state.selected===target.dataset.term?null:target.dataset.term;render();document.querySelector(`[data-term="${state.selected}"]`)?.focus({preventScroll:true});return;}
    if(target.dataset.demo) {stopDemo();state.demo=target.dataset.demo;state.stage=0;render();return;}
    if(target.dataset.place!==undefined) {state.placeExponent=Number(target.dataset.place);render();return;}
    if(target.dataset.stage) {stopDemo();state.stage=Number(target.dataset.stage);render();return;}
    switch(target.dataset.action) {
      case 'undo': {const prior=state.history.pop(); if(prior){state.equation=prior.equation;state.steps=prior.steps;state.preview=prior.preview;state.selected=null;render();notify('Undid your last move.');} break;}
      case 'reset': setEquation(state.initial,state.lesson);notify('A fresh start.');break;
      case 'hint':state.hint=!state.hint;render();break;
      case 'more-lessons':state.expanded=!state.expanded;render();break;
      case 'free-play':stopDemo();state.view='equations';state.lesson=null;render();document.querySelector('#equation-input').focus();document.querySelector('#equation-input').select();break;
      case 'combine':{const next=simplify(state.equation);if(equationText(next)===equationText(state.equation)){notify('These terms are already combined. Try moving a term or dividing both sides.');break;}commit(next,'Combined like terms. Opposite units neutralized.');break;}
      case 'move':move(state.selected,target.dataset.destination);break;
      case 'deselect':state.selected=null;render();break;
      case 'neutralize':commit(cancelPair(state.equation,state.selected,target.dataset.pair),'Neutralized opposite blocks on the same side.','cancel');break;
      case 'next-lesson':{const index=lessons.findIndex(l=>l.id===state.lesson?.id);const next=lessons[(index+1)%lessons.length];setEquation(next.equation,next);break;}
      case 'play-demo':if(state.running){stopDemo();render();}else{if(state.stage===3)state.stage=0;state.running=true;render();scheduleDemo();}break;
      case 'step-demo':stopDemo();state.stage=(state.stage+1)%4;render();break;
      case 'help':showHelp();break;
    }
  });
});
function scheduleDemo() {
  clearTimeout(demoTimer);
  demoTimer=setTimeout(()=>{if(!state.running)return;if(state.stage<3)state.stage++;if(state.stage===3)state.running=false;render();if(state.running)scheduleDemo();},state.speed);
}

// Pointer capture gives mouse, pen, and touch the same interaction model.
app.addEventListener('pointerdown',event=>{
  const element=event.target.closest('[data-term]');
  if(!element || state.busy || event.button!==0) return;
  drag={id:element.dataset.term,side:element.dataset.side,x:event.clientX,y:event.clientY,element,ghost:null,pointer:event.pointerId};
  element.setPointerCapture(event.pointerId);
});
app.addEventListener('pointermove',event=>{
  if(!drag || event.pointerId!==drag.pointer) return;
  const distance=Math.hypot(event.clientX-drag.x,event.clientY-drag.y);
  if(!drag.ghost && distance<7) return;
  if(!drag.ghost) {drag.ghost=drag.element.cloneNode(true);drag.ghost.classList.add('drag-ghost');drag.ghost.removeAttribute('data-term');drag.ghost.setAttribute('aria-hidden','true');document.body.append(drag.ghost);drag.element.classList.add('drag-source');}
  event.preventDefault();
  drag.ghost.style.left=`${event.clientX-60}px`;drag.ghost.style.top=`${event.clientY-65}px`;
  const beneath=document.elementFromPoint(event.clientX,event.clientY);
  const side=beneath?.closest('[data-drop]');
  document.querySelectorAll('[data-drop]').forEach(el=>el.classList.toggle('drop-active',el===side));
  drag.ghost.classList.toggle('crossing',!!side && side.dataset.drop!==drag.side);
});
function endDrag(event,canceled=false) {
  if(!drag)return;
  const done=drag;drag=null;
  done.element.classList.remove('drag-source');
  document.querySelectorAll('[data-drop]').forEach(el=>el.classList.remove('drop-active'));
  if(done.ghost) {
    done.ghost.remove();suppressClick=true;setTimeout(()=>suppressClick=false,50);
    if(canceled)return;
    const beneath=document.elementFromPoint(event.clientX,event.clientY);
    const side=beneath?.closest('[data-drop]')?.dataset.drop;
    const targetId=beneath?.closest('[data-term]')?.dataset.term;
    guarded(()=>{if(side && side!==done.side)move(done.id,side);else if(targetId && targetId!==done.id)commit(cancelPair(state.equation,done.id,targetId),'Neutralized opposite blocks.','cancel');else notify('Drop a term on the other side, or onto an opposite block on this side.');});
  }
}
app.addEventListener('pointerup',event=>endDrag(event));
app.addEventListener('pointercancel',event=>endDrag(event,true));
document.addEventListener('keydown',event=>{
  if(state.busy || event.target.matches('input,select,textarea') || document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){state.selected=null;render();}
  if((event.ctrlKey||event.metaKey)&&event.key==='z'){event.preventDefault();document.querySelector('[data-action="undo"]')?.click();}
  if(state.selected && ['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();guarded(()=>move(state.selected,event.key==='ArrowLeft'?'left':'right'));}
});
function showHelp() {
  const dialog=document.createElement('dialog');dialog.className='help-dialog';
  dialog.innerHTML=`<button class="dialog-close" aria-label="Close instructions">${icon('close')}</button><span class="eyebrow">WELCOME TO ABACUS</span><h2>Algebra you can get your hands on.</h2><p>Every tile is a term. Every move has a reason.</p><ol class="help-steps"><li><span>01</span><div><b>Make the equation yours.</b><p>Choose a lesson or type an equation such as 3x + 2 = 14. Use / for fractions and parentheses for groups.</p></div></li><li><span>02</span><div><b>Move. Flip. Neutralize.</b><p>Drag a term across = to flip its sign. Drop opposite blocks together on the same side, or use Combine like terms.</p></div></li><li><span>03</span><div><b>Find one green x.</b><p>Multiply or divide both sides to leave x alone, with one constant on the other side. Fractions stay exact.</p></div></li></ol><div class="help-note">${icon('keyboard',21)}<p>Keyboard: Tab to a tile and press Enter to select. Use ← or → to move it. Ctrl/Cmd+Z undoes a move. On touch screens, drag or tap a tile and choose Move.</p></div><p class="help-footnote">The seesaw previews the value you enter for x. A tilt is a numerical check, not a change to the equation. Use the Number workshop to explore regrouping and equal shares.</p><button class="button button-dark dialog-done">Let’s explore ${icon('arrow',16)}</button>`;
  document.body.append(dialog);dialog.showModal();
  const close=()=>{dialog.close();dialog.remove();document.querySelector('[data-action="help"]')?.focus();};
  dialog.querySelector('.dialog-close').onclick=close;dialog.querySelector('.dialog-done').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
}

const initialView=new URLSearchParams(location.search).get('view');
if(initialView==='place'){state.view='arithmetic';state.demo='place';}
render();
