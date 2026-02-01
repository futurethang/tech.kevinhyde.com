# Dice Baseball V2: Stats-Driven Multiplayer Edition

## Overview

Transform the simple dice-roll baseball game into a strategic, stats-driven multiplayer experience where players build teams using real MLB players. Game outcomes are weighted by actual current-season statistics while maintaining the excitement of randomization.

### Core Philosophy
- **Strategic Depth**: Your lineup choices matter
- **Real-World Connection**: Daily stats updates keep the game fresh
- **Social Play**: Challenge friends or find new opponents
- **Extensible Design**: Architecture supports future enhancements

---

## Feature Scope: V2

### In Scope
- [x] Real-time 2-player multiplayer via persistent connection
- [x] Team creation with real MLB players (position players + 1 pitcher)
- [x] Stats-weighted outcome calculations
- [x] Batting lineup strategy
- [x] Player accounts with persistent data
- [x] Friend-based matchmaking
- [x] Game history and win/loss records

### Future Versions (Out of Scope for V2)
- [ ] Draft experience / salary cap team building
- [ ] Multiple pitchers / pitching changes
- [ ] Pinch hitters and pinch runners
- [ ] Defensive substitutions
- [ ] Season/series modes
- [ ] Leagues and tournaments
- [ ] Trading players
- [ ] Player fatigue / rest mechanics

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Game Engine │  │ Team Builder│  │ Matchmaking / Friends   │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│         └────────────────┴─────────────────────┘                 │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              │   State Management    │                          │
│              │   (Local + Sync)      │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │      WebSocket Layer    │
              │   (Real-time Sync)      │
              └────────────┬────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                     BACKEND SERVICES                             │
│                          │                                       │
│  ┌───────────────────────┴───────────────────────────┐          │
│  │              Real-time Game Server                 │          │
│  │  (WebSocket hub for game state synchronization)   │          │
│  └───────────────────────┬───────────────────────────┘          │
│                          │                                       │
│  ┌──────────────┬────────┴────────┬──────────────────┐          │
│  │              │                 │                  │          │
│  ▼              ▼                 ▼                  ▼          │
│ ┌────────┐  ┌────────┐     ┌───────────┐     ┌────────────┐    │
│ │  Auth  │  │ Match- │     │   Stats   │     │   Player   │    │
│ │Service │  │ making │     │  Service  │     │   Data     │    │
│ └────────┘  └────────┘     └─────┬─────┘     └────────────┘    │
│                                  │                              │
└──────────────────────────────────┼──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     MLB Stats API           │
                    │  (External Data Source)     │
                    └─────────────────────────────┘
```

---

## Technology Stack

### Frontend (PWA)
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | **React + Vite** | Component-based UI, fast dev experience |
| State | **Zustand** | Lightweight, great for real-time sync |
| Real-time | **Socket.io Client** | Reliable WebSocket with fallbacks |
| Styling | **Tailwind CSS** | Rapid UI development |
| Storage | **IndexedDB (Dexie)** | Offline-first, large storage |

### Backend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | **Node.js + Express** | JS everywhere, fast WebSocket support |
| Real-time | **Socket.io** | Room-based game sessions, auto-reconnect |
| Database | **Supabase (PostgreSQL)** | Free tier, real-time subscriptions, auth built-in |
| Stats API | **MLB Stats API** | Official, comprehensive, free |
| Hosting | **Railway / Render** | Easy deploy, WebSocket support, free tier |

### Why This Stack?
1. **Supabase** handles auth, database, AND has real-time subscriptions as backup
2. **Socket.io** is battle-tested for game state sync
3. **Free MLB API** - no API key needed for basic stats
4. **All services have free tiers** for MVP deployment

---

## Data Models

### Player Account
```typescript
interface UserAccount {
  id: string;                    // UUID
  username: string;              // Display name
  email: string;                 // Auth identifier
  createdAt: Date;

  // Stats
  gamesPlayed: number;
  wins: number;
  losses: number;

  // Social
  friendIds: string[];           // Other user IDs

