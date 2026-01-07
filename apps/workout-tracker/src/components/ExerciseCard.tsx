import { useState } from 'react';
import type { Exercise, SetLog } from '../types/workout';
import './ExerciseCard.css';

interface ExerciseCardProps {
  exercise: Exercise;
  exerciseIndex: number;
  isActive: boolean;
  isComplete: boolean;
  lastWeight?: number;
  setLogs: SetLog[];
  onStartTimer: (exercise: Exercise) => void;
  onUpdateWeight: (weight: number) => void;
  onUpdateSetLog: (setIndex: number, log: Partial<SetLog>) => void;
  onToggleComplete: () => void;
  weightUnit: 'lbs' | 'kg';
}

export function ExerciseCard({
  exercise,
  exerciseIndex,
  isActive,
  isComplete,
  lastWeight,
  setLogs,
  onStartTimer,
  onUpdateWeight,
  onUpdateSetLog: _onUpdateSetLog,
  onToggleComplete,
  weightUnit,
}: ExerciseCardProps) {
  // Note: _onUpdateSetLog is available for future use when we add manual set editing
  void _onUpdateSetLog;
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightValue, setWeightValue] = useState(lastWeight?.toString() ?? '');

  const handleWeightSubmit = () => {
    const weight = parseFloat(weightValue);
    if (!isNaN(weight) && weight > 0) {
      onUpdateWeight(weight);
      setShowWeightInput(false);
    }
  };

  const getTypeLabel = (type: Exercise['type']): string => {
    const labels: Record<Exercise['type'], string> = {
      weight: 'Weight',
      active_time: 'Timed',
      cardio: 'Cardio',
      bodyweight: 'Bodyweight',
      core: 'Core',
      stretch: 'Stretch',
    };
    return labels[type];
  };

  const getRepsDisplay = (): string => {
    if (exercise.activeSeconds) {
      return `${exercise.activeSeconds}s`;
    }
    if (exercise.reps) {
      return `${exercise.reps} reps`;
    }
    return '';
  };

  return (
    <div
      className={`exercise-card ${isActive ? 'exercise-card--active' : ''} ${isComplete ? 'exercise-card--complete' : ''}`}
    >
      <div className="exercise-card__header">
        <span className="exercise-card__number">{exerciseIndex + 1}</span>
        <div className="exercise-card__info">
          <h3 className="exercise-card__name">{exercise.name}</h3>
          <div className="exercise-card__meta">
            <span className="exercise-card__type">{getTypeLabel(exercise.type)}</span>
            <span className="exercise-card__sets">{exercise.sets} sets</span>
            {getRepsDisplay() && (
              <span className="exercise-card__reps">{getRepsDisplay()}</span>
            )}
          </div>
        </div>
        <button
          className={`exercise-card__check ${isComplete ? 'exercise-card__check--done' : ''}`}
          onClick={onToggleComplete}
          aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
        >
          {isComplete ? '✓' : '○'}
        </button>
      </div>

      {exercise.tips && (
        <p className="exercise-card__tips">{exercise.tips}</p>
      )}

      {(exercise.type === 'weight' || exercise.type === 'bodyweight') && (
        <div className="exercise-card__weight">
          {showWeightInput ? (
            <div className="exercise-card__weight-input">
              <input
                type="number"
                inputMode="decimal"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                placeholder="0"
                autoFocus
              />
              <span className="exercise-card__weight-unit">{weightUnit}</span>
              <button onClick={handleWeightSubmit}>Save</button>
              <button onClick={() => setShowWeightInput(false)}>Cancel</button>
            </div>
          ) : (
            <button
              className="exercise-card__weight-btn"
              onClick={() => {
                setWeightValue(lastWeight?.toString() ?? '');
                setShowWeightInput(true);
              }}
            >
              {lastWeight ? `${lastWeight} ${weightUnit}` : `Set weight`}
            </button>
          )}
        </div>
      )}

      {isActive && (
        <div className="exercise-card__sets-grid">
          {Array.from({ length: exercise.sets }, (_, i) => {
            const setLog = setLogs[i];
            const isSetComplete = setLog?.completed ?? false;
            return (
              <div
                key={i}
                className={`exercise-card__set ${isSetComplete ? 'exercise-card__set--done' : ''}`}
              >
                <span className="exercise-card__set-num">Set {i + 1}</span>
                {setLog?.reps !== undefined && (
                  <span className="exercise-card__set-reps">{setLog.reps} reps</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isActive && !isComplete && (
        <button
          className="exercise-card__timer-btn"
          onClick={() => onStartTimer(exercise)}
        >
          Start Timer
        </button>
      )}
    </div>
  );
}
