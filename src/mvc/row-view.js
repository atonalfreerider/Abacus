// The row form of PRIME's split (design 4.6, phase 5): × and ÷ of whole numbers in base 2
// and balanced ternary, drawn in the equation space's own bulbs. Plans come from
// operations.js (the Machine's planner does their arithmetic); these stages only draw them,
// and are reached only outside decimal, so decimal frames never change.
//  * Multiplication: a copy of the multiplicand peels off for each lit bulb of the
//    multiplier and lands in a row of its own, shifted to that bulb's place; the bulb
//    itself flies to the copy's units and dissolves there (× 1), and a red bulb swaps the
//    copy's colours. The rows are then added from the lowest up, as the machine
//    reassembles its split: 16 × 7 = 64 + (32 + 16).
//  * Division: the divisor is shifted under the dividend's top, and each round it is taken
//    away where it fits (base 2) or where that leaves a remainder nearer zero (balanced
//    ternary), lighting that place's quotient bulb, then moves one place right.
import {tray,bulb,commaTriangle,operandOffsets,operationArt,operandTerm,placeSpec,phaseParticles,round,esc} from './view.js';
import {placeOffsetIn,slotAt,baseSpec,isGroupEdge,bases} from './bases.js';
const radixOf=base=>bases[base].radix;
import {ease,clamp} from './animation.js';
import {unitFrame} from './units.js';
import {math} from './model.js';

const lerp=(a,b,q)=>a+(b-a)*q;
const colorOf=sign=>sign<0?'red':'blue';
const boundary=(spec,base)=>spec?-placeOffsetIn(spec.maxPlace,base):0;
const specOf=(value,base)=>baseSpec(math.frac(Number(value)),base);
// Where a bulb of `place` (and rim cell) sits for a row whose units boundary is `anchor`.
const at=(anchor,place,base,scale=1,cell=0)=>{const c=slotAt(cell,base);return {x:anchor.x+(placeOffsetIn(place,base)+c.x)*scale,y:anchor.y+c.y*scale,scale};};
const mix=(a,b,q)=>({x:lerp(a.x,b.x,q),y:lerp(a.y,b.y,q),scale:lerp(a.scale,b.scale,q)});
function lamp(point,color,opacity=1,attributes=''){
 if(opacity<=.001)return '';
 if(Math.abs(point.scale-1)<1e-6)return `<g ${attributes}>${bulb(point.x,point.y,color,opacity)}</g>`;
 return `<g ${attributes} transform="translate(${round(point.x)} ${round(point.y)}) scale(${round(point.scale)})">${bulb(0,0,color,opacity)}</g>`;
}
// A bulb changing colour in flight: the old colour fades out under the new one.
const turning=(point,from,to,q,opacity=1,attributes='')=>from===to?lamp(point,to,opacity,attributes):lamp(point,from,opacity*(1-q),attributes)+lamp(point,to,opacity*q,attributes);
const group=(art,opacity)=>opacity<=.001?'':opacity>=.999?art:`<g opacity="${round(opacity)}">${art}</g>`;
// Empty sockets (with their place values) for places low..high of a row.
function sockets(anchor,low,high,base,camera,scale=1,opacityOf=()=>1){
 let art='';
 for(let p=low;p<=high;p++){
  const opacity=opacityOf(p);if(opacity<=.001)continue;
  const x=anchor.x+placeOffsetIn(p,base)*scale,body=tray(0,'blue',p,camera,'',false,base)+(p<high&&isGroupEdge(p,base)?commaTriangle(-40):'');
  art+=`<g opacity="${round(opacity)}" transform="translate(${round(x)} ${round(anchor.y)})${scale===1?'':` scale(${round(scale)})`}">${body}</g>`;
 }
 return art;
}
const caption=(text,x,y,opacity)=>opacity>.001&&text?`<text class="operation-caption" x="${round(x)}" y="${round(y)}" text-anchor="middle" font-size="36" fill="#3d3a30" opacity="${round(opacity)}">${esc(text)}</text>`:'';
const label=(text,x,y,size,opacity)=>opacity>.001?`<text class="row-label" x="${round(x)}" y="${round(y)}" font-size="${round(size)}" fill="#3d3a30" opacity="${round(opacity)}">${esc(text)}</text>`:'';
const rule=(x0,x1,y,opacity)=>opacity>.001?`<path class="row-rule" d="M${round(x0)} ${round(y)}H${round(x1)}" stroke="#3d3a30" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round" opacity="${round(opacity)}"/>`:'';
const captionAt=(list,time)=>{let text='';for(const c of list)if(time>=c.from)text=c.text;return text;};
// The first two operands only: the chain's later factors are drawn by renderOperation.
const pair=term=>({...term,expr:{operands:term.expr.operands.slice(0,2),ops:term.expr.ops.slice(0,1)}});
// What a factor's bulbs look like where it stands in the term: its magnitude's digits, red
// for a negative base-2 number and per digit in balanced ternary.
function shown(o,base){
 const spec=placeSpec(operandTerm(o),base),out=new Map();
 for(const p of spec?.places||[])if(p.digit)out.set(p.exponent,spec.balanced?colorOf(p.signed):colorOf(o.value.n));
 return {spec,colors:out};
}

