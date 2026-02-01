# Claude Code Instructions: Dice Baseball V2

## Project Overview

**Dice Baseball V2** is a stats-driven multiplayer baseball game where players build teams using real MLB players and compete via real-time matches. Player statistics from the current MLB season influence game outcomes, creating strategic depth beyond pure dice luck.

### Key Differentiators from V1
- **V1**: Pure dice rolls → fixed outcome table
- **V2**: Dice rolls + real MLB stats → weighted probability outcomes

### Core Experience Split

| Experience | Purpose | Tech |
|------------|---------|------|
| **Team Builder** | Browse MLB players, build dream teams, research stats | REST API, no WebSocket |
| **Live Game** | Real-time multiplayer matches | WebSocket for state sync |

---

## Documentation Map

All specifications are in the `docs/` folder:

| Document | Contents |
|----------|----------|
| `SPEC-V2.md` | High-level architecture, feature scope, tech stack, implementation phases |
| `DATABASE.md` | Complete PostgreSQL schema, indexes, RLS policies, migrations |
| `API.md` | REST endpoints, WebSocket events, request/response formats |
| `SERVICES.md` | Backend services, MLB sync cron, game engine, stats weighting algorithms |
| `UI-SPECS.md` | Screen layouts, component specs, design system, animations |

**Read the relevant doc before implementing any feature.**

---

## Tech Stack

### Frontend (PWA)
```
React 18 + Vite
├── Zustand (state management)
├── Socket.io-client (real-time)
├── Tailwind CSS (styling)
├── Dexie (IndexedDB for offline)
└── React Query (API caching)
```

### Backend
```
Node.js + Express
├── Socket.io (WebSocket server)
├── node-cron (scheduled jobs)
└── Supabase JS client
```

### Database & Auth
```
Supabase
├── PostgreSQL database
├── Row Level Security
├── Built-in Auth
└── Real-time subscriptions (backup)
```

### External APIs
```
MLB Stats API (free, no auth)
└── https://statsapi.mlb.com/api/v1
```

---

## Project Structure (Target)

```
apps/dice-baseball/
├── CLAUDE.md                 # This file
├── README.md                 # User-facing docs
├── docs/                     # Specifications
│   ├── SPEC-V2.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SERVICES.md
│   └── UI-SPECS.md
│
├── frontend/                 # React PWA
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── common/       # Buttons, Cards, Inputs
│       │   ├── game/         # Diamond, Scoreboard, Matchup
│       │   ├── team/         # PlayerCard, RosterSlot
│       │   └── layout/       # Header, Navigation
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── PlayerDatabase.tsx
│       │   ├── MyTeams.tsx
│       │   ├── TeamEditor.tsx
│       │   ├── Play.tsx
│       │   └── Game.tsx
│       ├── hooks/
│       │   ├── useGame.ts
│       │   ├── useSocket.ts
│       │   └── useMLBPlayers.ts
│       ├── stores/
│       │   ├── authStore.ts
│       │   ├── gameStore.ts
│       │   └── teamStore.ts
│       ├── services/
│       │   ├── api.ts
│       │   └── socket.ts
│       ├── types/
│       │   └── index.ts
│       └── styles/
│           └── globals.css
│
├── backend/                  # Node.js server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # Entry point
│       ├── server.ts         # Express + Socket.io setup
│       ├── routes/
│       │   ├── users.ts
│       │   ├── teams.ts
│       │   ├── games.ts
│       │   └── mlb.ts
│       ├── services/
│       │   ├── mlb-sync.ts   # MLB API integration
│       │   ├── game-engine.ts # Stats weighting
│       │   └── supabase.ts
│       ├── socket/
│       │   ├── handlers.ts
│       │   └── rooms.ts
│       ├── jobs/
│       │   ├── scheduler.ts
│       │   └── cleanup.ts
│       ├── middleware/
│       │   └── auth.ts
│       └── types/
│           └── index.ts
│
└── supabase/                 # Database migrations
    └── migrations/
        ├── 001_initial_schema.sql
        └── 002_functions.sql
```

---

## Implementation Order

Follow this sequence for logical dependency flow:

### Phase 1: Foundation
1. Set up frontend project (Vite + React + Tailwind)
2. Set up backend project (Express + Socket.io)
3. Create Supabase project, run migrations from `DATABASE.md`
4. Implement Supabase Auth integration (both ends)
5. Create basic navigation shell

### Phase 2: Team Builder (No WebSocket)
1. Implement MLB sync service (`SERVICES.md` section 1)
2. Create `/api/mlb/players` endpoint with search/filter
3. Build PlayerDatabase page with PlayerCard components
4. Implement team CRUD endpoints
5. Build MyTeams and TeamEditor pages
6. Add roster management with batting order

### Phase 3: Game Engine
1. Implement stats weighting algorithm (`SERVICES.md` section 2)
2. Create base running logic
3. Build play description generator
4. Unit test the engine thoroughly

### Phase 4: Real-time Multiplayer
1. Set up Socket.io server with auth
2. Implement game room management
3. Create game creation/join flow
4. Build WebSocket event handlers
5. Implement disconnect/reconnect handling

### Phase 5: Live Game UI
1. Build Game page with all components
2. Implement Scoreboard, Diamond, Matchup display
3. Add dice roll animation
4. Build play-by-play feed
5. Add game end modal

### Phase 6: Polish
1. PWA manifest and service worker
2. Offline support for Team Builder
3. Loading states and skeletons
4. Error handling and edge cases
5. Mobile responsiveness testing

