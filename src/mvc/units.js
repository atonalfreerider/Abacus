// Each token is one unit of its decimal place (a singleton, ten-stack, or hundred-stack).
// Every phase conserves signed value. Geometry is assigned only by the view.
export function unitValue(tokens){return tokens.reduce((sum,t)=>sum+BigInt(t.sign)*10n**BigInt(t.place),0n);}
export function unitPlan(a,b,target,source){return unitPlanMany(a,target,[{value:b,owner:source}]);}
// Several sources merge into one target (repeated addition). A source's transfers may
// start after `delay` seconds; everything else follows the dependency schedule.
export function unitPlanMany(a,target,sources,{sequential=false,speed=1}={}){
 let serial=0,tokens=[];const phases=[],source=sources.length===1?sources[0].owner:null,owners=new Set(sources.map(s=>s.owner));
 const make=(sign,place,owner,cell)=>({id:`u${serial++}`,sign,place,owner,cell});
 for(const [value,owner] of [[a,target],...sources.map(s=>[s.value,s.owner])])[...String(Math.abs(value))].reverse().forEach((d,place)=>{for(let cell=0;cell<Number(d);cell++)tokens.push(make(Math.sign(value),place,owner,cell));});
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
 // Sequential sources regroup after each arrival; the next source waits until those
 // regroupings have started, so it lands in vacated cells and a place never overflows.
 let waits=[];
 for(const {owner,delay=0} of sources){
  for(const token of initial.filter(t=>t.owner===owner).sort((a,b)=>a.place-b.place)){
   add('transfer',[token.id],[{...token,owner:target,cell:free(token.place)}]);if(delay)phases.at(-1).delay=delay;if(waits.length)phases.at(-1).waits=waits;
  }
  // The next source waits for this one to start moving and for any regrouping it caused.
  if(sequential){const moved=phases.length-initial.filter(t=>t.owner===owner).length,first=phases.length;normalize();waits=phases.map((_,i)=>i).slice(moved);}
 }
 normalize();
 const sign=total<0n?-1:1;
 // Borrow from the closest higher occupied place, splitting recursively through zeros.
 while(tokens.some(t=>t.sign!==sign)){
  const opposing=tokens.filter(t=>t.sign!==sign).sort((a,b)=>a.place-b.place)[0];
  const donor=tokens.filter(t=>t.sign===sign&&t.place>opposing.place).sort((a,b)=>a.place-b.place)[0];
  if(!donor)throw Error('Unable to borrow for unit animation.');
  const place=donor.place-1,used=new Set(bucket(place,sign).map(t=>t.cell));
  const children=Array.from({length:10},()=>{let cell=0;while(used.has(cell))cell++;used.add(cell);return make(sign,place,target,cell);});
  add('borrow',[donor.id],children);normalize(false);
 }
 // Compact gaps left by cancellation without changing token identities or weights.
 const before=snapshot();for(let place=0;place<17;place++)bucket(place).sort((a,b)=>a.cell-b.cell).forEach((t,i)=>{t.cell=i;});
 if(before.some((t,i)=>t.cell!==tokens[i].cell))phases.push({type:'settle',before,after:snapshot(),removed:[],created:[]});
 // Bind each cancellation before playback. Existing receiving cards win, then
 // borrowed receiving units. Incoming cards land on these cells, never a midpoint.
 const cancelTargets={};
 const original=new Map(initial.map(t=>[t.id,t.owner]));
 for(const phase of phases.filter(p=>p.type==='neutralize')){
  const pair=phase.before.filter(t=>phase.removed.includes(t.id));
  const receiver=pair.find(t=>original.get(t.id)===target)||pair.find(t=>!owners.has(original.get(t.id)))||pair[0];
  const mover=pair.find(t=>t.id!==receiver.id);
  phase.receiver={...receiver};phase.mover=mover.id;
  cancelTargets[mover.id]={...receiver};
 }
 // Pairs in one place pop in reading order, a short ripple that can be counted.
 const rank={};for(const phase of phases.filter(p=>p.type==='neutralize')){const place=phase.receiver.place;phase.lag=.06*(rank[place]=(rank[place]??-1)+1);}
 const plan={initial,phases,final:snapshot(),target,source,total:String(total),cancelTargets,speed};scheduleUnits(plan);return plan;
}
export function scheduleUnits(plan){
 const ready=new Map();let end=0;
 for(const phase of plan.phases){
  const inputs=phase.type==='settle'?phase.before.map(t=>t.id):phase.removed;
  phase.start=Math.max(phase.type==='settle'?end:phase.delay||0,...inputs.map(id=>ready.get(id)||0),...(phase.waits||[]).map(i=>plan.phases[i].start))+(phase.lag||0);
  phase.end=phase.start+(phase.type==='transfer'?.45:phase.type==='settle'?.25:.45)/(plan.speed||1);
  for(const id of (phase.type==='settle'?phase.after.map(t=>t.id):phase.created))ready.set(id,phase.end);
  end=Math.max(end,phase.end);
 }
 plan.duration=end||.5;
}
export function unitFrame(plan,progress){
 const time=Math.max(0,Math.min(1,progress))*plan.duration,tokens=new Map(plan.initial.map(t=>[t.id,t])),active=[];
 for(const phase of [...plan.phases].sort((a,b)=>a.end-b.end))if(time>=phase.end){
  if(phase.type==='settle'){tokens.clear();for(const t of phase.after)tokens.set(t.id,t);}
  else {for(const id of phase.removed)tokens.delete(id);for(const id of phase.created)tokens.set(id,phase.after.find(t=>t.id===id));}
 }
 for(const phase of plan.phases)if(time>=phase.start&&time<phase.end){
  for(const id of (phase.type==='settle'?phase.before.map(t=>t.id):phase.removed))tokens.delete(id);
  active.push({phase,progress:(time-phase.start)/(phase.end-phase.start)});
 }
 return {tokens:[...tokens.values()],active,phase:active[0]?.phase,progress:active[0]?.progress||0};
}

