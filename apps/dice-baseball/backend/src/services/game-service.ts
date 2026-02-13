/**
 * Game Service - Dice Baseball V2
 * Handles game session management: creation, joining, state persistence
 *
 * Phase 5: Game Session Management
 */

import { resolveAtBat, advanceRunners, handleInningLogic, generateDescription } from './game-engine.js';
import type { GameState, BatterStats, PitcherStats, OutcomeType } from './game-engine.js';
import * as teamService from './team-service.js';
import { getPlayerById } from './mlb-sync.js';
import { gameRepository } from '../repositories/game-repository.js';
import { createSeededRng, normalizeSeed } from './simulation-rng.js';

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
  simulation?: GameSimulation;
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

export interface SimulationConfigInput {
  mode?: 'default' | 'deterministic';
  seed?: string;
}

export interface SimulationSnapshot {
  mode: 'default' | 'deterministic';
  seed?: string;
  turnIndex: number;
}

export interface GameSimulation extends SimulationSnapshot {
  rngState?: number;
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
  sim: SimulationSnapshot;
}

export interface GameEndResult {
  winnerId: string;
  loserId: string;
  finalScore?: [number, number];
  reason?: string;
}

async function hydrateTeamForGame(teamId: string): Promise<TeamWithRoster> {
  const team = await teamService.getTeamById(teamId);
  if (!team) {
    throw new Error('Team not found');
  }

  const roster = await Promise.all(
    (team.roster || []).map(async (slot) => {
      const player = await getPlayerById(slot.mlbPlayerId);
      return {
        ...slot,
        playerData: player
          ? {
              name: player.fullName,
              battingStats: player.battingStats
                ? {
                    avg: player.battingStats.avg,
                    obp: player.battingStats.obp,
                    slg: player.battingStats.slg,
                    ops: player.battingStats.ops,
                    bb: player.battingStats.walks,
                    so: player.battingStats.strikeouts,
                    ab: player.battingStats.atBats,
                  }
                : undefined,
              pitchingStats: player.pitchingStats
                ? {
                    era: player.pitchingStats.era,
                    whip: player.pitchingStats.whip,
                    kPer9: player.pitchingStats.kPer9,
                    bbPer9: player.pitchingStats.bbPer9,
                    hrPer9: player.pitchingStats.hrPer9,
                  }
                : undefined,
            }
          : undefined,
      };
    })
  );

  return {
    id: team.id,
    name: team.name,
    userId: team.userId,
    roster,
    battingOrder: roster
      .filter((slot) => slot.position !== 'SP' && slot.battingOrder != null)
      .sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0))
      .map((slot) => slot.mlbPlayerId),
  };
}

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

function createSimulationConfig(input?: SimulationConfigInput): GameSimulation {
  const requestedMode = input?.mode || process.env.GAME_SIM_MODE || 'default';
  const mode: 'default' | 'deterministic' =
    requestedMode === 'deterministic' ? 'deterministic' : 'default';

  if (mode !== 'deterministic') {
    return { mode: 'default', turnIndex: 0 };
  }

  const seed = input?.seed || process.env.GAME_SIM_SEED || `seed-${Date.now()}`;
  const rngState = normalizeSeed(seed);
  return { mode: 'deterministic', seed, rngState, turnIndex: 0 };
}

function nextRandom(game: Game): number {
  if (game.simulation?.mode !== 'deterministic' || !game.simulation.rngState) {
    return Math.random();
  }

  const rng = createSeededRng(game.simulation.rngState);
  const value = rng.next();
  game.simulation.rngState = rng.currentState();
  return value;
}

function simulationSnapshot(game: Game): SimulationSnapshot {
  const simulation = game.simulation;
  if (!simulation) {
    return { mode: 'default', turnIndex: 0 };
  }

  return {
    mode: simulation.mode,
    seed: simulation.seed,
    turnIndex: simulation.turnIndex,
  };
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Create a new game session
 */
export async function createGame(
  userId: string,
  teamId: string,
  simInput?: SimulationConfigInput
): Promise<Game> {
  const gameId = generateGameId();
  let joinCode = generateJoinCode();

  // Ensure unique join code
  while (await gameRepository.hasJoinCode(joinCode)) {
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
    homeTeam: await hydrateTeamForGame(teamId),
    createdAt: new Date().toISOString(),
    simulation: createSimulationConfig(simInput),
  };

  await gameRepository.save(game);

  return game;
}

/**
 * Join an existing game
 */
export async function joinGame(gameId: string, userId: string, teamId: string): Promise<Game> {
  const game = await gameRepository.getById(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Update game with visitor info
  game.visitorTeamId = teamId;
  game.visitorUserId = userId;
  game.status = 'active';
  game.visitorTeam = await hydrateTeamForGame(teamId);
  if (!game.homeTeam) {
    game.homeTeam = await hydrateTeamForGame(game.homeTeamId);
  }

  await gameRepository.save(game);

  console.log(`🎮 Game ${gameId} activated: ${game.homeUserId} vs ${game.visitorUserId}`);
  return game;
}

/**
 * Get game by ID
 */
export async function getGameById(gameId: string): Promise<Game | null> {
  return gameRepository.getById(gameId);
}

/**
 * Get game by join code
 */
export async function getGameByJoinCode(joinCode: string): Promise<Game | null> {
  return gameRepository.getByJoinCode(joinCode);
}

/**
 * Get all active/waiting games for a user
 */
export async function getUserActiveGames(userId: string): Promise<Game[]> {
  return gameRepository.listActiveByUser(userId);
}

/**
 * Save game state
 */
export async function saveGameState(gameId: string, state: GameState): Promise<void> {
  const game = await gameRepository.getById(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  game.state = state;
  await gameRepository.save(game);
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
  const game = await gameRepository.getById(gameId);
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
  const outcome = resolveAtBat(batterStats, pitcherStats, input.diceRolls, nextRandom(game));

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
  const description = generateDescription(outcome, batterName, pitcherName, runsScored, nextRandom(game));

  // Save the move
  const currentMoves = await gameRepository.getMoveCount(gameId);
  await gameRepository.appendMove(gameId, {
    moveNumber: currentMoves + 1,
    userId,
    data: {
      diceRolls: input.diceRolls,
      outcome,
      runsScored,
      outsRecorded,
      batterIndex,
    },
  });

  if (!game.simulation) {
    game.simulation = createSimulationConfig();
  }
  game.simulation.turnIndex = currentMoves + 1;

  // Save game state + simulation metadata together
  game.state = newState;
  await gameRepository.save(game);

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
    sim: simulationSnapshot(game),
  };
}

export async function generateDiceRoll(gameId: string): Promise<[number, number]> {
  const game = await gameRepository.getById(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  const d1 = Math.floor(nextRandom(game) * 6) + 1;
  const d2 = Math.floor(nextRandom(game) * 6) + 1;
  await gameRepository.save(game);
  return [d1, d2];
}

/**
 * End a game (either by completion or forfeit)
 */
export async function endGame(gameId: string, winnerId: string): Promise<GameEndResult> {
  const game = await gameRepository.getById(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  const loserId = game.homeUserId === winnerId ? game.visitorUserId! : game.homeUserId;

  game.status = 'completed';
  game.winnerId = winnerId;
  game.loserId = loserId;
  game.completedAt = new Date().toISOString();

  await gameRepository.save(game);
  await gameRepository.removeJoinCode(game.joinCode);

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
export async function clearAllGames(): Promise<void> {
  await gameRepository.clear();
}
