# UX Polishing Kickoff Prompt

Use this prompt at the start of the next UX refinement session.

---

We are beginning a UX polishing cycle for Dice Baseball. Focus on visual clarity, interaction pacing, play-by-play readability, and multiplayer feedback cues.

## Operating Mode
- Use the existing Playwright two-player automation matrix as the baseline.
- Prefer incremental changes with fast validation loops.
- Keep gameplay logic behavior stable unless explicitly requested.

## How to Run UI Automation (observe visually)
From:
`/Users/khyde/Desktop/tech.kevinhyde.com/apps/dice-baseball/frontend`

1. One-time browser setup (if needed)
```bash
npm run e2e:install
```

2. Headed smoke autoplay (quick visual check)
```bash
npm run e2e:autoplay
```

3. Full headed scenario matrix (primary UX review pass)
```bash
npm run e2e:matrix:headed
```

4. Optional pace controls for slower observation
```bash
E2E_STEP_DELAY_MS=900 npm run e2e:autoplay
```

5. Optional deterministic seed override (for before/after comparison)
```bash
E2E_GAME_SIM_SEED=ux-pass-001 npm run e2e:matrix:headed
```

## Current Scenario Coverage
- `smoke`: initial turn flow and baseline interaction sanity
- `midgame`: sustained loop behavior and UI consistency
- `fullgame`: game-over flow and end-state presentation
- `disconnect-reconnect`: opponent disconnect/reconnect UX

## Review Targets
1. Turn-state clarity (who acts now, when transitions happen)
2. Roll feedback timing and readability
3. Play log hierarchy and scannability
4. Scoreboard and inning context legibility
5. Disconnect/reconnect messaging and confidence cues
6. Visual polish opportunities (spacing, contrast, animation pacing)

## Working Agreement
- For each proposed UX tweak:
  - explain objective,
  - implement minimal change,
  - run relevant headed scenario,
  - report observations and regressions.
- Keep selector contract stable (`data-testid` hooks) unless replacing with better stable anchors.

---

Start by running `npm run e2e:autoplay`, summarize top 5 UX friction points, then propose a prioritized patch plan.
