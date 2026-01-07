import { useState, useCallback } from 'react';
import type { WorkoutSession, ExerciseLog } from './types/workout';
import { DEFAULT_PREFERENCES } from './types/workout';
import { useLocalStorage, useExerciseWeights } from './hooks/useLocalStorage';
import { WorkoutView } from './components/WorkoutView';
import { PlanOverview } from './components/PlanOverview';
import { samplePlan, sampleSessions, getTodaySession } from './data/samplePlan';
import './App.css';

type AppView = 'home' | 'workout' | 'plan';

function App() {
  const [view, setView] = useState<AppView>('home');
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);

  // Persisted state
  const [exerciseWeights, setExerciseWeights] = useExerciseWeights();
  const [exerciseLogs, setExerciseLogs] = useLocalStorage<ExerciseLog[]>('workout-exercise-logs', []);
  const [preferences] = useLocalStorage('workout-preferences', DEFAULT_PREFERENCES);

  // Get today's scheduled workout
  const todaySession = getTodaySession(samplePlan, sampleSessions);

  const handleStartTodayWorkout = () => {
    if (todaySession) {
      setSelectedSession(todaySession);
      setView('workout');
    }
  };

  const handleSelectSession = (session: WorkoutSession) => {
    setSelectedSession(session);
    setView('workout');
  };

  const handleUpdateWeight = useCallback((exerciseId: string, weight: number) => {
    setExerciseWeights((prev) => ({ ...prev, [exerciseId]: weight }));
  }, [setExerciseWeights]);

  const handleLogExercise = useCallback((log: ExerciseLog) => {
    setExerciseLogs((prev) => [...prev, log]);
  }, [setExerciseLogs]);

  const handleBackToHome = () => {
    setView('home');
    setSelectedSession(null);
  };

  // Workout view
  if (view === 'workout' && selectedSession) {
    return (
      <div className="app">
        <WorkoutView
          session={selectedSession}
          exerciseWeights={exerciseWeights}
          exerciseLogs={exerciseLogs}
          preferences={preferences}
          onUpdateWeight={handleUpdateWeight}
          onLogExercise={handleLogExercise}
          onBack={handleBackToHome}
        />
      </div>
    );
  }

  // Plan overview
  if (view === 'plan') {
    return (
      <div className="app">
        <PlanOverview
          plan={samplePlan}
          sessions={sampleSessions}
          onSelectSession={handleSelectSession}
          onBack={handleBackToHome}
        />
      </div>
    );
  }

  // Home view
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[today.getDay()];

  return (
    <div className="app">
      <header className="home__header">
        <h1 className="home__title">Workout</h1>
        <p className="home__date">{dayName}</p>
      </header>

      <main className="home__main">
        {todaySession ? (
          <div className="home__today">
            <h2 className="home__section-title">Today's Workout</h2>
            <button className="home__today-card" onClick={handleStartTodayWorkout}>
              <div className="home__today-info">
                <span className="home__today-name">{todaySession.name}</span>
                {todaySession.description && (
                  <span className="home__today-desc">{todaySession.description}</span>
                )}
                <span className="home__today-meta">
                  {todaySession.exercises.length} exercises
                  {todaySession.estimatedMinutes && ` • ~${todaySession.estimatedMinutes} min`}
                </span>
              </div>
              <span className="home__today-go">GO →</span>
            </button>
          </div>
        ) : (
          <div className="home__rest">
            <div className="home__rest-icon">🌟</div>
            <h2 className="home__rest-title">Rest Day</h2>
            <p className="home__rest-text">
              No workout scheduled for today. Take it easy and recover!
            </p>
          </div>
        )}

        <div className="home__quick-start">
          <h2 className="home__section-title">Quick Start</h2>
          <div className="home__sessions">
            {sampleSessions.slice(0, 3).map((session) => (
              <button
                key={session.id}
                className="home__session-btn"
                onClick={() => handleSelectSession(session)}
              >
                <span className="home__session-name">{session.name}</span>
                <span className="home__session-count">{session.exercises.length}</span>
              </button>
            ))}
          </div>
        </div>

        <button className="home__plan-btn" onClick={() => setView('plan')}>
          View Full Plan →
        </button>

        {exerciseLogs.length > 0 && (
          <div className="home__stats">
            <h2 className="home__section-title">Recent Activity</h2>
            <div className="home__stat">
              <span className="home__stat-value">{exerciseLogs.length}</span>
              <span className="home__stat-label">exercises logged</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
