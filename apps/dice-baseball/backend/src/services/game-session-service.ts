/**
 * Game Session Service - Dice Baseball V2
 * Manages game creation, joining, and state transitions
 *
 * Phase 5: Game Session Management
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  GameSession,
  GameSessionStatus,
  GameSessionState,
  GamePlayer,
  GameMove,
} from '../types';
import {
  generateJoinCode,
  createInitialGameState,
  isValidStatusTransition,
} from '../types';
import { OperationError, Errors } from '../utils/async-utils';

// ============================================
// INTERFACES
// ============================================

/**
 * Operation result type for service methods
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Store interface for game sessions (dependency injection)
 */
export interface GameSessionStore {
  save(session: GameSession): Promise<void>;
  findById(id: string): Promise<GameSession | null>;
  findByJoinCode(code: string): Promise<GameSession | null>;
  findByUserId(
    userId: string,
    options?: { status?: GameSessionStatus[] }
  ): Promise<GameSession[]>;
  update(id: string, updates: Partial<GameSession>): Promise<GameSession | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * Team validator interface (dependency injection)
 */
export interface TeamValidator {
  validateTeamOwnership(
    userId: string,
    teamId: string
  ): Promise<{ valid: boolean; error?: string }>;
  validateTeamComplete(
    teamId: string
  ): Promise<{ valid: boolean; error?: string; teamName?: string }>;
}

// ============================================
// SERVICE CLASS
// ============================================

export class GameSessionService {
  constructor(
    private store: GameSessionStore,
    private teamValidator: TeamValidator
  ) {}

