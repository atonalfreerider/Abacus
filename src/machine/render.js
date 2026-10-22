// The machine's picture (design 6.3): a pure function (plan, t, layout, palette, view) → SVG.
// It reads only strings from the plan (text, approx, digits, reading, note) and never formats
// a value; it imports no arithmetic. Beats are half-open: the frame at integer t = i is beat
// i − 1 at u = 1, and every transient (fade, burst, mark, bead) is invisible there, so it
// equals the static drawing of scene i. A static frame is literally a beat from a scene to
// itself, which keeps the two drawings from drifting apart.
import { ink } from '../mvc/theme.js';
import { bulb, socket, round as r, esc } from '../mvc/view.js';
import { UNITS, IO, FURNITURE, UNARY, scenesOf, parsePlace, isCollapsed, bulbOffset, bulbsOf, pathLevel, pillLines, pillWidth, textWidth, railOf, furnitureOf, dustBox, cameraAt } from './layout.js';

export const easeOut = u => 1 - (1 - u) ** 2;
const win = (u, [a, b]) => u <= a ? 0 : u >= b ? 1 : (u - a) / (b - a);
const E = (u, w) => easeOut(win(u, w));
// (1 − e)·a + e·b lands exactly on b at e = 1, so arrivals are exact.
const lerp = (a, b, e) => (1 - e) * a + e * b;
const R = UNITS.bulbR, PITCH = UNITS.pitch;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = k => String(k).replace(/\d/g, d => SUP[d]).replace('-', '⁻');
const natural = (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
const RADIX = {binary: '2', ternary: '3', e: 'e'};
const HORIZON = 1e6;
const attr = (name, v) => { const x = r(v); return x === 1 ? '' : ` ${name}="${x}"`; };

// ---- symbols ----
// Bulbs are view.js's bulb() and socket() centred on the origin; red carries a bar across
// its core, so colour is never the only cue. Place inside the stage's <defs>.
export function machineDefs(palette = ink, prefix = 'm-') {
  const P = prefix, m = palette.machine, amber = palette.bulb.amber, sym = (id, body) => `<symbol id="${P}${id}" overflow="visible">${body}</symbol>`;
  const slice = R * 2 * FURNITURE.sliver - R;
  return sym('bulb-blue', bulb(-21.5, -21.5, 'blue', 1, palette))
    + sym('bulb-red', bulb(-21.5, -21.5, 'red', 1, palette) + `<rect x="-14" y="-3.5" width="28" height="7" rx="3.5" fill="${palette.bulb.red.body}"/>`)
    + sym('bulb-amber', bulb(-21.5, -21.5, 'amber', 1, palette))
    + sym('socket', socket(-21.5, -21.5, palette))
    // the sign lamp's collar: a lamp is a bulb that stands for every level above it
    + sym('lamp', `<circle r="44" fill="none" stroke="${m.rail}" stroke-width="2.5" stroke-dasharray="5 5"/><path d="M-10 -52h20" stroke="${m.rail}" stroke-width="2.5" stroke-linecap="round"/>`)
    // the sliver: the 0.718 of a socket that a level has room for after its two sockets
    + `<clipPath id="${P}sliver-clip"><rect x="${-R - 3}" y="${-R - 3}" width="${r(slice + R + 3)}" height="${2 * R + 6}"/></clipPath>`
    + `<clipPath id="${P}overhang-clip"><rect x="${r(slice)}" y="${-R - 3}" width="${r(R - slice + 3)}" height="${2 * R + 6}"/></clipPath>`
    + sym('sliver', `<g clip-path="url(#${P}sliver-clip)"><circle r="${R}" fill="${palette.bulb.off.fill}" fill-opacity=".55" stroke="${palette.bulb.off.stroke}" stroke-width="2" stroke-dasharray="6 5"/></g><path d="M${r(slice)} ${r(-Math.sqrt(R * R - slice * slice))}V${r(Math.sqrt(R * R - slice * slice))}" stroke="${palette.bulb.off.stroke}" stroke-width="2" stroke-dasharray="3 4"/>`)
    + sym('overhang', `<g clip-path="url(#${P}overhang-clip)"><circle r="${R + 1}" fill="${m.scan}" opacity=".55"/></g>`)
    + `<radialGradient id="${P}halo-fill"><stop offset=".35" stop-color="${amber.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${amber.glow}" stop-opacity="0"/></radialGradient>`
    + sym('halo', `<circle r="78" fill="url(#${P}halo-fill)"/>`)
    + sym('owed', `<circle r="45" fill="none" stroke="${m.scan}" stroke-width="2.5" stroke-dasharray="4 6"/>`)
    + sym('burst', `<circle r="30" fill="none" stroke="${amber.glow}" stroke-width="5"/><circle r="12" fill="${amber.core}"/>` + [0, 1, 2, 3, 4, 5, 6, 7].map(k => { const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); return `<path d="M${r(38 * c)} ${r(38 * s)}L${r(58 * c)} ${r(58 * s)}" stroke="${amber.body}" stroke-width="5" stroke-linecap="round"/>`; }).join(''))
    + `<radialGradient id="${P}dust-fill"><stop offset="0" stop-color="${m.dust}" stop-opacity=".5"/><stop offset=".7" stop-color="${m.dust}" stop-opacity=".18"/><stop offset="1" stop-color="${m.dust}" stop-opacity="0"/></radialGradient>`;
}

