/**
 * API Service - REST API client for Dice Baseball backend
 */

import type { User, Team, Game, MLBPlayer, ApiError } from '../types';
import type { AuthResponse as ContractAuthResponse, AuthUser } from '@dice-baseball/contracts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ============================================
// AUTH API
// ============================================

export interface AuthResponse {
  user: User;
  token: string;
}

function normalizeUser(user: AuthUser): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.username,
    wins: user.wins ?? 0,
    losses: user.losses ?? 0,
    createdAt: user.createdAt ?? new Date().toISOString(),
  };
}

export async function register(email: string, username: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: 'unknown_error',
      message: `HTTP ${response.status}`,
    }));
    throw error;
  }

  const data = (await response.json()) as ContractAuthResponse;
  return {
    user: normalizeUser(data.user),
    token: data.token,
  };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: 'unknown_error',
      message: `HTTP ${response.status}`,
    }));
    throw error;
  }

  const data = (await response.json()) as ContractAuthResponse;
  return {
    user: normalizeUser(data.user),
    token: data.token,
  };
}

// Get token from localStorage (set by auth store)
function getToken(): string | null {
  try {
    const authData = localStorage.getItem('dice-baseball-auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Fetch wrapper with auth
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: 'unknown_error',
      message: `HTTP ${response.status}`,
    }));
    throw error;
  }

  return response.json();
}

// ============================================
// MLB PLAYERS API
// ============================================

export interface GetPlayersParams {
  position?: string;
  team?: string;
  league?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
  // Stats range filters
  minOps?: number;
  maxOps?: number;
  minEra?: number;
  maxEra?: number;
  minHr?: number;
  maxHr?: number;
  minRbi?: number;
  maxRbi?: number;
}

export async function getPlayers(
  params: GetPlayersParams = {}
): Promise<{ players: MLBPlayer[]; total: number; limit: number; offset: number }> {
  const searchParams = new URLSearchParams();
  if (params.position) searchParams.set('position', params.position);
  if (params.team) searchParams.set('team', params.team);
  if (params.league) searchParams.set('league', params.league);
  if (params.search) searchParams.set('q', params.search);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.page && params.limit) {
    searchParams.set('offset', String((params.page - 1) * params.limit));
  } else if (params.page) {
    searchParams.set('page', String(params.page));
  }
  
  // Stats range filters
  if (params.minOps !== undefined) searchParams.set('minOps', String(params.minOps));
  if (params.maxOps !== undefined) searchParams.set('maxOps', String(params.maxOps));
  if (params.minEra !== undefined) searchParams.set('minEra', String(params.minEra));
  if (params.maxEra !== undefined) searchParams.set('maxEra', String(params.maxEra));
  if (params.minHr !== undefined) searchParams.set('minHr', String(params.minHr));
  if (params.maxHr !== undefined) searchParams.set('maxHr', String(params.maxHr));
  if (params.minRbi !== undefined) searchParams.set('minRbi', String(params.minRbi));
  if (params.maxRbi !== undefined) searchParams.set('maxRbi', String(params.maxRbi));

  const query = searchParams.toString();
  return fetchWithAuth(`/mlb/players${query ? `?${query}` : ''}`);
}

export async function getPlayerById(mlbId: number): Promise<MLBPlayer> {
  return fetchWithAuth(`/mlb/players/${mlbId}`);
}

// ============================================
// TEAMS API
// ============================================

export async function getTeams(): Promise<{ teams: Team[] }> {
  return fetchWithAuth('/teams');
}

export async function getTeamById(teamId: string): Promise<Team> {
  return fetchWithAuth(`/teams/${teamId}`);
}

export async function createTeam(name: string): Promise<Team> {
  return fetchWithAuth('/teams', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateTeamRoster(
  teamId: string,
  slots: Array<{ position: string; mlbPlayerId: number; battingOrder: number | null }>
): Promise<{ message: string }> {
  return fetchWithAuth(`/teams/${teamId}/roster`, {
    method: 'PUT',
    body: JSON.stringify({ slots }),
  });
}

export async function updateBattingOrder(
  teamId: string,
  order: string[]
): Promise<{ message: string }> {
  return fetchWithAuth(`/teams/${teamId}/batting-order`, {
    method: 'PUT',
    body: JSON.stringify({ order }),
  });
}

export async function deleteTeam(teamId: string): Promise<void> {
  await fetchWithAuth(`/teams/${teamId}`, { method: 'DELETE' });
}

export async function saveTeamDraft(
  teamId: string,
  slots: Array<{ position: string; mlbPlayerId: number; battingOrder: number | null }>
): Promise<{ message: string }> {
  return fetchWithAuth(`/teams/${teamId}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ slots }),
  });
}

export async function duplicateTeam(teamId: string, newName: string): Promise<Team> {
  return fetchWithAuth(`/teams/${teamId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({ name: newName }),
  });
}

export async function reorderTeams(teamIds: string[]): Promise<{ message: string }> {
  return fetchWithAuth('/teams/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ teamIds }),
  });
}

// ============================================
// GAMES API
// ============================================

export async function createGame(teamId: string): Promise<Game> {
  return fetchWithAuth('/games', {
    method: 'POST',
    body: JSON.stringify({ teamId }),
  });
}

export async function joinGame(joinCode: string, teamId: string): Promise<Game> {
  return fetchWithAuth('/games/join', {
    method: 'POST',
    body: JSON.stringify({ joinCode, teamId }),
  });
}

export async function getActiveGames(): Promise<{ games: Game[] }> {
  return fetchWithAuth('/games');
}

export async function getGameById(gameId: string): Promise<Game> {
  return fetchWithAuth(`/games/${gameId}`);
}

export async function forfeitGame(gameId: string): Promise<{ message: string; winnerId: string }> {
  return fetchWithAuth(`/games/${gameId}/forfeit`, {
    method: 'POST',
  });
}
