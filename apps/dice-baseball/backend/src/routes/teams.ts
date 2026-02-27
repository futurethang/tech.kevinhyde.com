import { Router, type Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthenticatedRequest, ApiError } from '../types/index.js';
import {
  getTeams,
  getTeamById,
  createTeam,
  deleteTeam,
  updateRoster,
  updateBattingOrder,
} from '../services/team-service.js';
import {
  validateRoster,
  validateBattingOrder,
  validateBattingOrderArray,
  REQUIRED_POSITIONS,
  BATTING_POSITIONS,
  type RosterSlot,
} from '../services/roster-validation.js';

const router = Router();

// Validation schemas
const createTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required')
    .max(50, 'Team name must be 50 characters or less')
    .transform((val) => val.trim()),
});

const rosterSlotSchema = z.object({
  position: z.enum(REQUIRED_POSITIONS),
  mlbPlayerId: z.number().int().positive(),
  battingOrder: z.number().int().min(1).max(9).nullable(),
});

const updateRosterSchema = z.object({
  slots: z.array(rosterSlotSchema),
});

const updateBattingOrderSchema = z.object({
  order: z.array(z.enum(BATTING_POSITIONS)).length(9),
});

/**
 * GET /api/teams
 * Get current user's teams
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const teams = await getTeams(userId);

  return res.json({ teams });
});

/**
 * POST /api/teams
 * Create a new team
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  // Validate request body
  const parseResult = createTeamSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid team data',
      details: parseResult.error.flatten().fieldErrors,
    };
    return res.status(400).json(errorResponse);
  }

  const { name } = parseResult.data;
  const team = await createTeam(userId, name);

  return res.status(201).json(team);
});

/**
 * GET /api/teams/:id
 * Get team details with roster
 */
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const teamId = req.params.id;

  const team = await getTeamById(teamId);

  if (!team) {
    const errorResponse: ApiError = {
      error: 'not_found',
      message: 'Team not found',
    };
    return res.status(404).json(errorResponse);
  }

  if (team.userId !== userId) {
    const errorResponse: ApiError = {
      error: 'forbidden',
      message: 'You do not own this team',
    };
    return res.status(403).json(errorResponse);
  }

  return res.json(team);
});

/**
 * PUT /api/teams/:id/roster
 * Update entire roster
 */
router.put('/:id/roster', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const teamId = req.params.id;

  // Check team exists and user owns it
  const team = await getTeamById(teamId);

  if (!team) {
    const errorResponse: ApiError = {
      error: 'not_found',
      message: 'Team not found',
    };
    return res.status(404).json(errorResponse);
  }

  if (team.userId !== userId) {
    const errorResponse: ApiError = {
      error: 'forbidden',
      message: 'You do not own this team',
    };
    return res.status(403).json(errorResponse);
  }

  // Validate request body
  const parseResult = updateRosterSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid roster data',
      details: parseResult.error.flatten().fieldErrors,
    };
    return res.status(400).json(errorResponse);
  }

  const { slots } = parseResult.data;

  // Validate roster structure
  const rosterValidation = validateRoster(slots as RosterSlot[]);
  if (!rosterValidation.valid) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid roster',
      details: { errors: rosterValidation.errors },
    };
    return res.status(400).json(errorResponse);
  }

  // Validate batting order
  const battingValidation = validateBattingOrder(slots as RosterSlot[]);
  if (!battingValidation.valid) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid batting order',
      details: { errors: battingValidation.errors },
    };
    return res.status(400).json(errorResponse);
  }

  const updatedTeam = await updateRoster(teamId, slots as RosterSlot[]);

  return res.json({
    message: 'Roster updated',
    team: updatedTeam,
  });
});

/**
 * PUT /api/teams/:id/batting-order
 * Reorder batting lineup
 */
router.put(
  '/:id/batting-order',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const teamId = req.params.id;

    // Check team exists and user owns it
    const team = await getTeamById(teamId);

    if (!team) {
      const errorResponse: ApiError = {
        error: 'not_found',
        message: 'Team not found',
      };
      return res.status(404).json(errorResponse);
    }

    if (team.userId !== userId) {
      const errorResponse: ApiError = {
        error: 'forbidden',
        message: 'You do not own this team',
      };
      return res.status(403).json(errorResponse);
    }

    // Check roster is complete
    if (!team.rosterComplete) {
      const errorResponse: ApiError = {
        error: 'bad_request',
        message: 'Roster must be complete before reordering batting order',
      };
      return res.status(400).json(errorResponse);
    }

    // Validate request body
    const parseResult = updateBattingOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorResponse: ApiError = {
        error: 'validation_error',
        message: 'Invalid batting order data',
        details: parseResult.error.flatten().fieldErrors,
      };
      return res.status(400).json(errorResponse);
    }

    const { order } = parseResult.data;

    // Validate the order array
    const orderValidation = validateBattingOrderArray(order);
    if (!orderValidation.valid) {
      const errorResponse: ApiError = {
        error: 'validation_error',
        message: 'Invalid batting order',
        details: { errors: orderValidation.errors },
      };
      return res.status(400).json(errorResponse);
    }

    const result = await updateBattingOrder(teamId, order);

    return res.json(result);
  }
);

