# Dice Baseball V2: Backend Services

## Overview

Backend services handle:
1. **MLB Stats Sync** - Nightly data refresh from MLB API
2. **Game Engine** - Stats-weighted outcome calculations
3. **Real-time Server** - WebSocket game state sync
4. **Matchmaking** - Game creation and joining
5. **Cleanup Jobs** - Abandoned game handling

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVER                               │
│                        (Node.js + Express)                           │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │   REST Routes   │  │  Socket.io Hub  │  │    Cron Scheduler   │  │
│  │                 │  │                 │  │                     │  │
│  │  /api/users     │  │  Game rooms     │  │  MLB sync (nightly) │  │
│  │  /api/teams     │  │  State sync     │  │  Cleanup (hourly)   │  │
│  │  /api/games     │  │  Reconnection   │  │  Stats refresh      │  │
│  │  /api/mlb       │  │                 │  │                     │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                      │              │
│           └────────────────────┼──────────────────────┘              │
│                                │                                     │
│                    ┌───────────┴───────────┐                        │
│                    │    Service Layer      │                        │
│                    ├───────────────────────┤                        │
│                    │  - MLBService         │                        │
│                    │  - GameEngine         │                        │
│                    │  - StatsWeighting     │                        │
│                    │  - UserService        │                        │
│                    │  - TeamService        │                        │
│                    └───────────┬───────────┘                        │
│                                │                                     │
└────────────────────────────────┼─────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │        Supabase         │
                    │  - PostgreSQL database  │
                    │  - Authentication       │
                    └─────────────────────────┘
```

---

## 1. MLB Stats Sync Service

### Purpose
Fetch and cache current season MLB player statistics nightly.

### Schedule
- **Primary run:** Daily at 5:00 AM UTC (12:00 AM EST / after west coast games)
- **Fallback run:** Daily at 6:00 AM UTC (if primary fails)

### Data Sources

**MLB Stats API** (no authentication required):
```
Base URL: https://statsapi.mlb.com/api/v1
```

| Endpoint | Purpose |
|----------|---------|
| `/sports/1/players?season={year}` | All active players |
| `/people/{id}?hydrate=stats(group=[hitting,pitching],type=season)` | Player stats |
| `/teams?sportId=1` | Team list |

**Player photos:**
```
https://img.mlb.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{mlbId}/headshot/67/current
```

### Sync Algorithm

```typescript
// services/mlb-sync.ts

interface SyncResult {
  totalPlayers: number;
  updated: number;
  failed: number;
  duration: number;
}

async function syncMLBPlayers(): Promise<SyncResult> {
  const startTime = Date.now();
  const season = getCurrentSeason();

  console.log(`[MLB Sync] Starting sync for ${season} season`);

  // Step 1: Fetch all active players
  const players = await fetchAllPlayers(season);
  console.log(`[MLB Sync] Found ${players.length} active players`);

  // Step 2: Batch fetch stats (10 players at a time, 1 second delay)
  const BATCH_SIZE = 10;
  const DELAY_MS = 1000;

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(player => fetchAndUpsertPlayer(player.id, season))
    );

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        updated++;
      } else {
        failed++;
        console.error(`[MLB Sync] Failed for player ${batch[idx].id}:`, result.reason);
      }
    });

    // Rate limiting
    if (i + BATCH_SIZE < players.length) {
      await sleep(DELAY_MS);
    }

    // Progress log every 100 players
    if ((i + BATCH_SIZE) % 100 === 0) {
      console.log(`[MLB Sync] Progress: ${i + BATCH_SIZE}/${players.length}`);
    }
  }

  // Step 3: Mark inactive players
  await markInactivePlayers(season);

  const duration = Date.now() - startTime;

  console.log(`[MLB Sync] Complete: ${updated} updated, ${failed} failed, ${duration}ms`);

  return {
    totalPlayers: players.length,
    updated,
    failed,
    duration
  };
}
```

### Individual Player Fetch

```typescript
async function fetchAndUpsertPlayer(mlbId: number, season: number): Promise<void> {
  // Fetch from MLB API with stats
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/people/${mlbId}?hydrate=stats(group=[hitting,pitching],type=season,season=${season})`
  );

  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status}`);
  }

  const data = await response.json();
  const player = data.people[0];

  // Transform to our schema
  const dbPlayer = {
    mlb_id: player.id,
    full_name: player.fullName,
    first_name: player.firstName,
    last_name: player.lastName,
    primary_position: player.primaryPosition.abbreviation,
    current_team: player.currentTeam?.abbreviation ?? null,
    current_team_id: player.currentTeam?.id ?? null,
    photo_url: buildPhotoUrl(player.id),
    batting_stats: extractBattingStats(player.stats),
    pitching_stats: extractPitchingStats(player.stats),
    season_year: season,
    is_active: true,
    last_updated: new Date().toISOString()
  };

  // Upsert to database
  await supabase
    .from('mlb_players')
    .upsert(dbPlayer, { onConflict: 'mlb_id' });
}

