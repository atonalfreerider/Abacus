// Minimal headless-Chrome driver over the DevTools protocol (Node 22+ global WebSocket).
// Used by tools/perf.mjs and tools/interaction-tests.mjs; no npm dependencies.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const candidates=[process.env.CHROME,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
export const chromePath=()=>candidates.find(file=>fs.existsSync(file));
export async function launch(url,{width=1280,height=800}={}){
 const binary=chromePath();if(!binary)throw Error('Chrome not found. Set CHROME=/path/to/chrome.');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'abacus-chrome-'));
 const child=spawn(binary,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,`--window-size=${width},${height}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--hide-scrollbars','about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let text='';child.stderr.on('data',chunk=>{text+=chunk;const match=text.match(/ws:\/\/[^\s]+/);if(match)resolve(match[0]);});child.on('exit',()=>reject(Error('Chrome exited: '+text)));setTimeout(()=>reject(Error('Chrome did not start')),15000);});
 const port=new URL(endpoint).port;
 const target=await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'})).json();
 const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;const pending=new Map(),listeners=[];
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(Error(message.error.message)):resolve(message.result);}else for(const listener of listeners)listener(message);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 const errors=[];listeners.push(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));});
 const loaded=()=>new Promise(resolve=>{const listener=m=>{if(m.method==='Page.loadEventFired'){listeners.splice(listeners.indexOf(listener),1);resolve();}};listeners.push(listener);});
 const page={
  send,errors,
  async goto(address){const done=loaded();await send('Page.navigate',{url:address});await done;},
  async eval(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;},
  async mouse(type,x,y,extra={}){await send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,...extra});},
  async drag(from,to,{steps=20,hold=16,shift=false}={}){
   await page.mouse('mouseMoved',from.x,from.y,{buttons:0});await page.mouse('mousePressed',from.x,from.y);
   for(let i=1;i<=steps;i++){const t=i/steps;await page.mouse('mouseMoved',from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t);await new Promise(r=>setTimeout(r,hold));}
   await page.mouse('mouseReleased',to.x,to.y,{modifiers:shift?8:0});
  },
  async screenshot(file){const {data}=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(data,'base64'));},
  async close(){try{socket.close();}catch{}child.kill();await new Promise(r=>setTimeout(r,200));fs.rmSync(profile,{recursive:true,force:true});}
 };
 await page.goto(url);
 return page;
}
