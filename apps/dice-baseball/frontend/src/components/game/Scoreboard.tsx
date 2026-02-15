/**
 * Scoreboard Component - 9-inning scoreboard
 * v5 Topps design: Doto font scores, black grid, red header bar
 */

import { Card } from '../common';
import type { GameState } from '../../types';

interface ScoreboardProps {
  state: GameState | null;
  playLog: Array<{ inning: number; isTopOfInning: boolean; runsScored: number }>;
  homeName: string;
  visitorName: string;
}

export function Scoreboard({ state, playLog, homeName, visitorName }: ScoreboardProps) {
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
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'var(--font-score)' }}>
          <thead>
            <tr className="bg-[var(--color-card-red)] text-white">
              <th className="w-24 text-left px-2 py-1 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>TEAM</th>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <th key={i} className={`w-6 text-center py-1 font-semibold ${i === state.inning ? 'text-[var(--color-topps-gold)]' : ''}`}>
                  {i}
                </th>
              ))}
              <th className="w-6 text-center py-1 font-bold border-l border-white/20">R</th>
            </tr>
          </thead>
          <tbody className="bg-[var(--color-surface-scoreboard)]">
            <tr className="border-b border-[var(--color-text-dim)]/20">
              <td className="text-[var(--color-text-secondary)] px-2 py-1.5" style={{ fontFamily: 'var(--font-display)' }} title={visitorName}>
                {truncateName(visitorName)}
              </td>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <td key={i} className="text-center text-[var(--color-text-primary)]" style={{ fontWeight: 600 }}>
                  {renderHalfCell(i, true)}
                </td>
              ))}
              <td className="text-center font-bold text-[var(--color-topps-gold)] border-l border-[var(--color-text-dim)]/20" style={{ fontWeight: 800 }}>
                {state.scores[0]}
              </td>
            </tr>
            <tr>
              <td className="text-[var(--color-text-secondary)] px-2 py-1.5" style={{ fontFamily: 'var(--font-display)' }} title={homeName}>
                {truncateName(homeName)}
              </td>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <td key={i} className="text-center text-[var(--color-text-primary)]" style={{ fontWeight: 600 }}>
                  {renderHalfCell(i, false)}
                </td>
              ))}
              <td className="text-center font-bold text-[var(--color-topps-gold)] border-l border-[var(--color-text-dim)]/20" style={{ fontWeight: 800 }}>
                {state.scores[1]}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
