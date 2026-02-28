/**
 * GameEffects — Central orchestrator service.
 *
 * This is the public API your main app imports.
 * It manages the registry of effects, preloads assets,
 * and provides a simple play() interface.
 *
 * Usage:
 *   import { GameEffects } from '../effects';
 *   await GameEffects.init();
 *   GameEffects.play('umpire-call', container, { callText: 'YER OUT!' });
 */
import { AudioManager } from './AudioManager.js';
import { HapticManager } from './HapticManager.js';

class GameEffectsService {
  constructor() {
    this.audio = new AudioManager();
    this.haptics = new HapticManager();
    this.registry = new Map();   // effectId -> EffectClass
    this.instances = new Map();  // effectId -> instantiated effect
    this.initialized = false;

    // Global enable/disable toggles (for settings screen)
    this.enabled = {
      animations: true,
      sound: true,
      haptics: true,
    };

    // Reduced motion preference
    this.prefersReducedMotion = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  }

  /**
   * Register an effect class with the system.
   * Call this for each effect during app setup.
   */
  register(EffectClass) {
    const id = EffectClass.id;
    this.registry.set(id, EffectClass);
    return this;
  }

  /**
   * Initialize all registered effects.
   * Creates instances with shared managers.
   */
  async init() {
    for (const [id, EffectClass] of this.registry) {
      const instance = new EffectClass({
        audioManager: this.audio,
        hapticManager: this.haptics,
      });
      this.instances.set(id, instance);
    }
    this.initialized = true;
  }

  /**
   * Play an effect by ID.
   *
   * @param {string} effectId - The effect's static id
   * @param {HTMLElement} container - The DOM element to render into
   * @param {object} params - Override params for this play
   * @returns {Promise} Resolves when the effect completes
   */
  async play(effectId, container, params = {}) {
    if (!this.enabled.animations && !params._force) {
      return; // Animations globally disabled
    }

    // Reduced motion: skip non-essential effects
    if (this.prefersReducedMotion && !params._essential) {
      return;
    }

    const instance = this.instances.get(effectId);
    if (!instance) {
      console.warn(`GameEffects: no effect registered with id "${effectId}"`);
      return;
    }

    // Temporarily disable sound/haptics if globally toggled off
    const audioWasMuted = this.audio.muted;
    const hapticsWereEnabled = this.haptics.enabled;

    if (!this.enabled.sound) this.audio.muted = true;
    if (!this.enabled.haptics) this.haptics.enabled = false;

    try {
      const result = await instance.play(container, params);
      return result;
    } finally {
      // Restore state
      this.audio.muted = audioWasMuted;
      this.haptics.enabled = hapticsWereEnabled;
    }
  }

  /**
   * Get metadata for all registered effects (for workbench UI)
   */
  getEffectList() {
    return Array.from(this.registry.entries()).map(([id, EffectClass]) => ({
      id,
      name: EffectClass.displayName || EffectClass.name,
      description: EffectClass.description,
      triggers: EffectClass.triggers,
      params: EffectClass.params,
    }));
  }

  /**
   * Get a specific effect instance (for workbench direct access)
   */
  getEffect(id) {
    return this.instances.get(id);
  }

  /**
   * Toggle sound/haptics/animations
   */
  toggle(channel) {
    if (channel === 'sound') {
      this.enabled.sound = !this.enabled.sound;
      this.audio.muted = !this.enabled.sound;
    } else if (channel === 'haptics') {
      this.enabled.haptics = !this.enabled.haptics;
      this.haptics.enabled = this.enabled.haptics;
    } else if (channel === 'animations') {
      this.enabled.animations = !this.enabled.animations;
    }
    return this.enabled;
  }
}

// Singleton export
export const GameEffects = new GameEffectsService();
