// Real-browser interaction checks (headless Chrome): pointer drags through the
// mirror membrane, snapping, springing home, tapping products, keyboard moves, the
// tutor flow, and graph mode (tracer detents, systems, the area sweep).
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
async function check(name,fn,viewport){
 page=await launch(origin+'/?examples=written',viewport);
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
 await check('tutor graph lesson: example, then the learner drags to the crossing',async()=>{
  await page.eval(`document.getElementById('open-tutor').click()`);await page.eval(`[...document.querySelectorAll('#lessons button')].find(b=>b.textContent.includes('Solve a system by graphing')).click()`);await wait(1200);
  await page.eval(`document.getElementById('tutor-step').click()`);await wait(600);await page.eval(`document.getElementById('tutor-turn').click()`);await wait(900);
  const from=await graphRect('#graph-svg .tracer circle'),to=await graphRect('#graph-svg .special.solution circle');await drag(from,to,40);await wait(500);
  const text=await page.eval(`document.getElementById('tutor-prompt').textContent`);if(!/^Found it/.test(text))throw Error(text);
 });
 await check('graph: dragging the point stays at frame rate',async()=>{
  await openGraph();const from=await graphRect('#graph-svg .tracer circle');
  await page.eval(`window.__frames=[];(function f(t){window.__frames.push(t);if(window.__frames.length<300)requestAnimationFrame(f);})(performance.now())`);
  await drag(from,{x:from.x+220,y:from.y-120},60);
  const ms=await page.eval(`(()=>{const f=window.__frames,d=f.slice(1).map((t,i)=>t-f[i]).sort((a,b)=>a-b);return d[Math.floor(d.length*.9)];})()`);
  const budget=Number(process.env.FRAME_BUDGET_MS||34);if(ms>budget)throw Error(`p90 frame ${ms.toFixed(1)} ms exceeds ${budget} ms`);
 });
}finally{server.kill();}
for(const [name,error] of results)console.log(`${error?'FAIL':'ok  '} ${name}${error?`\n     ${error}`:''}`);
const failed=results.filter(r=>r[1]).length;
console.log(failed?`${failed} of ${results.length} interaction checks failed.`:`PASS: ${results.length} interaction checks in headless Chrome.`);
process.exitCode=failed?1:0;
