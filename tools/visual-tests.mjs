import fs from 'node:fs';
import crypto from 'node:crypto';
import {scenarios,scenario} from '../src/mvc/scenarios.js';
import {renderEquation} from '../src/mvc/view.js';
const out='artifacts/visual';fs.mkdirSync(out,{recursive:true});
const results={};
for(const spec of scenarios)for(const orientation of ['horizontal','vertical'])for(const camera of ['front','depth','spread'])for(const p of [0,.25,.5,.75,1]){
 const {model,plan}=scenario(spec.id),name=`${spec.id}-${orientation}-${camera}-${p}`;
 const svg=renderEquation(model.state,{orientation,camera},plan,p).replace(/data-term="[^"]*"/g,'data-term="stable"');
 fs.writeFileSync(`${out}/${name}.svg`,svg);
 results[name]=crypto.createHash('sha256').update(svg).digest('hex');
}
const baseline='tests/visual-baselines.json';
if(process.argv.includes('--update')){fs.writeFileSync(baseline,JSON.stringify(results,null,2)+'\n');console.log(`Recorded ${Object.keys(results).length} deterministic SVG baselines. Review the browser test bench before accepting changes.`);}
else {const expected=JSON.parse(fs.readFileSync(baseline));const changed=Object.keys({...results,...expected}).filter(k=>results[k]!==expected[k]);if(changed.length){console.error('Visual structure regressions:\n'+changed.join('\n'));process.exitCode=1;}else console.log(`PASS: ${Object.keys(results).length} SVG snapshots match reviewed structural baselines.`);}
// Bulb bases (phase 5): additions and the row form of × and ÷, in their own baselines file
// so the decimal hashes above stay exactly as reviewed.
const bulbs={};
{const {bulbScenarios,bulbScenario}=await import('../src/mvc/bulb-scenarios.js'),{planMachine}=await import('../src/machine/plan.js'),{setBase}=await import('../src/mvc/bases.js');
 for(const spec of bulbScenarios)for(const orientation of ['horizontal','vertical'])for(const p of [0,.2,.4,.6,.8,.95,1]){
  const {model,plan}=bulbScenario(spec.id,planMachine),name=`${spec.id}-${orientation}-${p}`;
  const svg=renderEquation(model.state,{orientation,camera:'front'},plan,p).replace(/data-term="[^"]*"/g,'data-term="stable"');
  fs.writeFileSync(`${out}/bulbs-${name}.svg`,svg);
  bulbs[name]=crypto.createHash('sha256').update(svg).digest('hex');
 }
 setBase('decimal');}
const bulbBaseline='tests/visual-baselines-bulbs.json';
if(process.argv.includes('--update')||process.argv.includes('--update-bulbs')){fs.writeFileSync(bulbBaseline,JSON.stringify(bulbs,null,2)+'\n');console.log(`Recorded ${Object.keys(bulbs).length} bulb-base SVG baselines.`);}
else {const expected=fs.existsSync(bulbBaseline)?JSON.parse(fs.readFileSync(bulbBaseline)):{};const changed=Object.keys({...bulbs,...expected}).filter(k=>bulbs[k]!==expected[k]);if(changed.length){console.error('Bulb-base visual regressions:\n'+changed.join('\n'));process.exitCode=1;}else console.log(`PASS: ${Object.keys(bulbs).length} bulb-base SVG snapshots match reviewed structural baselines.`);}
fs.writeFileSync(`${out}/report.json`,JSON.stringify({frames:Object.keys(results).length,hashes:results,bulbs:Object.keys(bulbs).length},null,2));
