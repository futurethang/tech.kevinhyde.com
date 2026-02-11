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
  gamesPlayed: number;
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PitchingStats {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  era: number;
  inningsPitched: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  homeRuns: number;
  walks: number;
  strikeouts: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
}

export interface MLBPlayer {
  mlbId: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryPosition: string;
  currentTeam: string | null;
  currentTeamId: number | null;
  photoUrl?: string;
  battingStats?: BattingStats | null;
  pitchingStats?: PitchingStats | null;
  seasonYear?: number;
  isActive: boolean;
  lastUpdated: string;
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
