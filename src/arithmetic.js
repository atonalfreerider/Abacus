import { grid, isoGrid, isoCube, svgDefs, icon, escape, cardFace } from './blocks.js';
import { digitPlaces, placeMetadata, scaleGroups } from './place-value.js';

function workshopTabs(kind) {
  return `<div class="demo-tabs" role="tablist" aria-label="Arithmetic demonstrations">${Object.entries(demos).map(([key,d])=>`<button role="tab" aria-selected="${kind===key}" data-demo="${key}" class="${kind===key?'active':''}">${{carry:'+',borrow:'−',multiply:'×',divide:'÷'}[key]} <span>${d.label}</span></button>`).join('')}<button role="tab" aria-selected="${kind==='place'}" data-demo="place" class="${kind==='place'?'active':''}">${icon('cube',19)}<span>Place value</span></button></div>`;
}

function magnitudeCard(x,y,magnitude,color='blue',size=30) {
  const meta=placeMetadata(Math.round(Math.log10(magnitude)));
  let cards='';
  for(let n=meta.supportCards;n>0;n--)cards+=cardFace(x,y+n*3,size,color,`iso-${color}`,meta,{support:true});
  return `<g class="magnitude-card">${cards}${cardFace(x,y,size,color,`iso-${color}`,meta)}</g>`;
}

export function placeValuePanel(value, selectedExponent, exploded) {
  const number=digitPlaces(value), groups=[];
  for(const place of number.places) {
    let group=groups.find(g=>g.group===place.group);
    if(!group){group={group:place.group,name:place.name,mark:place.mark,places:[]};groups.push(group);}
    group.places.push(place);
  }
  const chosen=number.places.find(p=>p.exponent===selectedExponent)||number.places[0];
  const contribution=(BigInt(chosen.digit)*10n**BigInt(chosen.exponent)).toLocaleString('en-US');
  return `<div class="arithmetic-view"><div class="arithmetic-heading"><div><span class="eyebrow">THE NUMBER WORKSHOP</span><h1>A little card. A bigger scale.</h1><p>Stack through tens and hundreds. Start a new scale at every comma.</p></div></div>${workshopTabs('place')}
  <form id="place-form" class="equation-input"><span class="input-icon">${icon('cube',18)}</span><label class="sr-only" for="place-number">Number to explore</label><input id="place-number" aria-label="Number to explore" value="${escape(number.formatted)}" maxlength="24" inputmode="text"/><button type="submit">Explore number ${icon('arrow',16)}</button></form><div id="place-error" class="input-error" role="alert"></div>
  <section class="panel place-explorer"><div class="canvas-topline"><span class="eyebrow">EVERY CARD CARRIES ITS SCALE</span><label class="explode-switch"><input type="checkbox" id="explode-cards" ${exploded?'checked':''}/> Spread cards</label></div><div class="place-number-readout">${escape(number.formatted)}</div><div class="number-groups" aria-label="Digit trays grouped by commas">${groups.map((group,index)=>`${index?'<div class="comma-reset"><b>,</b><span>stack<br>resets</span></div>':''}<div class="scale-group group-${group.group}"><div class="scale-group-title"><strong>${group.mark||'1'}</strong><span>${group.name}</span></div><div class="scale-group-digits">${group.places.map(place=>`<button class="place-digit ${place.exponent===chosen.exponent?'active':''}" data-place="${place.exponent}" aria-label="${place.digit} in the ${place.magnitude}${place.mark||'s'} place" aria-pressed="${place.exponent===chosen.exponent}">${grid(place.digit,number.negative?'red':'blue',{exponent:place.exponent,exploded})}<b>${place.digit}</b><small>${place.magnitude}${place.mark||'s'}</small></button>`).join('')}</div></div>`).join('')}</div><p class="place-scroll-hint">Select any digit to look beneath its tray. Scroll across for larger numbers.</p></section>
  <section class="panel stack-inspector"><div class="inspected-card">${grid(chosen.digit,number.negative?'red':'blue',{exponent:chosen.exponent,exploded})}<span>${chosen.digit} × ${chosen.magnitude}${chosen.mark} = ${number.negative?'−':''}${contribution}</span></div><div class="stack-explanation"><span class="eyebrow">UNDER THIS TRAY</span><h2>${chosen.magnitude===1?'A fresh scale.':chosen.magnitude===10?'One card deeper.':'Ten cards deeper.'}</h2><p>${chosen.magnitude===1?'At local magnitude 1, each occupied cell is a face with no support card underneath.':chosen.magnitude===10?'At local magnitude 10, one support card appears under each occupied cell. It represents ten units of this scale.':'At local magnitude 100, ten support cards appear under each occupied cell. These are ten tens: one hundred of this scale.'}</p><div class="stack-facts"><span><b>${chosen.supportCards}</b> support cards<br>per occupied cell</span><span><b>${chosen.mark||'—'}</b> inscription<br>on every face</span><span><b>${chosen.group}</b> nested outlines<br>per card face</span></div><p class="stack-reset-note">${chosen.group?`The ${chosen.mark} inscription sets the scale to ${chosen.name}. ${chosen.group} nested ${chosen.group===1?'outline':'outlines'} ${chosen.group===1?'makes':'make'} that scale visible on every face.`:'Plain faces are in the units group. After the next comma, k and a heavier inner outline identify thousands.'}</p></div></section>
  <div class="scale-key">${scaleGroups.map((group,index)=>`<div><span class="scale-example" style="--scale-weight:${1+index};--scale-inset:${index*2}px">${group.mark||'1'}</span><b>${group.name}</b><small>${index===0?'base group':`10${['','³','⁶','⁹','¹²'][index]}`}</small></div>`).join('')}</div></div>`;
}