/**
 * PUT /api/teams/:id/draft
 * Save incomplete roster (draft)
 */
router.put('/:id/draft', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const teamId = req.params.id;

  // Check team exists and user owns it
  const team = await getTeamById(teamId);

  if (!team) {
    const errorResponse: ApiError = {
      error: 'not_found',
      message: 'Team not found',
    };
    return res.status(404).json(errorResponse);
  }

  if (team.userId !== userId) {
    const errorResponse: ApiError = {
      error: 'forbidden',
      message: 'You do not own this team',
    };
    return res.status(403).json(errorResponse);
  }

  // Parse roster slots (allow incomplete roster for drafts)
  const parseResult = updateRosterSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid roster data',
      details: parseResult.error.flatten().fieldErrors,
    };
    return res.status(400).json(errorResponse);
  }

  const { slots } = parseResult.data;
  
  // For drafts, we don't validate completeness
  // Just save whatever slots are provided
  const updatedTeam = await updateRoster(teamId, slots as RosterSlot[], false);

  return res.json({
    message: 'Draft saved',
    team: updatedTeam,
  });
});

/**
 * DELETE /api/teams/:id
 * Delete a team
 */
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const teamId = req.params.id;

  // Check team exists and user owns it
  const team = await getTeamById(teamId);

  if (!team) {
    const errorResponse: ApiError = {
      error: 'not_found',
      message: 'Team not found',
    };
    return res.status(404).json(errorResponse);
  }

  if (team.userId !== userId) {
    const errorResponse: ApiError = {
      error: 'forbidden',
      message: 'You do not own this team',
    };
    return res.status(403).json(errorResponse);
  }

  await deleteTeam(teamId);

  return res.status(204).end();
});

/**
 * POST /api/teams/:id/duplicate
 * Duplicate a team
 */
router.post('/:id/duplicate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const teamId = req.params.id;

  // Get the team to duplicate
  const originalTeam = await getTeamById(teamId);

  if (!originalTeam) {
    const errorResponse: ApiError = {
      error: 'not_found',
      message: 'Team not found',
    };
    return res.status(404).json(errorResponse);
  }

  if (originalTeam.userId !== userId) {
    const errorResponse: ApiError = {
      error: 'forbidden',
      message: 'You do not own this team',
    };
    return res.status(403).json(errorResponse);
  }

  // Parse new team name
  const parseResult = createTeamSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid team name',
      details: parseResult.error.flatten().fieldErrors,
    };
    return res.status(400).json(errorResponse);
  }

  const { name } = parseResult.data;

  // Create new team with the same roster
  const newTeam = await createTeam(userId, name);
  
  if (originalTeam.roster && originalTeam.roster.length > 0) {
    await updateRoster(newTeam.id, originalTeam.roster as RosterSlot[], false);
  }

  const duplicatedTeam = await getTeamById(newTeam.id);

  return res.status(201).json({
    message: 'Team duplicated successfully',
    team: duplicatedTeam,
  });
});

/**
 * PATCH /api/teams/reorder
 * Reorder teams list
 */
router.patch('/reorder', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  // Parse team IDs in new order
  const teamIdsSchema = z.object({
    teamIds: z.array(z.string()),
  });

  const parseResult = teamIdsSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorResponse: ApiError = {
      error: 'validation_error',
      message: 'Invalid team IDs',
      details: parseResult.error.flatten().fieldErrors,
    };
    return res.status(400).json(errorResponse);
  }

  const { teamIds } = parseResult.data;

  // Verify all teams belong to the user
  for (const teamId of teamIds) {
    const team = await getTeamById(teamId);
    if (!team || team.userId !== userId) {
      const errorResponse: ApiError = {
        error: 'forbidden',
        message: 'Invalid team in reorder list',
      };
      return res.status(403).json(errorResponse);
    }
  }

  // Note: Since we don't have a display order field in the database,
  // this endpoint is a placeholder. The frontend can maintain order locally.
  // In a real implementation, you'd update a displayOrder field for each team.

  return res.json({
    message: 'Team order updated',
    teamIds,
  });
});

export default router;
