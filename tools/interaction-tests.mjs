// Real-browser interaction checks (headless Chrome): pointer drags through the
// mirror membrane, snapping, springing home, tapping products, keyboard moves, the
// tutor flow, graph mode (tracer detents, systems, the area sweep) and the Machine mode
// (design 6.9, plus checks for the fixes after its review).
// Usage: npm run test:browser
import {spawn} from 'node:child_process';
import {launch,chromePath} from './browser.mjs';
if(!chromePath()){console.log('SKIP: Chrome not found (set CHROME=/path/to/chrome).');process.exit(0);}
const server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const origin=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/[\d.:]+/);if(m)resolve(m[0]);});setTimeout(()=>reject(Error('server did not start')),5000);});
const results=[];let page;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const status=()=>page.eval(`document.getElementById('equation-status').textContent`);
const terms=()=>page.eval(`[...document.querySelectorAll('#equation-svg [data-term]')].map(n=>{const r=n.querySelector('.hit').getBoundingClientRect();return {id:n.dataset.term,label:n.getAttribute('aria-label'),x:r.x+r.width/2,y:r.y+r.height/2,w:r.width}})`);
const mirror=()=>page.eval(`(()=>{const r=document.querySelector('#equation-svg .equals-mirror').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
async function load(text){await page.eval(`(()=>{const i=document.getElementById('equation-input');document.getElementById('open-equation').click();i.value=${JSON.stringify(text)};document.getElementById('equation-form').requestSubmit();})()`);await wait(250);}
async function drag(from,to,steps=30){await page.mouse('mouseMoved',from.x,from.y,{buttons:0});await page.mouse('mousePressed',from.x,from.y);for(let i=1;i<=steps;i++){await page.mouse('mouseMoved',from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps);await wait(16);}await wait(250);await page.mouse('mouseReleased',to.x,to.y);}
const idle=async(limit=9000)=>{for(let t=0;t<limit;t+=100){if(!(await page.eval(`document.getElementById('skip')&&document.getElementById('solve').disabled`)))return;await wait(100);}};
// ONLY=machine (any part of a name) runs just the matching checks.
async function check(name,fn,viewport,path='/?examples=written'){
 if(process.env.ONLY&&!name.includes(process.env.ONLY))return;
 page=await launch(origin+path,viewport);
 try{await wait(400);await fn();if(page.errors.length)throw Error('page errors: '+page.errors.join(' | '));results.push([name,null]);}
 catch(e){results.push([name,e.message]);}
 finally{await page.close();}
}
const expect=(actual,expected,what)=>{if(actual!==expected)throw Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);};
try{
 await check('drag +3 through the mirror onto 7 cancels to x = 4',async()=>{
  const [,three,seven]=await terms();await drag(three,seven,40);await idle();expect(await status(),'Solved: x = 4','status');
 });
 await check('a card released inside the membrane springs home unchanged',async()=>{
  const [,three]=await terms(),m=await mirror();await drag(three,{x:m.x-three.w*.55,y:three.y});await wait(900);
  expect(await status(),'x + 3 = 7','status');expect(await page.eval(`document.getElementById('undo').disabled`),true,'nothing committed');
  expect(await page.eval(`(()=>{const svg=document.getElementById('equation-svg');return !svg.classList.contains('drag-active')&&getComputedStyle(svg.querySelector('.equals-mirror text')).opacity==='1';})()`),true,'the = sign is visible again');
 });
 await check('a card dropped past the mirror in open space moves with its sign flipped',async()=>{
  const [,three,seven]=await terms();await drag(three,{x:seven.x+seven.w*1.3,y:seven.y+10});await idle();expect(await status(),'x = 7 − 3','status');
 });
 await check('dropping into a gap rearranges without changing signs',async()=>{
  await load('x+3+2=9');const [x,,two]=await terms();await drag(two,{x:x.x-x.w*.6,y:x.y});await idle();expect(await status(),'2 + x + 3 = 9','status');
 });
 await check('tapping 23 × 4 works it out to 92',async()=>{
  await load('23*4');const [product]=await terms();await page.mouse('mousePressed',product.x,product.y);await page.mouse('mouseReleased',product.x,product.y);await wait(300);
  expect(await page.eval(`document.querySelector('.operation-animation')?.dataset.operation`),'multiply','animation');await idle();expect(await status(),'92','status');
 });
 await check('long division through Solve reaches 13',async()=>{await load('x=156÷12');await page.eval(`document.getElementById('solve').click()`);await idle();expect(await status(),'Solved: x = 13','status');});
 await check('keyboard: arrow moves a focused card across',async()=>{
  await page.eval(`document.querySelectorAll('#equation-svg [data-term]')[1].focus()`);await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await idle();
  expect(await status(),'x = 7 − 3','status');
 });
 await check('vertical layout: drag down through the horizontal mirror',async()=>{
  const [,three,seven]=await terms();await drag(three,{x:seven.x,y:seven.y},45);await idle();expect(await status(),'Solved: x = 4','status');
 },{width:390,height:844});
 await check('tutor: example plays to the end, then a new problem with a hint',async()=>{
  await page.eval(`document.getElementById('open-tutor').click()`);await page.eval(`[...document.querySelectorAll('#lessons button')].find(b=>b.textContent.includes('Zero pairs')).click()`);
  await page.eval(`document.getElementById('tutor-play').click()`);
  for(let t=0;t<15000&&!(await page.eval(`document.getElementById('tutor-prompt').dataset.tone==='done'`));t+=200)await wait(200);
  expect(await status(),'Solved: x = 4','example result');
  await page.eval(`document.getElementById('tutor-turn').click()`);await wait(300);
  const problem=await status();if(problem==='x + 9 − 7 = 6')throw Error('practice repeated the example');
  await page.eval(`document.getElementById('tutor-hint').click()`);await wait(200);
  expect(await page.eval(`!!document.querySelector('#equation-svg .hinted')&&!!document.querySelector('#equation-svg .hint-arrow')`),true,'hint highlight and arrow');
 });
 await check('tutor PEMDAS lesson: the worked example plays in order of operations, then the learner solves a fresh one',async()=>{
  await page.eval(`document.getElementById('open-tutor').click()`);await page.eval(`[...document.querySelectorAll('#lessons button')].find(b=>b.textContent.includes('All of PEMDAS')).click()`);await wait(900);
  const prompts=[];
  for(let i=0;i<14&&!/Now try one yourself/.test(prompts.at(-1)||'');i++){await page.eval(`document.getElementById('skip').click()`);await page.eval(`document.getElementById('tutor-step').click()`);await wait(250);prompts.push(await page.eval(`document.getElementById('tutor-prompt').textContent`));}
  const order=prompts.map(p=>/^Parentheses/.test(p)?'P':/^Exponents|^An exponent/.test(p)?'E':/^Work out/.test(p)?'MD':/^Last, add/.test(p)?'AS':'').filter(Boolean);
  if(order.join(' ')!=='P E MD MD AS AS')throw Error('steps: '+order.join(' ')+' | '+prompts.join(' / '));
  if(!/^The answer is \d+/.test(prompts.at(-1)))throw Error(prompts.at(-1));
  await page.eval(`document.getElementById('tutor-turn').click()`);await wait(400);
  for(let i=0;i<14&&!/Done/.test(await page.eval(`document.getElementById('tutor-prompt').textContent`));i++){await page.eval(`document.getElementById('skip').click()`);await page.eval(`document.getElementById('solve').click()`);await wait(200);}
  await page.eval(`document.getElementById('skip').click()`);await wait(200);
  const done=await page.eval(`document.getElementById('tutor-prompt').textContent`);if(!/^Done: −?\d+\. Well done/.test(done))throw Error(done);
  await page.eval(`document.getElementById('tutor-close').click()`);
 });
 await check('a long press peeks at a term without changing it: places for a number, every PEMDAS step for a term to work out',async()=>{
  await load('345+(6-1)^2*2÷5=x');const all=await terms(),before=await status();
  const hold=async(at,ms)=>{await page.mouse('mouseMoved',at.x,at.y,{buttons:0});await page.mouse('mousePressed',at.x,at.y);await wait(ms);};
  await hold(all[1],750);const text=await page.eval(`document.getElementById('peek').hidden?'':document.getElementById('peek').innerText`);
  if(!/Worked out in order[\s\S]*5² × 2 ÷ 5[\s\S]*25 × 2 ÷ 5[\s\S]*50 ÷ 5[\s\S]*10/i.test(text))throw Error('peek: '+text);
  await page.mouse('mouseReleased',all[1].x,all[1].y);await wait(300);
  expect(await page.eval(`document.getElementById('peek').hidden`),true,'released, the peek closes');expect(await status(),before,'a peek is not a tap: nothing was worked out');
  await hold(all[0],750);const places=await page.eval(`document.getElementById('peek').innerText`);await page.mouse('mouseReleased',all[0].x,all[0].y);
  if(!/3 hundreds: 3 stacks of 100 cards[\s\S]*4 tens: 4 stacks of 10 cards[\s\S]*5 ones: 5 cards/.test(places))throw Error('places: '+places);
 });
 await check('dragging stays at frame rate',async()=>{
  await load('987654+123456-555555=x+999');const all=await terms(),card=all[1],m=await mirror();
  await page.eval(`window.__frames=[];(function f(t){window.__frames.push(t);if(window.__frames.length<400)requestAnimationFrame(f);})(performance.now())`);
  await drag(card,{x:m.x+40,y:card.y+30},50);
  const ms=await page.eval(`(()=>{const f=window.__frames,d=f.slice(1).map((t,i)=>t-f[i]).sort((a,b)=>a-b);return d[Math.floor(d.length*.9)];})()`);
  const budget=Number(process.env.FRAME_BUDGET_MS||34);if(ms>budget)throw Error(`p90 frame ${ms.toFixed(1)} ms exceeds ${budget} ms`);
 });
 // ---------- graph mode ----------
 const openGraph=async()=>{await page.eval(`document.getElementById('open-graph').click()`);await wait(900);};
 const graphRect=sel=>page.eval(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 const readout=()=>page.eval(`document.getElementById('graph-readout').innerText`);
 await check('graph: dragging the point along the parabola settles on a root with no y cards',async()=>{
  await openGraph();const from=await graphRect('#graph-svg .tracer circle'),root=await page.eval(`(()=>{const c=[...document.querySelectorAll('#graph-svg .special circle')].map(n=>n.getBoundingClientRect()).sort((a,b)=>b.x-a.x)[0];return {x:c.x+c.width/2,y:c.y+c.height/2};})()`);
  await drag(from,{x:root.x+4,y:root.y-3},40);await wait(500);
  const text=await readout();if(!/At the x-intercept/.test(text)||!/\(x, y\) = \(3, 0\)/.test(text))throw Error('readout: '+text.slice(0,120));
  expect(await page.eval(`!document.querySelector('#graph-svg .card-column')&&!!document.querySelector('#graph-svg .card-row')`),true,'y column gone, x row of 3 cards');
  if(!/On the x axis: set y = 0[\s\S]*x = 3/i.test(text))throw Error('intercept solution: '+text.slice(0,300));
  expect(await page.eval(`!!document.querySelector('#graph-svg .axis-hit')&&!!document.querySelector('#graph-svg .collision')`),true,'x axis lit at the crossing');
 });
 await check('tutor intercepts lesson: the learner drags to the y axis, then the x axis',async()=>{
  await page.eval(`document.getElementById('open-tutor').click()`);await page.eval(`[...document.querySelectorAll('#lessons button')].find(b=>b.textContent.includes('Intercepts')).click()`);await wait(1200);
  await page.eval(`document.getElementById('tutor-step').click()`);await wait(300);await page.eval(`document.getElementById('tutor-step').click()`);await wait(300);
  if(!/Now try one yourself/.test(await page.eval(`document.getElementById('tutor-prompt').textContent`)))throw Error('example did not visit both axes');
  await page.eval(`document.getElementById('tutor-turn').click()`);await wait(900);
  const spot=async kind=>page.eval(`(()=>{const g=[...document.querySelectorAll('#graph-svg .special')].find(n=>${kind==='y'?'Number(n.dataset.x)===0':'Number(n.dataset.y)===0&&Number(n.dataset.x)!==0'}).querySelector('circle').getBoundingClientRect();return {x:g.x+g.width/2,y:g.y+g.height/2};})()`);
  let from=await graphRect('#graph-svg .tracer circle');await drag(from,await spot('y'),40);await wait(600);
  let text=await page.eval(`document.getElementById('tutor-prompt').textContent`);if(!/^Found it: \(0, /.test(text)||!/x = 0:/.test(text))throw Error(text);
  from=await graphRect('#graph-svg .tracer circle');await drag(from,await spot('x'),40);await wait(600);
  text=await page.eval(`document.getElementById('tutor-prompt').textContent`);if(!/^Found it: .*, 0\)/.test(text)||!/Well done/.test(text))throw Error(text);
 });
 await check('graph: a crossing one card past an x-intercept is still reachable (a held detent yields to a closer one)',async()=>{
  await openGraph();
  await page.eval(`(async()=>{const set=(i,v)=>{const input=document.querySelectorAll('.graph-eq input')[i];input.value=v;input.dispatchEvent(new Event('input'));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));};set(0,'y = 2x - 7');if(document.querySelectorAll('.graph-eq').length<2)document.getElementById('graph-add').click();await new Promise(r=>setTimeout(r,100));set(1,'y = -2x + 9');})()`);await wait(700);
  const at=(x,y)=>page.eval(`(()=>{const n=[...document.querySelectorAll('#graph-svg .special')].find(n=>Number(n.dataset.x)===${x}&&Number(n.dataset.y)===${y});const r=n.querySelector('circle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  const from=await graphRect('#graph-svg .tracer circle'),root=await at(3.5,0),cross=await at(4,1);
  await drag(from,root,30);await wait(300);await drag(root,cross,20);await wait(500);
  const text=await readout();if(!/\(x, y\) = \(4, 1\)/.test(text))throw Error('stuck at: '+text.slice(0,60));
 });
 await check('graph: a system of two lines is solved where they cross',async()=>{
  await openGraph();await page.eval(`(()=>{const s=document.getElementById('graph-examples');s.value='2';s.dispatchEvent(new Event('change'));document.getElementById('graph-solve').click();})()`);await wait(800);
  const text=await readout();if(!/\(3, 2\) solves every equation/.test(text))throw Error(text.slice(0,200));
 });
 await check('graph (advanced): the area sweep gathers card strips and compares with the exact integral',async()=>{
  await openGraph();await page.eval(`(()=>{const t=document.getElementById('graph-area-toggle');t.checked=true;t.dispatchEvent(new Event('change'));const b=document.getElementById('area-b');b.value='4';b.dispatchEvent(new Event('change'));const d=document.getElementById('area-dx');d.value='1/2';d.dispatchEvent(new Event('change'));document.getElementById('area-sweep').click();})()`);
  for(let t=0;t<9000&&!/Exact area/.test(await page.eval(`document.getElementById('area-result').innerText`));t+=250)await wait(250);
  const text=await page.eval(`document.getElementById('area-result').innerText`);if(!/Strips add up to\s+−8\.5/.test(text)||!/−20\/3/.test(text))throw Error(text);
  expect(await page.eval(`!!document.querySelector('#graph-svg .exact-mark')`),true,'exact integral marked on the gathered stack');
 });
 // A crossing lesson's worked example, then the learner's turn: drag the point to the crossing.
 const crossingTurn=async(title='Solve a system by graphing')=>{
  await page.eval(`document.getElementById('open-tutor').click()`);await page.eval(`[...document.querySelectorAll('#lessons button')].find(b=>b.textContent.includes(${JSON.stringify(title)})).click()`);await wait(1200);
  await page.eval(`document.getElementById('tutor-step').click()`);await wait(600);await page.eval(`document.getElementById('tutor-turn').click()`);await wait(900);
  const from=await graphRect('#graph-svg .tracer circle'),box=await page.eval(`(()=>{const r=document.getElementById('graph-svg').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  if(!(from.x>box.x&&from.x<box.x+box.w&&from.y>box.y&&from.y<box.y+box.h))throw Error(`the point starts off the graph at (${Math.round(from.x)}, ${Math.round(from.y)})`);
  if(!(await page.eval(`!!document.querySelector('#graph-svg .special.solution')`)))throw Error('the crossing is off the graph');
  await drag(from,await graphRect('#graph-svg .special.solution circle'),40);await wait(500);
  return page.eval(`document.getElementById('tutor-prompt').textContent`);
 };
 await check('tutor graph lesson: example, then the learner drags to the crossing',async()=>{
  const text=await crossingTurn();if(!/^Found it/.test(text))throw Error(text);
 });
 await check('tutor graph lesson: crowded points (a crossing between intercepts) still start the point on the graph',async()=>{
  // The draw that failed on 2026-10-22: the clear whole numbers ran off the graph, and the point started below it.
  await page.eval(`import('./src/mvc/tutor.js').then(m=>{m.lessons.find(l=>l.id==='graph-system').make=()=>['y = -3x - 5','y = 3x + 13'];})`);
  const text=await crossingTurn();if(!/^Found it: \(−3, 4\)/.test(text))throw Error(text);
 });
 // 5x + 9 = x + 33 on a phone: the frame once sampled the steep line out to the shallow line's intercept at −33, and the crossing at (6, 39) fell off the graph.
 for(const [w,h] of [[390,844],[844,390]])await check(`tutor graph lesson: graph both sides keeps the crossing on the graph past a far intercept (${w}×${h})`,async()=>{
  await page.eval(`import('./src/mvc/tutor.js').then(m=>{m.lessons.find(l=>l.id==='graph-both-sides').make=()=>['5x + 9 = x + 33'];})`);
  const text=await crossingTurn('Graph both sides');if(!/^Found it: \(6, 39\)/.test(text))throw Error(text);
 },{width:w,height:h});
 await check('style: the cyber look restyles cards, stacks and the graph live, and switches back',async()=>{
  await load('345 - 1208 = 2x');
  const pick=style=>page.eval(`(()=>{const s=document.getElementById('style');s.value='${style}';s.dispatchEvent(new Event('change'));})()`);
  await pick('cyber');await wait(1200);
  expect(await page.eval(`document.documentElement.dataset.style`),'cyber','root style');
  expect(await page.eval(`getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim()`),'#36e6ff','cyber tokens apply');
  expect(await page.eval(`!document.querySelector('#equation-svg .texture-defs image')&&!!document.querySelector('#equation-svg .texture-defs linearGradient#blue')`),true,'flat glass faces replace the paper textures');
  expect(await page.eval(`[...document.querySelectorAll('#equation-svg .stack-defs > g')].length>0&&[...document.querySelectorAll('#equation-svg .stack-defs > g')].every(g=>g.querySelector('image')||!g.innerHTML.includes('#191a16'))`),true,'stacks redrawn in neon');
  expect(await page.eval(`localStorage.getItem('abacus-style')`),'cyber','the choice is remembered');
  await openGraph();expect(await page.eval(`!!document.querySelector('#graph-svg defs linearGradient#g-blue')&&document.querySelector('#graph-svg .graph-curve').getAttribute('stroke')`),'#36e6ff','graph faces and curves');
  await pick('sketchpad');await wait(600);
  expect(await page.eval(`!!document.querySelector('#graph-svg defs pattern#g-blue image')&&document.querySelector('#graph-svg .graph-curve').getAttribute('stroke')`),'#2f5d6b','graph back to paper');
 });
 await check('number bases: binary carries card by card, balanced ternary needs no minus sign, base e runs on, and lessons count in tens',async()=>{
  const base=id=>page.eval(`(()=>{const s=document.getElementById('numerals');s.value='${id}';s.dispatchEvent(new Event('change'));})()`);
  await base('binary');await load('13 + 9');expect(await page.eval(`document.getElementById('base-cycle').textContent`),'2','base button');
  expect(await page.eval(`[...document.querySelectorAll('#equation-svg .numeral')].map(n=>n.textContent).join('')`),'11011001','13 and 9 in binary trays');
  await page.eval(`document.getElementById('combine').click()`);
  let carried=false;for(let t=0;t<40&&!carried;t++){carried=await page.eval(`document.querySelector('#equation-svg .unit-animation')?.dataset.phase==='carry'`);await wait(50);}
  if(!carried)throw Error('no binary carry was animated');
  await idle();expect(await status(),'22 = 10110₂','13 + 9 in base 2');
  await base('ternary');await load('x - 5 = 13');
  expect(await page.eval(`(()=>{const five=document.querySelector('#equation-svg .term[data-index="1"]');return [...five.querySelectorAll(':scope > text')].map(t=>t.textContent).join('')+'|'+five.querySelectorAll('.numeral-bar').length;})()`),'+|1','−5 is + T11, its 9s digit barred');
  for(let i=0;i<3&&!/Solved/.test(await status());i++){await page.eval(`document.getElementById('solve').click()`);await idle();}
  expect(await status(),'Solved: x = 18 = 1T00 bal₃','solved in balanced ternary');
  await base('e');await load('30');const [thirty]=await terms();
  await page.mouse('mouseMoved',thirty.x,thirty.y,{buttons:0});await page.mouse('mousePressed',thirty.x,thirty.y);await wait(750);const peek=await page.eval(`document.getElementById('peek').innerText`);await page.mouse('mouseReleased',thirty.x,thirty.y);
  if(!/30 = 1102\.11…ₑ/.test(peek)||!/e³/.test(peek)||!/run on/.test(peek))throw Error('base e peek: '+peek);
  expect(await page.eval(`!!document.querySelector('#equation-svg .digit-ellipsis')`),true,'ellipsis after the last tray');
  await page.eval(`document.getElementById('open-tutor').click()`);await page.eval(`document.querySelector('#lessons button').click()`);await wait(500);
  expect(await page.eval(`document.getElementById('numerals').value`),'decimal','a lesson counts in tens');
  await page.eval(`document.getElementById('tutor-close').click()`);await wait(200);
  expect(await page.eval(`document.getElementById('numerals').value`),'e','leaving the lesson gives the base back');
 });
 await check('prime components: a long press shows the marble fingerprint, and Numbers pulls it apart into the whole volume',async()=>{
  await load('360 + 1');const [three60]=await terms();
  await page.mouse('mouseMoved',three60.x,three60.y,{buttons:0});await page.mouse('mousePressed',three60.x,three60.y);await wait(750);
  const peek=await page.eval(`(()=>({svg:!!document.querySelector('#peek .peek-fingerprint svg'),text:document.querySelector('#peek .peek-fingerprint p')?.textContent}))()`);await page.mouse('mouseReleased',three60.x,three60.y);
  expect(peek.text,'360 = 2³ · 3² · 5: composite','peek names the prime components');expect(peek.svg,true,'peek draws the fingerprint');
  await page.eval(`document.getElementById('open-numbers').click()`);await wait(900);
  expect(await page.eval(`document.getElementById('numbers-n').value`),'360','opens on the biggest whole number in the equation');
  expect(await page.eval(`document.querySelectorAll('#numbers-panel .base-row .card-row').length`),4,'the number as cards in every base');
  const count=()=>page.eval(`document.querySelectorAll('#numbers-stage .fp-marbles circle').length`);
  expect(await count(),1+2+3+5,'packed: the badge and a container per prime');
  const box=await page.eval(`(()=>{const r=document.getElementById('numbers-stage').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  await page.drag({x:box.x+box.w*.2,y:box.y+box.h/2},{x:box.x+box.w*.95,y:box.y+box.h/2},{steps:25});await wait(200);
  if(!(await page.eval(`Number(document.getElementById('numbers-phase').value)`)>.5))throw Error('a drag to the right pulls the fingerprint apart');
  await page.eval(`(()=>{const r=document.getElementById('numbers-phase');r.value=1;r.dispatchEvent(new Event('input'));})()`);await wait(100);
  expect(await count(),1+360,'pulled apart: all 360 marbles');
  await page.eval(`document.getElementById('numbers-to-cards').click()`);await wait(400);
  expect(await page.eval(`document.getElementById('numbers-mode').hidden`),true,'back to the cards');expect(await status(),'360','the number is on the cards');
 });
 await check('graph: dragging the point stays at frame rate',async()=>{
  await openGraph();const from=await graphRect('#graph-svg .tracer circle');
  await page.eval(`window.__frames=[];(function f(t){window.__frames.push(t);if(window.__frames.length<300)requestAnimationFrame(f);})(performance.now())`);
  await drag(from,{x:from.x+220,y:from.y-120},60);
  const ms=await page.eval(`(()=>{const f=window.__frames,d=f.slice(1).map((t,i)=>t-f[i]).sort((a,b)=>a-b);return d[Math.floor(d.length*.9)];})()`);
  const budget=Number(process.env.FRAME_BUDGET_MS||34);if(ms>budget)throw Error(`p90 frame ${ms.toFixed(1)} ms exceeds ${budget} ms`);
 });
 // ---------- machine mode (design 6.9) ----------
 const MACHINE='/?examples=written&automation&machine';
 async function mcheck(name,fn,viewport,{path=MACHINE}={}){await check(name,async()=>{if(/[?&]machine/.test(path))await ready();await fn();},viewport,path);}
 // The machine loads on first use: wait for its automation hook.
 const ready=async()=>{for(let t=0;t<10000;t+=50){if(await page.eval(`!!window.__machine`))return;await wait(50);}throw Error('the machine did not open');};
 const reopen=async()=>{await page.goto(origin+MACHINE);await ready();await wait(300);};
 const mstate=()=>page.eval(`window.__machine.state()`);
 const until=async(pred,what,limit=25000)=>{for(let t=0;t<limit;t+=100){const s=await mstate();if(pred(s))return s;await wait(100);}throw Error(`timed out waiting for ${what}: ${JSON.stringify(await mstate())}`);};
 const KEYS={Enter:['Enter',13,'\r'],ArrowLeft:['ArrowLeft',37],ArrowRight:['ArrowRight',39],Tab:['Tab',9],Escape:['Escape',27],'[':['BracketLeft',219,'['],']':['BracketRight',221,']'],a:['KeyA',65,'a'],t:['KeyT',84,'t']};
 const press=async key=>{const [code,vk,text]=KEYS[key];await page.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,...(text?{text}:{})});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});};
 const box=sel=>page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`);
 const click=async sel=>{const p=await box(sel);if(!p)throw Error(`no ${sel}`);await page.mouse('mouseMoved',p.x,p.y,{buttons:0});await page.mouse('mousePressed',p.x,p.y);await page.mouse('mouseReleased',p.x,p.y);};
 const active=()=>page.eval(`document.activeElement?.id||document.activeElement?.tagName`);
 const mload=params=>page.eval(`window.__machine.load(${JSON.stringify(params)})`);
 const raise=async()=>{const p=await box('#machine-palette');await page.mouse('mouseMoved',p.x,p.y+p.h/2-6,{buttons:0});await wait(700);};
 // Phones: a touch screen, so (pointer: coarse) and no hover.
 const touch=async()=>{await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await page.send('Emulation.setEmulatedMedia',{features:[{name:'pointer',value:'coarse'},{name:'hover',value:'none'}]}).catch(()=>{});};
 const golden=['7 = 4 + 3, so 16 × 7 = 16 × 4 + 16 × 3.','16 × 4: 2 dark bulbs slide under 16; it rises 2 levels. 64.','64 rides up.','3 = 2 + 1, so 16 × 3 = 16 × 2 + 16 × 1.','16 × 2: 1 dark bulb slides under 16; it rises 1 level. 32.','32 rides up.','16 × 1: the 1 dissolves; 16 stays put.','16 rides up.','32 + 16: nothing carries. 48.','48 rides up.','64 + 48: nothing carries. 112.','112 rides up into the triangle.'];
 // Every bulb that moves in a beat, placed by the layout and eased as the renderer does
 // (6.3), mapped to the screen through the stage's own transform: is it on the stage and
 // at least 18 px across at each sampled u?
 const movers=us=>page.eval(`(async()=>{
  const {layoutPlan}=await import('/src/machine/layout.js'),{snapshotAt}=await import('/src/machine/scene.js');
  const plan=window.__machine.plan(),L=layoutPlan(plan),svg=document.getElementById('machine-svg');
  const ease=u=>1-(1-u)**2,frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const at=(scene,b)=>{const t=scene.towers[b.t];if(!t)return null;const p=L.place(t.at,b.slot);return {x:p.x,y:p.y-(t.form==='coin'?6:84)*b.l,tower:t.form!=='coin'};};
  const out=[];
  for(let i=0;i<plan.beats.length;i++){
   const a=snapshotAt(plan,i),b=snapshotAt(plan,i+1),m=plan.beats[i].motion||{},moving=[];
   for(const id of new Set([...Object.keys(a.bulbs),...Object.keys(b.bulbs)])){
    const A=a.bulbs[id],B=b.bulbs[id];let p0=null,p1=null;
    if(A&&B){p0=at(a,A);p1=at(b,B);}else if(A&&m[id]?.to){p0=at(a,A);p1=at(b,m[id].to);}else if(B&&m[id]?.from){p0=at(a,m[id].from);p1=at(b,B);}
    if(p0&&p1&&(p0.tower||p1.tower)&&Math.hypot(p1.x-p0.x,p1.y-p0.y)>=1)moving.push([id,p0,p1]);
   }
   if(!moving.length)continue;
   const seen=new Map(moving.map(([id])=>[id,0])),fails=[];
   for(const u of ${JSON.stringify(us)}){
    window.__machine.seek(i+u);await frame();
    // the stage grows on phones once a run is under way (the palette folds away)
    const c=svg.getScreenCTM(),px=74*Math.hypot(c.a,c.b),stage=document.getElementById('machine-stage').getBoundingClientRect();
    for(const [id,p0,p1] of moving){const k=ease(u),x=p0.x+(p1.x-p0.x)*k,y=p0.y+(p1.y-p0.y)*k,sx=c.a*x+c.c*y+c.e,sy=c.b*x+c.d*y+c.f;
     if(px>=18&&sx>=stage.left&&sx<=stage.right&&sy>=stage.top&&sy<=stage.bottom)seen.set(id,seen.get(id)+1);else fails.push({id,u,px:Math.round(px*10)/10,x:Math.round(sx),y:Math.round(sy)});}
   }
   out.push({i,kind:plan.beats[i].kind,moving:moving.length,least:Math.min(...seen.values()),fails:fails.slice(0,3)});
  }
  return out;})()`);
 await mcheck('machine 1: opens from the header with × under IO and [16,7] focused; Enter with AUTO on gives [112]',async()=>{
  await click('#open-machine');await ready();await wait(300);
  expect(await page.eval(`document.getElementById('open-machine').getAttribute('aria-pressed')`),'true','header button pressed');
  expect(JSON.stringify(await page.eval(`window.__machine.plan().tree`)),JSON.stringify({n1:{op:'mul',parent:'io',socket:'C'}}),'a × block hangs under IO');
  expect(await page.eval(`(()=>{const i=document.getElementById('machine-input');return [i.value,document.activeElement===i,i.selectionStart===0&&i.selectionEnd===i.value.length].join('|');})()`),'[16,7]|true|true','Input holds [16,7], focused and selected');
  expect((await mstate()).auto,true,'AUTO defaults to on');
  await mload({sp:.25});await page.eval(`document.getElementById('machine-input').focus()`);
  await press('Enter');await until(s=>s.output==='[112]','Output [112]');
  expect(await page.eval(`document.getElementById('machine-output').textContent`),'[112]','Output text');
 },undefined,{path:'/?examples=written&automation'});
 await mcheck('machine 2: AUTO off, 16 Enters in Input play beats 0–15 with the golden captions; Enter mid-run finishes the beat; ← goes back',async()=>{
  const captions=[];
  for(let k=0;k<16;k++){await press('Enter');await wait(60);const s=await until(s=>!s.playing,`beat ${k}`,4000);expect(s.beat,k,`Enter ${k+1} plays beat ${k}`);captions.push(s.caption);}
  expect(await active(),'machine-input','focus stayed in Input');
  expect(JSON.stringify(captions.slice(3,15)),JSON.stringify(golden),'captions of beats 3–14');
  expect((await mstate()).output,'[112]','Output');
  await mload({auto:1,sp:1});await page.eval(`document.getElementById('machine-input').focus()`);
  await press('Enter');await wait(1400);const mid=await mstate();await press('Enter');await wait(50);const after=await mstate();
  if(!(mid.t>1&&mid.t<2)||!(after.t>=2)||after.beat<2||!after.playing)throw Error(`mid-run Enter: ${JSON.stringify({mid,after})}`);
  await mload({auto:0,sp:.25});await page.eval(`document.getElementById('machine-input').focus()`);
  for(let k=0;k<3;k++){await press('Enter');await wait(60);await until(s=>!s.playing,'beat',3000);}
  await page.eval(`document.getElementById('machine-stage').focus()`);await press('ArrowLeft');await wait(100);
  expect((await mstate()).t,2,'← on the stage goes back one beat');
 },undefined,{path:MACHINE+'&auto=0&sp=0.25'});
 await mcheck('machine 3: typing [, a, t and ] in Input fires no shortcut; >> in the expression field is refused',async()=>{
  const before=await mstate();await page.eval(`(()=>{const i=document.getElementById('machine-input');i.focus();i.value='';})()`);
  for(const k of ['[','a','t',']'])await press(k);await wait(150);
  const after=await mstate();
  expect(await page.eval(`document.getElementById('machine-input').value`),'[at]','the keys were typed');
  expect(JSON.stringify([after.auto,after.sp,after.t]),JSON.stringify([before.auto,before.sp,before.t]),'AUTO, speed and time unchanged');
  await page.eval(`document.getElementById('machine-expr').focus()`);await page.send('Input.insertText',{text:'12>>1'});await press('Enter');await wait(200);
  const text=await page.eval(`document.getElementById('machine-status').textContent`);
  if(!/truncates toward zero/.test(text))throw Error('status: '+text);
 });
 await mcheck('machine 4: the ternary switch plays [5,−4] → [−20]',async()=>{
  await click('#machine-base [data-base=ternary]');await wait(200);expect((await mstate()).base,'ternary','base');
  await mload({sp:.25,input:'[5,-4]'});await page.eval(`document.getElementById('machine-input').focus()`);await press('Enter');
  await until(s=>s.output==='[−20]','Output [−20]');
 });
 await mcheck('machine 4e: the base-e switch lazy-loads e-base.js and plays MEASURE 3',async()=>{
  expect(await page.eval(`performance.getEntriesByType('resource').some(r=>r.name.includes('e-base.js'))`),false,'e-base.js not loaded at start');
  await click('#machine-base [data-base=e]');await wait(600);
  expect(await page.eval(`performance.getEntriesByType('resource').some(r=>r.name.includes('e-base.js'))`),true,'e-base.js loaded on first use');
  await mload({op:'measure',input:'3',sp:.25,auto:1});await page.eval(`document.getElementById('machine-input').focus()`);await press('Enter');
  await until(s=>s.output==='[3]','Output [3]');
 });
 await mcheck('machine 5: tap-to-attach and drag-to-attach; an edit after OUTPUT rewinds and shows the full tree',async()=>{
  await mload({tree:{}});await wait(200);
  await click('#machine-svg [data-socket=io]');await raise();
  await click('#machine-palette [data-op=add]');await wait(200);
  const tree=await page.eval(`window.__machine.plan().tree`),root=Object.keys(tree).find(k=>tree[k].parent==='io');
  expect(tree[root]?.op,'add','tapped ADD hangs under the triangle');
  await raise();await wait(100);
  const from=await box('#machine-palette [data-op=mul]'),to=await box(`#machine-svg [data-socket="${root}.R"]`);
  await page.drag(from,to,{steps:25});await wait(300);
  const t2=await page.eval(`window.__machine.plan().tree`),mul=Object.keys(t2).find(k=>t2[k].op==='mul');
  expect(mul&&`${t2[mul].parent}.${t2[mul].socket}`,`${root}.R`,'dragged MULT hangs in the right socket');
  await mload({op:'mul',input:'[16,7]',sp:.25,auto:1});await page.eval(`document.getElementById('machine-input').focus()`);await press('Enter');await until(s=>s.output==='[112]','Output');
  await click('#machine-svg [data-socket="n1.L"]');await wait(100);await page.eval(`document.querySelector('#machine-palette [data-op=add]').click()`);await wait(300);
  expect((await mstate()).t,0,'rewound to beat 0');
  expect(await page.eval(`document.querySelectorAll('#machine-svg [data-node]').length`),2,'both blocks are back on the stage');
 });
 await mcheck('machine 5t: on touch a sideways swipe scrolls the palette and starts no drag',async()=>{
  await touch();await reopen();
  const p=await box('#machine-palette'),before=await page.eval(`JSON.stringify(window.__machine.plan().tree)`);
  const pt=x=>[{x,y:p.y}];await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pt(p.x+p.w*.35)});
  for(let k=1;k<=12;k++){await page.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pt(p.x+p.w*.35-k*14)});await wait(16);}
  await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(400);
  if(!(await page.eval(`document.getElementById('machine-palette').scrollLeft`)>0))throw Error('the palette did not scroll');
  expect(await page.eval(`!document.querySelector('.machine-ghost')&&JSON.stringify(window.__machine.plan().tree)`),before,'no drag, no new block');
 },{width:390,height:844});
 for(const [w,h] of [[390,844],[844,390]]){
  await mcheck(`machine 6: phone ${w}×${h}: stage focused, palette reachable, every moving bulb on screen and ≥ 18 px`,async()=>{
   await touch();await reopen();
   expect(await active(),'machine-stage','the stage has focus, no input');
   const pal=await box('#machine-palette [data-op=add]');if(!pal||pal.w<30||pal.y>h||pal.y<0)throw Error('palette not reachable: '+JSON.stringify(pal));
   // The camera frames below the HUD (view.inset): at the opening nothing is drawn under it.
   const under=await page.eval(`(()=>{const h=document.getElementById('machine-hud').getBoundingClientRect();return [...document.querySelectorAll('#machine-svg .m-scene use,#machine-svg .m-scene text,#machine-svg .m-scene rect')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.left<h.right&&r.right>h.left&&r.top<h.bottom&&r.bottom>h.top).length;})()`);
   expect(under,0,'bulbs, pills and labels drawn under the HUD at the opening');
   let bad=(await movers([.1,.5,.9])).filter(b=>b.least<3);if(bad.length)throw Error('[16,7]: '+JSON.stringify(bad.slice(0,3)));
   await mload({op:'add',input:'[1048575,1]'});await wait(300);
   bad=(await movers([.1,.3,.5,.7,.9])).filter(b=>b.least<2);if(bad.length)throw Error('[1048575,1]: '+JSON.stringify(bad.slice(0,3)));
  },{width:w,height:h});
 }
 await check('machine 7: from 320 px phones to tablets the six header buttons neither wrap nor overflow, in both styles; Equation keeps its name',async()=>{
  // the widths the first merge overflowed at (View off a landscape phone or an iPad mini), and the design's 360
  for(const w of [320,360,390,482,500,540,701,720,744,768,800,834]){
   await page.send('Emulation.setDeviceMetricsOverride',{width:w,height:w<700?740:1024,deviceScaleFactor:1,mobile:false});
   for(const style of ['sketchpad','cyber']){
    await page.eval(`document.documentElement.dataset.style='${style}'`);await wait(60);
    const r=await page.eval(`(()=>{const h=document.querySelector('header'),b=[...document.querySelectorAll('nav button')].map(x=>x.getBoundingClientRect());return {n:b.length,rows:new Set(b.map(x=>Math.round(x.top))).size,over:h.scrollWidth>h.clientWidth||document.documentElement.scrollWidth>innerWidth||b.some(x=>x.right>innerWidth)};})()`);
    expect(JSON.stringify(r),JSON.stringify({n:6,rows:1,over:false}),`${style} at ${w} px`);
   }
  }
  expect(await page.eval(`document.getElementById('open-equation').getAttribute('aria-label')`),'Equation','the accessible name is never the abbreviation');
 },{width:360,height:740});
 await mcheck('machine 8: emulated reduced motion plays the same beats',async()=>{
  const normal=await page.eval(`JSON.stringify(window.__machine.beats().map(b=>[b.kind,b.caption]))`);
  await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await reopen();
  const s=await mstate();expect(JSON.stringify([s.sp,await page.eval(`document.getElementById('machine-readalong').checked`)]),'[1.5,true]','reduced motion: 1.5 s beats, Read along on');
  expect(await page.eval(`JSON.stringify(window.__machine.beats().map(b=>[b.kind,b.caption]))`),normal,'the same beats');
  expect(await page.eval(`document.getElementById('machine-reduced').checked`),true,'the option shows the system setting');
  await page.eval(`document.getElementById('machine-readalong').click()`);await mload({sp:.25});await page.eval(`document.getElementById('machine-input').focus()`);await press('Enter');
  await until(s=>s.output==='[112]','Output [112]');
  // The option (design 4.9): its defaults follow it, a speed the user chose stays.
  const opt=async()=>{await page.eval(`document.getElementById('machine-reduced').click()`);await wait(100);const s=await mstate();return JSON.stringify([await page.eval(`document.getElementById('machine-reduced').checked`),s.sp,await page.eval(`document.getElementById('machine-readalong').checked`)]);};
  expect(await opt(),'[false,0.25,false]','off: the chosen 0.25 s stays');
  expect(await opt(),'[true,0.25,true]','on again: Read along on, the speed kept');
  await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await reopen();
  expect(JSON.stringify([await page.eval(`document.getElementById('machine-reduced').checked`),(await mstate()).sp]),'[true,1.5]','the choice is remembered over the system setting');
  expect(await opt(),'[false,1,false]','off: back to 1 s beats and no Read along');
 });
 await mcheck('machine 9: switching style mid-run works, and digit glyphs are light on the cyber stage',async()=>{
  await mload({sp:.5});await page.eval(`document.getElementById('machine-input').focus()`);await press('Enter');await wait(1500);
  await page.eval(`(()=>{const s=document.getElementById('style');s.value='cyber';s.dispatchEvent(new Event('change'));})()`);await wait(400);
  const mid=await mstate();if(!mid.playing||mid.t<2)throw Error('the run stopped: '+JSON.stringify(mid));
  await until(s=>s.output==='[112]','Output after the switch');
  await page.eval(`document.getElementById('machine-digits').click()`);await page.eval(`window.__machine.seek(3)`);await wait(300);
  const r=await page.eval(`(async()=>{const {ink}=await import('/src/mvc/theme.js');const texts=[...document.querySelectorAll('#machine-svg .m-scene text')].map(t=>(t.getAttribute('fill')||getComputedStyle(t).fill).toLowerCase());return {glyph:ink.machine?.glyph?.toLowerCase(),light:texts.filter(f=>f===ink.machine?.glyph?.toLowerCase()).length,dark:texts.filter(f=>f==='#050504').length};})()`);
  if(!r.glyph||!r.light||r.dark)throw Error('digit glyphs: '+JSON.stringify(r));
 });
 await mcheck('machine 10: leaving returns keys to the equation space; a lesson, the equation dialog and Android back close the machine',async()=>{
  await click('#open-machine');await wait(300);expect(await page.eval(`document.body.classList.contains('machine-active')`),false,'the header button closes it');
  await page.eval(`document.activeElement.blur()`);await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'5',code:'Digit5',text:'5',windowsVirtualKeyCode:53});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'5',code:'Digit5',windowsVirtualKeyCode:53});await wait(100);
  expect(await page.eval(`document.getElementById('entry-text').textContent`),'5','keys reach the equation space');
  const opened=async()=>{await page.eval(`window.__native.open('machine')`);await wait(500);expect(await page.eval(`!document.getElementById('machine-mode').hidden`),true,'abacus://open/machine opens it');};
  await opened();await page.eval(`document.getElementById('open-tutor').click()`);await page.eval(`document.querySelector('#lessons button').click()`);await wait(500);
  expect(await page.eval(`document.getElementById('machine-mode').hidden`),true,'a lesson closes it');await page.eval(`document.getElementById('tutor-close').click()`);
  await opened();await page.eval(`document.getElementById('open-equation').click()`);await wait(300);
  expect(await page.eval(`document.getElementById('machine-mode').hidden`),true,'the equation dialog closes it');await page.eval(`document.getElementById('equation-dialog').close()`);
  await opened();expect(await page.eval(`window.__native.back()`),true,'back is handled');await wait(200);
  expect(await page.eval(`document.getElementById('machine-mode').hidden`),true,'Android back closes it');
 });
 await mcheck('machine 11: 9/(3−3) outlines the DIV block, names the zero divisor and shows [—]',async()=>{
  await page.eval(`document.getElementById('machine-expr').focus()`);await page.send('Input.insertText',{text:'9/(3-3)'});await press('Enter');await wait(400);
  expect((await mstate()).output,'[—]','Output');
  if(!/zero/i.test(await page.eval(`document.getElementById('machine-status').textContent`)))throw Error('the status does not name the zero divisor');
  const outlined=await page.eval(`(async()=>{const {ink}=await import('/src/mvc/theme.js');const c=(ink.machine?.error||'').toLowerCase();return !!c&&[...document.querySelectorAll('#machine-svg .m-scene [stroke]')].some(e=>e.getAttribute('stroke').toLowerCase()===c);})()`);
  expect(outlined,true,'a block outlined in machine.error');
  expect(await page.eval(`(()=>{const t=window.__machine.plan().tree;return t[Object.keys(t).find(k=>t[k].parent==='io')].op;})()`),'div','the DIV block is the root');
 });
 await mcheck('machine 12: tapping 16 × 7 in base 2 offers Watch in the machine, which opens it preloaded; To the cards refuses (2³² − 1)²',async()=>{
  await page.eval(`(()=>{const s=document.getElementById('numerals');s.value='binary';s.dispatchEvent(new Event('change'));})()`);await load('16*7');
  const [product]=await terms();await page.mouse('mousePressed',product.x,product.y);await page.mouse('mouseReleased',product.x,product.y);
  for(let t=0;t<30&&await page.eval(`document.getElementById('watch-machine').hidden`);t++)await wait(100);
  expect(await page.eval(`document.getElementById('watch-machine').textContent`),'Watch 16 × 7 in the machine','the button');
  await page.eval(`document.getElementById('watch-machine').click()`);await ready();await wait(300);
  expect(await page.eval(`(()=>{const p=window.__machine.plan();return JSON.stringify([p.base,Object.values(p.tree).map(n=>n.op),p.inputs]);})()`),JSON.stringify(['binary',['mul'],['16','7']]),'preloaded');
  await mload({op:'mul',input:'[4294967295,4294967295]'});await wait(200);
  expect(await page.eval(`(()=>{const b=document.getElementById('machine-to-cards');return b.disabled&&/^Too large for the cards/.test(b.title);})()`),true,'To the cards disabled with its reason');
  await mload({op:'mul',input:'[16,7]'});await page.eval(`document.getElementById('machine-to-cards').click()`);await wait(500);
  expect(await page.eval(`document.getElementById('machine-mode').hidden`),true,'back to the cards');
  if(!/^112\b/.test(await status()))throw Error('cards: '+await status());
  // The machine's expression comes from the exact values, not the card text: thousands
  // commas, and a minus before parentheses (base 2 has no NEG block).
  for(const [input,label,want] of [['1024*3','Watch 1,024 × 3 in the machine',[['mul'],['1024','3']]],['-(4+3)*7','Watch −(4 + 3) × 7 in the machine',[['mul','sub'],['-4','3','7']]]]){
   await load(input);const [term]=await terms();await page.mouse('mousePressed',term.x,term.y);await page.mouse('mouseReleased',term.x,term.y);
   for(let t=0;t<30&&await page.eval(`document.getElementById('watch-machine').hidden`);t++)await wait(100);
   expect(await page.eval(`document.getElementById('watch-machine').textContent`),label,`the button for ${input}`);
   await page.eval(`document.getElementById('watch-machine').click()`);await wait(600);
   expect(await page.eval(`(()=>{const p=window.__machine.plan();return JSON.stringify([p.base,Object.values(p.tree).map(n=>n.op),p.inputs.map(v=>v.replace('−','-'))]);})()`),JSON.stringify(['binary',...want]),`${input} preloaded`);
   expect((await mstate()).error,null,`${input} plans`);
  }
  // a ÷ before the last that leaves a remainder: the machine would pass on only its quotient
  await page.eval(`window.__native.open('equation')`);await wait(300);
  for(const [input,offered] of [['7/2*4',false],['8/2*3',true]]){
   await load(input);const [term]=await terms();await page.mouse('mousePressed',term.x,term.y);await page.mouse('mouseReleased',term.x,term.y);
   for(let t=0;t<15&&await page.eval(`document.getElementById('watch-machine').hidden`);t++)await wait(100);
   expect(await page.eval(`!document.getElementById('watch-machine').hidden`),offered,`Watch for ${input}`);
  }
 },undefined,{path:'/?examples=written&automation'});
 await mcheck('machine 13: the outline is not reachable by Tab while its sheet is closed',async()=>{
  await touch();await reopen();
  const tabbing=async n=>{const seen=[];for(let k=0;k<n;k++){await press('Tab');seen.push(await page.eval(`!!document.activeElement.closest('#machine-outline')`));}return seen.some(Boolean);};
  await page.eval(`document.getElementById('machine-stage').focus()`);
  expect(await tabbing(40),false,'sheet closed: the outline is skipped');
  expect(await page.eval(`document.getElementById('machine-outline').inert`),true,'inert');
  await page.eval(`document.getElementById('machine-steps-toggle').click()`);await page.eval(`document.getElementById('machine-tab-parts').click()`);await wait(100);
  expect(await page.eval(`document.getElementById('machine-outline').inert`),false,'open on Parts: reachable');
  await page.eval(`document.getElementById('machine-tab-parts').focus()`);expect(await tabbing(4),true,'Tab reaches the outline');
  await page.eval(`document.getElementById('machine-tab-parts').focus()`);await press('Escape');await wait(100);
  expect(await page.eval(`JSON.stringify([document.getElementById('machine-side').classList.contains('open'),document.getElementById('machine-mode').hidden,document.activeElement.id])`),JSON.stringify([false,false,'machine-steps-toggle']),'Esc in the sheet closes the sheet, not the mode');
  expect(await page.eval(`document.getElementById('machine-outline').inert`),true,'closed again: inert');
 },{width:390,height:844});
 await mcheck('machine 14: a URL preset keeps its +, and the hook takes the URL names (mbase, machine)',async()=>{
  const shape=()=>page.eval(`(()=>{const p=window.__machine.plan();return JSON.stringify([p.base,Object.values(p.tree).map(n=>n.op),p.inputs.map(v=>v.replace('−','-'))]);})()`);
  expect(await shape(),JSON.stringify(['binary',['mul','add'],['5','3','7']]),'?machine=(5+3)*7');
  expect(JSON.stringify([(await mstate()).error,await page.eval(`document.getElementById('machine-expr').value`)]),JSON.stringify([null,'(5+3)*7']),'planned, the expression shown');
  await mload({mbase:'ternary',machine:'add',input:'[5,-4]'});expect(await shape(),JSON.stringify(['ternary',['add'],['5','-4']]),'load({mbase:ternary, machine:add})');
  await mload({mbase:'e',machine:'measure',input:'3'});expect(await shape(),JSON.stringify(['e',['measure'],['3']]),'load({mbase:e}) awaits e-base.js');
 },undefined,{path:MACHINE+'=(5+3)*7'});
 await mcheck('machine 15: the base radios and the Steps/Parts tabs keep their arrow keys; at 720×500 the Parts outline is reachable',async()=>{
  const at=()=>page.eval(`JSON.stringify([window.__machine.state().t,window.__machine.state().playing,document.activeElement.dataset.base||document.activeElement.id])`);
  await page.eval(`document.querySelector('#machine-base [data-base=binary]').focus()`);await press('ArrowRight');await wait(200);
  expect(await at(),JSON.stringify([0,false,'ternary']),'→ on the radios moves to ±3 and plays nothing');expect((await mstate()).base,'ternary','and selects it');
  await press('ArrowLeft');await wait(200);expect((await mstate()).base,'binary','← moves back to 2');
  await page.eval(`document.getElementById('machine-tab-steps').focus()`);await press('ArrowRight');await wait(150);
  expect(await at(),JSON.stringify([0,false,'machine-tab-parts']),'→ on the tabs moves to Parts and plays nothing');
  expect(await page.eval(`JSON.stringify([document.getElementById('machine-tab-parts').getAttribute('aria-selected'),document.getElementById('machine-parts-panel').hidden,document.getElementById('machine-outline').inert])`),JSON.stringify(['true',false,false]),'Parts shown, its outline reachable (no sheet at 720×500)');
  await press('Tab');await wait(50);expect(await page.eval(`!!document.activeElement.closest('#machine-outline')`),true,'Tab goes into the outline');
  await page.eval(`document.getElementById('machine-stage').focus()`);await press('ArrowRight');await wait(150);expect((await mstate()).beat,0,'→ on the stage still plays beat 0');
 },{width:720,height:500});
 await mcheck('machine 17: blocks hung but not yet planned keep their socket rings apart; a refusal is announced once, by the status',async()=>{
  await mload({tree:{n1:{op:'add',parent:'io',socket:'C'},n3:{op:'sub',parent:'n1',socket:'L'},n2:{op:'mul',parent:'n1',socket:'R'}},input:'[16,7]'});await wait(300);
  for(const s of ['n3.R','n2.L']){
   const p=await box(`#machine-svg .m-scene circle[data-socket="${s}"]`);await page.mouse('mouseMoved',p.x,p.y,{buttons:0});await page.mouse('mousePressed',p.x,p.y);await page.mouse('mouseReleased',p.x,p.y);await wait(150);
   expect(await page.eval(`document.querySelector('#machine-svg .m-hit-socket.selected')?.dataset.socket??null`),s,`a click on ${s}'s centre selects ${s}`);
  }
  expect(await page.eval(`(()=>{const r=[...document.querySelectorAll('#machine-svg .m-scene circle[data-socket^="n3.R"],#machine-svg .m-scene circle[data-socket^="n2.L"]')].map(c=>c.getBoundingClientRect());return r.length===2&&(r[0].right<=r[1].left||r[1].right<=r[0].left);})()`),true,'the two rings do not overlap');
  await page.eval(`document.getElementById('machine-live').textContent='—'`);await page.eval(`document.getElementById('machine-input').focus()`);
  await page.eval(`(()=>{const i=document.getElementById('machine-input');i.value='[1,2,3]';})()`);await press('Enter');await wait(200);
  expect(JSON.stringify([await page.eval(`document.getElementById('machine-status').textContent`),await page.eval(`document.getElementById('machine-live').textContent`)]),JSON.stringify(['This machine takes 4 numbers','—']),'the status (role=status) speaks; the live region does not repeat it');
  await page.eval(`document.getElementById('machine-stage').focus()`);await press('Escape');await wait(200);
  expect(JSON.stringify([await page.eval(`document.getElementById('machine-mode').hidden`),await active()]),JSON.stringify([true,'open-machine']),'Esc on the stage leaves, and focus returns to the header button');
 });
 await mcheck('machine 18: on touch a selected block comes off with Take off; Android back closes the Steps sheet first, and leaving closes it',async()=>{
  await touch();await reopen();
  const p=await box('#machine-svg .m-hit-node[data-node="n1"]');await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await wait(40);await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(200);
  expect(await page.eval(`document.getElementById('machine-remove').hidden`),false,'Take off shows for a selected block');
  await page.eval(`document.getElementById('machine-remove').click()`);await wait(200);
  expect(JSON.stringify([await page.eval(`JSON.stringify(window.__machine.plan().tree)`),await page.eval(`document.getElementById('machine-remove').hidden`)]),JSON.stringify(['{}',true]),'the block is off, and so is the button');
  for(const id of ['machine-step','machine-auto','machine-back','machine-rebuild','machine-pause','machine-steps-toggle','machine-centre']){
   const r=await box('#'+id);if(!r||r.x-r.w/2<0||r.x+r.w/2>390||r.y+r.h/2>844||r.h<43.5)throw Error(`${id} is not a full target on screen: ${JSON.stringify(r)}`);
  }
  await page.eval(`document.getElementById('machine-steps-toggle').click()`);await wait(100);
  expect(await page.eval(`window.__native.back()`),true,'back is handled');await wait(100);
  expect(JSON.stringify([await page.eval(`document.getElementById('machine-side').classList.contains('open')`),await page.eval(`document.getElementById('machine-mode').hidden`)]),'[false,false]','the sheet closed, the machine stays');
  await page.eval(`document.getElementById('machine-steps-toggle').click()`);await wait(100);await page.eval(`window.__native.open('equation')`);await wait(300);
  await page.eval(`window.__native.open('machine')`);await wait(500);
  expect(await page.eval(`document.getElementById('machine-side').classList.contains('open')`),false,'the machine reopens without its sheet');
 },{width:390,height:844});
 await mcheck('machine 16: a long run asks first; Play at 4× plays it at a quarter of the chosen beat length and keeps that length',async()=>{
  await mload({op:'mul',input:'[65535,65535]',pace:'level',sp:2,auto:1});await wait(200);
  const n=(await mstate()).beats;if(!(n>400))throw Error('not a long run: '+n+' beats');
  await page.eval(`document.getElementById('machine-input').focus()`);await press('Enter');await wait(200);
  expect(JSON.stringify([await page.eval(`document.getElementById('machine-ask').hidden`),(await mstate()).playing]),'[false,false]','it asks before it plays');
  await page.eval(`document.getElementById('machine-ask-play').click()`);await wait(100);
  const s=await mstate(),b=await page.eval(`window.__machine.beats()`);
  expect(JSON.stringify([s.sp,s.playing,b[0].end-b[0].start]),'[2,true,0.5]','the chosen 2 s is kept; this run plays at 0.5 s a beat');
  await mload({op:'mul',input:'[16,7]',pace:'together'});
  expect((await page.eval(`window.__machine.beats()`))[0].end,2,'the next machine plays at the chosen 2 s');
 });
 await mcheck('machine 19: a run too big to animate shows its exact answer in Output, by load(), the expression field or Enter',async()=>{
  const shown=()=>page.eval(`[document.getElementById('machine-output').textContent,getComputedStyle(document.querySelector('.machine-result')).display!=='none'].join('|')`),want=`[${5n<<70n}]|true`;
  await mload({machine:'5<<70'});await wait(100);expect(await shown(),want,'after load()');
  await mload({machine:'mul',input:'16,7'});await wait(100);
  await page.eval(`(()=>{const e=document.getElementById('machine-expr');e.focus();e.value='5<<70';})()`);await press('Enter');await wait(200);
  expect(await shown(),want,'after the expression field');
  await mload({op:'shl',input:'[5,3]'});await wait(100);
  await page.eval(`(()=>{const i=document.getElementById('machine-input');i.focus();i.value='[5,70]';})()`);await press('Enter');await wait(200);
  expect(await shown(),want,'after Enter in Input');
  expect(await page.eval(`document.getElementById('machine-status').textContent`),'Too big to animate step by step; here is the exact answer.','the status');
 });
 // Every touch-reachable control in the mode, by what a finger can land on: buttons, selects,
 // option labels, tabs, the Parts outline's rows and anything else with pointer events (the
 // HUD's AUTO bulb, 12 px, is a readout on touch). [name, width, height] of each under 44 px.
 const SMALL_TARGETS=`[...document.querySelectorAll('#machine-mode button,#machine-mode select,#machine-mode .machine-check,#machine-mode [role=tab],#machine-outline [role=treeitem]>span')].filter(e=>e.getClientRects().length&&getComputedStyle(e).pointerEvents!=='none').map(e=>{const r=e.getBoundingClientRect();return [e.id||e.dataset.op||e.dataset.beat||e.textContent.trim().slice(0,14),Math.round(r.width),Math.round(r.height)];}).filter(([,a,b])=>a<43.5||b<43.5)`;
 const setStyle=async style=>{await page.eval(`(()=>{const s=document.getElementById('style');s.value='${style}';s.dispatchEvent(new Event('change'));})()`);await wait(300);};
 // A phone of another size in the same page (touch emulation and media features stay on).
 const resize=async(w,h)=>{await page.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:0,mobile:false});await reopen();};
 // Phones in both orientations and styles: every touch control is a 44 px target (the landscape
 // base switch was 30 px wide; the Parts outline's rows were 24 px and the long run's Play at 4×
 // and Show the answer 30 px), the options are in the Steps sheet, Take off shows inside the
 // visible rail, and the opening of (5 + 3) × 7 shows its root block under the triangle.
 for(const [w,h] of [[390,844],[844,390],[360,640],[667,375]]){
  await mcheck(`machine 20: phone ${w}×${h}, both styles: 44 px targets (outline rows and the long run's ask included), options in the sheet, Take off in view, the root block at the opening`,async()=>{
   await touch();await reopen();
   const small=()=>page.eval(SMALL_TARGETS);
   for(const style of ['sketchpad','cyber']){
    await setStyle(style);
    let bad=await small();if(bad.length)throw Error(`${style}: controls under 44 px: ${JSON.stringify(bad)}`);
    expect(await page.eval(`(()=>{const b=document.getElementById('machine-hud-auto').getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.id!=='machine-hud-auto';})()`),true,`${style}: the HUD's 12 px AUTO bulb is not a touch target`);
    await page.eval(`document.getElementById('machine-steps-toggle').click()`);await wait(200);
    expect(await page.eval(`!!document.querySelector('#machine-side.open .machine-extras #machine-digits')&&getComputedStyle(document.querySelector('.machine-extras')).display`),'flex','the options are in the open sheet');
    bad=await small();if(bad.length)throw Error(`${style}: controls in the sheet under 44 px: ${JSON.stringify(bad)}`);
    await page.eval(`document.querySelector('#machine-side [data-tab=parts]').click()`);await wait(200);
    expect(await page.eval(`document.querySelectorAll('#machine-outline [role=treeitem]>span').length>=4`),true,'the outline lists the triangle, the block and its sockets');
    bad=await small();if(bad.length)throw Error(`${style}: Parts outline rows under 44 px: ${JSON.stringify(bad)}`);
    await page.eval(`document.querySelector('#machine-side [data-tab=steps]').click()`);await wait(100);
    await page.eval(`document.getElementById('machine-sheet-close').click()`);await wait(200);
    // a 441-beat run asks first: Play at 4× and Show the answer
    await mload({op:'mul',input:'[65535,65535]',pace:'level',auto:1});await wait(200);
    await page.eval(`document.getElementById('machine-input').focus()`);await press('Enter');await wait(200);
    expect(await page.eval(`document.getElementById('machine-ask').hidden`),false,`${style}: the long run asks`);
    bad=await small();if(bad.length)throw Error(`${style}: the long run's ask under 44 px: ${JSON.stringify(bad)}`);
    for(const id of ['machine-ask-play','machine-ask-answer']){const r=await box('#'+id);if(!r||r.x-r.w/2<0||r.x+r.w/2>w||r.y-r.h/2<0||r.y+r.h/2>h)throw Error(`${style}: ${id} is off screen: ${JSON.stringify(r)}`);}
    await page.eval(`document.getElementById('machine-ask-answer').click()`);await wait(100);
    await mload({op:'mul',input:'16,7',pace:'together'});await wait(200);
    const p=await box('#machine-svg .m-hit-node[data-node="n1"]');await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await wait(40);await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(200);
    const r=await box('#machine-remove');
    expect(await page.eval(`document.elementFromPoint(${r.x},${r.y})?.id`),'machine-remove','Take off is on screen, not scrolled out of the rail');
    await page.eval(`document.getElementById('machine-remove').click()`);await wait(100);
    await mload({machine:'(5+3)*7'});await wait(300);
    const at=await page.eval(`(()=>{const st=document.getElementById('machine-stage').getBoundingClientRect(),hud=document.getElementById('machine-hud').getBoundingClientRect(),b=document.querySelector('#machine-svg .m-hit-node[data-node="n1"]').getBoundingClientRect();return b.top>=hud.bottom-1&&b.bottom<=st.bottom+1&&b.left>=st.left-1&&b.right<=st.right+1;})()`);
    expect(at,true,`${style}: the root block of (5 + 3) × 7 is on the stage at the opening`);
    await mload({machine:'mul',input:'16,7'});await wait(200);
   }
  },{width:w,height:h});
 }
 // The Steps/Parts sheet on every phone. A landscape phone under 700 px wide matched the
 // portrait query too, whose bottom sheet (left 0, 62vh) made the landscape sheet a 62vh box at
 // the top left, with 25 to 60 px for the list above the options. In landscape the sheet stands
 // at the right, the full height; in portrait at the foot; the Steps list shows three steps
 // whole in at least 150 px, the Parts outline has 150 px, and the options are in the sheet.
 await mcheck('machine 21: the Steps/Parts sheet gives its list a usable height on every phone, landscape under 700 px wide included',async()=>{
  await touch();
  for(const [w,h] of [[667,375],[640,360],[568,320],[844,390],[360,640],[390,844]]){
   await resize(w,h);
   for(const style of ['sketchpad','cyber']){
    await setStyle(style);
    await page.eval(`document.getElementById('machine-steps-toggle').click()`);await wait(200);
    const at=`${w}×${h} ${style}`,landscape=h<=520&&w/h>=1.5;
    const m=await page.eval(`(()=>{const R=s=>{const e=document.querySelector(s);if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,h:r.height};};const panel=R('#machine-steps-panel');return {side:R('#machine-side'),panel,extras:R('#machine-side .machine-extras'),whole:[...document.querySelectorAll('#machine-steps button')].filter(b=>{const r=b.getBoundingClientRect();return r.top>=panel.t-.5&&r.bottom<=panel.b+.5;}).length};})()`);
    if(landscape){if(!(Math.abs(m.side.r-w)<1&&m.side.t<=.5&&m.side.b>=h-.5&&m.side.l>0))throw Error(`${at}: the sheet is not the full height at the right: ${JSON.stringify(m.side)}`);}
    else if(!(Math.abs(m.side.b-h)<1&&m.side.l<=.5))throw Error(`${at}: the sheet is not at the foot: ${JSON.stringify(m.side)}`);
    if(!(m.panel.h>=150&&m.whole>=3))throw Error(`${at}: the Steps list has ${Math.round(m.panel.h)} px and ${m.whole} whole steps`);
    if(!(m.extras&&m.extras.t>=m.side.t-.5&&m.extras.b<=m.side.b+.5))throw Error(`${at}: the options are not in the sheet: ${JSON.stringify(m.extras)}`);
    await page.eval(`document.querySelector('#machine-side [data-tab=parts]').click()`);await wait(150);
    const parts=await page.eval(`document.getElementById('machine-parts-panel').getBoundingClientRect().height`);
    if(!(parts>=150))throw Error(`${at}: the Parts outline has ${Math.round(parts)} px`);
    await page.eval(`document.querySelector('#machine-side [data-tab=steps]').click()`);await page.eval(`document.getElementById('machine-sheet-close').click()`);await wait(150);
   }
  }
 },{width:667,height:375});
 // The long run's ask on every phone: Play at 4× and Show the answer whole on the screen, 44 px
 // tall (in cyber at 568 × 320 they took two rows and Show the answer fell below the screen).
 await mcheck('machine 25: the long run\'s Play at 4× and Show the answer are whole on screen on every phone, both styles',async()=>{
  await touch();
  for(const [w,h] of [[568,320],[640,360],[667,375],[844,390],[360,640],[390,844]]){
   await resize(w,h);
   for(const style of ['sketchpad','cyber']){
    await setStyle(style);
    await mload({op:'mul',input:'[65535,65535]',pace:'level',auto:1});await wait(200);
    await page.eval(`document.getElementById('machine-input').focus()`);await press('Enter');await wait(200);
    for(const id of ['machine-ask-play','machine-ask-answer']){
     const r=await page.eval(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,h:r.height};})()`);
     if(!(r.h>=43.5&&r.l>=0&&r.t>=0&&r.r<=w&&r.b<=h))throw Error(`${w}×${h} ${style}: ${id} at ${JSON.stringify(r)}`);
    }
    await page.eval(`document.getElementById('machine-ask-answer').click()`);await wait(100);
   }
  }
 },{width:568,height:320});
 // The opening on phones: the HUD keeps to one line (at 360 px it took two, and the default
 // [16,7] opened with only the triangle and a wire running off the stage), and the × block
 // stands on the stage below it, in both styles.
 await mcheck('machine 22: every phone opens the default machine with its × block on the stage, under a one-line HUD',async()=>{
  await touch();
  for(const [w,h] of [[360,640],[375,667],[390,844],[412,915],[640,360],[667,375],[844,390]]){
   await resize(w,h);
   for(const style of ['sketchpad','cyber']){
    await setStyle(style);
    const m=await page.eval(`(()=>{const st=document.getElementById('machine-stage').getBoundingClientRect(),hud=document.getElementById('machine-hud').getBoundingClientRect(),b=document.querySelector('#machine-svg .m-hit-node[data-node="n1"]').getBoundingClientRect();return {hud:Math.round(hud.height),on:b.top>=hud.bottom-1&&b.bottom<=st.bottom+1&&b.left>=st.left-1&&b.right<=st.right+1,block:[Math.round(b.top),Math.round(b.bottom)],stage:[Math.round(hud.bottom),Math.round(st.bottom)]};})()`);
    if(m.hud>22)throw Error(`${w}×${h} ${style}: the HUD takes ${m.hud} px (two lines)`);
    if(!m.on)throw Error(`${w}×${h} ${style}: the × block at ${m.block} is not on the stage below the HUD ${m.stage}`);
   }
  }
 },{width:360,height:640});
 // Each visible pill (value or IO) whose rect meets the client box of the stage: is it under
 // the HUD, or cut by the stage's edge? And the drawn size of each pill's value and caption.
 const PILLS=`(()=>{const st=document.getElementById('machine-stage'),s=st.getBoundingClientRect(),c={l:s.left+st.clientLeft,t:s.top+st.clientTop,r:s.left+st.clientLeft+st.clientWidth,b:s.top+st.clientTop+st.clientHeight},hud=document.getElementById('machine-hud').getBoundingClientRect(),out=[];
  for(const g of document.querySelectorAll('#machine-svg g.pill,#machine-svg g.io-pill')){let o=1;for(let e=g;e&&e.id!=='machine-svg';e=e.parentElement)o*=+(e.getAttribute('opacity')??1);if(o<.5)continue;
   for(const tx of g.querySelectorAll('text')){const size=+tx.getAttribute('font-size');if(!tx.textContent||size!==27&&size!==14)continue;
    const r=(size===14?tx:g.querySelector('rect')).getBoundingClientRect(),m=tx.getScreenCTM();if(r.right<=c.l||r.left>=c.r||r.bottom<=c.t||r.top>=c.b)continue;
    out.push({text:tx.textContent,caption:size===14,px:size*Math.hypot(m.a,m.b),hud:!!hud.height&&r.top<hud.bottom-.5&&r.bottom>hud.top&&r.left<hud.right&&r.right>hud.left,cut:r.top<c.t-.5||r.bottom>c.b+.5||r.left<c.l-.5||r.right>c.r+.5});}}
  return {hud:hud.height>0,out};})()`;
 const settle=()=>page.eval('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 // A tall tower that settles whole at the end of its beat (844×390, [255,255] ×) left its pill
 // under the HUD band (32640 after the 255 × 128 shift, the collides' operands at 37 and 38).
 // On a phone the HUD folds away during a run (its readouts are in the rail), so at every beat
 // end each pill on the stage is wholly on it, but for the 16-level 65025's, which with its pill
 // is taller than the stage (design 4.5); at the opening and after the run the HUD is back.
 await mcheck('machine 23: 844×390 [255,255] ×: the HUD folds during a run, and no pill ends a beat under it or off the stage but 65025',async()=>{
  await touch();await reopen();
  for(const style of ['sketchpad','cyber']){
   await setStyle(style);
   await mload({op:'mul',input:'255,255',auto:0});await wait(200);
   const n=(await mstate()).beats,bad=[];
   for(let k=0;k<=n;k++){
    await page.eval(`window.__machine.seek(${k})`);await settle();
    const f=await page.eval(PILLS);
    expect(f.hud,k===0||k===n,`${style}: the HUD shows at boundary ${k}`);
    for(const p of f.out)if(!p.caption&&(p.hud||p.cut)&&p.text!=='65025')bad.push(`${k}: ${p.text} ${p.hud?'under the HUD':'cut by the stage'}`);
   }
   if(bad.length)throw Error(`${style}: ${bad.join('; ')}`);
  }
 },{width:844,height:390});
 // Legibility at 844×390 (design 1.3): at every half beat of [16,7] ×, every value and IO pill
 // wholly on the stage reads at 10 px or more and every INPUT/OUTPUT caption at 8, but the
 // opening's Input pill, boxed in between the input coins and the triangle (its numbers are in
 // the coins' own pills and in Input; docs/verification.md, round 4). 8 of 73 were under 10 px:
 // the 1 over its socket ring, the Input pill as 112 rides up beside it, the 3 at the stage's foot.
 // The opening's INPUT caption drew at 7.9 px: it lies under the first input coin's rim, and grew
 // only about its middle; it grows down from its top now, as it does at the opening on the
 // smaller landscape phones (7.45 px at 640×360 and 667×375). (Sizes are k rounded down to
 // 1/1000: 9.99 px is 10.)
 await mcheck('machine 24: 844×390 [16,7] ×: every pill on the stage reads at 10 px and every caption at 8, but the opening\'s Input pill (640×360, 667×375: the opening\'s captions)',async()=>{
  await touch();
  for(const [w,h] of [[844,390],[640,360],[667,375]]){
   await resize(w,h);
   for(const style of ['sketchpad','cyber']){
    await setStyle(style);
    await mload({op:'mul',input:'16,7',auto:0});await wait(200);
    const n=w===844?(await mstate()).beats:0,bad=[];
    for(let t=0;t<=n;t+=.5){
     await page.eval(`window.__machine.seek(${t})`);await settle();
     for(const p of (await page.eval(PILLS)).out)if(!p.hud&&!p.cut&&(p.caption||w===844)&&p.px<(p.caption?7.95:9.95)&&!(t===0&&p.text==='[16, 7]'))bad.push(`t ${t}: ${p.text} ${p.px.toFixed(2)} px`);
    }
    if(bad.length)throw Error(`${w}×${h} ${style}: ${bad.join('; ')}`);
   }
  }
 },{width:844,height:390});
 // The fold (design 4.5, 4.8): on a phone the HUD folds away during a run, and in portrait the
 // palette strip and the bar's second row with it. The camera jumped with it: at 568×320 the
 // picture dropped 47 px on the first frame of a run and rose 31 px on the frame after it ended
 // (and at 640×360, 667×375 and 844×390); in portrait, where the stage grows, 80 to 110 px. The
 // frame at rest is carried into the run's stage now and eased to the run's own framing: from
 // t = 0 (at rest) to t = 0.0005 (running) and from n − 0.0005 to n no point of the stage moves
 // 2 px on screen, in both styles, on phones, a tablet and a desktop. The run's end is checked
 // where the stage at rest keeps its size from the opening to the end, as it does on every
 // landscape phone: where Output's line, which first appears at t = n, sits under the stage and
 // takes its height (≈ 20 px at 360×640, 375×667 and 1440×900), the camera reframes for the
 // smaller stage, an older jump than the fold's (docs/verification.md).
 const CAMERA=`(()=>{const st=document.getElementById('machine-stage'),s=st.getBoundingClientRect(),m=document.getElementById('machine-svg').getScreenCTM();return {box:{l:s.left+st.clientLeft,t:s.top+st.clientTop,r:s.left+st.clientLeft+st.clientWidth,b:s.top+st.clientTop+st.clientHeight},a:m.a,e:m.e,f:m.f,hud:document.getElementById('machine-hud').getBoundingClientRect().height>0};})()`;
 // how far the machine point under each corner (and the centre) of the stage moves on screen
 const moved=(p,q)=>{const b=p.box;return Math.max(...[[b.l,b.t],[b.r,b.t],[b.l,b.b],[b.r,b.b],[(b.l+b.r)/2,(b.t+b.b)/2]].map(([x,y])=>{const mx=(x-p.e)/p.a,my=(y-p.f)/p.a;return Math.hypot(q.a*mx+q.e-x,q.a*my+q.f-y);}));};
 await mcheck('machine 26: the camera does not jump as a run begins or ends, though the HUD folds (phones in both orientations, a tablet, a desktop; both styles)',async()=>{
  await touch();
  for(const [w,h] of [[568,320],[640,360],[667,375],[844,390],[360,640],[375,667],[390,844],[412,915],[768,1024],[1440,900]]){
   await resize(w,h);
   const phone=w<700||h<=520;
   for(const style of ['sketchpad','cyber']){
    await setStyle(style);
    await mload({op:'mul',input:'16,7',auto:0});await wait(200);
    const n=(await mstate()).beats,at=async t=>{await page.eval(`window.__machine.seek(${t})`);await settle();return page.eval(CAMERA);},where=`${w}×${h} ${style}`;
    const c0=await at(0),c1=await at(.0005);
    expect(c0.hud,true,`${where}: the HUD at rest`);expect(c1.hud,!phone,`${where}: the HUD during the run`);
    if(moved(c0,c1)>2)throw Error(`${where}: the picture jumps ${moved(c0,c1).toFixed(1)} px as the run begins`);
    const c2=await at(n-.0005),c3=await at(n),kept=['l','t','r','b'].every(k=>Math.abs(c3.box[k]-c0.box[k])<.5);
    expect(c3.hud,true,`${where}: the HUD after the run`);
    if(h<=520)expect(kept,true,`${where}: the stage at rest keeps its size from the opening to the end`);
    if(kept&&moved(c2,c3)>2)throw Error(`${where}: the picture jumps ${moved(c2,c3).toFixed(1)} px as the run ends`);
   }
  }
 },{width:568,height:320});
}finally{server.kill();}
for(const [name,error] of results)console.log(`${error?'FAIL':'ok  '} ${name}${error?`\n     ${error}`:''}`);
const failed=results.filter(r=>r[1]).length;
console.log(failed?`${failed} of ${results.length} interaction checks failed.`:`PASS: ${results.length} interaction checks in headless Chrome.`);
process.exitCode=failed?1:0;
