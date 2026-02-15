/**
 * Game Page - Live multiplayer game view
 * Thin orchestrator composing hooks + presentation components.
 * v5 Topps design: navy palette, gold accents, zero radius
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { MatchupDisplay, OpponentInfo, BoxScore, Scoreboard, Diamond } from '../components/game';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { useGameSession } from '../hooks/useGameSession';
import { useGameDerivedState } from '../hooks/useGameDerivedState';
import type { OutcomeType } from '../types';

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
      <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]" data-testid="game-loading">
        <Header title="LOADING..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-[var(--color-text-dim)] border-t-[var(--color-topps-gold)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]" data-testid="game-error">
        <Header title="ERROR" showBack />
        <PageContainer className="flex items-center justify-center">
          <Card className="text-center">
            <CardContent>
              <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
              <p className="text-[var(--color-card-red)] mb-4">{error}</p>
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
      <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]" data-testid="game-over-screen">
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
      className="min-h-[100dvh] flex flex-col bg-[var(--color-surface-page)]"
      style={{ overflowAnchor: 'none' }}
      data-testid="game-screen"
    >
      <Header
        title={`${gameState?.isTopOfInning ? '\u2B06 TOP' : '\u2B07 BOT'} ${gameState?.inning || 1}`}
        rightAction={
          <button
            onClick={handleForfeit}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-card-red)] transition-colors"
          >
            &bull;&bull;&bull;
          </button>
        }
      />
      <div className="sr-only" data-testid="game-inning-label">
        {gameState?.isTopOfInning ? 'top' : 'bottom'}-{gameState?.inning || 1}
      </div>

      <div className="flex-1 p-4 max-w-xl mx-auto w-full pb-6">
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
          <span className="text-[var(--color-text-muted)] text-sm mr-2 font-display">OUTS</span>
          <span className="inline-flex items-center gap-1 align-middle">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`inline-flex h-3 w-3 border ${
                  i < Math.min(gameState?.outs || 0, 2)
                    ? 'border-[var(--color-card-red)] bg-[var(--color-card-red)]'
                    : 'border-[var(--color-text-dim)] bg-transparent'
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
                className={`text-sm py-2 border-b border-[var(--color-text-dim)]/20 ${getOutcomeColor(entry.outcome)}`}
              >
                &#x1F4E2; {entry.description}
              </div>
            ))}
        </div>

        {!opponentConnected && (
          <div
            className="fixed bottom-0 left-0 right-0 bg-[var(--color-topps-gold)]/10 border-t border-[var(--color-topps-gold)] p-3 text-center text-[var(--color-topps-gold)] text-sm"
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
      <Button variant="roll" size="lg" className="w-full" disabled data-testid="game-roll-button">
        <span className="animate-bounce">&#x1F3B2;</span>
        <span className="ml-2">Rolling...</span>
      </Button>
    );
  }

  if (lastRoll) {
    const outcomeColors: Record<OutcomeType, string> = {
      homeRun: 'bg-[var(--color-topps-gold)] text-[var(--color-surface-page)]',
      triple: 'bg-[var(--color-stadium-green)] text-white',
      double: 'bg-[var(--color-stadium-green)] text-white',
      single: 'bg-[var(--color-stadium-green)] text-white',
      walk: 'bg-[var(--color-topps-blue)] text-white',
      strikeout: 'bg-[var(--color-card-red)] text-white',
      groundOut: 'bg-[var(--color-card-red)] text-white',
      flyOut: 'bg-[var(--color-card-red)] text-white',
    };

    return (
      <Button
        variant="roll"
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
      variant="roll"
      size="lg"
      className="w-full"
      onClick={onRoll}
      disabled={!isMyTurn || isResultHold}
      data-testid="game-roll-button"
    >
      {isMyTurn ? '\u{1F3B2} Roll Dice' : 'Waiting for opponent...'}
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
        className: 'bg-[var(--color-topps-gold)]/10 border-[var(--color-topps-gold)] text-[var(--color-topps-gold)]',
        label: 'Connection issue',
        detail: 'Opponent disconnected. Waiting for reconnection...',
      }
    : isRolling
      ? {
          className: 'bg-[var(--color-topps-blue)]/10 border-[var(--color-topps-blue)] text-[var(--color-topps-blue)]',
          label: 'Play in progress',
          detail: 'Rolling the dice...',
        }
      : isResultHold
        ? {
            className: 'bg-[var(--color-nameplate-orange)]/10 border-[var(--color-nameplate-orange)] text-[var(--color-nameplate-orange)]',
            label: 'Play resolved',
            detail: 'Updating the field...',
          }
        : isMyTurn
          ? {
              className: 'bg-[var(--color-stadium-green)]/10 border-[var(--color-stadium-green)] text-[var(--color-stadium-green)]',
              label: 'Your turn',
              detail: 'Roll the dice to continue the inning.',
            }
          : {
              className: 'bg-[var(--color-surface-hover)] border-[var(--color-text-dim)] text-[var(--color-text-secondary)]',
              label: "Opponent's turn",
              detail: 'Waiting for opponent action.',
            };

  return (
    <div className={`mb-3 border px-3 py-2 ${status.className}`} data-testid="game-turn-status">
      <p className="text-sm font-semibold font-display">{status.label}</p>
      <p className="text-xs opacity-90">{status.detail}</p>
    </div>
  );
}

function getOutcomeColor(outcome: OutcomeType): string {
  const colors: Record<OutcomeType, string> = {
    homeRun: 'text-[var(--color-topps-gold)]',
    triple: 'text-[var(--color-stadium-green)]',
    double: 'text-[var(--color-stadium-green)]',
    single: 'text-[var(--color-stadium-green)]',
    walk: 'text-[var(--color-topps-blue)]',
    strikeout: 'text-[var(--color-card-red)]',
    groundOut: 'text-[var(--color-card-red)]',
    flyOut: 'text-[var(--color-card-red)]',
  };
  return colors[outcome] || 'text-[var(--color-text-muted)]';
}
