/**
 * Named haptic patterns for game events.
 *
 * These map game moments to vibration patterns.
 * Pattern format: [vibrate_ms, pause_ms, vibrate_ms, pause_ms, ...]
 *
 * Design principle: the more common the action, the subtler the haptic.
 * A tap on every button. A thump on every swing. Full celebration only on home runs.
 */

export const HAPTIC_PATTERNS = {
  // --- Common / every-action ---
  uiTap: [30],
  uiPress: [15],

  // --- Per-at-bat ---
  swingContact: [60],
  swingPowerTick: [12],   // One tick per power level during pull-back
  swingRelease: [80],

  // --- Game events ---
  strikeCall: [60, 40, 100],
  outCall: [80],
  walk: [30],

  // --- Big moments ---
  homeRun: [50, 30, 50, 30, 100, 50, 50, 30, 80],
  doublePlay: [40, 30, 40],
  triplePlay: [40, 20, 40, 20, 60],
  victory: [60, 40, 60, 40, 100, 60, 60, 40, 120, 80, 80],

  // --- Umpire ---
  umpireStamp: [100],
  umpireSlideIn: [30, 20, 60],
};
