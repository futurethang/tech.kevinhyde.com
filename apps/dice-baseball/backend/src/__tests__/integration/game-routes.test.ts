/**
 * Game Routes Integration Tests
 * TDD for game creation, joining, and state retrieval endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server.js';
import { createTestToken, authHeader } from '../helpers/auth.js';
import * as gameSessionService from '../../services/game-session-service.js';
import type { GameSession } from '../../types/index.js';

// Mock the game session service
vi.mock('../../services/game-session-service.js', () => {
  return {
    GameSessionService: vi.fn().mockImplementation(() => ({
      createGame: vi.fn(),
      joinGame: vi.fn(),
      getGame: vi.fn(),
      cancelGame: vi.fn(),
      forfeitGame: vi.fn(),
      getUserGames: vi.fn(),
      updatePlayerConnection: vi.fn(),
      isPlayerTurn: vi.fn(),
    })),
    InMemoryGameSessionStore: vi.fn(),
    getGameService: vi.fn(),
  };
});

// Helper to create mock game session
function createMockGameSession(overrides: Partial<GameSession> = {}): GameSession {
  const now = new Date();
  return {
    id: 'game-123',
    joinCode: 'ABC123',
    status: 'waiting',
    homePlayer: {
      userId: 'host-123',
      teamId: 'team-host-123',
      teamName: 'Host Team',
      isReady: true,
      isConnected: true,
      lastActiveAt: now,
    },
    visitorPlayer: undefined,
    gameState: {
      inning: 1,
      isTopOfInning: true,
      outs: 0,
      scores: [0, 0] as [number, number],
      bases: [false, false, false] as [boolean, boolean, boolean],
      currentBatterIndex: [0, 0] as [number, number],
      isGameOver: false,
    },
    moves: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('POST /api/games', () => {
  const app = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates game with join code', async () => {
    const mockSession = createMockGameSession({
      homePlayer: {
        userId: 'user-123',
        teamId: 'team-123',
        teamName: 'My Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: new Date(),
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      createGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-123' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.joinCode).toBeDefined();
    expect(response.body.data.joinCode.length).toBe(6);
  });

  it('sets creator as home team', async () => {
    const mockSession = createMockGameSession({
      homePlayer: {
        userId: 'user-123',
        teamId: 'team-123',
        teamName: 'My Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: new Date(),
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      createGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-123' });

    expect(response.status).toBe(201);
    expect(response.body.data.homeTeam.userId).toBe('user-123');
  });

  it('initializes game state correctly', async () => {
    const mockSession = createMockGameSession();

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      createGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-123' });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('waiting');
  });

  it('returns 400 if user has no complete team', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      createGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Team roster is incomplete',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-incomplete' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('validation_error');
  });

  it('returns 401 for unauthenticated request', async () => {
    const response = await request(app)
      .post('/api/games')
      .send({ teamId: 'team-123' });

    expect(response.status).toBe(401);
  });

  it('returns 400 for missing teamId', async () => {
    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns 409 if user already has active game', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      createGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'conflict',
          message: 'You already have an active game',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-123' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('conflict');
  });
});

describe('POST /api/games/join', () => {
  const app = createApp();
  const token = createTestToken({ id: 'guest-456' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins game with valid code', async () => {
    const mockSession = createMockGameSession({
      status: 'active',
      visitorPlayer: {
        userId: 'guest-456',
        teamId: 'team-guest',
        teamName: 'Guest Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: new Date(),
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      joinGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'ABC123', teamId: 'team-guest' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('active');
  });

  it('sets joiner as visitor team', async () => {
    const mockSession = createMockGameSession({
      status: 'active',
      visitorPlayer: {
        userId: 'guest-456',
        teamId: 'team-guest',
        teamName: 'Guest Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: new Date(),
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      joinGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'ABC123', teamId: 'team-guest' });

    expect(response.status).toBe(200);
    expect(response.body.data.visitorTeam.userId).toBe('guest-456');
  });

  it('changes status to active', async () => {
    const mockSession = createMockGameSession({
      status: 'active',
      startedAt: new Date(),
      visitorPlayer: {
        userId: 'guest-456',
        teamId: 'team-guest',
        teamName: 'Guest Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: new Date(),
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      joinGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'ABC123', teamId: 'team-guest' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('active');
    expect(response.body.data.startedAt).toBeDefined();
  });

  it('returns 404 for invalid code', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      joinGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found with that join code',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'XXXXXX', teamId: 'team-guest' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });

  it('returns 409 for already-started game', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      joinGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'conflict',
          message: 'Game has already started',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'ABC123', teamId: 'team-guest' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('conflict');
  });

  it('returns 400 for joining own game', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      joinGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Cannot join your own game',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'ABC123', teamId: 'team-guest' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('own game');
  });

  it('returns 401 for unauthenticated request', async () => {
    const response = await request(app)
      .post('/api/games/join')
      .send({ joinCode: 'ABC123', teamId: 'team-guest' });

    expect(response.status).toBe(401);
  });

  it('returns 400 for missing joinCode', async () => {
    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ teamId: 'team-guest' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });
});

describe('GET /api/games/:id', () => {
  const app = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns game for participant', async () => {
    const mockSession = createMockGameSession({
      homePlayer: {
        userId: 'user-123',
        teamId: 'team-123',
        teamName: 'My Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: new Date(),
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      getGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
      isPlayerTurn: vi.fn().mockReturnValue(false),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .get('/api/games/game-123')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('game-123');
  });

  it('includes isMyTurn indicator', async () => {
    const mockSession = createMockGameSession({
      status: 'active',
      visitorPlayer: {
        userId: 'user-123',
        teamId: 'team-123',
        teamName: 'My Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: new Date(),
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      getGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
      isPlayerTurn: vi.fn().mockReturnValue(true),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .get('/api/games/game-123')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.isMyTurn).toBe(true);
  });

  it('returns 403 for non-participant', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      getGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You are not a participant in this game',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .get('/api/games/game-123')
      .set(authHeader(token));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('forbidden');
  });

  it('returns 404 for non-existent game', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      getGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'not_found',
          message: 'Game not found',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .get('/api/games/nonexistent')
      .set(authHeader(token));

    expect(response.status).toBe(404);
  });

  it('returns 401 for unauthenticated request', async () => {
    const response = await request(app).get('/api/games/game-123');

    expect(response.status).toBe(401);
  });
});

describe('GET /api/games/history', () => {
  const app = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user's game history", async () => {
    const mockSessions = [
      createMockGameSession({ id: 'game-1', status: 'completed' }),
      createMockGameSession({ id: 'game-2', status: 'waiting' }),
    ];

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      getUserGames: vi.fn().mockResolvedValue({
        success: true,
        data: mockSessions,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .get('/api/games/history')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
  });

  it('filters by status query param', async () => {
    const mockSessions = [
      createMockGameSession({ id: 'game-1', status: 'completed' }),
    ];

    const mockGetUserGames = vi.fn().mockResolvedValue({
      success: true,
      data: mockSessions,
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      getUserGames: mockGetUserGames,
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .get('/api/games/history?status=completed')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(mockGetUserGames).toHaveBeenCalledWith('user-123', { status: ['completed'] });
  });

  it('returns 401 for unauthenticated request', async () => {
    const response = await request(app).get('/api/games/history');

    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/games/:id', () => {
  const app = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows creator to cancel waiting game', async () => {
    const mockSession = createMockGameSession({
      status: 'abandoned',
      homePlayer: {
        userId: 'user-123',
        teamId: 'team-123',
        teamName: 'My Team',
        isReady: true,
        isConnected: true,
        lastActiveAt: new Date(),
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      cancelGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .delete('/api/games/game-123')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('abandoned');
  });

  it('returns 403 for non-creator', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      cancelGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'forbidden',
          message: 'Only the game creator can cancel',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .delete('/api/games/game-123')
      .set(authHeader(token));

    expect(response.status).toBe(403);
  });

  it('returns 409 for active game', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      cancelGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'conflict',
          message: 'Cannot cancel a game that has already started',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .delete('/api/games/game-123')
      .set(authHeader(token));

    expect(response.status).toBe(409);
  });
});

describe('POST /api/games/:id/forfeit', () => {
  const app = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows participant to forfeit', async () => {
    const mockSession = createMockGameSession({
      status: 'forfeit',
      gameState: {
        inning: 5,
        isTopOfInning: false,
        outs: 2,
        scores: [3, 5] as [number, number],
        bases: [false, false, false] as [boolean, boolean, boolean],
        currentBatterIndex: [0, 0] as [number, number],
        isGameOver: true,
        winnerId: 'opponent-456',
        endReason: 'forfeit',
      },
    });

    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      forfeitGame: vi.fn().mockResolvedValue({
        success: true,
        data: mockSession,
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games/game-123/forfeit')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('forfeit');
    expect(response.body.data.gameState.winnerId).toBe('opponent-456');
  });

  it('returns 403 for non-participant', async () => {
    vi.mocked(gameSessionService.getGameService).mockReturnValue({
      forfeitGame: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You are not a participant in this game',
        },
      }),
    } as unknown as gameSessionService.GameSessionService);

    const response = await request(app)
      .post('/api/games/game-123/forfeit')
      .set(authHeader(token));

    expect(response.status).toBe(403);
  });
});
