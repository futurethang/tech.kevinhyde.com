# Design decisions — Department of Unnatural Forestry

The point of this file is that nothing tentative becomes a rule by accident.
Every entry carries a status:

- **FIXED** — a constraint of the actual party. Design around it.
- **SETTLED** — decided. Change it deliberately, and move the old version to
  *Superseded* so we remember what we tried.
- **PROVISIONAL** — implemented so something could run. Chosen by the engineer,
  not the designer. A placeholder.
- **OPEN** — not decided. Listed so it cannot be forgotten.

Last updated: 2026-10-15. The machine-readable version of everything in
sections B and C lives in `src/data/forest/*.json`.

---

## The game in six sentences

Every team is lost in the same forest, and the Department will issue exactly
one Form 7-B tonight. Each round, a team secretly tells the Director which
place it is heading for and whether it is going in **hunting** or **hiding**.
The Director reveals all of it at once. If two teams end up in the same place
and anybody came hunting, there is a trivia duel and only one team walks away,
carrying the loser's power-ups. The forest narrows each round, so avoiding
everyone gets harder. Whoever is still standing meets at the Trailhead for the
Department's final examination.

---

## A. Fixed constraints

| # | Constraint | Consequence |
| --- | --- | --- |
| A1 | Played **exactly once**, at one party. | No iteration across sessions. The simulator exists to find nights that would break, not to balance a product. |
| A2 | 15–30 guests, teams of 2–3, **up to 10 teams**. | Everything resolves for 10 teams at once. |
| A3 | **No more than 3 rounds**, then one winning team. | Three secret choices and a finale. |
| A4 | Attention only in **brief windows** — the explanation and the finale. | Moves are submitted asynchronously while people mingle. |
| A5 | **One facilitator** (the Director). | Resolution must be fast and mechanical. |
| A6 | Rules must be **legible to a drunk person**, carried by the board's design and symbols. | Minimal text. Iconography teaches. |
| A7 | Reaching the Trailhead is **not victory** — it qualifies a team for a final challenge among 2+ teams. | The map phase is a qualifier. |
| A8 | **Elimination from round 2 onward is welcome.** | Being out returns a guest to the party. |
| A9 | Head-to-head may **strengthen or weaken** either team. | Winner takes the loser's power-ups. |
| A10 | The game wants **freeform creative play**. | Performative resolutions over mechanical ones. |

---

## B. Settled mechanics

| # | Decision |
| --- | --- |
| B1 | **One exit.** Everyone converges on the Trailhead. No perimeter, no choice of destination. |
| B2 | **The board is a wedge of named places in bands**, narrowing toward the Trailhead. Not a hex grid — moves are not adjacency-constrained, so a tiling would be decoration. Places are named, not coordinates, because people shout names across a room. |
| B3 | **Moves are secret.** A team tells the Director its location and posture; nothing is placed on the board. The Director reveals everything at the round change. |
| B4 | **A team may name any location in the next band.** No adjacency. |
| B5 | **Posture: hunt or hide**, committed at the same time as the location. |
| B6 | **If anybody hunted, there is a fight, and only one team walks away.** One rule for two teams or five. |
| B7 | **Terrain decides whether hiding works.** Open ground: no hiding, any two teams fight, best loot. Mixed cover: a fight only if someone hunted. Deep cover: a sanctuary — see **Finding F2**, this is the rule the simulation broke. |
| B8 | **A hunter who finds nobody drops a power-up.** Noise has a cost. |
| B9 | **Loot is visible on the printed map.** It is the bait that makes crowds form; hidden loot would make choices arbitrary. |
| B10 | **A team alone on a location takes its loot. Teams that merely coexist take nothing.** Hiding is safe and poor. |
| B11 | **Power-ups are quiz lifelines** — Owl's Counsel, The Congress of Crows, Fog, Shed Antler. Four, with good tokens. |
| B12 | **Eliminated teams place hidden traps.** A trap strips one power-up. It never eliminates. |
| B13 | **Surviving on open ground earns intel** — one whispered fact from the Director, normally a trap location, which dodges one trap. |
| B14 | **The fight is a trivia quiz.** Known-good at this party. |
| B15 | **No hide tokens.** Hiding is limited by its own cost — you arrive at the Trailhead with nothing — not by a resource. |
| B16 | **Public information:** the map, every location's terrain and visible loot, how many teams are alive, who died last round. **Private:** your own inventory. **Hidden:** where everyone else is, where they are going, where the traps are. |

---

## C. Provisional — in the data, not decided

Everything here is a number in `src/data/forest/`, and changing it is a data
edit, not a code change.

| # | Placeholder | File |
| --- | --- | --- |
| C1 | Band widths **8 / 5 / 3 / 1** (`quilsap-wedge`) and the tighter **5 / 3 / 2 / 1** (`quilsap-narrow`). See Finding F1 — the width is the single biggest lever. | `map-*.json` |
| C2 | Fight model `score = skill + 1×items + luck(0..3)`, skill drawn 0..3. This stands in for the quiz so we can ask whether power-ups decide everything. | `rules.json` |
| C3 | Teams start with **zero** power-ups. | `rules.json` |
| C4 | A trap strips **1**; a noisy hunter drops **1**; one trap per dead team, from round 2. | `rules.json` |
| C5 | Target of **2–3 finalists**. My invention, not yours — see **D1**. | `rules.json` |
| C6 | Five behaviour archetypes (greedy, cautious, contrarian, adaptive, random) with a 55/30/15 preference softening so teams of a type do not all choose identically. A testing instrument, not a prediction. | `src/forest/strategy.ts` |

