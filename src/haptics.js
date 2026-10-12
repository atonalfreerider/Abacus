// Haptic feedback. In the native apps Capacitor's Haptics plugin drives the Taptic Engine
// (iOS) or the vibration motor's effects (Android); in a browser, the Vibration API where
// it exists. Every call is best effort: no motor, no permission, no harm.
// kind: 'tick' (a detent or snap), 'thud' (a collision or a card popping through the
// mirror), 'pop' (a zero pair cancelling), 'peek' (a firm press opened a preview),
// 'success' (a problem solved).
const native = () => {
  const cap = globalThis.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Haptics || (cap.registerPlugin ? (cap.Plugins.Haptics = cap.registerPlugin('Haptics')) : null);
};
const vibrate = { tick: 6, thud: 18, pop: 10, peek: [0, 12], success: [0, 20, 60, 30] };
let last = 0;
export function haptic(kind = 'tick') {
  const now = Date.now();
  if (kind === 'pop' && now - last < 45) return; // a ripple of pairs reads as a texture, not a buzz
  last = now;
  try {
    const plugin = native();
    if (plugin) {
      if (kind === 'success') plugin.notification({ type: 'SUCCESS' });
      else if (kind === 'tick') plugin.selectionChanged ? (plugin.selectionStart?.(), plugin.selectionChanged(), plugin.selectionEnd?.()) : plugin.impact({ style: 'LIGHT' });
      else plugin.impact({ style: kind === 'thud' ? 'HEAVY' : kind === 'peek' ? 'MEDIUM' : 'LIGHT' });
      return;
    }
    globalThis.navigator?.vibrate?.(vibrate[kind] ?? 8);
  } catch {}
}
