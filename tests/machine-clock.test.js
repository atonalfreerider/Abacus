import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, BeatClock, enterAction, readGap, SPEEDS } from '../src/machine/clock.js';

// A stand-in for the [16,7] MULT plan: the clock reads only beat kinds, durations and
// captions, so the 16 beats of design 2.4 are enough (no scenes needed).
const golden = ['[16, 7] goes in.', 'The numbers ride down the wire to the × block.', '16 and 7 drop into the sockets and stand up.',
  '7 = 4 + 3, so 16 × 7 = 16 × 4 + 16 × 3.', '16 × 4: 2 dark bulbs slide under 16; it rises 2 levels. 64.', '64 rides up.',
  '3 = 2 + 1, so 16 × 3 = 16 × 2 + 16 × 1.', '16 × 2: 1 dark bulb slides under 16; it rises 1 level. 32.', '32 rides up.',
  '16 × 1: the 1 dissolves; 16 stays put.', '16 rides up.', '32 + 16: nothing carries. 48.', '48 rides up.',
  '64 + 48: nothing carries. 112.', '112 rides up into the triangle.', 'Output [112].'];
const kinds = ['input', 'deliver', 'fanout', 'split', 'shift', 'return', 'split', 'shift', 'return', 'shift', 'return', 'collide', 'return', 'collide', 'return', 'output'];
const plan = { beats: golden.map((caption, i) => ({ i, kind: kinds[i], caption })) };
const level = { beats: [{ i: 0, kind: 'collide', caption: 'a' }, { i: 1, kind: 'carry', dur: .5, caption: 'b' }, { i: 2, kind: 'carry', dur: .5, caption: 'c' }, { i: 3, kind: 'output', caption: 'd' }] };

test('schedule: one beat lasts sp seconds, a level-pace carry half of that, and read along waits for the caption', () => {
  const s = schedule(level, 2);
  assert.deepEqual([...s.starts], [0, 2, 3, 4]); assert.deepEqual([...s.ends], [2, 3, 4, 6]); assert.equal(s.total, 6);
  assert.equal(schedule(plan, 1).total, 16);
  const long = { caption: 'x'.repeat(110) }, short = { caption: 'Output [112].' };
  assert.equal(readGap(long, .25), 6, 'capped at 6 s');
  assert.equal(readGap(short, 3), 0, 'a long beat needs no extra time');
  assert.ok(Math.abs(readGap(short, 1) - (.8 + 13 / 15 - 1)) < 1e-12);
  const r = schedule(plan, 1, { readAlong: true });
  assert.equal(r.starts[1], 1 + readGap(plan.beats[0], 1)); assert.equal(r.total, r.ends[15]);
  assert.deepEqual(SPEEDS, [.25, .5, 1, 1.5, 2, 3]);
});

test('AUTO on: one start plays the whole run to OUTPUT, with no gaps and at the exact beat ends', () => {
  const c = new BeatClock(plan, { sp: 1, auto: true });
  assert.equal(c.t(0), 0); assert.equal(c.beat, -1); assert.equal(c.done, false);
  c.start(1000);
  assert.equal(c.t(1500), .5); assert.equal(c.beat, 0); assert.equal(c.playing, true);
  assert.equal(c.t(1000 + 3250), 3.25, 'frames may skip boundaries: beat 3 started exactly at 4000 ms');
  assert.equal(c.t(1000 + 16000), 16); assert.equal(c.done, true); assert.equal(c.playing, false); assert.equal(c.beat, 15);
  assert.equal(c.t(99999), 16);
});

