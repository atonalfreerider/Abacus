import {numberSpec,placeOffset} from './numbers.js';
import { math } from './model.js';
import {unitFrame} from './units.js';
import { placeMetadata } from '../place-value.js';
import { ease,clamp,operationGroups } from './animation.js';
import { renderOperation } from './operation-view.js';
import { ink,patternDefs,onStyle } from './theme.js';
import { numeral,bases,placeMeta,baseSpec,slotAt,digitGlyph,placeOffsetIn,isGroupEdge } from './bases.js';
import { Fingerprint } from '../numbers/fingerprint.js';
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const round=n=>Math.round(n*1000)/1000;
// Exact place-value text such as 0.001; 10**-3 prints differently across engines.
const decimalUnit=exponent=>exponent<0?'0.'+'0'.repeat(-exponent-1)+'1':String(10**exponent);
export const cameras={front:{pitch:.35},depth:{pitch:1},spread:{pitch:2.5}};
export function stackGeometry(exponent,camera='front',base=numeral.id) {
  const meta=placeMeta(exponent,base),pitch=cameras[camera].pitch;
  return {...meta,pitch,depth:meta.cardCount*pitch,dx:meta.cardCount*pitch,dy:meta.cardCount*pitch};
}
// Behind the top card a stack shows card stock: cream edges with fine separators, and
// every tenth card edged in the stack's colour, so a hundred reads as ten tens. The
// back card outlines the stack. (Near-black edges on every layer fused into a slab.)
export const cardEdge=ink.edge;
export const cardRole=(layer,count)=>layer===1?'top':layer===count?'base':layer%10===1?'group':'support';
export function face(x,y,size,color,meta,attributes='',role='top') {
  if(role!=='top'){const stroke=role==='base'?cardEdge.base:role==='group'?cardEdge.group[color]:ink.edgeLine[color];return `<g ${attributes}><rect x="${round(x)}" y="${round(y)}" width="${role==='base'&&meta.partial<1?round(size*meta.partial):size}" height="${size}" rx="5" fill="${cardEdge.paper}" stroke="${stroke}" stroke-width="${role==='support'?.45:1.1}"/></g>`;}
  const border=1+meta.group*.55;
  if(meta.exponent<0){const inner=round(size*meta.innerScale),inset=(size-inner)/2;return `<g ${attributes}><rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" rx="5" fill="url(#paper)" fill-opacity=".12" stroke="${ink.stroke[color]}" stroke-width="1"/><rect data-inner-area="${meta.base?meta.name:decimalUnit(meta.exponent)}" x="${round(x+inset)}" y="${round(y+inset)}" width="${inner}" height="${inner}" fill="url(#${color})"/></g>`;}

  let svg=`<g ${attributes}><rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" rx="5" fill="url(#${color})" stroke="${ink.stroke[color]}" stroke-width="${border}"/>`;
  for(let level=0;level<Math.min(4,meta.group);level++) {const inset=3+level*3;svg+=`<rect x="${round(x+inset)}" y="${round(y+inset)}" width="${size-2*inset}" height="${size-2*inset}" rx="3" fill="none" stroke="${ink.groupStroke[color]}" stroke-width="${1.2+meta.group*.55}"/>`;}
  if(meta.mark)svg+=`<text x="${round(x+size-7)}" y="${round(y+size-6)}" text-anchor="end" font-size="12" font-weight="bold" fill="${ink.mark[color]}">${meta.mark}</text>`;
  return svg+'</g>';
}
// An LED bulb round a 43-wide box at (x, y), the size of a card: base 2 and balanced
// ternary hold one bit or trit per tray. Lit, it glows in its sign's colour; dark, it is
// a socket with a filament.
export const BULB=37;
export function bulb(x,y,color,opacity=1){
  const b=ink.bulb[color]||ink.bulb.blue,cx=round(x+21.5),cy=round(y+21.5),R=BULB;
  return `<g class="bulb bulb-${color}" opacity="${round(opacity)}"><circle cx="${cx}" cy="${cy}" r="${round(R*1.42)}" fill="${b.glow}" opacity=".14"/><circle cx="${cx}" cy="${cy}" r="${round(R*1.22)}" fill="${b.glow}" opacity=".26"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="${b.body}" stroke="${b.glow}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${round(R*.58)}" fill="${b.core}" opacity=".85"/><ellipse cx="${round(cx-R*.36)}" cy="${round(cy-R*.42)}" rx="${round(R*.26)}" ry="${round(R*.15)}" transform="rotate(-35 ${round(cx-R*.36)} ${round(cy-R*.42)})" fill="#fff" opacity=".75"/></g>`;
}
export function socket(x,y){
  const o=ink.bulb.off,cx=round(x+21.5),cy=round(y+21.5),R=BULB;
  return `<g class="bulb-socket"><circle cx="${cx}" cy="${cy}" r="${R}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="2"/><path d="M${cx-13} ${cy+11}v-9l4.6 -8l4.2 8l4.2 -8l4.2 8l4.2 -8l4.6 8v9" fill="none" stroke="${o.filament}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="${round(cx-R*.36)}" cy="${round(cy-R*.42)}" rx="${round(R*.24)}" ry="${round(R*.13)}" transform="rotate(-35 ${round(cx-R*.36)} ${round(cy-R*.42)})" fill="#fff" opacity=".35"/></g>`;
}
// The numeral under a bulb (a barred 1 for the trit T).
export function bulbNumeral(label,x=75,opacity=1){
  const bar=label==='T';if(bar)label='1';
  return `<text x="${x}" y="127" dominant-baseline="central" text-anchor="middle" class="numeral" font-size="44" fill="#050504" opacity="${opacity}" pointer-events="none">${esc(label)}</text>`+(bar?`<path class="numeral-bar" d="M${x-11} 106h22" stroke="#050504" stroke-width="5" stroke-linecap="round" opacity="${opacity}" pointer-events="none"/>`:'');
}
export function tray(digit,color,exponent=0,camera='front',label=String(digit),unknown=false,base=numeral.id) {
  if(bases[base].bulbs){
    const {x,y}=slotAt(0,base),meta=placeMeta(exponent,base);
    let svg='<rect width="150" height="150" rx="12" fill="url(#paper)" fill-opacity=".16" stroke="#171713" stroke-width="2"/>'+socket(x,y);
    if(digit>0)svg+=unknown?`<g opacity=".25">${bulb(x,y,color)}</g>`:bulb(x,y,color);
    svg+=`<text class="place-value" x="11" y="21" font-size="17" fill="#6d6655" pointer-events="none">${meta.name}</text>`;
    if(label!=='')svg+=bulbNumeral(label);
    return `<g class="digit-tray bulb-tray" data-cards="1" data-stack-depth="0" data-exponent="${exponent}" data-lit="${digit>0?color:'off'}">${svg}</g>`;
  }
  const meta=stackGeometry(exponent,camera,base),size=43;
  let svg='<rect width="150" height="150" rx="12" fill="url(#paper)" fill-opacity=".16" stroke="#171713" stroke-width="2"/>';
  for(let cell=0;cell<bases[base].slots;cell++) {
    const {x,y}=slotAt(cell,base);
    svg+=`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5" fill="none" stroke="#858274" stroke-opacity=".2"/>`;
    if(cell<digit) {
      let clip='';
      if(digit-cell<1){const id=`slice-${exponent}-${cell}-${String(digit).replace('.','_')}`;svg+=`<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${size*(digit-cell)+meta.depth}" height="${size+meta.depth}"/></clipPath></defs>`;clip=` clip-path="url(#${id})"`;}
      svg+=`<g opacity="${unknown?.25:1}"${clip}>${stackUnit(x,y,color,exponent,camera,1,base)}</g>`;
    }
  }
  // Balanced ternary writes the digit −1 as a one with a bar over it.
  const bar=label==='T';if(bar)label='1';
  svg+=`<text x="75" y="75" dominant-baseline="central" text-anchor="middle" class="numeral" font-size="124" fill="#050504" pointer-events="none">${esc(label)}</text>`;
  if(bar)svg+=`<path class="numeral-bar" d="M50 22h50" stroke="#050504" stroke-width="9" stroke-linecap="round" pointer-events="none"/>`;
  return `<g class="digit-tray" data-cards="${meta.cardCount}" data-stack-depth="${meta.depth}" data-exponent="${exponent}">${svg}</g>`;
}
export function commaTriangle(x,decimal=false){return `<g class="${decimal?'decimal-comma':'group-comma'}" transform="translate(${x+5} 0)"><path d="M0 75 L25 50 L25 100 Z" fill="url(#paper)" fill-opacity="${decimal?.16:.75}" stroke="#37362e" stroke-width="1.5"/>${decimal?'<path d="M12 102v32 M12 120l-7 13" fill="none" stroke="#37362e" stroke-dasharray="1 4"/><circle cx="12" cy="120" r="2" fill="#37362e"/>':''}</g>`;}
// The digits run on (base e): an ellipsis after the last tray.
export const ellipsis=x=>`<g class="digit-ellipsis" pointer-events="none">${[0,1,2].map(i=>`<circle cx="${x+14+i*20}" cy="118" r="6" fill="#37362e"/>`).join('')}</g>`;
export function specArt(spec,color,camera,label=true){
  if(!spec.base)return spec.places.map(p=>`<g transform="translate(${p.x} 0)">${tray(label?p.digit:0,color,p.exponent,camera,label?String(p.digit):'',false,'decimal')}</g>`).join('')+spec.markers.map(m=>commaTriangle(m.x,m.decimal)).join('');
  // Other bases: balanced ternary colours each place by its digit's sign.
  const tint=p=>spec.balanced?(p.negative?'red':'blue'):color;
  return spec.places.map(p=>`<g transform="translate(${p.x} 0)">${tray(label?p.digit:0,tint(p),p.exponent,camera,label?digitGlyph(p.signed,spec.base):'',false,spec.base)}</g>`).join('')+spec.markers.map(m=>m.ellipsis?ellipsis(m.x):commaTriangle(m.x,m.decimal)).join('');
}
// The trays a term is drawn with: decimal as numbers.js lays it out, other bases by bases.js.
export function placeSpec(term,base=numeral.id){
  if(base==='decimal')return numberSpec(term);
  if((term.notation==='fraction'||term.notation==='mixed')&&term.value.d!==1)return null;
  return baseSpec(term.value,base);
}
// How many trays a whole number takes in a base (for fractions drawn as numerator over denominator).
const wholeWidth=(n,base)=>base==='decimal'?String(Math.abs(n)).length:baseSpec({n:Math.abs(n),d:1},base).places.length;
export const OPERATOR_GAP=110,DOT_GAP=46,PAREN=58,EXPONENT=64;
// Operands of a product render as constants coloured by their own sign.
export const operandTerm=o=>({kind:'constant',value:math.abs(o.value),notation:o.notation,decimalPlaces:o.decimalPlaces,negative:o.value.n<0});
// Order of operations: a parenthesised sum shows its own cards between parentheses
// (red where the minus outside applies), and a power shows its base with the exponent
// raised beside it.
export function operandWidth(o){
  if(o.group)return 2*PAREN+o.group.reduce((w,t,i)=>w+termWidth(addend(t,false))+(i?OPERATOR_GAP:0),0);
  if(o.base)return operandWidth(o.base)+(o.base.base?2*PAREN:0)+EXPONENT;
  return termWidth(operandTerm(o));
}
const addend=(t,flip)=>t.expr?t:{kind:'constant',value:math.abs(t.value),notation:t.notation,decimalPlaces:t.decimalPlaces,negative:(t.value.n<0)!==flip};
const glyph=(x,text,size=150,y=118)=>`<text x="${round(x)}" y="${y}" text-anchor="middle" font-size="${size}" class="operator paren" pointer-events="none">${text}</text>`;
export function operandArt(o,camera,flip=false){
  if(o.group){
    flip=flip!==!!o.negated;let x=PAREN,art=glyph(PAREN/2,'(');
    o.group.forEach((t,i)=>{if(i){art+=`<text x="${x+OPERATOR_GAP/2}" y="97" text-anchor="middle" font-size="76" class="operator" pointer-events="none">${math.negative(t)?'−':'+'}</text>`;x+=OPERATOR_GAP;}const term=addend(t,flip);art+=`<g transform="translate(${x} 0)">${termArt(term,camera)}</g>`;x+=termWidth(term);});
    return art+glyph(x+PAREN/2,')');
  }
  if(o.base){
    const inner=o.base.base,base=inner?glyph(PAREN/2,'(')+`<g transform="translate(${PAREN} 0)">${operandArt(o.base,camera,flip!==!!o.negated)}</g>`+glyph(PAREN+operandWidth(o.base)+PAREN/2,')'):operandArt(structuredBase(o.base,flip!==!!o.negated),camera);
    const w=operandWidth(o.base)+(inner?2*PAREN:0);
    return base+`<text x="${w+EXPONENT/2}" y="52" text-anchor="middle" font-size="84" class="exponent" pointer-events="none">${o.power}</text>`;
  }
  return termArt(operandTerm(o),camera);
}
// A plain base takes the power's sign colour: −3² shows red threes.
const structuredBase=(b,flip)=>b.group?{...b,negated:flip!==!!b.negated}:flip?{...b,value:math.neg(b.value)}:b;
export function mixedParts(value){const n=Math.abs(value.n),d=value.d;return {whole:Math.floor(n/d),remainder:n%d,denominator:d};}
export function termWidth(term){
  if(term.expr)return term.expr.operands.reduce((w,o)=>w+operandWidth(o),0)+OPERATOR_GAP*term.expr.ops.length;
  if(term.notation==='mixed'&&term.value.d!==1){const {whole}=mixedParts(term.value);return (whole?(numeral.id==='decimal'?String(whole).length*160:placeSpec({kind:'constant',value:math.frac(whole),notation:'auto'}).width):0)+160;}
  if(term.kind==='variable'&&Math.abs(term.value.n)===term.value.d)return 160;const spec=placeSpec(term);return (spec?spec.width:Math.max(wholeWidth(term.value.n,numeral.id),wholeWidth(term.value.d,numeral.id))*160)+(term.kind==='variable'?DOT_GAP+160:0);}
