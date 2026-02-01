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

## Current Progress (Updated 2026-02-01)

### Completed Phases

| Phase | Status | Key Deliverables |
|-------|--------|------------------|
| **Phase 1: Foundation** | ✅ Complete | Express + TypeScript, Vitest, Supertest, health/auth endpoints |
| **Phase 2: MLB Data** | ✅ Complete | MLB API integration, player search, stats extraction |
| **Phase 3: Team Management** | ✅ Complete | Team CRUD, roster validation, batting order rules |
| **Phase 4: Game Engine** | ✅ Complete | Stats-weighted probabilities, base running, inning logic (100% coverage) |
| **Phase 5: Game Sessions** | ✅ Complete | REST endpoints, state machine, async utilities with retry |

### Test Coverage Summary
- **250 tests passing**
- **85%+ overall coverage**
- Game engine: 98.5% coverage
- All routes tested with integration tests

### What's Next

**Phase 6: WebSocket Layer** - Ready for TDD
- Socket.io event handlers (`game:roll`, `game:forfeit`)
- Game room management (join, leave, reconnect)
- 60-second disconnect grace period
- Real-time state broadcasting
- Can be fully tested with mocked Socket.io client

**Phase 7: Frontend** - Ready for TDD
- React + Vite + TypeScript scaffold
- Zustand stores (connection, game state)
- React Query for API calls
- All testable with MSW (Mock Service Worker)

### Deployment Notes

| Component | Infrastructure | Status |
|-----------|---------------|--------|
| Frontend | GitHub Pages (static) | ❌ Not built yet |
| Backend | Railway/Render/Fly.io | ✅ Built, needs deployment |
| Database | Supabase | ❌ Schema defined, not integrated |
| MLB API | Free, no auth | ✅ Integration works |

**Key insight**: Phases 6 & 7 can be **fully developed with TDD** using mocks before any real infrastructure is deployed:
- `InMemoryGameSessionStore` works for local development
- Socket.io can be mocked in tests
- MSW can mock all API calls for frontend tests
- Real infrastructure only needed for internet multiplayer

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

## Development Philosophy: Test-Driven Development

**All backend logic and API endpoints must be fully tested before UI implementation begins.**

This project follows strict TDD principles:

### The TDD Cycle

```
1. RED    → Write a failing test that defines expected behavior
2. GREEN  → Write minimal code to make the test pass
3. REFACTOR → Clean up code while keeping tests green
4. REPEAT
```

### Why TDD First?

1. **Backend is the foundation**: UI is just a view of server state
2. **Catch bugs early**: Logic errors found in tests, not production
3. **Documentation**: Tests describe exactly what each function does
4. **Confidence**: Refactor freely knowing tests will catch regressions
5. **Session continuity**: Tests verify nothing broke between sessions

### Coverage Requirements

| Layer | Minimum Coverage | Focus Areas |
|-------|------------------|-------------|
| Game Engine | **100%** | All outcome calculations, base running, state transitions |
| REST API | **100%** | All endpoints, validation, error responses |
| WebSocket | **90%** | Event handlers, room management, reconnection |
| Services | **95%** | MLB sync, data transformation, cron jobs |
| Validators | **100%** | Input validation, roster rules, game state |

### Gate Requirements

**You CANNOT proceed to the next phase until:**
1. All tests for current phase pass
2. Coverage thresholds are met
3. Tests run in CI (or can be run with single command)

---

## Implementation Order (TDD-Integrated)

Follow this sequence. Each phase has specific test requirements.

### Phase 1: Foundation + Test Infrastructure

**Setup:**
1. Set up backend project (Express + TypeScript)
2. Configure Vitest for unit/integration tests
3. Set up Supertest for API testing
4. Create Supabase project, run migrations
5. Set up test database (separate from dev)

**Tests to write FIRST:**
```
backend/src/__tests__/
├── setup.ts              # Test database connection, cleanup
├── health.test.ts        # Health endpoint returns 200
└── auth.test.ts          # JWT validation middleware
```

**Gate:** Health endpoint tested, auth middleware tested, CI runs tests

---

### Phase 2: MLB Data Layer (Test First)

**Write tests BEFORE implementation:**

```typescript
// mlb-sync.test.ts
describe('MLB Sync Service', () => {
  describe('extractBattingStats', () => {
    it('extracts all batting fields from MLB API response')
    it('returns null for pitchers without batting stats')
    it('handles missing fields gracefully')
    it('calculates derived stats correctly (OPS)')
  })

  describe('extractPitchingStats', () => {
    it('extracts all pitching fields from MLB API response')
    it('returns null for position players')
    it('handles missing fields gracefully')
  })

  describe('syncMLBPlayers', () => {
    it('fetches all active players')
    it('upserts players to database')
    it('marks inactive players')
    it('respects rate limits')
    it('handles API errors gracefully')
  })
})
```

