// Each token is one unit of its decimal place (a singleton, ten-stack, or hundred-stack).
// Every phase conserves signed value. Geometry is assigned only by the view.
export function unitValue(tokens){return tokens.reduce((sum,t)=>sum+BigInt(t.sign)*10n**BigInt(t.place),0n);}
export function unitPlan(a,b,target,source){
 let serial=0,tokens=[];const phases=[];
 const make=(sign,place,owner,cell)=>({id:`u${serial++}`,sign,place,owner,cell});
 for(const [value,owner] of [[a,target],[b,source]])[...String(Math.abs(value))].reverse().forEach((d,place)=>{for(let cell=0;cell<Number(d);cell++)tokens.push(make(Math.sign(value),place,owner,cell));});
 const initial=tokens.map(t=>({...t})),total=unitValue(tokens);
 const snapshot=()=>tokens.map(t=>({...t}));
 const add=(type,removed,created)=>{const before=snapshot();tokens=tokens.filter(t=>!removed.includes(t.id)).concat(created);if(unitValue(tokens)!==total)throw Error('Unit animation lost mathematical value.');phases.push({type,before,after:snapshot(),removed,created:created.map(t=>t.id)});};
 const bucket=(place,sign)=>tokens.filter(t=>t.owner===target&&t.place===place&&(sign===undefined||t.sign===sign));
 const free=place=>{const used=new Set(bucket(place).map(t=>t.cell));let cell=0;while(used.has(cell))cell++;return cell;};
 function normalize(allowCarry=true){
  let changed=true;
  while(changed){changed=false;
   for(let place=0;place<17;place++){
    const plus=bucket(place,1),minus=bucket(place,-1);
    if(plus.length&&minus.length){add('neutralize',[plus[0].id,minus[0].id],[]);changed=true;break;}
    const group=plus.length>=10?plus:minus.length>=10?minus:null;
    if(group&&allowCarry){add('carry',group.slice(0,10).map(t=>t.id),[make(group[0].sign,place+1,target,free(place+1))]);changed=true;break;}
   }
  }
 }
 for(const token of initial.filter(t=>t.owner===source).sort((a,b)=>a.place-b.place)){
  add('transfer',[token.id],[{...token,owner:target,cell:free(token.place)}]);normalize();
 }
 const sign=total<0n?-1:1;
 // Borrow from the closest higher occupied place, splitting recursively through zeros.
 while(tokens.some(t=>t.sign!==sign)){
  const opposing=tokens.filter(t=>t.sign!==sign).sort((a,b)=>a.place-b.place)[0];
  const donor=tokens.filter(t=>t.sign===sign&&t.place>opposing.place).sort((a,b)=>a.place-b.place)[0];
  if(!donor)throw Error('Unable to borrow for unit animation.');
  const place=donor.place-1,used=new Set(bucket(place).map(t=>t.cell));
  const children=Array.from({length:10},()=>{let cell=0;while(used.has(cell))cell++;used.add(cell);return make(sign,place,target,cell);});
  add('borrow',[donor.id],children);normalize(false);
 }
 // Compact gaps left by cancellation without changing token identities or weights.
 const before=snapshot();for(let place=0;place<17;place++)bucket(place).sort((a,b)=>a.cell-b.cell).forEach((t,i)=>{t.cell=i;});
 if(before.some((t,i)=>t.cell!==tokens[i].cell))phases.push({type:'settle',before,after:snapshot(),removed:[],created:[]});
 return {initial,phases,final:snapshot(),target,source,total:String(total)};
}
export function unitFrame(plan,progress){const position=Math.max(0,Math.min(.999999,progress))*plan.phases.length,index=Math.floor(position);return {phase:plan.phases[index],progress:position-index,index};}

