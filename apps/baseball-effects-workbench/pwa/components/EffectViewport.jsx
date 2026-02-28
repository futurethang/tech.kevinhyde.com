import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameEffects } from '@effects/core/GameEffects.js';

export function EffectViewport({ effectId, onDismiss }) {
  const viewportRef = useRef(null);
  const touchStartY = useRef(null);
  const [status, setStatus] = useState('playing'); // 'playing' | 'ready'

  const playEffect = useCallback(async () => {
    if (!viewportRef.current) return;
    setStatus('playing');
    try {
      await GameEffects.play(effectId, viewportRef.current, {});
    } catch (e) {
      console.error('Effect error:', e);
    }
    setStatus('ready');
  }, [effectId]);

  useEffect(() => {
    playEffect();
  }, [playEffect]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;

    // Swipe down to dismiss (> 80px)
    if (deltaY > 80) {
      onDismiss();
      return;
    }

    // Tap to replay (small movement)
    if (Math.abs(deltaY) < 15 && status === 'ready') {
      playEffect();
    }
  };

  // Also support mouse click for desktop testing
  const handleClick = () => {
    if (status === 'ready') {
      playEffect();
    }
  };

  return (
    <div
      style={styles.overlay}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div ref={viewportRef} style={styles.viewport} />

      {/* Hints */}
      <div style={styles.hints}>
        {status === 'ready' && (
          <>
            <div style={styles.hint}>Tap to replay</div>
            <div style={styles.hint}>Swipe down to close</div>
          </>
        )}
        {status === 'playing' && (
          <div style={styles.hint}>Playing...</div>
        )}
      </div>

      {/* Close button */}
      <button style={styles.closeBtn} onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
        &#10005;
      </button>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: '#1a472a',
    display: 'flex',
    flexDirection: 'column',
  },
  viewport: {
    position: 'relative',
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  hints: {
    position: 'absolute',
    bottom: 'max(24px, env(safe-area-inset-bottom))',
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    pointerEvents: 'none',
  },
  hint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 500,
  },
  closeBtn: {
    position: 'absolute',
    top: 'max(12px, env(safe-area-inset-top))',
    right: 12,
    background: 'rgba(0,0,0,0.4)',
    border: 'none',
    borderRadius: '50%',
    width: 36,
    height: 36,
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
};
