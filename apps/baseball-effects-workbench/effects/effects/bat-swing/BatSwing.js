/**
 * BatSwing — Interactive bat swing with pull-back gesture, power meter, and impact.
 *
 * This is the most complex effect because it's gesture-driven (not just a
 * fire-and-forget animation). In the workbench, gesture input is simulated
 * via the `power` slider and `autoSwing` toggle.
 *
 * Channels used: Visual (GSAP + DOM), Audio (ZzFX), Haptic
 *
 * Interaction flow:
 *   1. Idle: bat rests at a slight angle with breathing animation
 *   2. Pull-back: user drags to charge power (or slider in workbench)
 *   3. Release: bat swings forward, impact burst plays
 *   4. Result: brief dramatic pause, then done (main app shows result)
 */
import gsap from 'gsap';
import { EffectBase } from '../../core/EffectBase.js';
import { EASINGS, DURATIONS } from '../../core/presets/easings.js';

export class BatSwing extends EffectBase {
  static id = 'bat-swing';
  static name = 'Bat Swing';
  static description = 'Interactive bat pull-back and swing with power scaling';
  static triggers = ['at-bat', 'dice-roll'];

  static assets = {
    lotties: [],
    sounds: {
      tension: 'tension',
      whoosh: 'whoosh',
      batCrack: 'batCrack',
      hitImpact: 'hitImpact',
    },
  };

  static params = {
    power: { type: 'range', min: 0.1, max: 1.0, step: 0.05, default: 0.7 },
    autoSwing: { type: 'toggle', default: true },
    resultDelay: { type: 'range', min: 100, max: 500, step: 50, default: 200, unit: 'ms' },
    showDebug: { type: 'toggle', default: false },
  };

