# Design decisions — Department of Unnatural Forestry

The point of this file is that nothing tentative becomes a rule by accident.
Every entry carries a status:

- **FIXED** — a constraint of the actual party. Design around it.
- **SETTLED** — decided. Change it deliberately, and move the old version to
  *Superseded* so we remember what we tried.
- **PROVISIONAL** — implemented so something could run. Chosen by the engineer,
  not the designer. A placeholder.
- **OPEN** — not decided. Listed so it cannot be forgotten.

Last updated: 2026-10-15 (third pass: hunting and hiding cut; items, treasure and traps settled). The machine-readable version of everything in
sections B and C lives in `src/data/forest/*.json`.

---

## The game in six sentences

Every team is lost in the same forest, and the Department will issue exactly
one Form 7-B togame. Each round, a team secretly tells the Director which
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
| A1 | Played **exactly once**, at one party. | No iteration across sessions. The simulator exists to find games that would break, not to balance a product. |
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
| B2 | **The board is a valley narrowing to a single road out.** Teams start spread across the wide end, deep in the woods; each round the ground gets tighter; the Trailhead sits on the bottom EDGE of the board, where the road is — a trailhead is by definition where the forest meets a road, so it cannot be surrounded. The valley walls are impassable, so the funnel is the whole board. Not a hex grid. Not a hex grid — moves are not adjacency-constrained, so a tiling would be decoration. Places are named, not coordinates, because people shout names across a room. |
| B3 | **Moves are secret.** A team tells the Director its location and posture; nothing is placed on the board. The Director reveals everything at the round change. |
| B4 | **A team may name any location in the next band.** No adjacency. |
| B5 | **No hunting or hiding.** Cut — it only ever decided *whether* a meeting became a matchup, and that was where every stall came from. One decision a round: where do we go. |
| B6 | **If two teams meet, there is a fight, and only one walks away.** One rule for two teams or five. |
| B7 | **Terrain says how rich a place is** — open ground has the best treasure, deep cover has none. |
| B7a | **Every place carries a trivia theme**, printed on the map: Rock & Ruin, Root & Rot, Fur & Feather, Rain & River, Grease & Gravel, Forms & Procedures, Dark & Distant. A matchup fought there is asked on that subject. Choosing a place is therefore also choosing the subject you would rather be asked about — and teams badly overestimate what they know. Seven themes shared across twenty-two places, so there are seven sets of questions to write, not twenty-two. |
| B7b | **The Trailhead showdown is quick and chaotic** — the same matchup with the dice thrown in, so the best-equipped team is not a foregone conclusion. |
| B8 | **Every team draws three items before the game starts.** Nobody arrives empty-handed, and the first matchup already has something to spend. |
| B8a | **Win a matchup, draw a treasure. Lose a matchup, you are out and you set a hidden trap.** The symmetry is the whole after-match. |
| B8b | **The winner does NOT take the loser's items.** Tested both ways — taking them makes the leader unbeatable; see Finding F10. |
| B8c | **The Director makes ambiguous calls.** The rules do not have to be airtight. Judgement fills the gaps, and that is a feature at a party, not a gap in the design. |
| B9 | **Loot is visible on the printed map.** It is the bait that makes crowds form; hidden loot would make choices arbitrary. |
| B10 | **A team alone on a location takes its loot. Teams that merely coexist take nothing.** Hiding is safe and poor. |
| B11 | **Items are quiz helpers and hindrances.** A helper makes your own question easier (Owl's Counsel, The Congress of Crows, The Nurse Log Almanac, Shed Antler); a hindrance makes theirs harder (Fog, The Hum, The Lost Page). Seven, all with good tokens. |
| B12 | **Eliminated teams place hidden traps.** A trap strips one power-up. It never eliminates. |
| B13 | **Surviving on open ground earns a whisper from the Director** — normally where a trap is, which lets you avoid one. |
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
| C2 | A matchup is scored as *how good the team is at trivia* + *what their items are worth* + *the luck of the question*. `helpPerItem` is now **0.25** — see F8 for why. | `rules.json` |
| C7 | `everyMeetingIsAMatchup` is now **true** by default. The old hunting/hiding rules are still in the code behind the switch, for comparison only. | `rules.json` |
| C3 | Teams start with **zero** power-ups. | `rules.json` |
| C4 | A trap strips **1**; a noisy hunter drops **1**; one trap per dead team, from round 2. | `rules.json` |
| C5 | Target of **2–3 finalists**. My invention, not yours — see **D1**. | `rules.json` |
| C6 | Five behaviour archetypes (greedy, cautious, contrarian, adaptive, random) with a 55/30/15 preference softening so teams of a type do not all choose identically. A testing instrument, not a prediction. | `src/forest/strategy.ts` |

---

## D. Open questions

| # | Question |
| --- | --- |
| D1 | **How many finalists can the Trailhead examination actually handle?** Everything downstream is tuned to this and it is currently a guess. A six-way quiz may be better theatre than a duel. |
| D2 | **What is the Trailhead examination?** The game's climax and one of only two attention windows. |
| D3 | ~~Does hunting and hiding stay?~~ **Decided: cut.** See F6. |
| D4 | **How attractive should open ground be?** If nobody can hide there, nobody goes unless the loot justifies it. |
| D5 | **Does loot replenish between bands, or is the forest picked clean?** |
| D6 | **Can a team decline a fight it knows it will lose?** |
| D7 | **What exactly does the board teach without words?** A6 is the hardest constraint and nothing is drawn yet. |
| D8 | **How do teams submit moves?** Proposal: text the Director, so it works across three rooms and the deadline is announceable. |
| D9 | ~~Should terrain do more than hold treasure?~~ **Decided: it carries the trivia theme.** See B7a and F13. |
| D11 | ~~Does the Trailhead showdown need its own rules?~~ **Decided: quick, with a chaos element.** See B7b. |
| D12 | **Which seven themes, and how many questions each?** Seven sets is the writing job. Ten questions each is probably the floor. |
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
| Fights per game | 3.6 | 4.4 |

With eight opening locations for ten teams, pigeonhole forces only two
collisions, and most of those produce no fight because both teams hid. The
tight wedge fixes the funnel almost entirely. Its one new cost: **8% of games
end with a single finalist** and therefore no final challenge.

### F2 — Mutual hiding is a stable, game-ending equilibrium

If every team plays cautiously, **no fight ever happens**: 100% of those games
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

### F3 — Power-ups currently decide the game

The champion was the best-equipped team entering the finale in **87–95%** of
runs, while the sharpest trivia team won only **21–37%**. Under C2's fight
model the quiz is close to decoration. Lowering what one item is worth or raising `luck` in
`rules.json` moves this directly, and it is worth deciding how much a lifeline
*should* be worth before the tokens get made.

### F4 — The extremes both break, in opposite directions

| Scenario | Finalists | What goes wrong |
| --- | --- | --- |
| Everybody hides | mean 9.3 | Nothing happens all game |
| Everybody hunts the loot | mean 1.6 | **49% of games have no finale** — the field collapses in round 1 |
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
| A timid field produces a dead game | always | **never** |

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

what one item is worth moves the whole thing, at 800 runs each:

| what one item is worth | Champion was best-equipped | Champion was sharpest at trivia |
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
into the same two or three places and **54% of games end with a single
finalist**. Spreading loot evenly across each band (done, in
`map-quilsap-extraction.json`) helps but does not cure it.

This is the worst case and it is probably unrealistic: the archetypes have no
model of crowding, whereas real teams visibly do reason *"everyone's going to
the Bone Orchard, so let's not."* But it bounds the risk, and it says the
Director should avoid naming a single obviously-best location when explaining
the game.

### F10 — The new item rules fixed the biggest remaining problem

Drawing three items at the start, giving the winner a drawn treasure instead of
the loser's whole inventory, and setting what one item is worth to 0.25:

| | Before | **Now** |
| --- | --- | --- |
| Winner was the best-equipped team | 96% | **70%** |
| Winner was the sharpest at trivia | 19% | **35%** |
| Wins taken by one style of play | greedy 90%+ | greedy 47%, adaptive 30%, cautious 14%, contrarian 10% |

Taking the loser's whole inventory was the cause: it compounded, so one early
win made a team unbeatable. A single drawn treasure keeps the reward without
the runaway.

### F11 — There are no empty rounds

An earlier version of this file reported that half of games contained a round
where "nothing happened". That was my measurement being wrong, not the game: it
only counted matchups, and ignored teams collecting treasure and springing
traps. Counting those too, **0% of rounds are empty** in normal play. The
Director always has something to read out.

### F12 — Where the current design stands

Ten teams, 800 games:

- **92%** end with 2–3 teams at the Trailhead (mean 2.5)
- **3%** end with only one team, so no final showdown — **accepted, not a concern**
- **100%** of teams play at least one matchup; about 6 matchups per game
- **0%** empty rounds

Six teams: 93% on target, 4% with no showdown. The only flagged problem left in
normal play is that 3–4%.

### F13 — Trivia themes are the best mechanic in the game

Giving every place a subject, and giving every team an ability per subject
rather than one flat trivia rating, changed three things at once:

| | Before themes | **With themes** |
| --- | --- | --- |
| Winner was the best-equipped team | 70% | **58%** |
| Matchups won by the team that knew the subject best | — | **61%** |
| Wins taken by the leading style of play | 47% | **29%** |

Wins now spread almost evenly across every style: adaptive 29%, greedy 25%,
specialist 22%, contrarian 12%, cautious 12%. Nobody has the obviously right
approach, which is what you want when ten different groups of friends play it
once.

**It also cures the crowding collapse.** A field where every team chases the
richest spot still wipes itself out — 54% of games end with a single survivor.
A field where every team plays to its strengths does not: 84% land on 2–3 teams
at the Trailhead, only 2% on one.

The reason is worth keeping hold of: **treasure is an attractor everybody values
identically, so it concentrates the field. Knowledge is valued differently by
every team, so it spreads them out.** Putting a subject on each place is what
makes ten teams choose ten different things without being told to.

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
| Hunting vs hiding as a second decision each round | One decision: where do we go | F6 — it only decided whether a meeting happened, and that caused every stall. |
| The winner takes the loser's items | The winner draws one treasure | F10 — taking them compounds into an unbeatable leader. |
| Teams start empty-handed | Everyone draws three items | B8. |
| A ring layout with the Trailhead in the middle | A funnel with the Trailhead on the bottom edge | A trailhead is where the forest meets a road. Surrounding it with forest is nonsense. |
| Terrain decided whether teams met | Terrain holds treasure and carries the trivia theme | B7a — and themes turned out to be the mechanic that spreads the field out. |
| One flat trivia rating per team | An ability per theme | F13. |
| 91-hex and 61-hex boards | 8/5/3/1 and 5/3/2/1 wedges | B2. |
| "Elimination is a problem to be avoided" | Elimination from round 2 is welcome | A8. |

The hex-based prototype (`src/core/`, `src/render/`, `src/ui/`, `src/data/`
excluding `forest/`) is superseded by `src/forest/` but still builds and runs.
It should be removed once this design settles.
