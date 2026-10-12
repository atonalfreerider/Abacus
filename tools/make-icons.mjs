// App icons, splash screens and store graphics, drawn from the app's own tray and card
// stacks (src/mvc/view.js) on the original paper texture and rendered in headless Chrome.
//   node tools/make-icons.mjs        writes android/, ios/ and store/ images
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';
import { tray, stackContent } from '../src/mvc/view.js';

const texture = id => `data:image/jpeg;base64,${fs.readFileSync(`public/textures/swf-${id}.jpg`).toString('base64')}`;
const patterns = `<pattern id="blue" width="150" height="150" patternUnits="userSpaceOnUse"><image href="${texture(25)}" width="150" height="150"/></pattern>`
  + `<pattern id="paper" width="150" height="150" patternUnits="userSpaceOnUse"><image href="${texture(24)}" width="150" height="150"/></pattern>`
  + `<pattern id="paper-wide" width="1024" height="1024" patternUnits="userSpaceOnUse"><image href="${texture(24)}" width="1024" height="1024" preserveAspectRatio="xMidYMid slice"/></pattern>`;
const STACK = 'stack-blue-1-front';
// The mark: a tray of seven ten-card stacks, each showing its card-stock edges.
const mark = (x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 160})"><g transform="translate(5 5)">${tray(7, 'blue', 1, 'front', '')}</g></g>`;
const svg = (w, h, body, background = 'paper') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${patterns}<g id="${STACK}">${stackContent(STACK)}</g></defs>`
  + (background === 'paper' ? `<rect width="${w}" height="${h}" fill="#f3ead4"/><rect width="${w}" height="${h}" fill="url(#paper-wide)" opacity=".85"/>` : background === 'none' ? '' : `<rect width="${w}" height="${h}" fill="${background}"/>`)
  + body + '</svg>';

// Each image: [file, width, height, svg, transparent?]
const images = [];
const square = (file, size, { round = 0, scale = .72, background = 'paper', circle = false } = {}) => {
  const s = size * scale, inner = svg(size, size, mark((size - s) / 2, (size - s) / 2, s), background);
  const clip = circle ? `<clipPath id="c"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></clipPath>` : round ? `<clipPath id="c"><rect width="${size}" height="${size}" rx="${size * round}"/></clipPath>` : '';
  images.push([file, size, size, clip ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs>${clip}</defs><g clip-path="url(#c)">${inner}</g></svg>` : inner, background === 'none' || !!clip]);
};
const res = 'android/app/src/main/res';
for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  square(`${res}/mipmap-${density}/ic_launcher.png`, 48 * scale, { round: .18 });
  square(`${res}/mipmap-${density}/ic_launcher_round.png`, 48 * scale, { circle: true });
  // Adaptive foreground: 108 dp with the mark inside the 66 dp safe circle.
  square(`${res}/mipmap-${density}/ic_launcher_foreground.png`, 108 * scale, { scale: .5, background: 'none' });
  square(`${res}/mipmap-${density}/ic_launcher_background.png`, 108 * scale, { scale: 0 });
  // Android 12+ splash icon: 288 dp, mark within the central 192 dp circle.
  square(`${res}/drawable-${density}/splash_icon.png`, 288 * scale, { scale: .46, background: 'none' });
}
// Legacy splash images keep their generated sizes: the mark on the paper colour (a plain
// colour keeps these full-screen images small).
for (const dir of fs.readdirSync(res).filter(d => d.startsWith('drawable'))) {
  const file = `${res}/${dir}/splash.png`;
  if (!fs.existsSync(file)) continue;
  const b = fs.readFileSync(file), w = b.readUInt32BE(16), h = b.readUInt32BE(20), s = Math.min(w, h) * .34;
  images.push([file, w, h, svg(w, h, mark((w - s) / 2, (h - s) / 2, s), '#f7f0df'), false]);
}
// iOS: one 1024 icon (opaque), and the launch image.
square('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024);
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  images.push([`ios/App/App/Assets.xcassets/Splash.imageset/${name}`, 2732, 2732, svg(2732, 2732, mark(2732 / 2 - 360, 2732 / 2 - 360, 720), '#f7f0df'), false]);
// Google Play: 512 icon and the 1024 × 500 feature graphic.
square('store/android/icon-512.png', 512);
images.push(['store/android/feature-graphic.png', 1024, 500, svg(1024, 500, mark(70, 70, 360)
  + `<text x="480" y="225" font-family="Georgia,serif" font-size="96" fill="#5f5b4e">Abacus</text><text x="484" y="290" font-family="Georgia,serif" font-size="30" fill="#7a7263">Always ask why. Understand math.</text><text x="484" y="350" font-family="Georgia,serif" font-size="24" fill="#7a7263">Numbers you can hold, from place value</text><text x="484" y="382" font-family="Georgia,serif" font-size="24" fill="#7a7263">to PEMDAS, solving for x and graphing.</text>`), false]);

const page = await launch('about:blank', { width: 1200, height: 1200 });
try {
  for (const [file, w, h, markup, transparent] of images) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: transparent ? 0 : 1 } });
    await page.eval(`(async()=>{document.open();document.write(${JSON.stringify(`<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`)});document.close();await Promise.all([...document.images].map(i=>i.decode?.().catch(()=>{})));await new Promise(r=>setTimeout(r,60));})()`);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 }, captureBeyondViewport: true });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  }
  console.log(`Wrote ${images.length} images.`);
} finally { await page.close(); }
