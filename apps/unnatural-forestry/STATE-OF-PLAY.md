# Department of Unnatural Forestry — state of play

**Handoff document.** Everything needed to pick this up cold. Written
2026-10-24, at the point where the rules and the board are settled and the work
turns to production.

Repo: `apps/unnatural-forestry/` in `futurethang/tech.kevinhyde.com`.
Branch: `claude/awesome-pasteur-mfz4bq`.

---

## 1. What this is

A Halloween party game, played **exactly once**, for 15–30 guests in teams of
2–3 (up to 10 teams). One facilitator — **the Director**. Three rounds, then a
final showdown. The whole thing runs while people mingle, eat and drink; the
Director only has the room's full attention twice, at the explanation and at the
finale.

There is a digital simulator in this repo, but it was never the deliverable. It
exists to stress-test the rules before anything gets printed, and it has done
that job.

---

## 2. The game, as settled

### The pitch

Every team is lost in the same forest. The Department will issue **exactly one
Form 7-B tonight**, at the Trailhead, and that is the only way out.

### A round

1. Each team secretly tells the Director **which place they are heading for** —
   one place from the next band of the map. Nothing is placed on the board;
   teams tell the Director directly.
2. The Director reveals every team's choice at once.
3. **Any two or more teams in the same place play a trivia matchup. Only one
   walks away.** Losers are out.
4. The winner **draws a treasure**. Each loser **sets a hidden trap** somewhere
   on the board for later rounds.

Three rounds. Then everyone still standing meets at the Trailhead.

### The matchup

- **4 questions.** The Trailhead showdown is **5**.
- Mostly four-option multiple choice; teams answer **simultaneously and in
  writing**, then reveal.
- The place's **theme** decides the subject.
- Ties are the Director's call — a bonus question, or just a ruling.

### Items

Every team draws **3 items** before the game. They are quiz helpers and
hindrances, spent during matchups.

| Item | Effect |
| --- | --- |
| Owl's Counsel | Two wrong answers removed from your question |
| The Congress of Crows | Ask the party |
| The Nurse Log Almanac | Skip this question, take another |
| Shed Antler | Hear their answer before you give yours |
| Fog | They answer first, aloud, no conferring |
| The Hum | They get ten seconds |
| The Lost Page | The Director picks their theme |

Treasure from winning a matchup is one more drawn item. **The winner does NOT
take the loser's items** — that was tested and it compounds into an unbeatable
leader.

### Traps

Each team knocked out sets **one hidden trap**. A trap **strips one item** from
every team that walks in. It never knocks anyone out. In play from round 2.

Surviving at a **vantage point** earns a whispered fact from the Director —
usually where a trap is, letting you dodge one.

### Before the showdown

Every team left draws one card from a chaos pile: half of it helps, half of it
bites. A curveball, not a new rule.

### The Director

Makes the ambiguous calls. The rules do not have to be airtight — judgement
fills the gaps, and that is a feature at a party.

---

## 3. The board — LOCKED

A **single large folded trail map**, printed like the thing you get at a
trailhead kiosk. One board, not per-team handouts.

The map is one **drainage basin**: a broad timbered basin at the top narrowing
between two ridgelines to a canyon mouth at the bottom edge, where the creek and
the only road leave together. The valley walls are impassable, so the funnel is
the whole board.

**Zone counts are locked at 10 / 7 / 4 / 1.**

| Band | Places | Light |
| --- | --- | --- |
| The Deep Woods | 10 | Late afternoon. The light is going |
| The Narrows | 7 | Dusk. You can still see the ground |
| The Last Mile | 4 | Full dark |
| The Trailhead | 1 | — |

The top two bands can drift by a place or two without hurting anything. **The
last band must stay at 4** — five there pushes games with four or more finalists
from 14% to 28%.

Artwork has been generated and approved: ink-and-watercolour trail map, zones
reading as sub-drainages each with its own feeder creek. `map-layout.svg` in
this folder is the generated geometry reference, not the artwork.

### Outstanding on the artwork