---

## Critical Implementation Notes

### Stats Weighting Balance
The core innovation is the probability adjustment. Current tuning:
- **60% stats influence**: Player quality matters
- **40% dice influence**: Upsets still happen

See `SERVICES.md` section 2 for the full algorithm. If games feel too predictable or too random, adjust the `clamp()` ranges in modifier calculations.

### MLB API Rate Limits
- No official rate limit documented, but be respectful
- Batch requests: 10 players/second max
- Cache aggressively: 24-hour TTL for player stats
- Run sync at 5 AM UTC (after west coast games)

### WebSocket Game State
- **Server is authoritative**: All dice rolls happen server-side
- **Client is display-only**: Never trust client calculations
- **Reconnection**: Players get 60 seconds before auto-forfeit

### Database Indexes
Critical for performance (from `DATABASE.md`):
```sql
CREATE INDEX idx_mlb_players_position ON mlb_players(primary_position);
CREATE INDEX idx_mlb_players_search ON mlb_players USING gin(to_tsvector(...));
CREATE INDEX idx_games_waiting ON game_sessions(status, created_at) WHERE status = 'waiting';
```

---

## Common Tasks

### Adding a New MLB Stat
1. Update `batting_stats` or `pitching_stats` JSONB structure in `DATABASE.md`
2. Add extraction in `mlb-sync.ts` `extractBattingStats()` function
3. Update `PlayerStats` TypeScript interface
4. Modify UI components to display the stat

### Adding a New Game Outcome
1. Add to `OutcomeType` union in `SERVICES.md`
2. Set base probability in `BASE_PROBABILITIES`
3. Add modifier calculations for batter/pitcher
4. Add base running logic in `advanceRunners()`
5. Add description templates in `DESCRIPTIONS`
6. Update UI to handle the new outcome

### Changing Stats Weighting
All in `SERVICES.md` section 2:
- Adjust `LEAGUE_AVG` constants for calibration
- Modify `clamp()` ranges to limit extreme swings
- Tune `applyDiceBias()` shift amount (currently 15%)

---

## Environment Variables

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

### Backend (.env)
```bash
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
CORS_ORIGIN=http://localhost:5173
```

---

## Testing Strategy

### Unit Tests
- Game engine: outcome probabilities, base running
- Stats weighting: modifier calculations
- API validators: roster validation, game state

### Integration Tests
- MLB sync: data transformation
- Socket events: game flow sequences
- API endpoints: CRUD operations

### Manual Testing Checklist
- [ ] Create account, login, logout
- [ ] Search players, filter by position/team
- [ ] Create team, fill roster, set batting order
- [ ] Create private game, share code
- [ ] Join game with code
- [ ] Play full 9-inning game
- [ ] Test disconnection/reconnection
- [ ] Test game forfeit
- [ ] Test rematch flow

---

## Deployment

### Frontend
- Build: `npm run build` in frontend/
- Output: `frontend/dist/`
- Host: GitHub Pages at `tech.kevinhyde.com/apps/dice-baseball/`

### Backend
- Build: `npm run build` in backend/
- Host: Railway or Render (WebSocket support)
- Set all environment variables
- Ensure cron jobs are running

### Database
- Supabase free tier is sufficient for MVP
- Enable RLS policies before going live
- Set up daily backups

---

## Quick Reference

### Key Files by Feature

| Feature | Frontend | Backend | Database |
|---------|----------|---------|----------|
| Auth | `stores/authStore.ts` | `middleware/auth.ts` | `users` table |
| MLB Data | `pages/PlayerDatabase.tsx` | `services/mlb-sync.ts` | `mlb_players` table |
| Teams | `pages/TeamEditor.tsx` | `routes/teams.ts` | `teams`, `roster_slots` |
| Games | `pages/Game.tsx` | `socket/handlers.ts` | `game_sessions`, `game_moves` |
| Engine | - | `services/game-engine.ts` | - |

### API Quick Reference

```
GET  /api/mlb/players?position=SS&sort=ops
GET  /api/mlb/players/:mlbId
GET  /api/teams
POST /api/teams
PUT  /api/teams/:id/roster
POST /api/games
POST /api/games/join
```

### WebSocket Events

```
Client → Server:
  game:ready, game:roll, game:forfeit

Server → Client:
  game:state, game:roll-result, game:ended,
  opponent:connected, opponent:disconnected
```

---

## Session Continuity

When starting a new coding session:

1. **Check current phase**: Which implementation phase are we in?
2. **Read relevant docs**: Load the specific spec for current work
3. **Check existing code**: What's already implemented?
4. **Continue from TODO**: Look for TODO comments or incomplete features
5. **Run tests**: Ensure existing functionality still works

When ending a session:

1. **Commit with context**: Describe what was done and what's next
2. **Add TODOs**: Mark incomplete work in code
3. **Update progress**: Note which phase/feature is current

---

## Questions for Product Decisions

These are open questions to discuss before/during implementation:

1. **Salary cap for V2?** Display salaries as info, or enforce budget?
2. **Max saved teams?** Unlimited, or limit to 3-5?
3. **Off-season behavior?** Use previous year stats or projections?
4. **Quick match MMR?** Skill-based matching or random?
5. **Player photos fallback?** Team logo or generic silhouette?

---

*This document is the source of truth for implementation. Update it as decisions are made and the project evolves.*