function extractBattingStats(stats: any[]): object | null {
  const hitting = stats?.find(s =>
    s.group.displayName === 'hitting' && s.type.displayName === 'season'
  );

  if (!hitting?.splits?.[0]?.stat) return null;

  const s = hitting.splits[0].stat;
  return {
    gamesPlayed: s.gamesPlayed ?? 0,
    atBats: s.atBats ?? 0,
    runs: s.runs ?? 0,
    hits: s.hits ?? 0,
    doubles: s.doubles ?? 0,
    triples: s.triples ?? 0,
    homeRuns: s.homeRuns ?? 0,
    rbi: s.rbi ?? 0,
    walks: s.baseOnBalls ?? 0,
    strikeouts: s.strikeOuts ?? 0,
    stolenBases: s.stolenBases ?? 0,
    avg: parseFloat(s.avg) || 0,
    obp: parseFloat(s.obp) || 0,
    slg: parseFloat(s.slg) || 0,
    ops: parseFloat(s.ops) || 0
  };
}

function extractPitchingStats(stats: any[]): object | null {
  const pitching = stats?.find(s =>
    s.group.displayName === 'pitching' && s.type.displayName === 'season'
  );

  if (!pitching?.splits?.[0]?.stat) return null;

  const s = pitching.splits[0].stat;
  return {
    gamesPlayed: s.gamesPlayed ?? 0,
    gamesStarted: s.gamesStarted ?? 0,
    wins: s.wins ?? 0,
    losses: s.losses ?? 0,
    era: parseFloat(s.era) || 0,
    inningsPitched: parseFloat(s.inningsPitched) || 0,
    hits: s.hits ?? 0,
    runs: s.runs ?? 0,
    earnedRuns: s.earnedRuns ?? 0,
    homeRuns: s.homeRuns ?? 0,
    walks: s.baseOnBalls ?? 0,
    strikeouts: s.strikeOuts ?? 0,
    whip: parseFloat(s.whip) || 0,
    kPer9: parseFloat(s.strikeoutsPer9Inn) || 0,
    bbPer9: parseFloat(s.walksPer9Inn) || 0,
    hrPer9: parseFloat(s.homeRunsPer9) || 0
  };
}
```

### Season Detection

```typescript
function getCurrentSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  // MLB season: April (3) through October (9)
  // Off-season: November through March
  // During off-season, use previous year's stats

  if (month >= 3 && month <= 9) {
    return year; // Current season
  } else if (month >= 10) {
    return year; // Post-season, still use current year
  } else {
    return year - 1; // Jan-Mar, use last year
  }
}
```

### Salary Data (Optional Enhancement)

Salary data isn't in the MLB API. Options:
1. **Manual entry** for top ~200 players
2. **Third-party API** (Spotrac, Baseball Reference)
3. **Skip for V2** - display as "N/A"

```typescript
// If implementing salary import
async function importSalaryData(): Promise<void> {
  // Example: CSV import from manual curation
  const salaryData = await parseSalaryCSV('./data/salaries-2025.csv');

  for (const entry of salaryData) {
    await supabase
      .from('mlb_players')
      .update({ salary_2025: entry.salary })
      .eq('mlb_id', entry.mlbId);
  }
}
```

---

## 2. Game Engine Service

### Purpose
Calculate stats-weighted outcomes for each at-bat.

### Outcome Types

```typescript
type OutcomeType =
  | 'homeRun'
  | 'triple'
  | 'double'
  | 'single'
  | 'walk'
  | 'strikeout'
  | 'groundOut'
  | 'flyOut';