export const demos = {
  carry: { label: 'Carry', expression: '9 + 1 = 10', title: 'Nine spaces. One new place.', description: 'The 3 × 3 tray holds nine units. The tenth completes a group of ten, which becomes one block in the tens place.', stages: ['Start with nine units.', 'One more unit arrives at the tray.', 'Ten ones regroup into one ten.', 'One ten. Zero ones. The value is still ten.'] },
  borrow: { label: 'Borrow', expression: '10 − 1 = 9', title: 'Open a ten. Find ten ones.', description: 'Exchange one ten for ten ones: nine in the tray and one overflow unit. Remove one, and nine remain.', stages: ['Start with one ten.', 'Unpack the ten into ten ones.', 'Remove one unit from the group.', 'Zero tens. Nine ones. Nothing was lost in the exchange.'] },
  multiply: { label: 'Multiply', expression: '3 × 4 = 12', title: 'Build equal groups.', description: 'Make three copies of a group of four. Collect the twelve units, then exchange ten ones for one ten.', stages: ['Start with one group of four.', 'Make three equal groups of four.', 'Collect twelve units. Regroup ten of them.', 'One ten and two ones make twelve.'] },
  divide: { label: 'Divide', expression: '12 ÷ 3 = 4', title: 'Give every group a fair share.', description: 'Unpack twelve into individual units. Deal one to each of three groups until every group has four.', stages: ['Start with twelve units: one ten and two ones.', 'Open the ten so all twelve units can be shared.', 'Deal the units into three equal groups.', 'Each group gets four. Three groups of four make twelve.'] },
};

