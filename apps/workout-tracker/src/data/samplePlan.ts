import type { WorkoutPlan, WorkoutSession, Exercise } from '../types/workout';

// ============ EXERCISES ============
// All exercises from the 4-Week Strength On-Ramp plan

const exercises: Record<string, Exercise> = {
  // === PUSH + SQUAT EXERCISES ===
  gobletSquat: {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    type: 'weight',
    sets: 3,
    reps: 10,
    restSeconds: 75,
    tips: 'Hold dumbbell at chest. Sit back, knees track over toes.',
    equipment: 'Dumbbell (20-30 lb)',
    targetMuscles: ['Quads', 'Glutes', 'Core'],
  },
  gobletSquatW34: {
    id: 'goblet-squat-w34',
    name: 'Goblet Squat',
    type: 'weight',
    sets: 3,
    reps: 12,
    restSeconds: 75,
    tips: 'Bump the weight up from weeks 1-2. Sit back, knees track over toes.',
    equipment: 'Dumbbell (heavier than W1-2)',
    targetMuscles: ['Quads', 'Glutes', 'Core'],
  },
  dbBenchPress: {
    id: 'db-bench-press',
    name: 'Dumbbell Bench Press',
    type: 'weight',
    sets: 3,
    reps: 10,
    restSeconds: 75,
    tips: 'Or pushups if you prefer. Control the descent.',
    equipment: 'Dumbbells (20-25 lb each)',
    targetMuscles: ['Chest', 'Triceps', 'Shoulders'],
  },
  dbBenchPressW34: {
    id: 'db-bench-press-w34',
    name: 'Dumbbell Bench Press',
    type: 'weight',
    sets: 3,
    reps: 10,
    restSeconds: 75,
    tips: 'Increase weight slightly from weeks 1-2. Control the descent.',
    equipment: 'Dumbbells (heavier than W1-2)',
    targetMuscles: ['Chest', 'Triceps', 'Shoulders'],
  },
  dbShoulderPress: {
    id: 'db-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    type: 'weight',
    sets: 2,
    reps: 10,
    restSeconds: 75,
    tips: 'Seated or standing. Press straight up, keep core engaged.',
    equipment: 'Dumbbells (15-20 lb each)',
    targetMuscles: ['Shoulders', 'Triceps'],
  },

  // === PULL + HINGE EXERCISES ===
  romanianDeadlift: {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    type: 'weight',
    sets: 3,
    reps: 10,
    restSeconds: 90,
    tips: 'Push hips back, slight knee bend. Feel hamstrings stretch.',
    equipment: 'Dumbbells (20-25 lb each)',
    targetMuscles: ['Hamstrings', 'Glutes', 'Lower Back'],
  },
  romanianDeadliftW34: {
    id: 'romanian-deadlift-w34',
    name: 'Romanian Deadlift',
    type: 'weight',
    sets: 3,
    reps: 12,
    restSeconds: 90,
    tips: 'Bump the weight. Push hips back, feel hamstrings stretch.',
    equipment: 'Dumbbells (heavier than W1-2)',
    targetMuscles: ['Hamstrings', 'Glutes', 'Lower Back'],
  },
  dbRow: {
    id: 'db-row',
    name: 'Dumbbell Row',
    type: 'weight',
    sets: 3,
    reps: '10 each arm',
    restSeconds: 60,
    tips: 'One knee on bench. Pull to hip, not armpit.',
    equipment: 'Dumbbell (20-30 lb)',
    targetMuscles: ['Lats', 'Rhomboids', 'Biceps'],
  },
  dbRowW34: {
    id: 'db-row-w34',
    name: 'Dumbbell Row',
    type: 'weight',
    sets: 3,
    reps: '12 each arm',
    restSeconds: 60,
    tips: 'Heavier than weeks 1-2. Pull to hip, not armpit.',
    equipment: 'Dumbbell (heavier than W1-2)',
    targetMuscles: ['Lats', 'Rhomboids', 'Biceps'],
  },
  latPulldown: {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    type: 'weight',
    sets: 2,
    reps: 10,
    restSeconds: 60,
    tips: 'Control the negative. Or use assisted pull-up machine.',
    equipment: 'Cable machine (60-80 lb)',
    targetMuscles: ['Lats', 'Biceps'],
  },

  // === CORE EXERCISES ===
  deadBug: {
    id: 'dead-bug',
    name: 'Dead Bug',
    type: 'core',
    sets: 3,
    reps: '8 each side',
    restSeconds: 45,
    tips: 'Slow and controlled. Low back stays glued to floor.',
    targetMuscles: ['Core', 'Hip Flexors'],
  },
  deadBugW34: {
    id: 'dead-bug-w34',
    name: 'Dead Bug',
    type: 'core',
    sets: 3,
    reps: '10 each side',
    restSeconds: 45,
    tips: 'Slower than you think. Low back stays glued to floor.',
    targetMuscles: ['Core', 'Hip Flexors'],
  },
  birdDog: {
    id: 'bird-dog',
    name: 'Bird Dog',
    type: 'core',
    sets: 3,
    reps: '8 each side',
    restSeconds: 45,
    tips: "Opposite arm/leg extend. Don't rush.",
    targetMuscles: ['Core', 'Lower Back', 'Glutes'],
  },
  birdDogW34: {
    id: 'bird-dog-w34',
    name: 'Bird Dog',
    type: 'core',
    sets: 3,
    reps: '10 each side',
    restSeconds: 45,
    tips: "Opposite arm/leg extend. Don't rush.",
    targetMuscles: ['Core', 'Lower Back', 'Glutes'],
  },
  plank: {
    id: 'plank',
    name: 'Plank',
    type: 'active_time',
    sets: 3,
    activeSeconds: 30,
    restSeconds: 30,
    tips: "Squeeze glutes, don't sag. Straight line from head to heels.",
    targetMuscles: ['Core', 'Shoulders'],
  },
  pallofPress: {
    id: 'pallof-press',
    name: 'Pallof Press',
    type: 'core',
    sets: 3,
    reps: '10 each side',
    restSeconds: 45,
    tips: 'Anti-rotation exercise. Cable or band. Press out, resist the twist.',
    equipment: 'Cable machine or resistance band',
    targetMuscles: ['Core', 'Obliques'],
  },
  gluteBridge: {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    type: 'bodyweight',
    sets: 3,
    reps: 12,
    restSeconds: 45,
    tips: 'Squeeze glutes at top. Counteracts sitting all day.',
    targetMuscles: ['Glutes', 'Hamstrings'],
  },

  // === POSTURE / ACCESSORY ===
  bandPullApart: {
    id: 'band-pull-apart',
    name: 'Band Pull-Apart',
    type: 'bodyweight',
    sets: 2,
    reps: 15,
    restSeconds: 45,
    tips: 'Posture correction. Squeeze shoulder blades together at end.',
    equipment: 'Resistance band',
    targetMuscles: ['Rear Delts', 'Rhomboids'],
  },
  facePull: {
    id: 'face-pull',
    name: 'Face Pull',
    type: 'weight',
    sets: 2,
    reps: 15,
    restSeconds: 45,
    tips: 'Pull to face, elbows high. Posture gold.',
    equipment: 'Cable machine or resistance band',
    targetMuscles: ['Rear Delts', 'Rhomboids', 'Rotator Cuff'],
  },

  // === MOBILITY / STRETCH ===
  catCow: {
    id: 'cat-cow',
    name: 'Cat-Cow',
    type: 'stretch',
    sets: 2,
    reps: 10,
    restSeconds: 15,
    tips: 'Spinal mobility. Breathe deeply. Alternate arching and rounding.',
    targetMuscles: ['Spine', 'Core'],
  },
};

