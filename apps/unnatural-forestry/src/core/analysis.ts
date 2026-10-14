/**
 * Route analysis — the tooling that answers design questions about a map:
 * how far the exits are, whether a start has real route choice, and which
 * hexes or trailheads are stranded.
 *
 * All distances are in moves (one hex per move) over passable terrain.
 */

import type { Board } from './board';

export interface DistanceField {
  /** Hexes the measurement starts from. */
  readonly sources: readonly string[];
  /** hexId -> moves to the nearest source. Absent means unreachable. */
  readonly dist: ReadonlyMap<string, number>;
}

/**
 * Breadth-first distance from a set of source hexes over passable terrain.
 * Impassable sources are ignored; impassable hexes never get a distance.
 */
export function distanceField(board: Board, sources: readonly string[]): DistanceField {
  const dist = new Map<string, number>();
  const queue: string[] = [];
  for (const id of sources) {
    if (!board.isPassable(id) || dist.has(id)) continue;
    dist.set(id, 0);
    queue.push(id);
  }
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    const d = dist.get(current)! + 1;
    for (const next of board.passableNeighbors(current)) {
      if (dist.has(next)) continue;
      dist.set(next, d);
      queue.push(next);
    }
  }
  return { sources: Object.freeze([...sources]), dist };
}

/** Distance from every hex to the nearest OPEN trailhead. */
export function exitDistanceField(board: Board): DistanceField {
  return distanceField(board, board.openTrailheadHexIds);
}

/**
 * One shortest path from `from` to `to`, inclusive of both ends.
 * Returns undefined when no passable route exists.
 */
