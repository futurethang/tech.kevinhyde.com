/**
 * Game Page - Live multiplayer game view
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import * as api from '../services/api';
import * as socket from '../services/socket';
import type { GameState, PlayResult, OutcomeType } from '../types';

export function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentGame,
    gameState,
    playLog,
    isMyTurn,
    opponentConnected,
    disconnectTimeout,
    isRolling,
    lastRoll,
    lastOutcome,
    setGame,
    setGameState,
    addPlayLogEntry,
    setConnected,
    setMyTurn,
    setOpponentConnected,
    setRolling,
    setLastRoll,
    resetGame,
  } = useGameStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (gameId) {
      initializeGame(gameId);
    }

    return () => {
      socket.disconnect();
      resetGame();
    };
  }, [gameId]);

  async function initializeGame(id: string) {
    setLoading(true);
    try {
      // Load game data
      const game = await api.getGameById(id);
      setGame(game);

      // Connect to WebSocket
      await socket.connect();
      setConnected(true);

      // Register event handlers
      socket.on<{ state: GameState }>('game:state', ({ state }) => {
        setGameState(state);
        updateTurn(state);
      });

      socket.on<PlayResult>('game:roll-result', (result) => {
        setLastRoll(result.diceRolls, result.outcome);
        setGameState(result.newState);
        addPlayLogEntry(result);
        updateTurn(result.newState);
      });

      socket.on<{ winnerId: string; reason: string }>('game:ended', ({ winnerId }) => {
        setGameEnded(true);
        setWinner(winnerId);
      });

      socket.on<{ userId: string }>('opponent:connected', () => {
        setOpponentConnected(true);
      });

      socket.on<{ userId: string; timeout: number }>('opponent:disconnected', ({ timeout }) => {
        setOpponentConnected(false, timeout);
      });

      socket.on<{ error: string; message: string }>('error', ({ message }) => {
        setError(message);
      });

      // Join the game room
      socket.joinGame(id);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }

  function updateTurn(state: GameState) {
    if (!currentGame || !user) return;
    // Top of inning = visitor batting (visitor's turn)
    // Bottom = home batting (home's turn)
    const isVisitor = user.id === currentGame.visitorUserId;
    const isTopInning = state.isTopOfInning;
    setMyTurn(isVisitor ? isTopInning : !isTopInning);
  }

  function handleRoll() {
    if (!gameId || !isMyTurn || isRolling) return;
    setRolling(true);
    socket.rollDice(gameId);
  }

  function handleForfeit() {
    if (!gameId) return;
    if (confirm('Are you sure you want to forfeit?')) {
      socket.forfeitGame(gameId);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <Header title="LOADING..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-gray-500 border-t-green-500 rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <Header title="ERROR" showBack />
        <PageContainer className="flex items-center justify-center">
          <Card className="text-center">
            <CardContent>
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => navigate('/')}>Go Home</Button>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  if (gameEnded) {
    const didWin = winner === user?.id;
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <Header title="GAME OVER" />
        <PageContainer className="flex items-center justify-center">
          <Card className="text-center w-full">
            <CardContent>
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">
                {didWin ? 'YOU WIN!' : 'YOU LOSE'}
              </h2>
              <div className="text-4xl font-mono font-bold text-white my-6">
                {gameState?.scores[0]} - {gameState?.scores[1]}
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={() => navigate('/')}>
                  🏠 Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Header with inning info */}
      <Header
        title={`${gameState?.isTopOfInning ? '⬆ TOP' : '⬇ BOT'} ${gameState?.inning || 1}`}
        rightAction={
          <button
            onClick={handleForfeit}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            •••
          </button>
        }
      />

      <div className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">
        {/* Scoreboard */}
        <Scoreboard state={gameState} />

        {/* Matchup placeholder */}
        <div className="my-4 text-center">
          <div className="flex justify-center gap-8 items-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl mb-2">
                ⚾
              </div>
              <p className="text-sm text-gray-400">AT BAT</p>
            </div>
            <span className="text-gray-500 text-xl">VS</span>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl mb-2">
                ⚾
              </div>
              <p className="text-sm text-gray-400">PITCHING</p>
            </div>
          </div>
        </div>

        {/* Diamond */}
        <Diamond bases={gameState?.bases || [false, false, false]} />

        {/* Outs */}
        <div className="text-center my-4">
          <span className="text-gray-400">OUTS: </span>
          <span className="text-xl">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < (gameState?.outs || 0) ? 'text-red-500' : 'text-gray-600'}>
                ●
              </span>
            ))}
          </span>
        </div>

        {/* Roll Button */}
        <RollButton
          isMyTurn={isMyTurn}
          isRolling={isRolling}
          lastRoll={lastRoll}
          lastOutcome={lastOutcome}
          onRoll={handleRoll}
        />

        {/* Play Log */}
        <div className="mt-4 flex-1 overflow-auto">
          {playLog.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              className={`text-sm py-2 border-b border-gray-800 ${getOutcomeColor(entry.outcome)}`}
            >
              📢 {entry.description}
            </div>
          ))}
        </div>

        {/* Connection status */}
        {!opponentConnected && (
          <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/10 border-t border-yellow-500 p-3 text-center text-yellow-500 text-sm">
            ⏳ Opponent disconnected...
            {disconnectTimeout && ` (${Math.ceil(disconnectTimeout / 1000)}s)`}
          </div>
        )}
      </div>
    </div>
  );
}

