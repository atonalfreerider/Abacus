import { lessons, matches, normalizeInput, describe } from './lessons.js';

const $ = id => document.getElementById(id);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let player, ready = false, pending = false, lesson = null, stepIndex = 0, mode = 'intro', latest, finishedAt = 0;
const call = (name, ...args) => player.ruffle().callExternalInterface(`abacus${name}`, ...args);
const notice = message => { $('notice').textContent = message; $('notice').hidden = !message; };
function stopDirector() { lesson = null; $('director').hidden = true; $('tools').hidden = false; }
function controls() {
  for (const id of ['watch', 'try', 'next', 'replay', 'close-director']) $(id).disabled = pending;
  $('open-equation').disabled = $('open-director').disabled = pending;
  $('equation-space').inert = pending;
}
async function settled(timeout = 60000) {
  const end = Date.now() + timeout;
  // Tween timelines may be scheduled on the following frame.
  await delay(250);
  let still = 0;
  while (Date.now() < end) {
    const state = call('State');
    if (state && !state.dragging && state.busy === 0) { if (++still >= 3) return state; } else still = 0;
    await delay(150);
  }
  throw Error('The original animation is taking longer than expected. Let it finish, then restart the step.');
}
async function loadEquation(text) {
  const input = normalizeInput(text);
  call('Clear');
  for (const character of input) call('Input', character === '.' ? 'decimal' : character);
  await settled();
}
async function work(action) {
  if (pending) return;
  pending = true; notice(''); controls();
  try { await action(); }
  catch (error) { notice(error.message); }
  finally { pending = false; controls(); }
}
function drawDirector() {
  const step = lesson.steps[stepIndex];
  $('lesson-title').textContent = `${lesson.title} · ${stepIndex + 1} / ${lesson.steps.length}`;
  $('prompt').textContent = step.prompt;
  $('watch').hidden = false; $('watch').textContent = 'Watch';
  $('try').hidden = Boolean(step.watchOnly);
  $('next').hidden = true;
}
async function startLesson(selected) {
  lesson = selected; stepIndex = 0; mode = 'intro';
  $('lesson-dialog').close(); $('tools').hidden = true; $('director').hidden = false;
  drawDirector(); await loadEquation(lesson.steps[0].before);
}
async function resetStep() {
  mode = 'intro'; drawDirector(); await loadEquation(lesson.steps[stepIndex].before);
}
function completeStep(practice) {
  mode = 'complete'; finishedAt = Date.now();
  const last = stepIndex === lesson.steps.length - 1;
  $('prompt').textContent = practice ? (last ? lesson.complete : 'That step is complete. Continue to the next one.') : (last ? `${lesson.complete} Try it yourself.` : 'Now try that same step yourself.');
  $('watch').textContent = 'Replay';
  $('next').textContent = last ? 'Finish' : 'Next';
  $('next').hidden = false;
}
$('watch').onclick = () => work(async () => {
  await resetStep(); mode = 'watching';
  const [action, ...args] = lesson.steps[stepIndex].action;
  call(action === 'move' ? 'Move' : action === 'combine' ? 'Combine' : 'Step', ...args);
  const state = await settled();
  if (!matches(state, lesson.steps[stepIndex].expected)) throw Error('The SWF did not reach the expected result. Restart the step to try again.');
  completeStep(false);
});
$('try').onclick = () => work(async () => {
  await resetStep(); mode = 'practice';
  $('prompt').textContent = `Your turn: ${lesson.steps[stepIndex].prompt}`;
  $('watch').textContent = 'Show me';
});
$('replay').onclick = () => work(resetStep);
$('next').onclick = () => work(async () => {
  if (++stepIndex >= lesson.steps.length) { stopDirector(); return; }
  await resetStep();
});
$('close-director').onclick = () => { if (!pending) stopDirector(); };
$('open-equation').onclick = () => { $('input-error').textContent = ''; $('equation-dialog').showModal(); $('equation-input').select(); };
$('open-director').onclick = () => $('lesson-dialog').showModal();
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => button.closest('dialog').close();
$('equation-form').onsubmit = event => {
  event.preventDefault();
  let text;
  try { text = normalizeInput($('equation-input').value); } catch (error) { $('input-error').textContent = error.message; return; }
  $('equation-dialog').close(); stopDirector(); work(() => loadEquation(text));
};
for (const item of lessons) {
  const button = document.createElement('button');
  const title = document.createElement('span'), expression = document.createElement('small');
  title.textContent = item.title; expression.textContent = item.equation.replaceAll('*', ' × ');
  button.append(title, expression); button.onclick = () => work(() => startLesson(item)); $('lessons').append(button);
}
// Keep dialog keystrokes out of the original SWF's stage keyboard handler.
for (const dialog of document.querySelectorAll('dialog')) for (const type of ['keydown', 'keyup', 'keypress']) dialog.addEventListener(type, event => event.stopPropagation());

async function initialize() {
  const end = Date.now() + 30000;
  while (!window.RufflePlayer?.newest) { if (Date.now() > end) throw Error('The browser runtime could not load. Reload to try again.'); await delay(50); }
  player = window.RufflePlayer.newest().createPlayer();
  $('equation-space').append(player);
  await player.ruffle().load({ url: new URL('../abacus-director.swf', import.meta.url).href, allowScriptAccess: true, allowNetworking: 'all' });
  const bridgeEnd = Date.now() + 30000;
  while (call('Ping') !== 'bridge-ready') { if (Date.now() > bridgeEnd) throw Error('The ABACUS director bridge did not start.'); await delay(100); }
  ready = true; $('loading').hidden = true; $('tools').hidden = false;
  setInterval(() => {
    if (!ready) return;
    try {
      latest = call('State');
      if (!latest) return;
      $('equation-description').textContent = describe(latest);
      if (!pending && lesson && ['practice', 'intro'].includes(mode) && matches(latest, lesson.steps[stepIndex].expected)) completeStep(true);
      if (!pending && lesson && mode === 'complete' && Date.now() - finishedAt > 1500 && !latest.busy && !latest.dragging && !matches(latest, lesson.steps[stepIndex].expected)) {
        mode = 'practice'; $('next').hidden = true; $('prompt').textContent = `Your turn: ${lesson.steps[stepIndex].prompt}`;
      }
    } catch { /* A drop can briefly rebuild the SWF display list. */ }
  }, 250);
}
initialize().catch(error => { $('loading').textContent = error.message; });