- **Colour should encode theme, not place.** Seven themes, seven colours,
  repeated — both Root & Rot zones the same green. At present every zone has its
  own colour, so a team cannot scan for "where is the Fur & Feather ground this
  round", which is the decision the game runs on.
- The dark-runs-inward gradient is not yet showing.
- All typography is still to come — image models cannot render legible place
  names, so the map was deliberately generated with no lettering.

---

## 4. The seven themes

A place's theme is **both its trivia subject and what that part of the map looks
like**. There is no separate terrain layer.

| Theme | Subject | Looks like |
| --- | --- | --- |
| ⛏ Rock & Ruin | Quarries, mining, masonry, geology | Bare rock, talus, broken masonry |
| ❦ Root & Rot | Trees, fungi, moss, forestry | Deep dank closed-canopy forest |
| ☙ Fur & Feather | Animals, birds, tracks, cryptids | Meadow and light woods |
| ≈ Rain & River | Weather, water, floods, fish | Creek bottom — runs the length of the map |
| ⚙ Grease & Gravel | Logging gear, trucks, roads | Logged out, stumps and slash |
| ▤ Forms & Procedures | Government, paperwork, regulations | Abandoned ranger station |
| ✷ Dark & Distant | Night sky, folklore, ghost stories | The same forest, at night |

Themes are arranged so the dark runs inward, and Rain & River appears in every
band because the creek runs through.

**Why this is the best mechanic in the game**: treasure is an attractor every
team values identically, so it concentrates them. A subject is valued
differently by every team, so it spreads them out. Putting a theme on each place
is what makes ten teams choose ten different things without being told to.

---

## 5. Where production stands

| Piece | Status |
| --- | --- |
| Rules | **Settled** |
| Board layout and zone counts | **Locked** |
| Map artwork | Generated and approved; needs theme-colour pass and typography |
| Quiz content | Brief written (`QUIZ-BRIEF.md`), questions not yet gathered |
| Item tokens | Designed as text; not made |
| Trap tokens | Not made |
| Chaos pile | Not made |
| Director's script | **Not written** |
| How teams submit moves | Proposed: text the Director. Not decided |

### The content ask

~51 questions. **40 in the bank**, each tagged to 2–3 themes so the Director
picks live; **5 for the Trailhead**; **6 bonus** for ties. About 25–30 get used
on the night. Full brief in `QUIZ-BRIEF.md` — it is written for someone who has
not seen any of this.

---

## 6. What the simulation established

5,000+ games per result, ten teams, mixed styles of play. Behaviour archetypes
are a testing instrument, not a prediction.

| | |
| --- | --- |
| Teams at the Trailhead | mean **2.7**; **85%** of games land on 2–3; **3%** on one |
| Matchups per game | **6.1** — about 2.9 / 1.3 / 1.0 across the three rounds |
| Teams who play at least one matchup | **100%** |
| Rounds where nothing happens | **0%** |
| Matchups won by whoever knew the subject best | **63%** |
| Winner was the best-equipped team | 66% |
| Winner was the sharpest at trivia overall | 21% |
| Wins by style of play | adaptive 34%, greedy 28%, specialist 24%, cautious 7%, contrarian 6% |

Things that were tried and rejected, with the evidence, are in `DECISIONS.md`
section F. The short version:

- **Hunting vs hiding was cut.** It only decided *whether* a meeting became a
  matchup, and a timid field could produce a night where nothing happened at all.
- **A ring-shaped board was wrong.** A trailhead is where the forest meets a
  road; it sits on an edge.
- **Winner-takes-all on items was wrong.** It compounded.
- **The old hex-grid design was abandoned** once moves stopped being
  adjacency-constrained.

### Known residual risk

If *every* team behaves identically — all chasing treasure, or all playing it
safe — they crowd into the same two or three places and about half of games end
with a single survivor and no showdown. The archetypes have no model of
crowding, which real teams visibly do have. Practical mitigation: **when
explaining the game, do not point at one obviously-best place.**

---

## 7. The repo

### Documents