export function arithmeticPanel(kind, stage, running, speed) {
  const demo = demos[kind];
  const final = stage === 3;
  const value = kind === 'carry' ? (stage < 2 ? 9 : 10) : kind === 'borrow' ? (stage < 3 ? 10 : 9) : kind === 'multiply' ? (stage === 0 ? 4 : 12) : 12;
  let scene = '';
  const tray = (x, y, label) => `<g transform="translate(${x} ${y})"><path d="m0 0 77-39 97 48-78 39Z" fill="#e6e4d9" stroke="#b9b8ac"/><path d="m0 0 96 48v22L0 23Zm96 48 78-39v22L96 70Z" fill="#d7d5c9" stroke="#b9b8ac"/><text x="87" y="104" text-anchor="middle" fill="#797b71" font-size="11" letter-spacing="2">${label}</text></g>`;
  if (kind === 'carry' || kind === 'borrow') {
    scene += tray(57, 153, 'TENS') + tray(345, 153, 'ONES');
    const showTen = kind === 'carry' ? stage >= 2 : stage === 0;
    if (showTen) scene += `<g class="ten-result">${magnitudeCard(101,116,10,'blue',38)}</g>`;
    const ones = kind === 'carry' ? (stage < 2 ? 9 : 0) : (stage === 0 ? 0 : 9);
    scene += `<g class="ones-group">${isoGrid(ones, 414, 98)}</g>`;
    if(kind==='carry' && stage===2)scene+=`<g class="carry-pack">${Array.from({length:10},(_,i)=>`<g class="stacking-card" style="--card:${i}">${cardFace(101,116+i*2.5,38,'blue','iso-blue',placeMetadata(0))}</g>`).reverse().join('')}</g>`;
    if ((kind === 'carry' && stage === 1) || (kind === 'borrow' && stage === 1)) scene += `<g class="overflow-unit">${isoCube(548, 113, 'blue', 17, '1')}</g>`;
    if (kind === 'borrow' && stage === 2) scene += `<g class="removed-unit">${isoCube(548, 113, 'red', 17, '−1')}</g>`;
    if (stage === 2 || (kind === 'borrow' && stage === 1)) scene += `<path class="exchange-arrow" d="M320 134q-70-58-121 0" fill="none" stroke="#cf5736" stroke-width="2" stroke-dasharray="5 5"/><text x="256" y="89" text-anchor="middle" font-size="12" fill="#cf5736">${kind === 'carry' ? '10 ones → 1 ten' : '1 ten → 10 ones'}</text>`;
  } else if (kind === 'multiply') {
    if (stage < 2) {
      for (let g = 0; g < (stage === 0 ? 1 : 3); g++) scene += `<g class="copy-group" style="--group:${g}">${tray(36 + g * 207, 153, `GROUP ${g + 1}`)}${isoGrid(4, 100 + g * 207, 110)}</g>`;
    } else {
      scene += tray(57, 153, 'TENS') + tray(345, 153, 'ONES');
      scene += `<g class="ten-result">${isoCube(101, 116, 'blue', 38, '10')}</g>${isoGrid(2, 414, 113)}`;
      if (stage === 2) scene += `<text x="270" y="99" text-anchor="middle" fill="#cf5736" font-size="12">10 + 2</text>`;
    }
  } else {
    if (stage === 0) scene += tray(57, 153, 'TENS') + tray(345, 153, 'ONES') + isoCube(101, 116, 'blue', 38, '10') + isoGrid(2, 414, 113);
    else if (stage === 1) scene += tray(240, 153, '12 ONES') + isoGrid(12, 302, 112);
    else for (let g = 0; g < 3; g++) scene += `<g class="share-group" style="--group:${g}">${tray(36 + g * 207, 153, `GROUP ${g + 1}`)}${isoGrid(4, 100 + g * 207, 110)}</g>`;
  }
  const tens = Math.floor(value / 10), ones = value % 10;
  return `<div class="arithmetic-view">
    <div class="arithmetic-heading"><div><span class="eyebrow">THE NUMBER WORKSHOP</span><h1>Big ideas. Little blocks.</h1><p>Slow down the arithmetic. See what actually moves.</p></div><span class="workshop-mark">${icon('cube',38)}</span></div>
    ${workshopTabs(kind)}
    <div class="arithmetic-canvas panel"><div class="canvas-topline"><span class="eyebrow">BASE TEN, MADE VISIBLE</span><span class="pill">${stage + 1} / 4 steps</span></div><div class="demo-equation">${demo.expression}</div><svg class="demo-scene ${kind} stage-${stage}" viewBox="0 0 660 280" role="img" aria-label="${demo.stages[stage]}">${svgDefs()}${scene}</svg><div class="demo-caption" aria-live="polite"><span class="step-dot">${stage+1}</span>${demo.stages[stage]}</div><div class="demo-progress">${demo.stages.map((s,i)=>`<button data-stage="${i}" class="${i <= stage ? 'reached' : ''}" aria-label="Step ${i+1}: ${s}" aria-current="${i===stage ? 'step' : 'false'}"></button>`).join('')}</div></div>
    <div class="demo-controls"><button class="button button-dark" data-action="play-demo">${icon(running?'reset':'play',17)} ${running ? 'Pause' : final ? 'Replay animation' : 'Play animation'}</button><button class="button" data-action="step-demo">Next step ${icon('arrow',16)}</button><label class="speed-label">Animation speed<select id="animation-speed" aria-label="Animation speed"><option value="2400" ${speed===2400?'selected':''}>Slow</option><option value="1500" ${speed===1500?'selected':''}>Normal</option><option value="800" ${speed===800?'selected':''}>Fast</option></select></label></div>
    <div class="workshop-details"><article class="panel workshop-note"><span class="eyebrow">WHAT’S HAPPENING?</span><h2>${demo.title}</h2><p>${demo.description}</p><div class="note-rule">${icon('hint',19)} Ten ones and one ten have the same value.</div></article><article class="panel place-card"><span class="eyebrow">PLACE VALUE</span><div class="place-digits"><div>${grid(tens,'blue',{small:true,exponent:1})}<strong>${tens}</strong><span>tens</span></div><span class="place-divider"></span><div>${grid(ones,'blue',{small:true})}<strong>${ones}</strong><span>ones</span></div></div><p>${tens} × 10 + ${ones} × 1 = <b>${value}</b></p></article></div>
  </div>`;
}
