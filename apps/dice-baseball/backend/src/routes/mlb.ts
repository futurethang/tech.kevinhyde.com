import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { getPlayers, getPlayerById } from '../services/mlb-sync.js';
import type { ApiError } from '../types/index.js';

const router = Router();

// Valid positions for filtering
const VALID_POSITIONS = [
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'DH',
  'SP',
  'RP',
  'P',
] as const;

// Valid sort fields
const VALID_SORT_FIELDS = ['ops', 'avg', 'hr', 'rbi', 'era', 'whip', 'wins'] as const;

// Query validation schema
const getPlayersQuerySchema = z.object({
  q: z.string().optional(),
  position: z.enum(VALID_POSITIONS).optional(),
  team: z.string().max(3).optional(),
  sort: z.enum(VALID_SORT_FIELDS).optional().default('ops'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().min(1).optional().default(20).transform((val) => Math.min(val, 100)),
  offset: z.coerce.number().min(0).optional().default(0),
});

// Player ID validation
const playerIdSchema = z.coerce.number().int().positive();

/**
 * GET /api/mlb/players
 * Search and filter MLB players
 */
router.get('/players', authMiddleware, async (req: Request, res: Response<unknown>) => {
  // Validate query params
  const parseResult = getPlayersQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid query parameters',
      details: parseResult.error.flatten().fieldErrors,
    };
    return res.status(400).json(errorResponse);
  }

  const { q, position, team, sort, order, limit, offset } = parseResult.data;

  const result = await getPlayers({
    search: q,
    position,
    team,
    sort,
    order,
    limit,
    offset,
  });

  return res.json({
    players: result.players,
    total: result.total,
    limit,
    offset,
  });
});

/**
 * GET /api/mlb/players/:mlbId
 * Get single player details
 */
router.get('/players/:mlbId', authMiddleware, async (req: Request, res: Response<unknown>) => {
  // Validate player ID
  const parseResult = playerIdSchema.safeParse(req.params.mlbId);

  if (!parseResult.success) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid player ID format',
    };
    return res.status(400).json(errorResponse);
  }

  const mlbId = parseResult.data;
  const player = await getPlayerById(mlbId);

  if (!player) {
    const errorResponse: ApiError = {
      error: 'not_found',
      message: 'Player not found',
    };
    return res.status(404).json(errorResponse);
  }

  return res.json(player);
});

export default router;