// A card cut into equal vertical slices; `count` of them remain.
export function sliceTray(count,denominator,color,camera,label=`${count}/${denominator}`){
  let art=tray(count/denominator,color,0,camera,'',false,'decimal');
  const slice=43/denominator;art+=`<rect x="7" y="7" width="43" height="43" rx="5" fill="none" stroke="#25241e" stroke-opacity=".55" stroke-dasharray="3 3"/>`;
  if(denominator<=24)for(let k=1;k<denominator;k++)art+=`<line x1="${round(7+k*slice)}" y1="9" x2="${round(7+k*slice)}" y2="48" stroke="#25241e" stroke-opacity=".5" stroke-width="${k<count?1:.6}"/>`;
  return art+`<text x="75" y="104" dominant-baseline="central" text-anchor="middle" class="numeral slice-label" font-size="58" fill="#050504" pointer-events="none">${esc(label)}</text>`;
}
// Operand offsets inside a product term, from its left edge.
export const operandOffsets=term=>{let x=0;return term.expr.operands.map((o,i)=>{if(i)x+=OPERATOR_GAP;const at=x;x+=operandWidth(o);return at;});};
// `from` omits leading operands, for a chain whose first pair is being worked out.
export function operationArt(term,camera,from=0){
  let x=0,art='';
  term.expr.operands.forEach((o,i)=>{
    if(i<from){x+=operandWidth(o)+(i?OPERATOR_GAP:0);return;}
    if(i){art+=`<text x="${x+OPERATOR_GAP/2}" y="97" text-anchor="middle" font-size="76" class="operator" pointer-events="none">${term.expr.ops[i-1]}</text>`;x+=OPERATOR_GAP;
      if(math.operandNegative(o))art+=`<text x="${x-10}" y="62" text-anchor="middle" font-size="54" fill="#8c2a17" pointer-events="none">−</text>`;}
    art+=`<g class="operand${math.structured(o)?' structured':''}" data-operand="${i}" transform="translate(${x} 0)">${operandArt(o,camera)}</g>`;x+=operandWidth(o);
  });
  const left=from?operandOffsets(term)[from]-OPERATOR_GAP:0;
  return `<rect class="operation-frame" x="${left-16}" y="-14" width="${x-left+32}" height="178" rx="20" fill="#fffdf2" fill-opacity=".35" stroke="#6d6655" stroke-width="2" stroke-dasharray="7 6"/>`+art;
}
export function termArt(term,camera,solvedValue=null) {
  if(term.expr)return operationArt(term,camera);
  const color=term.value.n<0||term.negative?'red':'blue';
  if(term.notation==='mixed'&&term.value.d!==1){const {whole,remainder,denominator}=mixedParts(term.value),spec=whole?placeSpec({kind:'constant',value:math.frac(whole),notation:'auto'}):null;return (spec?specArt(spec,color,camera):'')+`<g transform="translate(${spec?spec.width:0} 0)">${sliceTray(remainder,denominator,color,camera)}</g>`;}
  const digits=(number,y=0,scale=1)=>numeral.id==='decimal'?[...String(number)].map((d,i,all)=>`<g transform="translate(${i*160*scale} ${y}) scale(${scale})">${tray(Number(d),color,all.length-i-1,camera)}</g>`).join(''):`<g transform="translate(0 ${y}) scale(${scale})">${specArt(baseSpec({n:number,d:1}),color,camera)}</g>`;
  let result;
  const spec=placeSpec(term);
  if(!spec) {
    const width=Math.max(wholeWidth(term.value.n,numeral.id),wholeWidth(term.value.d,numeral.id))*160;
    result=`${digits(Math.abs(term.value.n),-47,.64)}<line x1="-3" y1="56" x2="${width*.64}" y2="56" stroke="#171713" stroke-width="3"/>${digits(term.value.d,67,.64)}`;
  } else result=specArt(spec,color,camera);
  if(term.kind==='variable') {
    if(Math.abs(term.value.n)===term.value.d)result=tray(solvedValue!==null?Math.min(9,Math.abs(solvedValue)):9,'green',0,camera,'X',solvedValue===null,'decimal');
    // A coefficient multiplies x: a dot sits between the number cards and the x tray.
    else result+=`<circle class="multiplier-dot" cx="${termWidth(term)-160-DOT_GAP/2}" cy="75" r="7" fill="#25241e"/><g transform="translate(${termWidth(term)-160} 0)">${tray(9,'green',0,camera,'X',true,'decimal')}</g>`;
  }
  return result;
}
// View ▸ Prime fingerprints: each whole number's prime components drawn under its cards
// in the marble language (src/numbers/fingerprint.js), in a band FINGERPRINT tall.
export const FINGERPRINT=86;
const fingerprints=new Map();onStyle(()=>fingerprints.clear());
export function termFingerprint(term,w){
  if(term.expr||term.kind!=='constant'||term.value.d!==1||term.placeholder)return '';
  const n=Math.abs(term.value.n);if(n<2)return '';
  let art=fingerprints.get(n);
  if(!art){const {body,bounds}=new Fingerprint(n).render(0,{palette:ink.marble});art={body,bounds};if(fingerprints.size>200)fingerprints.clear();fingerprints.set(n,art);}
  const b=art.bounds,pad=.5,vw=b.width+2*pad,vh=b.height+2*pad,scale=Math.min((FINGERPRINT-10)/vh,(w-8)/vw),width=vw*scale,height=vh*scale;
  return `<svg class="term-fingerprint" x="${round((w-width)/2)}" y="${round(178+(FINGERPRINT-10-height)/2)}" width="${round(width)}" height="${round(height)}" viewBox="${round(b.x-pad)} ${round(b.y-pad)} ${round(vw)} ${round(vh)}" pointer-events="none">${art.body}</svg>`;
}
export function layout(equation,{orientation='horizontal',camera='front',expression=false,fingerprints=false}={}) {
  const depth=stackGeometry(2,camera).depth, gap=95, margin=depth+32, extra=fingerprints?FINGERPRINT:0;
  const rows={};let width=0,height=0;
  for(const side of ['left','right']) {
    let cursor=margin;
    rows[side]=(equation[side].length?equation[side]:[{id:`zero-${side}`,kind:'constant',value:math.frac(0),placeholder:true}]).map((term,index)=>{
      const w=termWidth(term);const r={term,side,index,x:cursor,y:margin,w,h:170};cursor+=w+gap;return r;
    });width=Math.max(width,cursor-gap+margin);
  }
  let equal;
  if(orientation==='vertical') {
    height=(190+2*margin)*2+100+2*extra;equal={x:width/2,y:height/2};
    for(const side of ['left','right']){const rowWidth=rows[side].at(-1).x+rows[side].at(-1).w+margin;rows[side].forEach(t=>t.x+=(width-rowWidth)/2);}
    rows.left.forEach(t=>t.y=margin);rows.right.forEach(t=>t.y=height/2+85+extra);
  } else {
    const leftWidth=rows.left.at(-1).x+rows.left.at(-1).w+margin;
    equal={x:leftWidth+55,y:margin+75};rows.right.forEach(t=>t.x+=leftWidth+120);
    width=rows.right.at(-1).x+rows.right.at(-1).w+margin;height=220+margin*2+extra;
  }
  if(expression){rows.right=[];width=rows.left.at(-1).x+rows.left.at(-1).w+margin;equal=null;height=220+margin*2+extra;}
  return {terms:[...rows.left,...rows.right],width,height,equal,orientation};
}
// Stacks are shared definitions, one per colour, place and camera (and base, outside decimal).
export const stackId=(color,exponent,camera,base=numeral.id)=>`stack-${color}-${base==='decimal'?'':base}${String(exponent).replace('-','m')}-${camera}`;
export function stackUnit(x,y,color,exponent,camera='front',opacity=1,base=numeral.id){return `<use class="unit-stack" href="#${stackId(color,exponent,camera,base)}" data-place="${exponent}" data-cards="${placeMeta(exponent,base).cardCount}" x="${round(x)}" y="${round(y)}" opacity="${opacity}"/>`;}
const stackCache=new Map();onStyle(()=>stackCache.clear());
export const stackIds=body=>[...new Set([...body.matchAll(/href="#(stack-(blue|red|green)-((?:binary|ternary|e)?m?\d+)-(front|depth|spread))"/g)].map(m=>m[1]))];
export function parseStackId(id){const [,color,place,camera]=id.split('-'),[,base='decimal',minus,digits]=place.match(/^(binary|ternary|e)?(m?)(\d+)$/);return {color,camera,base,meta:stackGeometry(Number((minus?'-':'')+digits),camera,base)};}
// Vector card faces for one cached stack; the browser may swap in a raster of the same drawing.
export function stackContent(id){if(stackCache.has(id))return stackCache.get(id);const {color,meta}=parseStackId(id);let content='';for(let layer=meta.cardCount;layer>=1;layer--)content+=face(layer*meta.pitch,layer*meta.pitch,43,color,meta,`class="card-face" data-layer="${layer}" data-group="${meta.mark}"`,cardRole(layer,meta.cardCount));stackCache.set(id,content);return content;}
// A value's trays in a base as a standalone <svg> (the Numbers view writes a number in
// every base). Its pattern and stack ids are prefixed, so it never borrows another
// drawing's definitions.
export function cardsSVG(value,base,{camera='front',prefix='c-',label=true}={}){
  const spec=placeSpec({kind:'constant',value,notation:'auto'},base);if(!spec)return '';
  let art=specArt(spec,value.n<0?'red':'blue',camera,label);
  const defs=stackIds(art).map(id=>`<g id="${prefix}${id}">${stackContent(id)}</g>`).join('');
  const own=text=>text.replace(/url\(#(blue|red|green|paper)\)/g,`url(#${prefix}$1)`).replace(/href="#stack-/g,`href="#${prefix}stack-`);
  const depth=stackGeometry(2,camera,base).depth;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="card-row" viewBox="-6 -50 ${round(spec.width+12)} ${round(206+depth)}" font-family="Georgia,serif" role="img"><defs>${patternDefs(prefix)}${own(defs)}</defs>${own(art)}</svg>`;
}
function stackDefinitions(body){return '<defs>'+stackIds(body).map(id=>`<g id="${id}">${stackContent(id)}</g>`).join('')+'</defs>';}
export {textureSources} from './theme.js';
export const textureDefs=()=>patternDefs();
function textures(){return `<defs>${textureDefs()}</defs>`;}
export function renderLayout(scene,options,overrides={}) {
  let body='';
  for(const slot of [...scene.terms].sort((a,b)=>Number(a.term.id===options.foreground)-Number(b.term.id===options.foreground))) {
    const {term,side,index,w,h}=slot,override=overrides[term.id]||{},x=override.x??slot.x,y=override.y??slot.y,opacity=override.opacity??1;
    const actual=override.term||term;
    body+=`<g class="term ${term.placeholder?'placeholder':''}${actual.expr?' operation':''}" data-term="${esc(term.id)}" data-side="${side}" data-index="${index}" data-x="${round(x)}" data-y="${round(y)}" transform="translate(${round(x)} ${round(y)})" opacity="${opacity}" role="button" tabindex="${term.placeholder?-1:0}" aria-label="${esc(math.termText(actual))}, ${side} side">`;
    body+=`<rect class="hit" x="-6" y="-15" width="${w+12}" height="${h+15}" fill="transparent"/>`;
    // Balanced ternary needs no minus sign: a constant's trits carry its sign (x + T11 = 111).
    const signed=bases[numeral.id].balanced&&!actual.expr&&actual.kind==='constant'&&!!placeSpec(actual);
    if(signed?index>0:index>0||math.negative(actual))body+=`<text x="-47" y="97" text-anchor="middle" font-size="72" pointer-events="none">${math.negative(actual)&&!signed?'−':'+'}</text>`;
    body+=(override.art??termArt(actual,options.camera,options.solvedValue)).replaceAll('class="numeral"',`class="numeral" opacity="${override.labelOpacity??1}"`)+(options.fingerprints&&!override.art?termFingerprint(actual,w):'')+'</g>';
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
// A drag release hands over where every card and the mirror were when it let go.
function applyOrigin(scene,origin){
  if(!origin)return scene;
  for(const slot of scene.terms){const at=origin.positions?.[slot.term.id];if(at){slot.x=at.x;slot.y=at.y;}}
  if(origin.equal&&scene.equal)scene.equal={...scene.equal,...origin.equal};
  return scene;
}
export function renderEquation(equation,options={},plan=null,progress=1) {
  const frame=renderScene(equation,options,plan,progress);
  return `<svg xmlns="http://www.w3.org/2000/svg" font-family="Georgia,serif" id="equation-svg" viewBox="${frame.viewBox}" data-orientation="${frame.orientation}" data-camera="${frame.camera}" data-progress="${round(progress)}" aria-label="${esc(frame.label)}">${textures()}${stackDefinitions(frame.body)}${frame.body}</svg>`;
}
// Scene body without shared definitions, for a persistent SVG that keeps textures and stacks decoded.
export function renderScene(equation,options={},plan=null,progress=1) {
  options={orientation:'horizontal',camera:'front',expression:false,...options};options.foreground=options.drag?.id||(plan?.origin?plan.command.id:null);
  if((!plan||progress>=.78)&&math.isSolved(equation))options.solvedValue=math.numeric(math.solution(equation).value);
  const after=layout(equation,options);let scene=after,body='';
  if(plan?.op&&progress<1){const frame=renderOperation(plan,progress,options);scene=frame.scene;body=frame.body;}
  else if(plan?.units&&progress<1){const frame=renderUnits(plan,progress,options);scene=frame.scene;body=frame.body;}
  else if(plan&&progress<1) {
    const before=applyOrigin(layout(plan.before,options),plan.origin),p=ease(progress);
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
      // A parentheses or exponent step: the old cards fade into the new, under a caption.
      if(plan.caption&&to&&slot.term.id===plan.command.id){const out=1-ease((progress-.22)/.3),inn=ease((progress-.48)/.3),say=Math.min(1,Math.sin(Math.PI*clamp(progress/.95))*1.6);overrides[slot.term.id].term=to.term;overrides[slot.term.id].art=`<g opacity="${round(out)}">${termArt(slot.term,options.camera)}</g><g opacity="${round(inn)}" transform="translate(${round((slot.w-to.w)/2*(1-inn))} 0)">${termArt(to.term,options.camera)}</g><text class="step-caption" x="${round(Math.max(slot.w,to.w)/2)}" y="-34" text-anchor="middle" font-size="40" opacity="${round(say)}">${esc(plan.caption)}</text>`;}
      if(plan.command.type==='combine'&&[plan.command.id,plan.command.target].includes(slot.term.id))overrides[slot.term.id].labelOpacity=progress>=.78&&to?1:Math.max(0,1-progress/.18);
    }
    for(const slot of after.terms)if(!before.terms.some(b=>b.term.id===slot.term.id)){scene.terms.push(slot);overrides[slot.term.id]={opacity:p};}
    body=renderLayout(scene,options,overrides);
    body+=overlay(plan,progress,before,options);
  } else {const overrides={};if(options.drag){const d=options.drag,slot=scene.terms.find(t=>t.term.id===d.id);if(slot)overrides[d.id]={x:d.x,y:d.y,term:slot.side===d.side?slot.term:math.negateTerm(slot.term)};}body=renderLayout(scene,options,overrides);}
  return {viewBox:`${round(scene.minX||0)} ${round(scene.minY||0)} ${round(scene.width-(scene.minX||0))} ${round(scene.height-(scene.minY||0))}`,orientation:options.orientation,camera:options.camera,label:math.equationText(equation),body,scene};
}
// Particles for active ledger phases; shared by addition and the operation scenes.
export function phaseParticles(active,{pos,draw,color,camera,shift=0,base='decimal'}){
 let particles='';const lerp=(a,b,q)=>a+(b-a)*q;
 for(const {phase,progress:q} of active){
  if(phase.type==='settle')for(const token of phase.before){const next=phase.after.find(a=>a.id===token.id),a=pos(token),b=pos(next||token);particles+=draw(token,{x:lerp(a.x,b.x,ease(q)),y:lerp(a.y,b.y,ease(q))});}
  if(phase.type==='transfer'){
   const token=phase.before.find(a=>a.id===phase.removed[0]),next=phase.after.find(a=>a.id===token.id),a=pos(token),b=pos(next);particles+=draw(token,{x:lerp(a.x,b.x,ease(q)),y:lerp(a.y,b.y,ease(q))});
  } else if(phase.type==='pair'){
   // Balanced ternary: a zero pair (+1 and −1) opens out of nothing beside two like cards.
   const k=ease(q),pair=phase.after.filter(a=>phase.created.includes(a.id));
   for(const token of pair){const at=pos(token),c={x:at.x+21.5,y:at.y+21.5},scale=round(.25+.75*k);particles+=`<g transform="translate(${round(c.x*(1-scale))} ${round(c.y*(1-scale))}) scale(${scale})">${draw(token,at,round(k))}</g>`;}
   if(q<.6){const at=pos(pair[0]);particles+=`<circle class="pair-burst" cx="${round(at.x+21.5)}" cy="${round(at.y+21.5)}" r="${round(36-24*q/.6)}" fill="none" stroke="#fffbe6" stroke-width="${round(1+4*q)}" opacity="${round(.9*(1-q/.6))}"/>`;}
  } else if(phase.type==='neutralize'){
   // Both cards already coincide on the receiver; they collapse together into a small burst.
   const pair=phase.before.filter(a=>phase.removed.includes(a.id)),at=pos(phase.receiver),k=ease((q-.4)/.6),c={x:at.x+21.5,y:at.y+21.5},scale=round(1-.75*k);
   const squeeze=`translate(${round(c.x*(1-scale))} ${round(c.y*(1-scale))}) scale(${scale})`;
   for(const token of pair)particles+=`<g data-cancel-target="${phase.receiver.id}" data-target-cell="${phase.receiver.cell}" transform="${squeeze}">${draw(token,at,round(1-k))}</g>`;
   if(q>.4)particles+=`<circle class="cancel-burst" cx="${round(c.x)}" cy="${round(c.y)}" r="${round(8+30*k)}" fill="none" stroke="#fffbe6" stroke-width="${round(6*(1-k)+.5)}" opacity="${round(.9*(1-k))}"/>`;
  } else if(phase.type==='carry'||phase.type==='borrow'){
   const carry=phase.type==='carry',many=(carry?phase.before:phase.after).filter(a=>(carry?phase.removed:phase.created).includes(a.id));
   const single=(carry?phase.after:phase.before).find(a=>a.id===(carry?phase.created[0]:phase.removed[0]));
   const end=pos(single),pitch=cameras[camera].pitch,depth=placeMeta(many[0].place+shift,base).cardCount*pitch;
   // Two stages, so the regrouping can be followed: ten cards gather into one stack in
   // their own tray (g), then the stack slides one tray over (f). A borrow plays it backwards.
   const c=carry?q:1-q,g=ease(c/.5),f=ease((c-.5)/.5),comma=!bases[base].bulbs&&((single.place+shift)%bases[base].group===0||many[0].place+shift<0);
   const home=pos({...single,place:many[0].place}),slide={x:(end.x-home.x)*f,y:(end.y-home.y)*f};
   // Adjacent depth ranges form exactly the same cached 10/100 stack as the settled unit.
   // At a comma, compress the old depth group into the next inscribed face.
   for(let i=0;i<many.length;i++){const token=many[i],start=pos(token),compression=comma?1/(1+999*f):1,offset=(many.length-1-i)*depth*compression,point={x:lerp(start.x,home.x+offset,g)+slide.x,y:lerp(start.y,home.y+offset,g)+slide.y};
    if(comma&&compression>.98)particles+=`<g opacity="${round(1-ease((f-.75)/.25))}">${draw(token,point)}</g>`;
    else if(comma){
     // Faces closer than ~1.2px read as one edge band, so draw only that many layers.
     const meta=stackGeometry(token.place+shift,camera,base),layers=Math.min(meta.cardCount,Math.max(1,Math.ceil(meta.cardCount*pitch*compression/1.2)));let drawing='';
     for(let k=layers;k>=1;k--){const d=(k/layers)*meta.cardCount*pitch*compression;drawing+=face(point.x+d,point.y+d,43,color(token),meta,'',cardRole(k,layers));}
     particles+=`<g data-unit="${token.id}" opacity="${round(1-ease((f-.75)/.25))}">${drawing}</g>`;
    }
    else particles+=draw(token,point);
   }
   if(comma)particles+=draw(single,end,ease((f-.75)/.25));
  }
 }
 return particles;
}
function renderUnits(plan,t,options){
 const before=applyOrigin(layout(plan.before,options),plan.origin),after=layout(plan.after,options),u=plan.units,p=ease(t),overrides={};
 const source=before.terms.find(s=>s.term.id===u.source),target=before.terms.find(s=>s.term.id===u.target);
 // A target that cancels to zero has no slot afterwards; its cards vanish where they were.
 const base=u.base||'decimal',placeOffset=place=>placeOffsetIn(place,base);
 const result=after.terms.find(s=>s.term.id===u.target)||after.terms.find(s=>s.side===target.side&&placeSpec(s.term,base))||{...target,term:{kind:'constant',value:math.frac(0),notation:'auto'}};
 const spec=term=>placeSpec(term,base),digits=term=>spec(term).places.length;
 const boundary=term=>-placeOffset(spec(term).maxPlace),shift=u.placeShift||0;
 const lerp=(a,b,q=p)=>a+(b-a)*q;
 const anchor={x:lerp(target.x+boundary(target.term),result.x+boundary(result.term)),y:lerp(target.y,result.y)};
 const frame=unitFrame(u,clamp(t/.9)),phase=frame.phase;
 const sourceOrigin=plan.origin||source;
 const sourceAt={x:sourceOrigin.x,y:sourceOrigin.y};
 const scene={...before,width:lerp(before.width,after.width),height:Math.max(before.height,after.height),terms:[...before.terms],equal:before.equal&&after.equal?{x:lerp(before.equal.x,after.equal.x),y:lerp(before.equal.y,after.equal.y)}:null};
 const maxPlace=Math.max(spec(target.term).maxPlace,...u.initial.map(a=>a.place+shift),...u.final.map(a=>a.place+shift)),minPlace=Math.min(spec(target.term).minPlace,spec(source.term).minPlace,0,...u.initial.map(a=>a.place+shift),...u.final.map(a=>a.place+shift));
 function pos(token){if(token.owner===u.target&&u.cancelTargets?.[token.id])token=u.cancelTargets[token.id];const owner=token.owner===u.target?anchor:{x:sourceAt.x+boundary(source.term),y:sourceAt.y};const cell=token.cell;
  // A full tray has no more cells: extra cards wait on its rim until a whole stack regroups.
  const slot=slotAt(cell,base);return {x:owner.x+placeOffset(token.place+shift)+slot.x,y:owner.y+slot.y};
 }
 for(const slot of before.terms){const to=after.terms.find(s=>s.term.id===slot.term.id);if(to)overrides[slot.term.id]={x:lerp(slot.x,to.x),y:lerp(slot.y,to.y)};}
 const empty=term=>specArt(spec(term),'blue',options.camera,false);
 const sourceRemaining=frame.tokens.some(a=>a.owner===u.source)||frame.active.some(a=>a.phase.before.some(t=>a.phase.removed.includes(t.id)&&t.owner===u.source));
 overrides[u.source]={x:sourceAt.x,y:sourceAt.y,term:plan.command.side?math.negateTerm(source.term):source.term,opacity:sourceRemaining?1:0,art:empty(source.term),labelOpacity:0};
 let boxes='';for(let place=minPlace;place<=maxPlace;place++){const old=place>=spec(target.term).minPlace&&place<=spec(target.term).maxPlace,final=place>=spec(result.term).minPlace&&place<=spec(result.term).maxPlace,opacity=(old?1:clamp(t*8))*(final?1:1-ease((t-.9)/.1));const x=anchor.x+placeOffset(place)-target.x;boxes+=`<g opacity="${opacity}" transform="translate(${x} ${anchor.y-target.y})">${tray(0,'blue',place,options.camera,'',false,base)}</g>`;if(place<maxPlace&&isGroupEdge(place,base))boxes+=`<g transform="translate(0 ${anchor.y-target.y})">${commaTriangle(x-40,place===-1)}</g>`;}
 overrides[u.target]={x:target.x,y:target.y,term:t>.9?result.term:target.term,art:boxes,labelOpacity:0};
 let body=renderLayout(scene,options,overrides),particles='';
 const color=token=>token.sign<0?'red':'blue';
 const lights=!!bases[base].bulbs;
 const draw=(token,point,opacity=1)=>`<g data-unit="${token.id}" data-sign="${token.sign}" data-place="${token.place}">${lights?bulb(point.x,point.y,color(token),opacity):stackUnit(point.x,point.y,color(token),token.place+shift,options.camera,opacity,base)}</g>`;
 for(const token of frame.tokens)particles+=draw(token,pos(token));
 particles+=phaseParticles(frame.active,{pos,draw,color,camera:options.camera,shift,base});
 // Numerals fade out at pickup and return only after the units reach their settled cells.
 let numerals='';const labels=t<.06?1-t/.06:t>.9?(t-.9)/.1:0;
 if(labels){for(const [slot,term] of (t<.06?[[target,target.term],[{...source,...sourceAt},source.term]]:[[result,result.term]])){for(const digit of spec(term).places){const glyph=digit.signed===undefined?digit.digit:digitGlyph(digit.signed,base);if(lights){numerals+=`<g transform="translate(${slot.x+digit.x} ${slot.y})">${bulbNumeral(glyph,75,labels)}</g>`;continue;}numerals+=`<text x="${slot.x+digit.x+75}" y="${slot.y+75}" dominant-baseline="central" text-anchor="middle" font-size="124" opacity="${labels}">${glyph==='T'?'1':glyph}</text>`+(glyph==='T'?`<path class="numeral-bar" d="M${slot.x+digit.x+50} ${slot.y+22}h50" stroke="#050504" stroke-width="9" stroke-linecap="round" opacity="${labels}"/>`:'');}}}

 body+=`<g class="unit-animation" data-phase="${phase?.type||'settled'}" pointer-events="none">${particles}</g>`+numerals;
 const expand=ease(t/.15)*(1-ease((t-.9)/.1));scene.minX=Math.min(0,anchor.x+placeOffset(maxPlace)-8)*expand;scene.minY=Math.min(0,sourceAt.y-20)*expand;scene.width=lerp(scene.width,Math.max(scene.width,sourceAt.x+source.w+stackGeometry(2,options.camera,base).depth+20),expand);scene.height=lerp(before.height,after.height,p)+Math.max(0,sourceAt.y+200+stackGeometry(2,options.camera,base).depth-before.height)*expand;
 return {scene,body};
}
