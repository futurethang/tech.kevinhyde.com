# Dice Baseball — Experience Tiers

The game offers three tiers of play depth. Players choose their tier per session — all tiers share the same core dice-and-stats engine, but unlock progressively more control over team composition and in-game decisions.

Records are tracked across all tiers. Wins are wins.

**See also:** [`TIER-ARCHITECTURE.md`](./TIER-ARCHITECTURE.md) for the developer-facing implementation patterns (feature gating, data model, migration path).

---

## Tier 1: Arcade Mode

**Who it's for:** Casual players, first-timers, "just let me play" energy.

**Core idea:** Pick a pre-built team and go. Zero setup, instant head-to-head action.

### Pre-Configured Teams

Curated rosters pulled from real MLB data. Players don't build — they choose:

- **MLB Franchise teams** — Current-season rosters (e.g., Yankees, Dodgers, Astros)
- **All-Star squads** — AL All-Stars vs NL All-Stars
- **World Baseball Classic rosters** — Country-based teams (USA, Japan, Dominican Republic, etc.)
- **Themed teams** — "Rookie Phenoms," "Veteran Aces," "Speed Demons," etc. (editorial picks, refreshed periodically)

### Gameplay

- Batting order is preset (no reordering)
- No in-game substitutions
- No salary cap (rosters are editorially balanced)
- Full stats-weighted dice outcomes — same engine as all tiers
- Game length: standard 9 innings

### What's tracked

- Win/loss record per tier
- Head-to-head history against opponents

---

## Tier 2: Team Builder

**Who it's for:** Players who want ownership over their roster but don't need full tactical control.

**Core idea:** Build a custom team under a generous salary cap, with light in-game decisions.

### Team Building

- Browse full MLB player database (search, filter by position/team/stats)
- Draft 10 players: 9 position players + 1 starting pitcher
- **Salary cap**: Generous budget — enough to build a strong team, but not an all-star roster at every position. Forces interesting choices without punishing casuals.
- Set your own batting order
- Save multiple teams

### Salary Cap Philosophy (Tier 2)

The cap is forgiving. A player who picks a few superstars can still fill remaining slots with solid MLB regulars. The intent is roster identity ("my team"), not min-maxing.

- Star players cost more (salary derived from OPS/ERA tiers)
- Role players are cheap
- Budget allows ~2-3 stars + solid supporting cast
- No penalty for being under cap

### In-Game Decisions

- **Pinch hitter**: Swap a batter for a bench player (limited swaps per game, e.g., 2-3)
- No pitching changes (single starter goes the distance)
- No defensive substitutions

### What's tracked

- Win/loss record per tier
- Team performance history (which of your teams wins most)
- Head-to-head history

---

## Tier 3: Manager Mode

**Who it's for:** Strategy-obsessed players who want full dugout control and high-stakes play.

**Core idea:** Tighter salary cap, full in-game tactical decisions, and optional wagers.

### Team Building

- Same player database as Tier 2
- **Tighter salary cap**: Forces genuine trade-offs. You can't stack stars everywhere — build around a core and find value picks.
- Expanded roster: 25 players (mirrors real MLB active roster)
  - 9 starting position players
  - Starting pitcher
  - Bullpen (3-4 relief pitchers)
  - Bench players (pinch hitters, defensive subs, utility)
- Set batting order, designate bullpen roles (closer, setup, long relief)

### Salary Cap Philosophy (Tier 3)

The cap bites. Building a contender requires real decisions:

- Can afford 1 true superstar + solid supporting cast, OR
- Spread budget across balanced quality at every position
- Bullpen depth vs. lineup power is a real tension
- Under-cap bonus: none. It's a ceiling, not a target.

### In-Game Tactical Decisions

Full manager toolbox:

- **Pinch hitters** — Unlimited (constrained only by bench depth)
- **Pitching changes** — Pull starter, bring in reliever. Manage pitch count / fatigue
- **Defensive substitutions** — Swap in a better glove late in the game
- **Pitcher fatigue** — Starters lose effectiveness over at-bats. Leaving them in too long is a risk.
- **Platoon matchups** — See batter/pitcher handedness (L/R) and make substitutions to exploit splits
- **Situational awareness** — 2-out pressure, bases loaded modifiers feed into the engine