| File | What it is |
| --- | --- |
| `STATE-OF-PLAY.md` | This file |
| `DECISIONS.md` | Every decision with its status — fixed / settled / provisional / open — plus measured findings and a superseded table |
| `QUIZ-BRIEF.md` | The content brief for the quiz master. Standalone |
| `QUIZ-RESEARCH-PROMPT.md` | Copy-paste prompt for a research agent to generate the 58 questions |
| `ART-PROMPTS.md` | Image-generation prompts for the map, and what to do by hand |
| `README.md` | Developer orientation for the simulator |

### The simulator

```bash
pnpm install              # from the repo root
pnpm playtest             # 500 games of every scenario, with problems flagged
pnpm playtest 2000        # more
pnpm playtest 800 extraction-mixed
pnpm map:draw             # regenerate map-layout.svg from the data
pnpm test                 # 229 tests
pnpm typecheck
```

Game data — all of it JSON, in plain names:

| File | Holds |
| --- | --- |
| `src/data/forest/map-quilsap-extraction.json` | The bands, the places, their themes, vantage points, treasure |
| `src/data/forest/topics.json` | The seven themes: subject, look, colour, spookiness |
| `src/data/forest/items.json` | The seven quiz helpers and hindrances |
| `src/data/forest/rules.json` | Every tunable number |
| `src/data/forest/scenarios.json` | Named test games |

Engine — pure TypeScript, no UI:

| File | Does |
| --- | --- |
| `src/forest/types.ts` | Config types, mirroring the JSON |
| `src/forest/config.ts` | Parsers with JSON-path errors |
| `src/forest/resolve.ts` | One band resolved. Pure, deterministic, order-independent |
| `src/forest/engine.ts` | A whole game |
| `src/forest/strategy.ts` | Behaviour archetypes |
| `src/forest/stats.ts` | Batch statistics and problem detection |
| `src/forest/ruleset.ts` | Loads and cross-validates the JSON |
| `tools/playtest.ts` | The batch runner |
| `tools/draw-map.ts` | Draws the layout reference from the data |

### Dead weight — first job for a fresh session

The original hex-grid prototype is still in the repo and still builds:
`src/core/`, `src/render/`, `src/ui/`, `src/main.ts`, `src/data/*.json` (the
files at the root of `src/data/`, not `src/data/forest/`), `src/data/maps/`,
`src/data/scenarios/`, `tools/generate-map.ts`, and the tests that cover them.
`pnpm dev` still opens it. `DECISIONS.md` records that it should go.

**Two things to know before deleting it:**

1. `src/forest/` still imports `src/core/rng.ts` and `src/core/validate.ts`.
   Move those into `src/forest/` first.
2. The app is registered in the repo's `apps-manifest.json` and deploys to
   `tech.kevinhyde.com/apps/unnatural-forestry`. Removing `index.html` and the
   Vite app will break that page. Either drop the manifest entry or replace the
   page with something — a view of the board and the rules would be a reasonable
   thing to put there.

---

## 8. Open questions

| | |
| --- | --- |
| **How do teams submit moves?** | Proposal: text the Director, so it works across rooms and the deadline is announceable. Not decided |
| **The Director's script** | Not written. Needs the explanation, the three reveals, and the finale |
| **The Trailhead's theme** | The map data themes it Forms & Procedures; the quiz brief asks for the final five to be mixed subjects. Harmless either way, needs settling |
| **What eliminated guests do** | They set a trap. Beyond that, nothing. Round 1 can put four teams out, so it is worth a thought |
| **Does a team see how many teams are left?** | Assumed yes — eliminations are public. Never explicitly decided |

---

## 9. What to do next

1. **Colour the map by theme** — seven colours repeated, not twenty-one unique.
   Highest-value visual fix; the game's main decision depends on it.
2. **Typeset the board**: 21 place names, theme labels, legend, title block, the
   Department's marginalia.
3. **Gather the questions** — paste `QUIZ-RESEARCH-PROMPT.md` into a research
   agent; `QUIZ-BRIEF.md` is the human-facing version of the same ask.
4. **Make the tokens**: 7 item types, trap markers, the chaos pile.
5. **Write the Director's script.**
6. **Clean the repo** per section 7.

The rules do not need more simulation. If a rule does change, the engine is
still there and `pnpm playtest` will tell you what it costs.
