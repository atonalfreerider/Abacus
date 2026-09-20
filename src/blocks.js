import { abs, format, numeric } from './engine.js';
import { placeMetadata } from './place-value.js';

export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function icon(name, size = 20) {
  const paths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    undo: '<path d="M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12" transform="translate(0 -2)"/>',
    reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
    hint: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>',
    book: '<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3ZM12 6v15"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1-1 2M12 17h.01"/>',
    play: '<path d="m9 5 11 7-11 7Z"/>',
    cube: '<path d="m12 3 9 5v9l-9 5-9-5V8Zm0 10v9M3 8l9 5 9-5M7.5 5.5l9 5v9"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    moon: '<path d="M20 14a8 8 0 0 1-10-10 9 9 0 1 0 10 10Z"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1M7 15h10"/>',
    balance: '<path d="M12 3v17M7 21h10M3 7h18M6 7l-4 8h8Zm12 0-4 8h8Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cube}</svg>`;
}

let graphicId = 0;
export function cardFace(x,y,size,color,textureId,meta,options={}) {
  const width=size*2, height=size;
  const shape=`M${x} ${y+height/2} ${x+size} ${y} ${x+width} ${y+height/2} ${x+size} ${y+height}Z`;
  let content=`<path d="${shape}" fill="${options.support?'#eee9d7':`url(#${textureId})`}" stroke="${options.support?'#92977f':color==='red'?'#a65840':color==='green'?'#698d46':'#3f8297'}" stroke-width="${.7+meta.group*.25}"/>`;
  // Each face carries its own scale label and one nested border per comma group.
  for(let level=0;level<meta.group;level++) {
    const inset=Math.min(size*.4,2.1+level*1.6);
    content+=`<path d="M${x+inset*2} ${y+height/2} ${x+size} ${y+inset} ${x+width-inset*2} ${y+height/2} ${x+size} ${y+height-inset}Z" fill="none" stroke="${options.support?'#768169':'#f8faed'}" stroke-width="${.7+meta.group*.35}" opacity=".92"/>`;
  }
  if(meta.mark) content+=`<text x="${x+size}" y="${y+height/2+3.3}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${Math.max(7,size*.54)}" fill="${options.support?'#647158':'#183c36'}">${meta.mark}</text>`;
  return content;
}
export function grid(digit, color = 'blue', options = {}) {
  const count=Math.max(0,Math.min(9,digit)), meta=placeMetadata(options.exponent||0);
  const id=`card-texture-${++graphicId}`, texture={blue:25,red:23,green:2}[color];
  const size=18, step=options.exploded?4.8:2.15, depth=meta.supportCards*step;
  let faces='';
  for(let i=0;i<9;i++) {
    const row=Math.floor(i/3),col=i%3,x=60+(col-row)*20,y=17+(row+col)*10;
    faces+=`<path d="M${x} ${y+9} ${x+18} ${y} ${x+36} ${y+9} ${x+18} ${y+18}Z" fill="#f0f0e5" stroke="#b7bdab" stroke-width=".6"/>`;
    if(i<count) {
      for(let layer=meta.supportCards;layer>0;layer--) faces+=`<g class="support-card" data-layer="${layer}">${cardFace(x,y+layer*step,size,color,id,meta,{support:true})}</g>`;
      faces+=`<g class="unit-card" data-unit="${i}">${cardFace(x,y,size,color,id,meta)}</g>`;
    }
  }
  const label=`${count} ${meta.magnitude===1?'':meta.magnitude+'-'}${meta.name}; ${meta.supportCards} support cards per occupied cell${meta.mark?', '+meta.mark+' on every card face':''}`;
  return `<span class="number-block card-tray ${color} ${options.variable?'variable-block':''} ${options.small?'small-block':''}" data-magnitude="${meta.magnitude}" data-scale="${meta.mark}" data-support-cards="${meta.supportCards}" title="${escape(label)}"><svg viewBox="0 0 156 ${108+depth}" role="img" aria-label="${escape(options.variable?'Unknown x':label)}"><defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="70" height="70"><image href="./textures/swf-${texture}.jpg" width="70" height="70"/></pattern></defs><path d="M12 44 78 11 145 44 78 78Z" fill="#eeecdf" stroke="#a4af96" stroke-width="1.2"/><path d="M12 44 78 78 145 44v${depth+7}L78 ${85+depth} 12 ${51+depth}Z" fill="#e4e6d72b" stroke="#b3bba366" stroke-width=".65" stroke-dasharray="2 3"/>${faces}${options.variable?'<text x="78" y="59" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="44" fill="#3c5c24">x</text>':''}</svg></span>`;
}
export function block(t) {
  const color = t.kind === 'variable' ? 'green' : t.value.n < 0 ? 'red' : 'blue';
  const value = abs(t.value);
  if (t.kind === 'variable') return `<span class="block-art">${grid(9, color, { variable: true })}${value.n !== value.d ? `<span class="coefficient">${escape(format(t.value))} ×</span>` : t.value.n < 0 ? '<span class="coefficient">−</span>' : ''}</span>`;
  if (value.d !== 1) {
    const remainder=value.n % value.d;
    const percent = remainder / value.d * 100;
    return `<span class="fraction-art ${color}"><span class="fraction-whole"><i style="--fraction:${percent}%"></i><span class="fraction-segments" style="--parts:${Math.min(value.d, 12)}"></span></span><span class="fraction-mark"><b>${remainder}</b><b>${value.d}</b></span>${value.n > value.d ? `<span class="fraction-note">${Math.floor(numeric(value))} whole + ${remainder}/${value.d}</span>` : ''}</span>`;
  }
  const digits = String(value.n).split('');
  return `<span class="block-art ${digits.length > 1 ? 'multi-digit' : ''} ${digits.length>4?'many-digits':''}">${digits.map((digit, i) => {const exponent=digits.length-i-1,meta=placeMetadata(exponent);return `${i>0 && (digits.length-i)%3===0?'<span class="digit-comma">,</span>':''}<span class="digit-block">${grid(Number(digit), color, {small:digits.length>1,exponent})}${digits.length>1?`<small>${meta.magnitude}${meta.mark}</small>`:''}</span>`;}).join('')}</span>`;
}

export function isoCube(x, y, color = 'blue', size = 28, label = '', extra = '') {
  const h = size * .5, d = size * .68;
  return `<g transform="translate(${x} ${y})" ${extra}><path d="M0 ${h} ${size} 0 ${size * 2} ${h} ${size} ${h * 2}Z" fill="url(#iso-${color})" stroke="${color === 'red' ? '#9e4634' : '#367b93'}" stroke-width=".6"/><path d="M0 ${h} ${size} ${h * 2}v${d}L0 ${h + d}Z" fill="url(#iso-${color})"/><path d="M0 ${h} ${size} ${h * 2}v${d}L0 ${h + d}Z" fill="#071e2d" opacity=".16"/><path d="m${size} ${h * 2} ${size} ${-h}v${d}l${-size} ${h}Z" fill="url(#iso-${color})"/><path d="m${size} ${h * 2} ${size} ${-h}v${d}l${-size} ${h}Z" fill="#071e2d" opacity=".29"/>${label ? `<text x="${size}" y="${h + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="#fff">${escape(label)}</text>` : ''}</g>`;
}
export function svgDefs() {
  return `<defs>${[['blue',25],['red',23],['green',2]].map(([color,id]) => `<pattern id="iso-${color}" patternUnits="userSpaceOnUse" width="90" height="90"><image href="./textures/swf-${id}.jpg" width="90" height="90"/></pattern>`).join('')}</defs>`;
}

export function isoGrid(count, startX = 100, startY = 40, color = 'blue', size = 17, extra = '') {
  let content = '';
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / 9), cell = i % 9, row = Math.floor(cell / 3), col = cell % 3;
    content += isoCube(startX + (col - row) * size, startY + (row + col) * size / 2 - layer * size * .68, color, size, '', `class="iso-unit" style="--i:${i}" ${extra}`);
  }
  return content;
}
