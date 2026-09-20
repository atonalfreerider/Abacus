import {EquationModel} from './model.js';
import {planTransition} from './animation.js';
export const scenarios=[
 {id:'cross',input:'x+3=7',command:m=>({type:'move',id:m.state.left[1].id,side:'right'})},
 {id:'rearrange',input:'x+3+2=9',command:m=>({type:'reorder',id:m.state.left[2].id,side:'left',index:0})},
 {id:'cancel',input:'x=7-3',command:m=>({type:'combine',id:m.state.right[1].id,target:m.state.right[0].id})},
 {id:'carry',input:'9+1=10',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'comma-carry',input:'999+1=1000',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'borrow',input:'1000-1=999',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'fractions',input:'x/2+1/3=5/6',command:m=>({type:'operate',operation:'multiply',amount:'6'})},
 {id:'multiply',input:'3=3',command:m=>({type:'operate',operation:'multiply',amount:'4'})},
 {id:'divide',input:'12=12',command:m=>({type:'operate',operation:'divide',amount:'3'})},
 {id:'inscriptions',input:'1001001000=1001001000'},
 {id:'hundred-carry',input:'99+1=100',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'hundred-borrow',input:'100-1=99',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'negative-result',input:'7-30=-23',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'zero-pair',input:'7-7=0',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'parallel-digits',input:'555+555=1110',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'decimal-carry',input:'0.99+0.01=1',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'decimal-borrow',input:'1-0.01=0.99',command:m=>({type:'combine',id:m.state.left[1].id,target:m.state.left[0].id})},
 {id:'decimal-commas',input:'1234.123456=1234.123456'},
 {id:'transparent-trays',input:'100=100'},
];
export function scenario(id){const spec=scenarios.find(s=>s.id===id);if(!spec)throw Error('Unknown test scene');const model=new EquationModel(spec.input);const plan=spec.command?planTransition(model.dispatch(spec.command(model))):null;return {model,plan};}