export function rowMultiplyStage({op,S,R,slot,time,camera,orientation}){
 const base=op.base,term=S.term,offsets=operandOffsets(term),[oa,ob]=term.expr.operands,n=op.copies.length,units=op.units;
 const dir=orientation==='vertical'&&S.side==='right'?1:-1;
 const A=shown(oa,base),B=shown(ob,base);
 const homeA={x:S.x+offsets[0]+boundary(A.spec,base),y:S.y},homeB={x:S.x+offsets[1]+boundary(B.spec,base),y:S.y};
 const resultSpec=specOf(op.product,base),xu=(R||S).x+boundary(resultSpec,base);
 // Rows: one per copy, top digit first, their units in one column over the answer's.
 const specs=op.copies.map(c=>specOf(c.value,base)),labelSize=34;
 const left=Math.max(160,...specs.map(s=>boundary(s,base))),labelW=Math.max(0,...op.copies.map(c=>c.label.length))*labelSize*.52+40;
 const pitch=140,rawW=left+labelW,rawH=Math.max(1,n)*pitch;
 const scale=Math.min(1,Math.max(1100,S.w+400)/rawW,1100/rawH);
 const rowTop=i=>dir<0?S.y-70-(n-i)*pitch*scale:S.y+200+i*pitch*scale;
 const rowAnchor=i=>({x:xu,y:rowTop(i)});
 const start=i=>.35+i*op.stagger,flight=i=>clamp((time-start(i))/.7);
 // When each copy's last bulb has left its row (cached on the plan: it never changes).
 const done=op.done??=op.copies.map(c=>op.sumStart+Math.max(0,...units.phases.filter(ph=>ph.type==='transfer'&&ph.before.find(t=>t.id===ph.removed[0])?.owner===c.owner).map(ph=>ph.end)));
 const rowOpacity=i=>ease(clamp((time-start(i)-.15)/.4))*(1-clamp((time-done[i])/.3));
 const owner=name=>Number(name.slice(5));
 const resultAnchor={x:slot.x+boundary(resultSpec,base),y:slot.y};
 let art='';
 // The factors stay while their copies peel off, then give way to the answer.
 art+=group(operationArt(pair(term),camera),1-ease(clamp((time-(op.layout-.45))/.45)));
 const lineOpacity=Math.min(1,time/.4)*(1-ease(clamp((time-op.sumStart-units.duration*.5)/.5)));
 if(n)art+=rule(xu-left*scale-20,xu+20,dir<0?S.y-28:S.y+182,lineOpacity);
 op.copies.forEach((c,i)=>{
  const anchor=rowAnchor(i),spec=specs[i];
  art+=sockets(anchor,0,spec.maxPlace,base,camera,scale,p=>rowOpacity(i)*(p<c.k?ease(clamp((time-start(i)-.35)/.35)):1));
  art+=label(c.label,xu+24*scale,anchor.y+(62+12)*scale,labelSize*Math.max(scale,.6),rowOpacity(i));
 });
 const top=Math.max(resultSpec.maxPlace,...units.initial.map(t=>t.place),...units.final.map(t=>t.place));
 art+=sockets(resultAnchor,0,top,base,camera,1,p=>ease(clamp((time-op.sumStart+.35)/.35))*(p<=resultSpec.maxPlace?1:1-ease(clamp((time-op.duration+.6)/.3))));
 // The split: each copy flies from the multiplicand to its row; the multiplier's bulb that
 // made it flies to the copy's units and dissolves there.
 let particles='';
 const pos=token=>token.owner==='result'?at(resultAnchor,token.place,base,1,token.cell):at(rowAnchor(owner(token.owner)),token.place,base,scale,token.cell);
 const draw=(token,point,opacity=1)=>lamp(point,colorOf(token.sign),opacity,`data-unit="${token.id}"`);
 if(time<op.sumStart){
  for(const token of units.initial){
   const i=owner(token.owner),c=op.copies[i],f=flight(i);if(f<=0)continue;
   const from=at(homeA,token.place-c.k,base,1),to=pos(token),e=ease(f);
   particles+=turning(mix(from,to,e),A.colors.get(token.place-c.k)??colorOf(token.sign),colorOf(token.sign),clamp((f-.2)/.6),1,`data-unit="${token.id}"`);
  }
  op.copies.forEach((c,i)=>{
   const f=clamp((time-start(i))/.55),fade=clamp((time-start(i)-.55)/.25);if(f<=0||fade>=1)return;
   const from=at(homeB,c.k,base,1),to=at(rowAnchor(i),c.k,base,scale),p=mix(from,to,ease(f));
   particles+=lamp({...p,scale:p.scale*(1+.25*fade)},B.colors.get(c.k)??'blue',1-ease(fade),'data-lead="'+i+'"');
  });
 } else {
  const frame=unitFrame(units,clamp((time-op.sumStart)/units.duration));
  for(const token of frame.tokens)particles+=draw(token,pos(token));
  for(const {phase,progress} of frame.active.filter(a=>a.phase.type==='transfer')){
   const token=phase.before.find(t=>t.id===phase.removed[0]),next=phase.after.find(t=>t.id===token.id);
   particles+=draw(token,mix(pos(token),pos(next),ease(progress)));
  }
  particles+=phaseParticles(frame.active.filter(a=>a.phase.type!=='transfer'),{pos:token=>({...pos(token),scale:1}),draw:(token,point,opacity=1)=>draw(token,{...point,scale:point.scale??1},opacity),color:t=>colorOf(t.sign),camera,base});
 }
 art+=group(particles,1-clamp((time-(op.duration-.3))/.3));
 const top0=dir<0?rowTop(0)-34:rowTop(n-1)+pitch*scale+56;
 art+=caption(captionAt(op.captions,time),S.x+S.w/2,n?top0:dir<0?S.y-60:S.y+230,ease(clamp((time-.15)/.3))*(1-ease(clamp((time-op.duration+.25)/.25))));
 const x0=Math.min(S.x,xu-left*scale,resultAnchor.x-boundary(resultSpec,base)),x1=Math.max(S.x+S.w,xu+labelW*scale);
 const y0=dir<0?(n?rowTop(0)-90:S.y-110):S.y,y1=dir<0?S.y+170:(n?rowTop(n-1)+pitch*scale+90:S.y+280);
 return {art,bounds:[x0,y0,x1,y1]};
}

