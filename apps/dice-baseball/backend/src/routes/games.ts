/**
 * Game Routes - Dice Baseball V2
 * REST endpoints for game session management
 *
 * Phase 5: Game Session Management
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { getGameService } from '../services/game-session-service.js';
import type { AuthenticatedRequest, ApiResponse, GameSessionResponse, GameSessionStatus } from '../types/index.js';

const router = Router();

// ============================================
// REQUEST VALIDATION SCHEMAS
// ============================================

const createGameSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
});

const joinGameSchema = z.object({
  joinCode: z.string().length(6, 'Join code must be 6 characters'),
  teamId: z.string().min(1, 'Team ID is required'),
});

// ============================================
// HELPERS
// ============================================

/**
 * Map error codes to HTTP status codes
 */
function getStatusCode(errorCode: string): number {
  switch (errorCode) {
    case 'validation_error':
      return 400;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    default:
      return 500;
  }
}

/**
 * Transform GameSession to API response format
 */
function toGameResponse(session: {
  id: string;
  joinCode: string;
  status: GameSessionStatus;
  homePlayer: {
    userId: string;
    teamId: string;
    teamName: string;
    isReady: boolean;
    isConnected: boolean;
  };
  visitorPlayer?: {
    userId: string;
    teamId: string;
    teamName: string;
    isReady: boolean;
    isConnected: boolean;
  };
  gameState?: {
    inning: number;
    isTopOfInning: boolean;
    outs: number;
    scores: [number, number];
    bases: [boolean, boolean, boolean];
    currentBatterIndex: [number, number];
    isGameOver: boolean;
    winnerId?: string;
    endReason?: string;
  };
  createdAt: Date;
  startedAt?: Date;
}, isMyTurn?: boolean): GameSessionResponse {
  return {
    id: session.id,
    joinCode: session.joinCode,
    status: session.status,
    homeTeam: {
      userId: session.homePlayer.userId,
      teamId: session.homePlayer.teamId,
      teamName: session.homePlayer.teamName,
      isReady: session.homePlayer.isReady,
      isConnected: session.homePlayer.isConnected,
    },
    visitorTeam: session.visitorPlayer
      ? {
          userId: session.visitorPlayer.userId,
          teamId: session.visitorPlayer.teamId,
          teamName: session.visitorPlayer.teamName,
          isReady: session.visitorPlayer.isReady,
          isConnected: session.visitorPlayer.isConnected,
        }
      : undefined,
    gameState: session.gameState,
    isMyTurn,
    createdAt: session.createdAt.toISOString(),
    startedAt: session.startedAt?.toISOString(),
  };
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/games - Create a new game
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  // Validate request body
  const parseResult = createGameSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request data',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const userId = authReq.user!.id;
  const service = getGameService();

  const result = await service.createGame(userId, parseResult.data);

  if (!result.success) {
    const status = getStatusCode(result.error!.code);
    return res.status(status).json({
      success: false,
      error: result.error,
    });
  }

  return res.status(201).json({
    success: true,
    data: toGameResponse(result.data!),
  });
});

/**
 * POST /api/games/join - Join an existing game
 */
router.post('/join', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  // Validate request body
  const parseResult = joinGameSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request data',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const userId = authReq.user!.id;
  const service = getGameService();

  const result = await service.joinGame(userId, parseResult.data);

  if (!result.success) {
    const status = getStatusCode(result.error!.code);
    return res.status(status).json({
      success: false,
      error: result.error,
    });
  }

  return res.status(200).json({
    success: true,
    data: toGameResponse(result.data!),
  });
});

/**
 * GET /api/games/history - Get user's game history
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const service = getGameService();

  // Parse status filter from query string
  const statusParam = req.query.status as string | undefined;
  const statusFilter = statusParam
    ? (statusParam.split(',') as GameSessionStatus[])
    : undefined;

  const result = await service.getUserGames(userId, statusFilter ? { status: statusFilter } : undefined);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: result.error,
    });
  }

  return res.status(200).json({
    success: true,
    data: result.data!.map((session) => toGameResponse(session)),
  });
});

/**
 * GET /api/games/:id - Get a specific game
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const gameId = req.params.id;
  const service = getGameService();

  const result = await service.getGame(gameId, userId);

  if (!result.success) {
    const status = getStatusCode(result.error!.code);
    return res.status(status).json({
      success: false,
      error: result.error,
    });
  }

  const isMyTurn = service.isPlayerTurn(result.data!, userId);

  return res.status(200).json({
    success: true,
    data: toGameResponse(result.data!, isMyTurn),
  });
});

/**
 * DELETE /api/games/:id - Cancel a waiting game
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const gameId = req.params.id;
  const service = getGameService();

  const result = await service.cancelGame(gameId, userId);

  if (!result.success) {
    const status = getStatusCode(result.error!.code);
    return res.status(status).json({
      success: false,
      error: result.error,
    });
  }

  return res.status(200).json({
    success: true,
    data: toGameResponse(result.data!),
  });
});

/**
 * POST /api/games/:id/forfeit - Forfeit an active game
 */
router.post('/:id/forfeit', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const gameId = req.params.id;
  const service = getGameService();

  const result = await service.forfeitGame(gameId, userId);

  if (!result.success) {
    const status = getStatusCode(result.error!.code);
    return res.status(status).json({
      success: false,
      error: result.error,
    });
  }

  return res.status(200).json({
    success: true,
    data: toGameResponse(result.data!),
  });
});

export default router;