```typescript
// mlb-routes.test.ts
describe('GET /api/mlb/players', () => {
  it('returns paginated player list')
  it('filters by position')
  it('filters by team')
  it('searches by name (partial match)')
  it('sorts by OPS descending by default')
  it('sorts by specified field')
  it('returns 400 for invalid position')
  it('returns empty array for no matches')
})

describe('GET /api/mlb/players/:id', () => {
  it('returns player with full stats')
  it('returns 404 for unknown player')
})
```

**Implementation order:**
1. Write all tests (they will fail - RED)
2. Implement `extractBattingStats()` → tests pass (GREEN)
3. Implement `extractPitchingStats()` → tests pass
4. Implement `syncMLBPlayers()` → tests pass
5. Implement `/api/mlb/players` route → tests pass
6. Implement `/api/mlb/players/:id` route → tests pass

**Gate:** 100% coverage on MLB service and routes, all tests green

---

### Phase 3: Team Management (Test First)

**Write tests BEFORE implementation:**

```typescript
// team-validation.test.ts
describe('Roster Validation', () => {
  it('accepts valid 9-player + 1-pitcher roster')
  it('rejects roster with missing positions')
  it('rejects roster with duplicate players')
  it('rejects invalid batting order (gaps)')
  it('rejects invalid batting order (duplicates)')
  it('rejects pitcher in batting order')
  it('accepts batting order 1-9 for position players')
})

// team-routes.test.ts
describe('POST /api/teams', () => {
  it('creates team for authenticated user')
  it('returns 401 for unauthenticated request')
  it('returns 400 for missing team name')
  it('returns 400 for name too long')
})

describe('PUT /api/teams/:id/roster', () => {
  it('updates roster with valid data')
  it('returns 400 for invalid roster')
  it('returns 403 for team not owned by user')
  it('returns 404 for unknown team')
})

describe('PUT /api/teams/:id/batting-order', () => {
  it('reorders batting lineup')
  it('returns 400 for invalid order')
  it('returns 400 for incomplete roster')
})
```

**Gate:** 100% coverage on team validation and routes

---

### Phase 4: Game Engine (Test First) - CRITICAL

This is the core logic. **100% test coverage required, no exceptions.**

**Write tests BEFORE implementation:**

```typescript
// game-engine.test.ts
describe('Base Probabilities', () => {
  it('probabilities sum to 1.0')
  it('matches expected distribution from dice odds')
})

describe('Batter Modifiers', () => {
  it('returns neutral modifiers for league-average player')
  it('boosts hit outcomes for high-OPS batter')
  it('reduces strikeout rate for low-K batter')
  it('clamps extreme values within bounds')

  // Edge cases
  it('handles zero at-bats gracefully')
  it('handles missing stats with defaults')
})

describe('Pitcher Modifiers', () => {
  it('returns neutral modifiers for league-average pitcher')
  it('increases strikeout rate for high-K pitcher')
  it('reduces hit outcomes for low-WHIP pitcher')
  it('clamps extreme values within bounds')

  // Edge cases
  it('handles zero innings pitched')
  it('handles missing stats with defaults')
})

describe('Outcome Resolution', () => {
  it('applies batter modifiers correctly')
  it('applies pitcher modifiers correctly')
  it('normalizes final probabilities to 1.0')
  it('biases toward good outcomes on high dice rolls')
  it('biases toward bad outcomes on low dice rolls')

  // Statistical validation (run many iterations)
  it('produces expected outcome distribution over 10000 rolls')
  it('high-OPS batter outperforms low-OPS batter')
  it('ace pitcher suppresses hits vs journeyman')
})

describe('Base Running', () => {
  describe('Home Run', () => {
    it('clears all bases')
    it('scores batter + all runners')
    it('scores 1 run with bases empty')
    it('scores 4 runs with bases loaded')
  })

  describe('Triple', () => {
    it('scores all runners')
    it('puts batter on third')
    it('scores 3 with bases loaded')
  })

  describe('Double', () => {
    it('scores runner from third')
    it('scores runner from second')
    it('advances runner from first to third')
    it('puts batter on second')
  })

  describe('Single', () => {
    it('scores runner from third')
    it('advances runner from second to third')
    it('advances runner from first to second')
    it('puts batter on first')
  })

  describe('Walk', () => {
    it('puts batter on first')
    it('forces runner from first to second')
    it('forces runner from second to third')
    it('scores runner from third when bases loaded')
    it('does not advance non-forced runners')
  })

  describe('Outs', () => {
    it('does not advance runners on strikeout')
    it('does not advance runners on ground out')
    it('does not advance runners on fly out')
    it('increments out count')
  })
})

describe('Inning Logic', () => {
  it('ends half-inning after 3 outs')
  it('clears bases at end of half-inning')
  it('resets out count at end of half-inning')
  it('switches from top to bottom')
  it('increments inning after bottom')
  it('ends game after 9 innings if not tied')
  it('continues to extras if tied after 9')
  it('ends game on walk-off (home team ahead after top of 9+)')
})

describe('Play Description Generator', () => {
  it('generates description for each outcome type')
  it('includes batter name')
  it('includes pitcher name for strikeouts')
  it('appends run scoring context')
  it('handles plural runs correctly')
})
```

