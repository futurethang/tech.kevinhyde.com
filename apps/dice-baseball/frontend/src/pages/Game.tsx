/**
 * Game Page - Live multiplayer game view
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { MatchupDisplay, OpponentInfo, BoxScore } from '../components/game';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import * as api from '../services/api';
import * as socket from '../services/socket';
import type { GameState, PlayResult, OutcomeType, MLBPlayer, Game } from '../types';

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
    let cleanup: (() => void) | undefined;

    if (gameId) {
      initializeGame(gameId).then((cleanupFn) => {
        cleanup = cleanupFn;
      });
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
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

      // Register event handlers with cleanup
      const unsubscribeGameState = socket.on<{ state: GameState }>('game:state', ({ state }) => {
        console.log('📊 Game state update received:', {
          inning: state.inning,
          isTopOfInning: state.isTopOfInning,
          outs: state.outs
        });
        setGameState(state);
        // Turn will be updated by useEffect when gameState changes
        setRolling(false); // Ensure rolling is reset on state updates
      });

      const unsubscribeRollResult = socket.on<PlayResult>('game:roll-result', (result) => {
        console.log('🎲 Roll result received:', result.outcome, result.description);
        setLastRoll(result.diceRolls, result.outcome);
        setGameState(result.newState);
        addPlayLogEntry(result);
        // Turn will be updated by useEffect when gameState changes
        setRolling(false); // Reset rolling state after result
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
        {/* Opponent Info */}
        {currentGame && user && (
          <OpponentInfo game={currentGame} currentUser={user} />
        )}

        {/* Scoreboard */}
        <Scoreboard 
          state={gameState} 
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

  // Helper functions to get current players
  function getCurrentBatter(): MLBPlayer | null {
    if (!currentGame || !gameState || !user) return null;
    
    // Determine which team is batting
    const isVisitorBatting = gameState.isTopOfInning;
    const battingTeam = isVisitorBatting ? currentGame.visitorTeam : currentGame.homeTeam;
    
    if (!battingTeam?.roster) return null;
    
    // Get the current batter by batting order
    const currentBatterSlot = battingTeam.roster.find(
      slot => slot.battingOrder === gameState.currentBatterIndex + 1 && slot.position !== 'SP'
    );
    
    return currentBatterSlot?.player || null;
  }

  function getCurrentPitcher(): MLBPlayer | null {
    if (!currentGame || !gameState || !user) return null;
    
    // Determine which team is pitching (opposite of batting)
    const isVisitorBatting = gameState.isTopOfInning;
    const pitchingTeam = isVisitorBatting ? currentGame.homeTeam : currentGame.visitorTeam;
    
    if (!pitchingTeam?.roster) return null;
    
    // Find the starting pitcher
    const pitcherSlot = pitchingTeam.roster.find(slot => slot.position === 'SP');
    
    return pitcherSlot?.player || null;
  }
}

// Scoreboard Component
function Scoreboard({ state, homeName, visitorName }: { 
  state: GameState | null;
  homeName: string;
  visitorName: string;
}) {
  if (!state) return null;

  // Truncate team names to fit in scoreboard
  const truncateName = (name: string, maxLength: number = 10) => {
    return name.length > maxLength ? name.substring(0, maxLength - 1) + '.' : name;
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
              <td className="text-gray-400 px-2" title={homeName}>
                {truncateName(homeName)}
              </td>
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