  /**
   * Create a new game session
   */
  async createGame(
    userId: string,
    request: { teamId: string }
  ): Promise<ServiceResult<GameSession>> {
    // Check for existing active games
    const existingGames = await this.store.findByUserId(userId, {
      status: ['waiting', 'active'],
    });

    if (existingGames.length > 0) {
      return {
        success: false,
        error: {
          code: 'conflict',
          message: 'You already have an active game',
        },
      };
    }

    // Validate team ownership
    const ownershipResult = await this.teamValidator.validateTeamOwnership(
      userId,
      request.teamId
    );
    if (!ownershipResult.valid) {
      return {
        success: false,
        error: {
          code: 'forbidden',
          message: ownershipResult.error || 'Team not found or not owned by user',
        },
      };
    }

    // Validate team is complete
    const teamResult = await this.teamValidator.validateTeamComplete(request.teamId);
    if (!teamResult.valid) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: teamResult.error || 'Team roster is incomplete',
        },
      };
    }

    // Create the game session
    const now = new Date();
    const session: GameSession = {
      id: uuidv4(),
      joinCode: generateJoinCode(),
      status: 'waiting',
      homePlayer: {
        userId,
        teamId: request.teamId,
        teamName: teamResult.teamName || 'Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: now,
      },
      visitorPlayer: undefined,
      gameState: createInitialGameState(),
      moves: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.store.save(session);

    return {
      success: true,
      data: session,
    };
  }

  /**
   * Join an existing game with a join code
   */
  async joinGame(
    userId: string,
    request: { joinCode: string; teamId: string }
  ): Promise<ServiceResult<GameSession>> {
    // Find the game
    const session = await this.store.findByJoinCode(request.joinCode.toUpperCase());

    if (!session) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found with that join code',
        },
      };
    }

    // Check if user is the creator
    if (session.homePlayer.userId === userId) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Cannot join your own game',
        },
      };
    }

    // Check if game is still waiting
    if (session.status !== 'waiting') {
      return {
        success: false,
        error: {
          code: 'conflict',
          message: 'Game has already started',
        },
      };
    }

    // Validate team ownership
    const ownershipResult = await this.teamValidator.validateTeamOwnership(
      userId,
      request.teamId
    );
    if (!ownershipResult.valid) {
      return {
        success: false,
        error: {
          code: 'forbidden',
          message: ownershipResult.error || 'Team not found or not owned by user',
        },
      };
    }

    // Validate team is complete
    const teamResult = await this.teamValidator.validateTeamComplete(request.teamId);
    if (!teamResult.valid) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: teamResult.error || 'Team roster is incomplete',
        },
      };
    }

    // Join the game
    const now = new Date();
    const visitorPlayer: GamePlayer = {
      userId,
      teamId: request.teamId,
      teamName: teamResult.teamName || 'Team',
      isReady: true,
      isConnected: true,
      lastActiveAt: now,
    };

    const updated = await this.store.update(session.id, {
      visitorPlayer,
      status: 'active',
      startedAt: now,
    });

    if (!updated) {
      return {
        success: false,
        error: {
          code: 'server_error',
          message: 'Failed to join game',
        },
      };
    }

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Get a game by ID (with access check)
   */
  async getGame(gameId: string, userId: string): Promise<ServiceResult<GameSession>> {
    const session = await this.store.findById(gameId);

    if (!session) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found',
        },
      };
    }

    // Check if user is a participant
    const isParticipant =
      session.homePlayer.userId === userId ||
      session.visitorPlayer?.userId === userId;

    if (!isParticipant) {
      return {
        success: false,
        error: {
          code: 'forbidden',
          message: 'You are not a participant in this game',
        },
      };
    }

    return {
      success: true,
      data: session,
    };
  }

  /**
   * Cancel a waiting game (creator only)
   */
  async cancelGame(gameId: string, userId: string): Promise<ServiceResult<GameSession>> {
    const session = await this.store.findById(gameId);

    if (!session) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found',
        },
      };
    }

    // Only creator can cancel
    if (session.homePlayer.userId !== userId) {
      return {
        success: false,
        error: {
          code: 'forbidden',
          message: 'Only the game creator can cancel',
        },
      };
    }

    // Can only cancel waiting games
    if (session.status !== 'waiting') {
      return {
        success: false,
        error: {
          code: 'conflict',
          message: 'Cannot cancel a game that has already started',
        },
      };
    }

    const updated = await this.store.update(gameId, {
      status: 'abandoned',
      completedAt: new Date(),
    });

    return {
      success: true,
      data: updated!,
    };
  }

  /**
   * Forfeit an active game
   */
  async forfeitGame(gameId: string, userId: string): Promise<ServiceResult<GameSession>> {
    const session = await this.store.findById(gameId);

    if (!session) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found',
        },
      };
    }

    // Check if user is a participant
    const isHome = session.homePlayer.userId === userId;
    const isVisitor = session.visitorPlayer?.userId === userId;

    if (!isHome && !isVisitor) {
      return {
        success: false,
        error: {
          code: 'forbidden',
          message: 'You are not a participant in this game',
        },
      };
    }

    // Can only forfeit active games
    if (session.status !== 'active') {
      return {
        success: false,
        error: {
          code: 'conflict',
          message: 'Cannot forfeit a game that is not active',
        },
      };
    }

    // Determine winner (opponent of forfeiter)
    const winnerId = isHome
      ? session.visitorPlayer!.userId
      : session.homePlayer.userId;

    const now = new Date();
    const updated = await this.store.update(gameId, {
      status: 'forfeit',
      completedAt: now,
      gameState: {
        ...session.gameState,
        isGameOver: true,
        winnerId,
        endReason: 'forfeit',
      },
    });

    return {
      success: true,
      data: updated!,
    };
  }

  /**
   * Complete a game (normal end)
   */
  async completeGame(
    gameId: string,
    winnerId: string
  ): Promise<ServiceResult<GameSession>> {
    const session = await this.store.findById(gameId);

    if (!session) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found',
        },
      };
    }

    if (session.status !== 'active') {
      return {
        success: false,
        error: {
          code: 'conflict',
          message: 'Game is not active',
        },
      };
    }

    const now = new Date();
    const updated = await this.store.update(gameId, {
      status: 'completed',
      completedAt: now,
      gameState: {
        ...session.gameState,
        isGameOver: true,
        winnerId,
        endReason: 'completed',
      },
    });

    return {
      success: true,
      data: updated!,
    };
  }

  /**
   * Get all games for a user
   */
  async getUserGames(
    userId: string,
    options?: { status?: GameSessionStatus[] }
  ): Promise<ServiceResult<GameSession[]>> {
    const sessions = await this.store.findByUserId(userId, options);

    return {
      success: true,
      data: sessions,
    };
  }

  /**
   * Update player connection status
   */
  async updatePlayerConnection(
    gameId: string,
    userId: string,
    isConnected: boolean
  ): Promise<ServiceResult<GameSession>> {
    const session = await this.store.findById(gameId);

    if (!session) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found',
        },
      };
    }

    const now = new Date();
    const isHome = session.homePlayer.userId === userId;

    let updates: Partial<GameSession>;

    if (isHome) {
      updates = {
        homePlayer: {
          ...session.homePlayer,
          isConnected,
          lastActiveAt: now,
        },
      };
    } else if (session.visitorPlayer?.userId === userId) {
      updates = {
        visitorPlayer: {
          ...session.visitorPlayer,
          isConnected,
          lastActiveAt: now,
        },
      };
    } else {
      return {
        success: false,
        error: {
          code: 'forbidden',
          message: 'Not a participant',
        },
      };
    }

    const updated = await this.store.update(gameId, updates);

    return {
      success: true,
      data: updated!,
    };
  }

  /**
   * Check if it's a player's turn
   */
  isPlayerTurn(session: GameSession, userId: string): boolean {
    if (session.status !== 'active') return false;
    if (session.gameState.isGameOver) return false;

    // Top of inning = visitor batting (their turn)
    // Bottom of inning = home batting (their turn)
    if (session.gameState.isTopOfInning) {
      return session.visitorPlayer?.userId === userId;
    } else {
      return session.homePlayer.userId === userId;
    }
  }

  /**
   * Add a move to the game
   */
  async addMove(
    gameId: string,
    move: Omit<GameMove, 'id' | 'gameId' | 'createdAt'>
  ): Promise<ServiceResult<GameSession>> {
    const session = await this.store.findById(gameId);

    if (!session) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found',
        },
      };
    }

    const newMove: GameMove = {
      id: uuidv4(),
      gameId,
      ...move,
      createdAt: new Date(),
    };

    const updated = await this.store.update(gameId, {
      moves: [...session.moves, newMove],
    });

    return {
      success: true,
      data: updated!,
    };
  }
}

