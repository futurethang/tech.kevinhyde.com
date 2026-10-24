# Department of Unnatural Forestry

A Halloween party game for 15–30 guests, played exactly once, and the simulator
built to stress-test its rules before anything gets printed.

Teams move secretly across a single board — a forested valley narrowing to one
road out — and any two teams that land in the same place play a trivia matchup
where only one walks away. Three rounds, then a final showdown at the Trailhead.

> **Start with [`STATE-OF-PLAY.md`](STATE-OF-PLAY.md).** It is the handoff
> document: the game as settled, the board, production status, what the
> simulation established, and what is left to do. This file only covers the code.

| Document | What it is |
| --- | --- |
| [`STATE-OF-PLAY.md`](STATE-OF-PLAY.md) | Where everything stands. Read first |
| [`DECISIONS.md`](DECISIONS.md) | Every decision with its status, the measured findings, and what was tried and rejected |
| [`QUIZ-BRIEF.md`](QUIZ-BRIEF.md) | The content brief for the quiz master. Standalone |
| [`ART-PROMPTS.md`](ART-PROMPTS.md) | Image-generation prompts for the printed map |

---

## Running it

```bash
pnpm install                        # from the repo root
pnpm playtest                       # 500 games of every scenario
pnpm playtest 2000                  # more games
pnpm playtest 800 extraction-mixed  # one scenario
pnpm map:draw                       # regenerate map-layout.svg from the data
pnpm test                           # 229 tests
pnpm typecheck
```

`pnpm playtest` prints, per scenario: how many teams reach the Trailhead, how
many matchups happened and when, how many teams got into one at all, who won and
why, and an explicit list of **problems** — a game with no final showdown, a
round where nothing happened, items deciding everything, or avoiding everybody
turning out to be a winning strategy.

There is no UI. The simulator answers questions about the rules; it was never
meant to be played.

---

## The data

All of it JSON, in `src/data/forest/`, named in plain words.

| File | Holds |
| --- | --- |
| `map-quilsap-extraction.json` | The bands, the places, their themes, vantage points and treasure |
| `topics.json` | The seven themes — subject, what that ground looks like, colour |
| `items.json` | The seven quiz helpers and hindrances |
| `rules.json` | Every tunable number |
| `scenarios.json` | Named test games: team counts and styles of play |

The branching of a round is code, because it is genuinely conditional logic.
Everything that is a *number* is data, because the numbers are what decide
whether the game works.

Changing the board means editing `map-quilsap-extraction.json` and running
`pnpm map:draw`. Changing how the game feels means editing `rules.json` and
running `pnpm playtest` to see what it cost.

---

## The engine

Pure TypeScript in `src/forest/`. Deterministic: the same seed reproduces a
game exactly, and nothing depends on the order teams are stored in.

| File | Does |
| --- | --- |
| `types.ts` | Config types, mirroring the JSON |
| `config.ts` | Parsers, with errors that name the exact JSON path |
| `ruleset.ts` | Loads and cross-validates everything |
| `resolve.ts` | One band resolved. Pure — state in, new state out |
| `engine.ts` | A whole game: three rounds plus the Trailhead |
| `strategy.ts` | Behaviour archetypes standing in for how guests might play |
| `stats.ts` | Batch statistics and problem detection |
| `tools/playtest.ts` | The batch runner |
| `tools/draw-map.ts` | Draws `map-layout.svg` from the data |

Archetypes are a **testing instrument, not a prediction**. A real table bluffs,
holds grudges and follows whoever shouts loudest.

---

## Still in the tree: the hex prototype

The first design — a hex grid with trailheads around the perimeter — is
superseded but still present and still builds: `src/core/`, `src/render/`,
`src/ui/`, `src/main.ts`, the JSON at the root of `src/data/`, `src/data/maps/`,
`src/data/scenarios/`, `tools/generate-map.ts` and their tests. `pnpm dev` opens
it.

Before removing it, see `STATE-OF-PLAY.md` section 7 — `src/forest/` still
imports two modules from `src/core/`, and deleting the Vite app will break the
page this repo publishes at `tech.kevinhyde.com/apps/unnatural-forestry`.
