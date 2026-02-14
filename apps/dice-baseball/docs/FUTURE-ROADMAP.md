# Dice Baseball — Future Roadmap

All enhancement ideas organized by priority tier. Items are not ordered within tiers.

---

## Tier 1: Production Foundation

- **Backend hosting** (Railway/Render) — make the game playable publicly
- **Database integration** (Supabase) — repository interfaces already exist for clean swap
- **Real MLB data sync** — `mlb-sync.ts` extraction logic already implemented
- **Environment config validation** — validate required env vars at startup
- **Rate limiting** on API endpoints

## Tier 2: Game Feel & Polish

- **Dice roll animation** — the anticipation moment before outcome reveals
- **Base runner movement** on diamond SVG
- **Score change celebrations** / HR fireworks
- **Sound effects** — bat crack, crowd, umpire calls
- **Framer Motion integration** for page and component transitions

## Tier 3: UX Completeness

- **User profile page** with game history and stats
- **Game history** / past games list
- **Quick match** — random opponent matchmaking
- **Rematch flow** after game end
- **PWA features** — service worker, offline support, install prompt

## Tier 4: Game Depth

- **Situational modifiers** — 2-out pressure, bases loaded
- **Park factors** — Coors vs Petco
- **Platoon splits** — LHP vs RHP matchups
- **Pitcher fatigue** over at-bats within a game
- **Salary cap / team budget system**

## Tier 5: Infrastructure

- **Frontend unit tests** (Vitest + Testing Library)
- **Milestone C: CI artifact pipeline** (already documented)
- **Redis** for Socket.io horizontal scaling
- **Structured logging** (Pino/Winston)
- **Error monitoring** (Sentry)
- **Accessibility audit** — ARIA labels, focus traps, keyboard navigation

## Tier 6: Advanced Features

- **OAuth login** (Google, GitHub)
- **Async utilities module** — retry, backoff (already designed in CLAUDE.md addendum)
- **API versioning** (`/api/v1`)
- **Dark/light mode toggle**
- **Reduced motion support**
