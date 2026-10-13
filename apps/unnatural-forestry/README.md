# Department of Unnatural Forestry — Round Simulator

A development tool for prototyping a physical Halloween party game: teams of
woodland animals, lost in a Pacific Northwest forest, moving one hex per round
across a shared map toward trailheads on the perimeter.

This is **not the game**. It is a low-fidelity simulator used to test map
geometry and the simultaneous-round structure before any components get
manufactured. The map, the teams and the rule knobs all live in JSON so the same
definitions can later drive a printed board, cards and tokens.

Milestone 1 scope: hex map, teams, simultaneous move selection, round
resolution, encounters *reported* (not resolved), and route analysis.

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

Checkboxes: distance-to-exit overlay, show hidden contents, and a debug override
that resolves a round with teams that have not committed (they hold position).

Map controls: drag to pan, scroll to zoom, **Recentre map** to fit.

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
- **Exploration** means "some team has stood here". There is no per-team fog.
- **`maxRounds` is advisory** — the UI and analysis use it, resolution does not
  enforce it.
- **The RNG is plumbed through but unused.** Round resolution in milestone 1 is
  fully deterministic; the seed and state are carried in every round summary so
  hazards and escape tests can draw from it later without breaking replay.

## Measured, not assumed

Numbers from `pnpm gen:map` on the committed districts:

- **Ranger District 01** — 91 hexes (84 passable), 8 trailheads, 10 starts.
  Nearest exit 3–4 moves (mean 3.70). No stranded hexes, no unreachable exits.
- **Ranger District 02** — 61 hexes (58 passable), 6 trailheads, 6 starts.
  Nearest exit 3–4 moves (mean 3.50).

These are *optimal* route lengths with no hazards, detours or forced retreats, so
a real game runs longer than this floor. Route choice is uneven: some starts have
three or four first steps that all stay on an optimal route, while others have
exactly one — worth looking at before the map is finalised.

## Not built yet

Deliberately out of scope for milestone 1, roughly in the order they matter:
hazard and reward effects, elimination, trailhead escape tests, head-to-head
encounter resolution, per-team fog of war, batch simulation with scripted
strategies, and an SVG/print export derived from the same map JSON.
