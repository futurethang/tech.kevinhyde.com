import { describe, it, expect, beforeEach, vi } from 'vitest';

import request from 'supertest';
import { createApp } from '../../server.js';
import { createTestToken, authHeader } from '../helpers/auth.js';
import * as teamService from '../../services/team-service.js';

const describeIfNetwork = process.env.SKIP_NETWORK_TESTS === "1" ? describe.skip : describe;

// Mock the team service
vi.mock('../../services/team-service.js', () => ({
  getTeams: vi.fn(),
  getTeamById: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  updateRoster: vi.fn(),
  updateBattingOrder: vi.fn(),
}));

describeIfNetwork('POST /api/teams', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates team for authenticated user', async () => {
    const newTeam = {
      id: 'team-uuid',
      name: 'My Dream Team',
      userId: 'user-123',
      isActive: false,
      rosterComplete: false,
      createdAt: '2025-01-20T10:00:00Z',
    };

    vi.mocked(teamService.createTeam).mockResolvedValue(newTeam);

    const response = await request(app)
      .post('/api/teams')
      .set(authHeader(token))
      .send({ name: 'My Dream Team' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('My Dream Team');
    expect(teamService.createTeam).toHaveBeenCalledWith('user-123', 'My Dream Team');
  });

  it('returns 401 for unauthenticated request', async () => {
    const response = await request(app).post('/api/teams').send({ name: 'My Team' });

    expect(response.status).toBe(401);
  });

  it('returns 400 for missing team name', async () => {
    const response = await request(app).post('/api/teams').set(authHeader(token)).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns 400 for empty team name', async () => {
    const response = await request(app).post('/api/teams').set(authHeader(token)).send({ name: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns 400 for name too long', async () => {
    const response = await request(app)
      .post('/api/teams')
      .set(authHeader(token))
      .send({ name: 'A'.repeat(51) }); // 51 chars, max is 50

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('trims whitespace from team name', async () => {
    const newTeam = {
      id: 'team-uuid',
      name: 'My Team',
      userId: 'user-123',
      isActive: false,
      rosterComplete: false,
      createdAt: '2025-01-20T10:00:00Z',
    };

    vi.mocked(teamService.createTeam).mockResolvedValue(newTeam);

    const response = await request(app)
      .post('/api/teams')
      .set(authHeader(token))
      .send({ name: '  My Team  ' });

    expect(response.status).toBe(201);
    expect(teamService.createTeam).toHaveBeenCalledWith('user-123', 'My Team');
  });
});

describeIfNetwork('GET /api/teams', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user teams', async () => {
    const teams = [
      {
        id: 'team-1',
        name: 'Team One',
        isActive: true,
        rosterComplete: true,
        createdAt: '2025-01-15T10:00:00Z',
      },
      {
        id: 'team-2',
        name: 'Team Two',
        isActive: false,
        rosterComplete: false,
        createdAt: '2025-01-20T09:00:00Z',
      },
    ];

    vi.mocked(teamService.getTeams).mockResolvedValue(teams);

    const response = await request(app).get('/api/teams').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.teams).toHaveLength(2);
    expect(teamService.getTeams).toHaveBeenCalledWith('user-123');
  });

  it('returns 401 without authentication', async () => {
    const response = await request(app).get('/api/teams');

    expect(response.status).toBe(401);
  });
});

describeIfNetwork('GET /api/teams/:id', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns team with roster', async () => {
    const team = {
      id: 'team-uuid',
      name: 'My Team',
      userId: 'user-123',
      isActive: true,
      roster: [
        { position: 'SS', battingOrder: 1, mlbPlayerId: 596115 },
        { position: 'CF', battingOrder: 2, mlbPlayerId: 545361 },
      ],
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(team);

    const response = await request(app).get('/api/teams/team-uuid').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('My Team');
    expect(response.body.roster).toHaveLength(2);
  });

  it('returns 404 for unknown team', async () => {
    vi.mocked(teamService.getTeamById).mockResolvedValue(null);

    const response = await request(app).get('/api/teams/unknown-id').set(authHeader(token));

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_found');
  });

  it('returns 403 for team not owned by user', async () => {
    const team = {
      id: 'team-uuid',
      name: 'Other User Team',
      userId: 'other-user',
      isActive: true,
      roster: [],
    };

    vi.mocked(teamService.getTeamById).mockResolvedValue(team);

    const response = await request(app).get('/api/teams/team-uuid').set(authHeader(token));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
  });
});

