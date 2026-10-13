/**
 * Mutable simulation state — kept strictly separate from the JSON config.
 *
 * State objects are plain, readonly-typed, and JSON-serialisable so the whole
 * simulation can be dumped into the inspector. Round resolution produces a new
 * SimState rather than editing one in place, which is what makes simultaneous
 * resolution order-independent and replayable.
 */

import type { Board } from './board';
import type { ResolvedScenario } from './types';

export type TeamStatus =
  /** Still in the forest and moving each round. */
  | 'active'
  /** Standing on an open trailhead, awaiting the escape test (unimplemented). */
  | 'at_trailhead'
  /** Passed the escape test. Reserved; nothing sets this in milestone 1. */
  | 'escaped'
  /** Out of the game. Reserved; nothing sets this in milestone 1. */
  | 'eliminated';

export interface TeamState {
  readonly id: string;
  readonly hexId: string;
  readonly status: TeamStatus;
  readonly items: readonly string[];
  /** Every hex occupied, in order, starting with the team's start hex. */
  readonly visited: readonly string[];
  /** Trailhead the team is standing on, when status is at_trailhead. */
  readonly trailheadId: string | null;
  readonly encounterCount: number;
  /** Round the team stopped being active, or null while still active. */
  readonly stoppedOnRound: number | null;
}

export interface SimState {
  /** The round that will be resolved next. 1-based. */
  readonly round: number;
  readonly teams: readonly TeamState[];
  /** Hexes whose hidden contents have been revealed to the table. */
  readonly revealedHexIds: readonly string[];
  /** PRNG state carried between rounds so a replay reproduces draws. */
  readonly rngState: number;
}

export function createInitialState(resolved: ResolvedScenario): SimState {
  const teams = resolved.scenario.teams.map<TeamState>((t) =>
    Object.freeze({
      id: t.id,
      hexId: t.startHexId,
      status: 'active',
      items: Object.freeze([...t.items]),
      visited: Object.freeze([t.startHexId]),
      trailheadId: null,
      encounterCount: 0,
      stoppedOnRound: null,
    }),
  );
  return Object.freeze({
    round: 1,
    teams: Object.freeze(teams),
    revealedHexIds: Object.freeze([]),
    rngState: resolved.scenario.seed >>> 0,
  });
}

export function findTeam(state: SimState, teamId: string): TeamState {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) throw new Error(`unknown team "${teamId}"`);
  return team;
}

/** Teams that must commit a move this round. */
export function activeTeams(state: SimState): readonly TeamState[] {
  return state.teams.filter((t) => t.status === 'active');
}

/** True when the team is allowed to choose a move this round. */
export function canMove(team: TeamState): boolean {
  return team.status === 'active';
}

/**
 * Destinations a team may legally commit to this round: adjacent passable
 * hexes, plus its own hex when the scenario allows holding position.
 * An ineligible team (at a trailhead, escaped, eliminated) has none.
 */
export function legalMoves(
  board: Board,
  resolved: ResolvedScenario,
  team: TeamState,
): readonly string[] {
  if (!canMove(team)) return [];
  const moves = [...board.passableNeighbors(team.hexId)];
  if (resolved.scenario.rules.allowStayInPlace) moves.push(team.hexId);
  return Object.freeze(moves);
}

/** Hexes any team has stood on — the prototype's notion of "explored". */
export function exploredHexIds(state: SimState): Set<string> {
  const out = new Set<string>();
  for (const team of state.teams) for (const id of team.visited) out.add(id);
  return out;
}

/** teamIds grouped by the hex they currently occupy. */
export function occupancy(state: SimState): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const team of state.teams) {
    if (team.status === 'escaped' || team.status === 'eliminated') continue;
    const list = out.get(team.hexId);
    if (list) list.push(team.id);
    else out.set(team.hexId, [team.id]);
  }
  return out;
}
