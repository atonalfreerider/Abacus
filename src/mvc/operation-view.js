// Frames for working out × and ÷ with cards (plans come from operations.js).
// Multiplication lifts the factors into a row of copies over a horizontal line of
// cards, then adds the copies into the answer. Division deals the dividend's cards
// into equal groups, unstacking leftovers, and one group becomes the answer.
import {layout,renderLayout,tray,specArt,stackUnit,commaTriangle,phaseParticles,operandOffsets,termArt,operationArt,round,esc} from './view.js';
import {numberSpec,placeOffset} from './numbers.js';
import {ease,clamp} from './animation.js';
import {unitFrame} from './units.js';
import {math} from './model.js';

const lerp=(a,b,q)=>a+(b-a)*q;
const grid=cell=>cell<9?{x:cell%3*47,y:Math.floor(cell/3)*47}:{x:47+(cell-9)*6,y:47+(cell-9)*6};
// Many cards in one place pile up on the nine cells, each layer shifted down-right.
const pile=cell=>{const base=cell%9,layer=Math.floor(cell/9);return {x:base%3*47+layer*5,y:Math.floor(base/3)*47+layer*5};};
const boundary=spec=>spec?-placeOffset(spec.maxPlace):0;
const cardAt=(anchor,place,cell,scale=1,arrange=grid)=>{const c=arrange(cell);return {x:anchor.x+(placeOffset(place)+7+c.x)*scale,y:anchor.y+(7+c.y)*scale};};
const colorOf=sign=>sign<0?'red':'blue';
const isComma=place=>place===-1||place>=0&&place%3===2||place<0&&place%3===0;
function card(point,color,place,camera,scale=1,opacity=1,attributes=''){
 if(opacity<=0)return '';
 if(Math.abs(scale-1)<1e-6)return `<g ${attributes}>${stackUnit(point.x,point.y,color,place,camera,round(opacity))}</g>`;
 return `<g ${attributes} transform="translate(${round(point.x)} ${round(point.y)}) scale(${round(scale)})">${stackUnit(0,0,color,place,camera,round(opacity))}</g>`;
}
const place=(art,x,y,scale=1,opacity=1)=>opacity<=0?'':`<g opacity="${round(opacity)}" transform="translate(${round(x)} ${round(y)})${scale===1?'':` scale(${round(scale)})`}">${art}</g>`;
// Empty trays for every place from low to high around a place-value anchor.
function trays(anchor,low,high,camera,opacityOf=()=>1,scale=1){
 let art='';
 for(let p=low;p<=high;p++){const x=anchor.x+placeOffset(p)*scale,opacity=opacityOf(p);art+=place(tray(0,'blue',p,camera,''),x,anchor.y,scale,opacity);if(p<high&&isComma(p))art+=place(commaTriangle(-40),x,anchor.y,scale,opacity);}
 return art;
}
const caption=(text,x,y,opacity)=>opacity>0?`<text class="operation-caption" x="${round(x)}" y="${round(y)}" text-anchor="middle" font-size="36" fill="#3d3a30" opacity="${round(opacity)}">${esc(text)}</text>`:'';
const operandText=o=>math.termText({kind:'constant',value:math.abs(o.value),notation:o.notation,decimalPlaces:o.decimalPlaces});