// ============ SESSIONS ============

// WEEKS 1-2: Foundation Phase
const liftAFoundation: WorkoutSession = {
  id: 'lift-a-foundation',
  name: 'Lift A: Push + Squat',
  description: 'Weeks 1-2 • Foundation phase • 20-25 min',
  exercises: [
    exercises.gobletSquat,
    exercises.dbBenchPress,
    exercises.deadBug,
    exercises.bandPullApart,
  ],
  estimatedMinutes: 22,
};

const liftBFoundation: WorkoutSession = {
  id: 'lift-b-foundation',
  name: 'Lift B: Pull + Hinge',
  description: 'Weeks 1-2 • Foundation phase • 20-25 min',
  exercises: [
    exercises.romanianDeadlift,
    exercises.dbRow,
    exercises.birdDog,
    exercises.facePull,
  ],
  estimatedMinutes: 22,
};

// WEEKS 3-4: Building Phase
const liftABuilding: WorkoutSession = {
  id: 'lift-a-building',
  name: 'Lift A: Push + Squat',
  description: 'Weeks 3-4 • Building phase • 25-30 min',
  exercises: [
    exercises.gobletSquatW34,
    exercises.dbBenchPressW34,
    exercises.dbShoulderPress,
    exercises.deadBugW34,
    exercises.bandPullApart,
  ],
  estimatedMinutes: 28,
};

