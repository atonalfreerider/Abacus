import { math } from './model.js';
import {numberSpec} from './numbers.js';
import {unitPlan} from './units.js';
import {operationPlan,rowPlan} from './operations.js';
import {numeral,bases,baseSpec} from './bases.js';
export const clamp=t=>Math.max(0,Math.min(1,t));
export const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
export function regroup(a,b) {
  const events=[];
  const same=Math.sign(a)===Math.sign(b), large=Math.max(Math.abs(a),Math.abs(b)), small=Math.min(Math.abs(a),Math.abs(b));
  // Exact integer digit arithmetic; decimals use the rational scale below.
  let carry=0;
  for(let place=0;place<16;place++) {
    const pow=10**place, x=Math.floor(large/pow)%10,y=Math.floor(small/pow)%10;
    if(same) {const sum=x+y+carry;carry=sum>=10?1:0;if(carry)events.push({type:'carry',place,count:10,to:place+1});}
    else {const remaining=x-y-carry;carry=remaining<0?1:0;if(carry)events.push({type:'borrow',place:place+1,count:10,to:place});}
    if(pow>large+small && !carry)break;
  }
  if(!same){events.reverse();events.push({type:'neutralize',count:small});}
  return events;
}
// Cards regroup in the base the trays are drawn in. Outside decimal, base 2 and balanced
// ternary combine card by card and work × and ÷ out in rows (operations.js); base e (no
// whole-card carries) cross-fades.
function baseTransition(transaction,base){
  const {before,after,command}=transaction;let units=null;
  if(command.type==='combine'&&!bases[base].irrational){
    const terms=[...before.left,...before.right],picked=terms.find(t=>t.id===command.id),a=command.side?{...picked,value:math.neg(picked.value)}:picked,b=terms.find(t=>t.id===command.target);
    const sa=baseSpec(a.value,base),sb=baseSpec(b.value,base);
    if(sa&&sb){const precision=Math.max(0,-sa.minPlace,-sb.minPlace),scale=BigInt(bases[base].radix)**BigInt(precision),aa=BigInt(a.value.n)*scale/BigInt(a.value.d),bb=BigInt(b.value.n)*scale/BigInt(b.value.d),limit=BigInt(Number.MAX_SAFE_INTEGER);
     if(aa<=limit&&aa>=-limit&&bb<=limit&&bb>=-limit){units=unitPlan(Number(bb),Number(aa),b.id,a.id,base);if(precision)units.placeShift=-precision;}}
  }
  const events=command.type==='move'?[{type:'cross',id:command.id}]:command.type==='operate'?[{type:command.operation,amount:math.parseScalar(command.amount)}]:command.type==='evaluate'?[{type:'evaluate'}]:[];
  if(command.type==='evaluate'){const term=[...before.left,...before.right].find(t=>t.id===command.id),next=[...after.left,...after.right].find(t=>t.id===command.id);if(term?.expr&&math.pemdasRank(term)<2)return {before,after,command,events,units:null,caption:math.stepCaption(term,next),duration:1700};
   // Bulbs: × and ÷ of whole numbers play PRIME's split in rows; anything else cross-fades.
   const op=bases[base].bulbs?rowPlan(transaction,base):null;if(op)return {before,after,command,events:[],units:null,op,duration:Math.round(op.duration*1000)};}
  return {before,after,command,events,units,duration:units?Math.max(900,units.duration*1000+200):events.length?1200:650};
}
export function planTransition(transaction,base=numeral.id) {
  if(base!=='decimal')return baseTransition(transaction,base);
  const {before,after,command}=transaction;let events=[],units=null;
  if(command.type==='combine') {
    const terms=[...before.left,...before.right],picked=terms.find(t=>t.id===command.id),a=command.side?{...picked,value:math.neg(picked.value)}:picked,b=terms.find(t=>t.id===command.target);
    if(a.value.d===1&&b.value.d===1){events=regroup(a.value.n,b.value.n);units=unitPlan(b.value.n,a.value.n,b.id,a.id);}
    else {const sa=numberSpec(a),sb=numberSpec(b);if(sa&&sb){const precision=Math.max(-sa.minPlace,-sb.minPlace),scale=10n**BigInt(precision),aa=BigInt(a.value.n)*scale/BigInt(a.value.d),bb=BigInt(b.value.n)*scale/BigInt(b.value.d);if(aa<=BigInt(Number.MAX_SAFE_INTEGER)&&aa>=-BigInt(Number.MAX_SAFE_INTEGER)&&bb<=BigInt(Number.MAX_SAFE_INTEGER)&&bb>=-BigInt(Number.MAX_SAFE_INTEGER)){units=unitPlan(Number(bb),Number(aa),b.id,a.id);units.placeShift=-precision;}}else events=[{type:'fraction',denominators:[a.value.d,b.value.d],result:math.add(a.value,b.value)}];}
  }
  if(command.type==='evaluate'){
   // Parentheses and powers are worked out in place under a caption; × and ÷ animate with cards.
   const term=[...before.left,...before.right].find(t=>t.id===command.id),next=[...after.left,...after.right].find(t=>t.id===command.id);
   if(term?.expr&&math.pemdasRank(term)<2)return {before,after,command,events:[{type:'evaluate'}],units:null,caption:math.stepCaption(term,next),duration:1700};
   const op=operationPlan(transaction);if(op)return {before,after,command,events:[],units:null,op,duration:Math.round(op.duration*1000)};events=[{type:'evaluate'}];}
  if(command.type==='move')events=[{type:'cross',id:command.id}];
  if(command.type==='operate')events=[{type:command.operation,amount:math.parseScalar(command.amount)}];
  return {before,after,command,events,units,duration:units?Math.max(900,units.duration*1000+200):events.length?1200:650};
}
export function operationGroups(plan) {
  const command=plan.command;
  if(command.type!=='operate'||!['multiply','divide'].includes(command.operation))return [];
  const amount=math.parseScalar(command.amount);
  if(amount.d!==1||amount.n<1||amount.n>12)return [];
  return [...plan.before.left,...plan.before.right].map(term=>({id:term.id,count:amount.n,term:command.operation==='divide'?[...plan.after.left,...plan.after.right].find(t=>t.id===term.id):term}));
}
// Explicit clock: replay, pause, scrub and tests sample exactly the same frames.
export class AnimationClock {
  constructor(){this.plan=null;this.progress=1;this.playing=false;}
  start(plan,now){this.plan=plan;this.progress=0;this.started=now;this.playing=true;}
  sample(now){if(this.playing){this.progress=clamp((now-this.started)/this.plan.duration);if(this.progress===1)this.playing=false;}return this.progress;}
  seek(progress){this.progress=clamp(progress);this.playing=false;return this.progress;}
  resume(now){if(this.plan&&this.progress<1){this.started=now-this.progress*this.plan.duration;this.playing=true;}}
  finish(){this.progress=1;this.playing=false;}
}
