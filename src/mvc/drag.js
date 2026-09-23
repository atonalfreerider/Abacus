// Pointer dragging with physics (physics.js). Each frame writes transforms straight
// onto the rendered SVG nodes; the scene is re-rendered only when the held card
// flips sign, and the model changes only when a card is released.
import { DragBody } from './physics.js';
const NS = 'http://www.w3.org/2000/svg';
const haptic = ms => { try { navigator.vibrate?.(ms); } catch {} };
const r = n => Math.round(n * 100) / 100;

export class Dragger {
  constructor(stage, controller, { onTap, onCommit, onChange = () => {} }) {
    Object.assign(this, { stage, controller, onTap, onCommit, onChange });
    this.body = null; this.pending = null; this.settling = null;
  }
  get active() { return !!(this.body || this.pending || this.settling); }
  point(event) {
    const svg = this.stage.querySelector('#equation-svg'), p = svg.createSVGPoint();
    p.x = event.clientX; p.y = event.clientY; return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  down(event) {
    const node = event.target.closest('[data-term]');
    if (!node || node.classList.contains('placeholder') || this.controller.busy || event.button > 0 || this.body || this.pending) return false;
    event.preventDefault();
    if (this.settling) this.finishSettling();
    this.pending = { id: node.dataset.term, start: this.point(event), pointerId: event.pointerId };
    this.pointer = this.pending.start; this.pointerId = event.pointerId;
    this.stage.setPointerCapture(event.pointerId);
    return true;
  }
  // Only the pointer that picked the card up steers it (a second finger is ignored).
  move(event) {
    if (!this.pending && !this.body || event.pointerId !== this.pointerId) return;
    this.pointer = this.point(event);
    if (!this.body && Math.hypot(this.pointer.x - this.pending.start.x, this.pointer.y - this.pending.start.y) > 6) this.begin();
  }
  begin() {
    const { model, options } = this.controller;
    this.body = new DragBody(model.state, { ...options, expression: model.expression }, this.pending.id, this.pending.start);
    this.last = performance.now(); this.install(); this.onChange();
  }
  // Called after every full render: cache nodes and recreate the drag overlays.
  install() {
    const body = this.body || this.settling, svg = this.svg = this.stage.querySelector('#equation-svg');
    svg.classList.add('drag-active');
    this.nodes = new Map([...svg.querySelectorAll('[data-term]')].map(n => [n.dataset.term, n]));
    this.node = this.nodes.get(body.id); this.node.classList.add('dragging'); this.node.parentNode.append(this.node);
    for (const cand of body.world.values()) if (!body.term.expr && !cand.slot.term.expr && cand.slot.term.kind === body.term.kind && !cand.slot.term.placeholder) this.nodes.get(cand.slot.term.id)?.classList.add('candidate');
    this.mirror = svg.querySelector('.equals-mirror');
    if (this.mirror && body.equal) {
      const { x, y } = body.base.equal, bars = document.createElementNS(NS, 'g');
      bars.setAttribute('class', 'balance-bars');
      bars.innerHTML = `<path d="M${x - 23} ${y - 4}h46"/><path d="M${x - 23} ${y + 13}h46"/>`;
      this.mirror.append(bars); this.bars = [...bars.children]; this.dots = this.mirror.querySelector('path');
    }
    this.ghost = document.createElementNS(NS, 'rect');
    this.ghost.setAttribute('class', 'landing-ghost'); this.ghost.setAttribute('rx', '16');
    svg.querySelector('.scene-root').prepend(this.ghost);
  }
  frame(now) {
    const body = this.body || this.settling;
    if (!body) return;
    const dt = Math.min(.05, Math.max(.001, (now - this.last) / 1000)); this.last = now;
    if (this.settling) { if (this.settling.settle(dt)) return this.finishSettling(); }
    else {
      body.update(this.pointer, dt);
      for (const event of body.events.splice(0)) {
        if (event === 'cross') { haptic(15); this.controller.previewDrag(body.id, body.pos.x, body.pos.y, body.side); this.install(); this.onChange(); }
        if (event === 'snap') haptic(8);
      }
    }
    this.paint(body);
  }
  paint(body) {
    this.node.setAttribute('transform', `translate(${r(body.pos.x)} ${r(body.pos.y)})`);
    for (const [id, w] of body.world) {
      const node = this.nodes.get(id); if (!node) continue;
      node.setAttribute('transform', `translate(${r(w.x)} ${r(w.y)})`);
      node.classList.toggle('snap-cancel', body.snap?.id === id && body.snap.kind === 'cancel');
      node.classList.toggle('snap-combine', body.snap?.id === id && body.snap.kind === 'combine');
    }
    if (this.mirror && body.equal) {
      const base = body.base.equal, dx = body.equal.x - base.x, dy = body.equal.y - base.y, { x, y } = base;
      this.mirror.setAttribute('transform', `translate(${r(dx)} ${r(dy)})`);
      // The mirror bows away from the push, like a membrane under a finger.
      const bend = body.strain * 30 * (body.side === 'left' ? 1 : -1);
      this.dots.setAttribute('d', body.base.orientation === 'horizontal'
        ? `M${x} ${y - 105}q${r(bend)} 32 0 65 M${x} ${y + 55}q${r(bend)} 32 0 65`
        : `M${x - 140} ${y}q45 ${r(bend)} 90 0 M${x + 50} ${y}q45 ${r(bend)} 90 0`);
      const angle = body.tilt * 16;
      this.bars[0].setAttribute('transform', `rotate(${r(-angle)} ${x} ${y - 4})`);
      this.bars[1].setAttribute('transform', `rotate(${r(angle)} ${x} ${y + 13})`);
    }
    const landing = body.landing && (body.crossed || body.insert !== body.slot.index) && !this.settling;
    this.ghost.setAttribute('opacity', landing ? '1' : '0');
    if (landing) { this.ghost.setAttribute('x', r(landing.x - 10)); this.ghost.setAttribute('y', r(landing.y - 10)); this.ghost.setAttribute('width', r(landing.w + 20)); this.ghost.setAttribute('height', '170'); }
  }
  up(event) {
    if (event.pointerId !== this.pointerId) return;
    try { this.stage.releasePointerCapture(event.pointerId); } catch {}
    if (this.pending && !this.body) { const id = this.pending.id; this.pending = null; this.onTap(id); return; }
    const body = this.body; this.pending = null;
    if (!body) return;
    this.body = null;
    let drop = body.drop();
    // Shift on release places the card beside its magnet partner instead of combining.
    if (drop?.target && event.shiftKey) drop = { side: drop.side, target: null, index: body.insert };
    if (drop) {
      // The release animation starts from where everything is now, not from the old layout.
      const positions = Object.fromEntries([...body.world].map(([id, w]) => [id, { x: w.x, y: w.y }]));
      this.svg.classList.remove('drag-active');
      this.onCommit(body.id, drop, { x: body.pos.x, y: body.pos.y, positions, equal: body.equal && { x: body.equal.x, y: body.equal.y } });
    } else {
      this.settling = body;
      if (body.crossed) { this.controller.previewDrag(body.id, body.pos.x, body.pos.y, body.home); this.install(); }
    }
    this.onChange();
  }
  cancel(event) { if (event && event.pointerId !== this.pointerId) return; if (this.body) { this.settling = this.body; this.body = null; } this.pending = null; }
  finishSettling() { this.settling = null; delete this.controller.options.drag; this.controller.render(); this.onChange(); }
}
