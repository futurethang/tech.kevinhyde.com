/**
 * Socket Service - WebSocket client for real-time game events
 */

import { io, Socket } from 'socket.io-client';
import type { GameState, PlayResult } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;

// Event handlers registry
type EventCallback<T = unknown> = (data: T) => void;
const eventHandlers: Map<string, Set<EventCallback>> = new Map();

// Get token from localStorage
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

/**
 * Connect to WebSocket server
 */
export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = getToken();

    if (!token) {
      reject(new Error('No auth token available'));
      return;
    }

    if (socket?.connected) {
      resolve();
      return;
    }

    socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      resolve();
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      emitLocalEvent('disconnected', { reason });
    });

    // Forward server events to registered handlers
    socket.on('game:state', (data: { state: GameState }) => {
      emitLocalEvent('game:state', data);
    });

    socket.on('game:roll-result', (data: PlayResult) => {
      emitLocalEvent('game:roll-result', data);
    });

    socket.on('game:ended', (data: { winnerId: string; loserId: string; reason: string }) => {
      emitLocalEvent('game:ended', data);
    });

    socket.on('opponent:connected', (data: { userId: string }) => {
      emitLocalEvent('opponent:connected', data);
    });

    socket.on('opponent:disconnected', (data: { userId: string; timeout: number }) => {
      emitLocalEvent('opponent:disconnected', data);
    });

    socket.on('error', (data: { error: string; message: string }) => {
      emitLocalEvent('error', data);
    });
  });
}

/**
 * Disconnect from WebSocket server
 */
export function disconnect(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Check if connected
 */
export function isConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Join a game room
 */
export function joinGame(gameId: string): void {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }
  socket.emit('game:join', { gameId });
}

/**
 * Roll dice (server handles the roll)
 */
export function rollDice(gameId: string): void {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }
  socket.emit('game:roll', { gameId });
}

/**
 * Forfeit the game
 */
export function forfeitGame(gameId: string): void {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }
  socket.emit('game:forfeit', { gameId });
}

// ============================================
// Event Registration
// ============================================

/**
 * Register an event handler
 */
export function on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, new Set());
  }
  eventHandlers.get(event)!.add(callback as EventCallback);

  // Return unsubscribe function
  return () => {
    eventHandlers.get(event)?.delete(callback as EventCallback);
  };
}

/**
 * Emit event to local handlers
 */
function emitLocalEvent(event: string, data: unknown): void {
  const handlers = eventHandlers.get(event);
  if (handlers) {
    handlers.forEach((handler) => handler(data));
  }
}

/**
 * Clear all event handlers
 */
export function clearHandlers(): void {
  eventHandlers.clear();
}
