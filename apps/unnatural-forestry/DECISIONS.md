# Design decisions — Department of Unnatural Forestry

The point of this file is that nothing tentative becomes a rule by accident.
Every entry carries a status:

- **FIXED** — a constraint of the actual party. Design around it.
- **SETTLED** — decided. Change it deliberately, and move the old version to
  *Superseded* so we remember what we tried.
- **PROVISIONAL** — implemented so something could run. Chosen by the engineer,
  not the designer. A placeholder.
- **OPEN** — not decided. Listed so it cannot be forgotten.

Last updated: 2026-10-15 (second pass: posture under review). The machine-readable version of everything in
sections B and C lives in `src/data/forest/*.json`.

---

## The game in six sentences

Every team is lost in the same forest, and the Department will issue exactly
one Form 7-B tonight. Each round, a team secretly tells the Director which
place it is heading for. The Director reveals all of it at once. If two teams
end up in the same place there is a trivia duel, and only one team walks away,
carrying the loser's power-ups. The forest narrows each round, so avoiding
everyone gets harder. Whoever is still standing meets at the Trailhead for the
Department's final examination.

*(Posture — hunting vs hiding — is under review. See **D3** and **Finding F6**:
the measurements say cutting it makes the game both simpler and more reliable.)*

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
| B5 | ~~**Posture: hunt or hide**~~ — **UNDER REVIEW**, see D3 / F6. |
| B6 | **If two teams meet, there is a fight, and only one walks away.** One rule for two teams or five. |
| B7 | ~~**Terrain decides whether hiding works**~~ — if posture goes, terrain's only mechanical roles are loot richness and intel. See D9. |
| B8 | ~~**A hunter who finds nobody drops a power-up**~~ — meaningless without posture. |
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
| C1 | Band widths **10 / 7 / 4 / 1** (`quilsap-extraction`, the current board) — swept against 800 runs per candidate, see F7. Also `quilsap-wedge` (8/5/3) and `quilsap-narrow` (5/3/2) kept for comparison. Width is the single biggest lever and it depends on whether posture stays. | `map-*.json` |
| C2 | Fight model `score = skill + itemEdge×items + luck(0..3)`, skill drawn 0..3. `itemEdge` is currently **1**, which makes power-ups decisive; **0.25 is the recommended value** — see F8. | `rules.json` |
| C7 | `allMeetingsFight` — the switch that removes posture from the game. Currently **false** by default; the `extraction-*` scenarios set it **true**. Flip the default once D3 is decided. | `rules.json` |
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
| D3 | **Does posture stay at all?** The live question. The quiz decides the winner regardless of how a team arrived, so posture's only job is deciding *whether* a fight happens — and that job is where every stall bug comes from. See F6: cutting it is simpler, removes the stall entirely, and lands the funnel on target 92% of the time. |
| D4 | **How attractive should open ground be?** If nobody can hide there, nobody goes unless the loot justifies it. |
| D5 | **Does loot replenish between bands, or is the forest picked clean?** |
| D6 | **Can a team decline a fight it knows it will lose?** |
| D7 | **What exactly does the board teach without words?** A6 is the hardest constraint and nothing is drawn yet. |
| D8 | **How do teams submit moves?** Proposal: text the Director, so it works across three rooms and the deadline is announceable. |
| D9 | **If posture goes, what is terrain for?** It would carry loot richness and intel but nothing else. Option: terrain changes the *flavour of the duel* — sudden death on the ridge, a bonus question in the bog — so it stays meaningful without adding a decision. |
| D10 | **What stops the field converging on one location?** F9 shows a uniform field wipes itself out. Spread loot evenly (done) and rely on teams reasoning about crowds — but that reasoning is exactly what the archetypes do not model. |

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

### F6 — Cutting posture is simpler AND more reliable

Ten teams, mixed behaviour, 800 runs each:

| | With posture | **Without posture** |
| --- | --- | --- |
| Mean finalists | 5.5–6.1 | **2.5** |
| Lands on 2–3 finalists | 2–12% | **92%** |
| A timid field produces a dead night | always | **never** |

Posture's only mechanical job was deciding whether a meeting became a fight,
and that job is where the stall came from. Removing it also removes the second
decision a drunk guest has to understand, which A6 wants. The debate it was
carrying moves to *when to spend a lifeline*, which comes free with the quiz
and teaches itself.

### F7 — With posture gone, the board must get wider, not narrower

Sweeping band widths at 800 runs each:

| Widths | Mean finalists | On target | No finale | Round 3 is dead |
| --- | --- | --- | --- | --- |
| 5/3/2 | 1.6 | 62% | **38%** | — |
| 8/5/3 | 2.2 | 90% | 10% | — |
| 10/7/3 | 2.2 | 91% | 9% | 22% |
| **10/7/4** | **2.5** | **92%** | **4%** | 36% |
| 10/7/5 | 2.7 | 90% | 1% | 46% |

**10/7/4** is the balance: a 4% chance of a single finalist against a liveable
36% chance that round 3 passes without a fight. Note a dead *round 3* matters
much less than a dead round 1 — everyone converges on the Trailhead immediately
afterwards anyway.

Band 1 wider than 10 changes nothing, because the archetypes concentrate on
their preferred places. Real teams would spread further, so this is conservative.

### F8 — How much a lifeline should be worth

`itemEdge` moves the whole thing, at 800 runs each:

| itemEdge | Champion was best-equipped | Champion was sharpest at trivia |
| --- | --- | --- |
| 0 (items do nothing) | 47% | 36% |
| **0.25** | **74%** | **29%** |
| 0.5 | 88% | 24% |
| 1 (current) | 95% | 20% |

47% is the floor, not zero: winning fights is how you get items, so the
best-equipped team is half the time simply the team that has been winning.
**0.25 is the recommendation** — a lifeline clearly helps without making the
quiz decoration. In real terms that makes one lifeline worth about 8% of the
range of trivia ability, which is roughly what "remove two wrong answers"
should be worth to a team that does not know the answer.

### F9 — A uniform field still wipes itself out

If every team behaves the same way — all cautious or all greedy — they crowd
into the same two or three places and **54% of nights end with a single
finalist**. Spreading loot evenly across each band (done, in
`map-quilsap-extraction.json`) helps but does not cure it.

This is the worst case and it is probably unrealistic: the archetypes have no
model of crowding, whereas real teams visibly do reason *"everyone's going to
the Bone Orchard, so let's not."* But it bounds the risk, and it says the
Director should avoid naming a single obviously-best location when explaining
the game.

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
