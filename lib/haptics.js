// Tiny haptic-feedback helper for mobile. No-op on devices without the API.
export function haptic(ms = 12) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {}
}
