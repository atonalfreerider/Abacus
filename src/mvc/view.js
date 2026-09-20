import {numberSpec,placeOffset} from './numbers.js';
import { math } from './model.js';
import {unitFrame} from './units.js';
import { placeMetadata } from '../place-value.js';
import { ease,clamp,operationGroups } from './animation.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const round=n=>Math.round(n*1000)/1000;
export const cameras={front:{pitch:.35},depth:{pitch:1},spread:{pitch:2.5}};
export function stackGeometry(exponent,camera='front') {
  const meta=placeMetadata(exponent),pitch=cameras[camera].pitch;
  return {...meta,pitch,depth:meta.cardCount*pitch,dx:meta.cardCount*pitch,dy:meta.cardCount*pitch};
}
export function face(x,y,size,color,meta,attributes='') {
  const border=1+meta.group*.55;
  if(meta.exponent<0){const inner=size*meta.innerScale,inset=(size-inner)/2;return `<g ${attributes}><rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" rx="5" fill="url(#paper)" fill-opacity=".12" stroke="#191a16" stroke-width="1"/><rect data-inner-area="${10**meta.exponent}" x="${round(x+inset)}" y="${round(y+inset)}" width="${inner}" height="${inner}" fill="url(#${color})"/></g>`;}

  let svg=`<g ${attributes}><rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" rx="5" fill="url(#${color})" stroke="#191a16" stroke-width="${border}"/>`;
  for(let level=0;level<meta.group;level++) {const inset=3+level*3;svg+=`<rect x="${round(x+inset)}" y="${round(y+inset)}" width="${size-2*inset}" height="${size-2*inset}" rx="3" fill="none" stroke="#17271c" stroke-width="${1.2+meta.group*.55}"/>`;}
  if(meta.mark)svg+=`<text x="${round(x+size-7)}" y="${round(y+size-6)}" text-anchor="end" font-size="12" font-weight="bold" fill="#14251d">${meta.mark}</text>`;
  return svg+'</g>';
}
export function tray(digit,color,exponent=0,camera='front',label=String(digit),unknown=false) {
  const meta=stackGeometry(exponent,camera),size=43;
  let svg='<rect width="150" height="150" rx="12" fill="url(#paper)" fill-opacity=".16" stroke="#171713" stroke-width="2"/>';
  for(let cell=0;cell<9;cell++) {
    const x=7+cell%3*47,y=7+Math.floor(cell/3)*47;
    svg+=`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5" fill="none" stroke="#858274" stroke-opacity=".2"/>`;
    if(cell<digit) {
      let clip='';
      if(digit-cell<1){const id=`slice-${exponent}-${cell}-${String(digit).replace('.','_')}`;svg+=`<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${size*(digit-cell)+meta.depth}" height="${size+meta.depth}"/></clipPath></defs>`;clip=` clip-path="url(#${id})"`;}
      svg+=`<g opacity="${unknown?.25:1}"${clip}>${stackUnit(x,y,color,exponent,camera)}</g>`;
    }
  }
  svg+=`<text x="75" y="75" dominant-baseline="central" text-anchor="middle" class="numeral" font-size="124" fill="#050504" pointer-events="none">${esc(label)}</text>`;
  return `<g class="digit-tray" data-cards="${meta.cardCount}" data-stack-depth="${meta.depth}" data-exponent="${exponent}">${svg}</g>`;
}
export function commaTriangle(x,decimal=false){return `<g class="${decimal?'decimal-comma':'group-comma'}" transform="translate(${x+5} 0)"><path d="M0 75 L25 50 L25 100 Z" fill="url(#paper)" fill-opacity="${decimal?.16:.75}" stroke="#37362e" stroke-width="1.5"/>${decimal?'<path d="M12 102v32 M12 120l-7 13" fill="none" stroke="#37362e" stroke-dasharray="1 4"/><circle cx="12" cy="120" r="2" fill="#37362e"/>':''}</g>`;}
function specArt(spec,color,camera,label=true){return spec.places.map(p=>`<g transform="translate(${p.x} 0)">${tray(label?p.digit:0,color,p.exponent,camera,label?String(p.digit):'')}</g>`).join('')+spec.markers.map(m=>commaTriangle(m.x,m.decimal)).join('');}
function termWidth(term){if(term.kind==='variable'&&Math.abs(term.value.n)===term.value.d)return 160;const spec=numberSpec(term);return (spec?spec.width:Math.max(String(Math.abs(term.value.n)).length,String(term.value.d).length)*160)+(term.kind==='variable'?160:0);}
function termArt(term,camera,solvedValue=null) {
  const color=term.kind==='variable'?'green':term.value.n<0?'red':'blue';
  const digits=(number,y=0,scale=1)=>[...String(number)].map((d,i,all)=>`<g transform="translate(${i*160*scale} ${y}) scale(${scale})">${tray(Number(d),color,all.length-i-1,camera)}</g>`).join('');
  let result;
  const spec=numberSpec(term);
  if(!spec) {
    const width=Math.max(String(Math.abs(term.value.n)).length,String(term.value.d).length)*160;
    result=`${digits(Math.abs(term.value.n),-47,.64)}<line x1="-3" y1="56" x2="${width*.64}" y2="56" stroke="#171713" stroke-width="3"/>${digits(term.value.d,67,.64)}`;
  } else result=specArt(spec,color,camera);
  if(term.kind==='variable') {
    if(Math.abs(term.value.n)===term.value.d)result=tray(solvedValue!==null?Math.min(9,Math.abs(solvedValue)):9,'green',0,camera,'X',solvedValue===null);
    else result+=`<g transform="translate(${termWidth(term)-160} 0)">${tray(9,'green',0,camera,'X',true)}</g>`;
  }
  return result;
}
export function layout(equation,{orientation='horizontal',camera='front',expression=false}={}) {
  const depth=stackGeometry(2,camera).depth, gap=95, margin=depth+32;
  const rows={};let width=0,height=0;
  for(const side of ['left','right']) {
    let cursor=margin;
    rows[side]=(equation[side].length?equation[side]:[{id:`zero-${side}`,kind:'constant',value:math.frac(0),placeholder:true}]).map((term,index)=>{
      const w=termWidth(term);const r={term,side,index,x:cursor,y:margin,w,h:170};cursor+=w+gap;return r;
    });width=Math.max(width,cursor-gap+margin);
  }
  let equal;
  if(orientation==='vertical') {
    height=(190+2*margin)*2+100;equal={x:width/2,y:height/2};
    for(const side of ['left','right']){const rowWidth=rows[side].at(-1).x+rows[side].at(-1).w+margin;rows[side].forEach(t=>t.x+=(width-rowWidth)/2);}
    rows.left.forEach(t=>t.y=margin);rows.right.forEach(t=>t.y=height/2+85);
  } else {
    const leftWidth=rows.left.at(-1).x+rows.left.at(-1).w+margin;
    equal={x:leftWidth+55,y:margin+75};rows.right.forEach(t=>t.x+=leftWidth+120);
    width=rows.right.at(-1).x+rows.right.at(-1).w+margin;height=220+margin*2;
  }
  if(expression){rows.right=[];width=rows.left.at(-1).x+rows.left.at(-1).w+margin;equal=null;height=220+margin*2;}
  return {terms:[...rows.left,...rows.right],width,height,equal,orientation};
}
export function stackUnit(x,y,color,exponent,camera='front',opacity=1){return `<use class="unit-stack" href="#stack-${color}-${String(exponent).replace('-','m')}-${camera}" data-place="${exponent}" data-cards="${placeMetadata(exponent).cardCount}" x="${round(x)}" y="${round(y)}" opacity="${opacity}"/>`;}
const stackCache=new Map();
function stackDefinitions(body){
 const ids=[...new Set([...body.matchAll(/href="#(stack-(blue|red|green)-(m?\d+)-(front|depth|spread))"/g)].map(m=>m[1]))];
 return '<defs>'+ids.map(id=>{if(stackCache.has(id))return stackCache.get(id);const [,color,exp,camera]=id.split('-'),meta=stackGeometry(Number(exp.replace('m','-')),camera);let content='';for(let layer=meta.cardCount;layer>=1;layer--)content+=face(layer*meta.pitch,layer*meta.pitch,43,color,meta,`class="card-face" data-layer="${layer}" data-group="${meta.mark}"`);const drawing=`<g id="${id}">${content}</g>`;stackCache.set(id,drawing);return drawing;}).join('')+'</defs>';
}
function textures(){return `<defs>${[['blue',25],['red',23],['green',2],['paper',24]].map(([name,id])=>`<pattern id="${name}" width="150" height="150" patternUnits="userSpaceOnUse"><image href="./textures/swf-${id}.jpg" width="150" height="150"/></pattern>`).join('')}</defs>`;}
function renderLayout(scene,options,overrides={}) {
  let body='';
  for(const slot of [...scene.terms].sort((a,b)=>Number(a.term.id===options.foreground)-Number(b.term.id===options.foreground))) {
    const {term,side,index,w,h}=slot,override=overrides[term.id]||{},x=override.x??slot.x,y=override.y??slot.y,opacity=override.opacity??1;
    const actual=override.term||term;
    body+=`<g class="term ${term.placeholder?'placeholder':''}" data-term="${esc(term.id)}" data-side="${side}" data-index="${index}" data-x="${round(x)}" data-y="${round(y)}" transform="translate(${round(x)} ${round(y)})" opacity="${opacity}" role="button" tabindex="${term.placeholder?-1:0}" aria-label="${esc(math.termText(actual))}, ${side} side">`;
    body+=`<rect class="hit" x="-6" y="-15" width="${w+12}" height="${h+15}" fill="transparent"/>`;
    if(index>0||actual.value.n<0)body+=`<text x="-47" y="97" text-anchor="middle" font-size="72" pointer-events="none">${actual.value.n<0?'−':'+'}</text>`;
    body+=(override.art??termArt(actual,options.camera,options.solvedValue)).replaceAll('class="numeral"',`class="numeral" opacity="${override.labelOpacity??1}"`)+'</g>';
    body+=`<rect class="reorder-gap" data-side="${side}" data-insert="${index}" x="${slot.x-65}" y="${slot.y-25}" width="34" height="210" rx="10" fill="transparent"/>`;
  }
  if(scene.equal) {
    const {x,y}=scene.equal;
    body+=`<g class="equals-mirror" pointer-events="none"><text x="${x}" y="${y+28}" font-size="83" text-anchor="middle">=</text>`;
    const line='fill="none" stroke="#28271f" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"';
    body+=scene.orientation==='horizontal'?`<path ${line} d="M${x} ${y-105}v65 M${x} ${y+55}v65"/>`:`<path ${line} d="M${x-140} ${y}h90 M${x+50} ${y}h90"/>`;
    body+='</g>';
  }
  return body;
}
function overlay(plan,t,scene,options) {
  const events=plan.events.filter(e=>['carry','borrow','neutralize','fraction','multiply','divide'].includes(e.type));
  const timeline=clamp((t-.14)/.69)*events.length;
  const event=events[Math.min(events.length-1,Math.floor(timeline))];
  if(!event || event.type==='fraction' || t<.14 || t>.83)return '';
  const target=scene.terms.find(s=>s.term.id===plan.command.target)||scene.terms[0];
  const x=target.x+Math.max(0,Math.floor(target.w/160)-1-(event.to??0))*160,y=target.y-30;let body='';const phase=timeline-Math.floor(timeline);
  const color=event.type==='neutralize'?'red':'blue',meta=placeMetadata(0);
  if(event.type==='multiply'||event.type==='divide') {
    const groups=operationGroups(plan);let result='';
    for(const slot of scene.terms.filter(s=>!s.term.placeholder)) {
      const group=groups.find(g=>g.id===slot.term.id);
      if(group){const cols=Math.ceil(Math.sqrt(group.count)),scale=Math.min(.38,150/(cols*termWidth(group.term)));
        for(let i=0;i<group.count;i++)result+=`<g data-operation-group="${i}" opacity="${Math.sin(Math.PI*phase)}" transform="translate(${slot.x+(i%cols)*160/cols*ease(phase)} ${slot.y+Math.floor(i/cols)*58*ease(phase)}) scale(${scale})">${termArt(group.term,options.camera)}</g>`;
      }
      result+=`<text x="${slot.x+75}" y="${slot.y-15}" text-anchor="middle" font-size="20">${event.type==='multiply'?'×':'÷'} ${esc(math.format(event.amount))}</text>`;
    }
    return `<g class="motion-overlay" pointer-events="none">${result}</g>`;
  }
  if(event.type==='carry'||event.type==='borrow') {
    const f=event.type==='borrow'?1-phase:phase;
    for(let i=0;i<10;i++) {
      const gx=(i%3)*18,gy=Math.floor(i/3)*18;
      const sx=90-i*2.3,sy=80+i*2.3;
      body+=face(x+gx+(sx-gx)*ease(f),y+gy+(sy-gy)*ease(f),16,color,meta,`data-motion="${event.type}" data-unit="${i}"`);
    }
  } else if(event.type==='neutralize') {
    for(let i=0;i<Math.min(9,event.count);i++)body+=`<g opacity="${1-phase}">${face(x+i*17,y,14,'blue',meta)}${face(x+i*17,y+34*(1-phase),14,'red',meta)}</g>`;
  } else {
    const r=event.result;body=`<text x="${x+75}" y="${y}" font-size="24" text-anchor="middle">${esc(math.format(r))}</text>`;
  }
  const label=event.type==='carry'?`10 → 1 next place`:event.type==='borrow'?'1 → 10 previous place':event.type==='neutralize'?'−1 + 1 = 0':event.type==='fraction'?'Common denominator':event.type==='multiply'?'Equal groups':'Share equally';
  return `<g class="motion-overlay" pointer-events="none">${body}<text x="${x+75}" y="${y-12}" text-anchor="middle" font-size="15">${label}</text></g>`;
}
export function renderEquation(equation,options={},plan=null,progress=1) {
  options={orientation:'horizontal',camera:'front',expression:false,...options};options.foreground=options.drag?.id||(plan?.origin?plan.command.id:null);
  if((!plan||progress>=.78)&&math.isSolved(equation))options.solvedValue=math.numeric(math.solution(equation).value);
  const after=layout(equation,options);let scene=after,body='';
  if(plan?.units&&progress<1){const frame=renderUnits(plan,progress,options);scene=frame.scene;body=frame.body;}
  else if(plan&&progress<1) {
    const before=layout(plan.before,options),p=ease(progress);
    if(plan.origin){const picked=before.terms.find(t=>t.term.id===plan.command.id);if(picked){picked.x=plan.origin.x;picked.y=plan.origin.y;}}
    const equal=before.equal&&after.equal?{x:before.equal.x+(after.equal.x-before.equal.x)*p,y:before.equal.y+(after.equal.y-before.equal.y)*p}:after.equal;
    scene={...before,equal,width:before.width+(after.width-before.width)*p,height:before.height+(after.height-before.height)*p,terms:[...before.terms]};
    const overrides={};
    for(const slot of before.terms) {
      const to=after.terms.find(a=>a.term.id===slot.term.id);
      if(to){
        const x=slot.x+(to.x-slot.x)*p,y=slot.y+(to.y-slot.y)*p;
        let crossed=progress>=.5;
        if(plan.command.type==='move'&&slot.term.id===plan.command.id&&equal){const positiveSide=options.orientation==='horizontal'?x+slot.w/2>equal.x:y+75>equal.y;crossed=plan.origin?true:slot.side==='left'?positiveSide:!positiveSide;}
        overrides[slot.term.id]={x,y,term:plan.command.type==='move'?(crossed?to.term:slot.term):(progress>=.78?to.term:slot.term)};
      }
      else {const target=before.terms.find(a=>a.term.id===plan.command.target)||after.terms.find(a=>a.side===slot.side)||slot;overrides[slot.term.id]={x:slot.x+(target.x-slot.x)*p,y:slot.y+(target.y-slot.y)*p,opacity:1-p};}
      if(!plan.origin&&['move','reorder'].includes(plan.command.type)&&slot.term.id===plan.command.id){const arc=Math.sin(Math.PI*p);if(options.orientation==='vertical'&&plan.command.type==='move')overrides[slot.term.id].x-=55*arc;else {overrides[slot.term.id].y+=190*arc;scene.height=Math.max(scene.height,overrides[slot.term.id].y+200);}}
      if(plan.command.type==='operate'&&progress>.14&&progress<.78)overrides[slot.term.id].opacity=.16;
      if(plan.command.type==='combine'&&[plan.command.id,plan.command.target].includes(slot.term.id))overrides[slot.term.id].labelOpacity=progress>=.78&&to?1:Math.max(0,1-progress/.18);
    }
    for(const slot of after.terms)if(!before.terms.some(b=>b.term.id===slot.term.id)){scene.terms.push(slot);overrides[slot.term.id]={opacity:p};}
    body=renderLayout(scene,options,overrides);
    body+=overlay(plan,progress,before,options);
  } else {const overrides={};if(options.drag){const d=options.drag,slot=scene.terms.find(t=>t.term.id===d.id);if(slot)overrides[d.id]={x:d.x,y:d.y,term:slot.side===d.side?slot.term:{...slot.term,value:math.neg(slot.term.value)}};}body=renderLayout(scene,options,overrides);}
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Georgia,serif" id="equation-svg" viewBox="${round(scene.minX||0)} ${round(scene.minY||0)} ${round(scene.width-(scene.minX||0))} ${round(scene.height-(scene.minY||0))}" data-orientation="${options.orientation}" data-camera="${options.camera}" data-progress="${round(progress)}" aria-label="${esc(math.equationText(equation))}">${textures()}${stackDefinitions(body)}${body}</svg>`;
}
function renderUnits(plan,t,options){
 const before=layout(plan.before,options),after=layout(plan.after,options),u=plan.units,p=ease(t),overrides={};
 const source=before.terms.find(s=>s.term.id===u.source),target=before.terms.find(s=>s.term.id===u.target);
 const result=after.terms.find(s=>s.term.id===u.target)||after.terms.find(s=>s.side===target.side);
 const spec=term=>numberSpec(term),digits=term=>spec(term).places.length;
 const boundary=term=>-placeOffset(spec(term).maxPlace),shift=u.placeShift||0;
 const lerp=(a,b,q=p)=>a+(b-a)*q;
 const anchor={x:lerp(target.x+boundary(target.term),result.x+boundary(result.term)),y:lerp(target.y,result.y)};
 const frame=unitFrame(u,clamp(t/.9)),phase=frame.phase;
 const sourceOrigin=plan.origin||source;
 const sourceAt={x:sourceOrigin.x,y:sourceOrigin.y};
 const scene={...before,width:lerp(before.width,after.width),height:Math.max(before.height,after.height),terms:[...before.terms],equal:before.equal&&after.equal?{x:lerp(before.equal.x,after.equal.x),y:lerp(before.equal.y,after.equal.y)}:null};
 const maxPlace=Math.max(spec(target.term).maxPlace,...u.initial.map(a=>a.place+shift),...u.final.map(a=>a.place+shift)),minPlace=Math.min(spec(target.term).minPlace,spec(source.term).minPlace,0,...u.initial.map(a=>a.place+shift),...u.final.map(a=>a.place+shift));
 function pos(token){const owner=token.owner===u.target?anchor:{x:sourceAt.x+boundary(source.term),y:sourceAt.y};const cell=token.cell;
  return {x:owner.x+placeOffset(token.place+shift)+7+(cell<9?cell%3*47:47+(cell-9)*6),y:owner.y+7+(cell<9?Math.floor(cell/3)*47:47+(cell-9)*6)};
 }
 for(const slot of before.terms){const to=after.terms.find(s=>s.term.id===slot.term.id);if(to)overrides[slot.term.id]={x:lerp(slot.x,to.x),y:lerp(slot.y,to.y)};}
 const empty=term=>specArt(spec(term),'blue',options.camera,false);
 const sourceRemaining=frame.tokens.some(a=>a.owner===u.source)||frame.active.some(a=>a.phase.before.some(t=>a.phase.removed.includes(t.id)&&t.owner===u.source));
 overrides[u.source]={x:sourceAt.x,y:sourceAt.y,term:plan.command.side?{...source.term,value:math.neg(source.term.value)}:source.term,opacity:sourceRemaining?1:0,art:empty(source.term),labelOpacity:0};
 let boxes='';for(let place=minPlace;place<=maxPlace;place++){const old=place>=spec(target.term).minPlace&&place<=spec(target.term).maxPlace,final=place>=spec(result.term).minPlace&&place<=spec(result.term).maxPlace,opacity=(old?1:clamp(t*8))*(final?1:1-ease((t-.9)/.1));const x=anchor.x+placeOffset(place)-target.x;boxes+=`<g opacity="${opacity}" transform="translate(${x} ${anchor.y-target.y})">${tray(0,'blue',place,options.camera,'')}</g>`;if(place<maxPlace&&(place===-1||place>=0&&place%3===2||place<0&&place%3===0))boxes+=`<g transform="translate(0 ${anchor.y-target.y})">${commaTriangle(x-40,place===-1)}</g>`;}
 overrides[u.target]={x:target.x,y:target.y,term:t>.9?result.term:target.term,art:boxes,labelOpacity:0};
 let body=renderLayout(scene,options,overrides),particles='';
 const color=token=>target.term.kind==='variable'?'green':token.sign<0?'red':'blue';
 const draw=(token,point,opacity=1)=>`<g data-unit="${token.id}" data-sign="${token.sign}" data-place="${token.place}">${stackUnit(point.x,point.y,color(token),token.place+shift,options.camera,opacity)}</g>`;
 for(const token of frame.tokens)particles+=draw(token,pos(token));
 for(const {phase,progress:q} of frame.active){
  if(phase.type==='settle')for(const token of phase.before){const next=phase.after.find(a=>a.id===token.id),a=pos(token),b=pos(next||token);particles+=draw(token,{x:lerp(a.x,b.x,ease(q)),y:lerp(a.y,b.y,ease(q))});}
  if(phase.type==='transfer'){
   const token=phase.before.find(a=>a.id===phase.removed[0]),next=phase.after.find(a=>a.id===token.id),a=pos(token),b=pos(next);particles+=draw(token,{x:lerp(a.x,b.x,ease(q)),y:lerp(a.y,b.y,ease(q))});
  } else if(phase.type==='neutralize'){
   const pair=phase.before.filter(a=>phase.removed.includes(a.id)),a=pos(pair[0]),b=pos(pair[1]),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   for(const token of pair){const start=pos(token);particles+=draw(token,{x:lerp(start.x,mid.x,ease(q)),y:lerp(start.y,mid.y,ease(q))},1-ease((q-.65)/.35));}
  } else if(phase.type==='carry'||phase.type==='borrow'){
   const carry=phase.type==='carry',many=(carry?phase.before:phase.after).filter(a=>(carry?phase.removed:phase.created).includes(a.id));
   const single=(carry?phase.after:phase.before).find(a=>a.id===(carry?phase.created[0]:phase.removed[0]));
   const end=pos(single),pitch=cameras[options.camera].pitch,depth=placeMetadata(many[0].place+shift).cardCount*pitch;
   const f=carry?ease(q):1-ease(q),comma=(single.place+shift)%3===0||many[0].place+shift<0;
   // Adjacent depth ranges form exactly the same cached 10/100 stack as the settled unit.
   // At a comma, compress the old depth group into the next inscribed face.
   for(let i=0;i<many.length;i++){const token=many[i],start=pos(token),compression=comma?1/(1+999*f):1,offset=(9-i)*depth*compression,point={x:lerp(start.x,end.x+offset,f),y:lerp(start.y,end.y+offset,f)};
    if(comma){const meta=stackGeometry(token.place+shift,options.camera);let drawing='';for(let layer=meta.cardCount;layer>=1;layer--){const d=layer*pitch*compression;drawing+=face(point.x+d,point.y+d,43,color(token),meta);}particles+=`<g data-unit="${token.id}" opacity="${1-ease((f-.75)/.25)}">${drawing}</g>`;}
    else particles+=draw(token,point);
   }
   if(comma)particles+=draw(single,end,ease((f-.75)/.25));
  }
 }
 // Numerals fade out at pickup and return only after the units reach their settled cells.
 let numerals='';const labels=t<.06?1-t/.06:t>.9?(t-.9)/.1:0;
 if(labels){for(const [slot,term] of (t<.06?[[target,target.term],[{...source,...sourceAt},source.term]]:[[result,result.term]])){for(const digit of spec(term).places)numerals+=`<text x="${slot.x+digit.x+75}" y="${slot.y+75}" dominant-baseline="central" text-anchor="middle" font-size="124" opacity="${labels}">${digit.digit}</text>`;}}

 body+=`<g class="unit-animation" data-phase="${phase?.type||'settled'}" pointer-events="none">${particles}</g>`+numerals;
 const expand=ease(t/.15)*(1-ease((t-.9)/.1));scene.minX=Math.min(0,anchor.x+placeOffset(maxPlace)-8)*expand;scene.minY=Math.min(0,sourceAt.y-20)*expand;scene.width=lerp(scene.width,Math.max(scene.width,sourceAt.x+source.w+stackGeometry(2,options.camera).depth+20),expand);scene.height=lerp(before.height,after.height,p)+Math.max(0,sourceAt.y+200+stackGeometry(2,options.camera).depth-before.height)*expand;
 return {scene,body};
}
