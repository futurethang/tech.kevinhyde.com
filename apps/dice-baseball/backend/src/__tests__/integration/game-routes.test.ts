import { describe, it, expect, beforeEach, vi } from 'vitest';

import request from 'supertest';
import { createApp } from '../../server.js';
import { createTestToken, authHeader } from '../helpers/auth.js';
import * as gameService from '../../services/game-service.js';
import * as teamService from '../../services/team-service.js';

const describeIfNetwork = process.env.SKIP_NETWORK_TESTS === "1" ? describe.skip : describe;

// Mock the game service
vi.mock('../../services/game-service.js', () => ({
  createGame: vi.fn(),
  joinGame: vi.fn(),
  getGameById: vi.fn(),
  getGameByJoinCode: vi.fn(),
  getUserActiveGames: vi.fn(),
  endGame: vi.fn(),
}));

// Mock the team service (for roster validation)
vi.mock('../../services/team-service.js', () => ({
  getTeamById: vi.fn(),
  getTeams: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  updateRoster: vi.fn(),
  updateBattingOrder: vi.fn(),
}));

// Valid roster fixture used by tests that need to pass roster validation
const VALID_ROSTER = [
  { position: 'C', mlbPlayerId: 518735, battingOrder: 9 },
  { position: '1B', mlbPlayerId: 518692, battingOrder: 4 },
  { position: '2B', mlbPlayerId: 543760, battingOrder: 8 },
  { position: '3B', mlbPlayerId: 571448, battingOrder: 5 },
  { position: 'SS', mlbPlayerId: 596115, battingOrder: 1 },
  { position: 'LF', mlbPlayerId: 665742, battingOrder: 7 },
  { position: 'CF', mlbPlayerId: 545361, battingOrder: 2 },
  { position: 'RF', mlbPlayerId: 605141, battingOrder: 6 },
  { position: 'DH', mlbPlayerId: 660271, battingOrder: 3 },
  { position: 'SP', mlbPlayerId: 543037, battingOrder: null },
];

console.log('🧪 Starting test suite...');

