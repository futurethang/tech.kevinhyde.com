/**
 * EffectBase — The base class all effects extend.
 *
 * Provides:
 * - Overlay creation and cleanup
 * - DOM element helpers
 * - Audio/haptic shorthand (delegated to managers)
 * - Screen shake primitive
 * - Lifecycle tracking (for workbench timing readout)
 */
import gsap from 'gsap';

export class EffectBase {
  // Subclasses override these
  static id = 'base';
  static name = 'Base Effect';
  static description = '';
  static triggers = [];
  static assets = { lotties: [], sounds: {} };
  static params = {};

  constructor({ audioManager, hapticManager, lottiePool } = {}) {
    this.audio = audioManager;
    this.haptics = hapticManager;
    this.lottiePool = lottiePool;
    this._startTime = 0;
    this._duration = 0;
  }

  /**
   * Get default param values from the static params definition
   */
  static get defaults() {
    const defaults = {};
    for (const [key, config] of Object.entries(this.params)) {
      defaults[key] = config.default;
    }
    return defaults;
  }

  /**
   * Merge user params with defaults
   */
  resolveParams(params = {}) {
    return { ...this.constructor.defaults, ...params };
  }

  /**
   * Create a full-screen overlay container for the effect.
   * Automatically positioned absolute within the target container.
   */
  createOverlay(container) {
    const overlay = document.createElement('div');
    overlay.className = 'effect-overlay';
    Object.assign(overlay.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none', // Never block input
      zIndex: '1000',
      overflow: 'hidden',
    });
    container.style.position = container.style.position || 'relative';
    container.appendChild(overlay);
    return overlay;
  }

  /**
   * Create a styled DOM element inside a parent
   */
  createElement(tag, className, parent, styles = {}) {
    const el = document.createElement(tag);
    el.className = className;
    Object.assign(el.style, styles);
    parent.appendChild(el);
    return el;
  }

  /**
   * Remove an overlay and all its children
   */
  cleanup(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    this._duration = performance.now() - this._startTime;
  }

  /**
   * Play a sound by key (delegates to AudioManager)
   */
  playSound(key) {
    if (this.audio) {
      this.audio.play(key);
    }
  }

  /**
   * Trigger a haptic pattern (delegates to HapticManager)
   */
  haptic(pattern) {
    if (this.haptics) {
      this.haptics.trigger(pattern);
    }
  }

  /**
   * Screen shake — a quick, decaying random translation on an element.
   * Returns the GSAP tween (can be awaited or added to a timeline).
   */
  shake(element, intensity = 5, duration = 0.3) {
    const tl = gsap.timeline();
    const steps = Math.floor(duration / 0.04);

    for (let i = 0; i < steps; i++) {
      const decay = 1 - (i / steps);
      const x = (Math.random() - 0.5) * 2 * intensity * decay;
      const y = (Math.random() - 0.5) * intensity * decay;
      tl.to(element, { x, y, duration: 0.04, ease: 'none' });
    }
    tl.to(element, { x: 0, y: 0, duration: 0.04 });

    return tl;
  }

  /**
   * The main entry point — subclasses MUST override this.
   * Should return a GSAP timeline or a Promise that resolves when the effect completes.
   */
  async play(container, params = {}) {
    this._startTime = performance.now();
    throw new Error(`${this.constructor.name} must implement play()`);
  }

  /**
   * How long the last play() took, in ms.
   */
  get lastDuration() {
    return this._duration;
  }
}
