// Graph mode rendering: grid, curves, special points, and the tracer's two card stacks.
// A column of cards stands on the x axis up to the traced point (y cards) and a row
// of cards runs from the y axis out to it (x cards). Cards are one unit long, cut off
// exactly at fractional values, blue when positive and red when negative, with every
// ten cards outlined as a group. The area module deposits columns of card strips.
import { show, curveText } from './polynomial.js';
import { numeric } from '../engine.js';

export const COLORS = ['#2f5d6b', '#9a5b10', '#6b3f8a'];
const r = n => Math.round(n * 100) / 100;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const toX = (v, x) => v.width / 2 + (x - v.cx) * v.unit;
export const toY = (v, y) => v.height / 2 - (y - v.cy) * v.unit;
export const fromX = (v, X) => v.cx + (X - v.width / 2) / v.unit;
export const fromY = (v, Y) => v.cy - (Y - v.height / 2) / v.unit;
export function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
// Snapping steps the tracer can land on: friendly fractions of a card.
export function snapStep(unit) { for (const s of [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100]) if (s * unit >= 9) return s; return 100; }
export const fx = (curve, x) => curve.poly.reduceRight((a, c) => a * x + numeric(c), 0);

export function textureDefs() {
  return [['blue', 25], ['red', 23], ['paper', 24]].map(([name, id]) => `<pattern id="g-${name}" width="150" height="150" patternUnits="userSpaceOnUse"><image href="./textures/swf-${id}.jpg" width="150" height="150"/></pattern>`).join('');
}
// A tiled fill of cards: tile w×h anchored at (x, y); every ten cards along `along` get a group outline.
function cardPattern(id, color, x, y, w, h, along) {
  const border = Math.min(w, h) >= 6, round = Math.min(4, Math.min(w, h) / 5);
  let svg = `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"><rect x="${border ? .75 : 0}" y="${border ? .75 : 0}" width="${r(Math.max(.5, w - (border ? 1.5 : 0)))}" height="${r(Math.max(.5, h - (border ? 1.5 : 0)))}" rx="${r(round)}" fill="url(#g-${color})"${border ? ' stroke="#191a16" stroke-width="1"' : ''}/></pattern>`;
  if (along && (along === 'y' ? h : w) * 10 >= 24) {
    const [gw, gh] = along === 'y' ? [w, h * 10] : [w * 10, h];
    svg += `<pattern id="${id}-ten" patternUnits="userSpaceOnUse" x="${r(x)}" y="${r(y)}" width="${r(gw)}" height="${r(gh)}"><rect x="1" y="1" width="${r(gw - 2)}" height="${r(gh - 2)}" rx="${r(round + 1)}" fill="none" stroke="#10170f" stroke-width="2.4"/></pattern>`;
  }
  return svg;
}

export function renderStatic(state) {
  const v = state.view, { width, height } = v;
  const step = niceStep(64 / v.unit), X0 = toX(v, 0), Y0 = toY(v, 0);
  let grid = '', labels = '';
  const xmin = fromX(v, 0), xmax = fromX(v, width), ymin = fromY(v, height), ymax = fromY(v, 0);
  const labelY = Math.min(height - 8, Math.max(16, Y0 + 18)), labelX = Math.min(width - 6, Math.max(30, X0 - 8));
  for (let k = Math.ceil(xmin / step); k * step <= xmax; k++) {
    const x = k * step, X = toX(v, x);
    grid += `<path d="M${r(X)} 0V${height}"/>`;
    if (k) labels += `<text x="${r(X)}" y="${r(labelY)}" text-anchor="middle">${show(Math.round(x * 1e6) / 1e6)}</text>`;
  }
  for (let k = Math.ceil(ymin / step); k * step <= ymax; k++) {
    const y = k * step, Y = toY(v, y);
    grid += `<path d="M0 ${r(Y)}H${width}"/>`;
    if (k) labels += `<text x="${r(labelX)}" y="${r(Y + 5)}" text-anchor="end">${show(Math.round(y * 1e6) / 1e6)}</text>`;
  }
  let back = `<g class="graph-grid">${grid}</g>`;
  back += `<g class="graph-axes"><path d="M0 ${r(Y0)}H${width}M${r(X0)} 0V${height}"/><text x="${width - 10}" y="${r(Y0 - 10)}" text-anchor="end" class="axis-name">x</text><text x="${r(X0 + 12)}" y="18" class="axis-name">y</text></g>`;
  back += `<g class="graph-labels">${labels}<text x="${r(X0 - 8)}" y="${r(Y0 + 18)}" text-anchor="end">0</text></g>`;
  let svg = '';
  state.curves.forEach((c, i) => {
    let d = '';
    if (c.kind === 'vertical') { const X = toX(v, numeric(c.x)); d = `M${r(X)} 0V${height}`; }
    else for (let X = -8; X <= width + 8; X += 2) { const Y = Math.max(-3 * height, Math.min(4 * height, toY(v, fx(c, fromX(v, X))))); d += `${d ? 'L' : 'M'}${r(X)} ${r(Y)}`; }
    svg += `<path class="graph-curve" data-curve="${i}" d="${d}" stroke="${COLORS[i]}"/>`;
  });
  // Special points; coincident ones share a marker and a combined label.
  for (const group of groupSpecials(state.specials)) {
    const X = toX(v, group.x), Y = toY(v, group.y);
    if (X < -20 || X > width + 20 || Y < -20 || Y > height + 20) continue;
    const solution = group.kinds.includes('solution');
    svg += `<g class="special${solution ? ' solution' : ''}" data-x="${group.x}" data-y="${group.y}"><circle cx="${r(X)}" cy="${r(Y)}" r="${solution ? 8 : 5}"/></g>`;
  }
  return { back, front: svg };
}
export function groupSpecials(specials) {
  const groups = [];
  for (const p of specials) {
    const g = groups.find(g => Math.abs(g.x - p.x) < 1e-9 && Math.abs(g.y - p.y) < 1e-9);
    if (g) { if (!g.kinds.includes(p.kind)) g.kinds.push(p.kind); g.curves = [...new Set([...g.curves, ...p.curves])]; g.exact ||= p.exact; }
    else groups.push({ x: p.x, y: p.y, exact: p.exact, kinds: [p.kind], curves: [...p.curves] });
  }
  return groups;
}