// Scoreboard Component
function Scoreboard({ state }: { state: GameState | null }) {
  if (!state) return null;

  return (
    <Card padding="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-gray-500">
              <th className="w-8"></th>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <th
                  key={i}
                  className={`w-6 text-center ${i === state.inning ? 'text-green-500' : ''}`}
                >
                  {i}
                </th>
              ))}
              <th className="w-6 text-center border-l border-gray-700">R</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-gray-400">V</td>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <td key={i} className="text-center text-white">
                  {i < state.inning || (i === state.inning && !state.isTopOfInning)
                    ? '0' // Placeholder - would need actual inning scores
                    : '·'}
                </td>
              ))}
              <td className="text-center font-bold text-white border-l border-gray-700">
                {state.scores[0]}
              </td>
            </tr>
            <tr>
              <td className="text-gray-400">H</td>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <td key={i} className="text-center text-white">
                  {i < state.inning ? '0' : '·'}
                </td>
              ))}
              <td className="text-center font-bold text-white border-l border-gray-700">
                {state.scores[1]}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Diamond Component
function Diamond({ bases }: { bases: [boolean, boolean, boolean] }) {
  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Base paths */}
        <path
          d="M50 85 L15 50 L50 15 L85 50 Z"
          fill="none"
          stroke="#374151"
          strokeWidth="2"
        />

        {/* Home plate */}
        <polygon points="50,85 45,80 50,75 55,80" fill="#6b7280" />

        {/* First base */}
        <rect
          x="78"
          y="43"
          width="14"
          height="14"
          rx="2"
          className={bases[0] ? 'fill-yellow-400' : 'fill-gray-600'}
        />

        {/* Second base */}
        <rect
          x="43"
          y="8"
          width="14"
          height="14"
          rx="2"
          className={bases[1] ? 'fill-yellow-400' : 'fill-gray-600'}
        />

        {/* Third base */}
        <rect
          x="8"
          y="43"
          width="14"
          height="14"
          rx="2"
          className={bases[2] ? 'fill-yellow-400' : 'fill-gray-600'}
        />
      </svg>
    </div>
  );
}

// Roll Button Component
function RollButton({
  isMyTurn,
  isRolling,
  lastRoll,
  lastOutcome,
  onRoll,
}: {
  isMyTurn: boolean;
  isRolling: boolean;
  lastRoll: [number, number] | null;
  lastOutcome: OutcomeType | null;
  onRoll: () => void;
}) {
  if (isRolling) {
    return (
      <Button size="lg" className="w-full" disabled>
        <span className="animate-bounce">🎲</span>
        <span className="ml-2">Rolling...</span>
      </Button>
    );
  }

  if (lastRoll) {
    const outcomeColors: Record<OutcomeType, string> = {
      homeRun: 'bg-yellow-500',
      triple: 'bg-green-500',
      double: 'bg-green-500',
      single: 'bg-green-500',
      walk: 'bg-blue-500',
      strikeout: 'bg-red-500',
      groundOut: 'bg-red-500',
      flyOut: 'bg-red-500',
    };

    return (
      <Button
        size="lg"
        className={`w-full ${lastOutcome ? outcomeColors[lastOutcome] : ''}`}
        onClick={onRoll}
        disabled={!isMyTurn}
      >
        🎲 {lastRoll[0]} + {lastRoll[1]} = {lastRoll[0] + lastRoll[1]}
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      className={`w-full ${isMyTurn ? 'animate-pulse' : ''}`}
      onClick={onRoll}
      disabled={!isMyTurn}
    >
      {isMyTurn ? '🎲 ROLL DICE' : 'Waiting for opponent...'}
    </Button>
  );
}

function getOutcomeColor(outcome: OutcomeType): string {
  const colors: Record<OutcomeType, string> = {
    homeRun: 'text-yellow-400',
    triple: 'text-green-400',
    double: 'text-green-400',
    single: 'text-green-400',
    walk: 'text-blue-400',
    strikeout: 'text-red-400',
    groundOut: 'text-red-400',
    flyOut: 'text-red-400',
  };
  return colors[outcome] || 'text-gray-400';
}
