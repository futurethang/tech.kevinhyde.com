# Design decisions — Department of Unnatural Forestry

The point of this file is that nothing tentative becomes a rule by accident.
Every entry carries a status:

- **FIXED** — a constraint of the actual party. Not up for negotiation; design
  around it.
- **SETTLED** — decided. Change it deliberately, and move the old version to
  *Superseded* so we remember what we tried.
- **PROVISIONAL** — implemented in the simulator so something could run. Chosen
  by the engineer, not the designer. Treat as a placeholder.
- **OPEN** — not decided. Listed so it cannot be forgotten.

Last updated: 2026-10-14.

---

## A. Fixed constraints

| # | Constraint | Consequence |
| --- | --- | --- |
| A1 | The game is played **exactly once**, at one party. | No iteration across sessions. The sim exists to make the one night not break, not to balance a product. Spend the whole content budget on one night; replayability is worthless. |
| A2 | 15–30 guests, teams of 2–3, **up to 10 teams**. | Everything must resolve for 10 teams at once. |
| A3 | **No more than 3 rounds**, then one winning team. | The move budget is tiny. See C1. |
| A4 | Attention is only available in **brief windows** — the explanation and the finale. The rest is mingling, eating, drinking. | Rounds must be committable asynchronously: a team walks up, makes its move, walks away. The facilitator resolves on a cutoff, not on everyone being present. |
| A5 | **One facilitator.** | Resolution for 10 teams must be fast and mechanical. No per-team bookkeeping that needs a spreadsheet. |
| A6 | Rules must be **legible to a drunk person** and carried by the board's own design and symbols, not by a rules sheet nobody reads. | Minimal text. Iconography does the teaching. Anything needing a paragraph of explanation is out. |
| A7 | Reaching a trailhead is **not victory** — it qualifies a team for a final challenge among 2+ teams. | The map phase is a *qualifier*. Its job is to winnow ~10 teams to a handful, entertainingly. |
| A8 | **Elimination from round 2 onward is welcome.** | Being out is fine: the default activity is the party. This dissolves the "finished teams have nothing to do" worry from earlier. |
| A9 | Head-to-head encounters may **strengthen or weaken** either team. | Not purely a penalty. Outcomes are symmetric. |
| A10 | The game wants **freeform creative play** — room for teams to ham it up. | Favour performative resolutions (dares, improv, show-and-tell) over mechanical ones. |

---

## B. Settled mechanics

| # | Decision |
| --- | --- |
| B1 | One shared hex map; all teams on the same board. |
| B2 | Teams begin in separated interior positions, never clustered at the centre. |
| B3 | 6–10 trailheads around the perimeter. |
| B4 | All teams commit their move before the facilitator resolves the round publicly. No sequential turn-taking. |
| B5 | A team moves one adjacent hex per round. |
| B6 | Hexes may hold hazards, rewards, clues, special locations, or misleading visual cues. |
| B7 | The map is compact and physically printable. |
| B8 | **All starts sit the same distance from their nearest trailhead.** One play means nobody gets to discover afterwards that their start was worse. Enforced by the generator and asserted in tests. |

---

## C. Provisional — implemented, not decided

| # | Placeholder | Why it is a placeholder |
| --- | --- | --- |
| C1 | **Move budget = 3** (3 rounds × 1 hex), with every start **exactly 3** moves from an exit — zero slack, so any detour costs the exit unless something refunds a move. | Follows mechanically from A3 + B5. The *zero slack* part is a design choice I made to sharpen the risk/reward decision; see Finding F1 for what it costs. `targetExitDistance` in `tools/generate-map.ts` is the knob. |
| C2 | Holding position is legal. | Never discussed. |
| C3 | Two teams may swap hexes. | Never discussed; `allowSwaps` turns it off. |
| C4 | An encounter triggers only when teams **end on the same hex**. | Arbitrary. Adjacency would trigger far more contact — see Finding F3. |
| C5 | Encounters are *reported*, not resolved. | D2 is undecided. |
| C6 | Terrain carries a visible risk/reward "signal" that hidden contents may contradict. | A bluff layer. May be too subtle for A6 — a sign that obviously and comically lies may serve better than quiet contour-line trickery. |
| C7 | 61-hex map (radius 4), 6 trailheads, 10 starts. | Smallest shape that supports 3-move routes for 10 distinct, equidistant starts. Radius 3 cannot do it (max distance to an exit is 2). |
| C8 | Scripted strategies for testing drift toward the exit and ignore everything else. | A testing instrument, not a model of play. |
| C9 | Items and character traits are recorded but inert. | Depends on D4. |

