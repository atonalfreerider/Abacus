import * as math from '../engine.js';
export { math };
const clone = value => structuredClone(value);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const equivalent = (a,b) => {
  const x=math.solution(a), y=math.solution(b);
  return x.type===y.type && (x.type!=='unique' || math.eq(x.value,y.value));
};
export function residual(e) {const l=math.totals(e.left),r=math.totals(e.right);return {variable:math.sub(l.variable,r.variable),constant:math.sub(l.constant,r.constant)};}
export function preservesResidual(before,after,command) {
  const a=residual(before),b=residual(after);
  const factor=command.type==='operate'&&command.operation==='multiply'?math.parseScalar(command.amount):command.type==='operate'&&command.operation==='divide'?math.div(math.frac(1),math.parseScalar(command.amount)):math.frac(1);
  return math.eq(b.variable,math.mul(a.variable,factor))&&math.eq(b.constant,math.mul(a.constant,factor));
}
export class EquationModel {
  constructor(input='x+3=7') { this.past=[];this.future=[];this.load(input); }
  load(input) { const next=math.parseEquation(input.includes('=')?input:input+'=0'); this.expression=!input.includes('=');this.hasVariable=[...next.left,...next.right].some(t=>t.kind==='variable');this.state=freeze(next);this.past=[];this.future=[];return this.state; }
  dispatch(command) {
    const before=this.state; let after=clone(before);
    if(command.type==='move') after=math.transpose(after,command.id,command.side,command.index);
    else if(command.type==='reorder') {
      const items=after[command.side], index=items.findIndex(t=>t.id===command.id);
      if(index<0)throw Error('The card is not on that side.');
      const [item]=items.splice(index,1);items.splice(Math.max(0,Math.min(command.index,items.length)),0,item);
    } else if(command.type==='combine') {
      if(command.side)after=math.transpose(after,command.id,command.side);
      const side=['left','right'].find(side=>after[side].some(t=>t.id===command.id)&&after[side].some(t=>t.id===command.target));
      if(!side || command.id===command.target)throw Error('Choose two terms on the same side.');
      const first=after[side].find(t=>t.id===command.target), second=after[side].find(t=>t.id===command.id);
      if(first.kind!==second.kind)throw Error('Only like terms can combine. Drop in a gap to rearrange.');
      const pending=[first,second].find(t=>t.expr);if(pending)throw Error(`Work out ${math.termText(pending,true)} first: tap it.`);
      first.value=math.add(first.value,second.value);first.decimalPlaces=Math.max(first.decimalPlaces||0,second.decimalPlaces||0);first.notation=first.notation==='decimal'||second.notation==='decimal'?'decimal':first.notation==='fraction'||second.notation==='fraction'?'fraction':'auto';after[side]=after[side].filter(t=>t.id!==second.id && (t.id!==first.id||first.value.n!==0));
    } else if(command.type==='evaluate') {
      const side=['left','right'].find(side=>after[side].some(t=>t.id===command.id));
      if(!side)throw Error('The card is not in the equation.');
      const index=after[side].findIndex(t=>t.id===command.id),next=math.evaluateStep(after[side][index]);
      if(!next)throw Error('That number is already worked out.');
      after[side][index]=next;
    } else if(command.type==='simplify') after=math.simplify(after);
    else if(command.type==='operate') after=math.operate(after,command.operation,math.parseScalar(command.amount));
    else throw Error('Unknown equation command.');
    if(!preservesResidual(before,after,command)||!equivalent(before,after))throw Error('Rejected a transformation that changed the equation.');
    this.past.push(before);this.future=[];this.state=freeze(after);
    return freeze({before,after:this.state,command:clone(command)});
  }
  undo(){if(!this.past.length)return;this.future.push(this.state);this.state=this.past.pop();return this.state;}
  redo(){if(!this.future.length)return;this.past.push(this.state);this.state=this.future.pop();return this.state;}
  // Planner for Solve and the tutor: products first, then zero pairs, then like terms,
  // then gather x on the side where its coefficient stays positive, then scale to one x.
  nextStep() {
    const e=this.state;
    for(const side of ['left','right'])for(const t of e[side])if(t.expr)return {type:'evaluate',id:t.id};
    if(math.isSolved(e))return null;
    const pair=side=>{let best=null;
      for(let i=0;i<e[side].length;i++)for(let j=i+1;j<e[side].length;j++){const a=e[side][i],b=e[side][j];if(a.kind!==b.kind)continue;
        const cancels=Math.sign(a.value.n)!==Math.sign(b.value.n),[target,source]=math.numeric(math.abs(a.value))>=math.numeric(math.abs(b.value))?[a,b]:[b,a];
        if(!best||cancels&&!best.cancels)best={cancels,command:{type:'combine',id:source.id,target:target.id}};}
      return best;};
    const found=[pair('left'),pair('right')].filter(Boolean).sort((a,b)=>b.cancels-a.cancels)[0];
    if(found)return found.command;
    if(this.expression||![...e.left,...e.right].some(t=>t.kind==='variable'))return null;
    const has=side=>e[side].some(t=>t.kind==='variable');
    let home=has('left')?'left':'right';
    if(has('left')&&has('right')){
      const l=math.totals(e.left).variable,r=math.totals(e.right).variable;
      home=math.numeric(l)>=math.numeric(r)?'left':'right';
      const away=home==='left'?'right':'left';
      return {type:'move',id:e[away].find(t=>t.kind==='variable').id,side:home};
    }
    const away=home==='left'?'right':'left',constant=e[home].find(t=>t.kind==='constant');
    if(constant)return {type:'move',id:constant.id,side:away};
    const coefficient=math.totals(e[home]).variable;
    if(!coefficient.n||math.eq(coefficient,math.frac(1)))return null;
    if(coefficient.d===1)return {type:'operate',operation:'divide',amount:math.format(coefficient)};
    return {type:'operate',operation:'multiply',amount:math.format(math.div(math.frac(1),coefficient))};
  }
  result(){return math.solution(this.state);}
}