describeIfNetwork('POST /api/games', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates game with join code', async () => {
    const completeTeam = {
      id: 'team-uuid',
      userId: 'user-123',
      name: 'My Team',
      rosterComplete: true,
      roster: [
        { position: 'C', mlbPlayerId: 518735, battingOrder: 9 },
        { position: '1B', mlbPlayerId: 518692, battingOrder: 4 },
        { position: '2B', mlbPlayerId: 543760, battingOrder: 8 },
        { position: '3B', mlbPlayerId: 571448, battingOrder: 5 },
        { position: 'SS', mlbPlayerId: 596115, battingOrder: 1 },
        { position: 'LF', mlbPlayerId: 665742, battingOrder: 7 },
        { position: 'CF', mlbPlayerId: 545361, battingOrder: 2 },
        { position: 'RF', mlbPlayerId: 605141, battingOrder: 6 },
        { position: 'DH', mlbPlayerId: 660271, battingOrder: 3 },
        { position: 'SP', mlbPlayerId: 543037, battingOrder: null },
      ],
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(completeTeam);

    const newGame = {
      id: 'game-uuid',
      joinCode: 'ABC123',
      homeTeamId: 'team-uuid',
      homeUserId: 'user-123',
      visitorTeamId: null,
      visitorUserId: null,
      status: 'waiting',
      createdAt: '2025-01-20T10:00:00Z',
    };

    vi.mocked(gameService.createGame).mockResolvedValue(newGame);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-uuid' });

    expect(response.status).toBe(201);
    expect(response.body.joinCode).toBe('ABC123');
    expect(response.body.status).toBe('waiting');
    expect(gameService.createGame).toHaveBeenCalledWith('user-123', 'team-uuid');
  });

  it('sets creator as home team', async () => {
    const completeTeam = {
      id: 'team-uuid',
      userId: 'user-123',
      name: 'My Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(completeTeam);

    const newGame = {
      id: 'game-uuid',
      joinCode: 'XYZ789',
      homeTeamId: 'team-uuid',
      homeUserId: 'user-123',
      visitorTeamId: null,
      visitorUserId: null,
      status: 'waiting',
      createdAt: '2025-01-20T10:00:00Z',
    };

    vi.mocked(gameService.createGame).mockResolvedValue(newGame);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-uuid' });

    expect(response.status).toBe(201);
    expect(response.body.homeTeamId).toBe('team-uuid');
    expect(response.body.homeUserId).toBe('user-123');
  });

  it('initializes game state correctly', async () => {
    const completeTeam = {
      id: 'team-uuid',
      userId: 'user-123',
      name: 'My Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(completeTeam);

    const newGame = {
      id: 'game-uuid',
      joinCode: 'DEF456',
      homeTeamId: 'team-uuid',
      homeUserId: 'user-123',
      visitorTeamId: null,
      visitorUserId: null,
      status: 'waiting',
      state: {
        inning: 1,
        isTopOfInning: true,
        outs: 0,
        scores: [0, 0],
        bases: [false, false, false],
        currentBatterIndex: 0,
      },
      createdAt: '2025-01-20T10:00:00Z',
    };

    vi.mocked(gameService.createGame).mockResolvedValue(newGame);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-uuid' });

    expect(response.status).toBe(201);
    expect(response.body.state.inning).toBe(1);
    expect(response.body.state.isTopOfInning).toBe(true);
    expect(response.body.state.outs).toBe(0);
    expect(response.body.state.scores).toEqual([0, 0]);
  });

  it('returns 401 for unauthenticated request', async () => {
    const response = await request(app).post('/api/games').send({ teamId: 'team-uuid' });

    expect(response.status).toBe(401);
  });

  it('returns 400 if user has no complete team', async () => {
    const incompleteTeam = {
      id: 'team-uuid',
      userId: 'user-123',
      name: 'Incomplete Team',
      rosterComplete: false,
      roster: [],
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(incompleteTeam);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-uuid' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
    expect(response.body.message).toContain('complete');
  });

  it('returns 400 for missing team ID', async () => {
    const response = await request(app).post('/api/games').set(authHeader(token)).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns 404 for unknown team', async () => {
    vi.mocked(teamService.getTeamById).mockResolvedValue(null);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'unknown-team' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_found');
  });

  it('returns 403 for team not owned by user', async () => {
    const otherUserTeam = {
      id: 'team-uuid',
      userId: 'other-user',
      name: 'Other Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(otherUserTeam);

    const response = await request(app)
      .post('/api/games')
      .set(authHeader(token))
      .send({ teamId: 'team-uuid' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
  });
});

describeIfNetwork('POST /api/games/join', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-456' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins game with valid code', async () => {
    const userTeam = {
      id: 'visitor-team',
      userId: 'user-456',
      name: 'Visitor Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(userTeam);

    const waitingGame = {
      id: 'game-uuid',
      joinCode: 'ABC123',
      homeTeamId: 'home-team',
      homeUserId: 'user-123',
      visitorTeamId: null,
      visitorUserId: null,
      status: 'waiting',
    };

    vi.mocked(gameService.getGameByJoinCode).mockResolvedValue(waitingGame);

    const joinedGame = {
      ...waitingGame,
      visitorTeamId: 'visitor-team',
      visitorUserId: 'user-456',
      status: 'active',
    };

    vi.mocked(gameService.joinGame).mockResolvedValue(joinedGame);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'ABC123', teamId: 'visitor-team' });

    expect(response.status).toBe(200);
    expect(response.body.visitorTeamId).toBe('visitor-team');
    expect(response.body.status).toBe('active');
  });

  it('sets joiner as visitor team', async () => {
    const userTeam = {
      id: 'visitor-team',
      userId: 'user-456',
      name: 'Visitor Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(userTeam);

    const waitingGame = {
      id: 'game-uuid',
      joinCode: 'XYZ789',
      homeTeamId: 'home-team',
      homeUserId: 'user-123',
      visitorTeamId: null,
      visitorUserId: null,
      status: 'waiting',
    };

    vi.mocked(gameService.getGameByJoinCode).mockResolvedValue(waitingGame);

    const joinedGame = {
      ...waitingGame,
      visitorTeamId: 'visitor-team',
      visitorUserId: 'user-456',
      status: 'active',
    };

    vi.mocked(gameService.joinGame).mockResolvedValue(joinedGame);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'XYZ789', teamId: 'visitor-team' });

    expect(response.body.visitorUserId).toBe('user-456');
  });

  it('changes status to active', async () => {
    const userTeam = {
      id: 'visitor-team',
      userId: 'user-456',
      name: 'Visitor Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(userTeam);

    const waitingGame = {
      id: 'game-uuid',
      joinCode: 'GAME01',
      homeTeamId: 'home-team',
      homeUserId: 'user-123',
      visitorTeamId: null,
      visitorUserId: null,
      status: 'waiting',
    };

    vi.mocked(gameService.getGameByJoinCode).mockResolvedValue(waitingGame);

    const joinedGame = {
      ...waitingGame,
      visitorTeamId: 'visitor-team',
      visitorUserId: 'user-456',
      status: 'active',
    };

    vi.mocked(gameService.joinGame).mockResolvedValue(joinedGame);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'GAME01', teamId: 'visitor-team' });

    expect(response.body.status).toBe('active');
  });

  it('returns 404 for invalid code', async () => {
    const userTeam = {
      id: 'visitor-team',
      userId: 'user-456',
      name: 'Visitor Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(userTeam);
    vi.mocked(gameService.getGameByJoinCode).mockResolvedValue(null);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'INVALID', teamId: 'visitor-team' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_found');
  });

  it('returns 400 for already-started game', async () => {
    const userTeam = {
      id: 'visitor-team',
      userId: 'user-456',
      name: 'Visitor Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(userTeam);

    const activeGame = {
      id: 'game-uuid',
      joinCode: 'ACTIVE',
      homeTeamId: 'home-team',
      homeUserId: 'user-123',
      visitorTeamId: 'other-team',
      visitorUserId: 'other-user',
      status: 'active',
    };

    vi.mocked(gameService.getGameByJoinCode).mockResolvedValue(activeGame);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'ACTIVE', teamId: 'visitor-team' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('game_already_started');
  });

  it('returns 400 for joining own game', async () => {
    const tokenSameUser = createTestToken({ id: 'user-123' });

    const userTeam = {
      id: 'home-team',
      userId: 'user-123',
      name: 'Home Team',
      rosterComplete: true,
      roster: VALID_ROSTER,
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(userTeam);

    const ownGame = {
      id: 'game-uuid',
      joinCode: 'MYCODE',
      homeTeamId: 'home-team',
      homeUserId: 'user-123',
      visitorTeamId: null,
      visitorUserId: null,
      status: 'waiting',
    };

    vi.mocked(gameService.getGameByJoinCode).mockResolvedValue(ownGame);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(tokenSameUser))
      .send({ joinCode: 'MYCODE', teamId: 'home-team' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('cannot_join_own_game');
  });

  it('returns 400 for incomplete team', async () => {
    const incompleteTeam = {
      id: 'visitor-team',
      userId: 'user-456',
      name: 'Incomplete Team',
      rosterComplete: false,
      roster: [],
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(incompleteTeam);

    const response = await request(app)
      .post('/api/games/join')
      .set(authHeader(token))
      .send({ joinCode: 'ABC123', teamId: 'visitor-team' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
    expect(response.body.message).toContain('complete');
  });

  it('returns 401 for unauthenticated request', async () => {
    const response = await request(app)
      .post('/api/games/join')
      .send({ joinCode: 'ABC123', teamId: 'team-uuid' });

    expect(response.status).toBe(401);
  });
});

describeIfNetwork('GET /api/games/:id', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns game with full state for participant', async () => {
    const game = {
      id: 'game-uuid',
      joinCode: 'ABC123',
      homeTeamId: 'home-team',
      homeUserId: 'user-123',
      visitorTeamId: 'visitor-team',
      visitorUserId: 'user-456',
      status: 'active',
      state: {
        inning: 3,
        isTopOfInning: false,
        outs: 1,
        scores: [2, 1],
        bases: [true, false, false],
        currentBatterIndex: 4,
      },
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(game);

    const response = await request(app).get('/api/games/game-uuid').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('game-uuid');
    expect(response.body.state.inning).toBe(3);
    expect(response.body.state.scores).toEqual([2, 1]);
  });

  it('returns 404 for unknown game', async () => {
    vi.mocked(gameService.getGameById).mockResolvedValue(null);

    const response = await request(app).get('/api/games/unknown-id').set(authHeader(token));

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_found');
  });

  it('returns 403 for non-participant', async () => {
    const game = {
      id: 'game-uuid',
      joinCode: 'ABC123',
      homeTeamId: 'home-team',
      homeUserId: 'other-user-1',
      visitorTeamId: 'visitor-team',
      visitorUserId: 'other-user-2',
      status: 'active',
      state: {},
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(game);

    const response = await request(app).get('/api/games/game-uuid').set(authHeader(token));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
  });
});

describeIfNetwork('GET /api/games', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user active games', async () => {
    const games = [
      {
        id: 'game-1',
        status: 'active',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
      },
      {
        id: 'game-2',
        status: 'waiting',
        homeUserId: 'user-123',
        visitorUserId: null,
      },
    ];

    vi.mocked(gameService.getUserActiveGames).mockResolvedValue(games);

    const response = await request(app).get('/api/games').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.games).toHaveLength(2);
    expect(gameService.getUserActiveGames).toHaveBeenCalledWith('user-123');
  });

  it('returns empty array when no games', async () => {
    vi.mocked(gameService.getUserActiveGames).mockResolvedValue([]);

    const response = await request(app).get('/api/games').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.games).toEqual([]);
  });
});

