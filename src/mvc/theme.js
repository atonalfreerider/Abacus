// Two looks for every view. "sketchpad" is the original SWF's school sketchpad: paper
// textures, ink lines and Garamond. "cyber" is a minimalist future-punk style: neon
// hairlines on near-black glass, with monospace numerals. The colours keep their
// meaning in both: blue (cyan) is positive, red (magenta) negative, green (acid) is x.
// The page's own colours live in CSS (style.css, cyber.css); this module holds the
// colours that are baked into SVG patterns and the raster card cache.
const sketchpad={
 name:'sketchpad',
 textures:true,
 // Card faces: texture image ids (sketchpad) or flat fills (cyber).
 face:{blue:'url(#blue)',red:'url(#red)',green:'url(#green)'},
 flat:{blue:'#5f8fb0',red:'#c0604a',green:'#7da35a',paper:'#efe6cc'},
 stroke:{blue:'#191a16',red:'#191a16',green:'#191a16'},
 groupStroke:{blue:'#17271c',red:'#17271c',green:'#17271c'},
 mark:{blue:'#14251d',red:'#14251d',green:'#14251d'},
 edge:{paper:'#f6f0de',line:'#b2aa92',base:'#55513f',group:{blue:'#2b6e8e',red:'#b0432b',green:'#5d8a39'}},
 edgeLine:{blue:'#b2aa92',red:'#b2aa92',green:'#b2aa92'},
 tenOutline:'#10170f',
 curves:['#2f5d6b','#9a5b10','#6b3f8a'],
 background:'#f7f0df',
 // LED bulbs (base 2 and balanced ternary): lit blue (1), lit red (−1), or a dark socket.
 bulb:{blue:{body:'#2f7fc4',core:'#e2f3ff',glow:'#4aa3ff'},red:{body:'#c8402f',core:'#ffe4dc',glow:'#ff6a4d'},green:{body:'#5d8a39',core:'#efffe0',glow:'#8fd14f'},off:{fill:'#ebe5d2',stroke:'#7b7564',filament:'#a79f88'},
  // Amber: the base-e light and the machine's markers (ring, scan bar, overhang).
  amber:{body:'#d99a1e',core:'#fff3d6',glow:'#ffb21e'}},
 // Marble fingerprints (the prime-component language).
 marble:{gold:'#f2c230',goldEdge:'#7a5a06',ring:'#a87a06',string:'#6d6655',prime:'#f2c230',square:'#b8323f',pronic:'#6f8fe8',composite:'#9a9ca8',unit:'#fdfbf4',arm:'#5c5446'},
 // The function machine (src/machine): PRIME's SKETCH, ink wires on paper. Green stays x's.
 machine:{wire:'#191a16',wireActive:'#2f5d6b',hub:'#25241e',block:'#f6f0de',blockEdge:'#25241e',glyph:'#25241e',label:'#14251d',labelFill:'#efe6cc',
  rail:'#6d6655',scan:'#9a5b10',dust:'#d99a1e',error:'#b3261e',font:"'Adobe Garamond Pro',Garamond,Georgia,serif"},
};
const cyber={
 name:'cyber',
 textures:false,
 face:{blue:'url(#blue)',red:'url(#red)',green:'url(#green)'},
 flat:{blue:'#0b3442',red:'#3f0c22',green:'#22380a',paper:'#7fe9ff'},
 stroke:{blue:'#36e6ff',red:'#ff3d8b',green:'#b8ff3c'},
 groupStroke:{blue:'#1aa9c2',red:'#c22a69',green:'#86c425'},
 mark:{blue:'#c9f8ff',red:'#ffd2e4',green:'#eaffc7'},
 edge:{paper:'#061118',line:'#145566',base:'#36e6ff',group:{blue:'#36e6ff',red:'#ff3d8b',green:'#b8ff3c'}},
 edgeLine:{blue:'#145566',red:'#5c1534',green:'#3c5a12'},
 tenOutline:'#e8fbff',
 curves:['#36e6ff','#ffb21e','#c77dff'],
 background:'#05070b',
 bulb:{blue:{body:'#12b5d4',core:'#ecfeff',glow:'#36e6ff'},red:{body:'#e0206e',core:'#ffe6f0',glow:'#ff3d8b'},green:{body:'#7fc61e',core:'#f6ffe6',glow:'#b8ff3c'},off:{fill:'#081016',stroke:'#2f6475',filament:'#1f4655'},
  amber:{body:'#ffb21e',core:'#fff4dc',glow:'#ffcf5a'}},
 marble:{gold:'#ffd23d',goldEdge:'#ffb000',ring:'#ffd23d',string:'#3c5866',prime:'#ffd23d',square:'#ff3d6e',pronic:'#5f8bff',composite:'#8b93a7',unit:'#f2fbff',arm:'#0d1a22'},
 // The machine as PRIME's never-reachable TRON theme: neon hairlines on black glass.
 machine:{wire:'#145566',wireActive:'#36e6ff',hub:'#36e6ff',block:'#061118',blockEdge:'#36e6ff',glyph:'#c9f8ff',label:'#c9f8ff',labelFill:'#0b1a22',
  rail:'#2f6475',scan:'#ffb21e',dust:'#ffb21e',error:'#ff3d8b',font:'"JetBrains Mono","IBM Plex Mono","SF Mono","Cascadia Mono","Roboto Mono",ui-monospace,Menlo,Consolas,monospace'},
};
export const styles={sketchpad,cyber};
const copy=(into,from)=>{for(const [k,v] of Object.entries(from)){if(Array.isArray(v))into[k].splice(0,into[k].length,...v);else if(v&&typeof v==='object')copy(into[k],v);else into[k]=v;}};
// The live palette. It is updated in place, so modules may keep references to its parts.
export const ink=structuredClone(sketchpad);
const listeners=new Set();
export const onStyle=fn=>listeners.add(fn);
export function setStyle(name){
 if(!styles[name])throw Error('Unknown style.');
 if(ink.name===name)return;
 copy(ink,styles[name]);
 if(typeof document!=='undefined'){document.documentElement.dataset.style=name;document.querySelector('meta[name=theme-color]')?.setAttribute('content',ink.background);}
 for(const fn of listeners)fn(name);
}
// SVG patterns for the card faces. Sketchpad tiles the original textures; cyber fills
// each face with a dark glass gradient so the neon edge carries the colour.
export const textureSources=[['blue',25],['red',23],['green',2],['paper',24]];
export function patternDefs(prefix=''){
 if(ink.textures)return textureSources.map(([name,id])=>`<pattern id="${prefix}${name}" width="150" height="150" patternUnits="userSpaceOnUse"><image href="./textures/swf-${id}.jpg" width="150" height="150"/></pattern>`).join('');
 return textureSources.map(([name])=>{const c=ink.flat[name];return `<linearGradient id="${prefix}${name}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${name==='paper'?1:.92}"/><stop offset="1" stop-color="${c}" stop-opacity="${name==='paper'?.55:.78}"/></linearGradient>`;}).join('');
}
