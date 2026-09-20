import {scenarios,scenario} from './scenarios.js';
import {renderEquation,stackGeometry} from './view.js';
import {math} from './model.js';
import {pixelSuite} from './pixels.js';
const $=id=>document.getElementById(id);
for(const [id,record] of [['record-pixels',true],['compare-pixels',false]])$(id).onclick=async()=>{try{$(id).disabled=true;$('report').textContent=await pixelSuite(record,text=>$('report').textContent=text);}catch(e){$('report').textContent='FAIL: '+e.message;}finally{$(id).disabled=false;}};
for(const scene of scenarios){const option=document.createElement('option');option.value=scene.id;option.textContent=scene.id+' · '+scene.input;$('scene').append(option);}
function paint(){const {model,plan}=scenario($('scene').value);$('stage').innerHTML=renderEquation(model.state,{orientation:$('layout').value,camera:$('camera').value},plan,Number($('frame').value));$('snapshot-status').textContent=`${$('scene').value} | ${$('layout').value} | ${$('camera').value} | frame ${$('frame').value} | committed model: ${math.equationText(model.state)}`;}
for(const id of ['scene','layout','camera','frame'])$(id).addEventListener('input',paint);
$('previous').onclick=()=>{$('frame').value=Math.max(0,Number($('frame').value)-.05);paint();};$('next').onclick=()=>{$('frame').value=Math.min(1,Number($('frame').value)+.05);paint();};
$('run').onclick=async()=>{
 let frames=0,failures=[];const start=performance.now();
 for(const spec of scenarios)for(const orientation of ['horizontal','vertical'])for(const camera of ['front','depth','spread'])for(const p of [0,.25,.5,.75,1]) {
  const {model,plan}=scenario(spec.id),before=JSON.stringify(model.state);
  $('stage').innerHTML=renderEquation(model.state,{orientation,camera},plan,p);
  const svg=$('equation-svg'),vb=svg.viewBox.baseVal;
  if(svg.querySelectorAll('.term').length===0||/NaN|undefined/.test(svg.outerHTML))failures.push(`${spec.id}/${orientation}/${camera}/${p}: invalid SVG`);
  for(const term of svg.querySelectorAll('.term')) {const x=Number(term.dataset.x),y=Number(term.dataset.y);if(!Number.isFinite(x+y)||x<0||y<0||x>vb.width||y>vb.height)failures.push(`${spec.id}: invalid term bounds`);}
  if(JSON.stringify(model.state)!==before)failures.push(spec.id+': view mutated model');
  if(stackGeometry(2,camera).dx<=0||stackGeometry(2,camera).dy<=0)failures.push('Wrong stack direction');
  frames++;
  if(frames%25===0){$('report').textContent=`Checking frame ${frames}…`;await new Promise(requestAnimationFrame);}
 }
 $('report').textContent=failures.length?`FAIL: ${failures.join('\n')}`:`PASS: ${frames} frames · ${scenarios.length} scenes · 2 layouts · 3 cameras · 5 timestamps\nNo invalid geometry, missing terms, wrong stack direction, or model mutation.\n${Math.round(performance.now()-start)} ms. Pixel appearance requires screenshot review; these are DOM/geometry assertions.`;
 paint();
};paint();
