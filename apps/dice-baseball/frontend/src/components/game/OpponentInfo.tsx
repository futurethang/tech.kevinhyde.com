/**
 * OpponentInfo Component - Shows opponent and team info with home/visitor badges
 * v5 Topps design: token colors, navy palette
 */

import type { Game, User } from '../../types';

interface OpponentInfoProps {
  game: Game;
  currentUser: User;
}

export function OpponentInfo({ game, currentUser }: OpponentInfoProps) {
  const isUserHome = currentUser.id === game.homeUserId;

  const userTeam = isUserHome ? game.homeTeam : game.visitorTeam;
  const opponentTeam = isUserHome ? game.visitorTeam : game.homeTeam;

  const userBadge = isUserHome ? 'HOME' : 'VISITOR';
  const opponentBadge = isUserHome ? 'VISITOR' : 'HOME';

  return (
    <div className="flex justify-between items-center bg-[var(--color-surface-card)] p-3 mb-4">
      {/* Current User's Team */}
      <div className="text-center flex-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className={`px-2 py-1 text-xs font-bold font-display ${
            isUserHome ? 'bg-[var(--color-topps-blue)] text-white' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'
          }`}>
            {userBadge}
          </span>
        </div>
        <p className="text-[var(--color-text-primary)] font-bold text-sm font-display">YOU</p>
        {userTeam && (
          <p className="text-[var(--color-text-muted)] text-xs truncate">{userTeam.name}</p>
        )}
      </div>

      {/* VS Divider */}
      <div className="text-center px-4">
        <span className="text-[var(--color-text-dim)] text-lg font-display">VS</span>
      </div>

      {/* Opponent's Team */}
      <div className="text-center flex-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className={`px-2 py-1 text-xs font-bold font-display ${
            !isUserHome ? 'bg-[var(--color-topps-blue)] text-white' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'
          }`}>
            {opponentBadge}
          </span>
        </div>
        <p className="text-[var(--color-text-primary)] font-bold text-sm font-display">
          {game.visitorUserId && game.homeUserId ? 'OPPONENT' : 'WAITING...'}
        </p>
        {opponentTeam && (
          <p className="text-[var(--color-text-muted)] text-xs truncate">{opponentTeam.name}</p>
        )}
      </div>
    </div>
  );
}
