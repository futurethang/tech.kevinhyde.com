# Daily Baseline

A minimalist PWA for tracking a fixed daily bodyweight workout routine. Log reps (or time for plank) for six exercises each day — no accounts, no server, no complexity.

## Exercises

1. Dead Bugs (reps)
2. Squats (reps)
3. Push-ups (reps)
4. Rows (reps)
5. Glute Bridges (reps)
6. Plank (timed)

## Features

- Step-through workout flow — one exercise per screen
- Built-in stopwatch timer for plank
- Monthly heatmap calendar showing completed days
- Data stored in localStorage (works offline)
- Import/export data as JSON for backup
- Installable as a PWA (works offline after first load)

## Setup

No build step required. Serve these files from any static host:

```bash
# Local development
npx serve .

# Or just push to GitHub Pages
```

## Files

- `index.html` — Complete app (single file)
- `sw.js` — Service worker for offline support
- `manifest.json` — PWA manifest
