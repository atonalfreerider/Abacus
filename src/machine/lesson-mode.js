// The Machine's lesson mode (design 5.4): the lesson bar over the machine's own, and the flow
// of a lesson (lessons.js) through the machine. Watch the example, then Predict on a fresh
// problem (the machine stops before chosen beats to ask), then Your turn: build the machine for
// a fresh problem and predict again. The machine's own controls drive every run; this module,
// lessons.js and lessons.css load with the first lesson, so neither app start nor opening the
// mode pays for them. machine-app.js calls in at six places: planned, frame, done, enter, a
// tap on the stage and a key on it.
import { haptic } from '../haptics.js';
import { snapshotAt } from './scene.js';
import * as kit from './lessons.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const touchFirst = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const BASE_NAME = { binary: 'binary', ternary: 'balanced ternary', e: 'base e' };
const BAR = '<section id="machine-lesson" hidden aria-label="Machine lesson"><div class="tutor-head"><span id="mlesson-phase">Watch</span><strong id="mlesson-title"></strong></div><p id="mlesson-prompt" role="status" aria-live="polite"></p><div id="mlesson-choices" role="group" aria-label="Your prediction" hidden></div><div class="tutor-actions"><button type="button" id="mlesson-predict" class="primary">Predict</button><button type="button" id="mlesson-turn">Your turn</button><button type="button" id="mlesson-hint">Hint</button><button type="button" id="mlesson-show">Show me</button><button type="button" id="mlesson-new">New problem</button><button type="button" id="mlesson-next">Next lesson</button><button type="button" id="mlesson-close" aria-label="Leave lesson">×</button></div></section>';

export class LessonMode {
  // The stylesheet, then the bar, once per page.
  static async create(view) {
    const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('./lessons.css', import.meta.url).href;
    await new Promise(done => { sheet.onload = sheet.onerror = done; document.head.append(sheet); });
    view.mode.insertAdjacentHTML('afterbegin', BAR);
    return new LessonMode(view);
  }
  constructor(view) { this.view = view; this.tutor = null; this.question = null; this.pauses = []; this.wire(); }

  async start(lesson, { seed } = {}) {
    if (!lesson) return { ok: false };
    const v = this.view;
    if (!this.tutor) this.before = { pace: v.pace, auto: v.auto };
    this.tutor = new kit.MachineTutor(lesson, seed ?? Date.now()); this.question = null;
    v.mode.classList.add('lesson'); $('machine-lesson').hidden = false; $('mlesson-title').textContent = lesson.title;
    await this.load(this.tutor.problem);
    this.say(`${lesson.intro} ${touchFirst() ? 'Tap Run' : 'Press Enter'} to watch ${this.tutor.problem.text}; Step plays one beat at a time.`);
    this.refresh();
    return { ok: true };
  }
  // Leaving gives back the carries and AUTO the learner had.
  end() {
    if (!this.tutor) return;
    const v = this.view, was = this.before;
    this.tutor = null; this.question = null; this.pauses = []; if (v.clock) v.clock.holds = new Set();
    v.mode.classList.remove('lesson'); $('machine-lesson').hidden = true; $('mlesson-choices').hidden = true;
    if (was) { v.setAuto(was.auto, { remember: false }); if (was.pace !== v.pace) v.setPace(was.pace); }
  }
  // A problem built and typed in, ready to run (or, for Your turn, an empty machine in its base).
  async load(problem, { build = true } = {}) {
    const v = this.view; v.ask(false);
    if (build) await v.load({ tree: problem.tree, base: problem.base, input: `[${problem.inputs.join(',')}]`, pace: problem.pace, auto: true });
    else { v.$input.value = ''; v.$expr.value = ''; await v.load({ tree: {}, base: problem.base, pace: problem.pace, auto: true }); v.status(''); }
  }

