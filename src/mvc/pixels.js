import {scenarios,scenario} from './scenarios.js';
import {renderEquation} from './view.js';
const dataURL=blob=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
const image=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
export async function pixelSuite(record,report) {
 const textures={};for(const id of [2,23,24,25])textures[id]=await dataURL(await(await fetch(`./textures/swf-${id}.jpg`)).blob());
 let count=0,failures=[];await document.fonts.ready;
 for(const [index,spec] of scenarios.entries())for(const orientation of ['horizontal','vertical']) {
  const camera=['front','depth','spread'][index%3],p=spec.command?.5:1,{model,plan}=scenario(spec.id);
  const name=`${spec.id}-${orientation}-${camera}`;
  let svg=renderEquation(model.state,{orientation,camera},plan,p);
  for(const [id,data] of Object.entries(textures))svg=svg.replaceAll(`./textures/swf-${id}.jpg`,data);
  const width=orientation==='horizontal'?1200:390,height=orientation==='horizontal'?600:650;
  svg=svg.replace('<svg ','<svg width="'+width+'" height="'+height+'" ');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#f7f0df';ctx.fillRect(0,0,width,height);
  ctx.drawImage(await image(await dataURL(new Blob([svg],{type:'image/svg+xml'}))),0,0,width,height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  const saved=await fetch(`/__visual/${record?'baseline':'actual'}/${name}.png`,{method:'POST',body:blob});
  if(!saved.ok&&record)throw Error('Use the development server to record pixel baselines.');
  if(!record){
   const response=await fetch(`./pixel-baselines/${name}.png`);if(!response.ok)throw Error('Missing pixel baseline: '+name);
   const expected=document.createElement('canvas');expected.width=width;expected.height=height;const context=expected.getContext('2d',{willReadFrequently:true});context.drawImage(await image(await dataURL(await response.blob())),0,0);
   const a=ctx.getImageData(0,0,width,height).data,b=context.getImageData(0,0,width,height).data;let changed=0;
   for(let i=0;i<a.length;i+=4)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>8)changed++;
   if(changed/(width*height)>.001)failures.push(`${name}: ${(100*changed/(width*height)).toFixed(3)}% pixels changed`);
  }
  report(`${record?'Recording':'Comparing'} PNG ${++count}/${scenarios.length*2}: ${name}`);
 }
 return failures.length?'FAIL\n'+failures.join('\n'):`PASS: ${count} ${record?'pixel baselines recorded':'PNG comparisons'} across portrait, landscape, and all cameras. Actual PNGs are saved locally; no remote upload.`;
}