interface PlayResult {
  diceRolls: [number, number];
  outcome: OutcomeType;
  batter: { mlbId: number; name: string };
  pitcher: { mlbId: number; name: string };
  description: string;
  runsScored: number;
  outsRecorded: number;
  newBases: [boolean, boolean, boolean];
}
```

### Base Probabilities

Derived from standard 2d6 dice distribution:

```typescript
const BASE_PROBABILITIES: Record<OutcomeType, number> = {
  homeRun:   0.055,  // 5.5% (rolls: 2, 12)
  triple:    0.055,  // 5.5% (roll: 3)
  double:    0.083,  // 8.3% (roll: 10)
  single:    0.222,  // 22.2% (rolls: 5, 9)
  walk:      0.083,  // 8.3% (roll: 4)
  strikeout: 0.055,  // 5.5% (roll: 11)
  groundOut: 0.278,  // 27.8% (rolls: 6, 8)
  flyOut:    0.167   // 16.7% (roll: 7)
};
```

### Stats Weighting Algorithm

```typescript
// services/game-engine.ts

interface BatterStats {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  bb: number;  // walks
  so: number;  // strikeouts
  ab: number;  // at bats
}

interface PitcherStats {
  era: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
}

// League average constants (approximate 2024 values)
const LEAGUE_AVG = {
  ops: 0.720,
  slg: 0.400,
  obp: 0.320,
  era: 4.00,
  whip: 1.30,
  kPer9: 8.5,
  bbPer9: 3.0,
  hrPer9: 1.2
};

function calculateBatterModifiers(stats: BatterStats): Record<OutcomeType, number> {
  // OPS-based overall hitting ability
  const hitModifier = stats.ops / LEAGUE_AVG.ops;

  // Power for extra-base hits
  const powerModifier = stats.slg / LEAGUE_AVG.slg;

  // Plate discipline
  const walkRate = stats.ab > 0 ? stats.bb / stats.ab : 0.08;
  const strikeoutRate = stats.ab > 0 ? stats.so / stats.ab : 0.20;
  const disciplineModifier = (walkRate / 0.08) / (strikeoutRate / 0.20);

  return {
    single:    clamp(hitModifier * 0.9, 0.5, 1.5),
    double:    clamp(hitModifier * powerModifier * 0.8, 0.4, 1.8),
    triple:    clamp(powerModifier * 1.2, 0.3, 2.0),
    homeRun:   clamp(powerModifier * 1.5, 0.3, 2.5),
    walk:      clamp(disciplineModifier * 1.1, 0.5, 2.0),
    strikeout: clamp(1 / disciplineModifier, 0.5, 2.0),
    groundOut: 1.0,
    flyOut:    clamp(powerModifier * 0.9, 0.7, 1.3)
  };
}

