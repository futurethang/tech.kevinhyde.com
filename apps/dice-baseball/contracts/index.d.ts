export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  wins?: number;
  losses?: number;
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

export interface GameState {
  inning: number;
  isTopOfInning: boolean;
  outs: number;
  scores: [number, number];
  bases: [boolean, boolean, boolean];
  currentBatterIndex: number;
  isGameOver?: boolean;
  winner?: string;
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
