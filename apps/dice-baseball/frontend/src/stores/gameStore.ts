/**
 * Game Store - Zustand state management for live games
 */

import { create } from 'zustand';
import type { RollResultEvent } from '@dice-baseball/contracts';
import type { Game, GameState, OutcomeType } from '../types';

interface PlayLogEntry {
  id: string;
  outcome: OutcomeType;
  description: string;
  batterName: string;
  batterStats: {
    avg: number;
    ops: number;
  };
  pitcherName: string;
  pitcherStats: {
    era: number;
    whip: number;
    kPer9: number;
  };
  runsScored: number;
  timestamp: number;
  inning: number;
  isTopOfInning: boolean;
  turnIndex?: number;
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
  addPlayLogEntry: (result: RollResultEvent) => void;
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
    set((state) => {
      const turnIndex = result.sim?.turnIndex;
      if (
        typeof turnIndex === 'number' &&
        state.playLog.some((entry) => entry.turnIndex === turnIndex)
      ) {
        return state;
      }

      const nextEntry: PlayLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        outcome: result.outcome,
        description: formatPlayDescription(result),
        batterName: result.batter.name,
        batterStats: result.batterStats,
        pitcherName: result.pitcher.name,
        pitcherStats: result.pitcherStats,
        runsScored: result.runsScored,
        timestamp: Date.now(),
        inning: result.playContext.inning,
        isTopOfInning: result.playContext.isTopOfInning,
        turnIndex,
      };

      return {
        playLog: [...state.playLog, nextEntry].slice(-20),
      };
    }),

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

function formatPlayDescription(result: RollResultEvent): string {
  const outcomeText: Record<OutcomeType, string> = {
    homeRun: 'crushes a home run',
    triple: 'smokes a triple',
    double: 'drives a double',
    single: 'lines a single',
    walk: 'draws a walk',
    strikeout: 'strikes out',
    groundOut: 'grounds out',
    flyOut: 'flies out',
  };
  const colorTemplates: Record<OutcomeType, string[]> = {
    homeRun: ['What a no-doubter to deep left!', 'That ball was absolutely hammered!'],
    triple: ['He turns on the jets and takes third!', 'Great hustle stretches it into three!'],
    double: ['Laced into the gap for two bases!', 'Plenty of extra-base authority there!'],
    single: ['A clean base hit keeps the pressure on.', 'That finds grass and the lineup keeps moving.'],
    walk: ['Disciplined plate appearance earns first.', 'Patient at-bat and he takes the free base.'],
    strikeout: ['The pitcher wins that duel.', 'Big swing-and-miss in a key spot.'],
    groundOut: ['Routine play on the infield.', 'One pitch, one out on the ground.'],
    flyOut: ['Tracked down in the outfield.', 'Good carry, but right at a glove.'],
  };

  let description = `${result.batter.name} ${outcomeText[result.outcome]}.`;
  if (result.runsScored === 1) {
    description += ' 1 run scores.';
  } else if (result.runsScored > 1) {
    description += ` ${result.runsScored} runs score.`;
  }

  const options = colorTemplates[result.outcome];
  const idx =
    typeof result.sim?.turnIndex === 'number'
      ? result.sim.turnIndex % options.length
      : Date.now() % options.length;
  description += ` Booth: ${options[idx]}`;

  return description;
}