// ---- block glyphs (PRIME's pin-and-tray vocabulary, 1.5) ----
function glyphBody(op, palette, base, tilt = 0) {
  // one stroke-width per element: a repeated attribute is an XML error (and HTML keeps the first)
  const g = palette.machine.glyph, pen = (w = 3.5) => `stroke="${g}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"`, stroke = pen();
  const pin = side => `<path d="M${side * 46} -12L${side * 20} 0L${side * 46} 12Z" fill="${g}" stroke="${g}" stroke-width="2" stroke-linejoin="round"/>`;
  const pins = pin(-1) + pin(1);
  const text = (s, x, y, size = 22, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="${g}"${extra}>${esc(s)}</text>`;
  const name = s => text(s, 0, 31, 12, ' letter-spacing="1.5"');
  const b = RADIX[base] || '2';
  // unary blocks have one centred socket, so their glyph sits either side of it
  const flank = (left, right) => `<g transform="translate(-66 0)">${left}</g><g transform="translate(66 0)">${right}</g>`;
  switch (op) {
    case 'add': return pins + `<path d="M-13 0H13M0 -13V13" ${pen(6)}/>`;
    case 'sub': return pins + `<path d="M-13 0H13" ${pen(6)}/>`;
    case 'mul': return pin(1) + `<path d="M-22 -16H-42V16H-22" ${stroke}/><path d="M-36 -16L-18 -28" ${stroke}/><circle r="6" fill="${g}"/>`;
    case 'div': case 'mod': return pins + `<path d="M-11 0H11" ${pen(5)}/><circle cy="-10" r="3.6" fill="${g}"/><circle cy="10" r="3.6" fill="${g}"/>` + (op === 'mod' ? text('r', 0, -27, 18, ' font-style="italic"') : '');
    case 'cmp': {
      const a = tilt * 18;
      return `<path d="M0 -25L25 0L0 25L-25 0Z" fill="${palette.machine.block}" ${stroke.replace('fill="none"', '')}/><path d="M-50 -10L-36 0L-50 10M50 -10L36 0L50 10" ${stroke}/><g transform="rotate(${a})"><path d="M-9 -5H9M-9 5H9" ${stroke}/></g>`;
    }
    case 'shl': case 'shr': case 'mule': {
      const up = op !== 'shr', label = op === 'shl' ? `×${b}ᵏ` : op === 'shr' ? `÷${b}ᵏ` : '×eᵏ';
      return pin(-1) + `<path d="M0 ${up ? 16 : -16}V${up ? -16 : 16}M-9 ${up ? -7 : 7}L0 ${up ? -17 : 17}L9 ${up ? -7 : 7}" ${stroke}/>` + text(label, 34, 0, 20);
    }
    case 'and': case 'min': return pins + `<path d="M-11 12L0 -12L11 12" ${stroke}/>` + (op === 'min' ? name('MIN') : '');
    case 'or': case 'max': return pins + `<path d="M-11 -12L0 12L11 -12" ${stroke}/>` + (op === 'max' ? name('MAX') : '');
    case 'xor': case 'sum': return pins + `<circle r="12" ${stroke}/><path d="M-12 0H12M0 -12V12" ${stroke}/>` + (op === 'sum' ? text('3', 17, 12, 13) + name('SUM') : '');
    case 'cons': return pins + `<path d="M-11 -8H11M-11 0H11M-11 8H11" ${stroke}/>` + name('CONS');
    case 'not': return flank(`<path d="M-14 -6H12V8" ${stroke}/>`, text('NOT', 0, 0, 13, ' letter-spacing="1.5"'));
    case 'neg': return flank(`<path d="M-12 0H12" ${pen(6)}/>`, text('NEG', 0, 0, 13, ' letter-spacing="1.5"'));
    case 'measure': case 'ln': {
      const ruler = `<rect x="-14" y="-24" width="28" height="48" rx="3" ${pen(2.5)}/><path d="M-14 -12h9M-14 0h14M-14 12h9" ${pen(2.5)}/>`;
      return flank(ruler, op === 'ln' ? text('ln', 0, 0, 24, ' font-style="italic"') : text('≈', 0, 0, 30));
    }
    default: return text('?', 0, 0, 30);
  }
}
// The block itself: a face between its sockets, the sockets' rings, the glyph and the hub.
function blockSVG(op, palette, base, {glyph = 1, tilt = 0, oldOp = null, oldGlyph = 0, sx = 88, w = 176, q = null, id = null} = {}) {
  const m = palette.machine, h = UNITS.block[1];
  // the socket rings carry data-socket ("n1.L"), so a tap on the stage can name its socket
  const ring = (x, socket) => `<circle cx="${x}" cy="0" r="44" fill="${m.block}" stroke="${m.blockEdge}" stroke-width="2.5"${id ? ` data-socket="${id}.${socket}"` : ''}/><circle cx="${x}" cy="0" r="${R + 2}" fill="${palette.bulb.off.fill}" fill-opacity=".6" stroke="${m.blockEdge}" stroke-width="1.5" stroke-opacity=".5" pointer-events="none"/>`;
  let svg = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="22" fill="${m.block}" stroke="${m.blockEdge}" stroke-width="2.5"/>`;
  // base-e towers bring their own sockets, so a base-e unary block has no centre ring
  svg += UNARY.has(op) ? (base === 'e' ? '' : ring(0, 'C')) : ring(-sx, 'L') + ring(sx, 'R');
  if (q !== null && r(q.o) > 0) svg += `<circle cx="${r(q.x)}" cy="0" r="44" fill="none" stroke="${m.blockEdge}" stroke-width="2" stroke-dasharray="6 6" stroke-opacity=".7"${attr('opacity', q.o)}/>`;
  if (oldOp && r(oldGlyph) > 0) svg += `<g class="glyph"${attr('opacity', oldGlyph)}>${glyphBody(oldOp, palette, base, tilt)}</g>`;
  if (r(glyph) > 0) svg += `<g class="glyph"${attr('opacity', glyph)}>${glyphBody(op, palette, base, tilt)}</g>`;
  return svg;
}
const hubSVG = (x, y, palette, opacity = 1) => `<circle class="hub" cx="${r(x)}" cy="${r(y)}" r="${UNITS.hub}" fill="${palette.machine.block}" stroke="${palette.machine.hub}" stroke-width="2.5"${attr('opacity', opacity)}/>`;
// A small picture of a block for the palette buttons.
export function blockGlyphSVG(op, palette = ink, base = 'binary') {
  const sx = 88, w = 176;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="machine-block" viewBox="-136 -52 272 104" font-family="${esc(palette.machine.font)}" aria-hidden="true">${blockSVG(op, palette, base, {sx, w})}</svg>`;
}

// ---- motion helpers ----
// [from, to, f]: the state crossfades from → to by f; via lights a dark climber first.
function stateAt(sa, sz, m, u) {
  if (m.via) { const w = m.via.at || [0, .3]; if (u <= w[1]) return [sa, m.via.s, E(u, w)]; }
  const mid = m.via ? m.via.s : sa;
  return [mid, sz, E(u, m.state || [.6, 1])];
}
const polyLength = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);
function alongPath(pts, f) {
  const total = polyLength(pts); let left = total * f;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (left <= d || i === pts.length - 1) { const k = d ? Math.min(1, left / d) : 0; return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; }
    left -= d;
  }
  return pts[0];
}
// The first f of a polyline, by length: a wire reeling into its socket along its own elbows.
function cutPath(pts, f) {
  let left = polyLength(pts) * f;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (left >= d) { out.push(pts[i]); left -= d; continue; }
    const k = d ? left / d : 0;
    out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]);
    break;
  }
  return out;
}
const polyline = (pts, stroke, width, extra = '') => pts.length > 1 && polyLength(pts) > 1e-6 ? `<polyline points="${pts.map(([x, y]) => `${r(x)},${r(y)}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"${extra}/>` : '';
const symbolOf = (s, k) => k === 'light' ? (s < 0 ? 'bulb-red' : 'bulb-amber') : s > 0 ? 'bulb-blue' : s < 0 ? 'bulb-red' : 'socket';

// Every bulb id of a beat, in natural order, kept per pair of bulb sets (a beat's frames all
// draw the same pair).
const idLists = new WeakMap();
function idsOf(a, z) {
  let byZ = idLists.get(a);
  if (!byZ) idLists.set(a, byZ = new WeakMap());
  let ids = byZ.get(z);
  if (!ids) byZ.set(z, ids = [...new Set([...Object.keys(a), ...Object.keys(z)])].sort(natural));
  return ids;
}
// ---- one frame: beat `beat` from scene a to scene z at u (a static frame: a = z, no beat) ----
function frame(layout, a, z, beat, u, palette, view, far = null) {
  const base = layout.base, P = view.prefix ?? 'm-', m = palette.machine, motions = beat?.motion || {};
  const reduced = view.motion === 'reduced' && beat !== null, v = reduced ? win(u, [.45, .55]) : null;
  const digits = !!view.digits, cull = far?.rect;
  // Legibility (1.3): with view.minFont, a value pill whose text would draw under minFont px
  // (and an INPUT or OUTPUT caption under 0.8 of it) grows into the free space around it, up
  // to that size: never over a bulb (where it starts or ends this beat), a block, IO, a
  // static tower's furniture, another label or the edge of the framed area. The layout's
  // sizes are untouched, so 6.3b holds; what is drawn only uses room that is empty.
  const legible = far?.legible && (far.legible.minFont > 27 * far.legible.scale || .8 * far.legible.minFont > 14 * far.legible.scale) ? far.legible : null;
  const obst = legible ? [] : null;
  const keep = (x, y, rad, t, k) => { if (obst && !culled(x, y)) obst.push({x0: x - rad, y0: y - rad - (k === 'lamp' ? FURNITURE.ghosts[1][0] : 0), x1: x + rad + (digits ? UNITS.gutter : 0), y1: y + rad, t}); };
  const parts = {wires: [], io: [], blocks: [], furniture: [], removed: [], resting: [], moving: [], edigits: [], column: [], bursts: [], marks: [], beads: [], pills: [], arrows: [], hud: []};
  const collapsedT = t => isCollapsed(t) || !!far?.collapse(t);
  const offsetOf = (t, b) => !isCollapsed(t) && far?.collapse(t) ? {x: 0, y: -UNITS.coin * (b.k === 'light' ? 0 : b.l), scale: base === 'e' ? UNITS.eScale : 1} : bulbOffset(base, t, b);
  const posIn = (scene, b) => {
    const t = scene.towers[b.t]; if (!t) return null;
    const o = layout.placeOf(t.at), off = offsetOf(t, b);
    return {x: o.x + off.x, y: o.y + off.y, scale: off.scale, oy: o.y, pitch: collapsedT(t) ? UNITS.coin : PITCH, perch: off.y + (collapsedT(t) ? UNITS.coin : PITCH) * (b.k === 'light' && collapsedT(t) ? 0 : b.l)};
  };
  const ghostOf = t => t?.ghost ? .55 : 1;
  // Where each bulb's top is, for the pills: a surviving tower's pill rides on the bulbs it
  // ends with (fading ones pull it by their opacity); a vanishing tower's on the bulbs it had.
  const tops = [];
  const topOf = (y, scale, k) => y - scale * (k === 'lamp' ? FURNITURE.ghosts[1][0] + R * FURNITURE.ghosts[1][1] : R);
  const towerTop = (ta, tz, top, o, solid) => tops.push({ta, tz, top, o, solid});
  const drawnAt = new Map();  // tower → [{x, y, level, scale}] for the place-value column
  const markOpacity = beat ? Math.min(E(u, [0, .1]), 1 - E(u, [.9, 1])) : 0;
  const labelScene = reduced ? (v < .5 ? a : z) : (u < .9 ? a : z);
  // Towers whose light glides along a path this beat: the fill readout in their note belongs
  // to the light at rest (3.3), so the old one fades out as the light sets off and the new one
  // shows only when the labels switch at u 0.9.
  const gliding = new Set();
  if (!reduced) for (const [id, mo] of Object.entries(motions)) { const q = mo.path && (a.bulbs[id] || z.bulbs[id]); if (q?.k === 'light') gliding.add(q.t); }
  const atActive = t => { const p = parsePlace(t.at); return view.active === 'io' ? p.io === 'io' : p.node === view.active; };
  const origins = new Map();
  const originOf = tid => {
    if (origins.has(tid)) return origins.get(tid);
    const ta = a.towers[tid], tz = z.towers[tid], oa = ta && layout.placeOf(ta.at), oz = tz && layout.placeOf(tz.at);
    const e = reduced ? (v < .5 ? 0 : 1) : E(u, [0, 1]);
    const o = oa && oz ? {x: lerp(oa.x, oz.x, e), y: lerp(oa.y, oz.y, e)} : oa || oz;
    origins.set(tid, o); return o;
  };

  // -- bulbs --
  const bursts = new Map();
  // off camera (with a viewport): not drawn at all
  const culled = (x, y) => !!cull && (x + R * 2 < cull.x || x - R * 2 > cull.x + cull.w || y + R * 2 < cull.y || y - R * 2 > cull.y + cull.h);
  const bulbItem = ({id, was = false, x, y, scale, level, layers, opacity, k, slot, owed, dissolve = 0, tower, glyph}) => {
    if (r(opacity) === 0 || culled(x, y)) return null;
    let body = '';
    if (k === 'light') body += `<use href="#${P}halo"/>`;
    for (const {s, o} of layers) if (r(o) > 0) body += `<use href="#${P}${symbolOf(s, k)}"${attr('opacity', o)}/>`;
    const lit = layers.at(-1).s;
    if (k === 'lamp') body += `<use href="#${P}lamp"/>` + FURNITURE.ghosts.map(([dy, s, o]) => `<use href="#${P}${symbolOf(lit, k)}" transform="translate(0 ${-dy}) scale(${s})" opacity="${o}"/>`).join('');
    if (base === 'e' && slot === 2 && lit !== 0) body += `<use href="#${P}overhang"/>`;
    if (owed) body += `<use href="#${P}owed"/>`;
    if (r(dissolve) > 0) body += `<circle r="${R * .62}" fill="#fff" opacity="${r(dissolve * .9)}"/>`;
    const dominant = layers.reduce((p, q) => q.o > p.o ? q : p).s;
    const head = `<g class="mb" ${was ? 'data-was' : 'data-b'}="${id}" data-s="${dominant}" data-l="${r(level)}" data-t="${tower}" transform="translate(${r(x)} ${r(y)})${r(scale) === 1 ? '' : ` scale(${r(scale)})`}"${attr('opacity', opacity)}>`;
    return {x, y, scale, o: opacity, glyph, svg: show => head + body + (show && glyph ? glyph : '') + '</g>'};
  };
  // A digit glyph stays hidden where it would land on another bulb (the towers of one block
  // share the space between them: COMP's verdict stands in .L's gutter). Bulbs are bucketed
  // in cells wider than any bulb's reach, so only the neighbouring cells are searched.
  let grid = null;
  const CELL = 128, cellOf = v => Math.floor(v / CELL);
  const covered = (item, gx, gy) => {
    if (!grid) {
      grid = new Map();
      for (const l of [parts.removed, parts.resting, parts.moving]) for (const other of l) if (r(other.o) > .05) {
        const key = cellOf(other.x) + ',' + cellOf(other.y), cell = grid.get(key);
        if (cell) cell.push(other); else grid.set(key, [other]);
      }
    }
    const cx = cellOf(gx), cy = cellOf(gy);
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) for (const other of grid.get(i + ',' + j) || []) {
      if (other !== item && Math.abs(other.x - gx) < R * other.scale + 12 * item.scale && Math.abs(other.y - gy) < R * other.scale * .8) return true;
    }
    return false;
  };
  const withGlyphs = list => list.map(item => item.glyph ? item.svg(!covered(item, item.x + (R + UNITS.gutter / 2) * item.scale, item.y)) : item.svg(false));
  // the digit glyph right of a column bulb (T is a barred 1)
  const glyphsBeside = t => digits && !!t && t.form === 'tower' && !collapsedT(t) && !t.pending && base !== 'e';
  const glyphFor = (t, b, s) => {
    if (!glyphsBeside(t) || (b.slot ?? 0) !== 0) return '';
    const g = m.glyph, x = R + UNITS.gutter / 2, ch = b.k === 'lamp' ? `…${s ? 1 : 0}` : s ? '1' : '0';
    return `<text class="digit" x="${x}" y="2" font-size="${b.k === 'lamp' ? 30 : 40}" text-anchor="middle" dominant-baseline="central" fill="${g}">${ch}</text>` + (base === 'ternary' && s < 0 ? `<path d="M${x - 11} -24h22" stroke="${g}" stroke-width="5" stroke-linecap="round"/>` : '');
  };
  const ids = idsOf(a.bulbs, z.bulbs);
  for (const id of ids) {
    const ba = a.bulbs[id], bz = z.bulbs[id], mo = motions[id] || {};
    if (reduced) {
      // hold, crossfade, hold: never between levels
      const pa = ba && posIn(a, ba), pz = bz && posIn(z, bz);
      if (obst) { if (pa) keep(pa.x, pa.y, R * pa.scale, ba.t, ba.k); if (pz) keep(pz.x, pz.y, R * pz.scale, bz.t, bz.k); }
      const same = pa && pz && r(pa.x) === r(pz.x) && r(pa.y) === r(pz.y) && pa.scale === pz.scale && ba.s === bz.s && ba.k === bz.k && ba.o === bz.o;
      if (same) {
        const item = bulbItem({id, x: pz.x, y: pz.y, scale: pz.scale, level: bz.l, layers: [{s: bz.s, o: 1}], opacity: lerp(ghostOf(a.towers[ba.t]), ghostOf(z.towers[bz.t]), v), k: bz.k, slot: bz.slot, owed: bz.o, tower: bz.t, glyph: glyphFor(z.towers[bz.t], bz, bz.s)});
        if (item) parts.resting.push(item);
        (drawnAt.get(bz.t) || drawnAt.set(bz.t, []).get(bz.t)).push({x: pz.x - R * pz.scale, level: bz.l});
        continue;
      }
      if (pa) { const item = bulbItem({id, was: !!pz, x: pa.x, y: pa.y, scale: pa.scale, level: ba.l, layers: [{s: ba.s, o: 1}], opacity: (1 - v) * ghostOf(a.towers[ba.t]), k: ba.k, slot: ba.slot, owed: ba.o, tower: ba.t, glyph: glyphFor(a.towers[ba.t], ba, ba.s)}); if (item) parts.removed.push(item); }
      if (pz) { const item = bulbItem({id, x: pz.x, y: pz.y, scale: pz.scale, level: bz.l, layers: [{s: bz.s, o: 1}], opacity: v * ghostOf(z.towers[bz.t]), k: bz.k, slot: bz.slot, owed: bz.o, tower: bz.t, glyph: glyphFor(z.towers[bz.t], bz, bz.s)}); if (item) parts.resting.push(item); (drawnAt.get(bz.t) || drawnAt.set(bz.t, []).get(bz.t)).push({x: pz.x - R * pz.scale, level: bz.l}); }
      if (pa && pz && (r(pa.x) !== r(pz.x) || r(pa.y) !== r(pz.y)) && r(markOpacity) > 0) parts.arrows.push(arrowSVG(pa, pz, m.glyph, .35 * markOpacity));
      else if (pa && !pz && mo.to && r(markOpacity) > 0) { const tgt = posIn(z.towers[mo.to.t] ? z : a, {...mo.to, k: ba.k}); if (tgt && r(tgt.y) !== r(pa.y)) parts.arrows.push(arrowSVG(pa, tgt, m.glyph, .35 * markOpacity)); }
      else if (!pa && pz && mo.from && r(markOpacity) > 0) { const src = posIn(a.towers[mo.from.t] ? a : z, {...mo.from, k: bz.k}); if (src && r(src.y) !== r(pz.y)) parts.arrows.push(arrowSVG(src, pz, m.glyph, .35 * markOpacity)); }
      continue;
    }
    if (ba && bz) {
      const pa = posIn(a, ba), pz = posIn(z, bz); if (!pa || !pz) continue;
      if (obst) { keep(pa.x, pa.y, R * pa.scale, ba.t, ba.k); keep(pz.x, pz.y, R * pz.scale, bz.t, bz.k); }
      const e = E(u, mo.move || [0, 1]);
      let x = lerp(pa.x, pz.x, e), y = lerp(pa.y, pz.y, e), level = lerp(ba.l, bz.l, e);
      const scale = lerp(pa.scale, pz.scale, e);
      if (mo.path && u < 1) { level = pathLevel(mo.path, u); y = lerp(pa.oy, pz.oy, e) - pz.pitch * level + lerp(pa.perch, pz.perch, e); }
      towerTop(ba.t, bz.t, topOf(y, scale, bz.k), 1, true);
      (drawnAt.get(bz.t) || drawnAt.set(bz.t, []).get(bz.t)).push({x: x - R * scale, level});
      if (culled(x, y)) continue;
      const [s0, s1, f] = stateAt(ba.s, bz.s, mo, u);
      const layers = s0 === s1 || f <= 0 ? [{s: f >= 1 ? s1 : s0, o: 1}] : f >= 1 ? [{s: s1, o: 1}] : [{s: s0, o: Math.min(1, 2 * (1 - f))}, {s: s1, o: f}];
      const opacity = lerp(ghostOf(a.towers[ba.t]), ghostOf(z.towers[bz.t]), E(u, mo.state || [.6, 1]));
      const moving = u < 1 && (r(pa.x) !== r(pz.x) || r(pa.y) !== r(pz.y) || !!mo.path || pa.scale !== pz.scale);
      const shown = layers.reduce((p, q) => q.o > p.o ? q : p).s;
      const item = bulbItem({id, x, y, scale, level, layers, opacity, k: bz.k ?? ba.k, slot: bz.slot, owed: u < .9 ? ba.o : bz.o, tower: bz.t, glyph: glyphFor(z.towers[bz.t], bz, shown)});
      if (item) (moving ? parts.moving : parts.resting).push(item);
    } else if (ba) {
      const pa = posIn(a, ba); if (!pa) continue;
      let tgt = pa;
      if (mo.to) tgt = posIn(z.towers[mo.to.t] ? z : a, {t: mo.to.t, l: mo.to.l, slot: mo.to.slot, k: ba.k}) || pa;
      else if (z.towers[ba.t]) tgt = posIn(z, ba);
      if (obst) { keep(pa.x, pa.y, R * pa.scale, ba.t, ba.k); if (tgt !== pa && !mo.burst && !mo.dissolve) keep(tgt.x, tgt.y, R * tgt.scale, ba.t, ba.k); }
      const e = E(u, mo.move || [0, 1]);
      let x = lerp(pa.x, tgt.x, e), y = lerp(pa.y, tgt.y, e), level = lerp(ba.l, mo.to ? mo.to.l : ba.l, e);
      if (mo.path) { level = pathLevel(mo.path, u); y = lerp(pa.oy, tgt.oy, e) - tgt.pitch * level + lerp(pa.perch, tgt.perch, e); }
      const fade = mo.fade || (mo.dissolve ? [0, 1] : mo.burst ? [.6, 1] : [.3, 1]);
      const opacity = (1 - E(u, fade)) * ghostOf(a.towers[ba.t]);
      towerTop(ba.t, null, topOf(y, pa.scale, ba.k), opacity, false);
      if (mo.burst) {
        const key = `${mo.to ? mo.to.t : ba.t}:${mo.to ? mo.to.l : ba.l}`;
        if (!bursts.has(key)) bursts.set(key, tgt);
      }
      if (culled(x, y)) continue;
      const [s0, s1, f] = mo.via ? stateAt(ba.s, mo.via.s, {via: mo.via, state: [2, 3]}, u) : [ba.s, ba.s, 0];
      const layers = s0 === s1 || f <= 0 ? [{s: s0, o: 1}] : f >= 1 ? [{s: s1, o: 1}] : [{s: s0, o: Math.min(1, 2 * (1 - f))}, {s: s1, o: f}];
      const item = bulbItem({id, x, y, scale: lerp(pa.scale, tgt.scale, e), level, layers, opacity, k: ba.k, slot: ba.slot, owed: ba.o, dissolve: mo.dissolve ? E(u, [0, .5]) : 0, tower: ba.t, glyph: glyphFor(a.towers[ba.t], ba, layers.at(-1).s)});
      if (item) parts.removed.push(item);
    } else {
      // a bulb born without a source appears in its tower, and travels with it
      const t = z.towers[bz.t]; if (!t) continue;
      const o = originOf(bz.t), off = offsetOf(t, bz), pz = {x: o.x + off.x, y: o.y + off.y, scale: off.scale};
      const src = mo.from ? posIn(a.towers[mo.from.t] ? a : z, {t: mo.from.t, l: mo.from.l, slot: mo.from.slot, k: bz.k}) : null;
      if (obst) { keep(pz.x, pz.y, R * pz.scale, bz.t, bz.k); if (src) keep(src.x, src.y, R * src.scale, bz.t, bz.k); }
      const e = E(u, mo.move || [0, 1]), grow = E(u, mo.in || [0, .3]);
      const x = src ? lerp(src.x, pz.x, e) : pz.x, y = src ? lerp(src.y, pz.y, e) : pz.y;
      const scale = (src ? lerp(src.scale, pz.scale, e) : pz.scale) * (mo.grow ? .25 + .75 * grow : 1);
      const opacity = (src ? 1 : grow) * ghostOf(z.towers[bz.t]);
      towerTop(null, bz.t, topOf(y, scale, bz.k), src ? 1 : opacity, !!src);
      (drawnAt.get(bz.t) || drawnAt.set(bz.t, []).get(bz.t)).push({x: x - R * scale, level: bz.l});
      if (culled(x, y)) continue;
      const moving = u < 1 && (!!src && (r(src.x) !== r(pz.x) || r(src.y) !== r(pz.y)) || !!mo.grow && grow < 1);
      const item = bulbItem({id, x, y, scale, level: src ? lerp(mo.from.l, bz.l, e) : bz.l, layers: [{s: bz.s, o: 1}], opacity, k: bz.k, slot: bz.slot, owed: bz.o, tower: bz.t, glyph: glyphFor(z.towers[bz.t], bz, bz.s)});
      if (item) (moving ? parts.moving : parts.resting).push(item);
    }
  }
  // a cancellation flashes where its partners meet, fading to nothing by the beat's end
  if (!reduced && u >= .6 && u < 1) for (const p of bursts.values()) { const e = E(u, [.6, 1]); parts.bursts.push(`<use href="#${P}burst" transform="translate(${r(p.x)} ${r(p.y)}) scale(${r(.6 + e)})"${attr('opacity', 1 - e)}/>`); }

  // -- towers: furniture, rails, dust, base-e digits, pills --
  // each tower's bulb tops, in drawing order: a tower that ends the beat rides on the bulbs it
  // ends with and those leaving it; a vanishing tower on the bulbs it had
  const topsBy = {ending: new Map(), leaving: new Map()};
  for (const q of tops) for (const [map, key] of [[topsBy.ending, q.tz ?? q.ta], [topsBy.leaving, q.ta]]) if (key !== null) { const list = map.get(key); if (list) list.push(q); else map.set(key, [q]); }
  const tids = [...new Set([...Object.keys(a.towers), ...Object.keys(z.towers)])].sort(natural);
  const fadeBoth = (inA, inZ, winIn, winOut) => inA && inZ ? 1 : inZ ? (reduced ? v : E(u, winIn)) : inA ? (reduced ? 1 - v : 1 - E(u, winOut)) : 0;
  for (const tid of tids) {
    const ta = a.towers[tid], tz = z.towers[tid], o = originOf(tid), lt = labelScene.towers[tid];
    const bulbsA = ta ? bulbsOf(a, tid) : [], bulbsZ = tz ? bulbsOf(z, tid) : [];
    // off camera: the tower's bulbs and furniture, and its pill however wide it is
    if (cull) {
      const reach = Math.max(400, ...[ta, tz].filter(Boolean).map(t => { const w = pillWidth(pillLines(t, digits)); return Math.abs(layout.pillCentre(t.at, w) - o.x) + w / 2 + (t.note ? 6 + textWidth(t.note) : 0); }));
      if (!(o.x + reach > cull.x && o.x - reach < cull.x + cull.w)) continue;
    }
    // a tower that stays put this beat: its whole shape (rail, dust, sockets, ghosts) for the labels
    if (obst && ta && tz && ta.at === tz.at) for (const [s, t] of [[a, ta], [z, tz]]) if (!collapsedT(t)) { const q = layout.towerParts(s, tid, {gutter: digits})[0]; if (q) obst.push({x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h, t: tid}); }
    // base-e furniture: two sockets and the sliver per level, the radix line, the floor
    const fa = ta && !collapsedT(ta) ? furnitureOf(base, ta, bulbsA) : null, fz = tz && !collapsedT(tz) ? furnitureOf(base, tz, bulbsZ) : null;
    if (fa || fz) {
      const lo = Math.min(fa?.floor ?? Infinity, fz?.floor ?? Infinity), hi = Math.max(fa?.top ?? -Infinity, fz?.top ?? -Infinity);
      let svg = '';
      for (let l = lo; l <= hi; l++) {
        const op = fadeBoth(fa && l >= fa.floor && l <= fa.top, fz && l >= fz.floor && l <= fz.top, [0, .3], [.3, 1]);
        if (r(op) === 0) continue;
        const y = o.y - PITCH * l, s = UNITS.eScale;
        svg += `<g data-level="${l}"${attr('opacity', op)}>` + [0, 1].map(j => `<use href="#${P}socket" transform="translate(${r(o.x + UNITS.eSlots[j])} ${r(y)}) scale(${s})"/>`).join('') + `<use href="#${P}sliver" transform="translate(${r(o.x + UNITS.eSlots[2])} ${r(y)}) scale(${s})"/></g>`;
      }
      const radix = fadeBoth(!!fa, !!fz, [0, .3], [.3, 1]);
      if (r(radix) > 0) svg += `<path d="M${r(o.x - 72)} ${r(o.y + PITCH / 2)}H${r(o.x + 140)}" stroke="${m.rail}" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"${attr('opacity', radix)}/>`;
      parts.furniture.push(svg);
    }
    // a light's rail: integer ticks from min(−3, ⌊h⌋) to ⌊h⌋ + 1
    const ra = ta && !collapsedT(ta) ? railOf(ta, bulbsA) : null, rz = tz && !collapsedT(tz) ? railOf(tz, bulbsZ) : null;
    if (ra || rz) {
      // a rail that changes its span (a light rising or falling past levels) eases to the new one
      const k = reduced ? (v < .5 ? 0 : 1) : E(u, [0, 1]), op = fadeBoth(!!ra, !!rz, [0, .3], [.9, 1]);
      const from = ra && rz ? lerp(ra.from, rz.from, k) : (ra || rz).from, to = ra && rz ? lerp(ra.to, rz.to, k) : (ra || rz).to;
      if (r(op) > 0) {
        let svg = `<path d="M${r(o.x)} ${r(o.y - PITCH * from + 10)}V${r(o.y - PITCH * to - 10)}" stroke="${m.rail}" stroke-width="3" stroke-linecap="round"/>`;
        // ticks on the rail, their numbers clear of the level's sockets
        const nx = o.x + UNITS.eSlots[0] - R * UNITS.eScale - 10;
        // (the Digits view's place values take the numbers' place at the active node)
        const numbers = !(digits && view.active && atActive(lt || tz || ta));
        for (let l = Math.ceil(from - 1e-9); l <= to + 1e-9; l++) svg += `<path d="M${r(o.x - 10)} ${r(o.y - PITCH * l)}h20" stroke="${m.rail}" stroke-width="${l === 0 ? 3.5 : 2}"/>` + (numbers ? `<text x="${r(nx)}" y="${r(o.y - PITCH * l)}" font-size="20" text-anchor="end" dominant-baseline="central" fill="${m.rail}">${l < 0 ? '−' + -l : l}</text>` : '');
        parts.furniture.push(`<g class="rail"${attr('opacity', op)}>${svg}</g>`);
      }
    }
    // dust: an exact remainder below the floor
    const da = ta?.dust && !collapsedT(ta), dz = tz?.dust && !collapsedT(tz);
    if (da || dz) {
      const op = fadeBoth(da, dz, [.6, 1], [.3, 1]), d = dustBox();
      if (r(op) > 0) parts.furniture.push(`<g class="dust"${attr('opacity', op)}><ellipse cx="${r(o.x + d.x)}" cy="${r(o.y + d.y)}" rx="${d.rx}" ry="${d.ry}" fill="url(#${P}dust-fill)"/><text x="${r(o.x + d.x)}" y="${r(o.y + d.y)}" font-size="30" text-anchor="middle" dominant-baseline="central" fill="${m.dust}">…</text></g>`);
    }
    // base-e digit glyphs, one per level, and a badge where a pile holds more than 6 bulbs
    if (base === 'e' && lt && lt.form === 'tower' && !collapsedT(lt)) {
      const own = bulbsOf(labelScene, tid), f = furnitureOf(base, lt, own);
      const op = reduced ? 1 : fadeBoth(!!ta, !!tz, [0, .3], [.3, 1]);
      let svg = '';
      for (let l = f.floor; l <= f.top; l++) {
        const n = own.filter(b => b.l === l && b.s !== 0).length, y = o.y - PITCH * l;
        if (n > 6) svg += `<text x="${r(o.x + UNITS.eSlots[0] + 2 * FURNITURE.perch + 40)}" y="${r(y - UNITS.labelGap)}" font-size="22" dominant-baseline="central" fill="${m.scan}">×${n}</text>`;
        if (digits && !lt.pending) svg += `<text class="digit" x="${r(o.x + UNITS.eSlots[2] + R * UNITS.eScale + UNITS.gutter / 2)}" y="${r(y + 2)}" font-size="36" text-anchor="middle" dominant-baseline="central" fill="${m.glyph}">${n}</text>`;
      }
      if (svg && r(op) > 0) parts.edigits.push(`<g class="e-digits"${attr('opacity', op)}>${svg}</g>`);
    }
    // the value pill, 42 above the top bulb; its text switches at u 0.9
    const pill = (t, scene, at, origin, topY, opacity) => {
      if (!t || r(opacity) === 0) return '';
      const lines = pillLines(t, digits), w = pillWidth(lines), h = UNITS.pillLine * lines.length;
      const wa = ta ? pillWidth(pillLines(ta, digits)) : w, wz = tz ? pillWidth(pillLines(tz, digits)) : w;
      const cx = at ?? (ta && tz && !reduced ? lerp(layout.pillCentre(ta.at, wa), layout.pillCentre(tz.at, wz), E(u, [0, 1])) : layout.pillCentre(t.at, w));
      const lift = layout.pillLift(scene, tid, digits), bottom = topY - (UNITS.labelGap - R) + lift, top = bottom - h, place = parsePlace(t.at);
      // a pill that climbed over its neighbours hangs a leader down to its tower
      const lead = lift < 0 ? `<path d="M${r(cx)} ${r(bottom)}V${r(bottom - lift)}" stroke="${m.label}" stroke-width="1.5" stroke-dasharray="3 4" opacity=".6"/>` : '';
      let svg = `<rect x="${r(cx - w / 2)}" y="${r(top)}" width="${w}" height="${h}" rx="18" fill="${m.labelFill}" fill-opacity=".85" stroke="${m.label}" stroke-width="1.2"/>`;
      lines.forEach((line, j) => { svg += `<text x="${r(cx)}" y="${r(top + UNITS.pillLine * (j + .5) + 1)}" font-size="${j ? 22 : 27}" text-anchor="middle" dominant-baseline="central" fill="${m.label}"${j ? ' opacity=".8"' : ''}>${esc(line)}</text>`; });
      const noteOp = gliding.has(tid) && u < .9 ? 1 - E(u, [0, .1]) : 1;
      let x0 = cx - w / 2, x1 = cx + w / 2;
      if (t.note && r(noteOp) > 0) {
        const nw = textWidth(t.note), left = place.socket === 'L' && place.i === null ? cx - w / 2 - 6 - nw : cx + w / 2 + 6;
        x0 = Math.min(x0, left); x1 = Math.max(x1, left + nw);
        svg += `<g class="note"${attr('opacity', noteOp)}><rect x="${r(left)}" y="${r(bottom - UNITS.pillLine)}" width="${nw}" height="${UNITS.pillLine}" rx="18" fill="${m.labelFill}" fill-opacity=".6" stroke="${m.label}" stroke-width="1" stroke-dasharray="4 3"/><text x="${r(left + nw / 2)}" y="${r(bottom - UNITS.pillLine / 2 + 1)}" font-size="22" text-anchor="middle" dominant-baseline="central" fill="${m.label}">${esc(t.note)}</text></g>`;
      }
      const wrap = body => `<g class="pill" data-t="${tid}"${attr('opacity', opacity)}>${lead}${body}</g>`;
      // legible: a label that grows about its foot (centred, or from a corner) once resolved
      if (legible) return {t: tid, prio: atActive(t) ? 0 : 2, font: 27, inner: svg, wrap, box: {x0, y0: top, x1, y1: bottom}, anchors: [[cx, bottom], [x0, bottom], [x1, bottom]]};
      return wrap(svg);
    };
    const top = (() => {
      const mine = (tz ? topsBy.ending : topsBy.leaving).get(tid) || [];
      const solid = mine.filter(q => q.solid).map(q => q.top);
      let t = solid.length ? Math.min(...solid) : null;
      for (const {top: y, o: op} of mine.filter(q => !q.solid).sort((p, q) => p.top - q.top)) {
        if (t === null) { if (r(op) > 0) t = y; continue; }
        if (y < t && r(op) > 0) { t = lerp(t, y, op); break; }
      }
      const f = labelScene.towers[tid] && !collapsedT(labelScene.towers[tid]) ? furnitureOf(base, labelScene.towers[tid], bulbsOf(labelScene, tid)) : null;
      if (f) t = Math.min(t ?? Infinity, o.y - PITCH * f.top - R * UNITS.eScale);
      return t ?? o.y - R;
    })();
    if (reduced) {
      const staticTop = (scene, t) => { const own = bulbsOf(scene, tid); let y = Infinity; for (const b of own) { const p = posIn(scene, b); if (p) y = Math.min(y, topOf(p.y, p.scale, b.k)); } const f = !collapsedT(t) && furnitureOf(base, t, own); if (f) y = Math.min(y, layout.placeOf(t.at).y - PITCH * f.top - R * UNITS.eScale); return y === Infinity ? layout.placeOf(t.at).y - R : y; };
      const same = ta && tz && ta.at === tz.at && pillLines(ta, digits).join('\n') === pillLines(tz, digits).join('\n') && ta.note === tz.note && staticTop(a, ta) === staticTop(z, tz);
      if (same) parts.pills.push(pill(tz, z, layout.pillCentre(tz.at, pillWidth(pillLines(tz, digits))), layout.placeOf(tz.at), staticTop(z, tz), ghostOf(tz)));
      else {
        if (ta) parts.pills.push(pill(ta, a, layout.pillCentre(ta.at, pillWidth(pillLines(ta, digits))), null, staticTop(a, ta), (1 - v) * ghostOf(ta)));
        if (tz) parts.pills.push(pill(tz, z, layout.pillCentre(tz.at, pillWidth(pillLines(tz, digits))), null, staticTop(z, tz), v * ghostOf(tz)));
      }
    } else {
      // A tower that leaves as another arrives at its place (balanced ternary's judge: the kept
      // try slides onto the dividend's place) lets its pill go before the newcomer's lands,
      // rather than printing the two labels over each other ('−9' and '9' read '−99').
      const ceded = ta && !tz && Object.values(z.towers).some(t => t.at === ta.at);
      parts.pills.push(pill(lt, labelScene, null, o, top, lerp(ghostOf(ta || tz), ghostOf(tz || ta), E(u, [.6, 1])) * (ceded ? 1 - E(u, [0, .25]) : 1)));
    }
  }

  // -- the place-value column, left of the active node's leftmost tower (as the beat ends) --
  if (digits && view.active) {
    let left = Infinity, y0 = 0, hi = 0;
    for (const [tid, list] of drawnAt) {
      const t = z.towers[tid]; if (!t || !atActive(t) || collapsedT(t)) continue;
      const x = Math.min(...list.map(q => q.x));
      if (x < left) { left = x; y0 = originOf(tid).y; }
      hi = Math.max(hi, ...list.map(q => Math.round(q.level)));
    }
    if (left < Infinity) {
      const lo = base === 'e' ? FURNITURE.floor : 0, b = RADIX[base];
      let svg = '';
      for (let l = lo; l <= hi; l++) svg += `<text x="${r(left - UNITS.placeCol / 2)}" y="${r(y0 - PITCH * l)}" font-size="22" text-anchor="middle" dominant-baseline="central" fill="${m.glyph}">${b}${sup(l)}</text>`;
      parts.column.push(`<g class="place-values" opacity=".55">${svg}</g>`);
      if (obst) obst.push({x0: left - UNITS.placeCol, y0: y0 - PITCH * hi - 14, x1: left, y1: y0 - PITCH * lo + 14, t: null});
    }
  }

  // -- nodes and wires --
  const nids = [...new Set([...Object.keys(a.nodes), ...Object.keys(z.nodes)])].filter(id => layout.nodeAt(id)).sort(natural);
  for (const nid of nids) {
    const na = a.nodes[nid], nz = z.nodes[nid], at = layout.nodeAt(nid), wire = layout.wire(nid), e = E(u, [0, 1]);
    const parent = layout.parentOf(nid), pc = parent === 'io' || !layout.nodeAt(parent) ? {x: 0, y: 0} : layout.nodeAt(parent);
    let centre = at, pts = wire, opacity = 1, wireOpacity = 1;
    if (na && !nz) {
      // spent: its wire reels into the parent socket while the block fades
      if (reduced) { opacity = wireOpacity = 1 - v; }
      else { pts = cutPath(wire, 1 - e); opacity = 1 - E(u, [.3, 1]); }
    } else if (!na && nz) {
      // born: it slides out of its parent's centre as its wire grows
      if (reduced) { opacity = wireOpacity = v; }
      else { const start = [pc.x, pc.y - UNITS.block[1] / 2]; pts = wire.map(p => [lerp(start[0], p[0], e), lerp(start[1], p[1], e)]); centre = {x: lerp(pc.x, at.x, e), y: lerp(pc.y, at.y, e)}; }
    }
    if (r(wireOpacity) > 0) parts.wires.push(polyline(pts, m.wire, UNITS.wire, attr('opacity', wireOpacity)));
    if (r(opacity) === 0) continue;
    const n = nz || na, k = reduced ? v : e;
    const ga = na?.glyph ?? 1, gz = nz?.glyph ?? 1, alive = na && nz ? lerp(ga, gz, k) : n.glyph ?? 1;
    const fadeGlyph = na && !nz && !reduced ? 1 - E(u, [0, .5]) : 1;
    const opChange = na && nz && na.op !== nz.op, swap = reduced ? v : E(u, [0, .15]);
    const tilt = na && nz ? lerp(na.tilt ?? 0, nz.tilt ?? 0, k) : n.tilt ?? 0;
    // the quotient register's ring, while a register stands there
    const qa = Object.values(a.towers).some(t => t.at === `${nid}.Q`), qz = Object.values(z.towers).some(t => t.at === `${nid}.Q`);
    const q = qa || qz ? {x: layout.placeOf(`${nid}.Q`).x - at.x, o: qz ? (qa ? 1 : reduced ? v : E(u, [0, .3])) : reduced ? 1 - v : 1 - E(u, [.3, 1])} : null;
    let body = blockSVG(opChange ? nz.op : n.op, palette, base, {glyph: alive * fadeGlyph * (opChange ? swap : 1), oldOp: opChange ? na.op : null, oldGlyph: alive * (1 - swap), tilt, sx: layout.socketX, w: layout.blockW, q, id: nid});
    // outlines round the whole block, its socket rings included
    const span = UNARY.has(n.op) ? layout.blockW / 2 : Math.max(layout.blockW / 2, layout.socketX + 44), ring = (g, extra) => `<rect x="${-span - g}" y="${-44 - g}" width="${2 * (span + g)}" height="${88 + 2 * g}" rx="${44 + g}" fill="none" ${extra}/>`;
    // the block with its socket rings, and its hub, for the labels to keep clear of (the hub
    // apart: a band of its height over the whole block kept a pill over a socket at 6.6 px)
    const hub = pts.at(-1), hx = na && !nz && !reduced ? hub[0] : centre.x, hy = na && !nz && !reduced ? hub[1] : centre.y - UNITS.block[1] / 2;
    if (obst) obst.push({x0: centre.x - span, y0: centre.y - 44, x1: centre.x + span, y1: centre.y + 44, t: null}, {x0: hx - UNITS.hub, y0: hy - UNITS.hub, x1: hx + UNITS.hub, y1: hy + UNITS.hub, t: null});
    if (view.highlight === nid) body += ring(8, `stroke="${m.error}" stroke-width="5" class="error"`);
    if (view.selected === nid) body += ring(16, `stroke="${m.wireActive}" stroke-width="3" stroke-dasharray="8 6"`);
    const sel = typeof view.selected === 'string' && view.selected.startsWith(nid + '.') ? view.selected.slice(nid.length + 1) : null;
    if (sel) body += `<circle cx="${sel === 'L' ? -layout.socketX : sel === 'R' ? layout.socketX : 0}" cy="0" r="52" fill="none" stroke="${m.wireActive}" stroke-width="3" stroke-dasharray="8 6"/>`;
    parts.blocks.push(`<g class="block" data-n="${nid}" data-op="${n.op}" transform="translate(${r(centre.x)} ${r(centre.y)})"${attr('opacity', opacity)}>${body}</g>${hubSVG(hx, hy, palette, opacity)}`);
  }

  // -- IO: the horizon, the Input and Output pills on their wires, the triangle and its eye --
  {
    const pills = layout.ioPills;
    // the horizon runs past any camera, the overview's included
    parts.io.push(`<rect x="${-HORIZON}" y="${IO.horizon - 3}" width="${2 * HORIZON}" height="6" fill="${m.rail}" opacity=".12"/><rect x="${-HORIZON}" y="${IO.horizon - .75}" width="${2 * HORIZON}" height="1.5" fill="${m.rail}" opacity=".35"/>`);
    parts.wires.unshift(`<path d="M${pills.in.x} ${IO.pillY}L0 0M${pills.out.x} ${IO.pillY}L0 0" stroke="${m.wire}" stroke-width="${UNITS.wire}"/>`);
    parts.io.push(`<path d="M${-IO.half} ${IO.top}H${IO.half}L0 ${IO.tip}ZM${IO.eye} 0A${IO.eye} ${IO.eye} 0 1 0 ${-IO.eye} 0A${IO.eye} ${IO.eye} 0 1 0 ${IO.eye} 0Z" fill="${m.block}" fill-rule="evenodd" stroke="${m.blockEdge}" stroke-width="2.5" stroke-linejoin="round"/><circle r="${IO.eye}" fill="${palette.bulb.off.fill}" stroke="${m.blockEdge}" stroke-width="1.5" data-socket="io"/>`);
    if (view.selected === 'io') parts.io.push(`<circle r="52" fill="none" stroke="${m.wireActive}" stroke-width="3" stroke-dasharray="8 6"/>`);
    const shown = Object.values(labelScene.towers).some(t => t.at.startsWith('out:'));
    if (obst) { const q = layout.ioBoxes[0]; obst.push({x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h, t: null}); }
    for (const [key, p] of Object.entries(pills)) {
      const lines = key === 'in' ? p.lines : shown ? p.lines : [''], h = UNITS.pillLine * lines.length, top = p.bottom - h;
      let svg = `<rect x="${r(p.x - p.w / 2)}" y="${r(top)}" width="${p.w}" height="${h}" rx="18" fill="${m.labelFill}" stroke="${m.label}" stroke-width="1.2"/>`;
      lines.forEach((line, j) => { if (line) svg += `<text x="${p.x}" y="${r(top + UNITS.pillLine * (j + .5) + 1)}" font-size="${j ? 22 : 27}" text-anchor="middle" dominant-baseline="central" fill="${m.label}">${esc(line)}</text>`; });
      const caption = key === 'in' ? 'INPUT' : 'OUTPUT', cx = key === 'in' ? p.x - p.w / 2 - 10 : p.x + p.w / 2 + 10, cy = p.bottom - UNITS.pillLine / 2 + 1;
      const label = `<text x="${r(cx)}" y="${r(cy)}" font-size="14" letter-spacing="2" text-anchor="${key === 'in' ? 'end' : 'start'}" dominant-baseline="central" fill="${m.label}" opacity=".5">${caption}</text>`;
      if (legible) {
        // the pill grows about its foot, its top or its middle, centred or from its inner end
        // (the one by IO), so it can grow away from a tower that rides up beside it; its caption
        // goes with it, then grows from its own inner end: its middle, else its top or its foot
        // (at the opening INPUT lies under the first input coin's rim, so it grows down from it)
        const cw = 11 * caption.length, box = {x0: p.x - p.w / 2, y0: top, x1: p.x + p.w / 2, y1: p.bottom}, inner = key === 'in' ? box.x1 : box.x0;
        const pill = {t: `io:${key}`, prio: 1, font: 27, inner: svg, box, anchors: [p.x, inner].flatMap(x => [[x, p.bottom], [x, top], [x, (top + p.bottom) / 2]])};
        parts.io.push({io: key, labels: [pill, {t: `caption:${key}`, prio: 3, font: 14, min: .8, inner: label, follow: pill, box: {x0: key === 'in' ? cx - cw : cx, y0: cy - 9, x1: key === 'in' ? cx : cx + cw, y1: cy + 9}, anchors: [[cx, cy], [cx, cy - 9], [cx, cy + 9]]}]});
        continue;
      }
      svg += label;
      parts.io.push(`<g class="io-pill" data-io="${key}">${svg}</g>`);
    }
  }

  // -- marks, beads: visible only during their beat --
  if (beat && r(markOpacity) > 0) {
    for (const mk of beat.marks || []) {
      if (mk.k === 'ring') {
        const o = originOf(mk.t); if (!o) continue;
        const t = z.towers[mk.t] || a.towers[mk.t], pitch = t && collapsedT(t) ? UNITS.coin : PITCH;
        // beside the bulb, or past its digit glyph in the Digits view
        const x = o.x + R + 16 + (glyphsBeside(t) ? UNITS.gutter : 0);
        parts.marks.push(`<g class="mark-ring"${attr('opacity', markOpacity)}><circle cx="${r(x)}" cy="${r(o.y - pitch * mk.l)}" r="13" fill="${m.scan}" opacity=".18"/><circle cx="${r(x)}" cy="${r(o.y - pitch * mk.l)}" r="6" fill="none" stroke="${m.scan}" stroke-width="4"/></g>`);
      } else if (mk.k === 'scan') {
        const c = layout.nodeAt(mk.node); if (!c) continue;
        const level = reduced ? mk.stop ?? 0 : lerp(mk.from, mk.stop ?? 0, E(u, [.3, .8])), half = layout.socketX + 60;
        parts.marks.push(`<g class="mark-scan"${attr('opacity', markOpacity)}><rect x="${r(c.x - half)}" y="${r(c.y - PITCH * level - 4)}" width="${2 * half}" height="8" rx="4" fill="${m.scan}"/><rect x="${r(c.x - half)}" y="${r(c.y - PITCH * level - 12)}" width="${2 * half}" height="24" rx="12" fill="${m.scan}" opacity=".2"/></g>`);
      } else if (mk.k === 'verdict') {
        const c = layout.nodeAt(mk.node), op = Math.min(E(u, [.8, .85]), 1 - E(u, [.9, 1]));
        if (!c || r(op) === 0) continue;
        const col = mk.s > 0 ? palette.bulb.blue.body : mk.s < 0 ? palette.bulb.red.body : palette.bulb.off.stroke;
        parts.marks.push(`<path class="mark-verdict" d="M${r(c.x - 62)} ${r(c.y - 18)}L${r(c.x - 36)} ${r(c.y)}L${r(c.x - 62)} ${r(c.y + 18)}M${r(c.x + 62)} ${r(c.y - 18)}L${r(c.x + 36)} ${r(c.y)}L${r(c.x + 62)} ${r(c.y + 18)}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"${attr('opacity', op)}/>`);
      }
    }
    if (!reduced) {
      let path = null;
      const k = beat.kind, pills = layout.ioPills;
      if (k === 'input') path = [[pills.in.x, IO.pillY], [0, 0]];
      else if (k === 'output') path = [[0, 0], [pills.out.x, IO.pillY]];
      else if (k === 'deliver' && layout.wire(beat.node)) path = layout.wire(beat.node);
      else if (k === 'return' && layout.wire(beat.node)) path = [...layout.wire(beat.node)].reverse();
      if (path) {
        // the bead rides its wire, lit for the beat; a returning wire reels in behind it
        const f = E(u, [0, 1]), [bx, by] = alongPath(path, f), shown = k === 'return' ? cutPath(layout.wire(beat.node), 1 - f) : path;
        parts.wires.push(polyline(shown, m.wireActive, UNITS.wire + 1, attr('opacity', markOpacity)));
        parts.beads.push(`<circle class="bead" cx="${r(bx)}" cy="${r(by)}" r="${UNITS.bead}" fill="${m.wireActive}"${attr('opacity', markOpacity)}/>`);
      }
    }
  }
  // HUD corner brackets round the active node (cyber)
  if (view.active && view.active !== 'io' && palette.name === 'cyber' && layout.nodeAt(view.active) && z.nodes[view.active]) {
    const b = layout.nodeBox(view.active), g = 14, L = 22, x0 = b.x - g, y0 = b.y - g, x1 = b.x + b.w + g, y1 = b.y + b.h + g;
    parts.hud.push(`<path class="hud" d="M${r(x0)} ${r(y0 + L)}V${r(y0)}H${r(x0 + L)}M${r(x1 - L)} ${r(y0)}H${r(x1)}V${r(y0 + L)}M${r(x1)} ${r(y1 - L)}V${r(y1)}H${r(x1 - L)}M${r(x0 + L)} ${r(y1)}H${r(x0)}V${r(y1 - L)}" fill="none" stroke="${m.wireActive}" stroke-width="2.5"/>`);
  }
  if (legible) {
    resolveLabels([...parts.pills.filter(q => q && typeof q === 'object'), ...parts.io.flatMap(q => q?.labels || [])], obst, legible);
    const grown = q => { const [k, e, f] = q.m; return k > 1 + 1e-9 ? `<g transform="matrix(${r(k)} 0 0 ${r(k)} ${r(e)} ${r(f)})">${q.inner}</g>` : q.inner; };
    parts.pills = parts.pills.map(q => q && typeof q === 'object' ? q.wrap(grown(q)) : q);
    parts.io = parts.io.map(q => q?.labels ? `<g class="io-pill" data-io="${q.io}">${q.labels.map(grown).join('')}</g>` : q);
  }
  const order = ['io', 'wires', 'blocks', 'furniture', 'removed', 'resting', 'moving', 'edigits', 'column', 'bursts', 'marks', 'beads', 'pills', 'arrows', 'hud'];
  // the horizon lies behind everything, the triangle over its wires
  const io = parts.io.shift() || '';
  const drawn = {removed: withGlyphs(parts.removed), resting: withGlyphs(parts.resting), moving: withGlyphs(parts.moving)};
  return `<g class="machine" font-family="${esc(m.font)}">${io}${parts.wires.join('')}${parts.io.join('')}` + order.slice(2).map(k => (drawn[k] || parts[k]).join('')).join('') + '</g>';
}
// ---- legible labels (view.minFont) ----
// Scaled by k about an anchor (ax, ay) on or in its box, a label's box meets an obstacle once
// k passes, on each axis, the factor at which its edge reaches the obstacle's near side, so
// the largest free k is a closed form per obstacle (touching is free). An obstacle the label
// already meets at k = 1 leaves it at its own size.
const reachK = (b0, b1, a, o0, o1) => o0 >= a ? (b1 > a ? (o0 - a) / (b1 - a) : Infinity) : o1 <= a ? (b0 < a ? (a - o1) / (a - b0) : Infinity) : 0;
const freeK = (B, [ax, ay], O) => Math.max(1, reachK(B.x0, B.x1, ax, O.x0, O.x1), reachK(B.y0, B.y1, ay, O.y0, O.y1));
const scaleBox = (B, [ax, ay], k) => ({x0: ax + k * (B.x0 - ax), y0: ay + k * (B.y0 - ay), x1: ax + k * (B.x1 - ax), y1: ay + k * (B.y1 - ay)});
const scalePoint = ([x, y], [ax, ay], k) => [ax + k * (x - ax), ay + k * (y - ay)];
const meets = (p, q) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
const unionBox = (p, q) => ({x0: Math.min(p.x0, q.x0), y0: Math.min(p.y0, q.y0), x1: Math.max(p.x1, q.x1), y1: Math.max(p.y1, q.y1)});
// An obstacle a label already lies against at its own size (within the 2 px gap, or into it by
// at most `tol`: a pill's foot 2 units into the socket ring its tower stands on, a pill at the
// stage's edge) keeps it from growing towards it, not away: the obstacle's near face is moved
// back to the label's edge, on the side where the two meet least. Deeper overlaps still block.
function against(B, P, padding, tol) {
  if (!meets(B, P)) return P;
  const sides = [['x0', B.x1 - P.x0, B.x1], ['x1', P.x1 - B.x0, B.x0], ['y0', B.y1 - P.y0, B.y1], ['y1', P.y1 - B.y0, B.y0]];
  const [side, depth, edge] = sides.reduce((p, q) => q[1] < p[1] ? q : p);
  return depth - padding <= tol ? {...P, [side]: edge} : P;
}
// Each label in turn (the active node's pills, IO's, the others, IO's captions; then in drawing
// order) takes the largest k up to its target, from the first anchor that reaches it (else the
// one that goes furthest), clear of the obstacles but its own tower's, of the labels already
// placed as placed and of the rest at their own size, 2 px apart, inside the framed area.
// A label that others follow (an IO pill's INPUT or OUTPUT caption) grows with them as one box
// and carries them along; each follower then grows on its own from where it was carried.
// Sets k, a (the anchor) and m (the matrix's k, e, f) on every label.
function resolveLabels(labels, obstacles, {scale, minFont, frame: F}) {
  const gap = 2 / scale, tol = 1 / scale, big = 1e9, pad = O => ({x0: O.x0 - gap, y0: O.y0 - gap, x1: O.x1 + gap, y1: O.y1 + gap});
  const edges = F ? [{x0: -big, y0: -big, x1: F.x0, y1: big}, {x0: F.x1, y0: -big, x1: big, y1: big}, {x0: -big, y0: -big, x1: big, y1: F.y0}, {x0: -big, y0: F.y1, x1: big, y1: big}] : [];
  const order = labels.map((q, i) => [q, i]).sort((p, q) => p[0].prio - q[0].prio || p[1] - q[1]).map(([q]) => q);
  const followers = L => labels.filter(M => M.follow === L);
  for (const L of order) {
    L.k = 1; L.a = L.anchors[0];
    const carried = L.carried ?? 1, target = (L.min ?? 1) * minFont / (L.font * scale * carried), crew = followers(L);
    const B = crew.reduce((b, M) => unionBox(b, M.box), L.box);
    if (target > 1 + 1e-3) {
      let reach = null;
      for (const a of L.anchors) { const b = scaleBox(B, a, target); reach = reach ? unionBox(reach, b) : b; }
      reach = pad(reach);
      const near = edges.map(e => against(B, e, 0, tol));
      for (const o of obstacles) if (o.t !== L.t && meets(o, reach)) near.push(against(B, pad(o), gap, tol));
      for (const M of labels) if (M !== L && M.t !== L.t && !crew.includes(M)) { const b = M.placed || M.box; if (meets(b, reach)) near.push(against(B, pad(b), gap, 0)); }
      for (const a of L.anchors) {
        let k = target;
        for (const o of near) { k = Math.min(k, freeK(B, a, o)); if (k <= 1) break; }
        if (k > L.k + 1e-6) { L.k = k; L.a = a; }
        if (L.k >= target - 1e-9) break;
      }
    }
    // k is rounded down, and the translation follows the rounded k, so the anchor stays put
    const k = Math.floor(L.k * 1000) / 1000, [K, e, f] = L.m0 ?? [1, 0, 0];
    L.k = k; L.placed = scaleBox(L.box, L.a, k);
    // the drawn matrix: what carried it (K, e, f), then k about its anchor
    L.m = [K * k, k * e + L.a[0] * (1 - k), k * f + L.a[1] * (1 - k)];
    for (const M of crew) {
      M.box = scaleBox(M.box, L.a, k); M.anchors = M.anchors.map(p => scalePoint(p, L.a, k));
      M.carried = carried * k; M.m0 = [k, L.a[0] * (1 - k), L.a[1] * (1 - k)];
    }
  }
}
function arrowSVG(p, q, colour, opacity) {
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, ex = q.x - ux * 20, ey = q.y - uy * 20;
  return `<g class="ghost-arrow"${attr('opacity', opacity)}><path d="M${r(p.x + ux * 20)} ${r(p.y + uy * 20)}L${r(ex)} ${r(ey)}" stroke="${colour}" stroke-width="4" stroke-dasharray="8 6" stroke-linecap="round"/><path d="M${r(ex - uy * 10 - ux * 14)} ${r(ey + ux * 10 - uy * 14)}L${r(ex)} ${r(ey)}L${r(ex + uy * 10 - ux * 14)} ${r(ey - ux * 10 - uy * 14)}" fill="none" stroke="${colour}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

// ---- entry points ----
// The svg body of a beat boundary (scene i is the frame at integer t = i).
export function renderStatic(scene, layout, palette = ink, view = {}) {
  return frame(layout, scene, scene, null, 1, palette, view);
}
// {svg, viewBox, beat, u}: svg is the body for a persistent <svg> holding machineDefs(); the
// viewBox follows the camera when view.viewport is given (or view.camera overrides it).
export function renderMachine(plan, t, layout, palette = ink, view = {}) {
  const n = plan.beats.length, tt = Math.max(0, Math.min(n, Number.isFinite(t) ? t : 0)), scenes = scenesOf(plan);
  const i = tt <= 0 ? 0 : Math.ceil(tt) - 1, u = tt <= 0 ? 0 : tt - i;
  const reduced = view.motion === 'reduced';
  const cam = view.camera || (view.viewport ? cameraAt(plan, layout, tt, view.viewport, {reduced, inset: view.inset || {}}) : layout.bounds);
  let far = null;
  if (view.viewport) {
    // towers away from the active node collapse to coins once their bulbs would draw under
    // 12 px; anything off camera is not drawn at all
    const scale = view.viewport.width / cam.w, node = tt > 0 ? plan.beats[i].node : null;
    const collapse = scale * 2 * R < 12 ? t => { const p = parsePlace(t.at); return node === 'io' ? !p.io : p.node !== node; } : () => false;
    const m = 2 * R + 200;
    far = {collapse, rect: {x: cam.x - m, y: cam.y - m, w: cam.w + 2 * m, h: cam.h + 2 * m}};
    // view.minFont (CSS px): labels may grow to it within the framed area (inset excluded)
    if (view.minFont > 0) { const i = view.inset || {}; far.legible = {scale, minFont: view.minFont, frame: {x0: cam.x + (i.left || 0) / scale, y0: cam.y + (i.top || 0) / scale, x1: cam.x + cam.w - (i.right || 0) / scale, y1: cam.y + cam.h - (i.bottom || 0) / scale}}; }
  }
  const svg = tt <= 0 ? frame(layout, plan.start, plan.start, null, 1, palette, view, far) : frame(layout, scenes[i], scenes[i + 1], plan.beats[i], u, palette, view, far);
  return {svg, viewBox: `${r(cam.x)} ${r(cam.y)} ${r(cam.w)} ${r(cam.h)}`, beat: i, u};
}