export function renderOperation(plan,t,options){
 const op=plan.op,time=t*op.duration,before=layout(plan.before,options),after=layout(plan.after,options),id=plan.command.id,p=ease(t);
 const S=before.terms.find(s=>s.term.id===id),R=after.terms.find(s=>s.term.id===id);
 const scene={...before,width:lerp(before.width,after.width,p),height:Math.max(before.height,after.height),terms:[...before.terms],equal:before.equal&&after.equal?{x:lerp(before.equal.x,after.equal.x,p),y:lerp(before.equal.y,after.equal.y,p)}:after.equal};
 const overrides={};
 for(const slot of before.terms){const to=after.terms.find(s=>s.term.id===slot.term.id);if(to)overrides[slot.term.id]={x:lerp(slot.x,to.x,p),y:lerp(slot.y,to.y,p)};}
 const slot={...overrides[id],w:S.w};
 // The last quarter second crossfades into the settled result, which sits exactly where the cards end.
 const finish=clamp((time-(op.duration-.3))/.3);
 const context={op,S,R,slot,time,camera:options.camera,orientation:options.orientation,finish};
 const stage=op.kind==='flip'?{art:'',bounds:null,term:flipArt(context)}:op.kind==='multiply'?multiplyStage(context):divideStage(context);
 // A longer chain keeps its remaining factors: the old ones fade out, the new ones fade in.
 let art=stage.term??'';
 if(op.kind!=='flip'){
  if(S.term.expr.operands.length>2)art+=place(operationArt(S.term,options.camera,2),0,0,1,1-ease(clamp(time/.4)));
  if(R.term.expr)art+=place(operationArt(R.term,options.camera,1),0,0,1,ease(clamp((time-(op.duration-.6))/.4)));
  art+=place(termArt(R.term,options.camera),0,0,1,finish);
 }
 overrides[id]={...overrides[id],term:finish>.5?R.term:S.term,art,labelOpacity:1};
 if(stage.bounds){
  const [x0,y0,x1,y1]=stage.bounds,expand=ease(clamp(time/.45))*(1-ease(clamp((time-(op.duration-.55))/.5)));
  scene.minX=Math.min(0,x0-30)*expand;scene.minY=Math.min(0,y0-30)*expand;
  scene.width=lerp(scene.width,Math.max(scene.width,x1+30),expand);scene.height=lerp(scene.height,Math.max(scene.height,y1+30),expand);
 }
 const body=renderLayout(scene,options,overrides)+`<g class="operation-animation" data-operation="${op.kind}" pointer-events="none">${stage.art}</g>`;
 return {scene,body};
}

function flipArt({op,S,R,time,camera}){
 // Dividing by a fraction: the fraction card turns over (numerator and denominator swap)
 // and ÷ becomes ×. The whole term squashes to an edge and opens as the new term.
 const q=time/op.duration,squash=Math.max(.02,Math.abs(Math.cos(Math.PI*q))),art=q<.5?operationArt(S.term,camera):operationArt(R.term,camera);
 return `<g transform="translate(0 ${round(75*(1-squash))}) scale(1 ${round(squash)})">${art}</g>`;
}

