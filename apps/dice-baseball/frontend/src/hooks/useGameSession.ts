/**
 * useGameSession - WebSocket lifecycle, event handlers, and game actions
 */

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import * as api from '../services/api';
import * as socket from '../services/socket';
import type { RollResultEvent } from '@dice-baseball/contracts';
import type { GameState, Game } from '../types';

const RESULT_HOLD_MS = 450;

export function useGameSession(gameId: string | undefined) {
  const user = useAuthStore((s) => s.user);

  const setGame = useGameStore((s) => s.setGame);
  const setGameState = useGameStore((s) => s.setGameState);
  const addPlayLogEntry = useGameStore((s) => s.addPlayLogEntry);
  const setConnected = useGameStore((s) => s.setConnected);
  const setMyTurn = useGameStore((s) => s.setMyTurn);
  const setOpponentConnected = useGameStore((s) => s.setOpponentConnected);
  const setRolling = useGameStore((s) => s.setRolling);
  const setLastRoll = useGameStore((s) => s.setLastRoll);
  const resetGame = useGameStore((s) => s.resetGame);

  const currentGame = useGameStore((s) => s.currentGame);
  const gameState = useGameStore((s) => s.gameState);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [isResultHold, setIsResultHold] = useState(false);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateTurn(state: GameState, game?: Game) {
    const currentGame = game || useGameStore.getState().currentGame;
    const currentUser = useAuthStore.getState().user;

    if (!currentGame || !currentUser) return;

    const isVisitor = currentUser.id === currentGame.visitorUserId;
    const myTurn = isVisitor ? state.isTopOfInning : !state.isTopOfInning;
    setMyTurn(myTurn);

    if (myTurn) {
      setError('');
    }
  }

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function init(id: string): Promise<(() => void) | undefined> {
      setLoading(true);
      try {
        const game = await api.getGameById(id);
        setGame(game);

        if (game.status === 'active' && game.visitorUserId) {
          setOpponentConnected(true);
          if (game.state) {
            setGameState(game.state);
            updateTurn(game.state, game);
          }
        }

        await socket.connect();
        setConnected(true);
        socket.clearHandlers();

        const unsubs = [
          socket.on<{ state: GameState }>('game:state', ({ state }) => {
            setGameState(state);
          }),
          socket.on<RollResultEvent>('game:roll-result', (result) => {
            setLastRoll(result.diceRolls, result.outcome);
            setGameState(result.newState);
            addPlayLogEntry(result);

            setIsResultHold(true);
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = setTimeout(() => {
              setIsResultHold(false);
              setRolling(false);
              holdTimeoutRef.current = null;
            }, RESULT_HOLD_MS);

            setError('');
          }),
          socket.on<{ winnerId: string }>('game:ended', ({ winnerId }) => {
            setGameEnded(true);
            setWinner(winnerId);
          }),
          socket.on<{ userId: string }>('opponent:connected', () => {
            setOpponentConnected(true);
          }),
          socket.on<{ userId: string; timeout: number }>('opponent:disconnected', ({ timeout }) => {
            setOpponentConnected(false, timeout);
          }),
          socket.on<{ error: string; message: string }>('error', ({ message }) => {
            setError(message);
            setRolling(false);
          }),
        ];

        setTimeout(() => socket.joinGame(id), 100);

        return () => unsubs.forEach((u) => u?.());
      } catch (err: unknown) {
        const errorObj = err as { message?: string };
        setError(errorObj.message || 'Failed to load game');
        return undefined;
      } finally {
        setLoading(false);
      }
    }

    if (gameId) {
      init(gameId).then((cleanupFn) => {
        if (cancelled) {
          cleanupFn?.();
          return;
        }
        cleanup = cleanupFn;
      });
    }

    return () => {
      cancelled = true;
      cleanup?.();
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      setIsResultHold(false);
      socket.clearHandlers();
      socket.disconnect();
      resetGame();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Zustand actions are stable; only re-run on gameId change
  }, [gameId]);

  // Update turn whenever game state changes
  useEffect(() => {
    if (currentGame && gameState && user) {
      const isVisitor = user.id === currentGame.visitorUserId;
      const myTurn = isVisitor ? gameState.isTopOfInning : !gameState.isTopOfInning;
      setMyTurn(myTurn);
      if (myTurn) setError('');
    }
  }, [gameState, currentGame, user, setMyTurn]);

  function handleRoll() {
    if (!gameId) return;
    const { isMyTurn, isRolling } = useGameStore.getState();
    if (!isMyTurn || isRolling || isResultHold) return;
    setRolling(true);
    socket.rollDice(gameId);
  }

  function handleForfeit() {
    if (!gameId) return;
    if (confirm('Are you sure you want to forfeit?')) {
      socket.forfeitGame(gameId);
    }
  }

  return {
    loading,
    error,
    gameEnded,
    winner,
    isResultHold,
    handleRoll,
    handleForfeit,
  };
}
