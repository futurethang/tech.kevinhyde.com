import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export interface JWTPayload {
  sub: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

// ============================================
// GAME SESSION TYPES (Phase 5)
// ============================================

/**
 * Game session status - finite state machine
 *
 * State transitions:
 *   waiting → active     (when second player joins)
 *   waiting → abandoned  (timeout or creator cancels)
 *   active  → completed  (game ends normally)
 *   active  → forfeit    (player forfeits or disconnects)
 *   active  → abandoned  (both players disconnect)
 */
export type GameSessionStatus =
  | 'waiting'    // Created, waiting for opponent
  | 'active'     // Both players joined, game in progress
  | 'completed'  // Game finished normally
  | 'forfeit'    // One player forfeited or disconnected
  | 'abandoned'; // Game abandoned (timeout, etc.)

/**
 * Valid state transitions for the game session FSM
 */
export const VALID_STATUS_TRANSITIONS: Record<GameSessionStatus, GameSessionStatus[]> = {
  waiting: ['active', 'abandoned'],
  active: ['completed', 'forfeit', 'abandoned'],
  completed: [],
  forfeit: [],
  abandoned: [],
};

/**
 * Player info within a game session
 */
export interface GamePlayer {
  userId: string;
  teamId: string;
  teamName: string;
  isReady: boolean;
  isConnected: boolean;
  lastActiveAt: Date;
}

/**
 * Game state - the actual gameplay state
 * (Reexported from game-engine for convenience)
 */
export interface GameSessionState {
  inning: number;
  isTopOfInning: boolean;
  outs: number;
  scores: [number, number]; // [visitor, home]
  bases: [boolean, boolean, boolean];
  currentBatterIndex: [number, number]; // [visitor batter idx, home batter idx]
  isGameOver: boolean;
  winnerId?: string;
  endReason?: 'completed' | 'forfeit' | 'abandoned';
}

/**
 * Game move record - play-by-play history
 */
export interface GameMove {
  id: string;
  gameId: string;
  playerId: string;
  moveNumber: number;
  action: 'roll' | 'substitute' | 'forfeit';
  result?: {
    diceRolls?: [number, number];
    outcome?: string;
    runsScored?: number;
    description?: string;
  };
  createdAt: Date;
}

/**
 * Full game session record
 */
export interface GameSession {
  id: string;
  joinCode: string;
  status: GameSessionStatus;
  homePlayer: GamePlayer;
  visitorPlayer?: GamePlayer;
  gameState: GameSessionState;
  moves: GameMove[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
}

/**
 * Game session create request
 */
export interface CreateGameRequest {
  teamId: string;
}

/**
 * Game session join request
 */
export interface JoinGameRequest {
  joinCode: string;
  teamId: string;
}

/**
 * Game session response (API response format)
 */
export interface GameSessionResponse {
  id: string;
  joinCode: string;
  status: GameSessionStatus;
  homeTeam: {
    userId: string;
    teamId: string;
    teamName: string;
    isReady: boolean;
    isConnected: boolean;
  };
  visitorTeam?: {
    userId: string;
    teamId: string;
    teamName: string;
    isReady: boolean;
    isConnected: boolean;
  };
  gameState?: GameSessionState;
  isMyTurn?: boolean;
  createdAt: string;
  startedAt?: string;
}

// ============================================
// CONNECTION STATUS TYPES (Frontend-ready)
// ============================================

/**
 * Connection states for real-time features
 */
export type ConnectionStatus =
  | 'disconnected'  // Not connected to server
  | 'connecting'    // Attempting to connect
  | 'connected'     // Connected and authenticated
  | 'reconnecting'  // Lost connection, attempting to reconnect
  | 'error';        // Connection failed

/**
 * Connection metadata for UI display
 */
export interface ConnectionInfo {
  status: ConnectionStatus;
  latencyMs?: number;
  lastConnectedAt?: Date;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
  error?: {
    code: string;
    message: string;
    retriable: boolean;
  };
}

/**
 * App-level state for frontend consumption
 * Designed for Zustand/React Query integration
 */
export interface AppState {
  // Auth state
  isAuthenticated: boolean;
  userId?: string;

  // Connection state
  connection: ConnectionInfo;

  // Active game state (if in a game)
  activeGame?: {
    gameId: string;
    status: GameSessionStatus;
    isMyTurn: boolean;
    opponentConnected: boolean;
  };
}

// ============================================
// OPERATION RESULT TYPES (API Responses)
// ============================================

/**
 * Standardized API response wrapper
 * Provides consistent structure for all endpoints
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retriable?: boolean;
    retryAfter?: number;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
    duration?: number;
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// ============================================
// UTILITY FUNCTIONS FOR STATE MACHINE
// ============================================

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: GameSessionStatus,
  to: GameSessionStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Create initial game state
 */
export function createInitialGameState(): GameSessionState {
  return {
    inning: 1,
    isTopOfInning: true,
    outs: 0,
    scores: [0, 0],
    bases: [false, false, false],
    currentBatterIndex: [0, 0],
    isGameOver: false,
  };
}

/**
 * Generate a 6-character alphanumeric join code
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars: 0OI1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
