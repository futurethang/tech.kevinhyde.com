# UX Autoplay (Playwright)

This is a local R&D harness for visually reviewing two-player gameplay without manual clicking.

## What It Does
- Launches backend + frontend automatically
- Opens two browser contexts (simulates normal + incognito users)
- Runs quick dev login for both players
- Creates a game in player A, joins via code in player B
- Auto-rolls turns so you can watch play-by-play UI behavior

## One-Time Setup
From `/Users/khyde/Desktop/tech.kevinhyde.com/apps/dice-baseball/frontend`:

```bash
npm install
npm run e2e:install
```

## Run Modes
From `/Users/khyde/Desktop/tech.kevinhyde.com/apps/dice-baseball/frontend`:

```bash
# Full e2e suite (default)
npm run e2e

# Visible mode
npm run e2e:headed

# Focused two-player autoplay (visible)
npm run e2e:autoplay
```

## Tuning Speed/Length
You can tune autoplay behavior with env vars:

```bash
E2E_MAX_TURNS=120 E2E_STEP_DELAY_MS=1000 npm run e2e:autoplay
```

- `E2E_MAX_TURNS` default: `60`
- `E2E_STEP_DELAY_MS` default: `700`
- `E2E_IDLE_LIMIT` default: `25`

## Ports
Defaults:
- Frontend: `5173`
- Backend: `3001`

Override if needed:

```bash
E2E_FRONTEND_PORT=5174 E2E_BACKEND_PORT=3002 npm run e2e:autoplay
```
