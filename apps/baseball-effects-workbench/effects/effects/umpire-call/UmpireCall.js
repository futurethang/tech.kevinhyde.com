/**
 * UmpireCall — Comic-book style umpire pops in from the edge of the screen.
 *
 * This is the first complete effect and serves as the reference implementation
 * for the EffectBase pattern. Study this to understand how to build new effects.
 *
 * Channels used: Visual (GSAP DOM animation), Audio (ZzFX placeholder), Haptic
 */
import gsap from 'gsap';
import { EffectBase } from '../../core/EffectBase.js';
import { EASINGS, DURATIONS } from '../../core/presets/easings.js';

export class UmpireCall extends EffectBase {
  static id = 'umpire-call';
  static name = 'Umpire Call';
  static description = 'Angry umpire pops in from corner with comic-book call';
  static triggers = ['strikeout-looking', 'out-at-first', 'out-at-second', 'caught-stealing'];

  static assets = {
    lotties: [],  // No Lottie yet — pure GSAP + DOM for now
    sounds: { umpireCall: 'umpireCall', hitImpact: 'hitImpact' },
  };

  static params = {
    enterFrom: { type: 'select', options: ['right', 'left', 'bottom'], default: 'right' },
    intensity: { type: 'range', min: 0.3, max: 2.0, step: 0.1, default: 1.0 },
    callText: { type: 'text', default: "YER OUT!" },
    holdDuration: { type: 'range', min: 400, max: 3000, step: 100, default: 1200, unit: 'ms' },
  };

  async play(container, params = {}) {
    this._startTime = performance.now();
    const { enterFrom, intensity, callText, holdDuration } = this.resolveParams(params);

    // --- Create DOM elements ---
    const overlay = this.createOverlay(container);

    // Umpire character (placeholder — colored div with emoji)
    const umpire = this.createElement('div', 'umpire-character', overlay, {
      position: 'absolute',
      bottom: enterFrom === 'bottom' ? '0' : '10%',
      [enterFrom === 'left' ? 'left' : 'right']: enterFrom === 'bottom' ? '50%' : '0',
      transform: enterFrom === 'bottom' ? 'translateX(-50%)' : 'none',
      width: '120px',
      height: '160px',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '60px',
      border: '3px solid #e94560',
      boxShadow: '0 0 30px rgba(233, 69, 96, 0.4)',
    });
    umpire.innerHTML = `
      <div style="font-size:60px;line-height:1">😤</div>
      <div style="font-size:10px;font-weight:bold;color:#e94560;margin-top:4px;letter-spacing:1px">UMPIRE</div>
    `;

    // Speech bubble
    const bubble = this.createElement('div', 'call-bubble', overlay, {
      position: 'absolute',
      top: '15%',
      left: '50%',
      transform: 'translate(-50%, 0)',
      background: '#fff',
      color: '#1a1a2e',
      padding: '12px 20px',
      borderRadius: '16px',
      fontSize: `${Math.min(24, 16 + intensity * 4)}px`,
      fontWeight: '900',
      fontStyle: 'italic',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      border: '3px solid #e94560',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      fontFamily: 'Impact, "Arial Black", sans-serif',
      letterSpacing: '2px',
    });
    bubble.textContent = callText;

    // Impact lines (comic book speed lines)
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const line = this.createElement('div', 'impact-line', overlay, {
        position: 'absolute',
        top: `${20 + i * 10}%`,
        left: enterFrom === 'right' ? '0' : 'auto',
        right: enterFrom === 'left' ? '0' : 'auto',
        width: `${30 + Math.random() * 40}%`,
        height: '2px',
        background: `rgba(233, 69, 96, ${0.3 + Math.random() * 0.4})`,
        transformOrigin: enterFrom === 'right' ? 'left center' : 'right center',
      });
      lines.push(line);
    }

    // --- Build the timeline ---
    const tl = gsap.timeline({
      onComplete: () => this.cleanup(overlay),
    });

    const enterDuration = DURATIONS.fast * (1 / intensity);
    const isRight = enterFrom === 'right';
    const isBottom = enterFrom === 'bottom';

    // 1. Umpire slides in
    tl.from(umpire, {
      x: isBottom ? 0 : (isRight ? '200%' : '-200%'),
      y: isBottom ? '200%' : 0,
      rotation: isBottom ? 0 : (isRight ? 20 : -20),
      duration: enterDuration,
      ease: EASINGS.popIn,
    });

    // 2. Sound + haptic on entrance
    tl.call(() => {
      this.playSound('umpireCall');
      this.haptic('umpireStamp');
    }, null, `-=${enterDuration * 0.3}`);

    // 3. Speech bubble stamps in
    tl.from(bubble, {
      scale: 0,
      rotation: isRight ? -10 : 10,
      duration: DURATIONS.micro,
      ease: EASINGS.popInHard,
    }, `-=${DURATIONS.micro}`);

    // 4. Screen shake on stamp
    tl.call(() => {
      this.shake(container, 6 * intensity, 0.25);
      this.playSound('hitImpact');
    });

    // 5. Impact lines shoot in
    lines.forEach((line, i) => {
      tl.from(line, {
        scaleX: 0,
        duration: 0.1,
        ease: 'power2.out',
      }, `-=${0.2 - i * 0.02}`);
    });

    // 6. Hold
    tl.to({}, { duration: holdDuration / 1000 });

    // 7. Umpire and bubble exit
    tl.to([umpire, bubble, ...lines], {
      opacity: 0,
      y: '-=20',
      duration: DURATIONS.normal,
      ease: EASINGS.exitFast,
      stagger: 0.03,
    });

    return tl;
  }
}
