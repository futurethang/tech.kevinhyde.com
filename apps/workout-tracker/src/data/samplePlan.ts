import type { WorkoutPlan, WorkoutSession, Exercise } from '../types/workout';

// Sample exercises to demonstrate all types
const sampleExercises: Record<string, Exercise> = {
  benchPress: {
    id: 'bench-press',
    name: 'Bench Press',
    type: 'weight',
    sets: 3,
    reps: 10,
    restSeconds: 90,
    tips: 'Keep your back flat, drive through your heels',
    equipment: 'Barbell, Bench',
    targetMuscles: ['Chest', 'Triceps', 'Shoulders'],
  },
  squats: {
    id: 'squats',
    name: 'Barbell Squats',
    type: 'weight',
    sets: 4,
    reps: 8,
    restSeconds: 120,
    tips: 'Keep knees tracking over toes, chest up',
    equipment: 'Barbell, Squat Rack',
    targetMuscles: ['Quads', 'Glutes', 'Hamstrings'],
  },
  deadlift: {
    id: 'deadlift',
    name: 'Deadlift',
    type: 'weight',
    sets: 3,
    reps: 6,
    restSeconds: 120,
    tips: 'Hinge at hips, keep bar close to body',
    equipment: 'Barbell',
    targetMuscles: ['Back', 'Glutes', 'Hamstrings'],
  },
  pushups: {
    id: 'pushups',
    name: 'Push-ups',
    type: 'bodyweight',
    sets: 3,
    reps: 15,
    restSeconds: 60,
    tips: 'Keep core tight, full range of motion',
    targetMuscles: ['Chest', 'Triceps', 'Core'],
  },
  plank: {
    id: 'plank',
    name: 'Plank Hold',
    type: 'active_time',
    sets: 3,
    activeSeconds: 45,
    restSeconds: 30,
    tips: 'Keep body in straight line, engage core',
    targetMuscles: ['Core', 'Shoulders'],
  },
  mountainClimbers: {
    id: 'mountain-climbers',
    name: 'Mountain Climbers',
    type: 'active_time',
    sets: 3,
    activeSeconds: 30,
    restSeconds: 30,
    tips: 'Keep hips low, move quickly',
    targetMuscles: ['Core', 'Cardio'],
  },
  jumpingJacks: {
    id: 'jumping-jacks',
    name: 'Jumping Jacks',
    type: 'cardio',
    sets: 3,
    activeSeconds: 45,
    restSeconds: 15,
    tips: 'Stay light on feet, keep rhythm',
    targetMuscles: ['Full Body', 'Cardio'],
  },
  bicepCurl: {
    id: 'bicep-curl',
    name: 'Dumbbell Bicep Curl',
    type: 'weight',
    sets: 3,
    reps: 12,
    restSeconds: 60,
    tips: 'Control the movement, avoid swinging',
    equipment: 'Dumbbells',
    targetMuscles: ['Biceps'],
  },
  tricepDip: {
    id: 'tricep-dip',
    name: 'Tricep Dips',
    type: 'bodyweight',
    sets: 3,
    reps: 12,
    restSeconds: 60,
    tips: 'Keep elbows close to body',
    equipment: 'Bench or Chair',
    targetMuscles: ['Triceps', 'Shoulders'],
  },
  shoulderPress: {
    id: 'shoulder-press',
    name: 'Dumbbell Shoulder Press',
    type: 'weight',
    sets: 3,
    reps: 10,
    restSeconds: 90,
    tips: 'Press straight up, keep core engaged',
    equipment: 'Dumbbells',
    targetMuscles: ['Shoulders', 'Triceps'],
  },
  lunges: {
    id: 'lunges',
    name: 'Walking Lunges',
    type: 'bodyweight',
    sets: 3,
    reps: '10 each leg',
    restSeconds: 60,
    tips: 'Keep torso upright, knee over ankle',
    targetMuscles: ['Quads', 'Glutes'],
  },
  russianTwist: {
    id: 'russian-twist',
    name: 'Russian Twist',
    type: 'core',
    sets: 3,
    reps: 20,
    restSeconds: 45,
    tips: 'Lean back slightly, twist from core',
    equipment: 'Weight (optional)',
    targetMuscles: ['Obliques', 'Core'],
  },
  hipStretch: {
    id: 'hip-stretch',
    name: 'Hip Flexor Stretch',
    type: 'stretch',
    sets: 2,
    activeSeconds: 30,
    restSeconds: 10,
    tips: 'Hold stretch, breathe deeply',
    targetMuscles: ['Hip Flexors'],
  },
};

