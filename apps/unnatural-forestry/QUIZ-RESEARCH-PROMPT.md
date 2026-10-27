# Master prompt for the quiz research agent

Copy everything below the line into a fresh research-capable session.

---

You are researching and writing a trivia question bank for a one-off Halloween
party game. I need **58 questions total**, well-researched and fact-checked, in
structured JSON.

Use web search. **Verify every factual claim against at least one reliable
source and cite it.** If you cannot verify something, do not include the
question. Accuracy matters more than volume — I would rather have 50 solid
questions than 58 with three embarrassing errors in them.

## The setting

Guests are 15–30 people at a house party in Seattle, in teams of 2–3, mostly
drinking. Two teams face off at a time; both write their answer down at the same
time, then reveal. A host reads each question **aloud, once**, to a loud room.

The game has a deadpan "Department of Unnatural Forestry" bureaucratic framing
and a light Halloween tinge. Questions do not need to be spooky, but a spooky
or eerie angle is welcome wherever it comes naturally.

## What to write

| Set | Count | What it is |
| --- | --- | --- |
| `bank` | **45** | The main pool. Four-option multiple choice |
| `trailhead` | **5** | The finale. Four-option multiple choice, escalating difficulty, the last one a showstopper |
| `tiebreak` | **8** | Closest-guess number questions, no options |

## The seven themes

Every `bank` question is tagged with **two or three** of these — every theme it
could plausibly be asked under. A flooded mine shaft is Rock & Ruin *and* Rain &
River. Bigfoot tracks through a clearcut is Fur & Feather *and* Grease & Gravel.

| id | Theme | Scope |
| --- | --- | --- |
| `rock-and-ruin` | Rock & Ruin | Quarries, mining, masonry, geology, volcanoes. Things dug up and things built |
| `root-and-rot` | Root & Rot | Trees, fungi, moss, forestry. What grows and what breaks it down |
| `fur-and-feather` | Fur & Feather | Animals, birds, tracks, insects — and creatures people claim to have seen. Cryptids count |
| `rain-and-river` | Rain & River | Weather, water, floods, fish, tides, dams, shipping |
| `grease-and-gravel` | Grease & Gravel | Logging equipment, trucks, chainsaws, roads, railways. Anything with a motor |
| `forms-and-procedures` | Forms & Procedures | Government, paperwork, signage, regulations, land management, public agencies |
| `dark-and-distant` | Dark & Distant | Night sky, folklore, ghost stories, hauntings, local legends, the unexplained |

**Coverage requirement: at least 12 of the 45 bank questions must carry each
theme's tag.** Check this before you finish and rebalance if a theme is thin.
A few tagged `wild` (works under any theme) are welcome.

`trailhead` and `tiebreak` questions need no theme tags.

## Difficulty — the thing I care most about

**Target: roughly 60% of teams get it right.**

Too easy and every matchup comes down to luck. Too obscure and it's a coin flip
nobody enjoys. The test to apply to every question:

> Would about half the room have a confident opinion, and would about half of
> those be wrong?

**Write questions where the obvious answer is wrong but the right answer is
gettable.** The best ones make someone say *"no, wait, I actually know this"* —
and then be right about a third of the time.

Aim across the 45 bank questions for roughly: **10 easy, 25 medium, 10 hard.**

**Avoid:**
- Superlatives everybody already knows (tallest mountain, biggest lake)
- Pure date recall ("what year did X happen")
- Anything where the only route to the answer is having looked it up
- "Which of these is NOT…" — negatively framed questions are miserable read
  aloud to drunk people
- Long numbers, tricky spellings, or anything needing the question re-read
- Facts that change: populations, records, "currently the largest". If you use
  one, pin it with a year in the question text

**Favour:**
- Surprising-but-believable facts
- Questions where the wrong answers are what people assume to be true
- Things people half-know from living somewhere or having a hobby

## The Washington lean

**About 40% of the bank should have a Washington State, Seattle, or Pacific
Northwest angle.** Most guests are local and will enjoy recognising their own
ground — Mount St. Helens, the Olympic rainforest, Boeing, the Ship Canal,
Dungeness crab, the Cascadia subduction zone, Seattle Underground, logging
history, the ferry system, Bigfoot sightings in the Cascades.

**But local questions must still be gettable by a non-local**, from context or
reasoning. Nobody should be shut out because they moved here last year. Don't
make it a test of how long someone has lived in Washington.

The other 60% should be general knowledge within the themes, drawn from
anywhere in the world.

## Writing the four options

This is where most trivia goes wrong, so spend effort here.

**All three wrong answers must be genuinely plausible.** A question with two
joke options is really a coin flip.

One of the game's tokens lets a team **remove two wrong answers** and then
choose between the two remaining. So rank your distractors and tell me which
is which:

- **`near-miss`** — the one that survives the cull. Should still be a real
  decision against the correct answer
- **`plausible`** — believable but beatable
- **`weak`** — plausible enough to be worth printing, but the first to go

**Each question should have exactly one weak, one plausible, one near-miss
distractor.**

Keep all four options similar in length and grammatical form. Don't make the
correct answer the longest or the most specific — that's the oldest tell in
trivia.

## The note field

Every question needs a one-sentence `note`: the detail that makes the answer
fun to hear. The host reads it out after the reveal, and it's what turns a
wrong guess into a moment rather than a disappointment. This is not optional
and it is not a restatement of the answer — it's the extra bit.

## The Trailhead Five

The finale, in front of everyone. **Mixed subjects — do not tag them.**
Escalating: question 1 approachable, question 5 genuinely hard. Make the last
one a performance: the longest setup, the best wrong answers, the one people
repeat at the next party.

## The tiebreakers

Eight **closest-guess number** questions. No options — teams write a number and
the nearest wins. No subject constraint; pull from anywhere.

> *How many board feet of timber came off Washington's national forests in 1961?*

Pick things where a reasonable person can estimate within an order of magnitude
but nobody knows exactly. No answer should be a round number people would
guess by default.

## Output format

Return a single JSON array. Nothing else — no preamble, no commentary.

```json
[
  {
    "id": "Q01",
    "set": "bank",
    "themes": ["rock-and-ruin", "rain-and-river"],
    "local": true,
    "difficulty": "medium",
    "format": "multiple-choice",
    "question": "One sentence, readable aloud once.",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "answer": "C",
    "distractors": { "A": "weak", "B": "near-miss", "D": "plausible" },
    "note": "The extra detail that makes it fun to hear.",
    "source": "https://...",
    "confidence": "high"
  },
  {
    "id": "T01",
    "set": "tiebreak",
    "format": "closest-guess",
    "question": "...",
    "answer": 41200,
    "unit": "board feet",
    "note": "...",
    "source": "https://...",
    "confidence": "high"
  }
]
```

- `local`: true if it has a WA/Seattle/PNW angle
- `confidence`: `high` if the source is authoritative and unambiguous, `medium`
  if sources vary. Don't include anything lower
- `source`: a real, specific URL you actually checked

## Before you finish, verify

1. 45 `bank`, 5 `trailhead`, 8 `tiebreak` — 58 total
2. Every theme carries **at least 12** bank tags
3. Roughly 40% of bank questions marked `local: true`
4. Every multiple-choice question has exactly one `weak`, one `plausible` and
   one `near-miss` distractor
5. Every question has a `note` that adds something beyond the answer
6. Every question has a real source URL you checked
7. No "which is NOT" questions, no pure date recall, no unpinned changing facts

Work through it thematically rather than sequentially — research a theme, write
its questions, verify, move on. Tell me if a theme is hard to fill at the right
difficulty and we'll adjust the scope.