function multiplyStage({op,S,slot,time,camera,orientation}){
 const term=S.term,offsets=operandOffsets(term),n=op.copies.length,units=op.units,shift=units.placeShift;
 const dir=orientation==='vertical'&&S.side==='right'?1:-1;
 const copyOperand=term.expr.operands[op.copyIndex],lineOperand=term.expr.operands[op.lineIndex];
 const color=colorOf(op.sign),lineColor=colorOf(Math.sign(lineOperand.value.n));
 const copyHome={x:S.x+offsets[op.copyIndex]+boundary(op.copySpec),y:S.y},lineHome={x:S.x+offsets[op.lineIndex]+boundary(op.lineSpec),y:S.y};
 const gap=70,widths=op.copies.map(c=>c.spec.width),raw=Math.max(1,widths.reduce((a,b)=>a+b,0)+gap*Math.max(0,n-1));
 const scale=Math.min(1,Math.max(1100,S.w+400)/raw),x0=S.x+S.w/2-raw*scale/2;
 const lineY=dir<0?S.y-100:S.y+180,copyTop=dir<0?lineY-40-150*scale:lineY+43*scale+40;
 const lefts=widths.map((w,i)=>x0+(widths.slice(0,i).reduce((a,b)=>a+b,0)+gap*i)*scale);
 const anchors=op.copies.map((c,i)=>({x:lefts[i]+boundary(c.spec)*scale,y:copyTop}));
 const centers=lefts.map((x,i)=>x+widths[i]*scale/2);
 // Lay out: copy i and line card i leave the factors together, one after another.
 const stagger=n>1?(op.layout-.55)/(n-1):0,out=i=>ease(clamp((time-i*stagger)/.55));
 const copyAt=i=>{const k=out(i);return {anchor:{x:lerp(copyHome.x,anchors[i].x,k),y:lerp(copyHome.y,anchors[i].y,k)},scale:lerp(1,scale,k),k};};
 const lineCards=[];{const seen={};for(const p of op.lineSpec.places)for(let k=0;k<p.digit;k++){seen[p.exponent]=(seen[p.exponent]??-1)+1;lineCards.push({place:p.exponent,cell:seen[p.exponent]});}}
 // Sum: the ledger moves every copy's cards into the answer, regrouping as they arrive.
 const resultTerm={kind:'constant',value:math.abs(math.mul(copyOperand.value,lineOperand.value)),notation:'decimal'},resultSpec=numberSpec(resultTerm);
 const resultAnchor={x:slot.x+boundary(resultSpec),y:slot.y};
 const q=clamp((time-op.sumStart)/units.duration),frame=time<op.sumStart?{tokens:units.initial,active:[]}:unitFrame(units,q);
 const owner=name=>Number(name.slice(5));
 // When each copy's last card has left (cached on the plan: it never changes).
 const done=op.done??=op.copies.map(c=>op.sumStart+Math.max(0,...units.phases.filter(ph=>ph.type==='transfer'&&ph.before.find(tk=>tk.id===ph.removed[0])?.owner===c.owner).map(ph=>ph.end)));
 const fadeCopy=i=>1-clamp((time-done[i])/.3);
 const copies=op.copies.map((_,i)=>copyAt(i));
 const pos=token=>{if(token.owner==='result')return {...cardAt(resultAnchor,token.place+shift,token.cell),scale:1};const c=copies[owner(token.owner)];return {...cardAt(c.anchor,token.place+shift,token.cell,c.scale),scale:c.scale};};
 let art='';
 // The factors' own trays, frame and × sign lift away as the copies leave.
 art+=place(operationArt(term,camera),S.x,S.y,1,1-ease(clamp(time/.45)));
 // Line and copies.
 const lineOpacity=i=>ease(clamp((time-i*stagger)/.2))*fadeCopy(i);
 const lineRule=dir<0?lineY+43*scale+14:lineY-14;
 if(n)art+=`<path d="M${round(x0-20)} ${round(lineRule)}h${round(raw*scale+40)}" stroke="#3d3a30" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round" opacity="${round(Math.min(1,time/.4)*(1-ease(clamp((time-op.sumStart-.2)/.4))))}"/>`;
 lineCards.forEach((c,i)=>{if(i>=n)return;const k=out(i),home=cardAt(lineHome,c.place,c.cell),to={x:centers[i]-21.5*scale,y:lineY};art+=card({x:lerp(home.x,to.x,k),y:lerp(home.y,to.y,k)},lineColor,c.place,camera,lerp(1,scale,k),time<.05?0:fadeCopy(i),`data-line-card="${i}"`);});
 op.copies.forEach((c,i)=>{const at=copies[i];art+=place(specArt(c.spec,color,camera,false),at.anchor.x-boundary(c.spec)*at.scale,at.anchor.y,at.scale,Math.min(at.k*3,1)*fadeCopy(i));});
 // Answer trays appear before the first card arrives; places the answer does not keep fade at the end.
 const places=[...units.initial,...units.final].map(tk=>tk.place+shift),low=Math.min(resultSpec.minPlace,...places),high=Math.max(resultSpec.maxPlace,...places);
 art+=trays(resultAnchor,low,high,camera,pl=>ease(clamp((time-op.sumStart+.35)/.35))*(pl>=resultSpec.minPlace&&pl<=resultSpec.maxPlace?1:1-ease(clamp((time-op.duration+.6)/.3))));
 const draw=(token,point,opacity=1,sc=1)=>card(point,color,token.place+shift,camera,sc,opacity,`data-unit="${token.id}"`);
 const tokenFade=token=>token.owner==='result'?1:clamp(copies[owner(token.owner)].k*4);
 const settle=1-clamp((time-(op.duration-.3))/.3);
 let particles='';
 for(const token of frame.tokens){const at=pos(token);particles+=draw(token,at,tokenFade(token),at.scale);}
 for(const {phase,progress} of frame.active.filter(a=>a.phase.type==='transfer')){
  const token=phase.before.find(tk=>tk.id===phase.removed[0]),next=phase.after.find(tk=>tk.id===token.id),a=pos(token),b=pos(next),e=ease(progress);
  particles+=draw(token,{x:lerp(a.x,b.x,e),y:lerp(a.y,b.y,e)},1,lerp(a.scale,b.scale,e));
 }
 particles+=phaseParticles(frame.active.filter(a=>a.phase.type!=='transfer'),{pos,draw:(token,point,opacity=1)=>draw(token,point,opacity),color:()=>color,camera,shift});
 art+=place(particles,0,0,1,settle);
 // "1 copy of 230 and 4 copies of 23": a ten-card's copy is named by its shifted value.
 const groups=[];for(const c of op.copies){const last=groups.at(-1);if(last?.text===c.spec.text)last.count++;else groups.push({text:c.spec.text,count:1});}
 const label=n?groups.map(g=>`${g.count} cop${g.count===1?'y':'ies'} of ${g.text}`).join(' and '):`No copies of ${operandText(copyOperand)}`;
 const sumText=n>1&&n<=6?op.copies.map(c=>c.spec.text).join(' + '):label;
 art+=caption(time<op.sumStart?label:sumText,S.x+S.w/2,dir<0?copyTop-34:copyTop+150*scale+52,ease(clamp((time-.3)/.3))*(1-ease(clamp((time-op.duration+.7)/.4))));
 const top=Math.min(copyTop-80,lineY),bottom=Math.max(copyTop+150*scale+80,lineY+60,S.y+170);
 return {art,bounds:[Math.min(x0-30,S.x),top,Math.max(x0+raw*scale+30,S.x+S.w),bottom]};
}

