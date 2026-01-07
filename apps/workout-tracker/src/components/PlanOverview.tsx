import type { WorkoutPlan, WorkoutSession } from '../types/workout';
import './PlanOverview.css';

interface PlanOverviewProps {
  plan: WorkoutPlan;
  sessions: WorkoutSession[];
  onSelectSession: (session: WorkoutSession) => void;
  onBack: () => void;
}

export function PlanOverview({
  plan,
  sessions,
  onSelectSession,
  onBack,
}: PlanOverviewProps) {
  return (
    <div className="plan-overview">
      <header className="plan-overview__header">
        <button className="plan-overview__back" onClick={onBack}>
          ← Today
        </button>
        <div className="plan-overview__title">
          <h1>{plan.name}</h1>
          {plan.description && <p>{plan.description}</p>}
        </div>
      </header>

      <div className="plan-overview__info">
        <span className="plan-overview__weeks">{plan.weeks} weeks</span>
        <span className="plan-overview__sessions">{sessions.length} sessions</span>
      </div>

      <div className="plan-overview__sessions">
        <h2>All Sessions</h2>
        {sessions.map((session) => (
          <button
            key={session.id}
            className="plan-overview__session"
            onClick={() => onSelectSession(session)}
          >
            <div className="plan-overview__session-info">
              <span className="plan-overview__session-name">{session.name}</span>
              {session.description && (
                <span className="plan-overview__session-desc">{session.description}</span>
              )}
            </div>
            <div className="plan-overview__session-meta">
              <span>{session.exercises.length} exercises</span>
              {session.estimatedMinutes && (
                <span>~{session.estimatedMinutes} min</span>
              )}
            </div>
            <span className="plan-overview__session-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