function calculatePitcherModifiers(stats: PitcherStats): Record<OutcomeType, number> {
  // ERA-based overall effectiveness
  const suppressionFactor = LEAGUE_AVG.era / Math.max(stats.era, 1.5);

  // WHIP affects hits allowed
  const whipModifier = LEAGUE_AVG.whip / Math.max(stats.whip, 0.8);

  // Strikeout ability
  const kModifier = stats.kPer9 / LEAGUE_AVG.kPer9;

  // Walk tendency
  const bbModifier = stats.bbPer9 / LEAGUE_AVG.bbPer9;

  // Home run tendency
  const hrModifier = stats.hrPer9 / LEAGUE_AVG.hrPer9;

  return {
    single:    clamp(1 / whipModifier, 0.5, 1.5),
    double:    clamp(1 / (whipModifier * 0.9), 0.5, 1.5),
    triple:    clamp(1 / (whipModifier * 0.8), 0.5, 1.5),
    homeRun:   clamp(hrModifier, 0.4, 2.0),
    walk:      clamp(bbModifier, 0.5, 1.8),
    strikeout: clamp(kModifier, 0.6, 1.8),
    groundOut: 1.0,
    flyOut:    1.0
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

### Outcome Resolution

```typescript
function resolveAtBat(
  batter: BatterStats,
  pitcher: PitcherStats,
  diceRoll: [number, number]
): OutcomeType {
  // Calculate modified probabilities
  const batterMods = calculateBatterModifiers(batter);
  const pitcherMods = calculatePitcherModifiers(pitcher);

  const adjusted: Record<OutcomeType, number> = {} as any;
  const positiveOutcomes: OutcomeType[] = ['single', 'double', 'triple', 'homeRun', 'walk'];

  for (const outcome of Object.keys(BASE_PROBABILITIES) as OutcomeType[]) {
    const base = BASE_PROBABILITIES[outcome];

    if (positiveOutcomes.includes(outcome)) {
      // Good outcomes: batter helps, pitcher hurts
      adjusted[outcome] = base * batterMods[outcome] * (1 / pitcherMods[outcome]);
    } else {
      // Bad outcomes: good batter reduces, good pitcher increases
      adjusted[outcome] = base * (1 / batterMods[outcome]) * pitcherMods[outcome];
    }
  }

  // Normalize to sum to 1.0
  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(adjusted) as OutcomeType[]) {
    adjusted[key] /= total;
  }

  // Use dice roll to bias the selection
  // Higher dice totals favor better outcomes
  const diceTotal = diceRoll[0] + diceRoll[1];
  const diceBias = (diceTotal - 7) / 10; // Range: -0.5 to +0.5

  // Apply bias: shift probability mass toward good/bad outcomes
  const biased = applyDiceBias(adjusted, diceBias);

  // Weighted random selection
  return weightedRandomSelect(biased);
}

function applyDiceBias(
  probs: Record<OutcomeType, number>,
  bias: number
): Record<OutcomeType, number> {
  const result = { ...probs };
  const goodOutcomes: OutcomeType[] = ['homeRun', 'triple', 'double', 'single', 'walk'];
  const badOutcomes: OutcomeType[] = ['strikeout', 'groundOut', 'flyOut'];

  // Calculate how much to shift
  const shiftAmount = Math.abs(bias) * 0.15; // Max 7.5% shift

  if (bias > 0) {
    // High roll: boost good outcomes
    const goodTotal = goodOutcomes.reduce((sum, o) => sum + result[o], 0);
    const badTotal = badOutcomes.reduce((sum, o) => sum + result[o], 0);

    for (const o of goodOutcomes) {
      result[o] += (result[o] / goodTotal) * shiftAmount * badTotal;
    }
    for (const o of badOutcomes) {
      result[o] -= (result[o] / badTotal) * shiftAmount * badTotal;
    }
  } else if (bias < 0) {
    // Low roll: boost bad outcomes
    const goodTotal = goodOutcomes.reduce((sum, o) => sum + result[o], 0);
    const badTotal = badOutcomes.reduce((sum, o) => sum + result[o], 0);

    for (const o of badOutcomes) {
      result[o] += (result[o] / badTotal) * shiftAmount * goodTotal;
    }
    for (const o of goodOutcomes) {
      result[o] -= (result[o] / goodTotal) * shiftAmount * goodTotal;
    }
  }

  // Ensure no negative probabilities
  for (const key of Object.keys(result) as OutcomeType[]) {
    result[key] = Math.max(0.01, result[key]);
  }

  // Renormalize
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(result) as OutcomeType[]) {
    result[key] /= total;
  }

  return result;
}

function weightedRandomSelect(probs: Record<OutcomeType, number>): OutcomeType {
  const rand = Math.random();
  let cumulative = 0;

  for (const [outcome, prob] of Object.entries(probs)) {
    cumulative += prob;
    if (rand < cumulative) {
      return outcome as OutcomeType;
    }
  }

  // Fallback (shouldn't reach here)
  return 'groundOut';
}
```

### Base Running Logic

```typescript
interface BaseState {
  bases: [boolean, boolean, boolean]; // [1st, 2nd, 3rd]
  outs: number;
}

function advanceRunners(
  currentState: BaseState,
  outcome: OutcomeType
): { newBases: [boolean, boolean, boolean]; runsScored: number } {
  let bases = [...currentState.bases] as [boolean, boolean, boolean];
  let runs = 0;

  switch (outcome) {
    case 'homeRun':
      // Everyone scores
      runs = 1 + bases.filter(b => b).length;
      bases = [false, false, false];
      break;

    case 'triple':
      // All runners score, batter to 3rd
      runs = bases.filter(b => b).length;
      bases = [false, false, true];
      break;

    case 'double':
      // Runners advance 2, batter to 2nd
      if (bases[2]) runs++; // 3rd scores
      if (bases[1]) runs++; // 2nd scores
      if (bases[0]) {
        bases[2] = true; // 1st to 3rd
      }
      bases[1] = true; // Batter to 2nd
      bases[0] = false;
      break;

    case 'single':
      // Runners advance 1, batter to 1st
      if (bases[2]) runs++; // 3rd scores
      bases[2] = bases[1]; // 2nd to 3rd
      bases[1] = bases[0]; // 1st to 2nd
      bases[0] = true; // Batter to 1st
      break;

    case 'walk':
      // Forced advances only
      if (bases[0] && bases[1] && bases[2]) {
        runs++; // Bases loaded, run scores
      }
      if (bases[0] && bases[1]) {
        bases[2] = true;
      }
      if (bases[0]) {
        bases[1] = true;
      }
      bases[0] = true;
      break;

    case 'strikeout':
    case 'groundOut':
    case 'flyOut':
      // No advancement (simplified for V2)
      // Future: ground out double plays, sac flies
      break;
  }

  return { newBases: bases, runsScored: runs };
}
```

### Play Description Generator

```typescript
const DESCRIPTIONS: Record<OutcomeType, string[]> = {
  homeRun: [
    "{batter} crushes one! Home run!",
    "{batter} goes yard! It's outta here!",
    "Swing and a drive! {batter} with a homer!",
    "{batter} deposits one in the seats!"
  ],
  triple: [
    "{batter} triples into the gap!",
    "{batter} legs out a triple!",
    "Off the wall! {batter} with a triple!"
  ],
  double: [
    "{batter} doubles down the line!",
    "{batter} rips one for extra bases!",
    "Off the wall! {batter} with a double!"
  ],
  single: [
    "{batter} singles through the infield.",
    "{batter} pokes one into the outfield.",
    "Base hit for {batter}!",
    "{batter} with a seeing-eye single."
  ],
  walk: [
    "{batter} works a walk.",
    "Ball four. {batter} takes first.",
    "{pitcher} can't find the zone. Walk."
  ],
  strikeout: [
    "{batter} goes down swinging!",
    "Struck out looking! {pitcher} gets {batter}.",
    "{pitcher} blows it by {batter}. K!",
    "Swing and a miss! That's strike three!"
  ],
  groundOut: [
    "{batter} grounds out to short.",
    "Easy grounder, and {batter} is out.",
    "{batter} rolls one to the infield. Out."
  ],
  flyOut: [
    "{batter} flies out to center.",
    "Can of corn. {batter} is out.",
    "{batter} skies one to left. Caught."
  ]
};

function generateDescription(
  outcome: OutcomeType,
  batterName: string,
  pitcherName: string,
  runsScored: number
): string {
  const templates = DESCRIPTIONS[outcome];
  const template = templates[Math.floor(Math.random() * templates.length)];

  let desc = template
    .replace(/{batter}/g, batterName)
    .replace(/{pitcher}/g, pitcherName);

  // Add run scored context
  if (runsScored === 1) {
    desc += " Runner scores!";
  } else if (runsScored > 1) {
    desc += ` ${runsScored} runs score!`;
  }

  return desc;
}
```

---

## 3. Real-time Game Server

### Socket.io Configuration

```typescript
// server/socket.ts

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { verifyJWT } from './auth';

export function setupSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 10000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    try {
      const user = await verifyJWT(token);
      socket.data.userId = user.id;
      socket.data.username = user.username;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.username}`);

    const gameId = socket.handshake.query.gameId as string;

    if (gameId) {
      handleGameConnection(io, socket, gameId);
    }

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.username}`);
      handleDisconnect(io, socket);
    });
  });

  return io;
}
```

