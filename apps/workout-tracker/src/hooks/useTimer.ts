import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerState, TimerPhase } from '../types/workout';

interface UseTimerOptions {
  onSetComplete?: (setNumber: number) => void;
  onAllSetsComplete?: () => void;
  onPhaseChange?: (phase: TimerPhase) => void;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
}

export function useTimer(options: UseTimerOptions = {}) {
  const {
    onSetComplete,
    onAllSetsComplete,
    onPhaseChange,
    soundEnabled = true,
    vibrationEnabled = true,
  } = options;

  const [state, setState] = useState<TimerState>({
    phase: 'idle',
    currentSet: 0,
    totalSets: 0,
    secondsRemaining: 0,
    activeSeconds: 45,
    restSeconds: 60,
    isPaused: false,
  });

  const intervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context on first user interaction
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
  }, []);

  // Play a beep sound
  const playBeep = useCallback((frequency: number = 800, duration: number = 200) => {
    if (!soundEnabled || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  }, [soundEnabled]);

  // Vibrate device
  const vibrate = useCallback((pattern: number | number[]) => {
    if (!vibrationEnabled) return;
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, [vibrationEnabled]);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Main timer tick
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'complete' || state.isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setState((prev) => {
        if (prev.secondsRemaining <= 1) {
          // Time's up for this phase
          if (prev.phase === 'active') {
            // Active phase complete, move to rest (unless last set)
            playBeep(600, 300);
            vibrate([100, 50, 100]);
            onSetComplete?.(prev.currentSet);

            if (prev.currentSet >= prev.totalSets) {
              // All sets complete
              onAllSetsComplete?.();
              onPhaseChange?.('complete');
              return { ...prev, phase: 'complete', secondsRemaining: 0 };
            }

            // Move to rest phase
            onPhaseChange?.('rest');
            return {
              ...prev,
              phase: 'rest',
              secondsRemaining: prev.restSeconds,
            };
          } else if (prev.phase === 'rest') {
            // Rest phase complete, move to next active set
            playBeep(1000, 200);
            vibrate([200]);
            onPhaseChange?.('active');
            return {
              ...prev,
              phase: 'active',
              currentSet: prev.currentSet + 1,
              secondsRemaining: prev.activeSeconds,
            };
          }
        }

        // Countdown warning beeps at 3, 2, 1
        if (prev.secondsRemaining <= 4 && prev.secondsRemaining > 1) {
          playBeep(prev.phase === 'active' ? 400 : 600, 100);
        }

        return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.phase, state.isPaused, playBeep, vibrate, onSetComplete, onAllSetsComplete, onPhaseChange]);

  // Start the timer
  const start = useCallback((
    totalSets: number,
    activeSeconds: number,
    restSeconds: number
  ) => {
    initAudio();
    playBeep(1000, 150);
    vibrate(100);
    onPhaseChange?.('active');
    setState({
      phase: 'active',
      currentSet: 1,
      totalSets,
      secondsRemaining: activeSeconds,
      activeSeconds,
      restSeconds,
      isPaused: false,
    });
  }, [initAudio, playBeep, vibrate, onPhaseChange]);

  // Pause/resume
  const togglePause = useCallback(() => {
    setState((prev) => {
      if (prev.phase === 'idle' || prev.phase === 'complete') return prev;
      return { ...prev, isPaused: !prev.isPaused };
    });
  }, []);

  // Skip to rest (for rep-based exercises)
  const skipToRest = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'active') return prev;

      playBeep(600, 300);
      vibrate([100, 50, 100]);
      onSetComplete?.(prev.currentSet);

      if (prev.currentSet >= prev.totalSets) {
        onAllSetsComplete?.();
        onPhaseChange?.('complete');
        return { ...prev, phase: 'complete', secondsRemaining: 0 };
      }

      onPhaseChange?.('rest');
      return {
        ...prev,
        phase: 'rest',
        secondsRemaining: prev.restSeconds,
      };
    });
  }, [playBeep, vibrate, onSetComplete, onAllSetsComplete, onPhaseChange]);

  // Skip rest and start next set immediately
  const skipRest = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'rest') return prev;

      playBeep(1000, 200);
      vibrate([200]);
      onPhaseChange?.('active');
      return {
        ...prev,
        phase: 'active',
        currentSet: prev.currentSet + 1,
        secondsRemaining: prev.activeSeconds,
      };
    });
  }, [playBeep, vibrate, onPhaseChange]);

  // Reset timer
  const reset = useCallback(() => {
    setState({
      phase: 'idle',
      currentSet: 0,
      totalSets: 0,
      secondsRemaining: 0,
      activeSeconds: 45,
      restSeconds: 60,
      isPaused: false,
    });
  }, []);

  // Add or subtract time
  const adjustTime = useCallback((seconds: number) => {
    setState((prev) => ({
      ...prev,
      secondsRemaining: Math.max(0, prev.secondsRemaining + seconds),
    }));
  }, []);

  return {
    state,
    start,
    togglePause,
    skipToRest,
    skipRest,
    reset,
    adjustTime,
  };
}
