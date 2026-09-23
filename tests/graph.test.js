import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCurves,specialPoints,intersections,roots,riemann,integral,curveText,show,evaluate,pmul,psub} from '../src/graph/polynomial.js';
import {renderStatic,renderDynamic,groupSpecials} from '../src/graph/graph-view.js';
import {frac,numeric,eq} from '../src/engine.js';

const pts=(curves,kind)=>specialPoints(curves).filter(p=>p.kind===kind).map(p=>p.exact?`${show(p.exact.x)},${show(p.exact.y)}`:`≈${show(p.x)},${show(p.y)}`);
test('equations in x and y become curves; unsupported forms explain themselves',()=>{
 for(const [input,text] of [['y=x^2-2x-3','y = x² − 2x − 3'],['2x+3y=12','y = −2/3x + 4'],['x=3','x = 3'],['y=(x+1)(x-2)','y = x² − x − 2'],['x - y = 1','y = x − 1'],['y = 2(x-1)^2+1','y = 2x² − 4x + 3'],['y=x²/2','y = 0.5x²'],['4 = y','y = 4']])assert.deepEqual(parseCurves(input).map(curveText),[text],input);
 assert.deepEqual(parseCurves('x^2=4').map(curveText),['y = x²','y = 4'],'one-variable equations graph both sides');
 for(const [input,message] of [['y^2=x',/y must appear on its own/],['xy=1',/y must appear on its own/],['y=1/x',/Divide by numbers only/],['y=x^5',/powers up to 4/],['y=x=2',/one equals sign/],['y=2^x',/whole-number powers/],['3=4',/no x or y/]])assert.throws(()=>parseCurves(input),message,input);
});
test('roots are exact rationals when they exist, approximate otherwise, and repeated roots appear once',()=>{
 assert.deepEqual(pts(parseCurves('y=x^2-2x-3'),'root'),['−1,0','3,0']);
 assert.deepEqual(pts(parseCurves('y=(2x-1)(3x+2)'),'root'),['−2/3,0','0.5,0']);
 assert.deepEqual(pts(parseCurves('y=(x-1)^2'),'root'),['1,0']);
 assert.deepEqual(pts(parseCurves('y=x^2-2'),'root'),['≈−1.414,0','≈1.414,0']);
 assert.deepEqual(pts(parseCurves('y=x^4-5x^2+4'),'root'),['−2,0','−1,0','1,0','2,0']);
 assert.deepEqual(pts(parseCurves('y=x^2+1'),'root'),[]);
 assert.deepEqual(pts(parseCurves('y=x^2-2x-3'),'vertex'),['1,−4']);
 // Random products of linear factors: every rational root is recovered exactly.
 let seed=11;const rnd=n=>{seed=(seed*16807)%2147483647;return seed%n;};
 for(let i=0;i<200;i++){const rs=Array.from({length:1+rnd(4)},()=>frac(rnd(19)-9,1+rnd(4)));let p=[frac(1)];for(const r of rs)p=pmul(p,[{n:-r.n,d:r.d},frac(1)]);
  const found=roots(p).map(r=>r.exact);assert.ok(found.every(Boolean));for(const r of rs)assert.ok(found.some(f=>eq(f,r)),`missing root ${show(r)}`);}
});
test('systems: a unique crossing, no crossing, or the same line',()=>{
 const [a]=parseCurves('y=x+1'),[b]=parseCurves('y=-x+5'),[c]=parseCurves('2x+3y=12'),[d]=parseCurves('x-y=1');
 assert.deepEqual(intersections(a,b).points.map(p=>[show(p.exact.x),show(p.exact.y)]),[['2','3']]);
 assert.deepEqual(intersections(c,d).points.map(p=>[show(p.exact.x),show(p.exact.y)]),[['3','2']]);
 assert.equal(intersections(parseCurves('y=2x+1')[0],parseCurves('y=2x-3')[0]).type,'none');
 assert.equal(intersections(parseCurves('y=2x+2')[0],parseCurves('2y=4x+4')[0]).type,'same');
 assert.deepEqual(intersections(parseCurves('x=3')[0],a).points.map(p=>[show(p.exact.x),show(p.exact.y)]),[['3','4']]);
 assert.deepEqual(intersections(parseCurves('y=x^2-4')[0],parseCurves('y=2x-1')[0]).points.map(p=>show(p.exact.x)),['−1','3']);
 const [l,r]=parseCurves('3x+1=x+9');assert.deepEqual(intersections(l,r).points.map(p=>show(p.exact.x)),['4'],'graphing both sides solves the card equation');
});
test('card-strip sums are exact and approach the exact integral as strips thin',()=>{
 const [f]=parseCurves('y=x^2-2x-3');
 const left=riemann(f.poly,frac(0),frac(4),frac(1,2),'left');assert.deepEqual(left.total,frac(-17,2));
 assert.deepEqual(integral(f.poly,frac(0),frac(4)),frac(-20,3));
 let previous=Infinity;for(const d of [1,2,4,8,16]){const s=riemann(f.poly,frac(0),frac(4),frac(1,d),'midpoint').total,err=Math.abs(numeric(s)+20/3);assert.ok(err<previous);previous=err;}
 const [line]=parseCurves('y=x');assert.deepEqual(riemann(line.poly,frac(0),frac(4),frac(1),'midpoint').total,frac(8),'the midpoint rule is exact for lines');
});
test('graph frames render without invalid numbers for curves, tracer stacks and the area sweep',()=>{
 const view={cx:1,cy:0,unit:40,width:800,height:500};
 for(const inputs of [['y=x^2-2x-3'],['2x+3y=12','x-y=1'],['x=3','y=x^3-2x'],['x^2=4']]){
  const curves=inputs.flatMap(parseCurves),specials=specialPoints(curves),{back,front}=renderStatic({view,curves,specials});
  assert.doesNotMatch(back+front,/NaN|undefined|Infinity/);assert.equal((front.match(/class="graph-curve"/g)||[]).length,curves.length);
  for(const [x,y] of [[2.5,-1.75],[-3,4],[0,0],[0.25,7.5]]){const d=renderDynamic({view,curves,specials,tracer:{x,y,label:{x:String(x),y:String(y)}},area:null});assert.doesNotMatch(d.defs+d.tracer,/NaN|undefined/);if(y)assert.match(d.tracer,/card-column/);if(x)assert.match(d.tracer,/card-row/);}
 }
 const [f]=parseCurves('y=x^2-2x-3'),sums=riemann(f.poly,frac(0),frac(4),frac(1,4),'left');
 const d=renderDynamic({view,curves:[f],specials:[],tracer:null,area:{a:frac(0),b:frac(4),dx:frac(1,4),columns:sums.columns,shown:8,grow:.5,tallies:[{x:5,sign:1,height:1},{x:5,sign:-1,height:3}],net:-2,exact:frac(-20,3)}});
 assert.doesNotMatch(d.defs+d.area,/NaN|undefined/);assert.equal((d.area.match(/class="area-column"/g)||[]).length,9);assert.match(d.area,/exact ∫/);
 assert.equal(groupSpecials(specialPoints(parseCurves('x^2=4'))).filter(g=>g.kinds.length>1).length>=1,true,'coincident points share a marker');
});
