// Store screenshots from the real Android app: a debug build on an emulator is driven
// through its WebView's DevTools socket and captured with adb at the sizes Google Play
// features (9:16 phones, 16:9 tablets).
//   node tools/store-screenshots.mjs [serial]      writes store/android/screenshots/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const serial = process.argv[2] || 'emulator-5554', out = 'store/android/screenshots';
const adb = (...args) => execFileSync('adb', ['-s', serial, ...args], { encoding: 'buffer', maxBuffer: 64 << 20 });
const sh = command => adb('shell', command).toString().trim();
const wait = ms => new Promise(r => setTimeout(r, ms));
const formats = [
  { name: 'phone', size: '1080x1920', density: 420 },
  { name: 'tablet-7in', size: '1920x1080', density: 280 },
  { name: 'tablet-10in', size: '2560x1440', density: 300 },
];
// Each scene puts the app in a state worth showing; the page is reloaded before each.
const scenes = {
  'equation': `(()=>{const i=document.getElementById('equation-input');i.value='345+278-199=x';document.getElementById('equation-form').requestSubmit();})()`,
  'pemdas': `(()=>{document.getElementById('open-tutor').click();[...document.querySelectorAll('#lessons button')].find(b=>b.textContent.includes('All of PEMDAS')).click();})()`,
  // Mid-step: the caption over the cards as parentheses are worked out first.
  'pemdas-step': `(async()=>{document.getElementById('open-tutor').click();[...document.querySelectorAll('#lessons button')].find(b=>b.textContent.includes('Parentheses first')).click();await new Promise(r=>setTimeout(r,800));document.getElementById('tutor-step').click();await new Promise(r=>setTimeout(r,120));document.getElementById('pause').click();const p=document.getElementById('progress');p.value='0.8';p.dispatchEvent(new Event('input'));})()`,
  'graph-intercept': `(async()=>{document.getElementById('open-graph').click();await new Promise(r=>setTimeout(r,900));const s=document.getElementById('graph-examples');s.value='2';s.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,400));[...document.querySelectorAll('#graph-points button')].find(b=>b.textContent.includes('(0, 4)')).click();})()`,
  'graph-cards': `(async()=>{document.getElementById('open-graph').click();await new Promise(r=>setTimeout(r,900));const st=document.getElementById('graph-stage');st.focus();for(let i=0;i<9;i++)st.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));})()`,
  'lessons': `document.getElementById('open-tutor').click()`,
};

async function devtools() {
  const pid = sh('pidof com.metavirtuoso.abacus');
  execFileSync('adb', ['-s', serial, 'forward', 'tcp:9333', `localabstract:webview_devtools_remote_${pid}`]);
  for (let i = 0; i < 20; i++) { try { const [page] = (await (await fetch('http://127.0.0.1:9333/json')).json()).filter(t => t.type === 'page'); if (page) return page.webSocketDebuggerUrl; } catch {} await wait(500); }
  throw Error('No WebView DevTools page: install a debug build.');
}
async function connect(url) {
  const socket = new WebSocket(url); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map();
  socket.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); socket.send(JSON.stringify({ id: n, method, params })); });
  return { send, eval: async expression => { const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (m.result?.exceptionDetails) throw Error(JSON.stringify(m.result.exceptionDetails)); return m.result?.result?.value; }, close: () => socket.close() };
}

fs.mkdirSync(out, { recursive: true });
// A tidy status bar: 9:00, full battery and signal, no notifications.
sh('settings put global sysui_demo_allowed 1');
for (const cmd of ['enter', 'clock -e hhmm 0900', 'battery -e level 100 -e plugged false', 'network -e wifi show -e level 4 -e fully true', 'network -e mobile hide', 'notifications -e visible false'])
  sh(`am broadcast -a com.android.systemui.demo -e command ${cmd.split(' ')[0]} ${cmd.split(' ').slice(1).join(' ')}`);
try {
  for (const format of formats) {
    sh(`wm size ${format.size}`); sh(`wm density ${format.density}`); sh('settings put system accelerometer_rotation 0');
    sh('settings put system user_rotation 0'); // wm size sets the shape
    sh('am force-stop com.metavirtuoso.abacus'); sh('am start -W -n com.metavirtuoso.abacus/.MainActivity'); await wait(4000);
    const page = await connect(await devtools());
    for (const [name, script] of Object.entries(scenes)) {
      await page.eval(`location.href='https://localhost/?examples=written'`).catch(() => {}); await wait(2500);
      await page.eval(script); await wait(name.startsWith('graph') ? 3000 : 1800);
      fs.writeFileSync(`${out}/${format.name}-${name}.png`, adb('exec-out', 'screencap', '-p'));
      console.log(`${format.name}-${name}.png`);
    }
    page.close();
  }
} finally {
  sh('wm size reset'); sh('wm density reset'); sh('settings put system user_rotation 0');
  sh('am broadcast -a com.android.systemui.demo -e command exit');
}
