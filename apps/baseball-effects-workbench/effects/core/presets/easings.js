/**
 * Shared GSAP easing presets for the effects library.
 *
 * These encode the "game feel" language — when you tune an easing
 * in the workbench and like it, save it here so all effects share
 * the same personality.
 *
 * Naming convention: [feeling].[variant]
 * Import and use:  ease: EASINGS.popIn
 */

export const EASINGS = {
  // --- Entrances ---
  // Overshoot and settle — for things popping into view
  popIn: 'back.out(2)',
  popInHard: 'back.out(4)',
  popInSoft: 'back.out(1.2)',

  // Elastic bounce — for playful/celebratory reveals
  bounceIn: 'elastic.out(1, 0.4)',
  bounceInQuick: 'elastic.out(1, 0.6)',

  // Smooth slide — for UI elements entering
  slideIn: 'power3.out',

  // --- Exits ---
  // Quick pull-out
  exitFast: 'power2.in',
  exitSoft: 'power1.in',

  // --- Impacts ---
  // For screen shake, stamp effects
  impactSnap: 'power4.out',

  // --- Sustained motion ---
  // For things that move across the screen (ball arcs, slides)
  arcOut: 'power1.out',
  arcInOut: 'power2.inOut',

  // --- Score / counter ---
  // For number tick-ups and scale bounces on state change
  scoreBounce: 'back.out(3)',
  scorePop: 'back.out(5)',

  // --- Micro-interactions ---
  // Button press and release
  pressDown: 'power2.out',
  pressUp: 'back.out(1.5)',
};

/**
 * Common duration presets (in seconds)
 */
export const DURATIONS = {
  instant: 0.1,
  micro: 0.15,
  fast: 0.25,
  normal: 0.4,
  slow: 0.6,
  dramatic: 1.0,
  hold: 1.5,
};
