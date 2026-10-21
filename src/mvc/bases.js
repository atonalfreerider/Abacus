// Number bases for the card trays. Decimal is the original abacus; the others write the
// same exact value with other place values:
// * base 2: digits 0 and 1, places 2^k. A stack holds 1, 2, 4 or 8 cards, then restarts
//   with a mark (2⁴, 2⁸, …), as decimal restarts at k, M and B.
// * balanced ternary: digits −1, 0 and 1 (written T, 0, 1), places 3^k. A digit −1 is a
//   red card in a place, +1 a blue one, so a number needs no sign: −5 = T11 = −9 + 3 + 1.
// * base e: digits 0, 1 and 2, places e^k, by the greedy expansion. e is transcendental,
//   so only 0, 1 and 2 end; every other number runs on and is cut off with an ellipsis.
//   A stack of e^k cards is ⌊e^k⌋ whole cards and one sliced card.
// Numbers are exact rationals {n, d}; base e is the only base computed in floating point.
import { placeMetadata as decimalMeta } from '../place-value.js';
export const bases={
 decimal:{id:'decimal',name:'Decimal',short:'10',radix:10,group:3,slots:9,sub:'₁₀'},
 binary:{id:'binary',name:'Base 2',short:'2',radix:2,group:4,slots:1,sub:'₂'},
 ternary:{id:'ternary',name:'Balanced ternary',short:'±3',radix:3,group:3,slots:1,balanced:true,sub:' bal₃'},
 e:{id:'e',name:'Base e',short:'e',radix:Math.E,group:3,slots:2,sub:'ₑ',fraction:3,irrational:true},
};
export const baseOrder=['decimal','binary','ternary','e'];
// The live choice for the equation space (the tutor's lessons always count in tens).
export const numeral={id:'decimal'};
const listeners=new Set();
export const onBase=fn=>listeners.add(fn);
export function setBase(id){if(!bases[id])throw Error('Unknown number base.');if(numeral.id===id)return;numeral.id=id;for(const fn of listeners)fn(id);}
const SUP='⁰¹²³⁴⁵⁶⁷⁸⁹',sup=k=>String(k).replace(/\d/g,d=>SUP[d]).replace('-','⁻');
// Card slots in a tray (x, y of each card's corner in the 150-wide tray). Every base fills
// the decimal grid's cells in the same order, so a 1 is always the top-left card and a 2
// the top row's first two; a base just has fewer cells. Further cards wait on the rim.
export function slotAt(cell,base=numeral.id){
 const slots=bases[base].slots;
 return cell<slots?{x:7+cell%3*47,y:7+Math.floor(cell/3)*47}:{x:54+(cell-slots)*6,y:-43-(cell-slots)*6};
}
// What one card stack of place k holds, and how it is drawn.
export function placeMeta(exponent,base=numeral.id){
 const b=bases[base];
 if(base==='decimal')return decimalMeta(exponent);
 const magnitudeOf=k=>b.radix**k;
 if(exponent<0)return {exponent,base,group:0,local:0,magnitude:magnitudeOf(exponent),cardCount:1,supportCards:0,partial:1,mark:'',name:'fraction',innerScale:Math.sqrt(magnitudeOf(exponent))};
 const group=Math.floor(exponent/b.group),local=exponent%b.group,size=b.radix**local,cardCount=Math.ceil(size-1e-9);
 const symbol=base==='e'?'e':String(b.radix);
 return {exponent,base,group,local,magnitude:size,cardCount,supportCards:cardCount-1,
  // the back card of an e^k stack is sliced to the fractional part
  partial:size-Math.floor(size+1e-9)||1,mark:group?symbol+sup(group*b.group):'',name:`${symbol}${sup(exponent)}`,innerScale:1};
}
// Horizontal offset of place k from a number's units boundary: trays 160 wide, and a
// 40-wide marker after every group of places (a comma) and at the radix point.
export function placeOffsetIn(place,base=numeral.id){
 const g=bases[base].group;
 return place>=0?-(place+1)*160-Math.floor(place/g)*40:(-place-1)*160+(Math.floor(-place/g)+1)*40;
}
export const isGroupEdge=(place,base=numeral.id)=>{const g=bases[base].group;return place===-1||place>=0&&place%g===g-1||place<0&&place%g===0;};
// ---- digits ----
const abs=n=>n<0n?-n:n;
const powerOf=(d,r)=>{let k=0;while(d>1n&&d%r===0n){d/=r;k++;}return d===1n?k:-1;};
// Digits of a whole number, least significant first: [{place, digit}] (signed for balanced ternary).
export function wholeDigits(n,base){
 n=BigInt(n);const b=bases[base],out=[];
 if(b.balanced){let m=n,place=0;while(m!==0n){let r=((m%3n)+3n)%3n;let digit=r===2n?-1:Number(r);m=(m-BigInt(digit))/3n;out.push({place:place++,digit});}return out;}
 const r=BigInt(b.radix);let m=abs(n),place=0;while(m>0n){out.push({place:place++,digit:Number(m%r)});m/=r;}return out;
}
// The places of a rational value in a base, most significant first, or null when it does
// not end (base 2 needs a power-of-two denominator, balanced ternary a power of three).
// Base e always ends after `fraction` places, marked inexact unless the value is 0, 1 or 2.
export function digitsOf(value,base=numeral.id,{fraction}={}){
 const b=bases[base],n=BigInt(value.n),d=BigInt(value.d);
 if(b.irrational){
  let v=Math.abs(Number(value.n)/Number(value.d));const sign=value.n<0?-1:1,places=[],low=-(fraction??b.fraction);
  if(v===0)return {places:[{exponent:0,digit:0}],exact:true,minPlace:0,maxPlace:0};
  let top=Math.max(0,Math.floor(Math.log(v)+1e-12));
  if(Math.E**top>v*(1+1e-12))top--;
  for(let k=Math.max(top,0);k>=low;k--){const p=Math.E**k;let digit=Math.min(2,Math.floor(v/p+1e-11));if(digit<0)digit=0;v-=digit*p;if(Math.abs(v)<1e-11)v=0;places.push({exponent:k,digit:sign*digit});if(!v&&k<=0)break;}
  // trailing zeros after the point say nothing
  while(places.length>1&&places.at(-1).exponent<0&&!places.at(-1).digit)places.pop();
  return {places,exact:v===0,minPlace:places.at(-1).exponent,maxPlace:places[0].exponent};
 }
 const k=powerOf(d,BigInt(b.radix));if(k<0)return null;
 // value · radix^k is whole: write it, then move the point k places
 const scaled=n*BigInt(b.radix)**BigInt(k)/d,sign=n<0n?-1:1;
 let digits=wholeDigits(scaled,base).map(x=>({exponent:x.place-k,digit:b.balanced?x.digit:sign*x.digit}));
 if(!digits.length)digits=[{exponent:0,digit:0}];
 // write at least the units place
 const have=new Set(digits.map(x=>x.exponent));for(let e=Math.min(0,...digits.map(x=>x.exponent));e<=0;e++)if(!have.has(e))digits.push({exponent:e,digit:0});
 digits.sort((a,b)=>b.exponent-a.exponent);
 // drop leading zeros above the units (balanced ternary can produce none; others none either)
 while(digits.length>1&&digits[0].exponent>0&&!digits[0].digit)digits.shift();
 return {places:digits,exact:true,minPlace:digits.at(-1).exponent,maxPlace:digits[0].exponent};
}
export const digitGlyph=(digit,base=numeral.id)=>bases[base].balanced&&digit<0?'T':String(Math.abs(digit));
// Plain text in a base: 1011₂, 1T0 bal₃ (balanced ternary), 2.1201…ₑ.
export function baseText(value,base=numeral.id,{subscript=true}={}){
 if(base==='decimal'){const t=value.d===1?String(value.n):String(value.n/value.d);return t+(subscript?'₁₀':'');}
 const spec=digitsOf(value,base),b=bases[base];
 if(!spec){const n=baseText({n:value.n,d:1},base,{subscript:false}),d=baseText({n:value.d,d:1},base,{subscript:false});return `${n}/${d}`+(subscript?b.sub:'');}
 let text='';for(const p of spec.places){if(p.exponent===-1)text+=(text?'':'0')+'.';text+=digitGlyph(p.digit,base);}
 if(spec.minPlace<-1&&!text.includes('.'))text='0.'+text;
 const negative=!b.balanced&&value.n<0;
 return (negative?'−':'')+text+(spec.exact?'':'…')+(subscript?b.sub:'');
}
// The tray layout of a term's value in a base: like numbers.js numberSpec, with a colour
// per place (balanced ternary) and an ellipsis marker when the digits run on.
export function baseSpec(value,base=numeral.id){
 const digits=digitsOf(value,base);if(!digits)return null;
 const b=bases[base],places=[],markers=[];let x=0;
 digits.places.forEach((p,i)=>{
  if(i&&isGroupEdge(p.exponent,base)){markers.push({x,decimal:p.exponent===-1});x+=40;}
  places.push({digit:Math.abs(p.digit),signed:p.digit,exponent:p.exponent,x,negative:p.digit<0});x+=160;
 });
 if(!digits.exact){markers.push({x,ellipsis:true});x+=70;}
 return {places,markers,width:x,minPlace:digits.minPlace,maxPlace:digits.maxPlace,text:baseText(value,base,{subscript:false}),base,exact:digits.exact,balanced:!!b.balanced};
}
// Typed literals in other bases become decimal before parsing: 0b1011 (base 2) and 0t1T0
// (balanced ternary, T for −1). A negative ternary literal is wrapped in parentheses.
export function expandBaseLiterals(text){
 return String(text).replace(/\b0b([01]+)\b/gi,(_,d)=>String(BigInt('0b'+d))).replace(/\b0t([01T]+)\b/g,(_,d)=>{let v=0n;for(const c of d)v=v*3n+(c==='1'?1n:c==='0'?0n:-1n);return v<0n?`(${v})`:String(v);});
}
