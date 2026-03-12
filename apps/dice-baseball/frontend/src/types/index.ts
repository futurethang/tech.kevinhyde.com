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
// TIER TYPES
// ============================================

export type GameTier = 'arcade' | 'teamBuilder' | 'manager';

export interface TierProfile {
  tier: GameTier;
  teamSource: 'preset' | 'custom';
  salaryCap: number | null;
  rosterSize: number;
  allowBattingOrderEdit: boolean;
  allowPinchHitters: boolean;
  pinchHitLimit: number | null;
  allowPitchingChanges: boolean;
  allowDefensiveSubstitutions: boolean;
  enablePitcherFatigue: boolean;
  enablePlatoonSplits: boolean;
  enableSituationalModifiers: boolean;
  allowWagers: boolean;
}

export const TIER_PROFILES: Record<GameTier, TierProfile> = {
  arcade: {
    tier: 'arcade',
    teamSource: 'preset',
    salaryCap: null,
    rosterSize: 10,
    allowBattingOrderEdit: false,
    allowPinchHitters: false,
    pinchHitLimit: null,
    allowPitchingChanges: false,
    allowDefensiveSubstitutions: false,
    enablePitcherFatigue: false,
    enablePlatoonSplits: false,
    enableSituationalModifiers: false,
    allowWagers: false,
  },
  teamBuilder: {
    tier: 'teamBuilder',
    teamSource: 'custom',
    salaryCap: 250_000_000,
    rosterSize: 10,
    allowBattingOrderEdit: true,
    allowPinchHitters: true,
    pinchHitLimit: 3,
    allowPitchingChanges: false,
    allowDefensiveSubstitutions: false,
    enablePitcherFatigue: false,
    enablePlatoonSplits: false,
    enableSituationalModifiers: false,
    allowWagers: false,
  },
  manager: {
    tier: 'manager',
    teamSource: 'custom',
    salaryCap: 180_000_000,
    rosterSize: 25,
    allowBattingOrderEdit: true,
    allowPinchHitters: true,
    pinchHitLimit: null,
    allowPitchingChanges: true,
    allowDefensiveSubstitutions: true,
    enablePitcherFatigue: true,
    enablePlatoonSplits: true,
    enableSituationalModifiers: true,
    allowWagers: true,
  },
};

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
  scores: [number, number]; // [visitor, home]
  bases: [boolean, boolean, boolean]; // [1st, 2nd, 3rd]
  currentBatterIndex: number;
  isGameOver?: boolean;
  winner?: string;
  inningScores?: Array<[number, number]>; // per-inning [visitor, home] runs
  teamStats?: [TeamStats, TeamStats]; // [visitor, home]
}

export interface Game {
  id: string;
  joinCode: string;
  tier?: GameTier;
  rules?: TierProfile;
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
  playContext: {
    inning: number;
    isTopOfInning: boolean;
  };
  batter: { mlbId: number; name: string };
  batterStats?: {
    avg: number;
    ops: number;
  };
  pitcher: { mlbId: number; name: string };
  pitcherStats?: {
    era: number;
    whip: number;
    kPer9: number;
  };
  newState: GameState;
  sim?: {
    mode: 'default' | 'deterministic';
    seed?: string;
    turnIndex: number;
  };
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
