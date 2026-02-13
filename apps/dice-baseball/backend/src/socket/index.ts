/**
 * WebSocket Server - Dice Baseball V2
 * Real-time game event handling with Socket.io
 *
 * Phase 6: WebSocket Layer
 */

import { Server as SocketServer, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types/index.js';
import * as gameService from '../services/game-service.js';

// ============================================
// TYPES
// ============================================

export interface GameSocket extends Socket {
  userId?: string;
  gameId?: string;
}

interface JoinPayload {
  gameId: string;
}

interface RollPayload {
  gameId: string;
}

interface ForfeitPayload {
  gameId: string;
}

// ============================================
// CONSTANTS
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';
const DISCONNECT_TIMEOUT = 60000; // 60 seconds

// ============================================
// STATE
// ============================================

// Track which sockets are in which games
const gameRooms: Map<string, Set<string>> = new Map(); // gameId -> Set<socketId>
const socketToUser: Map<string, string> = new Map(); // socketId -> userId
const userToSocket: Map<string, string> = new Map(); // `${gameId}:${userId}` -> socketId
const disconnectTimers: Map<string, NodeJS.Timeout> = new Map(); // `${gameId}:${userId}` -> timer

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verify JWT token
 */
function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get opponent user ID for a game
 */
function getOpponentId(game: { homeUserId: string; visitorUserId: string | null }, userId: string): string | null {
  if (game.homeUserId === userId) {
    return game.visitorUserId;
  }
  return game.homeUserId;
}

/**
 * Check if it's the user's turn to roll
 */
function isUserTurn(
  game: { homeUserId: string; visitorUserId: string | null; state?: { isTopOfInning: boolean } },
  userId: string
): boolean {
  if (!game.state) return false;

  // Top of inning = visitor batting (visitor rolls)
  // Bottom of inning = home batting (home rolls)
  if (game.state.isTopOfInning) {
    return userId === game.visitorUserId;
  }
  return userId === game.homeUserId;
}

// ============================================
// SOCKET SERVER FACTORY
// ============================================

export function createSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ============================================
  // AUTHENTICATION MIDDLEWARE
  // ============================================

  io.use((socket: GameSocket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired token'));
    }

    socket.userId = payload.sub;
    next();
  });

  // ============================================
  // CONNECTION HANDLER
  // ============================================

  io.on('connection', (socket: GameSocket) => {
    const userId = socket.userId!;
    socketToUser.set(socket.id, userId);

    // ----------------------------------------
    // game:join - Join a game room
    // ----------------------------------------
    socket.on('game:join', async (payload: JoinPayload) => {
      try {
        const { gameId } = payload;
        const game = await gameService.getGameById(gameId);

        if (!game) {
          socket.emit('error', { error: 'not_found', message: 'Game not found' });
          return;
        }

        // Check if user is a participant
        if (game.homeUserId !== userId && game.visitorUserId !== userId) {
          socket.emit('error', { error: 'forbidden', message: 'You are not a participant in this game' });
          return;
        }

        // Check if this is the first time both players are connected
        const opponentId = getOpponentId(game, userId);
        console.log(`🎮 Player ${userId} joining game ${gameId}. Status: ${game.status}, OpponentId: ${opponentId}`);

        // Join the socket.io room
        socket.join(gameId);
        socket.gameId = gameId;

        // Track in our maps
        if (!gameRooms.has(gameId)) {
          gameRooms.set(gameId, new Set());
        }
        gameRooms.get(gameId)!.add(socket.id);

        const userKey = `${gameId}:${userId}`;
        userToSocket.set(userKey, socket.id);

        let shouldNotifyOpponentConnected = false;

        // Cancel any disconnect timer for this user
        const timer = disconnectTimers.get(userKey);
        if (timer) {
          clearTimeout(timer);
          disconnectTimers.delete(userKey);
          shouldNotifyOpponentConnected = true;
        }

        // Notify opponent if they're connected
        if (opponentId && shouldNotifyOpponentConnected) {
          const opponentSocketId = userToSocket.get(`${gameId}:${opponentId}`);
          if (opponentSocketId) {
            console.log(`📡 Notifying opponent ${opponentId} of player connection`);
            io.to(opponentSocketId).emit('opponent:connected', { userId });
          }
        }

        // Send current game state
        socket.emit('game:state', { state: game.state, sim: game.simulation });
      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', { error: 'internal_error', message: 'Failed to join game' });
      }
    });

    // ----------------------------------------
    // game:roll - Process a dice roll
    // ----------------------------------------
    socket.on('game:roll', async (payload: RollPayload) => {
      try {
        const { gameId } = payload;
        const game = await gameService.getGameById(gameId);

        if (!game) {
          socket.emit('error', { error: 'not_found', message: 'Game not found' });
          return;
        }

        // Check if it's this user's turn
        if (!isUserTurn(game, userId)) {
          socket.emit('error', { error: 'not_your_turn', message: "It's not your turn" });
          return;
        }

        // Roll the dice
        const diceRolls = await gameService.generateDiceRoll(gameId);

        // Record the move
        const result = await gameService.recordMove(gameId, userId, { diceRolls });

        // Save state
        await gameService.saveGameState(gameId, result.newState);

        // Check for game over
        if (result.newState.isGameOver) {
          const [visitorScore, homeScore] = result.newState.scores;
          const winnerId = homeScore > visitorScore ? game.homeUserId : game.visitorUserId!;
          const endResult = await gameService.endGame(gameId, winnerId);

          // Broadcast game ended
          io.to(gameId).emit('game:ended', {
            winnerId: endResult.winnerId,
            loserId: endResult.loserId,
            finalScore: result.newState.scores,
            reason: 'completed',
          });
        }

        // Broadcast result to all players in the room
        io.to(gameId).emit('game:roll-result', {
          diceRolls: result.diceRolls,
          outcome: result.outcome,
          runsScored: result.runsScored,
          outsRecorded: result.outsRecorded,
          description: result.description,
          batter: result.batter,
          pitcher: result.pitcher,
          newState: result.newState,
          sim: result.sim,
        });
      } catch (error) {
        console.error('Error processing roll:', error);
        socket.emit('error', { error: 'internal_error', message: 'Failed to process roll' });
      }
    });

    // ----------------------------------------
    // game:forfeit - Forfeit the game
    // ----------------------------------------
    socket.on('game:forfeit', async (payload: ForfeitPayload) => {
      try {
        const { gameId } = payload;
        const game = await gameService.getGameById(gameId);

        if (!game) {
          socket.emit('error', { error: 'not_found', message: 'Game not found' });
          return;
        }

        // Check if user is a participant
        if (game.homeUserId !== userId && game.visitorUserId !== userId) {
          socket.emit('error', { error: 'forbidden', message: 'You are not a participant in this game' });
          return;
        }

        // Determine winner (opponent)
        const winnerId = getOpponentId(game, userId);
        if (!winnerId) {
          socket.emit('error', { error: 'invalid_state', message: 'No opponent to forfeit to' });
          return;
        }

        // End the game
        const result = await gameService.endGame(gameId, winnerId);

        // Broadcast game ended
        io.to(gameId).emit('game:ended', {
          winnerId: result.winnerId,
          loserId: result.loserId,
          reason: 'forfeit',
        });
      } catch (error) {
        console.error('Error forfeiting game:', error);
        socket.emit('error', { error: 'internal_error', message: 'Failed to forfeit game' });
      }
    });

    // ----------------------------------------
    // disconnect - Handle player disconnection
    // ----------------------------------------
    socket.on('disconnect', async () => {
      const gameId = socket.gameId;

      if (gameId) {
        // Remove from game room
        const room = gameRooms.get(gameId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) {
            gameRooms.delete(gameId);
          }
        }

        const userKey = `${gameId}:${userId}`;
        userToSocket.delete(userKey);

        try {
          const game = await gameService.getGameById(gameId);
          if (game && game.status === 'active') {
            const opponentId = getOpponentId(game, userId);

            if (opponentId) {
              const opponentSocketId = userToSocket.get(`${gameId}:${opponentId}`);

              // Notify opponent
              if (opponentSocketId) {
                io.to(opponentSocketId).emit('opponent:disconnected', {
                  userId,
                  timeout: DISCONNECT_TIMEOUT,
                });
              }

              // Start forfeit timer
              const timer = setTimeout(async () => {
                disconnectTimers.delete(userKey);

                // Auto-forfeit
                try {
                  const currentGame = await gameService.getGameById(gameId);
                  if (currentGame && currentGame.status === 'active') {
                    const result = await gameService.endGame(gameId, opponentId);

                    io.to(gameId).emit('game:ended', {
                      winnerId: result.winnerId,
                      loserId: result.loserId,
                      reason: 'disconnect_timeout',
                    });
                  }
                } catch (err) {
                  console.error('Error auto-forfeiting:', err);
                }
              }, DISCONNECT_TIMEOUT);

              disconnectTimers.set(userKey, timer);
            }
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }

      socketToUser.delete(socket.id);
    });
  });

  return io;
}

/**
 * Clear all socket state (for testing)
 */
export function clearSocketState(): void {
  gameRooms.clear();
  socketToUser.clear();
  userToSocket.clear();

  // Clear all timers
  disconnectTimers.forEach((timer) => clearTimeout(timer));
  disconnectTimers.clear();
}