  // Current team (can have multiple saved teams later)
  activeTeamId: string;
}
```

### Team
```typescript
interface Team {
  id: string;
  userId: string;                // Owner
  name: string;                  // e.g., "Kevin's Crushers"
  createdAt: Date;
  updatedAt: Date;

  // Roster (9 position players + 1 pitcher for V2)
  roster: RosterSlot[];

  // Batting order (array of player IDs, 1-9)
  battingOrder: string[];
}

interface RosterSlot {
  position: Position;
  mlbPlayerId: number;           // MLB API player ID

  // Cached stats (refreshed daily)
  cachedStats: PlayerStats;
  cachedAt: Date;
}

type Position =
  | 'C' | '1B' | '2B' | '3B' | 'SS'
  | 'LF' | 'CF' | 'RF'
  | 'SP';  // Starting Pitcher
```

### MLB Player Stats (Cached)
```typescript
interface PlayerStats {
  mlbPlayerId: number;
  name: string;
  team: string;
  position: string;

  // Batting stats (for position players)
  batting?: {
    avg: number;           // Batting average
    obp: number;           // On-base percentage
    slg: number;           // Slugging percentage
    ops: number;           // OBP + SLG
    hr: number;            // Home runs (total)
    so: number;            // Strikeouts
    bb: number;            // Walks
    ab: number;            // At bats
    hits: number;          // Total hits
    doubles: number;
    triples: number;
  };

  // Pitching stats (for pitchers)
  pitching?: {
    era: number;           // Earned run average
    whip: number;          // Walks + Hits per IP
    kPer9: number;         // Strikeouts per 9 innings
    bbPer9: number;        // Walks per 9 innings
    hrPer9: number;        // Home runs per 9 innings
    ip: number;            // Innings pitched
  };

  seasonYear: number;
  lastUpdated: Date;
}
```

### Game Session
```typescript
interface GameSession {
  id: string;                    // Room/game ID
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  createdAt: Date;
  completedAt?: Date;

  // Players
  homePlayer: {
    userId: string;
    teamId: string;
    connected: boolean;
  };
  visitorPlayer: {
    userId: string;
    teamId: string;
    connected: boolean;
  };

  // Current game state
  gameState: GameState;

  // Move history (for replay/verification)
  moveHistory: GameMove[];
}

interface GameState {
  inning: number;
  isTopOfInning: boolean;
  outs: number;
  scores: [number, number];      // [visitor, home]
  inningScores: number[][];
  bases: [boolean, boolean, boolean];

  // Current at-bat
  currentBatterIndex: number;    // Position in batting order
  pitchCount: number;            // For future pitch strategy

  // Outcome of last play
  lastPlay?: PlayResult;
}

interface GameMove {
  timestamp: Date;
  playerId: string;
  action: 'roll' | 'substitute' | 'timeout';  // Extensible
  result?: PlayResult;
}

interface PlayResult {
  diceRolls: [number, number];   // Raw dice values
  adjustedTotal: number;         // After stat weighting
  outcome: OutcomeType;
  runsScored: number;
  description: string;           // Human-readable result
}
```

---

## Stats-Weighted Game Mechanics

### The Core Innovation

Instead of pure dice rolls determining outcomes, we use a **probability curve adjusted by player stats**.

```
Traditional V1:
  Roll 2 dice → Lookup fixed outcome table → Result

Stats-Weighted V2:
  Roll 2 dice → Calculate base probability
              → Adjust by batter stats
              → Adjust by pitcher stats
              → Weighted random outcome → Result