// ============================================
// IN-MEMORY STORE (for development/testing)
// ============================================

export class InMemoryGameSessionStore implements GameSessionStore {
  private sessions = new Map<string, GameSession>();
  private codeIndex = new Map<string, string>();

  async save(session: GameSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
    this.codeIndex.set(session.joinCode, session.id);
  }

  async findById(id: string): Promise<GameSession | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  async findByJoinCode(code: string): Promise<GameSession | null> {
    const id = this.codeIndex.get(code);
    if (!id) return null;
    return this.findById(id);
  }

  async findByUserId(
    userId: string,
    options?: { status?: GameSessionStatus[] }
  ): Promise<GameSession[]> {
    const results: GameSession[] = [];

    for (const session of this.sessions.values()) {
      const isParticipant =
        session.homePlayer.userId === userId ||
        session.visitorPlayer?.userId === userId;

      if (!isParticipant) continue;

      if (options?.status) {
        if (options.status.includes(session.status)) {
          results.push({ ...session });
        }
      } else {
        results.push({ ...session });
      }
    }

    return results;
  }

  async update(
    id: string,
    updates: Partial<GameSession>
  ): Promise<GameSession | null> {
    const session = this.sessions.get(id);
    if (!session) return null;

    const updated: GameSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    this.sessions.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.codeIndex.delete(session.joinCode);
    this.sessions.delete(id);
    return true;
  }

  // For testing - clear all data
  clear(): void {
    this.sessions.clear();
    this.codeIndex.clear();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let gameServiceInstance: GameSessionService | null = null;

/**
 * Default team validator for production
 * TODO: Replace with actual Supabase implementation
 */
const defaultTeamValidator: TeamValidator = {
  async validateTeamOwnership(userId: string, teamId: string) {
    // Placeholder - always valid for now
    // TODO: Implement actual validation against team service
    return { valid: true };
  },
  async validateTeamComplete(teamId: string) {
    // Placeholder - always complete for now
    // TODO: Implement actual validation against team service
    return { valid: true, teamName: 'Team' };
  },
};

/**
 * Get or create the game service singleton
 */
export function getGameService(): GameSessionService {
  if (!gameServiceInstance) {
    const store = new InMemoryGameSessionStore();
    gameServiceInstance = new GameSessionService(store, defaultTeamValidator);
  }
  return gameServiceInstance;
}

/**
 * Reset the game service (for testing)
 */
export function resetGameService(): void {
  gameServiceInstance = null;
}

/**
 * Set a custom game service (for testing with mocks)
 */
export function setGameService(service: GameSessionService): void {
  gameServiceInstance = service;
}
