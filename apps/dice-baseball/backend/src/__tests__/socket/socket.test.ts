import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createServer, type Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { createTestToken, createExpiredToken, createInvalidToken } from '../helpers/auth.js';
import { createSocketServer, type GameSocket } from '../../socket/index.js';
import * as gameService from '../../services/game-service.js';

// Mock game service
vi.mock('../../services/game-service.js', () => ({
  getGameById: vi.fn(),
  saveGameState: vi.fn(),
  recordMove: vi.fn(),
  endGame: vi.fn(),
}));

console.log('🧪 Starting test suite...');

// Test utilities
const TEST_PORT = 3100 + Math.floor(Math.random() * 100);

interface TestContext {
  httpServer: HttpServer;
  io: SocketServer;
  cleanup: () => Promise<void>;
}

async function createTestServer(): Promise<TestContext> {
  const httpServer = createServer();
  const io = createSocketServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(TEST_PORT, () => resolve());
  });

  return {
    httpServer,
    io,
    cleanup: async () => {
      io.close();
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
}

function createTestClient(token?: string): ClientSocket {
  const url = `http://localhost:${TEST_PORT}`;
  return ioc(url, {
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeout = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForConnection(socket: ClientSocket, timeout = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('WebSocket Authentication', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('accepts valid JWT', async () => {
    const token = createTestToken({ id: 'user-123' });
    const client = createTestClient(token);

    await waitForConnection(client);

    expect(client.connected).toBe(true);

    client.disconnect();
  });

  it('rejects invalid JWT', async () => {
    const token = createInvalidToken({ id: 'user-123' });
    const client = createTestClient(token);

    await expect(waitForConnection(client)).rejects.toThrow();

    client.disconnect();
  });

  it('rejects expired JWT', async () => {
    const token = createExpiredToken({ id: 'user-123' });
    const client = createTestClient(token);

    await expect(waitForConnection(client)).rejects.toThrow();

    client.disconnect();
  });

  it('rejects connection without token', async () => {
    const client = createTestClient();

    await expect(waitForConnection(client)).rejects.toThrow();

    client.disconnect();
  });
});

describe('Game Room Events', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('game:join', () => {
    it('joins game room and receives state', async () => {
      const token = createTestToken({ id: 'user-123' });
      const client = createTestClient(token);

      await waitForConnection(client);

      const mockGame = {
        id: 'game-uuid',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
        status: 'active',
        state: {
          inning: 1,
          isTopOfInning: true,
          outs: 0,
          scores: [0, 0],
          bases: [false, false, false],
          currentBatterIndex: 0,
        },
      };

      vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

      client.emit('game:join', { gameId: 'game-uuid' });

      const response = await waitForEvent<{ state: unknown }>(client, 'game:state');

      expect(response.state).toEqual(mockGame.state);

      client.disconnect();
    });

    it('rejects join for non-participant', async () => {
      const token = createTestToken({ id: 'user-999' });
      const client = createTestClient(token);

      await waitForConnection(client);

      const mockGame = {
        id: 'game-uuid',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
        status: 'active',
      };

      vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

      client.emit('game:join', { gameId: 'game-uuid' });

      const error = await waitForEvent<{ error: string }>(client, 'error');

      expect(error.error).toBe('forbidden');

      client.disconnect();
    });

    it('rejects join for unknown game', async () => {
      const token = createTestToken({ id: 'user-123' });
      const client = createTestClient(token);

      await waitForConnection(client);

      vi.mocked(gameService.getGameById).mockResolvedValue(null);

      client.emit('game:join', { gameId: 'unknown-game' });

      const error = await waitForEvent<{ error: string }>(client, 'error');

      expect(error.error).toBe('not_found');

      client.disconnect();
    });
  });

  describe('game:roll', () => {
    it('processes roll when player turn', async () => {
      const tokenHome = createTestToken({ id: 'user-123' });
      const clientHome = createTestClient(tokenHome);

      await waitForConnection(clientHome);

      const mockGame = {
        id: 'game-uuid',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
        status: 'active',
        state: {
          inning: 1,
          isTopOfInning: false, // Home team batting
          outs: 0,
          scores: [0, 0],
          bases: [false, false, false],
          currentBatterIndex: 0,
        },
      };

      vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

      // Join the game
      clientHome.emit('game:join', { gameId: 'game-uuid' });
      await waitForEvent(clientHome, 'game:state');

      const moveResult = {
        diceRolls: [4, 5],
        outcome: 'single',
        runsScored: 0,
        outsRecorded: 0,
        description: 'Batter singles!',
        newState: {
          inning: 1,
          isTopOfInning: false,
          outs: 0,
          scores: [0, 0],
          bases: [true, false, false],
          currentBatterIndex: 1,
        },
      };

      vi.mocked(gameService.recordMove).mockResolvedValue(moveResult as never);
      vi.mocked(gameService.saveGameState).mockResolvedValue(undefined);

      clientHome.emit('game:roll', { gameId: 'game-uuid' });

      const result = await waitForEvent<{
        outcome: string;
        diceRolls: [number, number];
      }>(clientHome, 'game:roll-result');

      expect(result.outcome).toBe('single');
      expect(gameService.recordMove).toHaveBeenCalled();

      clientHome.disconnect();
    });

    it('rejects roll when not player turn', async () => {
      const tokenVisitor = createTestToken({ id: 'user-456' });
      const clientVisitor = createTestClient(tokenVisitor);

      await waitForConnection(clientVisitor);

      const mockGame = {
        id: 'game-uuid',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
        status: 'active',
        state: {
          inning: 1,
          isTopOfInning: false, // Home team batting, so visitor can't roll
          outs: 0,
          scores: [0, 0],
          bases: [false, false, false],
          currentBatterIndex: 0,
        },
      };

      vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

      clientVisitor.emit('game:join', { gameId: 'game-uuid' });
      await waitForEvent(clientVisitor, 'game:state');

      clientVisitor.emit('game:roll', { gameId: 'game-uuid' });

      const error = await waitForEvent<{ error: string }>(clientVisitor, 'error');

      expect(error.error).toBe('not_your_turn');

      clientVisitor.disconnect();
    });

    it('broadcasts result to both players', async () => {
      const tokenHome = createTestToken({ id: 'user-123' });
      const tokenVisitor = createTestToken({ id: 'user-456' });
      const clientHome = createTestClient(tokenHome);
      const clientVisitor = createTestClient(tokenVisitor);

      await Promise.all([waitForConnection(clientHome), waitForConnection(clientVisitor)]);

      const mockGame = {
        id: 'game-uuid',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
        status: 'active',
        state: {
          inning: 1,
          isTopOfInning: true, // Visitor batting
          outs: 0,
          scores: [0, 0],
          bases: [false, false, false],
          currentBatterIndex: 0,
        },
      };

      vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

      // Both join the game
      clientHome.emit('game:join', { gameId: 'game-uuid' });
      clientVisitor.emit('game:join', { gameId: 'game-uuid' });

      await Promise.all([waitForEvent(clientHome, 'game:state'), waitForEvent(clientVisitor, 'game:state')]);

      const moveResult = {
        diceRolls: [6, 6],
        outcome: 'homeRun',
        runsScored: 1,
        outsRecorded: 0,
        description: 'Home run!',
        newState: {
          inning: 1,
          isTopOfInning: true,
          outs: 0,
          scores: [1, 0],
          bases: [false, false, false],
          currentBatterIndex: 1,
        },
      };

      vi.mocked(gameService.recordMove).mockResolvedValue(moveResult as never);
      vi.mocked(gameService.saveGameState).mockResolvedValue(undefined);

      // Visitor rolls (it's top of inning, visitor bats)
      clientVisitor.emit('game:roll', { gameId: 'game-uuid' });

      // Both should receive the result
      const [homeResult, visitorResult] = await Promise.all([
        waitForEvent<{ outcome: string }>(clientHome, 'game:roll-result'),
        waitForEvent<{ outcome: string }>(clientVisitor, 'game:roll-result'),
      ]);

      expect(homeResult.outcome).toBe('homeRun');
      expect(visitorResult.outcome).toBe('homeRun');

      clientHome.disconnect();
      clientVisitor.disconnect();
    });

    it('updates game state', async () => {
      const token = createTestToken({ id: 'user-456' });
      const client = createTestClient(token);

      await waitForConnection(client);

      const mockGame = {
        id: 'game-uuid',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
        status: 'active',
        state: {
          inning: 1,
          isTopOfInning: true, // Visitor batting
          outs: 0,
          scores: [0, 0],
          bases: [false, false, false],
          currentBatterIndex: 0,
        },
      };

      vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

      client.emit('game:join', { gameId: 'game-uuid' });
      await waitForEvent(client, 'game:state');

      const newState = {
        inning: 1,
        isTopOfInning: true,
        outs: 1,
        scores: [0, 0],
        bases: [false, false, false],
        currentBatterIndex: 1,
      };

      const moveResult = {
        diceRolls: [3, 4],
        outcome: 'groundOut',
        runsScored: 0,
        outsRecorded: 1,
        description: 'Ground out!',
        newState,
      };

      vi.mocked(gameService.recordMove).mockResolvedValue(moveResult as never);
      vi.mocked(gameService.saveGameState).mockResolvedValue(undefined);

      client.emit('game:roll', { gameId: 'game-uuid' });

      const result = await waitForEvent<{ newState: typeof newState }>(client, 'game:roll-result');

      expect(result.newState.outs).toBe(1);
      expect(gameService.saveGameState).toHaveBeenCalledWith('game-uuid', newState);

      client.disconnect();
    });
  });

  describe('game:forfeit', () => {
    it('ends game with opponent as winner', async () => {
      const token = createTestToken({ id: 'user-123' });
      const client = createTestClient(token);

      await waitForConnection(client);

      const mockGame = {
        id: 'game-uuid',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
        status: 'active',
        state: {
          inning: 5,
          isTopOfInning: true,
          outs: 2,
          scores: [3, 1],
          bases: [false, false, false],
          currentBatterIndex: 4,
        },
      };

      vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

      client.emit('game:join', { gameId: 'game-uuid' });
      await waitForEvent(client, 'game:state');

      vi.mocked(gameService.endGame).mockResolvedValue({
        winnerId: 'user-456',
        loserId: 'user-123',
        reason: 'forfeit',
      } as never);

      client.emit('game:forfeit', { gameId: 'game-uuid' });

      const result = await waitForEvent<{ winnerId: string }>(client, 'game:ended');

      expect(result.winnerId).toBe('user-456');
      expect(gameService.endGame).toHaveBeenCalledWith('game-uuid', 'user-456');

      client.disconnect();
    });

    it('notifies opponent of forfeit', async () => {
      const tokenHome = createTestToken({ id: 'user-123' });
      const tokenVisitor = createTestToken({ id: 'user-456' });
      const clientHome = createTestClient(tokenHome);
      const clientVisitor = createTestClient(tokenVisitor);

      await Promise.all([waitForConnection(clientHome), waitForConnection(clientVisitor)]);

      const mockGame = {
        id: 'game-uuid',
        homeUserId: 'user-123',
        visitorUserId: 'user-456',
        status: 'active',
        state: {
          inning: 3,
          isTopOfInning: false,
          outs: 0,
          scores: [2, 0],
          bases: [false, false, false],
          currentBatterIndex: 0,
        },
      };

      vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

      clientHome.emit('game:join', { gameId: 'game-uuid' });
      clientVisitor.emit('game:join', { gameId: 'game-uuid' });

      await Promise.all([waitForEvent(clientHome, 'game:state'), waitForEvent(clientVisitor, 'game:state')]);

      vi.mocked(gameService.endGame).mockResolvedValue({
        winnerId: 'user-123',
        loserId: 'user-456',
        reason: 'forfeit',
      } as never);

      // Visitor forfeits
      clientVisitor.emit('game:forfeit', { gameId: 'game-uuid' });

      // Both should receive game:ended
      const [homeEnded, visitorEnded] = await Promise.all([
        waitForEvent<{ winnerId: string; reason: string }>(clientHome, 'game:ended'),
        waitForEvent<{ winnerId: string; reason: string }>(clientVisitor, 'game:ended'),
      ]);

      expect(homeEnded.winnerId).toBe('user-123');
      expect(homeEnded.reason).toBe('forfeit');
      expect(visitorEnded.winnerId).toBe('user-123');

      clientHome.disconnect();
      clientVisitor.disconnect();
    });
  });
});

describe('Disconnection Handling', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    ctx = await createTestServer();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await ctx.cleanup();
  });

  it('notifies opponent of disconnect', async () => {
    vi.useRealTimers(); // Need real timers for this test

    const tokenHome = createTestToken({ id: 'user-123' });
    const tokenVisitor = createTestToken({ id: 'user-456' });
    const clientHome = createTestClient(tokenHome);
    const clientVisitor = createTestClient(tokenVisitor);

    await Promise.all([waitForConnection(clientHome), waitForConnection(clientVisitor)]);

    const mockGame = {
      id: 'game-uuid',
      homeUserId: 'user-123',
      visitorUserId: 'user-456',
      status: 'active',
      state: {
        inning: 1,
        isTopOfInning: true,
        outs: 0,
        scores: [0, 0],
        bases: [false, false, false],
        currentBatterIndex: 0,
      },
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

    clientHome.emit('game:join', { gameId: 'game-uuid' });
    clientVisitor.emit('game:join', { gameId: 'game-uuid' });

    await Promise.all([waitForEvent(clientHome, 'game:state'), waitForEvent(clientVisitor, 'game:state')]);

    // Set up listener before disconnect
    const disconnectPromise = waitForEvent<{ userId: string }>(clientVisitor, 'opponent:disconnected');

    // Home disconnects
    clientHome.disconnect();

    // Visitor should be notified
    const disconnectEvent = await disconnectPromise;

    expect(disconnectEvent.userId).toBe('user-123');

    clientVisitor.disconnect();
  });

  it('starts 60-second timer on disconnect', async () => {
    vi.useRealTimers();

    const tokenHome = createTestToken({ id: 'user-123' });
    const tokenVisitor = createTestToken({ id: 'user-456' });
    const clientHome = createTestClient(tokenHome);
    const clientVisitor = createTestClient(tokenVisitor);

    await Promise.all([waitForConnection(clientHome), waitForConnection(clientVisitor)]);

    const mockGame = {
      id: 'game-uuid',
      homeUserId: 'user-123',
      visitorUserId: 'user-456',
      status: 'active',
      state: {
        inning: 1,
        isTopOfInning: true,
        outs: 0,
        scores: [0, 0],
        bases: [false, false, false],
        currentBatterIndex: 0,
      },
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

    clientHome.emit('game:join', { gameId: 'game-uuid' });
    clientVisitor.emit('game:join', { gameId: 'game-uuid' });

    await Promise.all([waitForEvent(clientHome, 'game:state'), waitForEvent(clientVisitor, 'game:state')]);

    const disconnectPromise = waitForEvent<{ timeout: number }>(clientVisitor, 'opponent:disconnected');

    clientHome.disconnect();

    const event = await disconnectPromise;

    expect(event.timeout).toBe(60000); // 60 seconds

    clientVisitor.disconnect();
  });

  it('cancels timer on reconnect', async () => {
    vi.useRealTimers();

    const tokenHome = createTestToken({ id: 'user-123' });
    const tokenVisitor = createTestToken({ id: 'user-456' });
    let clientHome = createTestClient(tokenHome);
    const clientVisitor = createTestClient(tokenVisitor);

    await Promise.all([waitForConnection(clientHome), waitForConnection(clientVisitor)]);

    const mockGame = {
      id: 'game-uuid',
      homeUserId: 'user-123',
      visitorUserId: 'user-456',
      status: 'active',
      state: {
        inning: 1,
        isTopOfInning: true,
        outs: 0,
        scores: [0, 0],
        bases: [false, false, false],
        currentBatterIndex: 0,
      },
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

    clientHome.emit('game:join', { gameId: 'game-uuid' });
    clientVisitor.emit('game:join', { gameId: 'game-uuid' });

    await Promise.all([waitForEvent(clientHome, 'game:state'), waitForEvent(clientVisitor, 'game:state')]);

    const disconnectPromise = waitForEvent(clientVisitor, 'opponent:disconnected');

    // Home disconnects
    clientHome.disconnect();

    await disconnectPromise;

    // Set up listener for reconnect
    const reconnectPromise = waitForEvent<{ userId: string }>(clientVisitor, 'opponent:connected');

    // Home reconnects
    clientHome = createTestClient(tokenHome);
    await waitForConnection(clientHome);

    clientHome.emit('game:join', { gameId: 'game-uuid' });

    const reconnectEvent = await reconnectPromise;

    expect(reconnectEvent.userId).toBe('user-123');

    clientHome.disconnect();
    clientVisitor.disconnect();
  });

  it('restores game state on reconnect', async () => {
    vi.useRealTimers();

    const tokenHome = createTestToken({ id: 'user-123' });
    let clientHome = createTestClient(tokenHome);

    await waitForConnection(clientHome);

    const mockGame = {
      id: 'game-uuid',
      homeUserId: 'user-123',
      visitorUserId: 'user-456',
      status: 'active',
      state: {
        inning: 5,
        isTopOfInning: false,
        outs: 2,
        scores: [3, 4],
        bases: [true, false, true],
        currentBatterIndex: 7,
      },
    };

    vi.mocked(gameService.getGameById).mockResolvedValue(mockGame as never);

    clientHome.emit('game:join', { gameId: 'game-uuid' });
    await waitForEvent(clientHome, 'game:state');

    // Disconnect
    clientHome.disconnect();

    // Reconnect
    clientHome = createTestClient(tokenHome);
    await waitForConnection(clientHome);

    clientHome.emit('game:join', { gameId: 'game-uuid' });

    const stateEvent = await waitForEvent<{ state: typeof mockGame.state }>(clientHome, 'game:state');

    // State should be restored
    expect(stateEvent.state.inning).toBe(5);
    expect(stateEvent.state.scores).toEqual([3, 4]);

    clientHome.disconnect();
  });
});

console.log('✅ Test suite completed');
