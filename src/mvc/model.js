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
    if(command.type==='move') after=math.transpose(after,command.id,command.side);
    else if(command.type==='reorder') {
      const items=after[command.side], index=items.findIndex(t=>t.id===command.id);
      if(index<0)throw Error('The card is not on that side.');
      const [item]=items.splice(index,1);items.splice(Math.max(0,Math.min(command.index,items.length)),0,item);
    } else if(command.type==='combine') {
      const side=['left','right'].find(side=>after[side].some(t=>t.id===command.id)&&after[side].some(t=>t.id===command.target));
      if(!side || command.id===command.target)throw Error('Choose two terms on the same side.');
      const first=after[side].find(t=>t.id===command.target), second=after[side].find(t=>t.id===command.id);
      if(first.kind!==second.kind)throw Error('Only like terms can combine. Drop in a gap to rearrange.');
      first.value=math.add(first.value,second.value);after[side]=after[side].filter(t=>t.id!==second.id && (t.id!==first.id||first.value.n!==0));
    } else if(command.type==='simplify') after=math.simplify(after);
    else if(command.type==='operate') after=math.operate(after,command.operation,math.parseScalar(command.amount));
    else throw Error('Unknown equation command.');
    if(!preservesResidual(before,after,command)||!equivalent(before,after))throw Error('Rejected a transformation that changed the equation.');
    this.past.push(before);this.future=[];this.state=freeze(after);
    return freeze({before,after:this.state,command:clone(command)});
  }
  undo(){if(!this.past.length)return;this.future.push(this.state);this.state=this.past.pop();return this.state;}
  redo(){if(!this.future.length)return;this.past.push(this.state);this.state=this.future.pop();return this.state;}
  nextStep() {
    if(math.isSolved(this.state))return null;
    const e=this.state;
    const combine=side=>{for(let i=0;i<e[side].length;i++)for(let j=i+1;j<e[side].length;j++)if(e[side][i].kind===e[side][j].kind)return {type:'combine',id:e[side][j].id,target:e[side][i].id};};
    const pair=combine('left')||combine('right');if(pair)return pair;
    if(![...e.left,...e.right].some(t=>t.kind==='variable'))return null;
    const rightVariable=e.right.find(t=>t.kind==='variable');
    if(rightVariable)return {type:'move',id:rightVariable.id,side:'left'};
    const leftConstant=e.left.find(t=>t.kind==='constant');
    if(leftConstant)return {type:'move',id:leftConstant.id,side:'right'};
    const coefficient=math.totals(e.left).variable;
    if(coefficient.n && !math.eq(coefficient,math.frac(1)))return {type:'operate',operation:'divide',amount:math.format(coefficient)};
    return null;
  }
  result(){return math.solution(this.state);}
}