describeIfNetwork('PUT /api/teams/:id/roster', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  const validRoster = [
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates roster with valid data', async () => {
    const team = { id: 'team-uuid', userId: 'user-123' };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);
    vi.mocked(teamService.updateRoster).mockResolvedValue({
      ...team,
      roster: validRoster,
      rosterComplete: true,
    });

    const response = await request(app)
      .put('/api/teams/team-uuid/roster')
      .set(authHeader(token))
      .send({ slots: validRoster });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Roster updated');
  });

  it('returns 400 for invalid roster (missing positions)', async () => {
    const team = { id: 'team-uuid', userId: 'user-123' };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);

    const invalidRoster = validRoster.filter((s) => s.position !== 'SS');

    const response = await request(app)
      .put('/api/teams/team-uuid/roster')
      .set(authHeader(token))
      .send({ slots: invalidRoster });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns 403 for team not owned by user', async () => {
    const team = { id: 'team-uuid', userId: 'other-user' };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);

    const response = await request(app)
      .put('/api/teams/team-uuid/roster')
      .set(authHeader(token))
      .send({ slots: validRoster });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
  });

  it('returns 404 for unknown team', async () => {
    vi.mocked(teamService.getTeamById).mockResolvedValue(null);

    const response = await request(app)
      .put('/api/teams/unknown/roster')
      .set(authHeader(token))
      .send({ slots: validRoster });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_found');
  });
});

describeIfNetwork('PUT /api/teams/:id/batting-order', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reorders batting lineup', async () => {
    const team = {
      id: 'team-uuid',
      userId: 'user-123',
      rosterComplete: true,
    };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);
    vi.mocked(teamService.updateBattingOrder).mockResolvedValue({
      message: 'Batting order updated',
      battingOrder: [
        { order: 1, position: 'SS' },
        { order: 2, position: 'CF' },
      ],
    });

    const newOrder = ['SS', 'CF', 'DH', '1B', '3B', 'RF', 'LF', '2B', 'C'];

    const response = await request(app)
      .put('/api/teams/team-uuid/batting-order')
      .set(authHeader(token))
      .send({ order: newOrder });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Batting order updated');
  });

  it('returns 400 for invalid order (wrong length)', async () => {
    const team = { id: 'team-uuid', userId: 'user-123', rosterComplete: true };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);

    const response = await request(app)
      .put('/api/teams/team-uuid/batting-order')
      .set(authHeader(token))
      .send({ order: ['SS', 'CF', 'DH'] }); // Only 3, need 9

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns 400 for incomplete roster', async () => {
    const team = { id: 'team-uuid', userId: 'user-123', rosterComplete: false };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);

    const newOrder = ['SS', 'CF', 'DH', '1B', '3B', 'RF', 'LF', '2B', 'C'];

    const response = await request(app)
      .put('/api/teams/team-uuid/batting-order')
      .set(authHeader(token))
      .send({ order: newOrder });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('complete');
  });

  it('returns 400 for order containing pitcher', async () => {
    const team = { id: 'team-uuid', userId: 'user-123', rosterComplete: true };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);

    const orderWithPitcher = ['SS', 'CF', 'DH', '1B', '3B', 'RF', 'LF', '2B', 'SP'];

    const response = await request(app)
      .put('/api/teams/team-uuid/batting-order')
      .set(authHeader(token))
      .send({ order: orderWithPitcher });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });
});

describeIfNetwork('DELETE /api/teams/:id', () => {
  const { app } = createApp();
  const token = createTestToken({ id: 'user-123' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes team owned by user', async () => {
    const team = { id: 'team-uuid', userId: 'user-123' };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);
    vi.mocked(teamService.deleteTeam).mockResolvedValue(undefined);

    const response = await request(app).delete('/api/teams/team-uuid').set(authHeader(token));

    expect(response.status).toBe(204);
    expect(teamService.deleteTeam).toHaveBeenCalledWith('team-uuid');
  });

  it('returns 403 for team not owned by user', async () => {
    const team = { id: 'team-uuid', userId: 'other-user' };
    vi.mocked(teamService.getTeamById).mockResolvedValue(team);

    const response = await request(app).delete('/api/teams/team-uuid').set(authHeader(token));

    expect(response.status).toBe(403);
  });

  it('returns 404 for unknown team', async () => {
    vi.mocked(teamService.getTeamById).mockResolvedValue(null);

    const response = await request(app).delete('/api/teams/unknown').set(authHeader(token));

    expect(response.status).toBe(404);
  });
});
