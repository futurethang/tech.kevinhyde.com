/**
 * MatchupDisplay Component - Shows current batter vs pitcher with stats
 */

import type { MLBPlayer } from '../../types';

interface MatchupDisplayProps {
  batter: MLBPlayer | null;
  pitcher: MLBPlayer | null;
}

export function MatchupDisplay({ batter, pitcher }: MatchupDisplayProps) {
  if (!batter || !pitcher) {
    return (
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
    );
  }

  return (
    <div className="my-4 bg-gray-800/50 rounded-lg p-4">
      <div className="flex justify-center gap-6 items-center">
        {/* Batter */}
        <div className="text-center flex-1">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl mb-2 mx-auto">
            {getPlayerInitials(batter.fullName)}
          </div>
          <h3 className="text-white font-bold text-sm mb-1 truncate">
            {batter.fullName}
          </h3>
          <p className="text-xs text-gray-400 mb-2">{batter.primaryPosition} • {batter.currentTeam}</p>
          
          {batter.battingStats && (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">AVG</span>
                <span className="text-white font-mono">{batter.battingStats.avg.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">OPS</span>
                <span className="text-white font-mono">{batter.battingStats.ops.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">HR</span>
                <span className="text-white font-mono">{batter.battingStats.homeRuns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">RBI</span>
                <span className="text-white font-mono">{batter.battingStats.rbi}</span>
              </div>
            </div>
          )}
          
          <div className="mt-2 text-xs">
            <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">AT BAT</span>
          </div>
        </div>

        {/* VS */}
        <div className="text-center">
          <span className="text-gray-500 text-2xl font-bold">VS</span>
        </div>

        {/* Pitcher */}
        <div className="text-center flex-1">
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-xl mb-2 mx-auto">
            {getPlayerInitials(pitcher.fullName)}
          </div>
          <h3 className="text-white font-bold text-sm mb-1 truncate">
            {pitcher.fullName}
          </h3>
          <p className="text-xs text-gray-400 mb-2">{pitcher.primaryPosition} • {pitcher.currentTeam}</p>
          
          {pitcher.pitchingStats && (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">ERA</span>
                <span className="text-white font-mono">{pitcher.pitchingStats.era.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">WHIP</span>
                <span className="text-white font-mono">{pitcher.pitchingStats.whip.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">K/9</span>
                <span className="text-white font-mono">{pitcher.pitchingStats.kPer9.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">W-L</span>
                <span className="text-white font-mono">{pitcher.pitchingStats.wins}-{pitcher.pitchingStats.losses}</span>
              </div>
            </div>
          )}
          
          <div className="mt-2">
            <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">PITCHING</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPlayerInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}