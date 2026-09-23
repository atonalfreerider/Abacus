// Real-browser interaction checks (headless Chrome): pointer drags through the
// mirror membrane, snapping, springing home, tapping products, keyboard moves and
// the tutor flow. Usage: npm run test:browser
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
 page=await launch(origin+'/',viewport);
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
 await check('dragging stays at frame rate',async()=>{
  await load('987654+123456-555555=x+999');const all=await terms(),card=all[1],m=await mirror();
  await page.eval(`window.__frames=[];(function f(t){window.__frames.push(t);if(window.__frames.length<400)requestAnimationFrame(f);})(performance.now())`);
  await drag(card,{x:m.x+40,y:card.y+30},50);
  const ms=await page.eval(`(()=>{const f=window.__frames,d=f.slice(1).map((t,i)=>t-f[i]).sort((a,b)=>a-b);return d[Math.floor(d.length*.9)];})()`);
  const budget=Number(process.env.FRAME_BUDGET_MS||34);if(ms>budget)throw Error(`p90 frame ${ms.toFixed(1)} ms exceeds ${budget} ms`);
 });
}finally{server.kill();}
for(const [name,error] of results)console.log(`${error?'FAIL':'ok  '} ${name}${error?`\n     ${error}`:''}`);
const failed=results.filter(r=>r[1]).length;
console.log(failed?`${failed} of ${results.length} interaction checks failed.`:`PASS: ${results.length} interaction checks in headless Chrome.`);
process.exitCode=failed?1:0;
