# Dice Baseball — Future Roadmap

All enhancement ideas organized by priority. Items within each section are unordered.

**See also:** [`EXPERIENCE-TIERS.md`](./EXPERIENCE-TIERS.md) — the player-facing tier framework (Arcade → Team Builder → Manager Mode) that drives feature prioritization.

---

## Priority 1: Playable Core (Arcade Mode)

Ship the game loop so people can actually play. Pre-built teams, dice rolls, results.

- **Roll dice button** in Game.tsx — the game literally can't be played without this
- **Fix WebSocket state sync** — game updates not reaching clients
- **Pre-configured team rosters** — MLB franchise teams, AL/NL All-Stars, World Classic squads
- **Game end screen** — winner/loser display, final box score
- **Base runners on diamond** — visual runner positions on the SVG field
- **Turn indicators** — clear UI showing whose turn it is
- **Basic W/L record tracking** — per-user win/loss persisted across sessions

## Priority 2: Game Feel & Polish

The moments between rolls are where addiction lives. Invest in anticipation and payoff.

- **Dice roll animation** — build-up before outcome reveal (leverage `dice-roller` app R&D)
- **Base runner movement** — animated advancement on the diamond SVG
- **Hit/score celebrations** — HR fireworks, run-scoring emphasis
- **Sound effects** — bat crack, crowd noise, umpire calls (leverage `baseball-effects-workbench` R&D)
- **Bat swing interaction** — pull-back-and-release mechanic (leverage `bat-swing` app R&D)
- **Framer Motion** for page/component transitions

## Priority 3: Team Builder Mode

Custom team building with salary cap. The "my team" experience.

- **Complete TeamEditor component** — roster building UI with player search
- **Salary cap system** — player salaries derived from stats tiers, generous budget
- **Batting order editor** — drag-and-drop reordering
- **Save/load multiple teams** — requires data persistence
- **Pinch hitter mechanic** — limited in-game substitutions (2-3 per game)
- **Data persistence** (Supabase) — teams, users, game history survive server restarts
- **Real MLB data sync** — expand from 21 sample players to full active rosters
- **User profile page** — game history, team stats, W/L records

## Priority 4: Manager Mode

Full tactical depth for competitive players.

- **Expanded 25-player rosters** — position players, bullpen, bench
- **Pitcher fatigue** — effectiveness degrades over at-bats within a game
- **Pitching changes** — pull starter, manage bullpen
- **Platoon splits** — L/R handedness matchup modifiers
- **Situational modifiers** — 2-out pressure, bases loaded, runner in scoring position
- **Defensive substitutions** — swap in better glove late
- **Tighter salary cap** — forces genuine roster trade-offs
- **In-game decision UI** — substitution prompts, bullpen warming indicators
- **Managerial stat tracking** — pinch hit success rate, pitching change effectiveness

## Priority 5: Social & Stakes

Head-to-head discovery and optional wagers for Manager Mode.

- **Public matchmaking queue** — FIFO within tier, then skill-based (ELO/MMR)
- **Challenge board** — post open challenges, others accept
- **Wager mechanic** — opt-in $1-$5 micro-stakes on Manager Mode games
- **Rematch flow** — post-game rematch with same opponent
- **Leaderboards** — per-tier rankings

## Priority 6: Infrastructure & Quality

Backend hardening and developer experience.

- **Backend hosting** (Railway/Render) — make the game publicly accessible
- **Redis** for matchmaking queue + Socket.io horizontal scaling
- **Frontend unit tests** (Vitest + Testing Library)
- **Rate limiting** on API endpoints
- **Environment config validation** — validate required env vars at startup
- **Structured logging** (Pino/Winston)
- **Error monitoring** (Sentry)
- **Accessibility audit** — ARIA labels, focus traps, keyboard navigation
- **CI artifact pipeline** (see [`MILESTONE-C-ROADMAP.md`](./MILESTONE-C-ROADMAP.md))

## Priority 7: Nice to Have

Not on the active roadmap but worth capturing.

- **OAuth login** (Google, GitHub) — alongside existing email/password
- **PWA features** — service worker, offline support, install prompt
- **Dark/light mode toggle**
- **Reduced motion support**
- **API versioning** (`/api/v1`)
- **Async utilities module** — retry, backoff (designed in CLAUDE.md addendum)
- **Player photos** — headshots on player cards

---

## Explicitly Out of Scope

Considered and cut to keep focus on head-to-head play:

- Season mode / multi-game series
- League play / organized schedules
- Draft mechanics (snake/auction)
- Trade system between users
- Park factors (stadium-specific modifiers)
- Historical / retired players

See [`EXPERIENCE-TIERS.md`](./EXPERIENCE-TIERS.md) for rationale.

---

*Last updated: 2026-03-10*
