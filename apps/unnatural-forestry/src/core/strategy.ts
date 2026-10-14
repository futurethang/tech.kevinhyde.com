/**
 * Scripted movement strategies.
 *
 * These exist to make playtesting cheap: one button fills in a plausible move
 * for every team so you can advance rounds without 30 clicks. They are a
 * testing instrument, NOT a model of how guests will actually play — a real
 * table will read clues, chase items, and avoid each other on purpose.
 *
 * A strategy drifts toward the nearest exit while leaving enough slack to
 * spread teams across the map and run them into each other. The drift is a
 * weighted draw over the legal moves, graded by what each move does to the
 * team's distance-to-exit:
 *
 *   toward   - the move shortens the distance to the nearest open trailhead
 *   lateral  - the distance is unchanged
 *   away     - the move lengthens it (an inward detour)
 *   hold     - stay put
 *
 * Pure: every draw comes from the Rng handed in, so the same seed and the same
 * sequence of calls reproduce the same game.
 */

import type { Board } from './board';
import type { DistanceField } from './analysis';
import type { Rng } from './rng';
import { activeTeams, legalMoves, type SimState, type TeamState } from './state';
import type { ResolvedScenario } from './types';

export interface StrategyWeights {
  readonly toward: number;
  readonly lateral: number;
  readonly away: number;
  readonly hold: number;
}

export interface StrategyDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly weights: StrategyWeights;
}

/**
 * Three test behaviours, from "everyone sprints for the door" to "nobody has
 * any idea where they are". Tunable: these are starting points for playtesting,
 * not claims about real player behaviour.
 */
export const STRATEGIES: readonly StrategyDefinition[] = Object.freeze([
  {
    id: 'beeline',
    label: 'Beeline',
    description: 'Almost always takes a shortest route out. Fastest games, fewest collisions.',
    weights: { toward: 10, lateral: 2, away: 0.3, hold: 0.1 },
  },
  {
    id: 'balanced',
    label: 'Balanced drift',
    description: 'Heads out, but detours often enough to spread across the map and collide.',
    weights: { toward: 5, lateral: 3, away: 1.2, hold: 0.3 },
  },
  {
    id: 'wander',
    label: 'Lost in the woods',
    description: 'Barely goal-directed. Long games, lots of contact, covers the whole map.',
    weights: { toward: 2, lateral: 3, away: 2, hold: 0.5 },
  },
]);

export const DEFAULT_STRATEGY_ID = 'balanced';

export function getStrategy(id: string): StrategyDefinition {
  const found = STRATEGIES.find((s) => s.id === id);
  if (!found) throw new Error(`unknown strategy "${id}" (have: ${STRATEGIES.map((s) => s.id).join(', ')})`);
  return found;
}

/** The weight class a candidate move falls into, given the team's own distance. */
export function classifyMove(
  from: string,
  to: string,
  field: DistanceField,
): keyof StrategyWeights {
  if (from === to) return 'hold';
  const here = field.dist.get(from);
  const there = field.dist.get(to);
  if (here === undefined || there === undefined) return 'lateral';
  if (there < here) return 'toward';
  if (there > here) return 'away';
  return 'lateral';
}

/**
 * Picks one legal destination for a team. Returns null when the team has no
 * legal move at all (walled in with holding position disallowed).
 */
export function chooseMove(
  board: Board,
  resolved: ResolvedScenario,
  team: TeamState,
  field: DistanceField,
  rng: Rng,
  weights: StrategyWeights,
): string | null {
  const moves = legalMoves(board, resolved, team);
  if (moves.length === 0) return null;

  const weighted = moves.map((hexId) => ({
    hexId,
    weight: Math.max(weights[classifyMove(team.hexId, hexId, field)], 0),
  }));
  const total = weighted.reduce((sum, m) => sum + m.weight, 0);
  // Every class weighted to zero: fall back to a flat draw rather than freezing.
  if (total <= 0) return moves[rng.int(moves.length)]!;

  let roll = rng.next() * total;
  for (const move of weighted) {
    roll -= move.weight;
    if (roll <= 0) return move.hexId;
  }
  return weighted[weighted.length - 1]!.hexId;
}

/**
 * One destination per active team, drawn in sorted team order so a given seed
 * always produces the same round regardless of roster ordering.
 */
export function chooseAllMoves(
  board: Board,
  resolved: ResolvedScenario,
  state: SimState,
  field: DistanceField,
  rng: Rng,
  weights: StrategyWeights,
): Map<string, string> {
  const out = new Map<string, string>();
  const teams = [...activeTeams(state)].sort((a, b) => a.id.localeCompare(b.id));
  for (const team of teams) {
    const choice = chooseMove(board, resolved, team, field, rng, weights);
    if (choice !== null) out.set(team.id, choice);
  }
  return out;
}