### Game Room Management

```typescript
// server/game-rooms.ts

interface GameRoom {
  gameId: string;
  homePlayer: { odueId: string; socketId: string; connected: boolean };
  visitorPlayer?: { userId: string; socketId: string; connected: boolean };
  state: GameState;
  disconnectTimers: Map<string, NodeJS.Timeout>;
}

const activeGames = new Map<string, GameRoom>();

async function handleGameConnection(
  io: Server,
  socket: Socket,
  gameId: string
): Promise<void> {
  const userId = socket.data.userId;

  // Load game from database
  const game = await loadGame(gameId);

  if (!game) {
    socket.emit('error', { code: 'game_not_found', message: 'Game not found' });
    return;
  }

  // Verify user is participant
  if (game.home_user_id !== userId && game.visitor_user_id !== userId) {
    socket.emit('error', { code: 'forbidden', message: 'Not a participant' });
    return;
  }

  // Join socket room
  socket.join(gameId);

  // Get or create room state
  let room = activeGames.get(gameId);

  if (!room) {
    room = {
      gameId,
      homePlayer: {
        odueId: game.home_user_id,
        socketId: '',
        connected: false
      },
      visitorPlayer: game.visitor_user_id ? {
        userId: game.visitor_user_id,
        socketId: '',
        connected: false
      } : undefined,
      state: game.game_state,
      disconnectTimers: new Map()
    };
    activeGames.set(gameId, room);
  }

  // Update connection status
  const isHome = game.home_user_id === userId;
  if (isHome) {
    room.homePlayer.socketId = socket.id;
    room.homePlayer.connected = true;
  } else if (room.visitorPlayer) {
    room.visitorPlayer.socketId = socket.id;
    room.visitorPlayer.connected = true;
  }

  // Clear any disconnect timer
  const timer = room.disconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    room.disconnectTimers.delete(userId);
  }

  // Notify opponent of reconnection
  socket.to(gameId).emit('opponent:connected');

  // Send current state
  socket.emit('game:state', buildStateForPlayer(room.state, userId, room));

  // Set up event handlers
  socket.on('game:ready', () => handleReady(io, socket, room!));
  socket.on('game:roll', () => handleRoll(io, socket, room!));
  socket.on('game:forfeit', () => handleForfeit(io, socket, room!));
}

async function handleRoll(
  io: Server,
  socket: Socket,
  room: GameRoom
): Promise<void> {
  const userId = socket.data.userId;

  // Validate it's this player's turn
  if (!isPlayerTurn(room.state, userId, room)) {
    socket.emit('error', { code: 'not_your_turn', message: "It's not your turn" });
    return;
  }

  // Generate dice roll
  const diceRoll: [number, number] = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];

  // Get current matchup
  const { batter, pitcher } = getCurrentMatchup(room.state, room);

  // Calculate outcome
  const outcome = resolveAtBat(batter.stats, pitcher.stats, diceRoll);

  // Update game state
  const { newBases, runsScored } = advanceRunners(
    { bases: room.state.bases, outs: room.state.outs },
    outcome
  );

  const outsRecorded = ['strikeout', 'groundOut', 'flyOut'].includes(outcome) ? 1 : 0;

  // Build result
  const result: PlayResult = {
    diceRolls: diceRoll,
    outcome,
    batter: { mlbId: batter.mlbId, name: batter.name },
    pitcher: { mlbId: pitcher.mlbId, name: pitcher.name },
    description: generateDescription(outcome, batter.name, pitcher.name, runsScored),
    runsScored,
    outsRecorded,
    newBases
  };

  // Apply to state
  applyPlayResult(room.state, result);

  // Check for inning/game end
  handleInningLogic(room.state);

  // Save to database
  await saveGameState(room.gameId, room.state);
  await saveGameMove(room.gameId, userId, 'roll', result);

  // Broadcast result
  io.to(room.gameId).emit('game:roll-result', result);

  // Broadcast updated state
  const homeState = buildStateForPlayer(room.state, room.homePlayer.userId, room);
  const visitorState = room.visitorPlayer
    ? buildStateForPlayer(room.state, room.visitorPlayer.userId, room)
    : null;

  io.to(room.homePlayer.socketId).emit('game:state', homeState);
  if (room.visitorPlayer && visitorState) {
    io.to(room.visitorPlayer.socketId).emit('game:state', visitorState);
  }

  // Check game over
  if (room.state.isGameOver) {
    io.to(room.gameId).emit('game:ended', {
      winner: room.state.winner,
      finalScore: room.state.scores,
      innings: room.state.inning
    });
  }
}
```

