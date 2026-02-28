/**
 * AudioManager — Wraps Howler.js for game sound management.
 *
 * Features:
 * - Audio sprite support (one file, many sounds)
 * - Global mute toggle
 * - ZzFX integration for instant placeholder sounds during prototyping
 * - Preload management
 *
 * Usage:
 *   const audio = new AudioManager();
 *   audio.loadSprite('/audio/game-sfx.webm', { batCrack: [0, 800], crowdRoar: [1000, 3000] });
 *   audio.play('batCrack');
 */
import { Howl, Howler } from 'howler';

// ============================================================
// ZzFX — Tiny procedural sound generator (inline, ~1KB)
// Credit: Frank Force (KilledByAPixel) — MIT License
// Use for instant placeholder SFX during prototyping.
// Replace with produced audio (Howler sprites) for production.
// ============================================================
const zzfxV = 0.3; // volume
function zzfx(...args) {
  const params = args[0] instanceof Array ? args[0] : args;
  const sampleRate = 44100;
  const PI2 = Math.PI * 2;

  let [volume = 1, randomness = 0.05, frequency = 220, attack = 0, sustain = 0,
    release = 0.1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0,
    pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0,
    bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0
  ] = params;

  let length = 0 | ((attack + sustain + release + delay) * sampleRate);
  if (!length) length = sampleRate * 0.1;
  const buffer = new Float32Array(length);
  let f = 0, t = 0, tm = 0, j = 1, r = 0, c = 0, s = 0, d = 1;

  volume *= zzfxV;
  frequency *= (1 + randomness * (Math.random() * 2 - 1));

  for (let i = 0; i < length; i++) {
    const T = i / sampleRate;

    // Envelope
    let env;
    if (T < attack) env = T / attack;
    else if (T < attack + sustain) env = 1 - (1 - sustainVolume) * ((T - attack) / sustain);
    else if (T < attack + sustain + release) env = sustainVolume * (1 - (T - attack - sustain) / release);
    else env = 0;

    // Frequency
    f = frequency * (1 + slide * T + deltaSlide * T * T);
    if (pitchJump && T > pitchJumpTime) { f += pitchJump; pitchJump = 0; }

    // Oscillator
    t += f / sampleRate;
    tm += modulation / sampleRate;

    let sample;
    if (shape === 0) sample = Math.sin(t * PI2);
    else if (shape === 1) sample = Math.sin(t * PI2) > 0 ? 1 : -1;
    else if (shape === 2) sample = (t % 1) * 2 - 1;
    else sample = Math.random() * 2 - 1;

    // Noise
    if (noise) sample += noise * (Math.random() * 2 - 1);

    // Tremolo
    if (tremolo) sample *= 1 - tremolo + tremolo * Math.sin(PI2 * T * 10);

    // Bit crush
    if (bitCrush) sample = Math.round(sample * bitCrush) / bitCrush;

    buffer[i] = sample * env * volume;
  }

  // Play the buffer
  const ctx = Howler.ctx || new (window.AudioContext || window.webkitAudioContext)();
  const buf = ctx.createBuffer(1, length, sampleRate);
  buf.copyToChannel(buffer, 0);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.connect(ctx.destination);
  source.start();
  return source;
}

// ============================================================
// Preset ZzFX sounds for prototyping — tweak these to taste!
// Generate your own at https://killedbyapixel.github.io/ZzFX/
// ============================================================
const ZZFX_PRESETS = {
  batCrack:       [1.5, , 400, .02, .08, .2, 2, 2.5, , , , , , , , , , .6, .02],
  crowdRoar:      [.4, , 200, .1, .5, .5, 3, .5, , , , , , 1, , , , .8, .3],
  umpireCall:     [1.2, , 300, .01, .1, .15, 0, 1.5, , , , , , , , , , .5, .02],
  whoosh:         [.5, , 600, .02, .05, .1, 3, 2, -200, , , , , , , , , .3, .01],
  pop:            [1, , 800, , .03, .05, 0, 2, , , , , , , , , , .7, .01],
  click:          [.8, , 1200, , .02, .01, 0, 3, , , , , , , , , , .5],
  hitImpact:      [2, , 150, .01, .05, .3, 4, 1.5, , , , , , 1, , , , .8, .05],
  cheer:          [.3, , 250, .05, .4, .4, 3, .3, , , , , , .8, , , , .6, .2],
  mechanicalFlip: [.6, , 500, , .03, .08, 2, 3, 50, , , , , , , , , .4, .01],
  tension:        [.3, , 100, .1, .3, .2, 1, 0.5, 10, , , , , , , , , .2, .05],
};

export class AudioManager {
  constructor() {
    this.sprites = {};   // Howl instances keyed by sprite name
    this.muted = false;
    this.useZzfx = true; // Default to ZzFX for prototyping
  }

  /**
   * Load a Howler audio sprite.
   * Call this when you have produced audio files ready.
   */
  loadSprite(name, srcs, spriteMap) {
    this.sprites[name] = new Howl({
      src: srcs,
      sprite: spriteMap,
      preload: true,
    });
  }

  /**
   * Play a sound by key.
   * If in ZzFX mode (prototyping), plays a procedural sound.
   * If Howler sprites are loaded, plays from sprite.
   */
  play(key, spriteName = 'game') {
    if (this.muted) return;

    // Try Howler sprite first
    if (this.sprites[spriteName]) {
      this.sprites[spriteName].play(key);
      return;
    }

    // Fall back to ZzFX placeholder
    if (this.useZzfx && ZZFX_PRESETS[key]) {
      zzfx(ZZFX_PRESETS[key]);
      return;
    }

    console.warn(`AudioManager: no sound found for "${key}"`);
  }

  /**
   * Toggle global mute
   */
  toggleMute() {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    return this.muted;
  }

  /**
   * Set global volume (0.0 - 1.0)
   */
  setVolume(vol) {
    Howler.volume(vol);
  }

  /**
   * Get the list of available ZzFX placeholder sound names
   */
  get availablePlaceholders() {
    return Object.keys(ZZFX_PRESETS);
  }
}
