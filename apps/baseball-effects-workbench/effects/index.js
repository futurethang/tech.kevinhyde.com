/**
 * Effects Library — Public API
 *
 * This is what your main app imports:
 *   import { GameEffects, Jumbotron } from './effects';
 */

// Core orchestrator
export { GameEffects } from './core/GameEffects.js';

// Individual effects
export { UmpireCall } from './effects/umpire-call/UmpireCall.js';
export { BatSwing } from './effects/bat-swing/BatSwing.js';

// Jumbotron system
export { Jumbotron } from './effects/jumbotron/Jumbotron.js';
export { DotMatrixDisplay } from './effects/jumbotron/core/DotMatrixDisplay.js';
export { ScoreboardScreen } from './effects/jumbotron/screens/Scoreboard.js';

// Core utilities (for creating new effects)
export { EffectBase } from './core/EffectBase.js';
export { AudioManager } from './core/AudioManager.js';
export { HapticManager } from './core/HapticManager.js';
export { EASINGS, DURATIONS } from './core/presets/easings.js';
export { HAPTIC_PATTERNS } from './core/presets/haptics.js';