const liftBBuilding: WorkoutSession = {
  id: 'lift-b-building',
  name: 'Lift B: Pull + Hinge',
  description: 'Weeks 3-4 • Building phase • 25-30 min',
  exercises: [
    exercises.romanianDeadliftW34,
    exercises.dbRowW34,
    exercises.latPulldown,
    exercises.birdDogW34,
    exercises.facePull,
  ],
  estimatedMinutes: 28,
};

const liftCCore: WorkoutSession = {
  id: 'lift-c-core',
  name: 'Lift C: Core & Posture',
  description: 'Weeks 3-4 • Lighter recovery day • ~20 min',
  exercises: [
    exercises.plank,
    exercises.pallofPress,
    exercises.catCow,
    exercises.facePull,
    exercises.gluteBridge,
  ],
  estimatedMinutes: 20,
};

// Export all sessions
export const sampleSessions: WorkoutSession[] = [
  liftAFoundation,
  liftBFoundation,
  liftABuilding,
  liftBBuilding,
  liftCCore,
];

// ============ WORKOUT PLAN ============

// Plan start date: January 7, 2026
const PLAN_START_DATE = new Date('2026-01-07');

export const samplePlan: WorkoutPlan = {
  id: '2026-kickoff',
  name: '2026 Kickoff: 4-Week Strength On-Ramp',
  description: 'Build the lifting habit, establish form, prepare for February intensity increase',
  startDate: '2026-01-07',
  weeks: 4,
  schedule: [
    // Week 1: Foundation (Jan 7-12)
    {
      weekNumber: 1,
      days: [
        { dayOfWeek: 0, sessionId: '', isRestDay: true }, // Sunday
        { dayOfWeek: 1, sessionId: '', isRestDay: true }, // Monday - Group circuit (external)
        { dayOfWeek: 2, sessionId: '', isRestDay: true }, // Tuesday - Rest/treadmill
        { dayOfWeek: 3, sessionId: 'lift-a-foundation' }, // Wednesday - Lift A
        { dayOfWeek: 4, sessionId: '', isRestDay: true }, // Thursday - Rest/treadmill
        { dayOfWeek: 5, sessionId: 'lift-b-foundation' }, // Friday - Lift B
        { dayOfWeek: 6, sessionId: '', isRestDay: true }, // Saturday - Optional
      ],
    },
    // Week 2: Foundation (Jan 13-19)
    {
      weekNumber: 2,
      days: [
        { dayOfWeek: 0, sessionId: '', isRestDay: true },
        { dayOfWeek: 1, sessionId: '', isRestDay: true },
        { dayOfWeek: 2, sessionId: '', isRestDay: true },
        { dayOfWeek: 3, sessionId: 'lift-a-foundation' },
        { dayOfWeek: 4, sessionId: '', isRestDay: true },
        { dayOfWeek: 5, sessionId: 'lift-b-foundation' },
        { dayOfWeek: 6, sessionId: '', isRestDay: true },
      ],
    },
    // Week 3: Building (Jan 20-26)
    {
      weekNumber: 3,
      days: [
        { dayOfWeek: 0, sessionId: '', isRestDay: true },
        { dayOfWeek: 1, sessionId: '', isRestDay: true },
        { dayOfWeek: 2, sessionId: '', isRestDay: true },
        { dayOfWeek: 3, sessionId: 'lift-a-building' }, // Wednesday - Lift A (updated)
        { dayOfWeek: 4, sessionId: 'lift-c-core' },      // Thursday - Lift C (new!)
        { dayOfWeek: 5, sessionId: 'lift-b-building' }, // Friday - Lift B (updated)
        { dayOfWeek: 6, sessionId: '', isRestDay: true },
      ],
    },
    // Week 4: Building (Jan 27 - Feb 2)
    {
      weekNumber: 4,
      days: [
        { dayOfWeek: 0, sessionId: '', isRestDay: true },
        { dayOfWeek: 1, sessionId: '', isRestDay: true },
        { dayOfWeek: 2, sessionId: '', isRestDay: true },
        { dayOfWeek: 3, sessionId: 'lift-a-building' },
        { dayOfWeek: 4, sessionId: 'lift-c-core' },
        { dayOfWeek: 5, sessionId: 'lift-b-building' },
        { dayOfWeek: 6, sessionId: '', isRestDay: true },
      ],
    },
  ],
};