### Disconnect Handling

```typescript
async function handleDisconnect(io: Server, socket: Socket): Promise<void> {
  const userId = socket.data.userId;

  // Find games this user is in
  for (const [gameId, room] of activeGames) {
    const isHome = room.homePlayer.userId === userId;
    const isVisitor = room.visitorPlayer?.userId === userId;

    if (!isHome && !isVisitor) continue;

    // Mark as disconnected
    if (isHome) {
      room.homePlayer.connected = false;
    } else if (room.visitorPlayer) {
      room.visitorPlayer.connected = false;
    }

    // Notify opponent
    socket.to(gameId).emit('opponent:disconnected', { timeout: 60 });

    // Start forfeit timer (60 seconds)
    const timer = setTimeout(async () => {
      // Check if still disconnected
      const player = isHome ? room.homePlayer : room.visitorPlayer;
      if (player && !player.connected) {
        // Auto-forfeit
        await handleAutoForfeit(io, room, userId);
      }
    }, 60000);

    room.disconnectTimers.set(userId, timer);
  }
}

async function handleAutoForfeit(
  io: Server,
  room: GameRoom,
  forfeitingUserId: string
): Promise<void> {
  const winnerId = room.homePlayer.userId === forfeitingUserId
    ? room.visitorPlayer?.userId
    : room.homePlayer.userId;

  if (!winnerId) return;

  room.state.isGameOver = true;
  room.state.winner = winnerId;

  await updateGameStatus(room.gameId, 'forfeit', winnerId);

  io.to(room.gameId).emit('game:ended', {
    winner: { userId: winnerId },
    finalScore: room.state.scores,
    reason: 'disconnect'
  });

  // Cleanup
  activeGames.delete(room.gameId);
}
```

