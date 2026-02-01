import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server.js';
import { createTestToken, authHeader } from '../helpers/auth.js';
import * as mlbService from '../../services/mlb-sync.js';

// Mock the MLB service
vi.mock('../../services/mlb-sync.js', () => ({
  getPlayers: vi.fn(),
  getPlayerById: vi.fn(),
  extractBattingStats: vi.fn(),
  extractPitchingStats: vi.fn(),
  getCurrentSeason: vi.fn(() => 2025),
  buildPhotoUrl: vi.fn((id) => `https://img.mlb.com/people/${id}/headshot`),
}));

describe('GET /api/mlb/players', () => {
  const app = createApp();
  const token = createTestToken();

  const mockPlayers = [
    {
      mlbId: 665742,
      fullName: 'Juan Soto',
      firstName: 'Juan',
      lastName: 'Soto',
      primaryPosition: 'RF',
      currentTeam: 'NYY',
      currentTeamId: 147,
      photoUrl: 'https://img.mlb.com/people/665742/headshot',
      battingStats: {
        gamesPlayed: 155,
        atBats: 568,
        avg: 0.288,
        obp: 0.410,
        slg: 0.530,
        ops: 0.940,
        homeRuns: 35,
        rbi: 102,
      },
      lastUpdated: '2025-01-20T05:00:00Z',
    },
    {
      mlbId: 545361,
      fullName: 'Mike Trout',
      firstName: 'Mike',
      lastName: 'Trout',
      primaryPosition: 'CF',
      currentTeam: 'LAA',
      currentTeamId: 108,
      photoUrl: 'https://img.mlb.com/people/545361/headshot',
      battingStats: {
        gamesPlayed: 120,
        atBats: 450,
        avg: 0.285,
        obp: 0.390,
        slg: 0.555,
        ops: 0.945,
        homeRuns: 32,
        rbi: 88,
      },
      lastUpdated: '2025-01-20T05:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated player list', async () => {
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: mockPlayers,
      total: 2,
    });

    const response = await request(app)
      .get('/api/mlb/players')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.players).toHaveLength(2);
    expect(response.body.total).toBe(2);
    expect(response.body.limit).toBe(20);
    expect(response.body.offset).toBe(0);
  });

  it('filters by position', async () => {
    const rfPlayers = mockPlayers.filter((p) => p.primaryPosition === 'RF');
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: rfPlayers,
      total: 1,
    });

    const response = await request(app)
      .get('/api/mlb/players?position=RF')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(mlbService.getPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ position: 'RF' })
    );
  });

  it('filters by team', async () => {
    const nyyPlayers = mockPlayers.filter((p) => p.currentTeam === 'NYY');
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: nyyPlayers,
      total: 1,
    });

    const response = await request(app)
      .get('/api/mlb/players?team=NYY')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(mlbService.getPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ team: 'NYY' })
    );
  });

  it('searches by name (partial match)', async () => {
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: [mockPlayers[0]],
      total: 1,
    });

    const response = await request(app)
      .get('/api/mlb/players?q=soto')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(mlbService.getPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'soto' })
    );
  });

  it('sorts by OPS descending by default', async () => {
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: mockPlayers,
      total: 2,
    });

    const response = await request(app)
      .get('/api/mlb/players')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(mlbService.getPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'ops', order: 'desc' })
    );
  });

  it('sorts by specified field', async () => {
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: mockPlayers,
      total: 2,
    });

    const response = await request(app)
      .get('/api/mlb/players?sort=avg&order=asc')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(mlbService.getPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'avg', order: 'asc' })
    );
  });

  it('returns 400 for invalid position', async () => {
    const response = await request(app)
      .get('/api/mlb/players?position=INVALID')
      .set(authHeader(token));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns empty array for no matches', async () => {
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: [],
      total: 0,
    });

    const response = await request(app)
      .get('/api/mlb/players?q=nonexistentplayer')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.players).toEqual([]);
    expect(response.body.total).toBe(0);
  });

  it('respects limit parameter', async () => {
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: [mockPlayers[0]],
      total: 2,
    });

    const response = await request(app)
      .get('/api/mlb/players?limit=1')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.limit).toBe(1);
    expect(mlbService.getPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 })
    );
  });

  it('respects offset parameter', async () => {
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: [mockPlayers[1]],
      total: 2,
    });

    const response = await request(app)
      .get('/api/mlb/players?offset=1')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.offset).toBe(1);
    expect(mlbService.getPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 1 })
    );
  });

  it('returns 401 without authentication', async () => {
    const response = await request(app).get('/api/mlb/players');

    expect(response.status).toBe(401);
  });

  it('enforces max limit of 100', async () => {
    vi.mocked(mlbService.getPlayers).mockResolvedValue({
      players: mockPlayers,
      total: 2,
    });

    const response = await request(app)
      .get('/api/mlb/players?limit=200')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.limit).toBe(100);
    expect(mlbService.getPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });
});

describe('GET /api/mlb/players/:mlbId', () => {
  const app = createApp();
  const token = createTestToken();

  const mockPlayer = {
    mlbId: 660271,
    fullName: 'Shohei Ohtani',
    firstName: 'Shohei',
    lastName: 'Ohtani',
    primaryPosition: 'DH',
    currentTeam: 'LAD',
    currentTeamId: 119,
    photoUrl: 'https://img.mlb.com/people/660271/headshot',
    battingStats: {
      gamesPlayed: 159,
      atBats: 599,
      avg: 0.312,
      obp: 0.412,
      slg: 0.65,
      ops: 1.062,
      homeRuns: 52,
      rbi: 118,
    },
    pitchingStats: null,
    seasonYear: 2025,
    isActive: true,
    lastUpdated: '2025-01-20T05:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns player with full stats', async () => {
    vi.mocked(mlbService.getPlayerById).mockResolvedValue(mockPlayer);

    const response = await request(app)
      .get('/api/mlb/players/660271')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.mlbId).toBe(660271);
    expect(response.body.fullName).toBe('Shohei Ohtani');
    expect(response.body.battingStats).toBeDefined();
  });

  it('returns 404 for unknown player', async () => {
    vi.mocked(mlbService.getPlayerById).mockResolvedValue(null);

    const response = await request(app)
      .get('/api/mlb/players/999999')
      .set(authHeader(token));

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_found');
    expect(response.body.message).toBe('Player not found');
  });

  it('returns 400 for invalid player ID format', async () => {
    const response = await request(app)
      .get('/api/mlb/players/invalid-id')
      .set(authHeader(token));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns 401 without authentication', async () => {
    const response = await request(app).get('/api/mlb/players/660271');

    expect(response.status).toBe(401);
  });
});