**Implementation order:**
1. Write ALL engine tests first (50+ tests)
2. Implement `BASE_PROBABILITIES` → probability tests pass
3. Implement `calculateBatterModifiers()` → batter tests pass
4. Implement `calculatePitcherModifiers()` → pitcher tests pass
5. Implement `resolveAtBat()` → resolution tests pass
6. Implement `advanceRunners()` → base running tests pass
7. Implement `handleInningLogic()` → inning tests pass
8. Implement `generateDescription()` → description tests pass

**Gate:** 100% coverage on game engine, statistical tests validate balance

---

### Phase 5: Game Session Management ✅ COMPLETE

**Implemented:**

```
src/utils/async-utils.ts        # Retry logic, OperationError, backoff
src/types/index.ts              # GameSession, ConnectionInfo, ApiResponse<T>
src/services/game-session-service.ts  # Full CRUD + state machine
src/routes/games.ts             # REST endpoints
```

**Key Features:**
- `asyncWithRetry()` with exponential backoff and `retriable` error flag
- State machine: `waiting → active → completed/forfeit/abandoned`
- `InMemoryGameSessionStore` for development (swap with Supabase later)
- Connection status types ready for frontend (`ConnectionInfo`, `AppState`)

**Endpoints Implemented:**
- `POST /api/games` - Create game with 6-char join code
- `POST /api/games/join` - Join with code, becomes active
- `GET /api/games/:id` - Get state with `isMyTurn` indicator
- `GET /api/games/history` - User's games with status filter
- `DELETE /api/games/:id` - Cancel waiting game
- `POST /api/games/:id/forfeit` - Forfeit active game

**Tests:** 85 tests (23 async utils + 34 service + 28 routes)

**Gate:** ✅ All game session tests pass, 85% coverage

---

### Phase 6: WebSocket Layer (Test First) - READY FOR TDD

**Can be fully developed locally without real infrastructure.**

**Key files to create:**
```
src/socket/index.ts             # Socket.io server setup
src/socket/handlers.ts          # Event handlers
src/socket/rooms.ts             # Game room management
src/__tests__/unit/socket.test.ts
```

**Integrates with Phase 5:**
- Uses `GameSessionService` for state management
- Uses `asyncWithRetry()` for reconnection logic
- Updates `ConnectionInfo` types for frontend

```typescript
// socket.test.ts - Write these tests FIRST
describe('WebSocket Authentication', () => {
  it('accepts valid JWT')
  it('rejects invalid JWT')
  it('rejects expired JWT')
})

describe('Game Room Events', () => {
  describe('game:roll', () => {
    it('processes roll when player turn')
    it('rejects roll when not player turn')
    it('broadcasts result to both players')
    it('updates game state via GameSessionService')
  })

  describe('game:forfeit', () => {
    it('ends game with opponent as winner')
    it('updates game state')
  })

  describe('Disconnection', () => {
    it('notifies opponent of disconnect')
    it('starts 60-second timer')
    it('forfeits game after timeout')
    it('cancels timer on reconnect')
    it('restores game state on reconnect')
  })
})
```

**Testing approach:**
- Mock Socket.io client for unit tests
- Use `InMemoryGameSessionStore` (no database needed)
- Test event handlers in isolation

**Gate:** 90% coverage on WebSocket handlers

---

### Phase 7: Frontend (Test First) - READY FOR TDD

**Can be fully developed locally using mocks.**

**Prerequisites (all met ✅):**
- [x] All backend tests pass (250 tests)
- [x] All coverage thresholds met (85%+)
- [x] API endpoints documented and tested
- [ ] WebSocket events work (Phase 6)

