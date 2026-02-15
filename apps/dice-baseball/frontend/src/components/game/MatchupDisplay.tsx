/**
 * MatchupDisplay Component - Shows current batter vs pitcher with stats
 * v5 Topps design: color-block card frames, JetBrains Mono stats
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
            <div className="w-16 h-16 rounded-full bg-[var(--color-topps-blue)] flex items-center justify-center text-2xl mb-2">
              {batter ? getPlayerInitials(batter.fullName) : '\u26BE'}
            </div>
            {batter && <p className="text-sm text-[var(--color-text-primary)] font-semibold truncate max-w-28">{batter.fullName}</p>}
            <p className="text-sm text-[var(--color-text-muted)]">AT BAT</p>
          </div>
          <span className="text-[var(--color-text-dim)] text-xl font-display">VS</span>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-card-red)] flex items-center justify-center text-2xl mb-2">
              {pitcher ? getPlayerInitials(pitcher.fullName) : '\u26BE'}
            </div>
            {pitcher && <p className="text-sm text-[var(--color-text-primary)] font-semibold truncate max-w-28">{pitcher.fullName}</p>}
            <p className="text-sm text-[var(--color-text-muted)]">PITCHING</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 bg-black grid gap-[1px]">
      <div className="bg-[var(--color-surface-card)] p-4">
        <div className="flex justify-center gap-6 items-center">
          {/* Batter */}
          <div className="text-center flex-1">
            <div className="w-16 h-16 rounded-full bg-[var(--color-topps-blue)] flex items-center justify-center text-xl mb-2 mx-auto text-white font-display">
              {getPlayerInitials(batter.fullName)}
            </div>
            <h3 className="text-[var(--color-text-primary)] font-bold text-sm mb-1 truncate font-display">
              {batter.fullName}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">{batter.primaryPosition} &bull; {batter.currentTeam}</p>

            {batter.battingStats && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">AVG</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{batter.battingStats.avg.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">OPS</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{batter.battingStats.ops.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">HR</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{batter.battingStats.homeRuns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">RBI</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{batter.battingStats.rbi}</span>
                </div>
              </div>
            )}

            <div className="mt-2 text-xs">
              <span className="bg-[var(--color-topps-blue)] text-white px-2 py-1 text-xs font-display">AT BAT</span>
            </div>
          </div>

          {/* VS */}
          <div className="text-center">
            <span className="text-[var(--color-text-dim)] text-2xl font-bold font-display">VS</span>
          </div>

          {/* Pitcher */}
          <div className="text-center flex-1">
            <div className="w-16 h-16 rounded-full bg-[var(--color-card-red)] flex items-center justify-center text-xl mb-2 mx-auto text-white font-display">
              {getPlayerInitials(pitcher.fullName)}
            </div>
            <h3 className="text-[var(--color-text-primary)] font-bold text-sm mb-1 truncate font-display">
              {pitcher.fullName}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">{pitcher.primaryPosition} &bull; {pitcher.currentTeam}</p>

            {pitcher.pitchingStats && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">ERA</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{pitcher.pitchingStats.era.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">WHIP</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{pitcher.pitchingStats.whip.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">K/9</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{pitcher.pitchingStats.kPer9.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">W-L</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{pitcher.pitchingStats.wins}-{pitcher.pitchingStats.losses}</span>
                </div>
              </div>
            )}

            <div className="mt-2">
              <span className="bg-[var(--color-card-red)] text-white px-2 py-1 text-xs font-display">PITCHING</span>
            </div>
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