// The tracer, its card stacks and the area columns change every frame.
export function renderDynamic(state) {
  const v = state.view, X0 = toX(v, 0), Y0 = toY(v, 0);
  let defs = '', svg = '', area = '';
  const sweep = state.area;
  if (sweep?.columns?.length) {
    const w = numeric(sweep.dx) * v.unit, ax = toX(v, numeric(sweep.a));
    defs += cardPattern('g-strip-blue', 'blue', ax, Y0, w, v.unit) + cardPattern('g-strip-red', 'red', ax, Y0, w, v.unit);
    sweep.columns.forEach((col, k) => {
      const grow = k < sweep.shown ? 1 : k === sweep.shown ? sweep.grow : 0;
      if (!grow || !col.h) return;
      const x = toX(v, numeric(col.left)), Y = toY(v, col.h * grow);
      const moving = sweep.gather?.[k];
      // Once a column has gathered, its outline stays behind as a ghost.
      if (moving) { area += `<rect class="area-ghost" x="${r(x)}" y="${r(Math.min(Y, Y0))}" width="${r(w)}" height="${r(Math.abs(Y - Y0))}"/>`; if (moving.opacity) area += `<rect class="area-moving" x="${r(moving.x)}" y="${r(moving.y)}" width="${r(moving.w)}" height="${r(moving.h)}" fill="url(#g-${col.h < 0 ? 'red' : 'blue'})" stroke="#191a16" stroke-width=".8" opacity="${r(moving.opacity)}"/>`; return; }
      area += `<rect class="area-column" x="${r(x)}" y="${r(Math.min(Y, Y0))}" width="${r(w)}" height="${r(Math.abs(Y - Y0))}" fill="url(#g-strip-${col.h < 0 ? 'red' : 'blue'})"/>`;
      if (k < sweep.shown) area += `<circle class="area-sample" cx="${r(toX(v, numeric(col.sample)))}" cy="${r(toY(v, col.h))}" r="3"/>`;
    });
    for (const tally of sweep.tallies || []) {
      if (tally.height <= 0) continue;
      const tx = toX(v, tally.x), top = tally.sign > 0 ? toY(v, tally.height) : Y0, bottom = tally.sign > 0 ? Y0 : toY(v, -tally.height);
      defs += cardPattern(`g-tally-${tally.sign > 0 ? 'blue' : 'red'}`, tally.sign > 0 ? 'blue' : 'red', tx, Y0, v.unit, v.unit, 'y');
      area += `<g class="area-tally"><rect x="${r(tx)}" y="${r(top)}" width="${r(v.unit)}" height="${r(bottom - top)}" fill="url(#g-tally-${tally.sign > 0 ? 'blue' : 'red'})"/>${defs.includes(`g-tally-${tally.sign > 0 ? 'blue' : 'red'}-ten`) ? `<rect x="${r(tx)}" y="${r(top)}" width="${r(v.unit)}" height="${r(bottom - top)}" fill="url(#g-tally-${tally.sign > 0 ? 'blue' : 'red'}-ten)"/>` : ''}</g>`;
    }
    if (sweep.net !== null && sweep.net !== undefined && sweep.tallies) {
      const tx = toX(v, sweep.tallies[0].x) + v.unit + 8, exact = sweep.exact ? numeric(sweep.exact) : null;
      area += `<text class="tally-label" x="${r(tx)}" y="${r(toY(v, sweep.net) + (sweep.net < 0 ? 16 : -6))}">strips: ${show(sweep.net)}</text>`;
      if (exact !== null) area += `<path class="exact-mark" d="M${r(toX(v, sweep.tallies[0].x) - 6)} ${r(toY(v, exact))}h${r(v.unit + 12)}"/><text class="tally-label exact" x="${r(tx)}" y="${r(toY(v, exact) + 5)}">exact ∫: ${show(sweep.exact).includes('/') ? '≈ ' + show(exact) : show(sweep.exact)}</text>`;
    }
    for (const handle of ['a', 'b']) {
      const X = toX(v, numeric(sweep[handle]));
      area += `<g class="area-handle" data-handle="${handle}"><path d="M${r(X)} ${r(Y0)}l-9 16h18z"/><text x="${r(X)}" y="${r(Y0 + 32)}" text-anchor="middle">${handle}</text></g>`;
    }
  }
  const t = state.tracer;
  if (t && Number.isFinite(t.y)) {
    const X = toX(v, t.x), Y = toY(v, t.y), u = v.unit, thick = Math.max(10, Math.min(36, u * .8));
    const colColor = t.y < 0 ? 'red' : 'blue', rowColor = t.x < 0 ? 'red' : 'blue';
    defs += cardPattern('g-column', colColor, X - thick / 2, Y0, thick, u, 'y') + cardPattern('g-row', rowColor, X0, Y - thick / 2, u, thick, 'x');
    const tens = id => defs.includes(`id="${id}-ten"`);
    if (Math.abs(Y - Y0) > .5) svg += `<g class="card-column"><rect x="${r(X - thick / 2)}" y="${r(Math.min(Y, Y0))}" width="${r(thick)}" height="${r(Math.abs(Y - Y0))}" fill="url(#g-column)"/>${tens('g-column') ? `<rect x="${r(X - thick / 2)}" y="${r(Math.min(Y, Y0))}" width="${r(thick)}" height="${r(Math.abs(Y - Y0))}" fill="url(#g-column-ten)"/>` : ''}</g>`;
    if (Math.abs(X - X0) > .5) svg += `<g class="card-row"><rect x="${r(Math.min(X, X0))}" y="${r(Y - thick / 2)}" width="${r(Math.abs(X - X0))}" height="${r(thick)}" fill="url(#g-row)"/>${tens('g-row') ? `<rect x="${r(Math.min(X, X0))}" y="${r(Y - thick / 2)}" width="${r(Math.abs(X - X0))}" height="${r(thick)}" fill="url(#g-row-ten)"/>` : ''}</g>`;
    const xText = t.label?.x ?? show(t.x), yText = t.label?.y ?? show(t.y);
    const up = t.y >= 0, right = t.x >= 0;
    svg += `<g class="stack-label"><text x="${r(X + (right ? 1 : -1) * (thick / 2 + 8))}" y="${r((Y + Y0) / 2 + 5)}" text-anchor="${right ? 'start' : 'end'}">y: ${esc(yText)}</text><text x="${r((X + X0) / 2)}" y="${r(Y + (up ? -1 : 1) * (thick / 2 + 8) + (up ? 0 : 12))}" text-anchor="middle">x: ${esc(xText)}</text></g>`;
    svg += `<g class="tracer${t.snapped ? ' snapped' : ''}${t.active ? ' active' : ''}"><circle cx="${r(X)}" cy="${r(Y)}" r="${t.active ? 13 : 10}"/><circle cx="${r(X)}" cy="${r(Y)}" r="3.5" class="tracer-dot"/></g>`;
    // The snap label goes in the quadrant away from both card stacks.
    if (t.snapped) svg += `<text class="snap-label" x="${r(X + (right ? 16 : -16))}" y="${r(Y + (up ? -18 : 28))}" text-anchor="${right ? 'start' : 'end'}">${esc(t.snapped)}</text>`;
  }
  return { defs, area, tracer: svg };
}
export const legend = curves => curves.map((c, i) => ({ color: COLORS[i], text: curveText(c) }));
