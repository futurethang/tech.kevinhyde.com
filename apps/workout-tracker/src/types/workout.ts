// Core exercise types - extensible for future workout varieties
export type ExerciseType =
  | 'weight'       // Traditional weight lifting (reps-based)
  | 'active_time'  // Time-based with rep counting (AMRAP in X seconds)
  | 'cardio'       // Cardio exercises
  | 'bodyweight'   // Bodyweight exercises
  | 'core'         // Core/ab exercises
  | 'stretch';     // Stretching/flexibility

// Base exercise definition in a workout plan
export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  sets: number;
  reps?: number | string;           // Fixed reps, range "8-12", or undefined for time-based
  activeSeconds?: number;           // Duration of active period (for active_time exercises)
  restSeconds?: number;             // Suggested rest between sets
  tips?: string;                    // Coaching tips
  equipment?: string;               // Equipment needed
  targetMuscles?: string[];         // Muscle groups targeted
}

// A workout session (e.g., "Day 1 - Upper Body")
export interface WorkoutSession {
  id: string;
  name: string;
  description?: string;
  exercises: Exercise[];
  estimatedMinutes?: number;
}

// A full workout plan with scheduled sessions
export interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  startDate?: string;               // ISO date string
  weeks: number;                    // Total weeks in plan
  schedule: WeekSchedule[];         // What sessions to do each week
}

// Weekly schedule mapping days to sessions
export interface WeekSchedule {
  weekNumber: number;
  days: DaySchedule[];
}

export interface DaySchedule {
  dayOfWeek: number;                // 0 = Sunday, 1 = Monday, etc.
  sessionId: string;
  isRestDay?: boolean;
}

// ============ LOGGING / TRACKING TYPES ============

// Log entry for a single set within an exercise
export interface SetLog {
  setNumber: number;
  weight?: number;                  // Weight used (lbs or kg based on user pref)
  reps?: number;                    // Actual reps completed
  duration?: number;                // Actual duration in seconds (for timed)
  completed: boolean;
  skipped?: boolean;
  notes?: string;
}

// Log entry for a completed exercise
export interface ExerciseLog {
  id: string;
  date: string;                     // ISO date string
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
  completed: boolean;
  notes?: string;
}

// Log entry for a completed workout session
export interface SessionLog {
  id: string;
  date: string;                     // ISO date string
  sessionId: string;
  sessionName: string;
  exerciseLogs: ExerciseLog[];
  startTime: string;                // ISO timestamp
  endTime?: string;                 // ISO timestamp
  completed: boolean;
  notes?: string;
}

// User preferences
export interface UserPreferences {
  weightUnit: 'lbs' | 'kg';
  defaultRestSeconds: number;
  defaultActiveSeconds: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  keepScreenOn: boolean;
}

// ============ TIMER STATE ============

export type TimerPhase = 'idle' | 'active' | 'rest' | 'complete';

export interface TimerState {
  phase: TimerPhase;
  currentSet: number;
  totalSets: number;
  secondsRemaining: number;
  activeSeconds: number;
  restSeconds: number;
  isPaused: boolean;
}

// ============ APP STATE ============

export interface AppState {
  currentPlan: WorkoutPlan | null;
  currentSession: WorkoutSession | null;
  currentExerciseIndex: number;
  sessionLogs: SessionLog[];
  exerciseLogs: ExerciseLog[];
  preferences: UserPreferences;
}

// Default preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
  weightUnit: 'lbs',
  defaultRestSeconds: 60,
  defaultActiveSeconds: 45,
  soundEnabled: true,
  vibrationEnabled: true,
  keepScreenOn: true,
};
