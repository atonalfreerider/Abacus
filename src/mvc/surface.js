// Persistent SVG surface. Textures and stack definitions are created once and stay
// decoded; each frame replaces only the scene body. Replacing the whole SVG every
// frame re-decoded the texture patterns (visible flicker) and repainted every face.
import {renderScene,stackIds,stackContent,textureDefs} from './view.js';
import {rasterStack,rasterReady,prewarm} from './raster.js';
const NS='http://www.w3.org/2000/svg';
export class Surface {
 constructor(host){
  host.innerHTML=`<svg xmlns="${NS}" id="equation-svg" font-family="Georgia,serif" role="group"><defs>${textureDefs()}</defs><defs class="stack-defs"></defs><g class="scene-root"></g></svg>`;
  this.svg=host.firstElementChild;this.defs=this.svg.querySelector('.stack-defs');this.root=this.svg.querySelector('.scene-root');this.stacks=new Set();
 }
 prewarm(camera){const ids=[];for(const exponent of [0,1,2,3,4,5,-1,-2])for(const color of ['blue','red','green'])ids.push(`stack-${color}-${String(exponent).replace('-','m')}-${camera}`);prewarm(ids);}
 ensureStack(id){
  if(this.stacks.has(id))return;this.stacks.add(id);
  const group=document.createElementNS(NS,'g');group.id=id;this.defs.append(group);
  const cached=rasterReady(id);group.innerHTML=cached||stackContent(id);
  if(!cached)rasterStack(id).then(image=>{if(image)group.innerHTML=image;});
 }
 draw(equation,options,plan,progress){
  const frame=renderScene(equation,options,plan,progress);
  for(const id of stackIds(frame.body))this.ensureStack(id);
  const svg=this.svg;svg.setAttribute('viewBox',frame.viewBox);svg.dataset.orientation=frame.orientation;svg.dataset.camera=frame.camera;svg.dataset.progress=String(Math.round(progress*1000)/1000);svg.setAttribute('aria-label',frame.label);
  this.root.innerHTML=frame.body;
  return frame;
 }
}