function divideStage({op,S,slot,time,camera,orientation}){
 const term=S.term,d=op.d,offsets=operandOffsets(term),dir=orientation==='vertical'&&S.side==='left'?-1:1;
 const dividend=term.expr.operands[0],color=colorOf(Math.sign(dividend.value.n)),resultColor=colorOf(op.sign);
 const home={x:S.x+boundary(op.dividendSpec),y:S.y},divisorAt={x:S.x+offsets[1]+75,y:S.y+75};
 const gs=d<=2?.62:d<=4?.52:d<=6?.44:.38,perRow=d<=6?d:Math.ceil(d/2),rows=Math.ceil(d/perRow);
 const wholeWidth=op.groupSpec?.width||0,gw=wholeWidth+(op.mixed?160:0),colGap=46,rowH=160*gs+50;
 const rowW=perRow*gw*gs+(perRow-1)*colGap,cx=S.x+S.w/2;
 const gather=clamp((time-op.gather-.35)/.6),g0=ease(gather);
 const box=g=>{const r=Math.floor(g/perRow),c=g%perRow,left=cx-rowW/2+c*(gw*gs+colGap),top=dir>0?S.y+225+r*rowH:S.y-75-(rows-r)*rowH;
  if(g)return {left,top,scale:gs};return {left:lerp(left,slot.x,g0),top:lerp(top,slot.y,g0),scale:lerp(gs,1,g0)};};
 const groupAnchor=g=>{const b=box(g);return {x:b.left+boundary(op.groupSpec)*b.scale,y:b.top,scale:b.scale,sliceLeft:b.left+wholeWidth*b.scale};};
 const groupFade=g=>g?1-ease(clamp((time-op.gather)/.4)):1;
 const events=op.events,deal=new Map(),unstack=new Map(),born=new Map(),slice=new Map(),strips=new Map();
 for(const e of events){if(e.type==='deal')deal.set(e.id,e);if(e.type==='unstack'){unstack.set(e.id,e);for(const c of e.children)born.set(c.id,e);}if(e.type==='slice')slice.set(e.id,e);if(e.type==='strip')strips.set(e.id,e);}
 const low=Math.min(op.dividendSpec.minPlace,...events.filter(e=>e.type==='unstack').map(e=>e.place-1)),high=op.dividendSpec.maxPlace;
 const firstUse=pl=>{const e=events.find(e=>e.type==='unstack'&&e.place-1===pl);return e?e.start:0;};
 let art='';
 // The ÷ sign and divisor fade; the divisor becomes d empty groups.
 art+=place(operationArt(term,camera),S.x,S.y,1,1-ease(clamp(time/.5)));
 art+=trays(home,low,high,camera,pl=>(pl<op.dividendSpec.minPlace?ease(clamp((time-firstUse(pl)+.2)/.3)):ease(clamp(time/.2)))*(1-ease(clamp((time-op.gather)/.4))));
 const groupArt=(op.groupSpec?specArt(op.groupSpec,color,camera,false):'')+(op.mixed?place(tray(0,color,0,camera,''),wholeWidth,0):'');
 for(let g=0;g<d;g++){const b=box(g),k=ease(clamp((time-.15-g*.03)/.5)),x=lerp(divisorAt.x,b.left,k),y=lerp(divisorAt.y,b.top,k);art+=place(groupArt,x,y,lerp(.15,b.scale,k),k*groupFade(g)*(1-clamp((time-(op.duration-.3))/.3)));}
 const pilePos=token=>cardAt(home,token.place,token.cell,1,pile);
 const groupPos=(g,pl,cell)=>{const a=groupAnchor(g);return {...cardAt(a,pl,cell,a.scale),scale:a.scale};};
 const settle=1-clamp((time-(op.duration-.3))/.3);
 let particles='';
 const draw=(token,point,opacity=1,sc=1,group=-1)=>card(point,group===0&&gather>0?resultColor:color,token.place,camera,sc,opacity*settle,`data-card="${token.id}"`);
 const tokens=[...op.tokens,...[...unstack.values()].flatMap(e=>e.children)];
 for(const token of tokens){
  const origin=born.get(token.id);if(origin&&time<origin.end)continue;
  const split=unstack.get(token.id)||slice.get(token.id);if(split&&time>=split.start)continue;
  const e=deal.get(token.id);
  if(!e||time<e.start){particles+=draw(token,pilePos(token));continue;}
  const to=groupPos(e.group,e.place,e.cell),k=ease(clamp((time-e.start)/(e.end-e.start))),from=pilePos(token);
  particles+=draw(token,{x:lerp(from.x,to.x,k),y:lerp(from.y,to.y,k)-Math.sin(Math.PI*k)*30},groupFade(e.group),lerp(1,to.scale,k),e.group);
 }
 for(const e of unstack.values())if(time>=e.start&&time<e.end){
  const parent={id:e.id,place:e.place,cell:e.cell,sign:1};
  particles+=phaseParticles([{phase:{type:'borrow',before:[parent],after:e.children.map(c=>({...c,sign:1})),removed:[e.id],created:e.children.map(c=>c.id)},progress:(time-e.start)/(e.end-e.start)}],{pos:pilePos,draw:(token,point,opacity=1)=>draw(token,point,opacity),color:()=>color,camera});
 }
 // Slices: a leftover card splits into d strips; strip k goes to group k.
 const q=op.pieces||d,strip=(x,y,scale,opacity,group=-1)=>`<rect class="card-strip" x="${round(x)}" y="${round(y)}" width="${round(43/q*scale)}" height="${round(43*scale)}" fill="url(#${group===0&&gather>0?resultColor:color})" stroke="#191a16" stroke-width=".8" opacity="${round(opacity*settle)}"/>`;
 for(const e of slice.values()){
  if(time<e.start)continue;
  const at=pilePos(e),spread=ease(clamp((time-e.start)/(e.end-e.start)));
  for(const s of e.strips){
   const rest={x:at.x+s.index*43/q+(s.index-(q-1)/2)*8*spread,y:at.y};
   const move=strips.get(s.id);
   if(!move||time<move.start){particles+=strip(rest.x,rest.y,1,1);continue;}
   const a=groupAnchor(move.group),k=ease(clamp((time-move.start)/(move.end-move.start))),to={x:a.sliceLeft+(7+move.slot*43/q)*a.scale,y:a.y+7*a.scale};
   particles+=strip(lerp(rest.x,to.x,k),lerp(rest.y,to.y,k)-Math.sin(Math.PI*k)*30,lerp(1,a.scale,k),groupFade(move.group),move.group);
  }
 }
 art+=particles;
 const text=operandText(dividend);
 art+=caption(time<op.gather?`Share ${text} into ${d} equal group${d===1?'':'s'}`:'One group is the answer',cx,dir>0?S.y+215+rows*rowH+20:S.y-110-rows*rowH,ease(clamp((time-.3)/.3))*(1-ease(clamp((time-op.duration+.6)/.4))));
 const top=dir>0?S.y:S.y-130-rows*rowH,bottom=dir>0?S.y+260+rows*rowH:S.y+170;
 return {art,bounds:[Math.min(cx-rowW/2-30,S.x),top,Math.max(cx+rowW/2+30,S.x+S.w),bottom]};
}
