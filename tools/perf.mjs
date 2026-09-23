// Frame-time benchmark in headless Chrome with real paint. Usage: npm run perf
// Starts a private server on a free port, animates heavy scenes through the app's
// own surface, and fails when the median frame exceeds the budget.
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
   c.options.camera=camera;c.render();await new Promise(r=>setTimeout(r,500));
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
 if(page.errors.length){console.error('Page errors:\n'+page.errors.join('\n'));failed=true;}
}finally{await page.close();server.kill();}
process.exitCode=failed?1:0;