export function shortestPath(board: Board, from: string, to: string): string[] | undefined {
  if (!board.isPassable(from) || !board.isPassable(to)) return undefined;
  if (from === to) return [from];
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    for (const next of board.passableNeighbors(current)) {
      if (prev.has(next)) continue;
      prev.set(next, current);
      if (next === to) {
        const path = [to];
        let cursor = to;
        while (cursor !== from) {
          cursor = prev.get(cursor)!;
          path.push(cursor);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return undefined;
}

/**
 * How many distinct shortest routes lead from `hexId` to the nearest exit,
 * counted over the exit distance field. Capped so a wide-open map cannot
 * produce an unbounded count.
 */
export function countShortestExitRoutes(
  board: Board,
  field: DistanceField,
  hexId: string,
  cap = 10_000,
): number {
  const memo = new Map<string, number>();
  const walk = (id: string): number => {
    const d = field.dist.get(id);
    if (d === undefined) return 0;
    if (d === 0) return 1;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const next of board.passableNeighbors(id)) {
      if (field.dist.get(next) === d - 1) total += walk(next);
      if (total >= cap) {
        total = cap;
        break;
      }
    }
    memo.set(id, total);
    return total;
  };
  return walk(hexId);
}

export interface TrailheadDistance {
  readonly trailheadId: string;
  readonly hexId: string;
  readonly closed: boolean;
  /** null when no passable route exists. */
  readonly distance: number | null;
}

export interface StartAnalysis {
  readonly hexId: string;
  /** Moves to the closest open trailhead; null if none is reachable. */
  readonly nearestExitDistance: number | null;
  readonly nearestTrailheadIds: readonly string[];
  readonly trailheadDistances: readonly TrailheadDistance[];
  /** Open trailheads with any route at all. */
  readonly reachableTrailheadCount: number;
  /** Legal first moves that stay on a shortest route to some open exit. */
  readonly optimalFirstSteps: readonly string[];
  /** Legal first moves that do not shorten the distance to an exit. */
  readonly detourFirstSteps: readonly string[];
  readonly shortestRouteCount: number;
}

export function analyzeStart(board: Board, hexId: string, field = exitDistanceField(board)): StartAnalysis {
  const own = field.dist.get(hexId);
  const trailheadDistances = board.map.trailheads.map((t) => {
    const path = t.closed ? undefined : shortestPath(board, hexId, t.hexId);
    return Object.freeze({
      trailheadId: t.id,
      hexId: t.hexId,
      closed: t.closed,
      distance: path ? path.length - 1 : null,
    }) satisfies TrailheadDistance;
  });

  const open = trailheadDistances.filter((t) => !t.closed && t.distance !== null);
  const nearest = open.length > 0 ? Math.min(...open.map((t) => t.distance!)) : null;

  const steps = board.passableNeighbors(hexId);
  const optimalFirstSteps =
    own === undefined ? [] : steps.filter((n) => field.dist.get(n) === own - 1);
  const detourFirstSteps = steps.filter((n) => !optimalFirstSteps.includes(n));

  return Object.freeze({
    hexId,
    nearestExitDistance: nearest,
    nearestTrailheadIds: Object.freeze(
      open.filter((t) => t.distance === nearest).map((t) => t.trailheadId),
    ),
    trailheadDistances: Object.freeze(trailheadDistances),
    reachableTrailheadCount: open.length,
    optimalFirstSteps: Object.freeze(optimalFirstSteps),
    detourFirstSteps: Object.freeze(detourFirstSteps),
    shortestRouteCount: countShortestExitRoutes(board, field, hexId),
  });
}

export interface MapAnalysis {
  readonly hexCount: number;
  readonly passableHexCount: number;
  readonly exitDistance: DistanceField;
  /** Passable hexes with no route to any open trailhead. */
  readonly strandedHexIds: readonly string[];
  /** Open trailheads no start position can reach. */
  readonly unreachableTrailheadIds: readonly string[];
  readonly starts: readonly StartAnalysis[];
  /** Spread of nearest-exit distance across the analysed starts. */
  readonly startDistance: { readonly min: number; readonly max: number; readonly mean: number } | null;
}

/**
 * Whole-map report. `startHexIds` defaults to the map's declared start
 * positions, so a scenario can analyse its own team placements instead.
 */
export function analyzeMap(board: Board, startHexIds?: readonly string[]): MapAnalysis {
  const field = exitDistanceField(board);
  const starts = (startHexIds ?? board.map.startPositions.map((s) => s.hexId)).map((id) =>
    analyzeStart(board, id, field),
  );

  const strandedHexIds = board.hexIds.filter(
    (id) => board.isPassable(id) && !field.dist.has(id),
  );

  const reachableFromStarts = new Set<string>();
  for (const start of starts) {
    for (const t of start.trailheadDistances) {
      if (!t.closed && t.distance !== null) reachableFromStarts.add(t.trailheadId);
    }
  }
  const unreachableTrailheadIds = board.map.trailheads
    .filter((t) => !t.closed && !reachableFromStarts.has(t.id))
    .map((t) => t.id);

  const measured = starts.map((s) => s.nearestExitDistance).filter((d): d is number => d !== null);
  const startDistance =
    measured.length === 0
      ? null
      : {
          min: Math.min(...measured),
          max: Math.max(...measured),
          mean: measured.reduce((a, b) => a + b, 0) / measured.length,
        };

  return Object.freeze({
    hexCount: board.hexIds.length,
    passableHexCount: board.hexIds.filter((id) => board.isPassable(id)).length,
    exitDistance: field,
    strandedHexIds: Object.freeze(strandedHexIds),
    unreachableTrailheadIds: Object.freeze(unreachableTrailheadIds),
    starts: Object.freeze(starts),
    startDistance,
  });
}

// ---------------------------------------------------------------------------
// Move budget
// ---------------------------------------------------------------------------

export interface StartBudget {
  readonly hexId: string;
  /** Moves to the nearest open trailhead; null when none is reachable. */
  readonly distance: number | null;
  /** Spare moves after walking a shortest route. Negative means unreachable in time. */
  readonly slack: number | null;
  readonly feasible: boolean;
}

export interface BudgetReport {
  /** Total moves a team gets in a whole game: rounds x moves per round. */
  readonly budget: number;
  readonly starts: readonly StartBudget[];
  /** Every start can reach an exit inside the budget. */
  readonly allFeasible: boolean;
  /** Every start sits the same number of moves from its nearest exit. */
  readonly equidistant: boolean;
  /** Starts whose shortest route uses the entire budget — no room to detour. */
  readonly zeroSlackCount: number;
}

/**
 * Checks the map against the move budget the party actually allows.
 *
 * With a hard round cap, "the exit is reachable" is not enough — it has to be
 * reachable *in time*. Slack is what a team can spend on a detour and still get
 * out; zero slack means every detour is fatal unless something refunds a move.
 */
export function analyzeBudget(analysis: MapAnalysis, budget: number): BudgetReport {
  const starts = analysis.starts.map<StartBudget>((start) => {
    const distance = start.nearestExitDistance;
    const slack = distance === null ? null : budget - distance;
    return Object.freeze({
      hexId: start.hexId,
      distance,
      slack,
      feasible: slack !== null && slack >= 0,
    });
  });
  const distances = starts.map((s) => s.distance);
  return Object.freeze({
    budget,
    starts: Object.freeze(starts),
    allFeasible: starts.every((s) => s.feasible),
    equidistant: new Set(distances).size <= 1,
    zeroSlackCount: starts.filter((s) => s.slack === 0).length,
  });
}
