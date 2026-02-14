/**
 * Game Page - Live multiplayer game view
 * Thin orchestrator composing hooks + presentation components.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { MatchupDisplay, OpponentInfo, BoxScore } from '../components/game';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { useGameSession } from '../hooks/useGameSession';
import { useGameDerivedState } from '../hooks/useGameDerivedState';
import type { GameState, OutcomeType } from '../types';

export function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

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
  } = useGameStore();

  const { loading, error, gameEnded, winner, isResultHold, handleRoll, handleForfeit } =
    useGameSession(gameId);

  const { currentBatter, currentPitcher } = useGameDerivedState();

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
              <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
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
      <Header
        title={`${gameState?.isTopOfInning ? '\u2B06 TOP' : '\u2B07 BOT'} ${gameState?.inning || 1}`}
        rightAction={
          <button
            onClick={handleForfeit}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            &bull;&bull;&bull;
          </button>
        }
      />
      <div className="sr-only" data-testid="game-inning-label">
        {gameState?.isTopOfInning ? 'top' : 'bottom'}-{gameState?.inning || 1}
      </div>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full pb-6">
        {currentGame && user && <OpponentInfo game={currentGame} currentUser={user} />}

        <Scoreboard
          state={gameState}
          playLog={playLog}
          homeName={currentGame?.homeTeam?.name || 'Home'}
          visitorName={currentGame?.visitorTeam?.name || 'Visitor'}
        />

        <MatchupDisplay batter={currentBatter} pitcher={currentPitcher} />

        <Diamond bases={gameState?.bases || [false, false, false]} />

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

        <RollButton
          isMyTurn={isMyTurn}
          isRolling={isRolling}
          isResultHold={isResultHold}
          lastRoll={lastRoll}
          lastOutcome={lastOutcome}
          onRoll={handleRoll}
        />

        <div className="mt-4" style={{ overflowAnchor: 'none' }} data-testid="game-play-log">
          {playLog
            .slice(-3)
            .reverse()
            .map((entry) => (
              <div
                key={entry.id}
                className={`text-sm py-2 border-b border-gray-800 ${getOutcomeColor(entry.outcome)}`}
              >
                &#x1F4E2; {entry.description}
              </div>
            ))}
        </div>

        {!opponentConnected && (
          <div
            className="fixed bottom-0 left-0 right-0 bg-yellow-500/10 border-t border-yellow-500 p-3 text-center text-yellow-500 text-sm"
            data-testid="game-opponent-disconnected"
          >
            &#x23F3; Opponent disconnected...
            {disconnectTimeout && ` (${Math.ceil(disconnectTimeout / 1000)}s)`}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Inline Presentation Components
// ============================================

function Scoreboard({
  state,
  playLog,
  homeName,
  visitorName,
}: {
  state: GameState | null;
  playLog: Array<{ inning: number; isTopOfInning: boolean; runsScored: number }>;
  homeName: string;
  visitorName: string;
}) {
  if (!state) return null;

  const truncateName = (name: string, maxLength: number = 10) =>
    name.length > maxLength ? name.substring(0, maxLength - 1) + '.' : name;

  const hasCanonicalScores = state.inningScores && state.inningScores.length > 0;

  const getInningRuns = (inning: number, teamIdx: 0 | 1): number => {
    if (hasCanonicalScores && state.inningScores && inning <= state.inningScores.length) {
      return state.inningScores[inning - 1][teamIdx];
    }
    const isTop = teamIdx === 0;
    return playLog
      .filter((entry) => entry.inning === inning && entry.isTopOfInning === isTop)
      .reduce((sum: number, entry) => sum + entry.runsScored, 0);
  };

  const isHalfComplete = (inning: number, isTopOfInning: boolean) => {
    if (inning < state.inning) return true;
    if (inning > state.inning) return false;
    return isTopOfInning && !state.isTopOfInning;
  };

  const renderHalfCell = (inning: number, isTopOfInning: boolean) => {
    const teamIdx: 0 | 1 = isTopOfInning ? 0 : 1;
    const runs = getInningRuns(inning, teamIdx);
    if (isHalfComplete(inning, isTopOfInning)) return String(runs);
    if (runs > 0) return String(runs);
    if (inning === state.inning && state.isTopOfInning === isTopOfInning) {
      return isTopOfInning ? '\u25B2' : '\u25BC';
    }
    return '\u00B7';
  };

  return (
    <Card padding="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-gray-500">
              <th className="w-24 text-left px-2">Team</th>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <th key={i} className={`w-6 text-center ${i === state.inning ? 'text-green-500' : ''}`}>
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

function Diamond({ bases }: { bases: [boolean, boolean, boolean] }) {
  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M50 85 L15 50 L50 15 L85 50 Z" fill="none" stroke="#374151" strokeWidth="2" />
        <polygon points="50,85 45,80 50,75 55,80" fill="#6b7280" />
        <rect x="78" y="43" width="14" height="14" rx="2" className={bases[0] ? 'fill-yellow-400' : 'fill-gray-600'} />
        <rect x="43" y="8" width="14" height="14" rx="2" className={bases[1] ? 'fill-yellow-400' : 'fill-gray-600'} />
        <rect x="8" y="43" width="14" height="14" rx="2" className={bases[2] ? 'fill-yellow-400' : 'fill-gray-600'} />
      </svg>
    </div>
  );
}

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
        <span className="animate-bounce">&#x1F3B2;</span>
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
        {isResultHold
          ? 'Resolving play...'
          : `\u{1F3B2} ${lastRoll[0]} + ${lastRoll[1]} = ${lastRoll[0] + lastRoll[1]}`}
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
      {isMyTurn ? '\u{1F3B2} ROLL DICE' : 'Waiting for opponent...'}
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
    <div className={`mb-3 rounded-lg border px-3 py-2 ${status.className}`} data-testid="game-turn-status">
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
