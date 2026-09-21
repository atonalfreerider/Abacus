import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stateFile=path.join(root,'.runtime','server.json');
fs.mkdirSync(path.dirname(stateFile),{recursive:true});
async function existing(){
 try{
  const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  if(state.root!==root||!Number.isInteger(state.port)||state.port<1||state.port>65535)return null;
  const response=await fetch('http://127.0.0.1:'+state.port+'/__abacus_launcher',{signal:AbortSignal.timeout(800)});
  const live=await response.json();
  return live.token===state.token&&live.pid===state.pid?state:null;
 }catch{return null;}
}
let state=await existing();
if(process.argv.includes('--stop')){
 if(state){process.kill(state.pid);fs.rmSync(stateFile,{force:true});console.log('Abacus stopped.');}
 else console.log('Abacus is already stopped.');
}else{
 if(!state){
  const log=fs.openSync(path.join(root,'.runtime','server.log'),'a');
  const child=spawn(process.execPath,[path.join(root,'tools','serve.mjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,PORT:'0',ABACUS_LAUNCH_STATE:stateFile,ABACUS_LAUNCH_TOKEN:randomUUID()}});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.unref();fs.closeSync(log);
  for(let attempt=0;attempt<60&&!state;attempt++){await new Promise(resolve=>setTimeout(resolve,100));state=await existing();}
  if(!state)throw Error('Abacus did not start. See .runtime/server.log.');
 }
 const url='http://127.0.0.1:'+state.port+'/';
 console.log('Abacus is ready at '+url);
 if(!process.argv.includes('--no-browser')){
  const opener=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
  const browser=spawn(opener,[url],{detached:true,windowsHide:true,stdio:'ignore'});
  browser.on('error',error=>console.error('Open '+url+' in your browser. '+error.message));
  browser.unref();
 }
}