  async play(container, params = {}) {
    this._startTime = performance.now();
    const { power, autoSwing, resultDelay, showDebug } = this.resolveParams(params);

    const overlay = this.createOverlay(container);

    // --- Bat element ---
    const batContainer = this.createElement('div', 'bat-container', overlay, {
      position: 'absolute',
      bottom: '20%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '60px',
      height: '200px',
      transformOrigin: 'center bottom',
    });

    // Bat body (handle + barrel)
    const bat = this.createElement('div', 'bat', batContainer, {
      position: 'absolute',
      bottom: '0',
      left: '50%',
      transform: 'translateX(-50%) rotate(-15deg)',
      width: '16px',
      height: '160px',
      background: 'linear-gradient(to top, #8B4513 0%, #A0522D 40%, #D2691E 60%, #DEB887 80%, #DEB887 100%)',
      borderRadius: '8px 8px 20px 20px',
      transformOrigin: 'center bottom',
      boxShadow: '2px 2px 8px rgba(0,0,0,0.3)',
    });

    // Barrel (wider top part)
    this.createElement('div', 'barrel', bat, {
      position: 'absolute',
      top: '0',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '28px',
      height: '60px',
      background: 'linear-gradient(to top, #D2691E, #DEB887)',
      borderRadius: '14px 14px 8px 8px',
    });

    // --- Power meter ---
    const meterBg = this.createElement('div', 'meter-bg', overlay, {
      position: 'absolute',
      left: '10%',
      bottom: '15%',
      width: '8px',
      height: '50%',
      background: '#222',
      borderRadius: '4px',
      border: '1px solid #444',
      overflow: 'hidden',
    });

    const meterFill = this.createElement('div', 'meter-fill', meterBg, {
      position: 'absolute',
      bottom: '0',
      width: '100%',
      height: '0%',
      borderRadius: '4px',
      transition: 'background 0.1s',
    });

    // --- Impact burst element (hidden until contact) ---
    const burst = this.createElement('div', 'impact-burst', overlay, {
      position: 'absolute',
      top: '25%',
      left: '50%',
      transform: 'translate(-50%, -50%) scale(0)',
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,255,200,0.9) 0%, rgba(255,200,50,0.6) 40%, transparent 70%)',
      pointerEvents: 'none',
    });

    // --- Starburst lines around impact ---
    const starbursts = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 360;
      const line = this.createElement('div', 'starburst', overlay, {
        position: 'absolute',
        top: '25%',
        left: '50%',
        width: '3px',
        height: '20px',
        background: '#FFD700',
        transformOrigin: 'center top',
        transform: `translate(-50%, 0) rotate(${angle}deg)`,
        opacity: '0',
        borderRadius: '2px',
      });
      starbursts.push(line);
    }

    // --- Debug overlay ---
    let debugEl;
    if (showDebug) {
      debugEl = this.createElement('div', 'debug', overlay, {
        position: 'absolute',
        top: '4px',
        left: '4px',
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#4ade80',
        background: 'rgba(0,0,0,0.7)',
        padding: '4px 8px',
        borderRadius: '4px',
      });
    }

    // ============================================================
    // ANIMATION SEQUENCE
    // ============================================================

    const tl = gsap.timeline({
      onComplete: () => this.cleanup(overlay),
    });

    // Phase 1: Idle breathing (subtle scale oscillation)
    tl.to(bat, {
      rotation: -13,
      duration: 0.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 1,
    });

    // Phase 2: Pull-back (power charge)
    const pullBackAngle = -15 - (power * 60); // More power = more rotation
    const pullDuration = 0.3 + (1 - power) * 0.3; // Faster at high power

    tl.to(bat, {
      rotation: pullBackAngle,
      duration: pullDuration,
      ease: 'power1.in',
    });

    // Power meter fills during pull-back
    tl.to(meterFill, {
      height: `${power * 100}%`,
      background: power > 0.7 ? '#ef4444' : power > 0.4 ? '#eab308' : '#22c55e',
      duration: pullDuration,
      ease: 'power1.in',
    }, '<');

    // Haptic ticks during charge
    tl.call(() => {
      this.haptic('ratchetTick');
      this.playSound('tension');
      if (debugEl) debugEl.textContent = `Power: ${(power * 100).toFixed(0)}%`;
    });

    // Phase 3: SWING!
    const swingDuration = 0.15 + (1 - power) * 0.1; // Faster at high power
    const swingAngle = 90 + power * 30;

    tl.to(bat, {
      rotation: swingAngle,
      duration: swingDuration,
      ease: 'power4.in',
    });

    // Whoosh sound at start of swing
    tl.call(() => {
      this.playSound('whoosh');
    }, null, '<');

    // Phase 4: IMPACT
    tl.call(() => {
      this.playSound('batCrack');
      this.haptic(power > 0.7 ? 'heavyImpact' : 'impact');
      if (debugEl) debugEl.textContent = `CONTACT! Power: ${(power * 100).toFixed(0)}%`;
    });

    // Impact burst scales in
    tl.to(burst, {
      scale: 1 + power,
      opacity: 1,
      duration: 0.1,
      ease: EASINGS.impactSnap,
    });

    // Starburst lines shoot out
    starbursts.forEach((line, i) => {
      const dist = 30 + power * 40;
      const angle = (i / 8) * Math.PI * 2;
      tl.to(line, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        opacity: 1,
        scaleY: 1.5 + power,
        duration: 0.15,
        ease: 'power2.out',
      }, '<');
    });

    // Screen shake scaled to power
    tl.call(() => {
      this.shake(container, 4 + power * 8, 0.2);
    });

    // Burst fades
    tl.to(burst, {
      scale: 2 + power,
      opacity: 0,
      duration: 0.3,
      ease: 'power1.out',
    }, '+=0.05');

    // Starbursts fade
    tl.to(starbursts, {
      opacity: 0,
      duration: 0.2,
      stagger: 0.02,
    }, '<');

    // Power meter drains
    tl.to(meterFill, {
      height: '0%',
      duration: 0.2,
    }, '<');

    // Phase 5: Dramatic pause before result
    tl.to({}, { duration: resultDelay / 1000 });

    // Phase 6: Clean exit
    tl.to([batContainer, meterBg], {
      opacity: 0,
      duration: 0.2,
    });

    return tl;
  }
}
