/**
 * HapticManager — Vibration API wrapper with named patterns.
 *
 * Android-only (iOS PWAs have no haptic API).
 * Designed to be a no-op when vibration isn't available, so you can
 * call it unconditionally without feature-detection boilerplate.
 */

const PATTERNS = {
  tap:          [40],
  doubleTap:    [40, 30, 40],
  tripleTap:    [30, 20, 30, 20, 30],
  impact:       [80],
  heavyImpact:  [120],
  celebration:  [50, 30, 50, 30, 100, 50, 50, 30, 80],
  ratchetTick:  [15],
  strikeCall:   [60, 40, 100],
  error:        [100, 50, 100],
};

export class HapticManager {
  constructor() {
    this.enabled = true;
    this.supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  /**
   * Trigger a named haptic pattern or a custom vibration array.
   */
  trigger(patternOrName) {
    if (!this.enabled || !this.supported) return;

    if (typeof patternOrName === 'string') {
      const pattern = PATTERNS[patternOrName];
      if (pattern) {
        navigator.vibrate(pattern);
      } else {
        console.warn(`HapticManager: unknown pattern "${patternOrName}"`);
      }
    } else if (Array.isArray(patternOrName)) {
      navigator.vibrate(patternOrName);
    }
  }

  /**
   * Stop any active vibration
   */
  stop() {
    if (this.supported) {
      navigator.vibrate(0);
    }
  }

  /**
   * Toggle haptics on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stop();
    return this.enabled;
  }

  /**
   * Get list of named patterns (for workbench UI)
   */
  get patternNames() {
    return Object.keys(PATTERNS);
  }

  /**
   * Get a pattern definition by name (for workbench display)
   */
  getPattern(name) {
    return PATTERNS[name] || null;
  }
}
