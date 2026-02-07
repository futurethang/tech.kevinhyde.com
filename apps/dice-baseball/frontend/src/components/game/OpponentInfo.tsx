/**
 * OpponentInfo Component - Shows opponent and team info with home/visitor badges
 */

import type { Game, User } from '../../types';

interface OpponentInfoProps {
  game: Game;
  currentUser: User;
}

export function OpponentInfo({ game, currentUser }: OpponentInfoProps) {
  const isUserHome = currentUser.id === game.homeUserId;
  
  // Determine current user's team and opponent's team
  const userTeam = isUserHome ? game.homeTeam : game.visitorTeam;
  const opponentTeam = isUserHome ? game.visitorTeam : game.homeTeam;
  
  // For user display
  const userBadge = isUserHome ? 'HOME' : 'VISITOR';
  const opponentBadge = isUserHome ? 'VISITOR' : 'HOME';

  return (
    <div className="flex justify-between items-center bg-gray-800/30 rounded-lg p-3 mb-4">
      {/* Current User's Team */}
      <div className="text-center flex-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            isUserHome ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
          }`}>
            {userBadge}
          </span>
        </div>
        <p className="text-white font-bold text-sm">YOU</p>
        {userTeam && (
          <p className="text-gray-400 text-xs truncate">{userTeam.name}</p>
        )}
      </div>

      {/* VS Divider */}
      <div className="text-center px-4">
        <span className="text-gray-500 text-lg">VS</span>
      </div>

      {/* Opponent's Team */}
      <div className="text-center flex-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            !isUserHome ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
          }`}>
            {opponentBadge}
          </span>
        </div>
        <p className="text-white font-bold text-sm">
          {game.visitorUserId && game.homeUserId ? 'OPPONENT' : 'WAITING...'}
        </p>
        {opponentTeam && (
          <p className="text-gray-400 text-xs truncate">{opponentTeam.name}</p>
        )}
      </div>
    </div>
  );
}