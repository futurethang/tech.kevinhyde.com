/**
 * BoxScore Component - Enhanced game over statistics and box score
 */

import { Button } from '../common';
import type { Game, GameState, TeamStats } from '../../types';

interface BoxScoreProps {
  game: Game;
  gameState: GameState;
  playLog: Array<{ outcome: string; runsScored: number; description: string }>;
  didWin: boolean;
  onPlayAgain?: () => void;
  onGoHome: () => void;
}

export function BoxScore({ game, gameState, playLog, didWin, onPlayAgain, onGoHome }: BoxScoreProps) {
  const homeTeamName = game.homeTeam?.name || 'Home Team';
  const visitorTeamName = game.visitorTeam?.name || 'Visitor Team';

  // Use canonical stats when available, fall back to approximation
  const gameStats = gameState.teamStats
    ? { visitor: gameState.teamStats[0], home: gameState.teamStats[1] }
    : calculateGameStats(playLog);

  // Use canonical inning scores when available
  const hasCanonicalScores = gameState.inningScores && gameState.inningScores.length > 0;

  const getInningScore = (inning: number, teamIdx: 0 | 1): number => {
    if (hasCanonicalScores && gameState.inningScores && inning <= gameState.inningScores.length) {
      return gameState.inningScores[inning - 1][teamIdx];
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Result Header */}
      <div className="text-center">
        <div className="text-6xl mb-4">
          {didWin ? '🏆' : '💔'}
        </div>
        <h2 className="text-3xl font-display font-bold text-white mb-2">
          {didWin ? 'VICTORY!' : 'DEFEAT'}
        </h2>
        <div className="text-5xl font-mono font-bold text-white">
          {gameState.scores[0]} - {gameState.scores[1]}
        </div>
      </div>

      {/* Inning-by-Inning Box Score */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h3 className="text-lg font-bold text-white mb-3 text-center">Box Score</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 w-20">Team</th>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((inning) => (
                  <th key={inning} className="text-center w-8 py-2">{inning}</th>
                ))}
                <th className="text-center w-8 py-2 border-l border-gray-700">R</th>
                <th className="text-center w-8 py-2">H</th>
                <th className="text-center w-8 py-2">E</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-white">
                <td className="py-2 truncate pr-2" title={visitorTeamName}>
                  {visitorTeamName.length > 8 ? visitorTeamName.substring(0, 8) + '...' : visitorTeamName}
                </td>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                  <td key={i} className="text-center py-2">
                    {i <= gameState.inning || (i === gameState.inning && !gameState.isTopOfInning)
                      ? getInningScore(i, 0) : '·'}
                  </td>
                ))}
                <td className="text-center py-2 border-l border-gray-700 font-bold">{gameState.scores[0]}</td>
                <td className="text-center py-2">{gameStats.visitor.hits}</td>
                <td className="text-center py-2">0</td>
              </tr>
              <tr className="text-white">
                <td className="py-2 truncate pr-2" title={homeTeamName}>
                  {homeTeamName.length > 8 ? homeTeamName.substring(0, 8) + '...' : homeTeamName}
                </td>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                  <td key={i} className="text-center py-2">
                    {i < gameState.inning ? getInningScore(i, 1) : '·'}
                  </td>
                ))}
                <td className="text-center py-2 border-l border-gray-700 font-bold">{gameState.scores[1]}</td>
                <td className="text-center py-2">{gameStats.home.hits}</td>
                <td className="text-center py-2">0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Game Statistics */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h3 className="text-lg font-bold text-white mb-3 text-center">Game Statistics</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="text-gray-400 font-bold mb-2">{visitorTeamName}</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Hits</span>
                <span className="text-white">{gameStats.visitor.hits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Home Runs</span>
                <span className="text-white">{gameStats.visitor.homeRuns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Strikeouts</span>
                <span className="text-white">{gameStats.visitor.strikeouts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Walks</span>
                <span className="text-white">{gameStats.visitor.walks}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-gray-400 font-bold mb-2">{homeTeamName}</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Hits</span>
                <span className="text-white">{gameStats.home.hits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Home Runs</span>
                <span className="text-white">{gameStats.home.homeRuns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Strikeouts</span>
                <span className="text-white">{gameStats.home.strikeouts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Walks</span>
                <span className="text-white">{gameStats.home.walks}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Moments */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h3 className="text-lg font-bold text-white mb-3 text-center">Key Moments</h3>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {playLog
            .filter(play => play.runsScored > 0 || play.outcome === 'homeRun')
            .slice(0, 5)
            .map((play, index) => (
              <div key={index} className="text-sm p-2 bg-gray-700/50 rounded">
                <span className="text-yellow-400">⭐</span> {play.description}
              </div>
            ))}
          {playLog.filter(play => play.runsScored > 0 || play.outcome === 'homeRun').length === 0 && (
            <p className="text-gray-400 text-sm text-center py-2">No scoring plays recorded</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        {onPlayAgain && (
          <Button onClick={onPlayAgain} className="bg-green-600 hover:bg-green-700">
            🔄 Play Again
          </Button>
        )}
        <Button variant="secondary" onClick={onGoHome}>
          🏠 Home
        </Button>
      </div>
    </div>
  );
}

// Fallback: approximate game statistics from play log when canonical stats unavailable
function calculateGameStats(playLog: Array<{ outcome: string; runsScored: number }>): {
  visitor: TeamStats;
  home: TeamStats;
} {
  const stats = {
    visitor: { hits: 0, homeRuns: 0, strikeouts: 0, walks: 0 },
    home: { hits: 0, homeRuns: 0, strikeouts: 0, walks: 0 },
  };

  playLog.forEach((play, index) => {
    const team = index % 2 === 0 ? 'visitor' : 'home';

    switch (play.outcome) {
      case 'homeRun':
        stats[team].hits++;
        stats[team].homeRuns++;
        break;
      case 'triple':
      case 'double':
      case 'single':
        stats[team].hits++;
        break;
      case 'walk':
        stats[team].walks++;
        break;
      case 'strikeout':
        stats[team].strikeouts++;
        break;
    }
  });

  return stats;
}