```

### Outcome Probability Calculation

#### Step 1: Base Probabilities (from dice roll)
Original dice outcomes converted to probability buckets:

| Category | Original Rolls | Base Probability |
|----------|---------------|------------------|
| Home Run | 2, 12 | 5.5% (2/36) |
| Triple | 3 | 5.5% (2/36) |
| Double | 10 | 8.3% (3/36) |
| Single | 5, 9 | 22.2% (8/36) |
| Walk | 4 | 8.3% (3/36) |
| Strikeout | 11 | 5.5% (2/36) |
| Ground Out | 6, 8 | 27.8% (10/36) |
| Fly Out | 7 | 16.7% (6/36) |

#### Step 2: Apply Batter Modifiers

```typescript
function calculateBatterModifiers(batter: PlayerStats): Modifiers {
  const batting = batter.batting!;

  // OPS-based hit modifier (league avg OPS ~.720)
  const hitModifier = batting.ops / 0.720;  // >1 = better than avg

  // Power modifier for extra-base hits
  const powerModifier = batting.slg / 0.400;  // League avg SLG ~.400

  // Discipline modifier (walks, strikeouts)
  const walkRate = batting.bb / batting.ab;
  const strikeoutRate = batting.so / batting.ab;
  const disciplineModifier = walkRate / strikeoutRate;

  return {
    single: hitModifier * 0.9,      // OPS helps singles
    double: hitModifier * powerModifier * 0.8,
    triple: powerModifier * 1.2,    // Power + speed (future: add speed stat)
    homeRun: powerModifier * 1.5,   // Heavily power-weighted
    walk: disciplineModifier * 1.1,
    strikeout: 1 / disciplineModifier,  // Inverse
    groundOut: 1.0,                 // Neutral
    flyOut: powerModifier * 0.9,    // Power hitters fly out more
  };
}
```

#### Step 3: Apply Pitcher Modifiers

```typescript
function calculatePitcherModifiers(pitcher: PlayerStats): Modifiers {
  const pitching = pitcher.pitching!;

  // ERA-based suppression (league avg ERA ~4.00)
  const suppressionFactor = 4.00 / pitching.era;  // >1 = better pitcher

  // WHIP affects hits allowed
  const whipModifier = 1.30 / pitching.whip;  // League avg WHIP ~1.30

  // K rate
  const strikeoutModifier = pitching.kPer9 / 8.5;  // League avg ~8.5 K/9

  return {
    single: 1 / whipModifier,
    double: 1 / whipModifier * 0.9,
    triple: 1 / whipModifier * 0.8,
    homeRun: pitching.hrPer9 / 1.2,  // HR/9 directly affects HR rate
    walk: pitching.bbPer9 / 3.0,     // BB/9 affects walks
    strikeout: strikeoutModifier,
    groundOut: 1.0,
    flyOut: 1.0,
  };
}
```

#### Step 4: Calculate Final Probabilities

```typescript
function calculateOutcomeProbabilities(
  baseProbabilities: Probabilities,
  batterMods: Modifiers,
  pitcherMods: Modifiers
): Probabilities {
  const outcomes = Object.keys(baseProbabilities) as OutcomeType[];
  const adjusted: Probabilities = {};

  for (const outcome of outcomes) {
    // Combine modifiers (batter helps, pitcher hurts for hits)
    const isPositiveOutcome = ['single', 'double', 'triple', 'homeRun', 'walk'].includes(outcome);

    if (isPositiveOutcome) {
      adjusted[outcome] = baseProbabilities[outcome]
        * batterMods[outcome]
        * (1 / pitcherMods[outcome]);  // Pitcher reduces
    } else {
      adjusted[outcome] = baseProbabilities[outcome]
        * (1 / batterMods[outcome])    // Good batters avoid outs
        * pitcherMods[outcome];        // Good pitchers increase outs
    }
  }

  // Normalize to 100%
  return normalize(adjusted);
}
```

#### Step 5: Resolve Outcome

```typescript
function resolveAtBat(
  batter: PlayerStats,
  pitcher: PlayerStats,
  diceRoll: [number, number]
): PlayResult {
  // Use dice roll to seed randomness (preserves dice-rolling fun)
  const diceTotal = diceRoll[0] + diceRoll[1];
  const diceInfluence = getDiceInfluence(diceTotal);

  // Calculate weighted probabilities
  const baseProbabilities = getBaseProbabilities();
  const batterMods = calculateBatterModifiers(batter);
  const pitcherMods = calculatePitcherModifiers(pitcher);
  const finalProbabilities = calculateOutcomeProbabilities(
    baseProbabilities, batterMods, pitcherMods
  );

  // Dice roll influences which part of the probability curve we sample
  // High rolls favor better outcomes, low rolls favor worse
  const outcome = weightedRandomWithBias(finalProbabilities, diceInfluence);

  return {
    diceRolls: diceRoll,
    adjustedTotal: diceTotal,
    outcome,
    runsScored: 0,  // Calculated by game engine
    description: generatePlayDescription(batter, outcome)
  };
}
```

### Why This Works

1. **Dice still matter**: Rolling high still feels good, rolling low still hurts
2. **But stats shift the odds**: A .350 hitter has better outcomes on the same roll vs a .220 hitter
3. **Pitching matters**: Facing an ace vs a journeyman changes everything
4. **Strategy emerges**: Batting order matters - who's up with runners on?

---

## Real-Time Multiplayer Architecture

### Connection Flow

```
Player A                    Server                     Player B
   │                          │                           │
   │───Create Game───────────▶│                           │
   │◀──────────Game ID────────│                           │
   │                          │                           │
   │   (Share game ID/link)   │                           │
   │                          │◀─────Join Game (ID)───────│
   │◀─────Player B Joined─────│──────Game Starting───────▶│
   │                          │                           │
   │◀════════GAME STATE SYNC══════════════════════════════│
   │                          │                           │
   │────Roll Dice────────────▶│                           │
   │◀─────Dice Result─────────│─────Dice Result──────────▶│
   │◀─────State Update────────│─────State Update─────────▶│
   │                          │                           │
   │                          │◀────Roll Dice─────────────│
   │◀─────Dice Result─────────│─────Dice Result──────────▶│
   │◀─────State Update────────│─────State Update─────────▶│
   │                          │                           │
   ▼                          ▼                           ▼
