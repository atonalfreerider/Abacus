// The machine's beat clock. A plan is a list of beats; the clock maps wall time (ms, as
// performance.now() and requestAnimationFrame give it) to plan time t in beat units, the
// renderer's clock: t = i is the boundary after beat i − 1, and t ∈ (i, i + 1] is beat i.
// Every motion inside a beat is the renderer's business; the clock only decides which
// beat plays, how fast, and whether the next one follows on its own (AUTO, PRIME's
// default) or waits for Enter.
export const SPEEDS = [.25, .5, 1, 1.5, 2, 3];
// One beat lasts sp seconds; a level-pace carry beat (dur 0.5) lasts half of that.
export const beatSeconds = (beat, sp) => (beat.dur ?? 1) * sp;
// Read along: after each beat, time to read its caption at about 15 characters a second,
// less the time the beat itself took, capped so even a 110-character caption fits in 6 s.
export const readGap = (beat, sp) => Math.min(6, Math.max(0, .8 + beat.caption.length / 15 - beatSeconds(beat, sp)));
export function schedule(plan, sp, { readAlong = false } = {}) {
  const n = plan.beats.length, starts = new Float64Array(n), ends = new Float64Array(n);
  let at = 0;
  plan.beats.forEach((beat, i) => { starts[i] = at; at += beatSeconds(beat, sp); ends[i] = at; if (readAlong && i < n - 1) at += readGap(beat, sp); });
  return { starts, ends, total: n ? ends[n - 1] : 0 };
}

// The one Enter rule (design 4.2), shared by Enter in Input, Enter on the stage, Run and
// Step: start over when something changed since the plan was built, when no run has
// started, or when the run is over; otherwise step.
export const enterAction = (clock, { changed = false } = {}) => changed || !clock || !clock.started || clock.done ? 'start' : 'step';

export class BeatClock {
  constructor(plan, { sp = 1, auto = true, readAlong = false } = {}) {
    this.plan = plan; this.n = plan.beats.length; this.sp = sp; this.auto = auto; this.readAlong = readAlong;
    this.pos = 0; this.run = null; this.wait = null; this.paused = false; this.started = false;
  }
  // run: the beat in motion {i, from (u when it was last anchored), at (ms), secs}. Its
  // length is fixed when it starts, so a speed change applies from the next beat.
  begin(i, at, once = false) { this.run = { i, from: 0, at, secs: beatSeconds(this.plan.beats[i], this.sp), once }; this.wait = null; this.pos = i; }
  // Plays the clock forward to `now`. A beat that ended between two frames hands over at
  // its exact end time, so the timeline never depends on the frame rate.
  advance(now) {
    for (let guard = 0; guard <= this.n + 1 && !this.paused; guard++) {
      if (this.run) {
        // A frame stamped before the beat began (requestAnimationFrame passes the frame's start
        // time, which can precede the click that started it) holds the beat at its start.
        const { i, from, at, secs, once } = this.run, length = secs * 1000, u = length > 0 ? from + Math.max(0, now - at) / length : 1;
        if (u < 1) { this.pos = i + u; return; }
        const end = at + (1 - from) * length;
        this.run = null; this.pos = i + 1;
        if (!this.auto || once || i + 1 >= this.n) return;
        const gap = this.readAlong ? readGap(this.plan.beats[i], secs) : 0;
        if (gap > 0) this.wait = { next: i + 1, until: end + gap * 1000 }; else this.begin(i + 1, end);
      } else if (this.wait) {
        if (now < this.wait.until) return;
        this.begin(this.wait.next, this.wait.until);
      } else return;
    }
  }
  t(now) { this.advance(now); return this.pos; }
  // Rewind to beat 0 and play it; AUTO carries the run on to OUTPUT.
  start(now) { this.paused = false; this.started = true; this.run = this.wait = null; this.pos = 0; if (this.n) this.begin(0, now); }
  // Mid-beat (playing or paused): finish this beat now. Between beats: play the next
  // one, after which AUTO, if on, continues (`once` plays just that beat: the Steps list).
  // It never skips more than one beat.
  step(now, { once = false } = {}) {
    this.advance(now); this.started = true;
    if (this.run) {
      const { i } = this.run, wasPaused = this.paused;
      this.run = null; this.paused = false; this.pos = i + 1;
      if (!wasPaused && this.auto && i + 1 < this.n) this.begin(i + 1, now);
      return 'finish';
    }
    this.paused = false;
    const next = this.wait ? this.wait.next : Math.round(this.pos);
    if (next >= this.n) { this.wait = null; return 'done'; }
    this.begin(next, now, once); return 'play';
  }
  // Freeze or resume mid-beat (or mid read-along gap); at rest there is nothing to pause.
  pause(now) {
    this.advance(now);
    if (!this.run && !this.wait) { this.paused = false; return false; }
    if (!this.paused) {
      if (this.run) this.run = { ...this.run, from: this.pos - this.run.i, at: now };
      else this.wait = { ...this.wait, left: Math.max(0, this.wait.until - now) };
      this.paused = true;
    } else {
      if (this.run) this.run = { ...this.run, at: now };
      else this.wait = { next: this.wait.next, until: now + this.wait.left };
      this.paused = false;
    }
    return this.paused;
  }
  stop() { this.run = this.wait = null; this.paused = false; }
  // Back: mid-beat, to the start of this beat; at a boundary, to the start of the one before.
  back() { const at = this.run ? this.run.i : Math.ceil(this.pos - 1e-9) - 1; this.stop(); this.pos = Math.max(0, at); }
  seek(t) { this.stop(); this.pos = Math.max(0, Math.min(this.n, t)); }
  setAuto(on, now) { this.advance(now); this.auto = !!on; if (!on && this.wait) { this.wait = null; } }
  setSpeed(sp, now) { this.advance(now); this.sp = sp; }
  setReadAlong(on, now) { this.advance(now); this.readAlong = !!on; if (!on && this.wait && !this.paused) this.begin(this.wait.next, now); }
  get playing() { return !this.paused && !!(this.run || this.wait); }
  // The beat in motion, else the last one completed (−1 before the first).
  get beat() { return this.run ? this.run.i : this.wait ? this.wait.next - 1 : Math.ceil(this.pos - 1e-9) - 1; }
  get done() { return !this.run && !this.wait && this.pos >= this.n; }
}
