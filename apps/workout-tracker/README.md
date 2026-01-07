# Workout Tracker PWA

A progressive web app for tracking workouts with timed sets, rest periods, and progress logging.

## Features

- **Workout Timer**: Alternating active/rest timer with customizable durations
  - Green background during active sets
  - Yellow background during rest periods
  - Audio and haptic feedback
  - Skip to rest for rep-based exercises

- **Exercise Tracking**
  - Track weight used per exercise
  - Log reps completed
  - Mark exercises complete
  - Auto-logging from timer completion

- **Workout Plans**
  - Daily scheduled workouts
  - Multiple session types
  - Full plan overview

- **PWA Features**
  - Install to home screen
  - Works offline
  - Screen wake lock during workouts

## Exercise Types

- `weight` - Traditional weight lifting (reps-based)
- `active_time` - Time-based AMRAP (as many reps as possible)
- `cardio` - Cardio exercises
- `bodyweight` - Bodyweight exercises
- `core` - Core/ab exercises
- `stretch` - Stretching/flexibility

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Customizing Workouts

Edit `src/data/samplePlan.ts` to add your own workout plan. The data structures are defined in `src/types/workout.ts`.