// Sample workout sessions
export const sampleSessions: WorkoutSession[] = [
  {
    id: 'upper-body-a',
    name: 'Upper Body A',
    description: 'Chest, shoulders, and triceps focus',
    exercises: [
      sampleExercises.benchPress,
      sampleExercises.shoulderPress,
      sampleExercises.pushups,
      sampleExercises.tricepDip,
      sampleExercises.plank,
    ],
    estimatedMinutes: 45,
  },
  {
    id: 'lower-body-a',
    name: 'Lower Body A',
    description: 'Quads, glutes, and core focus',
    exercises: [
      sampleExercises.squats,
      sampleExercises.lunges,
      sampleExercises.russianTwist,
      sampleExercises.plank,
      sampleExercises.hipStretch,
    ],
    estimatedMinutes: 50,
  },
  {
    id: 'upper-body-b',
    name: 'Upper Body B',
    description: 'Back and biceps focus',
    exercises: [
      sampleExercises.deadlift,
      sampleExercises.bicepCurl,
      sampleExercises.shoulderPress,
      sampleExercises.pushups,
      sampleExercises.plank,
    ],
    estimatedMinutes: 45,
  },
  {
    id: 'cardio-core',
    name: 'Cardio & Core',
    description: 'High intensity cardio and core work',
    exercises: [
      sampleExercises.jumpingJacks,
      sampleExercises.mountainClimbers,
      sampleExercises.plank,
      sampleExercises.russianTwist,
      sampleExercises.hipStretch,
    ],
    estimatedMinutes: 30,
  },
];

// Sample workout plan
export const samplePlan: WorkoutPlan = {
  id: 'starter-plan',
  name: 'Starter Strength Plan',
  description: 'A 4-week introductory program to build strength and endurance',
  weeks: 4,
  schedule: [
    {
      weekNumber: 1,
      days: [
        { dayOfWeek: 1, sessionId: 'upper-body-a' }, // Monday
        { dayOfWeek: 2, sessionId: 'lower-body-a' }, // Tuesday
        { dayOfWeek: 3, sessionId: 'cardio-core', isRestDay: false }, // Wednesday
        { dayOfWeek: 4, sessionId: 'upper-body-b' }, // Thursday
        { dayOfWeek: 5, sessionId: 'lower-body-a' }, // Friday
        { dayOfWeek: 6, isRestDay: true, sessionId: '' }, // Saturday
        { dayOfWeek: 0, isRestDay: true, sessionId: '' }, // Sunday
      ],
    },
    // Weeks 2-4 follow same pattern
    {
      weekNumber: 2,
      days: [
        { dayOfWeek: 1, sessionId: 'upper-body-a' },
        { dayOfWeek: 2, sessionId: 'lower-body-a' },
        { dayOfWeek: 3, sessionId: 'cardio-core' },
        { dayOfWeek: 4, sessionId: 'upper-body-b' },
        { dayOfWeek: 5, sessionId: 'lower-body-a' },
        { dayOfWeek: 6, isRestDay: true, sessionId: '' },
        { dayOfWeek: 0, isRestDay: true, sessionId: '' },
      ],
    },
  ],
};

// Helper to get today's scheduled session
export function getTodaySession(
  plan: WorkoutPlan,
  sessions: WorkoutSession[]
): WorkoutSession | null {
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Find current week in plan (simplified - assumes plan started this week)
  const currentWeekSchedule = plan.schedule[0];
  if (!currentWeekSchedule) return null;

  const todaySchedule = currentWeekSchedule.days.find(
    (d) => d.dayOfWeek === dayOfWeek
  );

  if (!todaySchedule || todaySchedule.isRestDay || !todaySchedule.sessionId) {
    return null;
  }

  return sessions.find((s) => s.id === todaySchedule.sessionId) ?? null;
}
