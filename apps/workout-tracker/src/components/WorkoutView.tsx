import { useState, useCallback, useEffect } from 'react';
import type { WorkoutSession, Exercise, SetLog, ExerciseLog } from '../types/workout';
import { useTimer } from '../hooks/useTimer';
import { useWakeLock } from '../hooks/useWakeLock';
import { Timer } from './Timer';
import { TimerSetup } from './TimerSetup';
import { ExerciseCard } from './ExerciseCard';
import './WorkoutView.css';

interface WorkoutViewProps {
  session: WorkoutSession;
  exerciseWeights: Record<string, number>;
  exerciseLogs: ExerciseLog[];
  preferences: {
    weightUnit: 'lbs' | 'kg';
    defaultRestSeconds: number;
    defaultActiveSeconds: number;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    keepScreenOn: boolean;
  };
  onUpdateWeight: (exerciseId: string, weight: number) => void;
  onLogExercise: (log: ExerciseLog) => void;
  onBack: () => void;
}

type ViewMode = 'exercises' | 'timer-setup' | 'timer';

export function WorkoutView({
  session,
  exerciseWeights,
  preferences,
  onUpdateWeight,
  onLogExercise,
  onBack,
}: WorkoutViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('exercises');
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [currentSetLogs, setCurrentSetLogs] = useState<Record<string, SetLog[]>>({});

  const { requestWakeLock, releaseWakeLock, isSupported: wakeLockSupported } = useWakeLock();

  // Timer callbacks
  const handleSetComplete = useCallback((setNumber: number) => {
    if (!selectedExercise) return;

    setCurrentSetLogs((prev) => {
      const logs = prev[selectedExercise.id] ?? [];
      const newLog: SetLog = {
        setNumber,
        completed: true,
        reps: typeof selectedExercise.reps === 'number' ? selectedExercise.reps : undefined,
        weight: exerciseWeights[selectedExercise.id],
      };
      const updated = [...logs];
      updated[setNumber - 1] = newLog;
      return { ...prev, [selectedExercise.id]: updated };
    });
  }, [selectedExercise, exerciseWeights]);

  const handleAllSetsComplete = useCallback(() => {
    if (!selectedExercise) return;

    // Mark exercise as complete
    setCompletedExercises((prev) => new Set([...prev, selectedExercise.id]));

    // Log the exercise
    const setLogs = currentSetLogs[selectedExercise.id] ?? [];
    const exerciseLog: ExerciseLog = {
      id: `${Date.now()}-${selectedExercise.id}`,
      date: new Date().toISOString().split('T')[0],
      sessionId: session.id,
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      sets: setLogs,
      completed: true,
    };
    onLogExercise(exerciseLog);

    // Move to next exercise after a delay
    setTimeout(() => {
      const nextIndex = activeExerciseIndex + 1;
      if (nextIndex < session.exercises.length) {
        setActiveExerciseIndex(nextIndex);
      }
      setViewMode('exercises');
      setSelectedExercise(null);
    }, 1500);
  }, [selectedExercise, currentSetLogs, session, activeExerciseIndex, onLogExercise]);

  const timer = useTimer({
    onSetComplete: handleSetComplete,
    onAllSetsComplete: handleAllSetsComplete,
    soundEnabled: preferences.soundEnabled,
    vibrationEnabled: preferences.vibrationEnabled,
  });

  // Screen wake lock management
  useEffect(() => {
    if (preferences.keepScreenOn && wakeLockSupported) {
      if (viewMode === 'timer' && timer.state.phase !== 'idle') {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    }
    return () => {
      releaseWakeLock();
    };
  }, [viewMode, timer.state.phase, preferences.keepScreenOn, wakeLockSupported, requestWakeLock, releaseWakeLock]);

  const handleStartTimer = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setViewMode('timer-setup');
  };

  const handleTimerStart = (sets: number, activeSeconds: number, restSeconds: number) => {
    timer.start(sets, activeSeconds, restSeconds);
    setViewMode('timer');
  };

  const handleCancelTimer = () => {
    timer.reset();
    setViewMode('exercises');
    setSelectedExercise(null);
  };

  const handleToggleComplete = (exercise: Exercise) => {
    setCompletedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exercise.id)) {
        next.delete(exercise.id);
      } else {
        next.add(exercise.id);
        // Auto-log when manually marking complete
        const setLogs = currentSetLogs[exercise.id] ?? [];
        const exerciseLog: ExerciseLog = {
          id: `${Date.now()}-${exercise.id}`,
          date: new Date().toISOString().split('T')[0],
          sessionId: session.id,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          sets: setLogs.length > 0 ? setLogs : Array.from({ length: exercise.sets }, (_, i) => ({
            setNumber: i + 1,
            completed: true,
            reps: typeof exercise.reps === 'number' ? exercise.reps : undefined,
            weight: exerciseWeights[exercise.id],
          })),
          completed: true,
        };
        onLogExercise(exerciseLog);
      }
      return next;
    });
  };

  const completedCount = completedExercises.size;
  const totalCount = session.exercises.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (viewMode === 'timer-setup' && selectedExercise) {
    return (
      <div className="workout-view">
        <TimerSetup
          exercise={selectedExercise}
          defaultActiveSeconds={preferences.defaultActiveSeconds}
          defaultRestSeconds={preferences.defaultRestSeconds}
          onStart={handleTimerStart}
          onCancel={handleCancelTimer}
        />
      </div>
    );
  }

  if (viewMode === 'timer') {
    return (
      <div className="workout-view workout-view--timer">
        {selectedExercise && (
          <div className="workout-view__timer-header">
            <h2>{selectedExercise.name}</h2>
          </div>
        )}
        <Timer
          state={timer.state}
          onTogglePause={timer.togglePause}
          onSkipToRest={timer.skipToRest}
          onSkipRest={timer.skipRest}
          onReset={handleCancelTimer}
          onAdjustTime={timer.adjustTime}
        />
      </div>
    );
  }

  return (
    <div className="workout-view">
      <header className="workout-view__header">
        <button className="workout-view__back" onClick={onBack}>
          ← Back
        </button>
        <div className="workout-view__title">
          <h1>{session.name}</h1>
          {session.description && <p>{session.description}</p>}
        </div>
      </header>

      <div className="workout-view__progress">
        <div className="workout-view__progress-bar">
          <div
            className="workout-view__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="workout-view__progress-text">
          {completedCount} / {totalCount} exercises
        </span>
      </div>

      <div className="workout-view__exercises">
        {session.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            exerciseIndex={index}
            isActive={index === activeExerciseIndex}
            isComplete={completedExercises.has(exercise.id)}
            lastWeight={exerciseWeights[exercise.id]}
            setLogs={currentSetLogs[exercise.id] ?? []}
            onStartTimer={handleStartTimer}
            onUpdateWeight={(weight) => onUpdateWeight(exercise.id, weight)}
            onUpdateSetLog={(setIndex, log) => {
              setCurrentSetLogs((prev) => {
                const logs = [...(prev[exercise.id] ?? [])];
                logs[setIndex] = { ...logs[setIndex], ...log } as SetLog;
                return { ...prev, [exercise.id]: logs };
              });
            }}
            onToggleComplete={() => handleToggleComplete(exercise)}
            weightUnit={preferences.weightUnit}
          />
        ))}
      </div>
    </div>
  );
}
