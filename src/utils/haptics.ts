/**
 * Haptic feedback utility using Web Vibration API for tactile response on mobile devices.
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export function triggerHaptic(type: HapticType = 'light') {
  if (typeof window === 'undefined' || !navigator || !('vibrate' in navigator)) {
    return;
  }

  try {
    switch (type) {
      case 'selection':
        // Ultra subtle tick (e.g. tab switches, category select)
        navigator.vibrate(8);
        break;
      case 'light':
        // Crisp light tap (e.g. quantity increment, favorite toggle)
        navigator.vibrate(15);
        break;
      case 'medium':
        // Definite click (e.g. add to cart, open modal/drawer)
        navigator.vibrate(25);
        break;
      case 'heavy':
        // Firm pulse (e.g. remove item, primary CTA)
        navigator.vibrate(40);
        break;
      case 'success':
        // Rhythmic success pulse (e.g. order placed, payment confirmed)
        navigator.vibrate([30, 40, 50]);
        break;
      case 'warning':
        // Warning double pulse
        navigator.vibrate([20, 60, 30]);
        break;
      case 'error':
        // Error pattern
        navigator.vibrate([40, 70, 40, 70, 40]);
        break;
      default:
        navigator.vibrate(15);
    }
  } catch (e) {
    // Vibration might be blocked by browser policy without active user gesture
  }
}
