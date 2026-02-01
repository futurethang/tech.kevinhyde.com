/**
 * Shared Types - Dice Baseball V2 Frontend
 */

// ============================================
// AUTH TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  displayName: string;
  wins: number;
  losses: number;
  createdAt: string;
}

// ============================================
// MLB PLAYER TYPES
// ============================================

export interface BattingStats {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  ab: number;
  hits: number;
  games: number;
  sb?: number;
}

export interface PitchingStats {
  era: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
  wins: number;
  losses: number;
  strikeouts: number;
  inningsPitched: number;
  games: number;
  gamesStarted: number;
}

export interface MLBPlayer {
  mlbId: number;
  name: string;
  team: string;
  position: string;
  imageUrl?: string;
  battingStats?: BattingStats;
  pitchingStats?: PitchingStats;
  salary?: number;
}

// ============================================
// TEAM TYPES
// ============================================

export type Position = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH' | 'SP';

export interface RosterSlot {
  position: Position;
  mlbPlayerId: number;
  battingOrder: number | null;
  player?: MLBPlayer;
}

export interface Team {
  id: string;
  name: string;
  userId: string;
  isActive: boolean;
  rosterComplete: boolean;
  roster: RosterSlot[];
  createdAt: string;
}

// ============================================
// GAME TYPES
// ============================================

export type GameStatus = 'waiting' | 'active' | 'completed' | 'abandoned';

export type OutcomeType =
  | 'homeRun'
  | 'triple'
  | 'double'
  | 'single'
  | 'walk'
  | 'strikeout'
  | 'groundOut'
  | 'flyOut';

export interface GameState {
  inning: number;
  isTopOfInning: boolean;
  outs: number;
  scores: [number, number]; // [visitor, home]
  bases: [boolean, boolean, boolean]; // [1st, 2nd, 3rd]
  currentBatterIndex: number;
  isGameOver?: boolean;
  winner?: string;
}

export interface Game {
  id: string;
  joinCode: string;
  homeTeamId: string;
  homeUserId: string;
  visitorTeamId: string | null;
  visitorUserId: string | null;
  status: GameStatus;
  state?: GameState;
  homeTeam?: Team;
  visitorTeam?: Team;
  createdAt: string;
  completedAt?: string;
}

export interface PlayResult {
  diceRolls: [number, number];
  outcome: OutcomeType;
  runsScored: number;
  outsRecorded: number;
  description: string;
  batter: { mlbId: number; name: string };
  pitcher: { mlbId: number; name: string };
  newState: GameState;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiError {
  error: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