  // ---------- the machine's calls ----------
  // A plan was just made: its stops (none while watching, and none for a machine that does not
  // work out the problem in play), each a hold on the clock.
  planned() {
    const v = this.view, L = this.tutor; this.question = null; this.pauses = [];
    if (!L || !v.clock) return;
    $('mlesson-choices').hidden = true;
    if (L.phase !== 'watch' && !v.planned.display && (L.phase !== 'turn' || kit.matches(L.problem, v.tree, v.inputs))) this.pauses = kit.pausesOf(L.lesson, v.planned).map(q => ({ ...q, done: false }));
    v.clock.holds = new Set(this.pauses.map(q => q.i));
    this.refresh();
  }
  // Each frame: at rest on a stop, ask.
  frame(t) {
    const c = this.view.clock;
    if (!this.pauses.length || !c.started || c.run || c.wait || Math.abs(t - Math.round(t)) > 1e-9) return;
    const q = this.pauses.find(p => p.i === Math.round(t) && !p.done); if (q && q !== this.question) this.ask(q);
  }
  // On the stage, digit keys pick a choice (the first nine).
  key(k) { const i = /^[1-9]$/.test(k) ? Number(k) - 1 : -1, c = this.question?.choices[i]; if (!c) return false; this.answer(c.value); return true; }
  // Enter and Step wait for an answer (or Show me) before the beat plays.
  waiting() { if (!this.question) return false; this.say(`${this.question.question} Answer it, or press Show me.`, 'hint'); return true; }
  // A tap on the stage answers a level question: the level of the asked tower under the finger.
  tap(x, y) {
    const v = this.view, q = this.question, at = v.toMachine?.(x, y); if (!q?.tap || !at) return false;
    const tower = snapshotAt(v.planned, Math.round(v.clock.pos)).towers[q.tap.tower]; if (!tower) return false;
    let p; try { p = v.layout.place(tower.at); } catch { return false; }
    const level = Math.round((p.y - at.y) / 84);
    if (Math.abs(at.x - p.x) > 220 || !q.choices.some(c => c.value === level)) return false;
    this.answer(level); return true;
  }
  // The run reached Output.
  done() {
    const v = this.view, L = this.tutor; if (!L) return;
    const result = v.planned.result?.text ?? '', score = L.asked ? ` You predicted ${L.right} of ${L.asked}.` : '';
    this.lastFeedback = null;
    if (L.phase === 'watch') { L.watched = true; this.say(`Output ${result}. That was the worked example. Now press Predict: a new problem plays, and the machine stops to ask what will happen next.`, 'done'); }
    else if (L.phase === 'predict') { L.predicted = true; this.say(`Output ${result}.${score} Your turn: build one yourself.`, 'done'); }
    else if (kit.matches(L.problem, v.tree, v.inputs)) { const r = v.planned.result; L.solved = true; this.say(`Well done: ${L.problem.text}${r.label ? `: ${r.label}` : ` = ${r.text.replace(/^\[|\]$/g, '')}`}.${score} New problem for another, or Next lesson.`, 'done'); }
    else this.say(`That machine gave ${result}, but the problem is ${L.problem.text}. ${this.hint()}`, 'detour');
    this.refresh();
  }

  // ---------- questions ----------
  say(text, tone = '') { const el = $('mlesson-prompt'); el.textContent = text; el.dataset.tone = tone; }
  ask(q) {
    this.question = q;
    const box = $('mlesson-choices'); box.hidden = false;
    box.innerHTML = q.choices.map((c, i) => `<button type="button" data-value="${esc(c.value)}"${i < 9 ? ` aria-keyshortcuts="${i + 1}" title="Key ${i + 1}"` : ''}>${esc(c.label)}</button>`).join('');
    // the last answer's feedback stays in view while the next question is asked straight after it
    const said = this.lastFeedback && performance.now() - this.lastFeedback.at < 8000 ? `${this.lastFeedback.text} Next: ` : '';
    this.lastFeedback = null; this.say(said + q.question); this.refresh(); haptic('peek');
  }
  // An answer (a choice, or a level tapped on the stage): say why, then play the beat.
  answer(value, { shown = false } = {}) {
    const v = this.view, q = this.question, L = this.tutor; if (!q || !L) return false;
    const ok = shown ? null : L.answer(q, value);
    q.done = true; this.question = null; v.clock.holds.delete(q.i); $('mlesson-choices').hidden = true;
    const text = shown ? `Here it is: ${q.explain}` : `${ok ? 'Right.' : 'Not quite.'} ${q.explain}`;
    this.say(text, shown ? 'hint' : ok ? 'good' : 'detour'); this.lastFeedback = { text, at: performance.now() };
    if (ok === true) haptic('success'); else if (ok === false) haptic('thud');
    const now = performance.now(); v.clock.step(now); v.manual = null; v.sync(v.clock.t(now));
    this.refresh(); return ok;
  }
  hint() {
    const v = this.view, p = this.tutor.problem, nodes = Object.values(v.tree);
    if (nodes.length !== 1 || nodes[0].op !== p.op) return `Hang a ${p.block} block under the triangle: tap the triangle's socket, then ${p.block.split(' ')[0]} in the palette${nodes.length ? ' (take the other blocks off first)' : ''}.`;
    if (!kit.matches(p, v.tree, v.inputs)) return `Type [${p.inputs.join(',')}] in Input, then ${touchFirst() ? 'tap Run' : 'press Enter'}.`;
    return `${touchFirst() ? 'Tap Run' : 'Press Enter'} to work it out.`;
  }

