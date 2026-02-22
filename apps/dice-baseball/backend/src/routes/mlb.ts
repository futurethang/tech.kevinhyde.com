import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { getPlayers, getPlayerById } from '../services/mlb-sync.js';
import type { ApiError } from '../types/index.js';
import type { PlayersQuery } from '../types/contracts/index';

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
const VALID_SORT_FIELDS = ['ops', 'avg', 'hr', 'rbi', 'era', 'whip', 'wins', 'name'] as const;

// Query validation schema
const getPlayersQuerySchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(),
  position: z.enum(VALID_POSITIONS).optional(),
  team: z.string().max(3).optional(),
  league: z.string().optional(),
  sort: z.enum(VALID_SORT_FIELDS).optional().default('ops'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().min(1).optional().default(20).transform((val) => Math.min(val, 100)),
  offset: z.coerce.number().min(0).optional().default(0),
  page: z.coerce.number().min(1).optional(),
  minOps: z.coerce.number().optional(),
  maxOps: z.coerce.number().optional(),
  minEra: z.coerce.number().optional(),
  maxEra: z.coerce.number().optional(),
  minHr: z.coerce.number().optional(),
  maxHr: z.coerce.number().optional(),
  minRbi: z.coerce.number().optional(),
  maxRbi: z.coerce.number().optional(),
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

  const parsedQuery = parseResult.data;
  const effectiveOffset =
    typeof parsedQuery.page === 'number'
      ? (parsedQuery.page - 1) * parsedQuery.limit
      : parsedQuery.offset;

  const query: PlayersQuery = {
    search: parsedQuery.q ?? parsedQuery.search,
    position: parsedQuery.position,
    team: parsedQuery.team,
    sort: parsedQuery.sort,
    order: parsedQuery.order,
    limit: parsedQuery.limit,
    offset: effectiveOffset,
    minOps: parsedQuery.minOps,
    maxOps: parsedQuery.maxOps,
    minEra: parsedQuery.minEra,
    maxEra: parsedQuery.maxEra,
    minHr: parsedQuery.minHr,
    maxHr: parsedQuery.maxHr,
    minRbi: parsedQuery.minRbi,
    maxRbi: parsedQuery.maxRbi,
  };

  const result = await getPlayers(query);

  return res.json({
    players: result.players,
    total: result.total,
    limit: query.limit,
    offset: effectiveOffset,
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
