// Snapshot scenes in the bulb bases (base 2 and balanced ternary), kept apart from
// scenarios.js so the 720 decimal hashes never move: additions card by card, and × and ÷ in
// PRIME's row form (design 4.6, phase 5). The Machine's planner is passed in, as app.js
// hands it over after a dynamic import.
import {EquationModel} from './model.js';
import {planTransition} from './animation.js';
import {setBase,numeral} from './bases.js';
import {useMachinePlanner} from './operations.js';
const first=m=>m.state.left[0].id,combine=m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id});
export const bulbScenarios=[
 {id:'binary-carry',base:'binary',input:'13+9=22',command:combine},
 {id:'ternary-carry',base:'ternary',input:'5+7=12',command:combine},
 {id:'binary-split',base:'binary',input:'16*7=112',command:m=>({type:'evaluate',id:first(m)})},
 {id:'binary-split-carries',base:'binary',input:'13*11=143',command:m=>({type:'evaluate',id:first(m)})},
 {id:'binary-single-shift',base:'binary',input:'7*16=112',command:m=>({type:'evaluate',id:first(m)})},
 {id:'binary-zero',base:'binary',input:'0*9=0',command:m=>({type:'evaluate',id:first(m)})},
 {id:'ternary-split',base:'ternary',input:'16*7=112',command:m=>({type:'evaluate',id:first(m)})},
 {id:'ternary-red-copies',base:'ternary',input:'5*(-4)=-20',command:m=>({type:'evaluate',id:first(m)})},
 {id:'binary-long-division',base:'binary',input:'45÷6=x',command:m=>({type:'evaluate',id:first(m)})},
 {id:'binary-exact-division',base:'binary',input:'12÷3=4',command:m=>({type:'evaluate',id:first(m)})},
 {id:'ternary-nearest',base:'ternary',input:'19÷5=x',command:m=>({type:'evaluate',id:first(m)})},
 {id:'ternary-tie',base:'ternary',input:'14÷4=x',command:m=>({type:'evaluate',id:first(m)})},
 {id:'binary-chain',base:'binary',input:'12÷3*5=20',command:m=>({type:'evaluate',id:first(m)})},
];
// The scene's model and plan, drawn in its base (left as the live base for rendering).
export function bulbScenario(id,planMachine){
 const spec=bulbScenarios.find(s=>s.id===id);if(!spec)throw Error('Unknown test scene');
 useMachinePlanner(planMachine);setBase(spec.base);
 const model=new EquationModel(spec.input),plan=planTransition(model.dispatch(spec.command(model)),numeral.id);
 return {model,plan};
}