```

### Socket.io Events

```typescript
// Client → Server
interface ClientEvents {
  'game:create': () => void;
  'game:join': (gameId: string) => void;
  'game:roll': () => void;
  'game:leave': () => void;
  'game:rematch': () => void;
}

// Server → Client
interface ServerEvents {
  'game:created': (gameId: string) => void;
  'game:joined': (gameState: GameState) => void;
  'game:state': (gameState: GameState) => void;
  'game:roll-result': (result: PlayResult) => void;
  'game:ended': (finalState: GameState, winner: string) => void;
  'opponent:connected': () => void;
  'opponent:disconnected': () => void;
  'error': (message: string) => void;
}
```

### Handling Disconnections

```typescript
// Server-side disconnect handling
socket.on('disconnect', async () => {
  const game = await getGameByPlayer(socket.userId);
  if (!game) return;

  // Mark player as disconnected
  game.markDisconnected(socket.userId);

  // Notify opponent
  socket.to(game.id).emit('opponent:disconnected');

  // Start reconnection timer (60 seconds)
  setTimeout(async () => {
    const currentGame = await getGame(game.id);
    if (currentGame?.isPlayerDisconnected(socket.userId)) {
      // Auto-forfeit if still disconnected
      await currentGame.forfeit(socket.userId);
      io.to(game.id).emit('game:ended', {
        ...currentGame.state,
        reason: 'opponent_disconnect'
      });
    }
  }, 60000);
});

// Reconnection
socket.on('game:reconnect', async (gameId: string) => {
  const game = await getGame(gameId);
  if (game?.hasPlayer(socket.userId)) {
    game.markConnected(socket.userId);
    socket.join(gameId);
    socket.emit('game:state', game.state);
    socket.to(gameId).emit('opponent:connected');
  }
});
```

---

## MLB Stats API Integration

### Data Source
The **MLB Stats API** is free and requires no authentication for basic stats.

Base URL: `https://statsapi.mlb.com/api/v1`

### Key Endpoints

```typescript
// Get all players for current season
GET /sports/1/players?season=2025

// Get player stats
GET /people/{playerId}/stats?stats=season&season=2025&group=hitting
GET /people/{playerId}/stats?stats=season&season=2025&group=pitching

// Get team roster
GET /teams/{teamId}/roster?season=2025

// Search players by name
GET /people/search?names=Shohei%20Ohtani
```

