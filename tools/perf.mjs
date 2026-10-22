// Frame-time benchmark in headless Chrome with real paint. Usage: npm run perf
// Starts a private server on a free port, animates heavy scenes through the app's
// own surface (and the Machine's heaviest beats), and fails when the median frame
// exceeds the budget.
import {spawn} from 'node:child_process';
import {launch} from './browser.mjs';
const budget=Number(process.env.FRAME_BUDGET_MS||34);
const server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const origin=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/[\d.:]+/);if(m)resolve(m[0]);});setTimeout(()=>reject(Error('server did not start')),5000);});
const page=await launch(origin+'/');
let failed=false;
try{
 const scenes=JSON.parse(process.argv[2]||'null')||[['7-3=4','combine','front'],['999+1=1000','combine','front'],['999+1=1000','combine','spread'],['987654-123456=864198','combine','front'],['987654-123456=864198','combine','spread'],['23*4','evaluate','front'],['156:12','evaluate','front']];
 const results=await page.eval(`(async()=>{
  await new Promise(r=>setTimeout(r,300));
  const {Controller}=await import('/src/mvc/controller.js');const {Surface}=await import('/src/mvc/surface.js');
  const surface=new Surface(document.getElementById('stage'));const out=[];
  for(const [input,type,camera] of ${JSON.stringify(scenes)}){
   let c;try{c=new Controller({render(state,options,plan,p){surface.draw(state,options,plan,p);}},input);}catch(e){out.push({input,skipped:e.message});continue;}
   c.options.camera=camera;c.render();surface.prewarm(camera);await new Promise(r=>setTimeout(r,900));
   const left=c.model.state.left;
   const command=type==='combine'?{type,id:left[1].id,target:left[0].id}:{type,id:left[0].id};
   try{c.execute(command,performance.now());}catch(e){out.push({input,skipped:e.message});continue;}
   const times=[];
   await new Promise(res=>{function f(now){times.push(now);c.frame(now);if(c.clock.playing)requestAnimationFrame(f);else res();}requestAnimationFrame(f);});
   const d=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
   out.push({input,camera,frames:times.length,medianMs:+d[d.length>>1].toFixed(1),p95Ms:+d[Math.floor(d.length*.95)].toFixed(1)});
  }
  return out;})()`);
 for(const r of results){console.log(r.skipped?`skip ${r.input}: ${r.skipped}`:`${r.medianMs>budget?'SLOW':'ok  '} ${r.input.padEnd(22)} ${r.camera.padEnd(7)} median ${r.medianMs} ms  p95 ${r.p95Ms} ms  (${r.frames} frames)`);if(r.medianMs>budget)failed=true;}
 // The row form of the split in the bulb bases (phase 5): the products with the most rows and
 // carries the equation space offers there, and a long division of many rounds.
 const rowScenes=[['255*255','binary'],['1023*1023','binary'],['9841*9841','ternary'],['1000÷7','ternary'],['1023÷3','binary']];
 const rowResults=await page.eval(`(async()=>{
  const {Controller}=await import('/src/mvc/controller.js'),{Surface}=await import('/src/mvc/surface.js'),{setBase}=await import('/src/mvc/bases.js'),{useRowForm}=await import('/src/mvc/operations.js');
  const [{planMachine},{rowForm}]=await Promise.all([import('/src/machine/plan.js'),import('/src/mvc/row-split.js')]);useRowForm(rowForm(planMachine));
  const surface=new Surface(document.getElementById('stage')),out=[];
  for(const [input,base] of ${JSON.stringify(rowScenes)}){
   setBase(base);const c=new Controller({render(state,options,plan,p){surface.draw(state,options,plan,p);}},input);c.render();await new Promise(r=>setTimeout(r,600));
   c.execute({type:'evaluate',id:c.model.state.left[0].id},performance.now());
   const kind=c.clock.plan.op?.kind,times=[];
   await new Promise(res=>{function f(now){times.push(now);c.frame(now);if(c.clock.playing)requestAnimationFrame(f);else res();}requestAnimationFrame(f);});
   const d=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
   out.push({input,base,kind,frames:times.length,medianMs:+d[d.length>>1].toFixed(1),p95Ms:+d[Math.floor(d.length*.95)].toFixed(1)});
  }
  setBase('decimal');return out;})()`);
 for(const r of rowResults){const slow=r.medianMs>budget||!r.kind?.startsWith('rows-');console.log(`${slow?'SLOW':'ok  '} rows ${r.input.padEnd(12)} ${r.base.padEnd(8)} ${String(r.kind).padEnd(13)} median ${r.medianMs} ms  p95 ${r.p95Ms} ms  (${r.frames} frames)`);if(slow)failed=true;}
 if(page.errors.length){console.error('Page errors:\n'+page.errors.join('\n'));failed=true;}
 // The Machine (design 6.9): the heaviest beat of each scene, played in real time at
 // 1 s per beat in both styles. Median frame ≤ MACHINE_MEDIAN_MS (16.7 ms, one 60 Hz
 // frame, plus 0.3 ms of timer jitter) and p95 ≤ FRAME_BUDGET_MS. A scene that cannot be
 // planned fails.
 const median=Number(process.env.MACHINE_MEDIAN_MS||17);
 // [name, base, preset, the beat kinds to measure (the one with the most bulbs)]
 const moving=['collide','carry','borrow','shift','split','gate','compare','try','judge','prep','descend','addone','flip'];
 const machine=[['(2³² − 1)²: its widest ADD, 64 levels','binary',{op:'mul',input:'[4294967295,4294967295]'},['collide']],['((3²⁰ − 1)/2)²: its widest ADD','ternary',{op:'mul',input:'[1743392200,1743392200]'},['collide']],['(2⁶³ − 1) ÷ 3','binary',{op:'div',input:'[9223372036854775807,3]'},moving],['base-e UNFOLD of 600','e',{op:'measure',input:'[600]'},['unfold']]];
 {
  await page.goto(origin+'/?examples=written&automation&machine');
  for(const style of ['sketchpad','cyber'])for(const [name,base,params,kinds] of machine){
   const r=await page.eval(`(async()=>{
    for(let k=0;k<200&&!window.__machine;k++)await new Promise(r=>setTimeout(r,50));
    const s=document.getElementById('style');s.value='${style}';s.dispatchEvent(new Event('change'));
    const m=window.__machine,r=await m.load(${JSON.stringify({...params,base,auto:0,sp:1})});
    const {snapshotAt}=await import('/src/machine/scene.js'),plan=m.plan();if(!plan.beats.length)return {skipped:m.state().error||'no plan'};
    if(!plan.beats.some(b=>${JSON.stringify(kinds)}.includes(b.kind)))return {skipped:'no beat of the measured kinds'};
    // The heaviest beat of the asked kinds: the most bulbs on stage at its end.
    const kinds=new Set(${JSON.stringify(kinds)});
    let best=-1,most=-1;plan.beats.forEach((b,i)=>{if(!kinds.has(b.kind))return;const n=Object.keys(snapshotAt(plan,i+1).bulbs).length;if(n>most){most=n;best=i;}});
    m.seek(best);await new Promise(r=>setTimeout(r,400));
    const times=[];document.getElementById('machine-step').click();
    await new Promise(res=>{const f=now=>{times.push(now);if(m.state().playing)requestAnimationFrame(f);else res();};requestAnimationFrame(f);});
    const d=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
    return {beat:best,kind:plan.beats[best].kind,bulbs:most,frames:times.length,medianMs:+d[d.length>>1].toFixed(1),p95Ms:+d[Math.floor(d.length*.95)].toFixed(1)};})()`);
   if(r.skipped){console.log(`FAIL machine ${name}: ${r.skipped}`);failed=true;continue;}
   const slow=r.medianMs>median||r.p95Ms>budget;if(slow)failed=true;
   console.log(`${slow?'SLOW':'ok  '} machine ${name.padEnd(38)} ${style.padEnd(9)} beat ${r.beat} ${r.kind} (${r.bulbs} bulbs)  median ${r.medianMs} ms  p95 ${r.p95Ms} ms  (${r.frames} frames)`);
  }
  if(page.errors.length){console.error('Page errors:\n'+page.errors.join('\n'));failed=true;}
 }
}finally{await page.close();server.kill();}
process.exitCode=failed?1:0;
