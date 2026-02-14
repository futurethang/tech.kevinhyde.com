/**
 * Game Page - Live multiplayer game view
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { MatchupDisplay, OpponentInfo, BoxScore } from '../components/game';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import * as api from '../services/api';
import * as socket from '../services/socket';
import type { RollResultEvent } from '@dice-baseball/contracts';
import type { GameState, OutcomeType, MLBPlayer, Game } from '../types';

const RESULT_HOLD_MS = 450;

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
  const [isResultHold, setIsResultHold] = useState(false);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    if (gameId) {
      initializeGame(gameId).then((cleanupFn) => {
        if (cancelled) {
          cleanupFn?.();
          return;
        }
        cleanup = cleanupFn;
      });
    }

    return () => {
      cancelled = true;
      if (cleanup) {
        cleanup();
      }
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
      setIsResultHold(false);
      socket.clearHandlers();
      socket.disconnect();
      resetGame();
    };
  }, [gameId]);

  // Update turn whenever game state changes
  useEffect(() => {
    if (currentGame && gameState && user) {
      updateTurn(gameState, currentGame);
    }
  }, [gameState, currentGame, user]);

  async function initializeGame(id: string): Promise<(() => void) | undefined> {
    setLoading(true);
    try {
      // Load game data
      const game = await api.getGameById(id);
      setGame(game);
      
      console.log('🎮 Game loaded:', {
        status: game.status,
        homeUserId: game.homeUserId,
        visitorUserId: game.visitorUserId,
        currentUserId: user?.id
      });
      
      // If game is already active (both players joined), set opponent as connected
      if (game.status === 'active' && game.visitorUserId) {
        console.log('✅ Game is active, setting opponent as connected');
        setOpponentConnected(true);
        
        // Initialize turn state with current game state
        if (game.state) {
          console.log('🎯 Initializing turn state:', {
            inning: game.state.inning,
            isTopOfInning: game.state.isTopOfInning,
            currentUserId: user?.id,
            homeUserId: game.homeUserId,
            visitorUserId: game.visitorUserId
          });
          setGameState(game.state);
          updateTurn(game.state, game);
        }
      }

      // Connect to WebSocket
      await socket.connect();
      setConnected(true);

      // Ensure stale handlers from previous mounts are removed.
      socket.clearHandlers();

      // Register event handlers with cleanup
      const unsubscribeGameState = socket.on<{ state: GameState }>('game:state', ({ state }) => {
        console.log('📊 Game state update received:', {
          inning: state.inning,
          isTopOfInning: state.isTopOfInning,
          outs: state.outs
        });
        setGameState(state);
      });

      const unsubscribeRollResult = socket.on<RollResultEvent>('game:roll-result', (result) => {
        console.log('🎲 Roll result received:', result.outcome, result.description);
        setLastRoll(result.diceRolls, result.outcome);
        setGameState(result.newState);
        addPlayLogEntry(result);

        // Keep the result state visible briefly before next action affordance.
        setIsResultHold(true);
        if (holdTimeoutRef.current) {
          clearTimeout(holdTimeoutRef.current);
        }
        holdTimeoutRef.current = setTimeout(() => {
          setIsResultHold(false);
          setRolling(false);
          holdTimeoutRef.current = null;
        }, RESULT_HOLD_MS);

        setError(''); // Clear any previous errors
      });

      const unsubscribeGameEnded = socket.on<{ winnerId: string; reason: string }>('game:ended', ({ winnerId }) => {
        setGameEnded(true);
        setWinner(winnerId);
      });

      const unsubscribeOpponentConnected = socket.on<{ userId: string }>('opponent:connected', ({ userId }) => {
        console.log('🤝 Opponent connected:', userId);
        setOpponentConnected(true);
      });

      const unsubscribeOpponentDisconnected = socket.on<{ userId: string; timeout: number }>('opponent:disconnected', ({ userId, timeout }) => {
        console.log('💔 Opponent disconnected:', userId, 'timeout:', timeout);
        setOpponentConnected(false, timeout);
      });

      const unsubscribeError = socket.on<{ error: string; message: string }>('error', ({ error, message }) => {
        console.error('⚠️ Game error:', error, message);
        setError(message);
        setRolling(false); // Reset rolling state on error
      });

      // Store cleanup functions for proper cleanup
      const cleanupRef = {
        unsubscribeGameState,
        unsubscribeRollResult,
        unsubscribeGameEnded,
        unsubscribeOpponentConnected,
        unsubscribeOpponentDisconnected,
        unsubscribeError,
      };

      // Join the game room (add small delay to ensure connection is ready)
      setTimeout(() => {
        socket.joinGame(id);
      }, 100);

      // Return cleanup function
      return () => {
        console.log('🧹 Cleaning up game event handlers');
        Object.values(cleanupRef).forEach(cleanup => cleanup?.());
      };
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to load game');
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  function updateTurn(state: GameState, game?: Game) {
    const gameToUse = game || currentGame;
    
    if (!gameToUse || !user) {
      console.log('⚠️ Cannot update turn - missing game or user', {
        hasGame: !!gameToUse,
        hasUser: !!user
      });
      return;
    }
    
    // Top of inning = visitor batting (visitor's turn)
    // Bottom = home batting (home's turn)
    const isVisitor = user.id === gameToUse.visitorUserId;
    const isTopInning = state.isTopOfInning;
    const myTurn = isVisitor ? isTopInning : !isTopInning;
    
    console.log('🎯 Turn calculation:', {
      userId: user.id,
      isVisitor,
      isTopInning,
      myTurn,
      inning: state.inning
    });
    
    setMyTurn(myTurn);
    
    // Clear error when it becomes player's turn
    if (myTurn) {
      setError('');
    }
  }

  function handleRoll() {
    if (!gameId || !isMyTurn || isRolling || isResultHold) return;
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
      <div className="min-h-screen flex flex-col bg-gray-900" data-testid="game-loading">
        <Header title="LOADING..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-gray-500 border-t-green-500 rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900" data-testid="game-error">
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
      <div className="min-h-screen flex flex-col bg-gray-900" data-testid="game-over-screen">
        <Header title="GAME OVER" />
        <PageContainer>
          <Card className="w-full max-w-2xl mx-auto">
            <CardContent>
              {currentGame && gameState && (
                <BoxScore
                  game={currentGame}
                  gameState={gameState}
                  playLog={playLog}
                  didWin={didWin}
                  onGoHome={() => navigate('/')}
                />
              )}
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-gray-900"
      style={{ overflowAnchor: 'none' }}
      data-testid="game-screen"
    >
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
      <div className="sr-only" data-testid="game-inning-label">
        {gameState?.isTopOfInning ? 'top' : 'bottom'}-{gameState?.inning || 1}
      </div>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full pb-6">
        {/* Opponent Info */}
        {currentGame && user && (
          <OpponentInfo game={currentGame} currentUser={user} />
        )}

        {/* Scoreboard */}
        <Scoreboard 
          state={gameState} 
          playLog={playLog}
          homeName={currentGame?.homeTeam?.name || 'Home'}
          visitorName={currentGame?.visitorTeam?.name || 'Visitor'}
        />

        {/* Matchup Display */}
        <MatchupDisplay
          batter={getCurrentBatter()}
          pitcher={getCurrentPitcher()}
        />

        {/* Diamond */}
        <Diamond bases={gameState?.bases || [false, false, false]} />

        {/* Outs */}
        <div className="my-4 text-center">
          <span className="text-gray-400 text-sm mr-2">OUTS</span>
          <span className="inline-flex items-center gap-1 align-middle">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`inline-flex h-3 w-3 rounded-full border ${
                  i < Math.min(gameState?.outs || 0, 2)
                    ? 'border-red-500 bg-red-500'
                    : 'border-gray-600 bg-transparent'
                }`}
              />
            ))}
          </span>
        </div>

        <TurnStatus
          isMyTurn={isMyTurn}
          isRolling={isRolling}
          isResultHold={isResultHold}
          opponentConnected={opponentConnected}
        />

        {/* Roll Button */}
        <RollButton
          isMyTurn={isMyTurn}
          isRolling={isRolling}
          isResultHold={isResultHold}
          lastRoll={lastRoll}
          lastOutcome={lastOutcome}
          onRoll={handleRoll}
        />

        {/* Play Log */}
        <div className="mt-4" style={{ overflowAnchor: 'none' }} data-testid="game-play-log">
          {playLog.slice(-3).reverse().map((entry) => (
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
          <div
            className="fixed bottom-0 left-0 right-0 bg-yellow-500/10 border-t border-yellow-500 p-3 text-center text-yellow-500 text-sm"
            data-testid="game-opponent-disconnected"
          >
            ⏳ Opponent disconnected...
            {disconnectTimeout && ` (${Math.ceil(disconnectTimeout / 1000)}s)`}
          </div>
        )}
      </div>
    </div>
  );

  // Helper functions to get current players
  function getCurrentBatter(): MLBPlayer | null {
    if (!currentGame || !gameState || !user) return null;
    
    // Determine which team is batting
    const isVisitorBatting = gameState.isTopOfInning;
    const battingTeam = isVisitorBatting ? currentGame.visitorTeam : currentGame.homeTeam;
    
    if (!battingTeam?.roster) return null;
    
    // Get the current batter by batting order.
    // Support both 1-based and 0-based battingOrder values.
    const lineupSpot = (gameState.currentBatterIndex % 9) + 1;
    const currentBatterSlot = battingTeam.roster.find(
      slot =>
        slot.position !== 'SP' &&
        (slot.battingOrder === lineupSpot || slot.battingOrder === lineupSpot - 1)
    );
    const fallbackBatterSlot = battingTeam.roster.find(slot => slot.position !== 'SP');

    const resolvedBatter = toDisplayPlayer(
      currentBatterSlot || fallbackBatterSlot,
      currentBatterSlot?.position || fallbackBatterSlot?.position || 'DH'
    );

    if (resolvedBatter) {
      return resolvedBatter;
    }

    const latest = playLog[playLog.length - 1];
    return playerFromPlayLog(latest?.batterName, 'DH', latest?.batterStats);
  }

  function getCurrentPitcher(): MLBPlayer | null {
    if (!currentGame || !gameState || !user) return null;
    
    // Determine which team is pitching (opposite of batting)
    const isVisitorBatting = gameState.isTopOfInning;
    const pitchingTeam = isVisitorBatting ? currentGame.homeTeam : currentGame.visitorTeam;
    
    if (!pitchingTeam?.roster) return null;
    
    // Find the starting pitcher, then fall back to any available roster slot.
    const pitcherSlot = pitchingTeam.roster.find(slot => slot.position === 'SP');
    const fallbackPitcherSlot = pitchingTeam.roster[0];

    const resolvedPitcher = toDisplayPlayer(pitcherSlot || fallbackPitcherSlot, 'SP');
    if (resolvedPitcher) {
      return resolvedPitcher;
    }

    const latest = playLog[playLog.length - 1];
    return playerFromPlayLog(latest?.pitcherName, 'SP', undefined, latest?.pitcherStats);
  }
}

