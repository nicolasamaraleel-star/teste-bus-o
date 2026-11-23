export type SpecialVibrationKind = 'sound' | 'health' | 'slam' | 'bagSpin' | 'rage';

let lastVibrationTime = 0;
let lastVibrationPriority = 0;

function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const hasTouch = (navigator.maxTouchPoints ?? 0) > 0;
  const compactViewport = window.innerWidth <= 1024;
  return hasCoarsePointer || hasTouch || compactViewport;
}

function triggerPattern(pattern: number | number[], priority: number, minGapMs = 36) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  if (!isMobileOrTabletDevice()) {
    return;
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastVibrationTime < minGapMs && priority <= lastVibrationPriority) {
    return;
  }

  lastVibrationTime = now;
  lastVibrationPriority = priority;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore vibration errors in restricted browsers or frames
  }
}

export function vibrateHit(strong = false) {
  if (strong) {
    triggerPattern([26, 16, 36], 2, 42);
  } else {
    triggerPattern(18, 1, 34);
  }
}

export function vibrateDamage(blocked = false) {
  if (blocked) {
    triggerPattern([16, 12, 22], 2, 45);
  } else {
    triggerPattern([55, 25, 45], 3, 60);
  }
}

export function vibrateSpecial(kind: SpecialVibrationKind = 'health') {
  switch (kind) {
    case 'sound':
      triggerPattern([35, 20, 55, 20, 75], 4, 80);
      break;
    case 'slam':
      triggerPattern([45, 20, 65], 4, 70);
      break;
    case 'rage':
      triggerPattern([40, 22, 40, 22, 65], 4, 80);
      break;
    case 'bagSpin':
      triggerPattern([24, 16, 38], 3, 55);
      break;
    case 'health':
    default:
      triggerPattern([30, 18, 45], 3, 60);
      break;
  }
}

export function vibrateGameOver() {
  triggerPattern([95, 35, 95, 35, 130], 5, 120);
}