---

## D. Open questions

| # | Question |
| --- | --- |
| D1 | **How many finalists can the Trailhead examination actually handle?** Everything downstream is tuned to this and it is currently a guess. A six-way quiz may be better theatre than a duel. |
| D2 | **What is the Trailhead examination?** The night's climax and one of only two attention windows. |
| D3 | **Does mutual hiding need a cost?** This is the live one — see Finding F2. |
| D4 | **How attractive should open ground be?** If nobody can hide there, nobody goes unless the loot justifies it. |
| D5 | **Does loot replenish between bands, or is the forest picked clean?** |
| D6 | **Can a team decline a fight it knows it will lose?** |
| D7 | **What exactly does the board teach without words?** A6 is the hardest constraint and nothing is drawn yet. |
| D8 | **How do teams submit moves?** Proposal: text the Director, so it works across three rooms and the deadline is announceable. |

---

## E. Measured findings

Method: `pnpm playtest`, 400 seeded runs per scenario, `src/forest/`. Behaviour
archetypes are a testing instrument and **not** a prediction of how guests play;
read these as the shape of the space.

### F1 — Board width is the main lever, and the wide board does not work

Ten teams, mixed behaviour:

| | Wide wedge (8/5/3) | Tight wedge (5/3/2) |
| --- | --- | --- |
| Mean finalists | 6.1 | **3.0** |
| On target (2–3) | 2% | **61%** |
| Nights with a dead round | 60% | **25%** |
| Fights per night | 3.6 | 4.4 |

With eight opening locations for ten teams, pigeonhole forces only two
collisions, and most of those produce no fight because both teams hid. The
tight wedge fixes the funnel almost entirely. Its one new cost: **8% of nights
end with a single finalist** and therefore no final challenge.

### F2 — Mutual hiding is a stable, game-ending equilibrium

If every team plays cautiously, **no fight ever happens**: 100% of those nights
contain a dead round, and the field finishes with a mean of 6.9–9.3 teams
standing. The reason is structural, not a tuning accident: two teams that both
hide never interact, so a whole field of hiders is self-protecting.

Downgrading deep cover from a sanctuary to ordinary quiet ground helps a little
(mean finalists 6.1 → 5.5 in mixed play) but **does not fix it**, because
mutual hiding is costless on *every* terrain, not just in deep cover.

The proposed fix, not yet implemented because it is a design decision:
**two teams that choose the same place find each other, whatever they
intended.** Posture would then decide the *terms* of the fight — who gets the
drop — rather than whether it happens at all. That removes the opt-out entirely
and makes location choice carry all the risk.

### F3 — Power-ups currently decide the night

The champion was the best-equipped team entering the finale in **87–95%** of
runs, while the sharpest trivia team won only **21–37%**. Under C2's fight
model the quiz is close to decoration. Lowering `itemEdge` or raising `luck` in
`rules.json` moves this directly, and it is worth deciding how much a lifeline
*should* be worth before the tokens get made.

### F4 — The extremes both break, in opposite directions

| Scenario | Finalists | What goes wrong |
| --- | --- | --- |
| Everybody hides | mean 9.3 | Nothing happens all night |
| Everybody hunts the loot | mean 1.6 | **49% of nights have no finale** — the field collapses in round 1 |
| Everybody guesses at random | mean 3.6 | Healthiest of the three |

The greedy collapse is the sharper risk: when everyone converges on the single
best-loot location, one fight eliminates most of the field immediately.
Spreading loot more evenly across each band is the obvious counter and is a
pure data edit.

### F5 — Contact is no longer the problem

Every scenario now puts **100% of teams** into at least one fight at some point,
against ~3.6 per *game* on the old hex design. Converging on one exit solved
that completely.

---

## F. Superseded

| Was | Now | Why |
| --- | --- | --- |
| 6–10 trailheads around the perimeter | One exit, at the centre | Encounters were far too rare; the Dark Forest premise needs convergence. |
| Hex grid with derived adjacency | Bands of named places | Moves are not adjacency-constrained, so hexes did no work. |
| Teams move one adjacent hex per round | A team names any location in the next band | B4. |
| Routes of 3–5 moves; equidistant starts | Three bands and a finale | A3. |
| Reaching a trailhead qualifies you | Reaching the Trailhead *is* the finale's location | B1. |
| Hide tokens as a scarce resource | No tokens | B15. |
| 91-hex and 61-hex boards | 8/5/3/1 and 5/3/2/1 wedges | B2. |
| "Elimination is a problem to be avoided" | Elimination from round 2 is welcome | A8. |

The hex-based prototype (`src/core/`, `src/render/`, `src/ui/`, `src/data/`
excluding `forest/`) is superseded by `src/forest/` but still builds and runs.
It should be removed once this design settles.
