// Graph mode rendering: grid, curves, special points, and the tracer's cards.
// The point's coordinates are laid out in square cards, one grid unit each and drawn
// like the tray cards, side by side: a column of y cards stands on the x axis up to the
// point and a row of x cards runs from the y axis out to it. Each sits just outside the
// point, so the two meet at its corner without overlapping. Cards are cut exactly at
// fractional values, blue when positive and red when negative, and every ten are
// outlined as a group. The area module deposits columns of card strips.
import { show, curveText } from './polynomial.js';
import { numeric } from '../engine.js';
import { ink, patternDefs } from '../mvc/theme.js';

// Curve colours follow the style (theme.js updates this array in place).
export const COLORS = ink.curves;
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
// Frame the interesting points (roots, vertices, crossings) with the origin, sampling
// curves only between them so a parabola's steep arms do not shrink the picture.
export function fitView(v, groups, curves) {
  const xs = groups.map(g => g.x);
  let x0 = Math.min(0, ...xs), x1 = Math.max(0, ...xs);
  if (x1 - x0 < 4) { const c = (x0 + x1) / 2; x0 = c - 2; x1 = c + 2; }
  const ys = [0, ...groups.map(g => g.y)];
  for (const c of curves) if (c.kind === 'function') for (let k = 0; k <= 40; k++) { const y = fx(c, x0 + (x1 - x0) * k / 40); if (Number.isFinite(y)) ys.push(y); }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const xpad = Math.max(1, (x1 - x0) * .25), ypad = Math.max(1, (y1 - y0) * .15);
  x0 -= xpad; x1 += xpad; y0 -= ypad; y1 += ypad;
  v.unit = Math.max(3, Math.min(90, Math.min(v.width / (x1 - x0), v.height / (y1 - y0))));
  v.cx = (x0 + x1) / 2; v.cy = (y0 + y1) / 2;
}
// Where the point starts on a curve: on screen, where it can be grabbed, and clear of the
// interesting points (at least ¾ of a card and 16 px), so finding them is the learner's
// move. A whole number near the middle; when the interesting points crowd those, the
// clearest on-screen whole number or half, whole numbers and the middle first.
export function startX(v, curve, groups, margin = 24) {
  const base = Math.round(v.cx), room = Math.max(.75, 16 / v.unit);
  const gap = x => Math.min(...groups.map(g => Math.abs(g.x - x))), clear = x => Math.min(room, gap(x));
  const onScreen = x => { const X = toX(v, x), Y = toY(v, fx(curve, x)); return X >= margin && X <= v.width - margin && Y >= margin && Y <= v.height - margin; };
  const near = [0, 1, -1, 2, -2, 3, -3, 4].map(d => base + d).find(x => gap(x) > room && onScreen(x));
  if (near !== undefined) return near;
  const halves = [];
  for (let k = Math.ceil(fromX(v, margin) * 2); k / 2 <= fromX(v, v.width - margin); k++) if (onScreen(k / 2)) halves.push(k / 2);
  return halves.sort((a, b) => clear(b) - clear(a) || Number.isInteger(b) - Number.isInteger(a) || Math.abs(a - base) - Math.abs(b - base))[0] ?? base;
}