describeIfNetwork('POST /api/games/:id/forfeit', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forfeits game and sets opponent as winner', async () => {
    const game = {
      id: 'game-uuid',
      homeTeamId: 'home-team',
      homeUserId: 'user-123',
      visitorTeamId: 'visitor-team',
      visitorUserId: 'user-456',
      status: 'active',
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(game);
    vi.mocked(gameService.endGame).mockResolvedValue({
      winnerId: 'user-456',
      loserId: 'user-123',
      reason: 'forfeit',
    });

    const response = await request(app)
      .post('/api/games/game-uuid/forfeit')
      .set(authHeader(token))
      .send();

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Game forfeited');
    expect(response.body.winnerId).toBe('user-456');
  });

  it('returns 403 for non-participant', async () => {
    const game = {
      id: 'game-uuid',
      homeTeamId: 'home-team',
      homeUserId: 'other-user-1',
      visitorTeamId: 'visitor-team',
      visitorUserId: 'other-user-2',
      status: 'active',
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(game);

    const response = await request(app)
      .post('/api/games/game-uuid/forfeit')
      .set(authHeader(token))
      .send();

    expect(response.status).toBe(403);
  });

  it('returns 400 for game not in active status', async () => {
    const game = {
      id: 'game-uuid',
      homeTeamId: 'home-team',
      homeUserId: 'user-123',
      visitorTeamId: 'visitor-team',
      visitorUserId: 'user-456',
      status: 'completed',
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(game);

    const response = await request(app)
      .post('/api/games/game-uuid/forfeit')
      .set(authHeader(token))
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('game_not_active');
  });
});

console.log('✅ Test suite completed');
