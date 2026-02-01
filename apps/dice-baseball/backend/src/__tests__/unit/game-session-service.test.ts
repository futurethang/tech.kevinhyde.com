/**
 * Game Session Service Tests
 * TDD for game creation, joining, and state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GameSessionService,
  GameSessionStore,
  TeamValidator,
} from '../../services/game-session-service';
import type {
  GameSession,
  GameSessionStatus,
  GamePlayer,
  CreateGameRequest,
  JoinGameRequest,
} from '../../types';

// Mock team validator
const mockTeamValidator: TeamValidator = {
  async validateTeamOwnership(userId: string, teamId: string) {
    // Simulate: user owns their team
    if (teamId.startsWith('team-' + userId.slice(0, 4))) {
      return { valid: true };
    }
    return { valid: false, error: 'Team not found or not owned by user' };
  },
  async validateTeamComplete(teamId: string) {
    // Simulate: teams ending with '-incomplete' are not complete
    if (teamId.endsWith('-incomplete')) {
      return { valid: false, error: 'Team roster is incomplete' };
    }
    return { valid: true, teamName: 'Test Team' };
  },
};

// In-memory store for testing
function createMockStore(): GameSessionStore {
  const sessions = new Map<string, GameSession>();
  const codeIndex = new Map<string, string>(); // code -> id

  return {
    async save(session: GameSession) {
      sessions.set(session.id, { ...session });
      codeIndex.set(session.joinCode, session.id);
    },
    async findById(id: string) {
      return sessions.get(id) || null;
    },
    async findByJoinCode(code: string) {
      const id = codeIndex.get(code);
      return id ? sessions.get(id) || null : null;
    },
    async findByUserId(userId: string, options?: { status?: GameSessionStatus[] }) {
      const results: GameSession[] = [];
      for (const session of sessions.values()) {
        const isParticipant =
          session.homePlayer.userId === userId ||
          session.visitorPlayer?.userId === userId;

        if (isParticipant) {
          if (options?.status) {
            if (options.status.includes(session.status)) {
              results.push(session);
            }
          } else {
            results.push(session);
          }
        }
      }
      return results;
    },
    async update(id: string, updates: Partial<GameSession>) {
      const session = sessions.get(id);
      if (!session) return null;
      const updated = { ...session, ...updates, updatedAt: new Date() };
      sessions.set(id, updated);
      return updated;
    },
    async delete(id: string) {
      const session = sessions.get(id);
      if (session) {
        codeIndex.delete(session.joinCode);
        sessions.delete(id);
        return true;
      }
      return false;
    },
  };
}

describe('GameSessionService', () => {
  let service: GameSessionService;
  let store: GameSessionStore;

  beforeEach(() => {
    store = createMockStore();
    service = new GameSessionService(store, mockTeamValidator);
  });

  describe('createGame', () => {
    it('creates a game with the creator as home player', async () => {
      const result = await service.createGame('user-123', { teamId: 'team-user-123' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.homePlayer.userId).toBe('user-123');
      expect(result.data!.homePlayer.teamId).toBe('team-user-123');
    });

    it('generates a unique join code', async () => {
      const result = await service.createGame('user-123', { teamId: 'team-user-123' });

      expect(result.success).toBe(true);
      expect(result.data!.joinCode).toBeDefined();
      expect(result.data!.joinCode.length).toBe(6);
      expect(result.data!.joinCode).toMatch(/^[A-Z0-9]+$/);
    });

    it('initializes game state correctly', async () => {
      const result = await service.createGame('user-123', { teamId: 'team-user-123' });

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('waiting');
      expect(result.data!.gameState.inning).toBe(1);
      expect(result.data!.gameState.isTopOfInning).toBe(true);
      expect(result.data!.gameState.outs).toBe(0);
      expect(result.data!.gameState.scores).toEqual([0, 0]);
      expect(result.data!.gameState.bases).toEqual([false, false, false]);
    });

    it('returns error if user does not own the team', async () => {
      const result = await service.createGame('user-123', { teamId: 'team-other-456' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('forbidden');
    });

    it('returns error if team roster is incomplete', async () => {
      const result = await service.createGame('user-123', { teamId: 'team-user-123-incomplete' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('validation_error');
      expect(result.error?.message).toContain('incomplete');
    });

    it('prevents creating multiple active games', async () => {
      // Create first game
      await service.createGame('user-123', { teamId: 'team-user-123' });

      // Try to create second game
      const result = await service.createGame('user-123', { teamId: 'team-user-123' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('conflict');
      expect(result.error?.message).toContain('already have an active game');
    });
  });

  describe('joinGame', () => {
    let gameId: string;
    let joinCode: string;

    beforeEach(async () => {
      const result = await service.createGame('host-123', { teamId: 'team-host-123' });
      gameId = result.data!.id;
      joinCode = result.data!.joinCode;
    });

    it('joins a waiting game with valid code', async () => {
      const result = await service.joinGame('guest-456', {
        joinCode,
        teamId: 'team-gues-456',
      });

      expect(result.success).toBe(true);
      expect(result.data!.visitorPlayer).toBeDefined();
      expect(result.data!.visitorPlayer!.userId).toBe('guest-456');
      expect(result.data!.status).toBe('active');
    });

    it('returns error for invalid join code', async () => {
      const result = await service.joinGame('guest-456', {
        joinCode: 'XXXXXX',
        teamId: 'team-gues-456',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('not_found');
    });

    it('returns error when joining own game', async () => {
      const result = await service.joinGame('host-123', {
        joinCode,
        teamId: 'team-host-123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('validation_error');
      expect(result.error?.message).toContain('Cannot join your own game');
    });

    it('returns error when joining already-started game', async () => {
      // First join
      await service.joinGame('guest-456', {
        joinCode,
        teamId: 'team-gues-456',
      });

      // Second join attempt
      const result = await service.joinGame('another-789', {
        joinCode,
        teamId: 'team-anot-789',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('conflict');
      expect(result.error?.message).toContain('already started');
    });

    it('returns error if team roster is incomplete', async () => {
      const result = await service.joinGame('guest-456', {
        joinCode,
        teamId: 'team-gues-456-incomplete',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('validation_error');
    });

    it('sets startedAt timestamp when game becomes active', async () => {
      const result = await service.joinGame('guest-456', {
        joinCode,
        teamId: 'team-gues-456',
      });

      expect(result.success).toBe(true);
      expect(result.data!.startedAt).toBeDefined();
    });
  });

  describe('getGame', () => {
    let gameId: string;

    beforeEach(async () => {
      const result = await service.createGame('user-123', { teamId: 'team-user-123' });
      gameId = result.data!.id;
    });

    it('returns game for participant', async () => {
      const result = await service.getGame(gameId, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe(gameId);
    });

    it('returns error for non-participant', async () => {
      const result = await service.getGame(gameId, 'other-user');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('forbidden');
    });

    it('returns error for non-existent game', async () => {
      const result = await service.getGame('non-existent-id', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('not_found');
    });
  });

  describe('cancelGame', () => {
    let gameId: string;

    beforeEach(async () => {
      const result = await service.createGame('user-123', { teamId: 'team-user-123' });
      gameId = result.data!.id;
    });

    it('allows creator to cancel waiting game', async () => {
      const result = await service.cancelGame(gameId, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('abandoned');
    });

    it('prevents canceling active game', async () => {
      // Join to make it active
      const session = await store.findById(gameId);
      await service.joinGame('guest-456', {
        joinCode: session!.joinCode,
        teamId: 'team-gues-456',
      });

      const result = await service.cancelGame(gameId, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('conflict');
    });

    it('prevents non-creator from canceling', async () => {
      const result = await service.cancelGame(gameId, 'other-user');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('forbidden');
    });
  });

  describe('forfeitGame', () => {
    let gameId: string;

    beforeEach(async () => {
      const createResult = await service.createGame('host-123', { teamId: 'team-host-123' });
      gameId = createResult.data!.id;

      await service.joinGame('guest-456', {
        joinCode: createResult.data!.joinCode,
        teamId: 'team-gues-456',
      });
    });

    it('allows player to forfeit active game', async () => {
      const result = await service.forfeitGame(gameId, 'host-123');

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('forfeit');
      expect(result.data!.gameState.winnerId).toBe('guest-456');
    });

    it('sets opposing player as winner', async () => {
      const result = await service.forfeitGame(gameId, 'guest-456');

      expect(result.success).toBe(true);
      expect(result.data!.gameState.winnerId).toBe('host-123');
    });

    it('prevents forfeiting non-active game', async () => {
      // First forfeit
      await service.forfeitGame(gameId, 'host-123');

      // Try to forfeit again
      const result = await service.forfeitGame(gameId, 'guest-456');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('conflict');
    });

    it('prevents non-participant from forfeiting', async () => {
      const result = await service.forfeitGame(gameId, 'random-user');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('forbidden');
    });
  });

  describe('getUserGames', () => {
    beforeEach(async () => {
      // Create multiple games
      await service.createGame('user-123', { teamId: 'team-user-123' });

      const game2 = await service.createGame('other-user', { teamId: 'team-othe-user' });
      await service.joinGame('user-123', {
        joinCode: game2.data!.joinCode,
        teamId: 'team-user-123',
      });
    });

    it('returns all games for user', async () => {
      const result = await service.getUserGames('user-123');

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(2);
    });

    it('filters by status', async () => {
      const result = await service.getUserGames('user-123', { status: ['waiting'] });

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(1);
      expect(result.data![0].status).toBe('waiting');
    });
  });

  describe('updatePlayerConnection', () => {
    let gameId: string;

    beforeEach(async () => {
      const createResult = await service.createGame('host-123', { teamId: 'team-host-123' });
      gameId = createResult.data!.id;

      await service.joinGame('guest-456', {
        joinCode: createResult.data!.joinCode,
        teamId: 'team-gues-456',
      });
    });

    it('updates connection status for home player', async () => {
      const result = await service.updatePlayerConnection(gameId, 'host-123', false);

      expect(result.success).toBe(true);
      expect(result.data!.homePlayer.isConnected).toBe(false);
    });

    it('updates connection status for visitor player', async () => {
      const result = await service.updatePlayerConnection(gameId, 'guest-456', false);

      expect(result.success).toBe(true);
      expect(result.data!.visitorPlayer!.isConnected).toBe(false);
    });

    it('updates lastActiveAt timestamp', async () => {
      const before = new Date();
      const result = await service.updatePlayerConnection(gameId, 'host-123', true);

      expect(result.success).toBe(true);
      expect(result.data!.homePlayer.lastActiveAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
    });
  });

  describe('isPlayerTurn', () => {
    let gameId: string;

    beforeEach(async () => {
      const createResult = await service.createGame('host-123', { teamId: 'team-host-123' });
      gameId = createResult.data!.id;

      await service.joinGame('guest-456', {
        joinCode: createResult.data!.joinCode,
        teamId: 'team-gues-456',
      });
    });

    it('returns true for visitor during top of inning', async () => {
      const session = await store.findById(gameId);
      expect(session!.gameState.isTopOfInning).toBe(true);

      const result = service.isPlayerTurn(session!, 'guest-456');
      expect(result).toBe(true);
    });

    it('returns false for home during top of inning', async () => {
      const session = await store.findById(gameId);

      const result = service.isPlayerTurn(session!, 'host-123');
      expect(result).toBe(false);
    });

    it('returns true for home during bottom of inning', async () => {
      // Simulate bottom of inning
      await store.update(gameId, {
        gameState: {
          inning: 1,
          isTopOfInning: false,
          outs: 0,
          scores: [0, 0] as [number, number],
          bases: [false, false, false] as [boolean, boolean, boolean],
          currentBatterIndex: [0, 0] as [number, number],
          isGameOver: false,
        },
      });

      const session = await store.findById(gameId);
      const result = service.isPlayerTurn(session!, 'host-123');
      expect(result).toBe(true);
    });
  });
});

describe('State Machine Transitions', () => {
  let service: GameSessionService;
  let store: GameSessionStore;

  beforeEach(() => {
    store = createMockStore();
    service = new GameSessionService(store, mockTeamValidator);
  });

  it('waiting → active on join', async () => {
    const createResult = await service.createGame('host', { teamId: 'team-host' });
    expect(createResult.data!.status).toBe('waiting');

    const joinResult = await service.joinGame('guest', {
      joinCode: createResult.data!.joinCode,
      teamId: 'team-gues',
    });
    expect(joinResult.data!.status).toBe('active');
  });

  it('waiting → abandoned on cancel', async () => {
    const createResult = await service.createGame('host', { teamId: 'team-host' });

    const cancelResult = await service.cancelGame(createResult.data!.id, 'host');
    expect(cancelResult.data!.status).toBe('abandoned');
  });

  it('active → forfeit on forfeit', async () => {
    const createResult = await service.createGame('host', { teamId: 'team-host' });
    await service.joinGame('guest', {
      joinCode: createResult.data!.joinCode,
      teamId: 'team-gues',
    });

    const forfeitResult = await service.forfeitGame(createResult.data!.id, 'host');
    expect(forfeitResult.data!.status).toBe('forfeit');
  });

  it('active → completed on game end', async () => {
    const createResult = await service.createGame('host', { teamId: 'team-host' });
    await service.joinGame('guest', {
      joinCode: createResult.data!.joinCode,
      teamId: 'team-gues',
    });

    const completeResult = await service.completeGame(createResult.data!.id, 'host');
    expect(completeResult.data!.status).toBe('completed');
  });
});
