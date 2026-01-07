import { useEffect } from 'react';
import type { TimerState } from '../types/workout';
import './Timer.css';

interface TimerProps {
  state: TimerState;
  onTogglePause: () => void;
  onSkipToRest: () => void;
  onSkipRest: () => void;
  onReset: () => void;
  onAdjustTime: (seconds: number) => void;
}

export function Timer({
  state,
  onTogglePause,
  onSkipToRest,
  onSkipRest,
  onReset,
  onAdjustTime,
}: TimerProps) {
  const { phase, currentSet, totalSets, secondsRemaining, isPaused } = state;

  // Format seconds as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine background class based on phase
  const getPhaseClass = (): string => {
    if (phase === 'active') return 'timer--active';
    if (phase === 'rest') return 'timer--rest';
    if (phase === 'complete') return 'timer--complete';
    return 'timer--idle';
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase !== 'idle' && phase !== 'complete') {
          onTogglePause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, onTogglePause]);

  if (phase === 'idle') {
    return (
      <div className={`timer ${getPhaseClass()}`}>
        <div className="timer__display">
          <span className="timer__time">0:00</span>
        </div>
        <p className="timer__status">Ready to start</p>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className={`timer ${getPhaseClass()}`}>
        <div className="timer__display">
          <span className="timer__time timer__time--complete">DONE</span>
        </div>
        <p className="timer__status">All sets complete!</p>
        <div className="timer__sets">
          {totalSets} / {totalSets} sets
        </div>
        <button className="timer__btn timer__btn--secondary" onClick={onReset}>
          Reset
        </button>
      </div>
    );
  }

  return (
    <div className={`timer ${getPhaseClass()}`}>
      <div className="timer__phase-label">
        {phase === 'active' ? 'ACTIVE' : 'REST'}
      </div>

      <div className="timer__display">
        <button
          className="timer__adjust timer__adjust--minus"
          onClick={() => onAdjustTime(-10)}
          aria-label="Subtract 10 seconds"
        >
          -10
        </button>
        <span className="timer__time">{formatTime(secondsRemaining)}</span>
        <button
          className="timer__adjust timer__adjust--plus"
          onClick={() => onAdjustTime(10)}
          aria-label="Add 10 seconds"
        >
          +10
        </button>
      </div>

      <div className="timer__sets">
        Set {currentSet} of {totalSets}
      </div>

      <div className="timer__controls">
        <button
          className="timer__btn timer__btn--primary"
          onClick={onTogglePause}
          aria-label={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? '▶ PLAY' : '⏸ PAUSE'}
        </button>

        {phase === 'active' && (
          <button
            className="timer__btn timer__btn--skip"
            onClick={onSkipToRest}
            aria-label="Skip to rest"
          >
            DONE → REST
          </button>
        )}

        {phase === 'rest' && (
          <button
            className="timer__btn timer__btn--skip"
            onClick={onSkipRest}
            aria-label="Skip rest"
          >
            SKIP REST →
          </button>
        )}
      </div>

      <button className="timer__btn timer__btn--cancel" onClick={onReset}>
        Cancel
      </button>
    </div>
  );
}
