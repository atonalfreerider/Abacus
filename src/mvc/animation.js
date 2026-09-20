import { math } from './model.js';
import {numberSpec} from './numbers.js';
import {unitPlan} from './units.js';
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
export function planTransition(transaction) {
  const {before,after,command}=transaction;let events=[],units=null;
  if(command.type==='combine') {
    const terms=[...before.left,...before.right],picked=terms.find(t=>t.id===command.id),a=command.side?{...picked,value:math.neg(picked.value)}:picked,b=terms.find(t=>t.id===command.target);
    if(a.value.d===1&&b.value.d===1){events=regroup(a.value.n,b.value.n);units=unitPlan(b.value.n,a.value.n,b.id,a.id);}
    else {const sa=numberSpec(a),sb=numberSpec(b);if(sa&&sb){const precision=Math.max(-sa.minPlace,-sb.minPlace),scale=10n**BigInt(precision),aa=BigInt(a.value.n)*scale/BigInt(a.value.d),bb=BigInt(b.value.n)*scale/BigInt(b.value.d);if(aa<=BigInt(Number.MAX_SAFE_INTEGER)&&aa>=-BigInt(Number.MAX_SAFE_INTEGER)&&bb<=BigInt(Number.MAX_SAFE_INTEGER)&&bb>=-BigInt(Number.MAX_SAFE_INTEGER)){units=unitPlan(Number(bb),Number(aa),b.id,a.id);units.placeShift=-precision;}}else events=[{type:'fraction',denominators:[a.value.d,b.value.d],result:math.add(a.value,b.value)}];}
  }
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