### Stats Caching Strategy

```typescript
class StatsService {
  private cache: Map<number, CachedStats> = new Map();

  async getPlayerStats(mlbPlayerId: number): Promise<PlayerStats> {
    const cached = this.cache.get(mlbPlayerId);

    // Return cached if less than 24 hours old
    if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
      return cached.stats;
    }

    // Fetch fresh stats
    const stats = await this.fetchFromMLB(mlbPlayerId);
    this.cache.set(mlbPlayerId, {
      stats,
      fetchedAt: Date.now()
    });

    // Also persist to database for offline/faster access
    await db.playerStats.upsert(stats);

    return stats;
  }

  // Batch refresh all active players (run daily via cron)
  async refreshAllActiveStats(): Promise<void> {
    const activePlayers = await db.getActiveRosterPlayers();

    // Batch requests with rate limiting
    for (const batch of chunk(activePlayers, 10)) {
      await Promise.all(batch.map(p => this.getPlayerStats(p.mlbPlayerId)));
      await sleep(1000);  // Rate limit: 10 requests/second
    }
  }
}
```

### Handling Off-Season

```typescript
function getRelevantStats(player: PlayerStats): PlayerStats {
  const currentMonth = new Date().getMonth();

  // MLB season: April (3) - October (9)
  const isOffSeason = currentMonth < 3 || currentMonth > 9;

  if (isOffSeason) {
    // Use previous season stats, or career averages
    return player.previousSeasonStats ?? player.careerStats;
  }

  // During season, use current stats
  // But handle players with few at-bats (small sample size)
  if (player.batting && player.batting.ab < 50) {
    // Blend with career average for stability
    return blendWithCareerStats(player, 0.5);
  }

  return player;
}
```

---

## User Interface Screens

### 1. Home / Dashboard
```
┌────────────────────────────────────────┐
│  ⚾ DICE BASEBALL                      │
│                                        │
│  Welcome back, Kevin!                  │
│  Record: 15-8                          │
│                                        │
│  ┌──────────────┐  ┌──────────────┐   │
│  │  🎮 PLAY     │  │  👥 TEAM     │   │
│  │  Start Game  │  │  Manage      │   │
│  └──────────────┘  └──────────────┘   │
│                                        │
│  ┌──────────────┐  ┌──────────────┐   │
│  │  👋 FRIENDS  │  │  📊 HISTORY  │   │
│  │  Challenge   │  │  Past Games  │   │
│  └──────────────┘  └──────────────┘   │
│                                        │
│  Recent Games:                         │
│  ├ W vs Sarah (5-3) - 2h ago          │
│  ├ L vs Mike (2-7) - Yesterday        │
│  └ W vs Alex (11-4) - 2 days ago      │
│                                        │
└────────────────────────────────────────┘
```

### 2. Team Builder
```
┌────────────────────────────────────────┐
│  ← Back         MY TEAM         Save   │
│                                        │
│  Team Name: [Kevin's Crushers    ]     │
│                                        │
│  ═══ BATTING ORDER ═══                 │
│  ┌─────────────────────────────────┐   │
│  │ 1. SS  Trea Turner     .298 │↑↓│   │
│  │ 2. CF  Mike Trout      .285 │↑↓│   │
│  │ 3. DH  Shohei Ohtani   .312 │↑↓│   │
│  │ 4. 1B  Freddie Freeman .310 │↑↓│   │
│  │ 5. 3B  Manny Machado   .275 │↑↓│   │
│  │ 6. RF  Mookie Betts    .290 │↑↓│   │
│  │ 7. LF  Juan Soto       .288 │↑↓│   │
│  │ 8. 2B  Marcus Semien   .265 │↑↓│   │
│  │ 9. C   Will Smith      .260 │↑↓│   │
│  └─────────────────────────────────┘   │
│                                        │
│  ═══ PITCHER ═══                       │
│  ┌─────────────────────────────────┐   │
│  │ SP  Gerrit Cole  3.12 ERA      │   │
│  └─────────────────────────────────┘   │
│                                        │
│  [+ Add Player]    [🔍 Search MLB]     │
│                                        │
└────────────────────────────────────────┘
```