// Scoreboard Component
function Scoreboard({ state, playLog, homeName, visitorName }: { 
  state: GameState | null;
  playLog: Array<{ inning: number; isTopOfInning: boolean; runsScored: number }>;
  homeName: string;
  visitorName: string;
}) {
  if (!state) return null;

  // Truncate team names to fit in scoreboard
  const truncateName = (name: string, maxLength: number = 10) => {
    return name.length > maxLength ? name.substring(0, maxLength - 1) + '.' : name;
  };

  const sumRunsForHalf = (inning: number, isTopOfInning: boolean) =>
    playLog
      .filter((entry) => entry.inning === inning && entry.isTopOfInning === isTopOfInning)
      .reduce((sum: number, entry) => sum + entry.runsScored, 0);

  const isHalfComplete = (inning: number, isTopOfInning: boolean) => {
    if (inning < state.inning) {
      return true;
    }
    if (inning > state.inning) {
      return false;
    }
    return isTopOfInning && !state.isTopOfInning;
  };

  const renderHalfCell = (inning: number, isTopOfInning: boolean) => {
    const runs = sumRunsForHalf(inning, isTopOfInning);
    if (isHalfComplete(inning, isTopOfInning)) {
      return String(runs);
    }
    if (runs > 0) {
      return String(runs);
    }
    if (inning === state.inning && state.isTopOfInning === isTopOfInning) {
      return isTopOfInning ? '▲' : '▼';
    }
    return '·';
  };

  return (
    <Card padding="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-gray-500">
              <th className="w-24 text-left px-2">Team</th>
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
              <td className="text-gray-400 px-2" title={visitorName}>
                {truncateName(visitorName)}
              </td>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <td key={i} className="text-center text-white">
                  {renderHalfCell(i, true)}
                </td>
              ))}
              <td className="text-center font-bold text-white border-l border-gray-700">
                {state.scores[0]}
              </td>
            </tr>
            <tr>
              <td className="text-gray-400 px-2" title={homeName}>
                {truncateName(homeName)}
              </td>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <td key={i} className="text-center text-white">
                  {renderHalfCell(i, false)}
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
  isResultHold,
  lastRoll,
  lastOutcome,
  onRoll,
}: {
  isMyTurn: boolean;
  isRolling: boolean;
  isResultHold: boolean;
  lastRoll: [number, number] | null;
  lastOutcome: OutcomeType | null;
  onRoll: () => void;
}) {
  if (isRolling) {
    return (
      <Button size="lg" className="w-full" disabled data-testid="game-roll-button">
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
        disabled={!isMyTurn || isResultHold}
        data-testid="game-roll-button"
      >
        {isResultHold ? 'Resolving play...' : `🎲 ${lastRoll[0]} + ${lastRoll[1]} = ${lastRoll[0] + lastRoll[1]}`}
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      className={`w-full ${isMyTurn ? 'animate-pulse' : ''}`}
      onClick={onRoll}
      disabled={!isMyTurn || isResultHold}
      data-testid="game-roll-button"
    >
      {isMyTurn ? '🎲 ROLL DICE' : 'Waiting for opponent...'}
    </Button>
  );
}

function TurnStatus({
  isMyTurn,
  isRolling,
  isResultHold,
  opponentConnected,
}: {
  isMyTurn: boolean;
  isRolling: boolean;
  isResultHold: boolean;
  opponentConnected: boolean;
}) {
  const status = !opponentConnected
    ? {
        className: 'bg-yellow-500/10 border-yellow-500 text-yellow-300',
        label: 'Connection issue',
        detail: 'Opponent disconnected. Waiting for reconnection...',
      }
    : isRolling
      ? {
          className: 'bg-blue-500/10 border-blue-500 text-blue-300',
          label: 'Play in progress',
          detail: 'Rolling the dice...',
        }
      : isResultHold
        ? {
            className: 'bg-indigo-500/10 border-indigo-500 text-indigo-300',
            label: 'Play resolved',
            detail: 'Updating the field...',
          }
      : isMyTurn
        ? {
            className: 'bg-green-500/10 border-green-500 text-green-300',
            label: 'Your turn',
            detail: 'Roll the dice to continue the inning.',
          }
        : {
            className: 'bg-gray-700/40 border-gray-600 text-gray-300',
            label: "Opponent's turn",
            detail: 'Waiting for opponent action.',
          };

  return (
    <div
      className={`mb-3 rounded-lg border px-3 py-2 ${status.className}`}
      data-testid="game-turn-status"
    >
      <p className="text-sm font-semibold">{status.label}</p>
      <p className="text-xs opacity-90">{status.detail}</p>
    </div>
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

function toDisplayPlayer(slot: unknown, fallbackPosition: string): MLBPlayer | null {
  if (!slot || typeof slot !== 'object') return null;

  const typedSlot = slot as {
    mlbPlayerId?: number;
    player?: MLBPlayer;
    playerData?: {
      name?: string;
      battingStats?: {
        avg?: number;
        obp?: number;
        slg?: number;
        ops?: number;
        bb?: number;
        so?: number;
        ab?: number;
      };
      pitchingStats?: {
        era?: number;
        whip?: number;
        kPer9?: number;
        bbPer9?: number;
        hrPer9?: number;
      };
    };
  };

  if (typedSlot.player) {
    return typedSlot.player;
  }

  const playerData = typedSlot.playerData;
  const name = playerData?.name;
  if (!name) return null;

  const [firstName = '', ...rest] = name.split(' ');
  const lastName = rest.join(' ');

  return {
    mlbId: typedSlot.mlbPlayerId || 0,
    fullName: name,
    firstName,
    lastName: lastName || firstName,
    primaryPosition: fallbackPosition,
    currentTeam: null,
    currentTeamId: null,
    isActive: true,
    lastUpdated: new Date().toISOString(),
    battingStats: playerData?.battingStats
      ? {
          gamesPlayed: 0,
          atBats: playerData.battingStats.ab ?? 0,
          runs: 0,
          hits: 0,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
          rbi: 0,
          walks: playerData.battingStats.bb ?? 0,
          strikeouts: playerData.battingStats.so ?? 0,
          stolenBases: 0,
          avg: playerData.battingStats.avg ?? 0,
          obp: playerData.battingStats.obp ?? 0,
          slg: playerData.battingStats.slg ?? 0,
          ops: playerData.battingStats.ops ?? 0,
        }
      : null,
    pitchingStats: playerData?.pitchingStats
      ? {
          gamesPlayed: 0,
          gamesStarted: 0,
          wins: 0,
          losses: 0,
          era: playerData.pitchingStats.era ?? 0,
          inningsPitched: 0,
          hits: 0,
          runs: 0,
          earnedRuns: 0,
          homeRuns: 0,
          walks: 0,
          strikeouts: 0,
          whip: playerData.pitchingStats.whip ?? 0,
          kPer9: playerData.pitchingStats.kPer9 ?? 0,
          bbPer9: playerData.pitchingStats.bbPer9 ?? 0,
          hrPer9: playerData.pitchingStats.hrPer9 ?? 0,
        }
      : null,
  };
}

function playerFromPlayLog(
  name: string | undefined,
  position: string,
  batting?: { avg: number; ops: number },
  pitching?: { era: number; whip: number; kPer9: number }
): MLBPlayer | null {
  if (!name) return null;

  const [firstName = '', ...rest] = name.split(' ');
  const lastName = rest.join(' ');

  return {
    mlbId: 0,
    fullName: name,
    firstName,
    lastName: lastName || firstName,
    primaryPosition: position,
    currentTeam: null,
    currentTeamId: null,
    isActive: true,
    lastUpdated: new Date().toISOString(),
    battingStats: batting
      ? {
          gamesPlayed: 0,
          atBats: 0,
          runs: 0,
          hits: 0,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
          rbi: 0,
          walks: 0,
          strikeouts: 0,
          stolenBases: 0,
          avg: batting.avg,
          obp: 0,
          slg: 0,
          ops: batting.ops,
        }
      : null,
    pitchingStats: pitching
      ? {
          gamesPlayed: 0,
          gamesStarted: 0,
          wins: 0,
          losses: 0,
          era: pitching.era,
          inningsPitched: 0,
          hits: 0,
          runs: 0,
          earnedRuns: 0,
          homeRuns: 0,
          walks: 0,
          strikeouts: 0,
          whip: pitching.whip,
          kPer9: pitching.kPer9,
          bbPer9: 0,
          hrPer9: 0,
        }
      : null,
  };
}
