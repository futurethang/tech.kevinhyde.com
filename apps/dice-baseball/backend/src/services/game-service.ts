/**
 * Game Service - Dice Baseball V2
 * Handles game session management: creation, joining, state persistence
 *
 * Phase 5: Game Session Management
 */

import { resolveAtBat, advanceRunners, handleInningLogic, generateDescription } from './game-engine.js';
import type { GameState, BatterStats, PitcherStats, OutcomeType, PlayResult } from './game-engine.js';

// ============================================
// TYPES
// ============================================

export interface Game {
  id: string;
  joinCode: string;
  homeTeamId: string;
  homeUserId: string;
  visitorTeamId: string | null;
  visitorUserId: string | null;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  state?: GameState;
  homeTeam?: TeamWithRoster;
  visitorTeam?: TeamWithRoster;
  createdAt: string;
  completedAt?: string;
  winnerId?: string;
  loserId?: string;
}

export interface TeamWithRoster {
  id: string;
  name: string;
  userId: string;
  roster: RosterSlot[];
  battingOrder: number[];
}

export interface RosterSlot {
  position: string;
  mlbPlayerId: number;
  battingOrder: number | null;
  playerData?: {
    name: string;
    battingStats?: BatterStats;
    pitchingStats?: PitcherStats;
  };
}

export interface MoveInput {
  diceRolls: [number, number];
}

export interface MoveResult {
  diceRolls: [number, number];
  outcome: OutcomeType;
  runsScored: number;
  outsRecorded: number;
  description: string;
  batter: { mlbId: number; name: string };
  pitcher: { mlbId: number; name: string };
  newState: GameState;
}

export interface GameEndResult {
  winnerId: string;
  loserId: string;
  finalScore?: [number, number];
  reason?: string;
}

// ============================================
// IN-MEMORY STORAGE (for testing/MVP)
// In production, replace with Supabase/PostgreSQL
// ============================================

const games: Map<string, Game> = new Map();
const gamesByJoinCode: Map<string, string> = new Map(); // joinCode -> gameId
const gameMoves: Map<string, Array<{ moveNumber: number; userId: string; data: unknown }>> = new Map();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique join code (6 characters, alphanumeric)
 */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, I, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a unique game ID
 */
