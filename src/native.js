// Native shell (Capacitor, Android and iOS). In a browser this module does nothing.
// The native runtime injects window.Capacitor; the plugin proxies come from the vendored
// @capacitor/core module, which the app build copies to vendor/capacitor/core.js.
// Home-screen quick actions (iOS, from a firm press or long press on the icon) and app
// shortcuts (Android, long press on the icon) open abacus://open/<place>.
const cap = globalThis.Capacitor;
export const isNative = !!cap?.isNativePlatform?.();

export async function initNative({ open, back }) {
  if (!isNative) return;
  const root = document.documentElement;
  root.classList.add('native', `platform-${cap.getPlatform()}`);
  let plugins;
  try {
    const { registerPlugin } = await import('../vendor/capacitor/core.js');
    plugins = Object.fromEntries(['App', 'Haptics', 'SplashScreen', 'StatusBar'].map(name => [name, registerPlugin(name)]));
    cap.Plugins.Haptics = plugins.Haptics;
  } catch (error) { console.error('Capacitor plugins unavailable', error); return; }
  const { App, SplashScreen, StatusBar } = plugins;
  const route = url => { const place = /^abacus:\/\/open\/([a-z-]+)/i.exec(url || '')?.[1]; if (place) open(place.toLowerCase()); };
  App.addListener('appUrlOpen', ({ url }) => route(url));
  try { route((await App.getLaunchUrl())?.url); } catch {}
  // Android back: close what is open, step out of a mode, and only then leave the app.
  App.addListener('backButton', () => { if (!back()) App.minimizeApp(); });
  try { await StatusBar.setStyle({ style: 'LIGHT' }); } catch {}
  // The splash also hides itself (capacitor.config.json), so a failure here never strands it.
  try { await SplashScreen.hide(); } catch {}
}