### 3. Player Search Modal
```
┌────────────────────────────────────────┐
│  SEARCH PLAYERS              ✕ Close   │
│                                        │
│  [🔍 Search by name...            ]    │
│                                        │
│  Filter: [All ▾] [Position ▾] [Team ▾] │
│                                        │
│  Results:                              │
│  ┌─────────────────────────────────┐   │
│  │ 👤 Shohei Ohtani     LAD  DH    │   │
│  │    .312 AVG | .985 OPS | 34 HR  │   │
│  │                      [+ Select] │   │
│  ├─────────────────────────────────┤   │
│  │ 👤 Mike Trout        LAA  CF    │   │
│  │    .285 AVG | .905 OPS | 28 HR  │   │
│  │                      [+ Select] │   │
│  ├─────────────────────────────────┤   │
│  │ 👤 Aaron Judge       NYY  RF    │   │
│  │    .278 AVG | .955 OPS | 42 HR  │   │
│  │                      [+ Select] │   │
│  └─────────────────────────────────┘   │
│                                        │
└────────────────────────────────────────┘
```

### 4. Matchmaking
```
┌────────────────────────────────────────┐
│  ← Back           PLAY                 │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  🎲 QUICK MATCH                  │  │
│  │  Find a random opponent          │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  🔗 CREATE PRIVATE GAME          │  │
│  │  Share code with a friend        │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  🎫 JOIN WITH CODE               │  │
│  │  [Enter game code...]            │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ─── ONLINE FRIENDS ───                │
│  ┌──────────────────────────────────┐  │
│  │ 🟢 Sarah (12-5)     [Challenge]  │  │
│  │ 🟢 Mike (8-10)      [Challenge]  │  │
│  │ ⚫ Alex (15-3)      Offline      │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

### 5. Live Game
```
┌────────────────────────────────────────┐
│  INNING 5 TOP      Kevin vs Sarah      │
│                                        │
│  ┌────┬───┬───┬───┬───┬───┬───┬───┬───┐│
│  │    │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 ││
│  ├────┼───┼───┼───┼───┼───┼───┼───┼───┤│
│  │VIS │ 0 │ 2 │ 0 │ 1 │   │   │   │   ││
│  │HOM │ 1 │ 0 │ 0 │ 0 │   │   │   │   ││
│  └────┴───┴───┴───┴───┴───┴───┴───┴───┘│
│                                        │
│  VISITOR: 3    HOME: 1     OUTS: ●●○   │
│                                        │
│          ┌─────────[2B]─────────┐      │
│          │         🟡          │       │
│         /                       \      │
│       [3B]                     [1B]    │
│         ○                       🟡     │
│          \                     /       │
│           \       [HP]       /         │
│            └───────⚾────────┘          │
│                                        │
│  AT BAT: Mike Trout (.285 / .905 OPS)  │
│  vs. Clayton Kershaw (2.85 ERA)        │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │           🎲 ROLL DICE           │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Last Play: Ohtani singled to right,   │
│  Turner scored from 2nd!               │
│                                        │
└────────────────────────────────────────┘
```

---

## Database Schema (Supabase/PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  games_played INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0
);

-- Friends relationship
CREATE TABLE friends (
  user_id UUID REFERENCES users(id),
  friend_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team roster slots
CREATE TABLE roster_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  mlb_player_id INT NOT NULL,
  batting_order INT,  -- 1-9 for batters, NULL for pitcher
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, position)
);

-- Cached MLB player stats
CREATE TABLE mlb_player_stats (
  mlb_player_id INT PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT,
  position TEXT,
  season_year INT NOT NULL,
  batting_stats JSONB,
  pitching_stats JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Game sessions
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'waiting',  -- waiting, active, completed, abandoned
  home_user_id UUID REFERENCES users(id),
  home_team_id UUID REFERENCES teams(id),
  visitor_user_id UUID REFERENCES users(id),
  visitor_team_id UUID REFERENCES teams(id),
  game_state JSONB NOT NULL DEFAULT '{}',
  winner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Game moves (play-by-play history)
CREATE TABLE game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES users(id),
  move_number INT NOT NULL,
  action TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_teams_user ON teams(user_id);
CREATE INDEX idx_roster_team ON roster_slots(team_id);
CREATE INDEX idx_games_home ON game_sessions(home_user_id);
CREATE INDEX idx_games_visitor ON game_sessions(visitor_user_id);
CREATE INDEX idx_moves_game ON game_moves(game_id);
```