---

## 4. Cleanup Jobs

### Abandoned Game Cleanup

```typescript
// jobs/cleanup.ts

// Run every hour
export async function cleanupAbandonedGames(): Promise<void> {
  console.log('[Cleanup] Starting abandoned game cleanup');

  // Games in 'waiting' status older than 24 hours
  const waitingCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: waitingGames, error: waitingError } = await supabase
    .from('game_sessions')
    .update({ status: 'abandoned' })
    .eq('status', 'waiting')
    .lt('created_at', waitingCutoff.toISOString())
    .select('id');

  if (waitingGames) {
    console.log(`[Cleanup] Marked ${waitingGames.length} waiting games as abandoned`);
  }

  // Games in 'active' status with no moves in 4 hours
  const activeCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const { data: staleGames } = await supabase
    .from('game_sessions')
    .select('id, home_user_id, visitor_user_id')
    .eq('status', 'active')
    .lt('updated_at', activeCutoff.toISOString());

  if (staleGames) {
    for (const game of staleGames) {
      // Mark as abandoned (no winner)
      await supabase
        .from('game_sessions')
        .update({ status: 'abandoned' })
        .eq('id', game.id);
    }
    console.log(`[Cleanup] Marked ${staleGames.length} stale games as abandoned`);
  }
}
```

### Old Game Archival

```typescript
// Run weekly
export async function archiveOldGames(): Promise<void> {
  const archiveCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days

  // Archive game moves (delete from main table, could move to archive table)
  const { data: oldMoves } = await supabase
    .from('game_moves')
    .delete()
    .lt('created_at', archiveCutoff.toISOString())
    .select('id');

  if (oldMoves) {
    console.log(`[Archive] Deleted ${oldMoves.length} old game moves`);
  }
}
```

---

## 5. Cron Job Schedule

```typescript
// jobs/scheduler.ts

import cron from 'node-cron';

export function setupCronJobs(): void {
  // MLB Stats Sync: Daily at 5:00 AM UTC
  cron.schedule('0 5 * * *', async () => {
    console.log('[Cron] Starting MLB stats sync');
    try {
      await syncMLBPlayers();
    } catch (err) {
      console.error('[Cron] MLB sync failed:', err);
      // Could add alerting here (email, Slack, etc.)
    }
  });

  // Cleanup: Every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Starting cleanup');
    try {
      await cleanupAbandonedGames();
    } catch (err) {
      console.error('[Cron] Cleanup failed:', err);
    }
  });

  // Archive: Weekly on Sunday at 3:00 AM UTC
  cron.schedule('0 3 * * 0', async () => {
    console.log('[Cron] Starting archive');
    try {
      await archiveOldGames();
    } catch (err) {
      console.error('[Cron] Archive failed:', err);
    }
  });

  console.log('[Cron] All jobs scheduled');
}
```

---

## 6. Environment Configuration

```bash
# .env.example

# Server
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# CORS
CORS_ORIGIN=https://tech.kevinhyde.com

# Redis (optional, for Socket.io scaling)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
```

---

## 7. Health Checks

```typescript
// routes/health.ts

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});

app.get('/health/db', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.get('/health/mlb', async (req, res) => {
  try {
    const response = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1');
    if (!response.ok) throw new Error('MLB API unavailable');
    res.json({ status: 'ok', mlbApi: 'available' });
  } catch (err) {
    res.status(500).json({ status: 'error', mlbApi: 'unavailable' });
  }
});
```