// Bulbs of a whole number as row tokens (one per lit place).
const tokensOf=(value,base,owner)=>[...specOf(value,base).places].filter(p=>p.digit).map(p=>({id:`${owner}${p.exponent}`,owner,place:p.exponent,cell:0,sign:p.signed<0||(!specOf(value,base).balanced&&Number(value)<0)?-1:1}));
const topOf=(value,base)=>specOf(value,base).maxPlace;

export function rowDivideStage({op,S,R,slot,time,camera,orientation}){
 const base=op.base,term=S.term,offsets=operandOffsets(term),[,ob]=term.expr.operands,rounds=op.rounds,last=rounds.at(-1);
 const dir=orientation==='vertical'&&S.side==='right'?1:-1,B=shown(ob,base);
 const specA=placeSpec(operandTerm(term.expr.operands[0]),base);
 const homeA={x:S.x+offsets[0]+boundary(specA,base),y:S.y},homeB={x:S.x+offsets[1]+boundary(B.spec,base),y:S.y};
 const xu=homeA.x,gapY=180,rowD={x:xu,y:S.y+dir*gapY},rowQ={x:xu,y:S.y+dir*2*gapY};
 const qSpec=specOf(op.q,base),resultAnchor={x:slot.x+boundary(qSpec,base),y:slot.y};
 const [lift0,lift1]=op.times.lift,[ans0,ans1]=op.times.answer,answer=ease(clamp((time-ans0)/(ans1-ans0)));
 const fadeOut=op.exact?1-answer:1,settle=1-clamp((time-(op.duration-.3))/.3);
 const width=Math.max(topOf(op.a,base),topOf(op.divisor,base),op.K)+1;
 let art='';
 art+=group(operationArt(pair(term),camera),1-ease(clamp(time/.6)));
 // The dividend's row, where the remainder is worked down.
 const working=rounds.find(x=>x.collide&&time>=x.collide[0]&&time<x.collide[1]);
 const rest=[...rounds].reverse().find(x=>x.collide&&time>=x.collide[1])?.after??op.a;
 art+=sockets(homeA,0,Math.max(topOf(op.a,base),0),base,camera,1,()=>ease(clamp(time/.3))*fadeOut);
 // The divisor's row: shifted under the dividend's top, then one place right each round.
 const now=[...rounds].reverse().find(x=>time>=(x.start??Infinity))??rounds[0],k=time<(rounds[0]?.start??Infinity)?op.K:now.k;
 const sliding=now?.descend&&time>=now.descend[0]?ease(clamp((time-now.descend[0])/(now.descend[1]-now.descend[0]))):0;
 const dim=now?.dim&&time>=now.dim[0]&&time<now.dim[1]+.2?Math.sin(Math.PI*clamp((time-now.dim[0])/(now.dim[1]-now.dim[0]+.2))):0;
 const dRow=time<lift0?0:ease(clamp((time-lift0)/(lift1-lift0)))*settle*(1-ease(clamp((time-ans0)/.4)))*(1-.6*dim);
 const divisor=String(BigInt(op.divisor)/BigInt(radixOf(base))**BigInt(op.K-k));
 const dPlace=p=>p-sliding;
 const dAt=(p,cell=0)=>({x:rowD.x+(lerp(placeOffsetIn(p,base),placeOffsetIn(p-1,base),sliding)+slotAt(cell,base).x),y:rowD.y+slotAt(cell,base).y,scale:1});
 let sock='';
 for(let p=0;p<=topOf(divisor,base);p++){const o=dRow*(p===0?1-sliding:1)*(p<op.K&&k===op.K?ease(clamp((time-lift0-.3)/.4)):1);if(o<=.001)continue;const c=dAt(p);sock+=`<g opacity="${round(o)}" transform="translate(${round(c.x-slotAt(0,base).x)} ${round(rowD.y)})">${tray(0,'blue',p,camera,'',false,base)}</g>`;}
 art+=sock;
 art+=label(divisor,xu+24,rowD.y+74,34,dRow);
 // The quotient's row: K + 1 dark bulbs, lit round by round.
 const qRow=ease(clamp((time-lift0)/(lift1-lift0)))*settle;
 const qTop=op.exact?qSpec.maxPlace:op.K;
 const qAnchor={x:lerp(rowQ.x,resultAnchor.x,op.exact?answer:0),y:lerp(rowQ.y,resultAnchor.y,op.exact?answer:0)};
 art+=sockets(qAnchor,0,op.K,base,camera,1,p=>qRow*(op.exact&&p>Math.max(0,qTop)?1-answer:1));
 art+=label('quotient',xu+24,rowQ.y+74,34,qRow*(1-answer));
 let particles='';
 const draw=(token,point,opacity=1)=>lamp(point,colorOf(token.sign),opacity,`data-unit="${token.id}"`);
 for(const x of rounds)if(x.q&&x.light&&time>=x.light[0]){const o=ease(clamp((time-x.light[0])/(x.light[1]-x.light[0])));particles+=lamp(at(qAnchor,x.k,base),colorOf(x.q),o,`data-quotient="${x.k}"`);}
 // The lift: the divisor's lit bulbs fly from the term into its row, shifted.
 if(time>=lift0&&time<lift1)for(const [p,color] of B.colors){const e=ease(clamp((time-lift0)/(lift1-lift0)));particles+=lamp(mix(at(homeB,p,base),at(rowD,p+op.K,base),e),color,1,`data-lift="${p}"`);}
 else if(time>=lift1)for(const t of tokensOf(divisor,base,'d'))particles+=lamp(dAt(t.place),colorOf(t.sign),dRow,`data-divisor="${t.place}"`);
 if(working){
  const u=working.units,frame=unitFrame(u,clamp((time-working.collide[0])/(working.collide[1]-working.collide[0])));
  const pos=token=>token.owner==='rem'?at(homeA,token.place,base,1,token.cell):at(rowD,token.place,base,1,token.cell);
  for(const token of frame.tokens)particles+=draw(token,pos(token));
  for(const {phase,progress} of frame.active.filter(a=>a.phase.type==='transfer')){const token=phase.before.find(t=>t.id===phase.removed[0]),next=phase.after.find(t=>t.id===token.id);particles+=draw(token,mix(pos(token),pos(next),ease(progress)));}
  particles+=phaseParticles(frame.active.filter(a=>a.phase.type!=='transfer'),{pos:token=>pos(token),draw:(token,point,opacity=1)=>draw(token,{...point,scale:1},opacity),color:t=>colorOf(t.sign),camera,base});
 } else for(const t of tokensOf(rest,base,'r'))particles+=draw(t,at(homeA,t.place,base),fadeOut);
 art+=group(particles,settle);
 const capY=dir<0?rowQ.y-40:rowQ.y+170;
 art+=caption(captionAt(op.captions,time),S.x+S.w/2,capY,ease(clamp((time-.15)/.3))*(1-ease(clamp((time-op.duration+.25)/.25))));
 const left=xu+placeOffsetIn(width,base)-20;
 const y0=dir<0?capY-60:S.y,y1=dir<0?S.y+170:capY+40;
 return {art,bounds:[Math.min(S.x,left),y0,Math.max(S.x+S.w,xu+200),y1]};
}