// ============ HELPER FUNCTIONS ============

/**
 * Calculate which week of the plan we're in (1-4, or 0 if before/after)
 */
export function getCurrentWeek(planStartDate: Date = PLAN_START_DATE): number {
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((now.getTime() - planStartDate.getTime()) / msPerWeek);

  if (weeksSinceStart < 0) return 0; // Before plan starts
  if (weeksSinceStart >= 4) return 0; // After plan ends
  return weeksSinceStart + 1; // Weeks 1-4
}

/**
 * Get today's scheduled session based on the plan
 */
export function getTodaySession(
  plan: WorkoutPlan,
  sessions: WorkoutSession[]
): WorkoutSession | null {
  const currentWeek = getCurrentWeek(plan.startDate ? new Date(plan.startDate) : undefined);

  // If not in an active week, return the first lifting session as default
  if (currentWeek === 0) {
    // Default to Lift A Foundation if outside plan dates
    return sessions.find(s => s.id === 'lift-a-foundation') ?? sessions[0] ?? null;
  }

  const today = new Date();
  const dayOfWeek = today.getDay();

  const weekSchedule = plan.schedule.find(w => w.weekNumber === currentWeek);
  if (!weekSchedule) return null;

  const todaySchedule = weekSchedule.days.find(d => d.dayOfWeek === dayOfWeek);
  if (!todaySchedule || todaySchedule.isRestDay || !todaySchedule.sessionId) {
    return null;
  }

  return sessions.find(s => s.id === todaySchedule.sessionId) ?? null;
}

/**
 * Get display info about the current plan phase
 */
export function getPlanPhaseInfo(): { phase: string; week: number; description: string } {
  const week = getCurrentWeek();

  if (week === 0) {
    return {
      phase: 'Preview',
      week: 0,
      description: 'Plan starts January 7, 2026',
    };
  }

  if (week <= 2) {
    return {
      phase: 'Foundation',
      week,
      description: 'Building patterns, not muscle. Leave 3-4 reps in the tank.',
    };
  }

  return {
    phase: 'Building',
    week,
    description: 'Still 2-3 reps in the tank, but you should feel like you worked.',
  };
}