export function textureDefs() {
  return patternDefs('g-');
}
// Square cards one grid unit wide, tiled from (x, y): a face like a tray card with a
// thin gap between neighbours; too small to read, they become a plain fill.
function squareCards(id, color, x, y, u, along) {
  const gap = Math.min(3, Math.max(.6, u * .05)), framed = u >= 7, round = Math.min(8, u * 5 / 43), border = Math.min(1.6, Math.max(.7, u / 43));
  let svg = `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${r(x)}" y="${r(y)}" width="${r(u)}" height="${r(u)}">${framed ? `<rect x="${r(gap / 2)}" y="${r(gap / 2)}" width="${r(u - gap)}" height="${r(u - gap)}" rx="${r(round)}" fill="url(#g-${color})" stroke="${ink.stroke[color]}" stroke-width="${r(border)}"/>` : `<rect width="${r(u)}" height="${r(u)}" fill="url(#g-${color})"/>`}</pattern>`;
  if (u * 10 >= 24) {
    const [gw, gh] = along === 'y' ? [u, u * 10] : [u * 10, u];
    svg += `<pattern id="${id}-ten" patternUnits="userSpaceOnUse" x="${r(x)}" y="${r(y)}" width="${r(gw)}" height="${r(gh)}"><rect x=".8" y=".8" width="${r(gw - 1.6)}" height="${r(gh - 1.6)}" rx="${r(round + 1)}" fill="none" stroke="${ink.tenOutline}" stroke-width="2.4"/></pattern>`;
  }
  return svg;
}
// Which side of the point's line the cards lie on, eased across an axis so they slide
// rather than jump: +1 fully on the positive side, −1 on the negative side.
export const cardSide = (distance, unit) => Math.max(-1, Math.min(1, distance / unit));
// A tiled fill of cards: tile w×h anchored at (x, y); every ten cards along `along` get a group outline.
function cardPattern(id, color, x, y, w, h, along) {
  const border = Math.min(w, h) >= 6, round = Math.min(4, Math.min(w, h) / 5);
  let svg = `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"><rect x="${border ? .75 : 0}" y="${border ? .75 : 0}" width="${r(Math.max(.5, w - (border ? 1.5 : 0)))}" height="${r(Math.max(.5, h - (border ? 1.5 : 0)))}" rx="${r(round)}" fill="url(#g-${color})"${border ? ` stroke="${ink.stroke[color]}" stroke-width="1"` : ''}/></pattern>`;
  if (along && (along === 'y' ? h : w) * 10 >= 24) {
    const [gw, gh] = along === 'y' ? [w, h * 10] : [w * 10, h];
    svg += `<pattern id="${id}-ten" patternUnits="userSpaceOnUse" x="${r(x)}" y="${r(y)}" width="${r(gw)}" height="${r(gh)}"><rect x="1" y="1" width="${r(gw - 2)}" height="${r(gh - 2)}" rx="${r(round + 1)}" fill="none" stroke="${ink.tenOutline}" stroke-width="2.4"/></pattern>`;
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
  let defs = '', svg = '', area = '', cards = '';
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
    const X = toX(v, t.x), Y = toY(v, t.y), u = v.unit;
    const colColor = t.y < 0 ? 'red' : 'blue', rowColor = t.x < 0 ? 'red' : 'blue';
    // The y column hugs the point's vertical line on the side away from the y axis; the x
    // row hugs its horizontal line on the side away from the x axis.
    const s = cardSide(X - X0, u), q = cardSide(Y0 - Y, u);
    const colLeft = X - u * (1 - s) / 2, rowTop = Y - u * (1 + q) / 2;
    const height = Math.abs(Y - Y0), width = Math.abs(X - X0);
    defs += squareCards('g-column', colColor, colLeft, Y0, u, 'y') + squareCards('g-row', rowColor, X0, rowTop, u, 'x');
    const tens = id => defs.includes(`id="${id}-ten"`);
    // On an axis one set of cards is gone; the axis lights up with the zero it stands for.
    if (t.axis) {
      const onX = t.axis === 'x' || t.axis === 'origin', onY = t.axis === 'y' || t.axis === 'origin';
      cards += `<g class="axis-hit">${onX ? `<path d="M0 ${r(Y0)}H${v.width}"/><text x="12" y="${r(Y0 < v.height - 44 ? Y0 + 38 : Y0 - 12)}">y = 0 on the x axis</text>` : ''}${onY ? `<path d="M${r(X0)} 0V${v.height}"/><text x="${r(X0 + 10)}" y="${r(v.height - 14)}">x = 0 on the y axis</text>` : ''}</g>`;
    }
    if (height > .5) cards += `<g class="card-column" data-cards="${esc(t.label?.y ?? show(t.y))}"><rect x="${r(colLeft)}" y="${r(Math.min(Y, Y0))}" width="${r(u)}" height="${r(height)}" fill="url(#g-column)"/>${tens('g-column') ? `<rect x="${r(colLeft)}" y="${r(Math.min(Y, Y0))}" width="${r(u)}" height="${r(height)}" fill="url(#g-column-ten)"/>` : ''}</g>`;
    if (width > .5) cards += `<g class="card-row" data-cards="${esc(t.label?.x ?? show(t.x))}"><rect x="${r(Math.min(X, X0))}" y="${r(rowTop)}" width="${r(width)}" height="${r(u)}" fill="url(#g-row)"/>${tens('g-row') ? `<rect x="${r(Math.min(X, X0))}" y="${r(rowTop)}" width="${r(width)}" height="${r(u)}" fill="url(#g-row-ten)"/>` : ''}</g>`;
    const xText = t.label?.x ?? show(t.x), yText = t.label?.y ?? show(t.y);
    const colOut = s >= 0 ? colLeft + u + 8 : colLeft - 8, rowOut = q >= 0 ? rowTop - 8 : rowTop + u + 18;
    svg += `<g class="stack-label">${height > .5 ? `<text x="${r(colOut)}" y="${r((Y + Y0) / 2 + 5)}" text-anchor="${s >= 0 ? 'start' : 'end'}">y = ${esc(yText)}</text>` : ''}${width > .5 ? `<text x="${r((X + X0) / 2)}" y="${r(rowOut)}" text-anchor="middle">x = ${esc(xText)}</text>` : ''}</g>`;
    if (t.axis) svg += `<circle class="collision" cx="${r(X)}" cy="${r(Y)}" r="12"/>`;
    svg += `<g class="tracer${t.snapped ? ' snapped' : ''}${t.active ? ' active' : ''}"><circle cx="${r(X)}" cy="${r(Y)}" r="${t.active ? 13 : 10}"/><circle cx="${r(X)}" cy="${r(Y)}" r="3.5" class="tracer-dot"/></g>`;
    // The snap label goes in the corner the cards leave free: beyond the column, past the row.
    if (t.snapped) svg += `<text class="snap-label" x="${r(X + (s >= 0 ? 16 : -16))}" y="${r(Y + (q >= 0 ? -18 : 28))}" text-anchor="${s >= 0 ? 'start' : 'end'}">${esc(t.snapped)}</text>`;
  }
  // Cards lie under the curves, so a curve stays visible across them; the point and the
  // labels stay on top.
  return { defs, area, cards, tracer: svg };
}
export const legend = curves => curves.map((c, i) => ({ color: COLORS[i], text: curveText(c) }));