---

## API Endpoints

### Authentication (via Supabase Auth)
```
POST /auth/signup        - Create account
POST /auth/login         - Login
POST /auth/logout        - Logout
GET  /auth/me            - Get current user
```

### Teams
```
GET    /api/teams              - List user's teams
POST   /api/teams              - Create team
GET    /api/teams/:id          - Get team details
PUT    /api/teams/:id          - Update team
DELETE /api/teams/:id          - Delete team
PUT    /api/teams/:id/active   - Set as active team
```

### Roster
```
PUT    /api/teams/:id/roster        - Update entire roster
POST   /api/teams/:id/roster/add    - Add player to roster
DELETE /api/teams/:id/roster/:pos   - Remove player
PUT    /api/teams/:id/batting-order - Update batting order
```

### Players (MLB)
```
GET /api/mlb/search?name=xxx       - Search players
GET /api/mlb/players/:id           - Get player stats
GET /api/mlb/teams                 - List MLB teams
GET /api/mlb/teams/:id/roster      - Get team roster
```

### Games
```
POST   /api/games                  - Create new game
GET    /api/games/:id              - Get game state
POST   /api/games/join/:code       - Join game by code
GET    /api/games/history          - User's game history
```

### Friends
```
GET    /api/friends                - List friends
POST   /api/friends/add            - Add friend
DELETE /api/friends/:id            - Remove friend
GET    /api/friends/online         - Get online friends
```

---

## Security Considerations

### Game Integrity
```typescript
// All dice rolls happen server-side
function handleRollRequest(socket: Socket, gameId: string) {
  const game = games.get(gameId);

  // Verify it's this player's turn
  if (!game.isPlayerTurn(socket.userId)) {
    socket.emit('error', 'Not your turn');
    return;
  }

  // Server generates dice roll
  const diceRoll: [number, number] = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];

  // Calculate outcome server-side
  const result = resolveAtBat(
    game.getCurrentBatter(),
    game.getPitcher(),
    diceRoll
  );

  // Update game state
  game.applyResult(result);

  // Broadcast to both players
  io.to(gameId).emit('game:roll-result', result);
  io.to(gameId).emit('game:state', game.state);
}
```

### Rate Limiting
```typescript
// Prevent spam/abuse
const rateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,              // 60 requests per minute
  message: 'Too many requests'
});

app.use('/api/', rateLimiter);
```

### Input Validation
```typescript
// Validate team rosters
function validateRoster(roster: RosterSlot[]): ValidationResult {
  const errors: string[] = [];

  // Must have exactly 9 position players + 1 pitcher
  if (roster.filter(r => r.position !== 'SP').length !== 9) {
    errors.push('Must have exactly 9 position players');
  }
  if (roster.filter(r => r.position === 'SP').length !== 1) {
    errors.push('Must have exactly 1 starting pitcher');
  }

  // No duplicate players
  const playerIds = roster.map(r => r.mlbPlayerId);
  if (new Set(playerIds).size !== playerIds.length) {
    errors.push('Cannot have duplicate players');
  }

  // Valid batting order (1-9, no gaps)
  const battingOrder = roster
    .filter(r => r.position !== 'SP')
    .map(r => r.battingOrder)
    .sort();
  if (JSON.stringify(battingOrder) !== JSON.stringify([1,2,3,4,5,6,7,8,9])) {
    errors.push('Invalid batting order');
  }

  return { valid: errors.length === 0, errors };
}
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PRODUCTION                              │
│                                                              │
│  ┌─────────────────┐        ┌─────────────────────────────┐ │
│  │   GitHub Pages  │        │      Railway/Render         │ │
│  │   (Frontend)    │        │        (Backend)            │ │
│  │                 │        │                             │ │
│  │  - React PWA    │───────▶│  - Express + Socket.io      │ │
│  │  - Static files │        │  - Game logic               │ │
│  │                 │        │  - Stats caching            │ │
│  └─────────────────┘        └──────────┬──────────────────┘ │
│                                        │                     │
│                              ┌─────────▼─────────┐          │
│                              │     Supabase      │          │
│                              │                   │          │
│                              │  - PostgreSQL     │          │
│                              │  - Auth           │          │
│                              │  - Real-time*     │          │
│                              └───────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

* Real-time subscriptions as fallback for game state sync
```

