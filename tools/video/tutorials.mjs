// The tutorial scripts. Each drives the real app with touch gestures while JohnV4
// narrates; card positions are read live, so one script serves both formats.
import {unitPlan} from '../../src/mvc/units.js';

// Titles and end cards.
const tray = (cards, kind = '') => `<div class="tray">${Array.from({length: 9}, (_, i) => `<i class="${i < cards ? kind : 'empty'}"></i>`).join('')}</div>`;
const titleCard = ({cards = 9, kind = '', title, subtitle}) => `${tray(cards, kind)}<div class="brand">Abacus</div><div class="title">${title}</div>${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}`;
async function opening(ctx, card, text) {
  await ctx.card(titleCard(card), true, 0);
  await ctx.hold(.6);
  const line = await ctx.say(text); await line.done(.5);
  await ctx.card('', false, .6); await ctx.hold(.6);
}
async function closing(ctx, card, text) {
  await ctx.card(titleCard(card), true, .6);
  const line = await ctx.say(text); await line.done(1.2);
}
const say = async (ctx, text, pad) => (await ctx.say(text)).done(pad);

// App-time schedule (ms after release) of a card dropped on a whole number: the same
// unit plan and duration mapping the app animates (animation.js, view.js renderUnits).
function timeline(target, moved) {
  const u = unitPlan(target, moved, 'target', 'source'), total = Math.max(900, u.duration * 1000 + 200), ms = s => s / u.duration * .9 * total;
  const phases = u.phases.map(p => ({type: p.type, start: ms(p.start), end: ms(p.end)}));
  const of = type => phases.filter(p => p.type === type).sort((a, b) => a.start - b.start);
  return {total, phases, of};
}
// Slow-motion storytelling: before each beat the app plays up to the beat's start; while
// the beat's line is spoken, exactly its slice [from, to] of the animation plays.
async function story(ctx, released, beats) {
  for (const {from, to = from, text, pad = .25} of beats) {
    await ctx.playTo(released + from, .5);
    const line = await ctx.say(text);
    await ctx.stretch(to - from, line.end - ctx.time + pad);
  }
  await ctx.idle({rate: .6});
}
const carrySteps = (c, first, then) => [{from: c.start, to: (c.start + c.end) / 2, text: first}, {from: (c.start + c.end) / 2, to: c.end, text: then}];

// Drag a card toward the mirror, lean on the membrane, push through, then on to `to`.
async function across(ctx, card, to, {lean = .7, ...options} = {}) {
  const m = await ctx.mirror(), vertical = ctx.portrait;
  const edge = vertical ? {x: card.x, y: m.y - card.h * .55} : {x: m.x - card.w * .55, y: card.y};
  const through = vertical ? {x: card.x, y: m.y + card.h * .75} : {x: m.x + card.w * .75, y: card.y};
  return ctx.drag(card, to, {via: [edge, through], pause: lean, duration: 2.4, ...options});
}