**Key files to create:**
```
frontend/
├── package.json                # React + Vite + TypeScript
├── vite.config.ts
├── src/
│   ├── stores/                 # Zustand stores
│   │   ├── connectionStore.ts  # Uses ConnectionInfo type
│   │   └── gameStore.ts        # Uses GameSessionState type
│   ├── hooks/
│   │   ├── useGameSession.ts   # React Query + WebSocket
│   │   └── useConnection.ts    # Connection status
│   ├── components/
│   │   ├── game/               # Diamond, Scoreboard, etc.
│   │   └── team/               # PlayerCard, RosterSlot
│   └── pages/
│       ├── Lobby.tsx
│       ├── Game.tsx
│       └── TeamBuilder.tsx
```

**Testing approach:**
- MSW (Mock Service Worker) for API mocking
- React Testing Library for components
- No real backend needed during development

**Recommended state management:**
- **Zustand** for client state (connection, UI preferences)
- **React Query** for server state (API calls with retry/caching)
- **Socket.io + Zustand** for real-time game state

Frontend tests (lighter coverage, focus on critical paths):
- Component rendering tests
- User flow integration tests
- Socket connection handling

---

## Test Infrastructure

### Backend Test Structure

```
backend/
├── src/
│   ├── services/
│   │   ├── game-engine.ts
│   │   └── mlb-sync.ts
│   └── routes/
│       └── teams.ts
├── __tests__/
│   ├── setup.ts              # Global setup/teardown
│   ├── helpers/
│   │   ├── auth.ts           # Create test JWTs
│   │   ├── db.ts             # Seed/clean test data
│   │   └── fixtures.ts       # Test data factories
│   ├── unit/
│   │   ├── game-engine.test.ts
│   │   ├── batter-modifiers.test.ts
│   │   ├── pitcher-modifiers.test.ts
│   │   ├── base-running.test.ts
│   │   └── roster-validation.test.ts
│   ├── integration/
│   │   ├── mlb-routes.test.ts
│   │   ├── team-routes.test.ts
│   │   ├── game-routes.test.ts
│   │   └── game-flow.test.ts
│   └── socket/
│       ├── connection.test.ts
│       └── game-events.test.ts
├── vitest.config.ts
└── package.json
```

### Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- game-engine.test.ts

# Run tests in watch mode (during development)
npm run test:watch

# Run only unit tests
npm test -- --dir __tests__/unit

# Run only integration tests
npm test -- --dir __tests__/integration
```

### Test Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/__tests__/**', '**/types/**'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
    // Fail fast in CI
    bail: process.env.CI ? 1 : 0,
  },
});
```

### Test Helpers

```typescript
// __tests__/helpers/fixtures.ts
export function createMockBatter(overrides = {}) {
  return {
    mlbId: 545361,
    name: 'Mike Trout',
    batting: {
      avg: 0.285,
      obp: 0.390,
      slg: 0.555,
      ops: 0.945,
      bb: 78,
      so: 120,
      ab: 450,
      ...overrides.batting,
    },
    ...overrides,
  };
}

export function createMockPitcher(overrides = {}) {
  return {
    mlbId: 543037,
    name: 'Gerrit Cole',
    pitching: {
      era: 3.12,
      whip: 1.06,
      kPer9: 9.75,
      bbPer9: 2.04,
      hrPer9: 1.00,
      ...overrides.pitching,
    },
    ...overrides,
  };
}

export function createMockGameState(overrides = {}) {
  return {
    inning: 1,
    isTopOfInning: true,
    outs: 0,
    scores: [0, 0],
    bases: [false, false, false],
    currentBatterIndex: 0,
    ...overrides,
  };
}

// __tests__/helpers/db.ts
export async function seedTestPlayers() {
  // Insert test MLB players into test database
}

export async function cleanupTestData() {
  // Remove all test data after each test
}
```

---

## TDD Workflow Per Session

### Starting a Session

```
1. Pull latest code
2. Run `npm test` - ALL tests must pass
3. Check coverage report - thresholds must be met
4. Identify next feature to implement
5. Write tests for that feature FIRST
```

### During Development

```
1. Write test(s) for next piece of functionality
2. Run test - confirm it FAILS (red)
3. Write minimal code to pass
4. Run test - confirm it PASSES (green)
5. Refactor if needed
6. Run ALL tests - confirm nothing broke
7. Commit: "test: add tests for X" then "feat: implement X"
```

### Ending a Session

```
1. Run full test suite - ALL must pass
2. Run coverage report - thresholds must be met
3. Commit all changes
4. Push to branch
5. Document what's next in commit message
```

### Commit Message Convention

```
# Tests first
test(game-engine): add base running tests for doubles
test(api): add team roster validation tests

# Then implementation
feat(game-engine): implement base running for doubles
feat(api): implement roster validation

# Never commit failing tests (except WIP branches)
```

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

## Manual Testing Checklist

After all automated tests pass, verify these flows manually:

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
