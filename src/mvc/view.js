import { math } from './model.js';
import { placeMetadata } from '../place-value.js';
import { ease,clamp,operationGroups } from './animation.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const round=n=>Math.round(n*1000)/1000;
export const cameras={front:{pitch:.35},depth:{pitch:1},spread:{pitch:2.5}};
export function stackGeometry(exponent,camera='front') {
  const meta=placeMetadata(exponent),pitch=cameras[camera].pitch;
  return {...meta,pitch,depth:meta.cardCount*pitch,dx:-meta.cardCount*pitch,dy:meta.cardCount*pitch};
}
export function face(x,y,size,color,meta,attributes='') {
  const border=1+meta.group*.55;
  let svg=`<g ${attributes}><rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" rx="5" fill="url(#${color})" stroke="#191a16" stroke-width="${border}"/>`;
  for(let level=0;level<meta.group;level++) {const inset=3+level*3;svg+=`<rect x="${round(x+inset)}" y="${round(y+inset)}" width="${size-2*inset}" height="${size-2*inset}" rx="3" fill="none" stroke="#17271c" stroke-width="${1.2+meta.group*.55}"/>`;}
  if(meta.mark)svg+=`<text x="${round(x+size-7)}" y="${round(y+size-6)}" text-anchor="end" font-size="12" font-weight="bold" fill="#14251d">${meta.mark}</text>`;
  return svg+'</g>';
}
export function tray(digit,color,exponent=0,camera='front',label=String(digit),unknown=false) {
  const meta=stackGeometry(exponent,camera),size=43;
  let svg='<rect width="150" height="150" rx="12" fill="url(#paper)" stroke="#171713" stroke-width="2"/>';
  for(let cell=0;cell<9;cell++) {
    const x=7+cell%3*47,y=7+Math.floor(cell/3)*47;
    svg+=`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5" fill="none" stroke="#858274" stroke-opacity=".2"/>`;
    if(cell<digit)for(let layer=meta.cardCount;layer>=1;layer--) {
      const d=layer*meta.pitch;
      let clip='';
      if(digit-cell<1){const id=`slice-${exponent}-${cell}-${layer}-${String(digit).replace('.','_')}`;svg+=`<defs><clipPath id="${id}"><rect x="${round(x-d)}" y="${round(y+d)}" width="${size*(digit-cell)}" height="${size}"/></clipPath></defs>`;clip=` clip-path="url(#${id})"`;}
      svg+=face(x-d,y+d,size,color,meta,`class="card-face" opacity="${unknown?.25:1}" data-layer="${layer}" data-cell="${cell}" data-group="${meta.mark}"${clip}`);
    }
  }
  svg+=`<text x="75" y="121" text-anchor="middle" class="numeral" font-size="131" fill="#050504" pointer-events="none">${esc(label)}</text>`;
  return `<g class="digit-tray" data-cards="${meta.cardCount}" data-stack-depth="${meta.depth}" data-exponent="${exponent}">${svg}</g>`;
}
function termWidth(term) {if(term.kind==='variable'&&Math.abs(term.value.n)===term.value.d)return 160;return term.value.d===1?Math.max(1,String(Math.abs(term.value.n)).length)*160+(term.kind==='variable'?160:0):Math.max(String(Math.abs(term.value.n)).length,String(term.value.d).length)*160+(term.kind==='variable'?160:0);}
function termArt(term,camera,solvedValue=null) {
  const color=term.kind==='variable'?'green':term.value.n<0?'red':'blue';
  const digits=(number,y=0,scale=1)=>[...String(number)].map((d,i,all)=>`<g transform="translate(${i*160*scale} ${y}) scale(${scale})">${tray(Number(d),color,all.length-i-1,camera)}</g>`).join('');
  let result;
  if(term.value.d!==1) {
    const width=Math.max(String(Math.abs(term.value.n)).length,String(term.value.d).length)*160;
    result=`${digits(Math.abs(term.value.n),-47,.64)}<line x1="-3" y1="56" x2="${width*.64}" y2="56" stroke="#171713" stroke-width="3"/>${digits(term.value.d,67,.64)}`;
  } else result=digits(Math.abs(term.value.n));
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
function textures(){return `<defs>${[['blue',25],['red',23],['green',2],['paper',24]].map(([name,id])=>`<pattern id="${name}" width="150" height="150" patternUnits="userSpaceOnUse"><image href="./textures/swf-${id}.jpg" width="150" height="150"/></pattern>`).join('')}</defs>`;}
function renderLayout(scene,options,overrides={}) {
  let body='';
  for(const slot of scene.terms) {
    const {term,side,index,w,h}=slot,override=overrides[term.id]||{},x=override.x??slot.x,y=override.y??slot.y,opacity=override.opacity??1;
    const actual=override.term||term;
    body+=`<g class="term ${term.placeholder?'placeholder':''}" data-term="${esc(term.id)}" data-side="${side}" data-index="${index}" data-x="${round(x)}" data-y="${round(y)}" transform="translate(${round(x)} ${round(y)})" opacity="${opacity}" role="button" tabindex="${term.placeholder?-1:0}" aria-label="${esc(math.termText(actual))}, ${side} side">`;
    body+=`<rect class="hit" x="-6" y="-15" width="${w+12}" height="${h+15}" fill="transparent"/>`;
    if(index>0||actual.value.n<0)body+=`<text x="-47" y="97" text-anchor="middle" font-size="72" pointer-events="none">${actual.value.n<0?'−':'+'}</text>`;
    body+=termArt(actual,options.camera,options.solvedValue).replaceAll('class="numeral"',`class="numeral" opacity="${override.labelOpacity??1}"`)+'</g>';
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
  if(!event || t<.14 || t>.83)return '';
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
  options={orientation:'horizontal',camera:'front',expression:false,...options};
  if((!plan||progress>=.78)&&math.isSolved(equation))options.solvedValue=math.numeric(math.solution(equation).value);
  const after=layout(equation,options);let scene=after,body='';
  if(plan&&progress<1) {
    const before=layout(plan.before,options),p=ease(progress);
    const equal=before.equal&&after.equal?{x:before.equal.x+(after.equal.x-before.equal.x)*p,y:before.equal.y+(after.equal.y-before.equal.y)*p}:after.equal;
    scene={...before,equal,width:before.width+(after.width-before.width)*p,height:before.height+(after.height-before.height)*p,terms:[...before.terms]};
    const overrides={};
    for(const slot of before.terms) {
      const to=after.terms.find(a=>a.term.id===slot.term.id);
      if(to){
        const x=slot.x+(to.x-slot.x)*p,y=slot.y+(to.y-slot.y)*p;
        let crossed=progress>=.5;
        if(plan.command.type==='move'&&slot.term.id===plan.command.id&&equal){const positiveSide=options.orientation==='horizontal'?x+slot.w/2>equal.x:y+75>equal.y;crossed=slot.side==='left'?positiveSide:!positiveSide;}
        overrides[slot.term.id]={x,y,term:plan.command.type==='move'?(crossed?to.term:slot.term):(progress>=.78?to.term:slot.term)};
      }
      else {const target=before.terms.find(a=>a.term.id===plan.command.target)||after.terms.find(a=>a.side===slot.side)||slot;overrides[slot.term.id]={x:slot.x+(target.x-slot.x)*p,y:slot.y+(target.y-slot.y)*p,opacity:1-p};}
      if(['move','reorder'].includes(plan.command.type)&&slot.term.id===plan.command.id){const arc=Math.sin(Math.PI*p);if(options.orientation==='vertical'&&plan.command.type==='move')overrides[slot.term.id].x-=55*arc;else {overrides[slot.term.id].y+=190*arc;scene.height=Math.max(scene.height,overrides[slot.term.id].y+200);}}
      if(plan.command.type==='operate'&&progress>.14&&progress<.78)overrides[slot.term.id].opacity=.16;
      if(plan.command.type==='combine'&&[plan.command.id,plan.command.target].includes(slot.term.id))overrides[slot.term.id].labelOpacity=progress>=.78&&to?1:Math.max(0,1-progress/.18);
    }
    for(const slot of after.terms)if(!before.terms.some(b=>b.term.id===slot.term.id)){scene.terms.push(slot);overrides[slot.term.id]={opacity:p};}
    body=renderLayout(scene,options,overrides);
    body+=overlay(plan,progress,before,options);
  } else body=renderLayout(scene,options);
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Georgia,serif" id="equation-svg" viewBox="0 0 ${round(scene.width)} ${round(scene.height)}" data-orientation="${options.orientation}" data-camera="${options.camera}" data-progress="${round(progress)}" aria-label="${esc(math.equationText(equation))}">${textures()}${body}</svg>`;
}
