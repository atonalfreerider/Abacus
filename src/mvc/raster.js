// Browser-only raster cache for card stacks. A hundred-card stack is one bitmap
// instead of one hundred pattern-filled faces, so animation frames stay cheap to paint.
// drawFace mirrors view.face(); the vector drawing remains the reference and the
// fallback until the textures decode.
import {parseStackId,textureSources,cardEdge,cardRole} from './view.js';
import {ink} from './theme.js';
const SCALE=3,SIZE=43,MARGIN=2;
let images=null;
const loadTextures=()=>images??=Promise.all(textureSources.map(([name,id])=>new Promise((resolve,reject)=>{
 const image=new Image();image.onload=()=>resolve([name,image]);image.onerror=reject;image.src=`./textures/swf-${id}.jpg`;
}))).then(Object.fromEntries);
// A flat colour (cyber) becomes a diagonal glass gradient across this face, as in the SVG.
const paint=(ctx,fill,x,y,size)=>{if(typeof fill!=='string')return fill;const g=ctx.createLinearGradient(x,y,x+size,y+size);g.addColorStop(0,fill+'eb');g.addColorStop(1,fill+'c7');return g;};
function drawFace(ctx,x,y,color,meta,fill,role='top'){
 ctx.beginPath();ctx.roundRect(x,y,SIZE,SIZE,5);
 if(role!=='top'){ctx.fillStyle=cardEdge.paper;ctx.fill();ctx.lineWidth=role==='support'?.45:1.1;ctx.strokeStyle=role==='base'?cardEdge.base:role==='group'?cardEdge.group[color]:ink.edgeLine[color];ctx.stroke();return;}
 if(meta.exponent<0){
  ctx.globalAlpha=.12;ctx.fillStyle=paint(ctx,fill.paper,x,y,SIZE);ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=1;ctx.strokeStyle=ink.stroke[color];ctx.stroke();
  const inner=SIZE*meta.innerScale,inset=(SIZE-inner)/2;ctx.fillStyle=paint(ctx,fill[color],x+inset,y+inset,inner);ctx.fillRect(x+inset,y+inset,inner,inner);return;
 }
 ctx.fillStyle=paint(ctx,fill[color],x,y,SIZE);ctx.fill();ctx.lineWidth=1+meta.group*.55;ctx.strokeStyle=ink.stroke[color];ctx.stroke();
 for(let level=0;level<meta.group;level++){const inset=3+level*3;ctx.beginPath();ctx.roundRect(x+inset,y+inset,SIZE-2*inset,SIZE-2*inset,3);ctx.lineWidth=1.2+meta.group*.55;ctx.strokeStyle=ink.groupStroke[color];ctx.stroke();}
 if(meta.mark){ctx.font='bold 12px Georgia,serif';ctx.textAlign='right';ctx.fillStyle=ink.mark[color];ctx.fillText(meta.mark,x+SIZE-7,y+SIZE-6);}
}
const cache=new Map(),ready=new Map();
// Bitmaps are kept per style, so switching style never shows another style's cards.
const key=id=>`${ink.name}:${id}`;
// Synchronous lookup for stacks that have already been rasterized.
export const rasterReady=id=>ready.get(key(id))||null;
// Rasterize likely stacks during idle time so the first carry does not paint vectors.
export function prewarm(ids){const queue=[...ids];const next=()=>{const id=queue.shift();if(id)rasterStack(id).then(()=>(globalThis.requestIdleCallback||setTimeout)(next));};next();}
export function rasterStack(id){
 if(typeof document==='undefined'||typeof DOMMatrix==='undefined')return Promise.resolve(null);
 const k=key(id),style=ink.name;
 if(!cache.has(k))cache.set(k,(ink.textures?loadTextures():Promise.resolve(null)).then(textures=>{
  const {color,meta}=parseStackId(id),extent=SIZE+meta.cardCount*meta.pitch+2*MARGIN;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=Math.ceil(extent*SCALE);
  const ctx=canvas.getContext('2d');ctx.scale(SCALE,SCALE);ctx.translate(MARGIN,MARGIN);
  if(ink.name!==style){cache.delete(k);return null;}
  const fill={};
  if(textures)for(const [name,image] of Object.entries(textures)){fill[name]=ctx.createPattern(image,'repeat');fill[name].setTransform(new DOMMatrix().scale(150/image.naturalWidth));}
  // Flat styles: drawFace paints each face with its own dark glass gradient.
  else Object.assign(fill,ink.flat);
  for(let layer=meta.cardCount;layer>=1;layer--)drawFace(ctx,layer*meta.pitch,layer*meta.pitch,color,meta,fill,cardRole(layer,meta.cardCount));
  return new Promise(resolve=>canvas.toBlob(resolve,'image/png')).then(blob=>{if(!blob)return null;const image=`<image href="${URL.createObjectURL(blob)}" x="${-MARGIN}" y="${-MARGIN}" width="${canvas.width/SCALE}" height="${canvas.height/SCALE}"/>`;ready.set(k,image);return image;});
 }).catch(()=>null));
 return cache.get(k);
}