  // ---------- phases and the bar ----------
  async predict() { const L = this.tutor; if (!L) return; const p = L.predict(); await this.load(p); this.say(`Predict: ${p.text} in ${BASE_NAME[p.base]}. The machine stops before key beats to ask what will happen; tap a level or a choice.`); this.refresh(); this.view.enter(); }
  async turn() { const L = this.tutor; if (!L) return; const p = L.turn(); await this.load(p, { build: false }); this.say(`Your turn: work out ${p.text} in ${BASE_NAME[p.base]}. ${this.hint()} The machine will stop to ask, as before.`); this.refresh(); }
  refresh() {
    const L = this.tutor; if (!L) return;
    const phase = L.phase, chip = $('mlesson-phase');
    chip.textContent = { watch: 'Watch', predict: 'Predict', turn: 'Your turn' }[phase]; chip.dataset.phase = phase;
    // Only what this moment needs, so a phone's bar keeps to two rows: while a question waits,
    // Hint and Show me; between runs, the way on.
    const q = !!this.question, working = phase === 'turn' && !L.solved;
    const show = { 'mlesson-predict': phase === 'watch', 'mlesson-turn': phase === 'predict' && !q, 'mlesson-hint': q || working, 'mlesson-show': q || working,
      'mlesson-new': !q && phase !== 'watch', 'mlesson-next': !q && phase === 'turn' && !!L.solved };
    for (const [id, on] of Object.entries(show)) $(id).hidden = !on;
    $('mlesson-predict').classList.toggle('ready', !!L.watched); $('mlesson-turn').classList.toggle('ready', !!L.predicted);
    $('mlesson-turn').classList.toggle('primary', !!L.predicted);
  }
  wire() {
    const v = this.view;
    $('mlesson-predict').onclick = () => this.predict();
    $('mlesson-turn').onclick = () => this.turn();
    $('mlesson-new').onclick = () => this.tutor?.phase === 'turn' ? this.turn() : this.predict();
    $('mlesson-next').onclick = () => { const all = kit.lessons, i = all.indexOf(this.tutor?.lesson); this.start(all[(i + 1) % all.length]); };
    $('mlesson-close').onclick = () => { this.end(); v.stage.focus({ preventScroll: true }); };
    $('mlesson-hint').onclick = () => { const L = this.tutor; if (!L) return; L.hints++; this.say(`Hint: ${this.question ? this.question.hint ?? this.question.question : L.phase === 'turn' && !L.solved ? this.hint() : 'New problem gives you another.'}`, 'hint'); };
    $('mlesson-show').onclick = async () => {
      if (this.question) return this.answer(null, { shown: true });
      const L = this.tutor; if (!L || L.phase !== 'turn') return;
      await this.load(L.problem); this.say(`Watch: a ${L.problem.block} block, and [${L.problem.inputs.join(',')}] in Input.`, 'hint'); v.enter();
    };
    $('mlesson-choices').onclick = e => { const b = e.target.closest('button[data-value]'); if (!b || !this.question) return; const value = this.question.choices.find(c => String(c.value) === b.dataset.value)?.value; this.answer(value ?? b.dataset.value); };
  }
  // For the automation hook: the lesson in play, its phase, the question waiting and the stops.
  state() {
    const L = this.tutor; if (!L) return null;
    return { id: L.lesson.id, phase: L.phase, problem: L.problem.text, right: L.right, asked: L.asked,
      question: this.question && { i: this.question.i, question: this.question.question, choices: this.question.choices.map(c => c.value), answer: this.question.answer },
      stops: this.pauses.map(q => ({ i: q.i, kind: q.kind, done: q.done })), prompt: $('mlesson-prompt').textContent };
  }
}
