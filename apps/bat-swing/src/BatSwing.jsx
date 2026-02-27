import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * BatSwing - A pull-back-and-release interaction component.
 *
 * The user drags down (or clicks and drags) to "load" a baseball bat swing.
 * The bat visually cocks back, building tension. On release, the bat
 * swings through with explosive energy and triggers the onSwing callback.
 *
 * Props:
 *   onSwing(power: number) - called on release with power 0-1
 *   threshold - minimum pull ratio (0-1) required to trigger (default 0.3)
 *   disabled - disables interaction
 *   children - optional content to render inside the hit zone
 */

const PULL_MAX_PX = 200 // max drag distance in px
const SWING_DURATION_MS = 400
const RESET_DURATION_MS = 600

export default function BatSwing({
  onSwing,
  threshold = 0.3,
  disabled = false,
  children,
}) {
  const [pullRatio, setPullRatio] = useState(0) // 0..1
  const [phase, setPhase] = useState('idle') // idle | pulling | swinging | resetting
  const startY = useRef(null)
  const containerRef = useRef(null)
  const timeouts = useRef([])
  const lastTickRef = useRef(0)

  // Vibrate helper (progressive as tension builds)
  const vibrate = useCallback((ms) => {
    if (navigator.vibrate) navigator.vibrate(ms)
  }, [])

  // Safe setTimeout that gets cleaned up on unmount
  const safeTimeout = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timeouts.current.push(id)
    return id
  }, [])

  // --- Pointer handlers ---
  const handlePointerDown = useCallback(
    (e) => {
      if (disabled || phase !== 'idle') return
      e.preventDefault()
      startY.current = e.clientY
      lastTickRef.current = 0
      setPhase('pulling')
      setPullRatio(0)
      containerRef.current?.setPointerCapture(e.pointerId)
    },
    [disabled, phase],
  )

  const handlePointerMove = useCallback(
    (e) => {
      if (phase !== 'pulling' || startY.current === null) return
      e.preventDefault()
      const delta = Math.max(0, e.clientY - startY.current)
      const ratio = Math.min(1, delta / PULL_MAX_PX)
      setPullRatio(ratio)

      // Haptic ticks at 25%, 50%, 75%, 100%
      const newTick = Math.floor(ratio * 4)
      if (newTick > lastTickRef.current && newTick > 0) {
        vibrate(newTick * 15)
      }
      lastTickRef.current = newTick
    },
    [phase, vibrate],
  )

  const handlePointerUp = useCallback(
    (e) => {
      if (phase !== 'pulling') return
      e.preventDefault()
      startY.current = null
      lastTickRef.current = 0

      if (pullRatio >= threshold) {
        // Fire!
        setPhase('swinging')
        vibrate(80)

        safeTimeout(() => {
          onSwing?.(pullRatio)
          vibrate(150)
          setPhase('resetting')

          safeTimeout(() => {
            setPhase('idle')
            setPullRatio(0)
          }, RESET_DURATION_MS)
        }, SWING_DURATION_MS)
      } else {
        // Not enough pull - spring back
        setPhase('resetting')
        safeTimeout(() => {
          setPhase('idle')
          setPullRatio(0)
        }, RESET_DURATION_MS)
      }
    },
    [phase, pullRatio, threshold, vibrate, onSwing, safeTimeout],
  )

  const handlePointerCancel = useCallback(() => {
    startY.current = null
    lastTickRef.current = 0
    setPhase('resetting')
    safeTimeout(() => {
      setPhase('idle')
      setPullRatio(0)
    }, RESET_DURATION_MS)
  }, [safeTimeout])

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeouts.current.forEach(clearTimeout)
    }
  }, [])

  // --- Computed visual values ---
  // Bat rotation: idle = -45deg (resting on shoulder), pulled = -135deg (cocked back), swing = 90deg (follow-through)
  let batRotation
  let batTransition
  let batScale = 1

  if (phase === 'idle') {
    batRotation = -45
    batTransition = `transform ${RESET_DURATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`
  } else if (phase === 'pulling') {
    // -45 -> -155 as pull increases (cocking back)
    batRotation = -45 + pullRatio * -110
    batTransition = 'none'
    batScale = 1 + pullRatio * 0.08
  } else if (phase === 'swinging') {
    batRotation = 120 // full swing follow-through
    batTransition = `transform ${SWING_DURATION_MS}ms cubic-bezier(0.12, 0, 0.18, 1)`
    batScale = 1.12
  } else {
    // resetting
    batRotation = -45
    batTransition = `transform ${RESET_DURATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`
  }

  // Tension indicator ring
  const ringScale = phase === 'pulling' ? 1 + pullRatio * 0.4 : 1
  const ringOpacity = phase === 'pulling' ? 0.15 + pullRatio * 0.6 : 0

  // Pull indicator offset
  const pullOffset = phase === 'pulling' ? pullRatio * 30 : 0

  // Power color from green to orange to red
  const powerHue = phase === 'pulling' ? 120 - pullRatio * 120 : 120

  // Shaking when near max tension
  const shakeClass = phase === 'pulling' && pullRatio > 0.7 ? 'bat-swing-shake' : ''
  const shakeIntensity = phase === 'pulling' ? Math.max(0, (pullRatio - 0.7) / 0.3) : 0

  // Speed lines on swing
  const showSpeedLines = phase === 'swinging'

  // Impact flash
  const showFlash = phase === 'swinging'

  return (
    <div
      ref={containerRef}
      className={`bat-swing-container ${shakeClass} ${disabled ? 'bat-swing-disabled' : ''}`}
      style={{
        '--shake-intensity': `${shakeIntensity * 3}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Tension ring */}
      <div
        className="bat-swing-ring"
        style={{
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
          borderColor: `hsl(${powerHue}, 80%, 55%)`,
          boxShadow: `0 0 ${20 + pullRatio * 40}px hsl(${powerHue}, 80%, 55%, 0.4)`,
          transition: phase === 'pulling' ? 'none' : `all ${RESET_DURATION_MS}ms ease-out`,
        }}
      />

      {/* Speed lines */}
      {showSpeedLines && (
        <div className="bat-swing-speed-lines">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bat-swing-speed-line"
              style={{
                '--line-angle': `${-30 + i * 25}deg`,
                '--line-delay': `${i * 30}ms`,
              }}
            />
          ))}
        </div>
      )}

      {/* Impact flash */}
      {showFlash && <div className="bat-swing-flash" />}

      {/* The batter figure */}
      <div
        className="bat-swing-figure"
        style={{
          transform: `translateY(${pullOffset}px)`,
          transition: phase === 'pulling' ? 'none' : `transform ${RESET_DURATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}
      >
        {/* Batter body */}
        <div className="bat-swing-batter">
          {/* Head */}
          <div className="batter-head">
            <div className="batter-helmet" />
          </div>
          {/* Torso - rotates slightly with pull */}
          <div
            className="batter-torso"
            style={{
              transform: phase === 'pulling'
                ? `rotate(${pullRatio * -25}deg)`
                : phase === 'swinging'
                  ? 'rotate(35deg)'
                  : 'rotate(0deg)',
              transition: phase === 'pulling' ? 'none' : `transform ${phase === 'swinging' ? SWING_DURATION_MS : RESET_DURATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
            }}
          >
            {/* Arms + Bat */}
            <div
              className="batter-arms"
              style={{
                transform: `rotate(${batRotation}deg) scale(${batScale})`,
                transition: batTransition,
              }}
            >
              <div className="bat-handle" />
              <div className="bat-barrel" />
              <div className="bat-knob" />
            </div>
          </div>
          {/* Legs */}
          <div className="batter-legs">
            <div
              className="batter-leg batter-leg-front"
              style={{
                transform: phase === 'pulling'
                  ? `rotate(${pullRatio * 8}deg)`
                  : phase === 'swinging'
                    ? 'rotate(-15deg)'
                    : 'rotate(0deg)',
                transition: phase === 'pulling' ? 'none' : `transform ${SWING_DURATION_MS}ms ease-out`,
              }}
            />
            <div
              className="batter-leg batter-leg-back"
              style={{
                transform: phase === 'pulling'
                  ? `rotate(${pullRatio * -5}deg)`
                  : phase === 'swinging'
                    ? 'rotate(12deg)'
                    : 'rotate(0deg)',
                transition: phase === 'pulling' ? 'none' : `transform ${SWING_DURATION_MS}ms ease-out`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Pull instruction */}
      <div
        className="bat-swing-instruction"
        style={{
          opacity: phase === 'idle' ? 0.7 : 0,
          transform: `translateY(${phase === 'idle' ? 0 : 10}px)`,
        }}
      >
        Pull down to swing
      </div>

      {/* Power meter */}
      {phase === 'pulling' && (
        <div className="bat-swing-power-meter">
          <div className="bat-swing-power-label">POWER</div>
          <div className="bat-swing-power-bar-track">
            <div
              className="bat-swing-power-bar-fill"
              style={{
                width: `${pullRatio * 100}%`,
                backgroundColor: `hsl(${powerHue}, 80%, 55%)`,
                boxShadow: `0 0 10px hsl(${powerHue}, 80%, 55%, 0.6)`,
              }}
            />
          </div>
          <div
            className="bat-swing-power-value"
            style={{ color: `hsl(${powerHue}, 80%, 55%)` }}
          >
            {Math.round(pullRatio * 100)}%
          </div>
        </div>
      )}

      {/* Children (optional content in the hit zone) */}
      {children && <div className="bat-swing-content">{children}</div>}
    </div>
  )
}
