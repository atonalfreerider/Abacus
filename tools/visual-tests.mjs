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
fs.writeFileSync(`${out}/report.json`,JSON.stringify({frames:Object.keys(results).length,hashes:results},null,2));
