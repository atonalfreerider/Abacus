import { EquationModel,math } from './model.js';
import { AnimationClock,planTransition } from './animation.js';
export class Controller extends EventTarget {
  constructor(view,input='x+3=7') {super();this.model=new EquationModel(input);this.view=view;this.clock=new AnimationClock();this.options={orientation:'horizontal',camera:'front',zoom:1};this.render();}
  get busy(){return this.clock.playing || this.clock.progress<1;}
  render(){this.view.render(this.model.state,{...this.options,expression:this.model.expression},this.clock.plan,this.clock.progress);this.dispatchEvent(new Event('change'));}
  execute(command,now=performance.now(),origin=null) {if(this.busy)throw Error('Finish or skip the animation before moving another card.');const transaction=this.model.dispatch(command);delete this.options.drag;this.clock.start({...planTransition(transaction),origin},now);this.render();return transaction;}
  previewDrag(id,x,y,side){this.options.drag={id,x,y,side};this.render();}
  frame(now){if(!this.clock.playing)return;this.clock.sample(now);this.render();}
  load(input){delete this.options.drag;this.clock.finish();this.clock.plan=null;this.model.load(input);this.render();}
  camera(camera){if(!['front','depth','spread'].includes(camera))throw Error('Unknown camera.');this.options.camera=camera;this.render();}
  orientation(orientation){if(!['horizontal','vertical'].includes(orientation))throw Error('Unknown layout.');this.options.orientation=orientation;this.render();}
  seek(progress){this.clock.seek(progress);this.render();}
  finish(){this.clock.finish();this.render();}
  undo(){this.clock.finish();this.clock.plan=null;this.model.undo();this.render();}
  redo(){this.clock.finish();this.clock.plan=null;this.model.redo();this.render();}
  step(now=performance.now()){const command=this.model.nextStep();if(command)return this.execute(command,now);return null;}
  drop(id,side,target,index,now=performance.now(),origin=null) {
    const source=['left','right'].find(s=>this.model.state[s].some(t=>t.id===id));
    if(!source)throw Error('Unknown card.');
    if(side!==source){const hit=this.model.state[side].find(t=>t.id===target),picked=this.model.state[source].find(t=>t.id===id);if(hit&&hit.kind===picked.kind)return this.execute({type:'combine',id,target,side},now,origin);return this.execute({type:'move',id,side},now,origin);}
    if(target&&target!==id)return this.execute({type:'combine',id,target},now,origin);
    if(Number.isInteger(index))return this.execute({type:'reorder',id,side,index},now,origin);
    this.render();return null;
  }
  status(){const r=this.model.result();if(!this.model.hasVariable&&!this.model.expression)return `${r.type==='identity'?'Equal':'Not equal'}: ${math.equationText(this.model.state)}`;return this.model.expression?math.sideText(this.model.state.left):r.type==='identity'?'True for every x':r.type==='impossible'?'No solution':math.isSolved(this.model.state)?`Solved: x = ${math.format(r.value)}`:math.equationText(this.model.state);}
}