function generateGameId(): string {
  return `game-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create initial game state
 */
function createInitialState(): GameState {
  return {
    inning: 1,
    isTopOfInning: true,
    outs: 0,
    scores: [0, 0],
    bases: [false, false, false],
    currentBatterIndex: 0,
  };
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Create a new game session
 */
export async function createGame(userId: string, teamId: string): Promise<Game> {
  const gameId = generateGameId();
  let joinCode = generateJoinCode();

  // Ensure unique join code
  while (gamesByJoinCode.has(joinCode)) {
    joinCode = generateJoinCode();
  }

  const game: Game = {
    id: gameId,
    joinCode,
    homeTeamId: teamId,
    homeUserId: userId,
    visitorTeamId: null,
    visitorUserId: null,
    status: 'waiting',
    state: createInitialState(),
    createdAt: new Date().toISOString(),
  };

  games.set(gameId, game);
  gamesByJoinCode.set(joinCode, gameId);
  gameMoves.set(gameId, []);

  return game;
}

/**
 * Join an existing game
 */
export async function joinGame(gameId: string, userId: string, teamId: string): Promise<Game> {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  game.visitorTeamId = teamId;
  game.visitorUserId = userId;
  game.status = 'active';

  games.set(gameId, game);

  return game;
}

/**
 * Get game by ID
 */
export async function getGameById(gameId: string): Promise<Game | null> {
  return games.get(gameId) || null;
}

/**
 * Get game by join code
 */
export async function getGameByJoinCode(joinCode: string): Promise<Game | null> {
  const gameId = gamesByJoinCode.get(joinCode.toUpperCase());
  if (!gameId) return null;
  return games.get(gameId) || null;
}

/**
 * Get all active/waiting games for a user
 */
export async function getUserActiveGames(userId: string): Promise<Game[]> {
  const userGames: Game[] = [];

  games.forEach((game) => {
    if (
      (game.homeUserId === userId || game.visitorUserId === userId) &&
      (game.status === 'active' || game.status === 'waiting')
    ) {
      userGames.push(game);
    }
  });

  return userGames;
}

/**
 * Save game state
 */
export async function saveGameState(gameId: string, state: GameState): Promise<void> {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  game.state = state;
  games.set(gameId, game);
}

/**
 * Record a move in the game
 * This is the core game logic integration point
 */
export async function recordMove(
  gameId: string,
  userId: string,
  input: MoveInput
): Promise<MoveResult> {
  const game = games.get(gameId);
  if (!game || !game.state) {
    throw new Error('Game not found');
  }

  const state = game.state;

  // Determine current batter and pitcher based on inning half
  // Top of inning: visitor batting, home pitching
  // Bottom of inning: home batting, visitor pitching
  const battingTeam = state.isTopOfInning ? game.visitorTeam : game.homeTeam;
  const pitchingTeam = state.isTopOfInning ? game.homeTeam : game.visitorTeam;

  // Get current batter from batting order
  const batterIndex = state.currentBatterIndex % 9;
  const batter = battingTeam?.roster.find((r) => r.battingOrder === batterIndex + 1);
  const pitcher = pitchingTeam?.roster.find((r) => r.position === 'SP');

  // Default stats if player data not loaded
  const batterStats: BatterStats = batter?.playerData?.battingStats || {
    avg: 0.250,
    obp: 0.320,
    slg: 0.400,
    ops: 0.720,
    bb: 50,
    so: 100,
    ab: 500,
  };

  const pitcherStats: PitcherStats = pitcher?.playerData?.pitchingStats || {
    era: 4.0,
    whip: 1.3,
    kPer9: 8.5,
    bbPer9: 3.0,
    hrPer9: 1.2,
  };

  // Resolve the at-bat
  const outcome = resolveAtBat(batterStats, pitcherStats, input.diceRolls);

  // Advance runners
  const baseState = { bases: state.bases, outs: state.outs };
  const { newBases, runsScored } = advanceRunners(baseState, outcome);

  // Calculate outs recorded
  const outsRecorded = ['strikeout', 'groundOut', 'flyOut'].includes(outcome) ? 1 : 0;

  // Update state
  const newState: GameState = {
    ...state,
    bases: newBases,
    outs: state.outs + outsRecorded,
    currentBatterIndex: state.currentBatterIndex + 1,
  };

  // Update score
  if (runsScored > 0) {
    if (state.isTopOfInning) {
      newState.scores = [state.scores[0] + runsScored, state.scores[1]];
    } else {
      newState.scores = [state.scores[0], state.scores[1] + runsScored];
    }
  }

  // Handle inning transitions
  handleInningLogic(newState);

  // Generate description
  const batterName = batter?.playerData?.name || 'Batter';
  const pitcherName = pitcher?.playerData?.name || 'Pitcher';
  const description = generateDescription(outcome, batterName, pitcherName, runsScored);

  // Save the move
  const moves = gameMoves.get(gameId) || [];
  moves.push({
    moveNumber: moves.length + 1,
    userId,
    data: {
      diceRolls: input.diceRolls,
      outcome,
      runsScored,
      outsRecorded,
      batterIndex,
    },
  });
  gameMoves.set(gameId, moves);

  // Save game state
  game.state = newState;
  games.set(gameId, game);

  return {
    diceRolls: input.diceRolls,
    outcome,
    runsScored,
    outsRecorded,
    description,
    batter: {
      mlbId: batter?.mlbPlayerId || 0,
      name: batterName,
    },
    pitcher: {
      mlbId: pitcher?.mlbPlayerId || 0,
      name: pitcherName,
    },
    newState,
  };
}

/**
 * End a game (either by completion or forfeit)
 */
export async function endGame(gameId: string, winnerId: string): Promise<GameEndResult> {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  const loserId = game.homeUserId === winnerId ? game.visitorUserId! : game.homeUserId;

  game.status = 'completed';
  game.winnerId = winnerId;
  game.loserId = loserId;
  game.completedAt = new Date().toISOString();

  games.set(gameId, game);

  // Remove from join code map
  gamesByJoinCode.delete(game.joinCode);

  return {
    winnerId,
    loserId,
    finalScore: game.state?.scores,
    reason: game.state?.isGameOver ? 'completed' : 'forfeit',
  };
}

/**
 * Clear all games (for testing)
 */
export function clearAllGames(): void {
  games.clear();
  gamesByJoinCode.clear();
  gameMoves.clear();
}