### Environment Variables

```bash
# Backend (.env)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://tech.kevinhyde.com

# Frontend (.env)
VITE_API_URL=https://api.dicebaseball.com
VITE_WS_URL=wss://api.dicebaseball.com
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up React + Vite project structure
- [ ] Configure Supabase (database, auth)
- [ ] Create backend Express server with Socket.io
- [ ] Implement user auth flow
- [ ] Basic UI shell (navigation, layouts)

### Phase 2: Team Building (Week 2-3)
- [ ] MLB Stats API integration
- [ ] Player search and stats display
- [ ] Team creation UI
- [ ] Roster management
- [ ] Batting order configuration
- [ ] Stats caching service

### Phase 3: Core Game Engine (Week 3-4)
- [ ] Port existing dice game logic
- [ ] Implement stats-weighted probability system
- [ ] Server-side game state management
- [ ] Real-time sync between players
- [ ] Game result persistence

### Phase 4: Matchmaking & Social (Week 4-5)
- [ ] Friend system
- [ ] Private game codes
- [ ] Quick match (random opponent)
- [ ] Game history
- [ ] Win/loss tracking

### Phase 5: Polish & Launch (Week 5-6)
- [ ] PWA optimization (offline support)
- [ ] Performance tuning
- [ ] Error handling & edge cases
- [ ] Mobile responsive design
- [ ] Deploy to production
- [ ] Beta testing

---

## Future Extensibility

The architecture is designed to support:

### V3: Draft & Roster Management
```typescript
interface DraftConfig {
  salaryCap: number;
  rosterSize: number;
  positionRequirements: PositionReqs;
}

interface PlayerContract {
  playerId: number;
  salary: number;
  yearsRemaining: number;
}
```

### V4: Advanced Pitching
```typescript
interface PitchingRotation {
  starters: PlayerId[];      // 5-man rotation
  bullpen: PlayerId[];       // Relief pitchers
  closer: PlayerId;
}

interface PitchingChange {
  inning: number;
  outgoingPitcher: PlayerId;
  incomingPitcher: PlayerId;
  pitchCount: number;
}
```

### V5: Season Mode
```typescript
interface Season {
  id: string;
  participants: UserId[];
  schedule: Matchup[];
  standings: Standing[];
  playoffs: PlayoffBracket;
}

interface Matchup {
  homeTeam: UserId;
  awayTeam: UserId;
  scheduledDate: Date;
  result?: GameResult;
}
```

---

## Open Questions for V2

1. **Stats Weighting Balance**: How much should stats influence outcomes vs pure dice luck? (Currently ~60% stats, ~40% luck)

2. **Player Pool**: Allow any MLB player, or limit to active roster players only?

3. **Off-Season Behavior**: Use previous season stats, career stats, or projections?

4. **Quick Match**: Implement matchmaking rating (MMR) or purely random?

5. **Monetization (Future)**: Premium cosmetics, team slots, or keep fully free?

---

## Success Metrics

- **Engagement**: Average games per user per week
- **Retention**: 7-day and 30-day retention rates
- **Social**: % of games played with friends vs randoms
- **Strategic Depth**: Correlation between team quality (avg OPS) and win rate

---

*This spec is a living document. Update as implementation progresses.*
