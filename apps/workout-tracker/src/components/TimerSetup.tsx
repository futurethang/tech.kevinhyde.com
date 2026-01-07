import { useState, useEffect } from 'react';
import type { Exercise } from '../types/workout';
import './TimerSetup.css';

interface TimerSetupProps {
  exercise?: Exercise;
  defaultActiveSeconds: number;
  defaultRestSeconds: number;
  onStart: (sets: number, activeSeconds: number, restSeconds: number) => void;
  onCancel: () => void;
}

export function TimerSetup({
  exercise,
  defaultActiveSeconds,
  defaultRestSeconds,
  onStart,
  onCancel,
}: TimerSetupProps) {
  const [sets, setSets] = useState(exercise?.sets ?? 3);
  const [activeSeconds, setActiveSeconds] = useState(
    exercise?.activeSeconds ?? defaultActiveSeconds
  );
  const [restSeconds, setRestSeconds] = useState(
    exercise?.restSeconds ?? defaultRestSeconds
  );

  // Update values when exercise changes
  useEffect(() => {
    if (exercise) {
      setSets(exercise.sets);
      if (exercise.activeSeconds) setActiveSeconds(exercise.activeSeconds);
      if (exercise.restSeconds) setRestSeconds(exercise.restSeconds);
    }
  }, [exercise]);

  const handleStart = () => {
    onStart(sets, activeSeconds, restSeconds);
  };

  // Time presets
  const activePresets = [30, 45, 60, 90];
  const restPresets = [30, 45, 60, 90, 120];

  return (
    <div className="timer-setup">
      <h2 className="timer-setup__title">
        {exercise ? exercise.name : 'Timer Setup'}
      </h2>

      {exercise?.tips && (
        <p className="timer-setup__tips">{exercise.tips}</p>
      )}

      <div className="timer-setup__field">
        <label className="timer-setup__label">Sets</label>
        <div className="timer-setup__stepper">
          <button
            className="timer-setup__stepper-btn"
            onClick={() => setSets((s) => Math.max(1, s - 1))}
            aria-label="Decrease sets"
          >
            −
          </button>
          <span className="timer-setup__stepper-value">{sets}</span>
          <button
            className="timer-setup__stepper-btn"
            onClick={() => setSets((s) => s + 1)}
            aria-label="Increase sets"
          >
            +
          </button>
        </div>
      </div>

      <div className="timer-setup__field">
        <label className="timer-setup__label">Active Time</label>
        <div className="timer-setup__presets">
          {activePresets.map((sec) => (
            <button
              key={sec}
              className={`timer-setup__preset ${activeSeconds === sec ? 'timer-setup__preset--active' : ''}`}
              onClick={() => setActiveSeconds(sec)}
            >
              {sec}s
            </button>
          ))}
        </div>
        <div className="timer-setup__stepper">
          <button
            className="timer-setup__stepper-btn"
            onClick={() => setActiveSeconds((s) => Math.max(5, s - 5))}
          >
            −5
          </button>
          <span className="timer-setup__stepper-value">{activeSeconds}s</span>
          <button
            className="timer-setup__stepper-btn"
            onClick={() => setActiveSeconds((s) => s + 5)}
          >
            +5
          </button>
        </div>
      </div>

      <div className="timer-setup__field">
        <label className="timer-setup__label">Rest Time</label>
        <div className="timer-setup__presets">
          {restPresets.map((sec) => (
            <button
              key={sec}
              className={`timer-setup__preset ${restSeconds === sec ? 'timer-setup__preset--active' : ''}`}
              onClick={() => setRestSeconds(sec)}
            >
              {sec}s
            </button>
          ))}
        </div>
        <div className="timer-setup__stepper">
          <button
            className="timer-setup__stepper-btn"
            onClick={() => setRestSeconds((s) => Math.max(5, s - 5))}
          >
            −5
          </button>
          <span className="timer-setup__stepper-value">{restSeconds}s</span>
          <button
            className="timer-setup__stepper-btn"
            onClick={() => setRestSeconds((s) => s + 5)}
          >
            +5
          </button>
        </div>
      </div>

      <div className="timer-setup__actions">
        <button className="timer-setup__btn timer-setup__btn--start" onClick={handleStart}>
          Start Timer
        </button>
        <button className="timer-setup__btn timer-setup__btn--cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