test('AUTO off: 16 Enters play beats 0–15, one each; Enter mid-beat finishes it without skipping', () => {
  const c = new BeatClock(plan, { auto: false });
  let now = 0, played = [];
  for (let k = 0; k < 16; k++) {
    const action = enterAction(c);
    if (action === 'start') c.start(now); else c.step(now);
    played.push(c.beat); now += 1200; assert.equal(c.t(now), k + 1, `rests at boundary ${k + 1}`); assert.equal(c.playing, false);
  }
  assert.deepEqual(played, [...Array(16).keys()]); assert.equal(c.done, true);
  assert.equal(enterAction(c), 'start', 'after OUTPUT, Enter starts over');
  const d = new BeatClock(plan, { auto: false }); d.start(0); d.t(400);
  assert.equal(d.step(400), 'finish'); assert.equal(d.t(400), 1); assert.equal(d.playing, false);
  assert.equal(d.step(500), 'play'); assert.equal(d.t(1000), 1.5);
});

test('AUTO on: a second Enter mid-run finishes the current beat and the run carries on', () => {
  const c = new BeatClock(plan); c.start(0); c.t(2300);
  assert.equal(enterAction(c), 'step');
  assert.equal(c.step(2300), 'finish'); assert.equal(c.t(2300), 3); assert.equal(c.beat, 3, 'beat 3 began at once');
  assert.equal(c.t(2800), 3.5);
  assert.equal(enterAction(c, { changed: true }), 'start', 'an edit or new input text starts over');
});

test('speed applies from the next beat; pause freezes mid-beat; back and seek land on boundaries', () => {
  const c = new BeatClock(plan); c.start(0); c.t(500);
  c.setSpeed(2, 500);
  assert.equal(c.t(1000), 1, 'beat 0 kept its 1 s'); assert.equal(c.t(2000), 1.5, 'beat 1 runs at 2 s');
  assert.equal(c.pause(2000), true); assert.equal(c.playing, false); assert.equal(c.t(9000), 1.5);
  assert.equal(c.pause(9000), false); assert.equal(c.t(9500), 1.75);
  c.back(); assert.equal(c.t(9500), 1, 'mid-beat: back to its start'); assert.equal(c.playing, false);
  c.back(); assert.equal(c.t(9500), 0, 'at a boundary: the beat before');
  c.back(); assert.equal(c.t(9500), 0);
  c.seek(7.5); assert.equal(c.t(9900), 7.5); c.seek(99); assert.equal(c.t(9900), 16); assert.equal(c.done, true);
  const p = new BeatClock(plan); p.start(0); p.pause(300);
  assert.equal(p.step(400), 'finish'); assert.equal(p.t(5000), 1, 'Enter on a paused beat finishes it and rests');
});

test('read along: AUTO waits after each beat until its caption has been read; Enter skips the wait', () => {
  const c = new BeatClock(plan, { readAlong: true }); c.start(0);
  const gap = readGap(plan.beats[0], 1) * 1000;
  assert.equal(c.t(1000 + gap / 2), 1); assert.equal(c.playing, true, 'waiting counts as playing');
  assert.ok(Math.abs(c.t(1000 + gap + 250) - 1.25) < 1e-9);
  const d = new BeatClock(plan, { readAlong: true }); d.start(0); d.t(1100);
  assert.equal(d.step(1100), 'play'); assert.equal(d.t(1600), 1.5);
  d.setAuto(false, 1600); assert.equal(d.t(2600), 2); assert.equal(d.t(9000), 2, 'AUTO off: no more beats');
});

test('level pace: carry beats take half a beat', () => {
  const c = new BeatClock(level, { sp: 1 }); c.start(0);
  assert.equal(c.t(1250), 1.5); assert.equal(c.t(2000), 3); assert.equal(c.t(3000), 4); assert.equal(c.done, true);
});

test('a frame stamped before the beat began never runs the clock backwards', () => {
  const c = new BeatClock(plan); c.start(1000);
  assert.equal(c.t(990), 0, 'requestAnimationFrame can pass a time before the click that started the run');
  assert.equal(c.beat, 0); assert.equal(c.t(1500), .5);
  c.step(1500); assert.equal(c.t(1490), 1, 'a beat begun at 1500 holds at its start');
});