### Wager Mechanic

Optional real-money (or in-game currency) stakes on head-to-head games:

- **Opt-in only** — Both players must agree to wager before game starts
- **Micro-stakes** — $1-$5 range (keeps it fun, not predatory)
- **Escrow model** — Wagers held until game completion
- **Forfeit = loss** — Disconnecting from a wagered game counts as a loss (with grace period for genuine connection issues)
- **Record distinction** — Wagered game results tracked separately ("Stakes Record")

> **Implementation note:** Wager mechanic requires payment integration, regulatory review, and likely age verification. This is a late-stage feature. Design the data model early but don't build payment flows until the core game is proven.

### What's tracked

- Win/loss record per tier
- Stakes record (wagered games W/L + net)
- Team performance history
- Managerial stats (pitching change effectiveness, pinch hit success rate)

---

## Cross-Tier Systems

These features exist across all tiers:

### Record Keeping

| Stat | Arcade | Team Builder | Manager |
|------|--------|-------------|---------|
| W/L record | Yes | Yes | Yes |
| H2H history | Yes | Yes | Yes |
| Team stats | — | Yes | Yes |
| Managerial stats | — | — | Yes |
| Stakes record | — | — | Yes |

### Matchmaking

Players are matched within their chosen tier for a given session:

- **Private games** (all tiers) — Share a join code with a friend
- **Public matchmaking** (future) — Queue up and get matched with a stranger in the same tier

#### Public Matchmaking (Roadmap)

Finding opponents among strangers is critical for long-term engagement. Planned approach:

1. **Simple queue** (MVP) — FIFO matchmaking within tier. First two players in queue get matched.
2. **Skill-based matching** (later) — Light ELO/MMR system. Win streaks push you up, losses bring you down. Keeps games competitive.
3. **Challenge board** (later) — Post an open challenge with optional wager (Manager Mode). Others can accept.

> **Backend requirement:** Matchmaking queue service, likely Redis-backed for low-latency pairing. WebSocket notifications when match is found.

### Progression

No forced progression — players can jump to any tier at any time. But natural gravity pulls engaged players toward higher tiers as they want more control.

Potential future incentives (not in MVP):
- Unlock cosmetic team customizations through play
- Leaderboards per tier
- Seasonal resets with rewards

---

## Implementation Priority

### Phase 1: Ship Arcade Mode

Get the core loop playable with pre-built teams. This unblocks everything else.

**Requires (from current backlog):**
- Roll dice button in Game.tsx
- Fix WebSocket state sync
- Pre-configured team data (curate from existing 21 sample players, expand to full rosters)
- Game end screen with W/L result
- Basic record tracking (W/L per user)

### Phase 2: Ship Team Builder

Layer on custom team building and salary cap.

**Requires:**
- Complete TeamEditor component
- Player search/filter UI in roster building context
- Salary cap system (player salary derivation from stats)
- Batting order drag-and-drop
- Save/load multiple teams
- Data persistence (Supabase integration)
- Pinch hitter mechanic (limited per game)

### Phase 3: Ship Manager Mode

Full tactical depth.

**Requires:**
- Expanded 25-player roster support
- Bullpen management UI
- Pitcher fatigue system in game engine
- Platoon splits (L/R handedness data + modifiers)
- Situational modifiers (2-out pressure, bases loaded)
- Defensive substitution system
- In-game decision UI (substitution prompts, bullpen warming)

### Phase 4: Matchmaking + Wagers

Social and stakes features.

**Requires:**
- Matchmaking queue (Redis + WebSocket)
- ELO/MMR tracking
- Challenge board UI
- Payment integration research (for wagers)
- Wagering escrow system
- Age verification / regulatory compliance

---

## What's Explicitly Out of Scope

These features were considered and deliberately excluded to keep focus on head-to-head play:

- **Season mode** — No multi-game seasons or playoffs
- **League play** — No organized leagues or schedules
- **Draft mechanics** — No snake/auction drafts (team building is direct pick)
- **Trade system** — No player trading between users
- **Park factors** — No stadium-specific modifiers (Coors, Petco, etc.)
- **Historical players** — Current-season MLB data only (for now)

Any of these could be revisited later, but they are not on the active roadmap.

---

*Last updated: 2026-03-10*
