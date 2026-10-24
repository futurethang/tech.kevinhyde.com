# Department of Unnatural Forestry — Round Simulator

A development tool for prototyping a physical Halloween party game: teams of
woodland animals, lost in a Pacific Northwest forest, moving one hex per round
across a shared map toward trailheads on the perimeter.

**Start with `STATE-OF-PLAY.md`** — it is the handoff document and covers the
game, the board, production status and what is left to do.

The party is one night, one play, **three rounds**, up to ten teams, and one
facilitator who only has everyone's attention twice. `DECISIONS.md` holds the
constraints, what is settled, what is a placeholder, and what the simulator has
actually measured — **read it first**.

> **Two designs live here.** `src/forest/` is the current one: a game of secret
> location choice on a narrowing board, converging on a single exit, where any
> two teams that land together play a trivia matchup. Run it with `pnpm playtest`. `src/core/` + `src/render/` + `src/ui/` is
> the superseded hex prototype, kept until the new design settles; it is the
> thing `pnpm dev` still opens.

## The current design in one command

```bash
pnpm playtest          # 500 seeded runs of every scenario, with dead-end detection
pnpm playtest 2000     # more runs
pnpm playtest 400 narrow-mixed    # one scenario
```

Its ruleset is entirely JSON, in `src/data/forest/`:

| File | What it holds |
| --- | --- |
| `terrain.json` | How rich a place is, and whether surviving there earns a whisper from the Director |
| `items.json` | The quiz helpers and hindrances |
| `map-*.json` | Bands of named places, their terrain and the treasure lying there |
| `rules.json` | Every number that decides how the game feels, in plain names |
| `scenarios.json` | Named test games: team counts, styles of play, rule overrides |

The branching of a round is code (`src/forest/resolve.ts`) because it is
genuinely conditional logic. Everything that is a *number* is data, because the
numbers are what decide whether the game works.

This is **not the game**. It is a low-fidelity simulator used to test map
geometry and the simultaneous-round structure before any components get
manufactured. The map, the teams and the rule knobs all live in JSON so the same
definitions can later drive a printed board, cards and tokens.

Milestone 1 scope: hex map, teams, simultaneous move selection, round
resolution, encounters *reported* (not resolved), route analysis, and scripted
play so rounds can be advanced without hand-clicking every team.

## Running it

```bash
pnpm install          # from the repo root
pnpm dev              # http://localhost:5173
pnpm test             # unit tests
pnpm typecheck
pnpm build            # typecheck + production build into dist/
pnpm gen:map          # regenerate the map JSON files and print a route report
```

### Using the simulator

1. Pick a scenario from the dropdown.
2. Click a team in the roster. Its legal destinations are outlined on the map.
3. Click a highlighted hex, then **Lock in**. The panel advances to the next
   team that has not committed.
4. When every active team has committed, **Resolve round N** applies all moves
   at once and prints a round summary.
5. Click any hex at any time to inspect its coordinates, neighbours, terrain,
   clue, distance-to-exit and (with secrets on) its hidden contents.

A locked-in destination is shown only while that team is the one being handled,
so the board does not leak other teams' pending moves.

Checkboxes: distance-to-exit overlay, show hidden contents, reveal every
pending move, and a debug override that resolves a round with teams that have
not committed (they hold position).

Map controls: drag to pan, scroll to zoom, **Recentre map** to fit.

### Scripted play

Hand-clicking 10 teams a round is fine for checking a rule and miserable for
exploring one. The **Scripted play** block fills every team's move from a
strategy instead:

- **Re-roll all moves** — draws a fresh move for every active team and commits
  them. Press it again for a different draw. Resolve when you like what you see.
- **Auto round** — fill and resolve in one click.
- **Run to end** — play until every team is at a trailhead or the scenario's
  `maxRounds` is reached.

Three strategies, each a weighted draw over the legal moves graded by what they
do to the team's distance-to-exit (`src/core/strategy.ts`):

| Strategy | Behaviour |
| --- | --- |
| Beeline | Almost always takes a shortest route out |
| Balanced drift | Heads out, detours often enough to spread and collide |
| Lost in the woods | Barely goal-directed; covers the map, lots of contact |

These are a **testing instrument, not a model of how guests will play.** A real
table reads clues, chases items and avoids each other on purpose. Treat the
numbers as the shape of the space, not a prediction.

Scripted draws come from their own RNG stream, so re-rolling never perturbs the
seed that round resolution carries — and a run replays identically after
**Reset scenario** if you press the same buttons.

### Run report

Once a round has resolved, the panel shows measured outcomes of the run: rounds
to exit, moves per team, encounters split by kind, how many teams met anyone,
map coverage, and which trailheads got used. `src/core/stats.ts` computes it; it
is deliberately separate from `analysis.ts`, which measures what the *map*
allows before anyone moves.

One run is an anecdote. Compare seeds before believing anything.

## Architecture

The split the project depends on: **JSON data → pure TypeScript rules →
Phaser rendering → facilitator controls.** Phaser never owns game state, and the
rules never touch the DOM.

```
src/
  core/            pure TypeScript, no Phaser, no DOM
    hex.ts         axial coordinates, neighbours, distance, pixel layout
    types.ts       static config types (mirror the JSON files)
    validate.ts    hand-written validation primitives with JSON paths
    config.ts      parsers: JSON -> frozen, cross-checked config
    board.ts       derived read-only map graph (adjacency computed from q/r)
    state.ts       mutable simulation state, legal moves, occupancy
    rounds.ts      simultaneous round resolution (pure)
    analysis.ts    distance fields, shortest paths, route/fairness metrics
    rng.ts         seeded PRNG (mulberry32)
    simulation.ts  facilitator-facing controller around all of the above
  data/            the canonical game definitions (see below)
  render/          Phaser scene + pure pixel layout helpers
  ui/              view model + DOM control panel
tools/
  generate-map.ts  regenerates the district JSON files
tests/             vitest suites, incl. fixtures that never touch real data
```

