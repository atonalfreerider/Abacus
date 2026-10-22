// The ten silent, captioned Machine explainers (docs/machine-design.md, section 5). Each
// drives the real app through its automation hook (&automation) in recording mode
// (&recording: the stage alone, with a band at the bottom kept clear for the burned-in
// captions). The machine plays under AUTO and ctx.machine paces it, holding each beat until
// its caption has been read. Captions marked (plan) in the storyboards are the plan's own
// (captionBeat with no text), so a subtitle never disagrees with the maths. Beats a
// storyboard gives no words to play with the plan's captions or, for the flow beats (in,
// down the wire, into the sockets, back up, out), with none. One script serves both formats:
// the layout does not depend on the viewport.

// Recording mode hides the controls the studio's default portrait band keeps clear of, so
// machine captions sit low (design 5.2).
const overlay = {portrait: {'caption-bottom': '40px'}};
// The page to open: a ?machine preset (4.1) plus the automation hook and recording mode.
const page = (preset = {}) => '/?' + [...Object.entries(preset).map(([k, v]) => `${k}=${encodeURIComponent(v)}`), 'automation', 'recording', 'auto=1'].join('&');
const top = {at: 'top'};

// Title and end cards: a row of bulbs, then the words. The setup runs behind the card.
async function opening(ctx, card, setup) {
  await ctx.bulbTitle(card, true, 0);
  if (setup) await setup();
  await ctx.hold(3.2);
  await ctx.card('', false, .6); await ctx.hold(.75);
}
async function closing(ctx, card, seconds = 4.5) {
  await ctx.freeze(.3);
  await ctx.bulbTitle(card, true, .7);
  await ctx.hold(seconds);
}
// Cut to a new machine behind a quick paper fade.
const cut = (ctx, params, then) => ctx.cut(async () => { await ctx.machine.load(params); if (then) await then(); });
const stage = ctx => ctx.eval(`document.getElementById('machine-stage').focus({preventScroll:true})`);
// Press D for the Digits view (place values beside the towers, a digit beside each bulb).
// Shortcuts listen on the stage, so focus moves there first, as Esc would.
async function digits(ctx) {
  if (await ctx.eval(`document.getElementById('machine-digits').checked`)) return;
  await stage(ctx);
  await ctx.key('d', {label: 'D  digits'});
  await ctx.freeze(.5);
}
// Enter (a keycap) starts the run; the flow beats (in, down the wire, into the sockets) play
// a little quicker than the beats that do the work, then the picture settles for a moment.
async function run(ctx, {flow = 2, speed = 1.5, settle = .7} = {}) {
  await stage(ctx);
  await ctx.machine.start();
  if (flow < 0) return;
  await ctx.machine.until(flow, {speed});
  await ctx.freeze(settle);
}
// Type an expression with the bar and palette on screen (a top caption while typing, if
// given), press Enter, and hide them again once the numbers are down the wire.
async function expression(ctx, text, caption) {
  const M = ctx.machine;
  await cut(ctx, {tree: {}, input: ''}, async () => {
    await ctx.eval(`document.getElementById('machine-input').value='';document.getElementById('machine-expr').value=''`);
    await M.chrome('build');
    await ctx.eval(`__rec.below(['.machine-bar'])`);
  });
  if (caption) ctx.caption(caption, Math.max(5, .45 + text.length * .07 + 3.2), top);
  await ctx.type('#machine-expr', text, {per: .07});
  await ctx.hold(.6);
  await ctx.key('Enter');
  await M.until(1, {speed: 1.5});
  await M.chrome('run');
  await M.until(2, {speed: 1.5});
  await ctx.freeze(.5);
}
// The rest of the run, back up the wires and out, and a moment on the Output.
async function finish(ctx, speed = 1.5) {
  await ctx.machine.until('end', {speed});
  await ctx.freeze(.8);
}