export const tutorials = {
  'base-ten': {
    title: 'Base ten: why ten cards make one',
    async script(ctx) {
      await ctx.load('3');
      await opening(ctx, {cards: 9, title: 'Base ten', subtitle: 'Why ten cards make one'},
        'Welcome to Abacus: an abacus for the touch screen. In this lesson: base ten, and why ten cards always become one.');
      await ctx.chip('Place value');
      await say(ctx, 'Every number here is built from cards. This is three: three blue cards, sitting in a tray.');
      const three = await ctx.term('3');
      await ctx.labels(three.id, ['ones']);
      await say(ctx, 'A tray has nine spaces, so one tray holds at most nine cards. This first tray counts ones.', .6);
      await ctx.labels(null);

      await ctx.cut(() => ctx.load('7+1+1+1'));
      let line = await ctx.say("Let's add cards one at a time. Touch a one, and drag it onto the seven.");
      await line.word('touch');
      await ctx.drag(() => ctx.term('1'), () => ctx.term('7'), {duration: 1.3, lift: 30});
      await ctx.idle({rate: .7}); await line.done();
      await say(ctx, 'Eight.', .2);
      line = await ctx.say('Another one makes nine.');
      await ctx.drag(() => ctx.term('1'), () => ctx.term('8'), {duration: 1.1, lift: 30});
      await ctx.idle({rate: .7}); await line.done();
      await say(ctx, 'Now the tray is full. All nine spaces are taken.', .5);
      await say(ctx, 'So what happens when one more card arrives?', .3);
      let t = timeline(9, 1), [carry] = t.of('carry');
      let released = await ctx.drag(() => ctx.term('1'), () => ctx.term('9'), {duration: 1.2, lift: 30, after: .5});
      await story(ctx, released, [
        {from: carry.start, text: "There's no room for a tenth card, so it waits on the edge of the full tray."},
        ...carrySteps(carry, 'Now all ten cards squeeze together into a single stack...', '...and the stack slides one tray to the left, into the tens tray.'),
      ]);
      const ten = await ctx.term('10');
      await ctx.labels(ten.id, ['tens', 'ones']);
      await say(ctx, "One card in the tens tray, and nothing left in the ones tray. That's why we write ten as a one, then a zero.", .6);
      await ctx.labels(null);
      await say(ctx, "Is that one card really ten cards? Let's tilt the camera.", .1);
      await ctx.setCamera('spread'); await ctx.hold(.5);
      await say(ctx, 'There they are: ten cards, stacked into one. Every card in the tens tray is worth ten.', .6);
      await ctx.setCamera('front');

      await ctx.cut(() => ctx.load('99+1'));
      await ctx.labels((await ctx.term('99')).id, ['tens', 'ones']);
      await say(ctx, 'The same thing happens in every tray. This is ninety-nine: nine tens and nine ones. Both trays are full.', .4);
      await ctx.labels(null);
      await say(ctx, "Let's add just one more card.", .1);
      t = timeline(99, 1); const [ones, tens] = t.of('carry');
      released = await ctx.drag(() => ctx.term('1'), () => ctx.term('99'), {duration: 1.3, lift: 30, after: .5});
      await story(ctx, released, [
        ...carrySteps(ones, 'The ones tray overflows. Ten ones stack into one ten...', '...and it slides into the tens tray.'),
        {from: tens.start, text: 'But now the tens tray has ten stacks, one too many!'},
        ...carrySteps(tens, 'So ten tens stack up too, into one hundred...', '...and move one more tray to the left.'),
      ]);
      await ctx.labels((await ctx.term('100')).id, ['hundreds', 'tens', 'ones']);
      await say(ctx, 'One hundred: one card in the hundreds tray, and zeros in the tens and the ones.', .4);
      await ctx.labels(null);
      await ctx.setCamera('spread'); await ctx.hold(.4);
      await say(ctx, 'And that one hundred card? It is a stack of ten tens: a hundred cards in all.', .6);
      await ctx.setCamera('front');
      await say(ctx, 'That is base ten. Each tray is worth ten of the tray to its right: ones, tens, hundreds, thousands.');
      await say(ctx, 'And whenever ten cards meet in one tray, they stack into a single card, one tray to the left.', .5);

      await ctx.chip('');
      line = await ctx.say('Try it yourself. Tap Tutor, then choose: Ten makes a stack.');
      await line.word('tutor');
      await ctx.tap(() => ctx.element('#open-tutor'));
      await line.word('choose');
      await ctx.tap(() => ctx.eval(`(()=>{const b=[...document.querySelectorAll('#lessons button')].find(b=>b.textContent.includes('Ten makes a stack'));b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`));
      await line.done(1.2);
      await closing(ctx, {cards: 1, title: 'Up next: carrying and borrowing'}, 'Next time: carrying and borrowing.');
    },
  },

  'carry-borrow': {
    title: 'Adding and subtracting: carry and borrow',
    async script(ctx) {
      await ctx.load('47+25');
      await opening(ctx, {cards: 9, title: 'Carry and borrow', subtitle: 'Adding and subtracting with cards'},
        'In this lesson: adding and subtracting on Abacus, and what carrying and borrowing really mean.');
      await ctx.chip('Carrying');
      await say(ctx, "Let's add forty-seven and twenty-five. Each number keeps its tens and its ones in separate trays.", .3);
      let line = await ctx.say('Touch twenty-five, and drop it onto forty-seven.');
      await line.word('touch');
      let t = timeline(47, 25), [carry] = t.of('carry');
      let released = await ctx.drag(() => ctx.term('25'), () => ctx.term('47'), {duration: 1.4, lift: 40, after: .5});
      await line.done(.1);
      await story(ctx, released, [
        {from: 0, to: carry.start, text: 'The cards join tray by tray: ones with ones, tens with tens.'},
        {from: carry.start, text: 'Seven ones and five ones make twelve. That is more than a tray can hold.'},
        ...carrySteps(carry, 'So ten of them stack into one ten...', '...and carry over to the tens tray. Two ones stay behind.'),
      ]);
      await say(ctx, 'Tens: four, plus two, plus the one we carried, make seven. Forty-seven plus twenty-five is seventy-two.', .6);

      await ctx.cut(() => ctx.load('58+67'));
      await say(ctx, 'Sometimes both trays overflow. Fifty-eight plus sixty-seven.', .1);
      t = timeline(58, 67); const [ones, tens] = t.of('carry');
      released = await ctx.drag(() => ctx.term('67'), () => ctx.term('58'), {duration: 1.4, lift: 40, after: .5});
      await story(ctx, released, [
        {from: 0, to: ones.start, text: 'Eight ones and seven ones make fifteen.'},
        ...carrySteps(ones, 'Ten ones stack into a ten...', '...and carry left, leaving five.'),
        {from: ones.end, to: tens.start, text: 'Five tens, six tens and the carried ten make twelve tens.'},
        ...carrySteps(tens, 'Ten tens stack into one hundred...', '...and carry into a new tray on the left.'),
      ]);
      await ctx.labels((await ctx.term('125')).id, ['hundreds', 'tens', 'ones']);
      await say(ctx, 'One hundred twenty-five. Carrying is simply ten cards stacking into one.', .6);
      await ctx.labels(null);

      await ctx.chip('Subtracting');
      await ctx.cut(() => ctx.load('9-4'));
      await say(ctx, 'Subtraction uses red cards. Red cards are negative: minus four is four red cards.', .3);
      await say(ctx, 'A red card and a blue card cancel each other out. Together they make zero: a zero pair.', .2);
      t = timeline(9, -4);
      line = await ctx.say('Drag the red four onto the nine.');
      released = await ctx.drag(() => ctx.term('-4'), () => ctx.term('9'), {duration: 1.3, lift: 40, after: .5});
      await line.done(0);
      const pairs = t.of('neutralize');
      await story(ctx, released, [{from: pairs[0].start, to: pairs.at(-1).end, text: 'Four zero pairs vanish... and five blue cards are left.'}]);
      await say(ctx, 'Nine minus four is five.', .5);

      await ctx.chip('Borrowing');
      await ctx.cut(() => ctx.load('52-17'));
      await ctx.labels((await ctx.term('52')).id, ['tens', 'ones']);
      await say(ctx, 'Now fifty-two minus seventeen. Look at the ones: seven red cards, but only two blue ones.', .2);
      await ctx.labels(null);
      t = timeline(52, -17); let [borrow] = t.of('borrow');
      line = await ctx.say("There aren't enough partners. Watch what happens.");
      released = await ctx.drag(() => ctx.term('-17'), () => ctx.term('52'), {duration: 1.4, lift: 40, after: .5});
      await line.done(0);
      await story(ctx, released, [
        {from: 0, to: borrow.start, text: 'The pairs that can cancel, do.'},
        {from: borrow.start, to: borrow.end, text: 'Then we borrow: one ten unstacks into ten ones, one tray to the right.'},
        {from: borrow.end, to: t.total, text: 'Now every red card has a partner.'},
      ]);
      await say(ctx, 'Three tens and five ones: fifty-two minus seventeen is thirty-five.', .6);

      await ctx.cut(() => ctx.load('503-78'));
      await say(ctx, 'What if the next tray is empty? Five hundred three, minus seventy-eight. There are no tens to borrow.', .2);
      t = timeline(503, -78); const borrows = t.of('borrow');
      released = await ctx.drag(() => ctx.term('-78'), () => ctx.term('503'), {duration: 1.4, lift: 40, after: .5});
      await story(ctx, released, [
        {from: 0, to: borrows[0].start, text: 'The three blue ones cancel three red ones first.'},
        {from: borrows[0].start, to: borrows[0].end, text: 'So a hundred unstacks into ten tens...'},
        {from: borrows[0].end, to: borrows[1].end, text: '...and one of those tens unstacks into ten ones.'},
        {from: borrows[1].end, to: t.total, text: 'Then the rest of the pairs cancel.'},
      ]);
      await ctx.labels((await ctx.term('425')).id, ['hundreds', 'tens', 'ones']);
      await say(ctx, 'Four hundred twenty-five.', .5);
      await ctx.labels(null);
      await ctx.chip('');
      await say(ctx, 'Carrying and borrowing are one idea, running in two directions.');
      await say(ctx, 'Ten cards stack into one, a tray to the left. One card unstacks into ten, a tray to the right.', .5);
      await closing(ctx, {cards: 9, kind: 'x', title: 'Up next: solving for x'}, 'Practice both in the Tutor, under Adding. Next time: solving for x.');
    },
  },

  'solving-for-x': {
    title: 'Solving for x: get the green X alone',
    async script(ctx) {
      await ctx.load('x+3=7');
      await opening(ctx, {cards: 9, kind: 'x', title: 'Solving for x', subtitle: 'Move the pieces until the green X is alone'},
        'An equation is a balance. Solving it means moving pieces from one side to the other, until the green X is all by itself.');
      await ctx.chip('Across the mirror');
      await say(ctx, 'Here is x plus three equals seven. The equals sign in the middle is a mirror: both sides are worth the same.', .2);
      await say(ctx, 'The green X is our mystery number. To get it alone, the three has to go.', .2);
      const seven = await ctx.term('7');
      const beside = ctx.portrait ? {x: seven.x + seven.w * 1.05, y: seven.y + 8} : {x: seven.x + seven.w * 1.3, y: seven.y + 10};
      let line = await ctx.say('Drag the three toward the mirror. Feel it push back? Keep pushing...');
      await ctx.hold(.6);
      await across(ctx, await ctx.term('3'), beside, {lean: 1.6, settle: .8});
      await ctx.idle({rate: .6}); await line.done(.2);
      await say(ctx, 'It went through, and it flipped: the blue three became a red negative three. Crossing the mirror always flips a card, and that keeps both sides balanced.', .3);
      await say(ctx, 'Now x equals seven minus three.', .2);
      let t = timeline(7, -3), pairs = t.of('neutralize');
      line = await ctx.say('Drop the red three onto the seven.');
      let released = await ctx.drag(() => ctx.term('-3'), () => ctx.term('7'), {duration: 1.3, lift: 40, after: .5});
      await line.done(0);
      await story(ctx, released, [{from: pairs[0].start, to: pairs.at(-1).end, text: 'Three zero pairs cancel, leaving four.'}]);
      await say(ctx, 'The green X is alone. x equals four. Solved!', .6);

      await ctx.chip('Equal groups');
      await ctx.cut(() => ctx.load('3x+7=22'));
      await say(ctx, 'A harder one: three x plus seven equals twenty-two. Three green X cards, and a seven in the way.', .2);
      t = timeline(22, -7); const [borrow] = t.of('borrow');
      line = await ctx.say('Move the seven across the mirror, straight onto the twenty-two.');
      released = await across(ctx, await ctx.term('7'), () => ctx.term('22'), {lean: .5, settle: .4, after: .5});
      await line.done(0);
      await story(ctx, released, [
        {from: 0, to: borrow.start, text: 'It flips to negative seven as it crosses. Two pairs cancel...'},
        {from: borrow.start, to: borrow.end, text: '...then a ten unstacks, so the other red cards have partners.'},
        {from: borrow.end, to: t.total, text: 'Twenty-two minus seven is fifteen.'},
      ]);
      await say(ctx, 'Now three x equals fifteen. The last step: split both sides into three equal groups.', .1);
      line = await ctx.say('Tap solve, and Abacus deals each side into three groups.');
      await line.word('solve');
      await ctx.tap(() => ctx.element('#solve'));
      await ctx.idle({rate: .5}); await line.done(.3);
      await say(ctx, 'Each group has one x, and five. So x equals five.', .6);

      await ctx.chip('x on both sides');
      await ctx.cut(() => ctx.load('3x+1=x+9'));
      await say(ctx, 'x can show up on both sides, too. Three x plus one equals x plus nine.', .2);
      line = await ctx.say('Move the x from the right across the mirror, onto the three x.');
      await ctx.hold(.4);
      await across(ctx, await ctx.term('x'), () => ctx.term('3x'), {lean: .5, settle: .4});
      await ctx.idle({rate: .5}); await line.done(.2);
      await say(ctx, 'It flipped to negative x, and cancelled one of the three. Two x are left.', .2);
      line = await ctx.say('Now move the one across, onto the nine.');
      await ctx.hold(.3);
      await across(ctx, await ctx.term('1'), () => ctx.term('9'), {lean: .4, settle: .4});
      await ctx.idle({rate: .5}); await line.done(.2);
      await say(ctx, 'Nine minus one is eight. Two x equals eight.', .1);
      line = await ctx.say('Tap solve to split both sides into two equal groups.');
      await line.word('solve');
      await ctx.tap(() => ctx.element('#solve'));
      await ctx.idle({rate: .5}); await line.done(.3);
      await say(ctx, 'x equals four. The green X stands alone.', .6);
      await ctx.chip('');
      await say(ctx, 'Every move keeps the balance. Cross the mirror and flip the sign, cancel zero pairs, and split into equal groups, until the green X is all by itself.', .5);
      await closing(ctx, {cards: 9, kind: 'x', title: 'Practice in the Tutor', subtitle: 'Moving cards · Solving'}, 'Find more equations to solve in the Tutor. Have fun!');
    },
  },
};
