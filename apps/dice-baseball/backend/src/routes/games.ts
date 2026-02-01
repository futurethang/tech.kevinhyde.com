/**
 * Game Routes - Dice Baseball V2
 * REST API endpoints for game session management
 *
 * Phase 5: Game Session Management
 */

import { Router, type Response } from 'express';
import type { AuthenticatedRequest, ApiError } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';
import * as gameService from '../services/game-service.js';
import * as teamService from '../services/team-service.js';

const router = Router();

// All game routes require authentication
router.use(authMiddleware);

/**
 * POST /api/games
 * Create a new game session
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const { teamId } = req.body;

    // Validate team ID
    if (!teamId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Team ID is required',
      });
    }

    // Get the team
    const team = await teamService.getTeamById(teamId);

    if (!team) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Team not found',
      });
    }

    // Verify team ownership
    if (team.userId !== userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not own this team',
      });
    }

    // Verify roster is complete
    if (!team.rosterComplete) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Team roster must be complete to start a game',
      });
    }

    // Create the game
    const game = await gameService.createGame(userId, teamId);

    return res.status(201).json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to create game',
    } as ApiError);
  }
});

/**
 * POST /api/games/join
 * Join an existing game with a join code
 */
router.post('/join', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const { joinCode, teamId } = req.body;

    // Validate inputs
    if (!joinCode || !teamId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Join code and team ID are required',
      });
    }

    // Get the team
    const team = await teamService.getTeamById(teamId);

    if (!team) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Team not found',
      });
    }

    // Verify team ownership
    if (team.userId !== userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not own this team',
      });
    }

    // Verify roster is complete
    if (!team.rosterComplete) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Team roster must be complete to join a game',
      });
    }

    // Find the game by join code
    const game = await gameService.getGameByJoinCode(joinCode);

    if (!game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found with that join code',
      });
    }

    // Check if game is still waiting
    if (game.status !== 'waiting') {
      return res.status(400).json({
        error: 'game_already_started',
        message: 'This game has already started',
      });
    }

    // Prevent joining own game
    if (game.homeUserId === userId) {
      return res.status(400).json({
        error: 'cannot_join_own_game',
        message: 'You cannot join your own game',
      });
    }

    // Join the game
    const updatedGame = await gameService.joinGame(game.id, userId, teamId);

    return res.status(200).json(updatedGame);
  } catch (error) {
    console.error('Error joining game:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to join game',
    } as ApiError);
  }
});

/**
 * GET /api/games
 * Get all active/waiting games for the current user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const games = await gameService.getUserActiveGames(userId);

    return res.status(200).json({ games });
  } catch (error) {
    console.error('Error getting games:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get games',
    } as ApiError);
  }
});

/**
 * GET /api/games/:id
 * Get a specific game by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const { id } = req.params;
    const game = await gameService.getGameById(id);

    if (!game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found',
      });
    }

    // Verify user is a participant
    if (game.homeUserId !== userId && game.visitorUserId !== userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You are not a participant in this game',
      });
    }

    return res.status(200).json(game);
  } catch (error) {
    console.error('Error getting game:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get game',
    } as ApiError);
  }
});

/**
 * POST /api/games/:id/move
 * Record a move (at-bat) in the game
 */
router.post('/:id/move', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const { id } = req.params;
    const { diceRolls } = req.body;

    // Validate dice rolls
    if (
      !diceRolls ||
      !Array.isArray(diceRolls) ||
      diceRolls.length !== 2 ||
      !diceRolls.every((d: unknown) => typeof d === 'number' && d >= 1 && d <= 6)
    ) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid dice rolls - must be array of 2 numbers between 1-6',
      });
    }

    const game = await gameService.getGameById(id);

    if (!game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found',
      });
    }

    // Verify user is a participant
    if (game.homeUserId !== userId && game.visitorUserId !== userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You are not a participant in this game',
      });
    }

    // Verify game is active
    if (game.status !== 'active') {
      return res.status(400).json({
        error: 'game_not_active',
        message: 'Game is not active',
      });
    }

    // Record the move
    const result = await gameService.recordMove(id, userId, { diceRolls: diceRolls as [number, number] });

    // Save game state
    await gameService.saveGameState(id, result.newState);

    // Check if game is over
    if (result.newState.isGameOver) {
      // Determine winner
      const [visitorScore, homeScore] = result.newState.scores;
      const winnerId = homeScore > visitorScore ? game.homeUserId : game.visitorUserId!;
      await gameService.endGame(id, winnerId);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error recording move:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to record move',
    } as ApiError);
  }
});

/**
 * POST /api/games/:id/forfeit
 * Forfeit the game
 */
router.post('/:id/forfeit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const { id } = req.params;
    const game = await gameService.getGameById(id);

    if (!game) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Game not found',
      });
    }

    // Verify user is a participant
    if (game.homeUserId !== userId && game.visitorUserId !== userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You are not a participant in this game',
      });
    }

    // Verify game is active
    if (game.status !== 'active') {
      return res.status(400).json({
        error: 'game_not_active',
        message: 'Game is not active',
      });
    }

    // Determine winner (opponent of the one forfeiting)
    const winnerId = game.homeUserId === userId ? game.visitorUserId! : game.homeUserId;

    // End the game
    const result = await gameService.endGame(id, winnerId);

    return res.status(200).json({
      message: 'Game forfeited',
      winnerId: result.winnerId,
      loserId: result.loserId,
    });
  } catch (error) {
    console.error('Error forfeiting game:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to forfeit game',
    } as ApiError);
  }
});

export default router;
