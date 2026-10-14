/**
 * Run metrics.
 *
 * Measured outcomes of a game that has actually been played, as opposed to the
 * route analysis in analysis.ts, which measures the map before anyone moves.
 * Keep the distinction: analysis says what the map allows, stats say what
 * happened under one set of choices.
 *
 * One run is an anecdote. Compare runs, or batch them, before concluding
 * anything about balance.
 */

import type { Board } from './board';
import type { RoundSummary } from './rounds';
import type { SimState } from './state';

export interface Spread {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
}

export interface RunStats {
  readonly roundsResolved: number;
  readonly teams: {
    readonly total: number;
    readonly active: number;
    readonly atTrailhead: number;
    readonly escaped: number;
    readonly eliminated: number;
  };
  readonly encounters: {
    readonly total: number;
    readonly sharedHex: number;
    readonly swap: number;
    /** Rounds in which at least one encounter happened. */
    readonly roundsWithContact: number;
    /** Teams that met someone at least once. */
    readonly teamsInvolved: number;
  };
  /** Distinct hexes any team stood on, against the passable hexes available. */
  readonly coverage: {
    readonly visited: number;
    readonly passable: number;
    readonly fraction: number;
  };
  readonly movesPerTeam: Spread | null;
  /** Rounds taken by the teams that reached a trailhead. */
  readonly roundsToTrailhead: Spread | null;
  /** How many teams came out of each trailhead, by trailhead id. */
  readonly trailheadUse: Readonly<Record<string, number>>;
}

function spread(values: readonly number[]): Spread | null {
  if (values.length === 0) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
  };
}

export function summarizeRun(
  board: Board,
  state: SimState,
  history: readonly RoundSummary[],
): RunStats {
  const visited = new Set<string>();
  for (const team of state.teams) for (const hexId of team.visited) visited.add(hexId);
  const passable = board.hexIds.filter((id) => board.isPassable(id)).length;

  let sharedHex = 0;
  let swap = 0;
  let roundsWithContact = 0;
  const involved = new Set<string>();
  for (const round of history) {
    if (round.encounters.length > 0) roundsWithContact++;
    for (const encounter of round.encounters) {
      if (encounter.kind === 'swap') swap++;
      else sharedHex++;
      for (const teamId of encounter.teamIds) involved.add(teamId);
    }
  }

  const trailheadUse: Record<string, number> = {};
  for (const team of state.teams) {
    if (team.trailheadId === null) continue;
    trailheadUse[team.trailheadId] = (trailheadUse[team.trailheadId] ?? 0) + 1;
  }

  const byStatus = (status: string) => state.teams.filter((t) => t.status === status).length;

  return Object.freeze({
    roundsResolved: history.length,
    teams: {
      total: state.teams.length,
      active: byStatus('active'),
      atTrailhead: byStatus('at_trailhead'),
      escaped: byStatus('escaped'),
      eliminated: byStatus('eliminated'),
    },
    encounters: {
      total: sharedHex + swap,
      sharedHex,
      swap,
      roundsWithContact,
      teamsInvolved: involved.size,
    },
    coverage: {
      visited: visited.size,
      passable,
      fraction: passable === 0 ? 0 : visited.size / passable,
    },
    // visited includes the start hex, so moves = visited length - 1.
    movesPerTeam: spread(state.teams.map((t) => t.visited.length - 1)),
    roundsToTrailhead: spread(
      state.teams
        .filter((t) => t.trailheadId !== null && t.stoppedOnRound !== null)
        .map((t) => t.stoppedOnRound!),
    ),
    trailheadUse: Object.freeze(trailheadUse),
  });
}
