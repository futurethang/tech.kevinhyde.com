# UX Autoplay (Playwright)

This is a local R&D harness for visually reviewing two-player gameplay without manual clicking.

## What It Does
- Launches backend + frontend automatically
- Opens two browser contexts (simulates normal + incognito users)
- Runs quick dev login for both players
- Creates a game in player A, joins via code in player B
- Auto-rolls turns so you can watch play-by-play UI behavior
- Runs deterministic game simulation mode by default for reproducible UX review

## One-Time Setup
From `/Users/khyde/Desktop/tech.kevinhyde.com/apps/dice-baseball/frontend`:

```bash
npm install
npm run e2e:install
```

## Run Modes
From `/Users/khyde/Desktop/tech.kevinhyde.com/apps/dice-baseball/frontend`:

```bash
# Full e2e suite
npm run e2e

# Full scenario matrix (smoke + midgame + fullgame + disconnect/reconnect)
npm run e2e:matrix

# Matrix in visible mode
npm run e2e:matrix:headed

# Full suite in visible mode
npm run e2e:headed

# Focused smoke autoplay (visible)
npm run e2e:autoplay
```

## Tuning Speed/Length
You can tune autoplay behavior with env vars:

```bash
E2E_SMOKE_TURNS=12 E2E_STEP_DELAY_MS=900 npm run e2e:autoplay
```

- `E2E_SMOKE_TURNS` default: `10`
- `E2E_MIDGAME_TURNS` default: `60`
- `E2E_FULLGAME_TURNS` default: `280`
- `E2E_STEP_DELAY_MS` default: scenario-specific
- `E2E_IDLE_LIMIT` default: `25`

Deterministic replay controls:
- `E2E_GAME_SIM_MODE` default: `deterministic`
- `E2E_GAME_SIM_SEED` default: `playwright-seed`

## Ports
Defaults:
- Frontend: `5173`
- Backend: `3001`

Override if needed:

```bash
E2E_FRONTEND_PORT=5174 E2E_BACKEND_PORT=3002 npm run e2e:autoplay
```

## Stable Selector Contract
Core automation hooks are exposed via `data-testid`:
- `auth-quick-login`
- `nav-play-link`
- `play-team-select`
- `play-create-game`
- `play-join-code-input`
- `play-join-game`
- `play-created-join-code`
- `game-screen`
- `game-roll-button`
- `game-play-log`
- `game-opponent-disconnected`
- `game-inning-label`
- `game-over-screen`
