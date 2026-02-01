/**
 * Game Store - Zustand state management for live games
 */

import { create } from 'zustand';
import type { Game, GameState, PlayResult, OutcomeType } from '../types';

interface PlayLogEntry {
  id: string;
  outcome: OutcomeType;
  description: string;
  runsScored: number;
  timestamp: number;
}

interface GameStoreState {
  // Current game
  currentGame: Game | null;
  gameState: GameState | null;
  playLog: PlayLogEntry[];

  // Connection state
  isConnected: boolean;
  isMyTurn: boolean;
  opponentConnected: boolean;
  disconnectTimeout: number | null;

  // Roll state
  isRolling: boolean;
  lastRoll: [number, number] | null;
  lastOutcome: OutcomeType | null;

  // Actions
  setGame: (game: Game) => void;
  setGameState: (state: GameState) => void;
  addPlayLogEntry: (result: PlayResult) => void;
  clearPlayLog: () => void;

  setConnected: (connected: boolean) => void;
  setMyTurn: (isMyTurn: boolean) => void;
  setOpponentConnected: (connected: boolean, timeout?: number | null) => void;

  setRolling: (rolling: boolean) => void;
  setLastRoll: (roll: [number, number], outcome: OutcomeType) => void;
  clearLastRoll: () => void;

  resetGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  currentGame: null,
  gameState: null,
  playLog: [],

  isConnected: false,
  isMyTurn: false,
  opponentConnected: false,
  disconnectTimeout: null,

  isRolling: false,
  lastRoll: null,
  lastOutcome: null,

  setGame: (game) => set({ currentGame: game, gameState: game.state || null }),

  setGameState: (state) => set({ gameState: state }),

  addPlayLogEntry: (result) =>
    set((state) => ({
      playLog: [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          outcome: result.outcome,
          description: result.description,
          runsScored: result.runsScored,
          timestamp: Date.now(),
        },
        ...state.playLog.slice(0, 19), // Keep last 20 entries
      ],
    })),

  clearPlayLog: () => set({ playLog: [] }),

  setConnected: (connected) => set({ isConnected: connected }),

  setMyTurn: (isMyTurn) => set({ isMyTurn }),

  setOpponentConnected: (connected, timeout = null) =>
    set({ opponentConnected: connected, disconnectTimeout: timeout }),

  setRolling: (rolling) => set({ isRolling: rolling }),

  setLastRoll: (roll, outcome) =>
    set({ lastRoll: roll, lastOutcome: outcome, isRolling: false }),

  clearLastRoll: () => set({ lastRoll: null, lastOutcome: null }),

  resetGame: () =>
    set({
      currentGame: null,
      gameState: null,
      playLog: [],
      isConnected: false,
      isMyTurn: false,
      opponentConnected: false,
      disconnectTimeout: null,
      isRolling: false,
      lastRoll: null,
      lastOutcome: null,
    }),
}));