export const machineTutorials = {
  // V1: build a machine, then watch 16 × 7 split into shifts and sums.
  'machine-multiply': {
    title: '16 × 7 in lights',
    silent: true, overlay,
    path: page({machine: 'empty'}),
    async script(ctx) {
      const M = ctx.machine;
      await opening(ctx, {bits: '1110000', title: 'Multiplying in lights', subtitle: '16 × 7 as shifts and sums'}, async () => {
        await M.load({tree: {}, input: ''});
        await ctx.eval(`document.getElementById('machine-input').value=''`);
        await M.chrome('build');
        await ctx.eval(`__rec.below(['.machine-bar'])`);
      });
      await M.note('A function machine: numbers in, numbers out.', top);
      ctx.caption('Hang a × block under the triangle.', 3.4, top);
      await ctx.tap(() => ctx.element('#machine-svg [data-socket="io"]'));
      await ctx.hold(.5);
      await ctx.tap(() => ctx.element('#machine-palette button[data-op="mul"]'));
      await ctx.hold(1.3);
      ctx.caption('Type the two numbers: [16,7].', 3, top);
      await ctx.type('#machine-input', '[16,7]');
      await ctx.hold(1.2);
      // Hanging the block selected its first open socket; committing the numbers clears that.
      await M.load({});
      ctx.caption('Press Enter. The numbers drop down the wire.', 3.6, top);
      await ctx.hold(.6);
      await M.start({field: '#machine-input'});
      await M.until(1);
      await M.chrome('run');
      await digits(ctx);
      await M.captionBeat(2, {text: ['Each number is a tower of bulbs.', 'Each level is worth twice the one below.'], min: 4});
      await M.note('7 has three lit bulbs: 4 + 2 + 1.', {extra: .4});
      await M.captionBeat(3, {min: 3});
      await M.captionBeat(4, {min: 4, extra: 'The top bulb of 4 vanishes: × 1 changes nothing.'});
      await M.captionBeat(5);
      await M.captionBeat(6, {min: 3});
      for (const i of [7, 8, 9, 10]) await M.captionBeat(i, {min: i % 2 ? 2.5 : 1.5});
      await M.captionBeat(11, {text: c => ['Adding is a collision, level by level.', c], min: 3});
      await M.captionBeat(12);
      await M.captionBeat(13, {text: c => ['No two lit bulbs meet, so nothing carries.', c], min: 3});
      await M.captionBeat([14, 15], {text: '112: three shifts and two sums.', min: 2.5, hold: .6});
      await cut(ctx, {op: 'mul', input: '7,16'});
      await run(ctx, {flow: 1});
      await M.captionBeat(2, {text: 'Swap them: 16 has one lit bulb,', min: 2.5});
      await M.captionBeat(3, {text: 'so 7 × 16 is a single shift.', min: 3});
      await finish(ctx);
      await closing(ctx, {bits: '1110000', title: 'Multiply = split into shifts, then add.'});
    },
  },

  // V2: level pace, one carry at a time.
  'binary-carry': {
    title: 'Carries climb',
    silent: true, overlay,
    path: page({machine: 'add', input: '13,9', pace: 'level'}),
    async script(ctx) {
      const M = ctx.machine;
      await opening(ctx, {bits: '10110', title: 'Carries climb'});
      await digits(ctx);
      await run(ctx);
      await M.captionBeat(3, {text: ['13 + 9: the bulbs fly across and wait beside their own levels.', 'Two lit bulbs meet: the resident climbs a level, the newcomer goes dark.'], min: 7});
      await M.captionBeat(4, {text: 'The climbing bulb lands on a dark level and stays.', min: 3});
      await M.captionBeat(5);
      await M.captionBeat(6);
      await M.captionBeat(7, {extra: '10110 = 22.'});
      await finish(ctx);

      await cut(ctx, {op: 'add', input: '6,3', pace: 'level'});
      await run(ctx);
      await M.until(4, {speed: .6});
      await M.captionBeat(5, {text: 'A carry lands on a lit bulb: that bulb climbs on, and the carry stays dark.', min: 4.5});
      await M.captionBeat(6, {text: '1001 = 9.', min: 2});
      await finish(ctx);

      await cut(ctx, {op: 'add', input: '7,1', pace: 'level'});
      await run(ctx);
      await M.captionBeat([3, 5], {text: '7 + 1: each lit bulb hands its light one level up…', min: 5});
      await M.captionBeat(6, {text: '…and the column grows: 1000 = 8.', min: 2.5});
      await finish(ctx);

      await cut(ctx, {op: 'add', input: '13,3', pace: 'level'});
      await stage(ctx);
      await ctx.key('p', {label: 'P  carries together'});
      await ctx.hold(.8);
      await run(ctx);
      await M.captionBeat(3, {text: ['PRIME does the whole chain in one beat.', 'A carry is always lit as it climbs.'], min: 5.5});
      await finish(ctx);
      await closing(ctx, {bits: '10000', title: 'A carry is a bulb that climbs one level.'});
    },
  },

  // V3: sign-magnitude red bulbs, cancelling, and the borrow.
  'binary-negative': {
    title: 'Red bulbs and borrowing',
    silent: true, overlay,
    path: page({machine: 'cmp', input: '-5,5'}),
    async script(ctx) {
      const M = ctx.machine;
      await opening(ctx, {bits: 'T0T', title: 'Red bulbs and borrowing'});
      await digits(ctx);
      await run(ctx, {flow: 1});
      await M.captionBeat(2, {text: 'Negative numbers are red: −5.', min: 3, hold: .6});

      await cut(ctx, {op: 'sub', input: '12,5'});
      await run(ctx);
      await M.captionBeat(3, {text: 'Subtracting 5 adds −5.', min: 3});
      await M.captionBeat(4, {text: 'A blue and a red bulb on one level cancel.', min: 3.5, extra: 'A red bulb on a dark level is owed.'});
      await M.captionBeat(5, {text: ['The nearest blue bulb above comes down,', 'lighting every level it passes,', 'and pays the debt at the bottom.'], min: 6, extra: '111 = 7.'});
      await finish(ctx);

      await cut(ctx, {op: 'sub', input: '5,12'});
      await run(ctx, {flow: 3});
      await M.captionBeat([4, 5], {text: 'The larger tower receives, so the answer is red: −7.', min: 4.5});
      await finish(ctx);
      await closing(ctx, {bits: '111', title: 'Borrowing is a carry run backwards.'});
    },
  },

  // V4: shifts, then long division as compare-and-subtract from the top level down.
  'binary-shift-divide': {
    title: 'Shifts and long division',
    silent: true, overlay,
    path: page({machine: 'shl', input: '5,3'}),
    async script(ctx) {
      const M = ctx.machine;
      await opening(ctx, {bits: '101101', title: 'Shifts and long division'});
      await digits(ctx);
      await run(ctx);
      await M.captionBeat(3, {text: '×2³: three dark bulbs slide in; 5 rises three levels.', min: 3.5});
      await M.captionBeat([4, 5], {text: '40.', speed: 1.5});

      await cut(ctx, {op: 'shr', input: '45,2'});
      await run(ctx);
      await M.captionBeat(3, {text: '÷2²: the bottom two bulbs fall out: the remainder.', min: 3.5});
      await M.captionBeat([4, 5], {text: '11 r 1.', speed: 1.5});

      await cut(ctx, {op: 'div', input: '45,6'});
      await run(ctx);
      await M.captionBeat(3, {text: 'Lift a copy of 6 to the height of 45: 48.', min: 3.5});
      await M.captionBeat(4, {text: 'Does 48 fit under 45? No: quotient bulb 3 stays dark.', min: 3.5});
      await M.captionBeat(5, {text: 'Drop one level: 24.', min: 2.5});
      await M.captionBeat([6, 8], {text: '24 fits: subtract it and light quotient bulb 2.', min: 5});
      await M.captionBeat([9, 12], {text: '12 fits.', speed: 2});
      await M.captionBeat([13, 17], {text: '6 fits.', speed: 2});
      await M.captionBeat([18, 19], {text: '45 = 7 × 6 + 3.', min: 3, hold: .8});
      await closing(ctx, {bits: '111', text: '7 r 3', title: 'Division is comparing and subtracting, top level first.'});
    },
  },

  // V5: AND, OR, XOR, the half adder they make, and NOT with the sign lamp.
  'binary-logic': {
    title: 'Gates in lights',
    silent: true, overlay,
    path: page({machine: 'and', input: '12,10'}),
    async script(ctx) {
      const M = ctx.machine, gates = {rows: [{bits: '1100'}, {bits: '1010'}]};
      await opening(ctx, {...gates, title: 'Gates in lights'});
      await digits(ctx);
      for (const [op, words, out] of [['and', 'AND: a dark bulb wins.', '8.'], ['or', 'OR: a lit bulb wins.', '14.'], ['xor', 'XOR: two lit bulbs make a carry that evaporates.', '6.']]) {
        if (op !== 'and') await cut(ctx, {op, input: '12,10'});
        await run(ctx);
        await M.captionBeat(3, {text: words, min: 3.5});
        await M.captionBeat([4, 5], {text: out, speed: 1.5});
      }

      // The half adder, typed into the expression field with the bar and palette on screen;
      // once the numbers are down the wire they hide again, as in the first video.
      await expression(ctx, '(12^10)+((12&10)<<1)', 'What stays is XOR. What climbs is AND.');
      for (const i of [3, 4, 5, 6]) await M.captionBeat(i, {min: i % 2 ? 2.5 : 1.2});
      await M.captionBeat([7, 11], {text: 'Shift AND up a level and add: 22 = 12 + 10.', min: 6, hold: .5});

      await cut(ctx, {op: 'not', input: '5'});
      await run(ctx);
      await M.captionBeat(3, {text: ['NOT flips every bulb, and the lamp above the top lights red:', 'every level above is lit, forever. Together they are worth −6.'], min: 8});
      await finish(ctx);

      await cut(ctx, {op: 'and', input: '-5,3'});
      await run(ctx);
      await M.captionBeat([3, 4], {text: 'A red number enters a gate by flipping and adding one.', min: 5});
      await M.captionBeat(5, {text: '3.', min: 2.5});
      await finish(ctx);
      await closing(ctx, {...gates, title: 'Logic never moves a bulb up or down.'});
    },
  },

  // V6: balanced ternary: three states per bulb, no sign needed.
  'ternary-basics': {
    title: 'Blue, dark, red',
    silent: true, overlay,
    path: page({machine: 'neg', mbase: 'ternary', input: '5'}),
    async script(ctx) {
      const M = ctx.machine;
      await opening(ctx, {bits: '1TT', base: 'ternary', title: 'Blue, dark, red'});
      await digits(ctx);
      await run(ctx, {flow: 1});
      await M.captionBeat(2, {text: 'Balanced ternary: each level is worth 3 of the one below.', min: 4});
      await M.note('A bulb is +1 (blue), 0 (dark) or −1 (red).');
      await M.note('5 = 9 − 3 − 1.', {extra: .3});
      await M.captionBeat(3, {text: 'Swap the colours and you have −5. No minus sign needed.', min: 4});
      await finish(ctx);

      await cut(ctx, {op: 'add', input: '5,7', pace: 'level'});
      await run(ctx);
      await M.captionBeat(3, {text: 'Blue meets red: they cancel.', min: 3.5});
      await M.captionBeat(4, {text: 'Two reds make one red carry and leave a blue: −2 = −3 + 1.', min: 4});
      await M.captionBeat(5, {text: '12.', min: 2.5});
      await finish(ctx);

      await cut(ctx, {op: 'cmp', input: '5,-5'});
      await run(ctx);
      await M.captionBeat(3, {text: 'Comparing reads from the top: blue wins.', min: 4});
      await finish(ctx);
      await closing(ctx, {bits: '1TT', base: 'ternary', title: 'Three states, no signs.'});
    },
  },

  // V7: the same 16 × 7 in balanced ternary, and division that rounds to the nearest.
  'ternary-multiply-divide': {
    title: 'Multiplying and dividing in balanced ternary',
    silent: true, overlay,
    path: page({machine: 'mul', mbase: 'ternary', input: '16,7'}),
    async script(ctx) {
      const M = ctx.machine;
      await opening(ctx, {bits: '11011', base: 'ternary', title: 'Multiplying and dividing', subtitle: 'in balanced ternary'});
      await digits(ctx);
      await run(ctx, {flow: 1});
      await M.captionBeat(2, {text: '7 = 9 − 3 + 1.', min: 3});
      await M.captionBeat(3, {min: 3.5});
      await M.captionBeat(4, {text: '×9: rise two levels.', min: 3});
      await M.captionBeat(5);
      await M.captionBeat(6, {min: 3.5});
      await M.captionBeat(7, {text: '×(−3): rise one level and swap every colour.', min: 4});
      for (const i of [8, 9, 10]) await M.captionBeat(i);
      await M.captionBeat(11, {text: 'Red carries climb too.', min: 3.5});
      await M.captionBeat(12);
      await M.captionBeat(13, {min: 3.5});
      await M.captionBeat([14, 15], {text: '112: same answer, different journey.', min: 3, hold: .5});

      await cut(ctx, {op: 'div', input: '19,5'});
      await run(ctx);
      await M.captionBeat(3, {min: 3.5});
      await M.captionBeat(4, {text: 'Try subtracting 15 from 19…', min: 3});
      await M.captionBeat(5, {text: '…4 is nearer zero than 19: keep it.', min: 3});
      await M.captionBeat([6, 8], {text: '4 − 5 = −1 is nearer zero than 4: keep it.', min: 5});
      await M.captionBeat([9, 10], {text: '19 = 4 × 5 − 1: ternary rounds to the nearest.', min: 4, hold: .5});

      await cut(ctx, {op: 'div', input: '14,4'});
      await run(ctx, {flow: 6, speed: 2.5});
      await M.captionBeat(7, {text: '2 or −2: equally near zero.', min: 3});
      await M.captionBeat(8, {text: 'A tie keeps the dividend\'s sign: 14 = 3 × 4 + 2.', min: 4});
      await finish(ctx);
      await closing(ctx, {bits: '11011', base: 'ternary', title: 'The remainder is never more than half the divisor.'});
    },
  },

  // V8: MIN, MAX, SUM and CONS: balanced ternary's gates.
  'ternary-logic': {
    title: 'Gates with three states',
    silent: true, overlay,
    path: page({machine: 'min', mbase: 'ternary', input: '2,1'}),
    async script(ctx) {
      const M = ctx.machine, card = {rows: [{bits: '1TT', base: 'ternary'}, {bits: '1T1', base: 'ternary'}]};
      await opening(ctx, {...card, title: 'Gates with three states'});
      await digits(ctx);
      const shots = [
        ['min', '2,1', 'MIN keeps the lower state: red, then dark, then blue.', '−1.'],
        ['max', '2,1', 'MAX keeps the higher.', '4. Level by level, not number by number.'],
        ['sum', '5,7', 'SUM adds each level and throws the carry away.', '−6.'],
        ['cons', '5,7', 'CONS keeps a level only where both agree: the carries.', '6.'],
      ];
      for (const [op, input, words, out] of shots) {
        if (op !== 'min') await cut(ctx, {op, input});
        await run(ctx);
        await M.captionBeat(3, {text: words, min: 4});
        await M.captionBeat([4, 5], {text: out, speed: 1.5});
      }

      await expression(ctx, 'sum(5,7)+(cons(5,7)<<1)');
      for (const i of [3, 4, 5, 6, 7, 8]) await M.captionBeat(i, {min: i % 2 ? 2.5 : 1.2});
      await M.captionBeat([9, 11], {text: '−6 + 3 × 6 = 12 = 5 + 7.', min: 5, hold: .5});
      await closing(ctx, {...card, title: 'SUM and CONS do for 3 what XOR and AND do for 2.'});
    },
  },

  // V9: base e: levels worth e, exact shifts, and whole numbers whose towers never end.
  'e-towers': {
    title: 'Base e: towers that never end',
    silent: true, overlay,
    path: page({machine: 'empty', mbase: 'e'}),
    async script(ctx) {
      const M = ctx.machine;
      await opening(ctx, {bits: '10.02…', base: 'e', title: 'Base e', subtitle: 'Towers that never end'}, () =>
        M.load({base: 'e', tree: {n1: {op: 'add', parent: 'io', socket: 'C'}, n2: {op: 'add', parent: 'n1', socket: 'L'}}, input: 'e, e^2, 2'}));
      await digits(ctx);
      await run(ctx, {flow: 1});
      await M.captionBeat(2, {text: 'Base e: each level is worth e ≈ 2.718 of the one below.', min: 4.5});
      // A close-up of the level 2 stands on: two sockets full, and the sliver.
      const level = await M.point('t3', 0);
      await ctx.wheel(level, 2.2, 1.2);
      await M.note('A level has room for e bulbs: two, and a sliver.', {extra: .4});
      await ctx.wheel(level, 1 / 2.2, .8);
      // Closer on the three towers, around e²'s top bulb, for their digits.
      const three = await M.point('t2', 2);
      await ctx.wheel(three, 1.4, .8);
      await M.note('e = 10ₑ, e² = 100ₑ, 2 = 2ₑ.', {extra: .6});
      await ctx.wheel(three, 1 / 1.4, .8);
      await M.centre();

      await cut(ctx, {op: 'add', base: 'e', input: 'e^2,2'});
      await run(ctx);
      await M.captionBeat([3, 4], {text: '102ₑ is exactly e² + 2.', min: 4});
      await finish(ctx);

      await cut(ctx, {op: 'measure', base: 'e', input: '3'});
      await run(ctx, {flow: 1});
      await M.captionBeat(2, {min: 3});
      await M.captionBeat(3, {text: '3 = 10.02…: the light leaves one bulb at level 1, two at level −2…', min: 6});
      // A close-up of the dust under the floor.
      const dust = await M.point('t1', -3.6);
      await ctx.wheel(dust, 2, 1.2);
      await M.note('…and what is left never runs out: e is transcendental.', {extra: .4});
      await ctx.wheel(dust, 1 / 2, 1);
      await M.centre();
      await M.note('Only 0, 1 and 2 end.', {extra: .5});
      await finish(ctx);

      await cut(ctx, {op: 'mule', base: 'e', input: '3,2'});
      await run(ctx);
      await M.captionBeat(3, {text: '×e² is a shift: two levels up, and a 1 condenses out of the dust.', min: 5, extra: '1002.001…ₑ'});
      await finish(ctx);

      await cut(ctx, {op: 'mule', base: 'e', input: '2,3'});
      await run(ctx);
      await M.captionBeat(3, {text: '×e³: three levels up.', min: 3, extra: '2000ₑ.'});
      await finish(ctx);
      await closing(ctx, {bits: '10.02…', base: 'e', title: 'Shifts are exact; whole numbers never end.'});
    },
  },

  // V10: folding piles into one light at height ln x, and multiplying by adding heights.
  'e-logarithms': {
    title: 'Adding and multiplying with logarithms',
    silent: true, overlay,
    path: page({machine: 'measure(1+1)', mbase: 'e'}),
    async script(ctx) {
      const M = ctx.machine;
      await opening(ctx, {bits: '20010.001…', base: 'e', title: 'Adding and multiplying', subtitle: 'with logarithms'}, async () => {
        // Two bulbs standing at level 0 of the ruler: 1 + 1 has already been added.
        await M.load({base: 'e', expression: 'measure(1+1)'});
        await M.seek(6);
      });
      await digits(ctx);
      await stage(ctx);
      await M.start();
      await M.captionBeat(6, {text: 'Merge two bulbs: the light rises ln 2 = 0.69.', min: 4.5});
      await finish(ctx, 2);

      await cut(ctx, {op: 'add', base: 'e', input: '2,1'});
      await run(ctx);
      await M.captionBeat(3, {min: 2.5});
      await M.captionBeat(4, {text: 'Three rise ln 3 = 1.099: past the next level.', min: 4.5});
      await M.captionBeat(5, {text: 'One bulb lands at level 1; the change falls on, forever.', min: 5});
      await finish(ctx);

      await cut(ctx, {op: 'add', base: 'binary', input: '1,1'});
      await run(ctx);
      await M.captionBeat(3, {text: 'In base 2, two bulbs rise exactly one level: a carry.', min: 4.5});
      await finish(ctx);

      await cut(ctx, {op: 'add', base: 'e', input: '16,7'});
      await run(ctx);
      await M.captionBeat([3, 4], {text: 'Pile them up and merge to one light at height ln 23.', min: 6});
      await M.captionBeat(5, {text: ['Let it fall: it leaves bulbs where it can afford them.', '1010.011…ₑ'], min: 6.5});
      await finish(ctx);

      await cut(ctx, {op: 'add', base: 'e', input: '2e,2'});
      await run(ctx);
      await M.captionBeat(3, {text: 'Even 22ₑ is too full: 2e + 2 is more than e².', min: 4.5});
      await M.captionBeat(4, {min: 3.5});
      await M.captionBeat(5, {min: 4});
      await finish(ctx);

      await cut(ctx, {op: 'mul', base: 'e', input: '16,7'});
      await run(ctx);
      await M.captionBeat(3, {text: 'Fold both: ln 16 = 2.77, ln 7 = 1.95.', min: 4.5});
      await M.captionBeat(4, {text: 'Multiplying adds heights: 2.77 + 1.95 = 4.72.', min: 5, extra: 'Levels 2 + 1 = 3, but 112 stands at level 4: the heights carried.'});
      await M.captionBeat(5, {text: '112.', min: 5});
      await finish(ctx);

      await cut(ctx, {op: 'ln', base: 'e', input: '112'});
      await run(ctx, {flow: 1});
      await M.captionBeat(2, {min: 3.5});
      await M.captionBeat(3, {text: 'The height of the folded light is ln.', min: 4});
      await finish(ctx);
      await closing(ctx, {rows: [{bits: '1110000', label: 'base 2'}, {bits: '11011', base: 'ternary', label: 'base 3'}, {bits: '20010.001…', base: 'e', label: 'base e'}], title: 'The cost of a base, b ÷ ln b: 2.885, 2.731, 2.718.'}, 5.5);
    },
  },
};
