export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  wins?: number;
  losses?: number;
  createdAt?: string;
}

export interface MLBPlayer {
  mlbId: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryPosition: string;
  jerseyNumber?: string | null;
  currentTeam?: string | null;
  isActive?: boolean;
  photoUrl?: string | null;
  battingStats?: any;
  pitchingStats?: any;
  height?: string | null;
  weight?: number | null;
  batSide?: 'L' | 'R' | 'S' | null;
  throwSide?: 'L' | 'R' | null;
}

export interface Team {
  id: string;
  userId: string;
  name: string;
  abbreviation?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
  };
}

export interface RosterSlot {
  position: string;
  playerId?: number | null;
  battingOrder?: number | null;
  player?: MLBPlayer;
}

export interface GameSession {
  id: string;
  joinCode?: string | null;
  status: 'waiting' | 'active' | 'paused' | 'completed' | 'abandoned';
  homeUserId?: string | null;
  homeTeamId?: string | null;
  homeReady: boolean;
  visitorUserId?: string | null;
  visitorTeamId?: string | null;
  visitorReady: boolean;
  gameState: any;
  winnerId?: string | null;
  finalScoreHome?: number | null;
  finalScoreVisitor?: number | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  lastActivity: string;
  homeUser?: User;
  visitorUser?: User;
  homeTeam?: Team;
  visitorTeam?: Team;
}

export interface GameMove {
  id?: string;
  gameId: string;
  moveNumber: number;
  inning: number;
  isTopOfInning: boolean;
  playerId: string;
  batterMlbId?: number | null;
  pitcherMlbId?: number | null;
  diceRoll?: number[] | null;
  outcome: string;
  description?: string | null;
  stateAfter: any;
  runsScored: number;
  createdAt?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface PlayersQuery {
  q?: string;
  search?: string;
  position?: string;
  team?: string;
  league?: string;
  sort?: 'ops' | 'avg' | 'hr' | 'rbi' | 'era' | 'whip' | 'wins' | 'name';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  page?: number;
  minOps?: number;
  maxOps?: number;
  minEra?: number;
  maxEra?: number;
  minHr?: number;
  maxHr?: number;
  minRbi?: number;
  maxRbi?: number;
}

export interface TeamStats {
  hits: number;
  homeRuns: number;
  strikeouts: number;
  walks: number;
}

export interface GameState {
  inning: number;
  isTopOfInning: boolean;
  outs: number;
  scores: [number, number];
  bases: [boolean, boolean, boolean];
  currentBatterIndex: number;
  isGameOver?: boolean;
  winner?: string;
  inningScores?: Array<[number, number]>;
  teamStats?: [TeamStats, TeamStats];
}

export interface SimulationMetadata {
  mode: 'default' | 'deterministic';
  seed?: string;
  turnIndex: number;
}

export interface RollResultEvent {
  diceRolls: [number, number];
  outcome: 'homeRun' | 'triple' | 'double' | 'single' | 'walk' | 'strikeout' | 'groundOut' | 'flyOut';
  runsScored: number;
  outsRecorded: number;
  description: string;
  playContext: {
    inning: number;
    isTopOfInning: boolean;
  };
  batter: { mlbId: number; name: string };
  batterStats: {
    avg: number;
    ops: number;
  };
  pitcher: { mlbId: number; name: string };
  pitcherStats: {
    era: number;
    whip: number;
    kPer9: number;
  };
  newState: GameState;
  sim?: SimulationMetadata;
}

export interface SocketEventMap {
  'game:join': { gameId: string };
  'game:roll': { gameId: string };
  'game:forfeit': { gameId: string };
  'game:state': { state: GameState; sim?: SimulationMetadata };
  'game:roll-result': RollResultEvent;
  'game:ended': { winnerId: string; loserId: string; reason: string; finalScore?: [number, number] };
  'opponent:connected': { userId: string };
  'opponent:disconnected': { userId: string; timeout: number };
  'error': ApiError;
}