---

## D. Open questions

| # | Question | Notes |
| --- | --- | --- |
| D1 | **How is the field guaranteed to produce 2–4 finalists?** | Currently it is not; see Finding F1. A hard "reach the trailhead or you're out" gate can produce zero finalists. The leading proposal is to qualify the N teams *closest* to an exit when time is called, which guarantees a finale and makes every hex of progress count. |
| D2 | **What is the head-to-head?** | Split the question: the *outcome space* (what can happen — steal an item, lose a move, gain a move, swap information, nothing) drives balance and feelings; the *minigame* that decides it is swappable and is the fun part. Decide the outcome space first, leave the minigame until last. Must satisfy A9 (can strengthen or weaken) and A10 (room to ham it up). |
| D3 | **What is the final challenge?** | The night's climax and one of only two attention windows. Should be performative and watchable by 25 people holding drinks. |
| D4 | **What do hazards and rewards actually do?** | Proposal: express every effect as a short list of primitives (`delay`, `refund-move`, `retreat`, `reveal`, `grant`, `take`, `block`, `immune`) in JSON, so new mechanics are data edits rather than code. |
| D5 | **What eliminates a team**, as distinct from failing to qualify? | A8 says elimination is welcome from round 2. Unclear whether that is a separate mechanism or just "did not qualify". |
| D6 | **What does the board teach without words?** | A6 is the hardest constraint. Candidate: print each hex's distance-to-nearest-exit directly on the map, so a team reads its own progress with no rules at all. The simulator already has this as a debug overlay. |
| D7 | **Are there stages at all?** | The three-stage idea predates the 3-round constraint and may simply be gone. Rounds ≠ stages. |
| D8 | How many teams does the final challenge take? | Drives D1's target. |

---

## E. Measured findings

Method: scripted strategies over many seeded runs on `baseline-10` (10 teams,
3 rounds, map `ranger-district-01`). **Scripted movement is not real play** —
it drifts toward the exit and ignores clues, items and other teams. Read these
as the shape of the space, not a prediction of the night.

**F1 — A hard "reach the trailhead" gate does not reliably produce a finale.**
200 runs per strategy:

| Teams qualifying | Beeline | Balanced drift | Wander |
| --- | --- | --- | --- |
| 0 teams | 3% | 47% | 94% |
| exactly 1 | 6% | 37% | 7% |
| **2–4 (the target)** | **70%** | 17% | 0% |
| 5+ | 22% | 0% | 0% |

Near-optimal play lands on 2–4 finalists 70% of the time, which is a good fit —
but there is a **3% chance nobody qualifies at all**, and that rises steeply the
moment teams play imperfectly. With one play, a 3% chance of no finale is a 3%
chance of the evening's climax not happening. This is the strongest argument for
D1's relative-qualification proposal.

**F2 — Zero slack is brutal.** Under "beeline" (which still takes a non-optimal
step occasionally), only about a third of teams reach an exit. One wrong move is
fatal. Whether that is thrilling or arbitrary is a human question, not a
simulable one — worth a paper test.

**F3 — Teams barely meet each other.** About 3.6 encounters per game across 10
teams in 3 rounds, so most teams never have a head-to-head at all. If
head-to-heads are a pillar (A9), contact has to be made much more likely:
trigger on adjacency rather than same-hex (C4), start teams closer together, or
add something that pulls teams onto the same hexes.

**F4 — Route freedom is uneven even though distance is equal.** Every start is
exactly 3 moves out, but some have four different first steps on an optimal
route while others have exactly one. A team on a single-route corridor has no
way to dodge trouble. Equal distance is not equal freedom.

---

## F. Superseded

| Was | Now | Why |
| --- | --- | --- |
| Routes of 3–5 moves, varying by start | Exactly 3 moves from every start | A3 caps the game at 3 rounds, so anything above 3 is unreachable; B8 makes them equal. |
| 91-hex map (radius 5), 8 trailheads | 61-hex map (radius 4), 6 trailheads | Most of a radius-5 map is unreachable inside a 3-move budget. |
| `maxRounds` as an advisory cap (12) | A real constraint (3) | A3. |
| "Frequent early elimination leaves guests with nothing to do" | Elimination from round 2 is welcome | A8. Being out returns a guest to the party, which is the default activity anyway. |
| Escaping = winning | Escaping = qualifying for the final challenge | A7. |