`resolveRound` is a pure function: given a board, a scenario, a state, a set of
committed choices and a seed it always returns the same next state and summary,
and never mutates its inputs. That is what makes simultaneous resolution
order-independent — every destination is read from the pre-round state and all
of them are applied at once.

## Where the configuration lives

| File | What it holds |
| --- | --- |
| `src/data/terrain.json` | Terrain types: colour, passability, the clue printed on the map, and the risk/reward the map *appears* to signal |
| `src/data/items.json` | Item definitions (tracked, not yet applied) |
| `src/data/characters.json` | Animal characters and their one-line traits (recorded, not yet applied) |
| `src/data/maps/*.json` | Hex coordinates, terrain, trailheads, start positions, and facilitator-secret hex contents |
| `src/data/scenarios/*.json` | Which map, which teams, the seed, and the tunable rule parameters |

Maps and scenarios are picked up by glob, so **adding a scenario means adding a
JSON file** — no source changes.

Hex adjacency is never stored. It is derived from each hex's `q`/`r` at runtime,
so editing a map means editing coordinates and nothing else.

Hidden contents live in the map's `contents` array, deliberately separate from
`hexes`, so the hex list can be printed for players while `contents` stays on the
facilitator's sheet.

### Adding a scenario

Copy `src/data/scenarios/small-party-6.json`, change `id`, `teams` and `rules`,
and reload. Validation runs on load and names the exact JSON path of anything
wrong (`data/scenarios/x.json.teams[2].startHexId: unknown hex "Z9"`).

### Editing or regenerating a map

- **Small edits** — edit the JSON directly. Terrain ids, trailhead positions and
  contents are all plain strings.
- **A new district** — add a preset to `tools/generate-map.ts` (radius, seed,
  trailhead count, start count, barrier hexes) and run `pnpm gen:map`. It writes
  the JSON and prints the route report: exit distances per start, stranded
  hexes, unreachable trailheads, and route counts.

`tests/data.test.ts` asserts the invariants a district must hold (3–5 moves to
the nearest exit from every start, 6–10 perimeter trailheads, nothing stranded),
so a bad re-roll fails the suite rather than quietly shipping.

## What the simulator currently assumes

These are working assumptions, not settled rules. Each is a knob in a scenario's
`rules` block or a map preset:

- **One hex per round, always.** Terrain does not yet cost extra movement.
- **Reaching a trailhead qualifies a team; it does not win.** The final
  challenge is undecided and unimplemented.
- **Holding position is legal** (`allowStayInPlace`).
- **Two teams may swap hexes** (`allowSwaps`). When it is off, both teams bounce
  back and the round records a `blocked-swap`.
- **Collisions are reported, not resolved.** Two or more teams ending on one hex
  produce a `shared-hex` encounter; two teams trading hexes produce a `swap`
  encounter. No head-to-head mechanic exists yet.
- **Reaching an open trailhead parks a team** in the `at_trailhead` status. It
  stops moving and awaits an escape test that is not implemented. Nothing in
  milestone 1 sets `escaped` or `eliminated`.
- **Hidden contents only log.** With `revealHiddenContents` on, arriving at a hex
  announces its contents once; no hazard, item or delay is applied.
- **Character traits and items are recorded but inert.**
- **Scripted strategies ignore everything but exit distance.** They do not read
  clues, seek items, avoid other teams or respond to hazards.
- **Exploration** means "some team has stood here". There is no per-team fog.
- **`maxRounds` is advisory** — the UI and analysis use it, resolution does not
  enforce it.
- **The RNG is plumbed through but unused.** Round resolution in milestone 1 is
  fully deterministic; the seed and state are carried in every round summary so
  hazards and escape tests can draw from it later without breaking replay.

## Measured, not assumed

Route shape on the committed districts (`pnpm gen:map`):

- **Ranger District 01** — 61 hexes (59 passable), 6 trailheads, 10 starts.
- **Ranger District 02** — 61 hexes (58 passable), 6 trailheads, 6 starts.
- Every start is **exactly 3 moves** from its nearest trailhead — equal for every
  team, and exactly the move budget, so any detour costs the exit.

With a three-round cap, "reachable" is not enough; it has to be reachable *in
time*. The route analysis panel reports the move budget, whether every start is
feasible, whether starts are equidistant, and how many have zero slack.

Scripted-play findings (200 seeded runs each, 10 teams, 3 rounds) live in
`DECISIONS.md` section E. The short version: near-optimal play lands on the
target of 2–4 finalists 70% of the time, but a hard "reach the trailhead" gate
yields **no finalists at all in 3% of runs** and far more often once teams play
imperfectly; and teams meet each other only ~3.6 times per game, so most never
get a head-to-head. Both are open design problems, not tuning issues.

Scripted movement is not real play. Treat the numbers as the shape of the space.

## Not built yet

Deliberately out of scope for milestone 1, roughly in the order they matter:
hazard and reward effects, elimination, trailhead escape tests, head-to-head
encounter resolution, per-team fog of war, a committed batch runner over many
seeds, and an SVG/print export derived from the same map JSON.
