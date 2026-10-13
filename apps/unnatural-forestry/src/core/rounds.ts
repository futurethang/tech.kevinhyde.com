/**
 * Simultaneous round resolution.
 *
 * The one rule that matters here: every team's destination is computed from the
 * state *before* the round, and all destinations are applied together. No team
 * sees another team's move, and nothing depends on the order teams are stored
 * or processed in. Records are emitted sorted by team id so two resolutions of
 * the same round are comparable byte for byte.
 *
 * Milestone 1 reports encounters; it does not resolve them. It also does not
 * apply hazards, items, eliminations or escape tests.
 */

import type { Board } from './board';
import { createRng } from './rng';
import { activeTeams, type SimState, type TeamState } from './state';
import type { ResolvedScenario } from './types';

export type MoveOutcome =
  /** Entered a different hex. */
  | 'moved'
  /** Chose to hold position. */
  | 'held'
  /** No choice was committed and the facilitator forced resolution. */
  | 'held-no-choice'
  /** Wanted to swap hexes with another team, but the scenario forbids swaps. */
  | 'blocked-swap'
  /** Not eligible to move (at a trailhead, escaped, or eliminated). */
  | 'ineligible';

export interface TeamMoveRecord {
  readonly teamId: string;
  readonly fromHexId: string;
  readonly toHexId: string;
  /** What the team committed to, or null if nothing was committed. */
  readonly requestedHexId: string | null;
  readonly outcome: MoveOutcome;
  readonly reachedTrailheadId: string | null;
  /** Other teams sharing the destination hex, or crossing paths with it. */
  readonly encounteredTeamIds: readonly string[];
}

export type EncounterKind =
  /** Two or more teams ended the round on the same hex. */
  | 'shared-hex'
  /** Two teams traded hexes and would have met on the trail between them. */
  | 'swap';

export interface Encounter {
  readonly kind: EncounterKind;
  /** The hex teams share; for a swap, the lower-sorting of the two hexes. */
  readonly hexId: string;
  readonly teamIds: readonly string[];
}

export type SimEventType =
  | 'move'
  | 'hold'
  | 'missing-choice'
  | 'blocked-swap'
  | 'encounter'
  | 'trailhead-reached'
  | 'content-revealed';

export interface SimEvent {
  readonly round: number;
  readonly type: SimEventType;
  readonly teamIds: readonly string[];
  readonly hexId: string | null;
  readonly message: string;
}

export interface RoundSummary {
  readonly round: number;
  readonly moves: readonly TeamMoveRecord[];
  readonly encounters: readonly Encounter[];
  readonly events: readonly SimEvent[];
  /** PRNG state before and after the round, for replay. */
  readonly rng: { readonly before: number; readonly after: number };
}

export interface ResolveResult {
  readonly state: SimState;
  readonly summary: RoundSummary;
}

export interface ChoiceProblems {
  /** Active teams with no committed choice. */
  readonly missing: readonly string[];
  /** Committed choices that are not legal destinations. */
  readonly illegal: readonly { readonly teamId: string; readonly hexId: string }[];
  /** Choices naming a team that cannot move this round. */
  readonly ineligible: readonly string[];
}

/** Checks committed choices without resolving. Used to gate the Resolve button. */
export function validateChoices(
  board: Board,
  resolved: ResolvedScenario,
  state: SimState,
  choices: ReadonlyMap<string, string>,
): ChoiceProblems {
  const missing: string[] = [];
  const illegal: { teamId: string; hexId: string }[] = [];
  const ineligible: string[] = [];

  const movable = new Set(activeTeams(state).map((t) => t.id));
  for (const team of activeTeams(state)) {
    const choice = choices.get(team.id);
    if (choice === undefined) {
      missing.push(team.id);
      continue;
    }
    const legal =
      choice === team.hexId
        ? resolved.scenario.rules.allowStayInPlace
        : board.passableNeighbors(team.hexId).includes(choice);
    if (!legal) illegal.push({ teamId: team.id, hexId: choice });
  }
  for (const teamId of choices.keys()) {
    if (!movable.has(teamId)) ineligible.push(teamId);
  }
  return {
    missing: missing.sort(),
    illegal: illegal.sort((a, b) => a.teamId.localeCompare(b.teamId)),
    ineligible: ineligible.sort(),
  };
}

export interface ResolveOptions {
  /**
   * Debug override: resolve even though some active teams have not committed.
   * Those teams hold position and the round records a `missing-choice` event.
   */
  readonly allowMissingChoices?: boolean;
}

/**
 * Resolves one round. Pure: given the same board, scenario, state, choices and
 * options it always returns the same result, and it never mutates its inputs.
 */
export function resolveRound(
  board: Board,
  resolved: ResolvedScenario,
  state: SimState,
  choices: ReadonlyMap<string, string>,
  options: ResolveOptions = {},
): ResolveResult {
  const round = state.round;
  const problems = validateChoices(board, resolved, state, choices);
  if (problems.illegal.length > 0) {
    const first = problems.illegal[0]!;
    throw new Error(`team "${first.teamId}" committed an illegal destination "${first.hexId}"`);
  }
  if (problems.ineligible.length > 0) {
    throw new Error(`teams cannot move this round: ${problems.ineligible.join(', ')}`);
  }
  if (problems.missing.length > 0 && options.allowMissingChoices !== true) {
    throw new Error(
      `cannot resolve: ${problems.missing.length} team(s) have not committed (${problems.missing.join(', ')})`,
    );
  }

  // Canonical iteration order: nothing below may depend on team array order.
  const teams = [...state.teams].sort((a, b) => a.id.localeCompare(b.id));
  const events: SimEvent[] = [];
  const log = (type: SimEventType, teamIds: string[], hexId: string | null, message: string) =>
    events.push(Object.freeze({ round, type, teamIds: Object.freeze(teamIds), hexId, message }));

  // --- 1. Intended destinations, read from the pre-round state only. --------
  interface Intent {
    readonly team: TeamState;
    readonly requested: string | null;
    destination: string;
    outcome: MoveOutcome;
  }
  const intents: Intent[] = teams.map((team) => {
    if (team.status !== 'active') {
      return { team, requested: null, destination: team.hexId, outcome: 'ineligible' };
    }
    const requested = choices.get(team.id) ?? null;
    if (requested === null) {
      log('missing-choice', [team.id], team.hexId, `${team.id} did not commit; holding position`);
      return { team, requested: null, destination: team.hexId, outcome: 'held-no-choice' };
    }
    return {
      team,
      requested,
      destination: requested,
      outcome: requested === team.hexId ? 'held' : 'moved',
    };
  });

  // --- 2. Swaps: two teams trading hexes in the same round. -----------------
  const swaps: { a: Intent; b: Intent }[] = [];
  const originOwner = new Map<string, Intent>();
  for (const intent of intents) originOwner.set(intent.team.hexId, intent);
  for (const intent of intents) {
    if (intent.outcome !== 'moved') continue;
    const other = originOwner.get(intent.destination);
    if (!other || other.outcome !== 'moved') continue;
    if (other.destination !== intent.team.hexId) continue;
    // Record each pair once, keyed on the lower-sorting team id.
    if (intent.team.id.localeCompare(other.team.id) < 0) swaps.push({ a: intent, b: other });
  }
  if (!resolved.scenario.rules.allowSwaps) {
    for (const { a, b } of swaps) {
      for (const blocked of [a, b]) {
        blocked.destination = blocked.team.hexId;
        blocked.outcome = 'blocked-swap';
      }
      log(
        'blocked-swap',
        [a.team.id, b.team.id],
        a.team.hexId,
        `${a.team.id} and ${b.team.id} tried to trade hexes; both held position`,
      );
    }
  }

  for (const intent of intents) {
    if (intent.outcome === 'moved') {
      log(
        'move',
        [intent.team.id],
        intent.destination,
        `${intent.team.id} ${intent.team.hexId} -> ${intent.destination}`,
      );
    } else if (intent.outcome === 'held') {
      log('hold', [intent.team.id], intent.destination, `${intent.team.id} held at ${intent.destination}`);
    }
  }

  // --- 3. Apply every destination at once. ---------------------------------
  const arrivals = new Map<string, string[]>();
  for (const intent of intents) {
    const list = arrivals.get(intent.destination);
    if (list) list.push(intent.team.id);
    else arrivals.set(intent.destination, [intent.team.id]);
  }

  const encounters: Encounter[] = [];
  const encounteredBy = new Map<string, Set<string>>();
  const noteEncounter = (teamIds: readonly string[]) => {
    for (const id of teamIds) {
      const set = encounteredBy.get(id) ?? new Set<string>();
      for (const other of teamIds) if (other !== id) set.add(other);
      encounteredBy.set(id, set);
    }
  };

  if (resolved.scenario.rules.collisionTriggersEncounter) {
    for (const hexId of [...arrivals.keys()].sort()) {
      const teamIds = [...arrivals.get(hexId)!].sort();
      // Teams that merely stayed put together were already co-located; still an
      // encounter, since the facilitator resolves the hex either way.
      if (teamIds.length < 2) continue;
      encounters.push(Object.freeze({ kind: 'shared-hex', hexId, teamIds: Object.freeze(teamIds) }));
      noteEncounter(teamIds);
      log('encounter', teamIds, hexId, `${teamIds.join(' + ')} share hex ${hexId}`);
    }
    for (const { a, b } of swaps) {
      if (a.outcome !== 'moved') continue; // blocked swaps are not a meeting
      const teamIds = [a.team.id, b.team.id].sort();
      const hexId = [a.team.hexId, b.team.hexId].sort()[0]!;
      encounters.push(Object.freeze({ kind: 'swap', hexId, teamIds: Object.freeze(teamIds) }));
      noteEncounter(teamIds);
      log(
        'encounter',
        teamIds,
        hexId,
        `${teamIds.join(' + ')} crossed paths swapping ${a.team.hexId} <-> ${b.team.hexId}`,
      );
    }
  }

  // --- 4. Build the next state. --------------------------------------------
  const revealed = new Set(state.revealedHexIds);
  const nextTeams: TeamState[] = [];
  const moves: TeamMoveRecord[] = [];

  for (const intent of intents) {
    const { team, destination, requested } = intent;
    const trailhead = board.trailheadAt(destination);
    const reachedTrailhead =
      team.status === 'active' && board.isOpenTrailhead(destination) ? (trailhead?.id ?? null) : null;
    const met = [...(encounteredBy.get(team.id) ?? [])].sort();

    if (reachedTrailhead !== null) {
      log(
        'trailhead-reached',
        [team.id],
        destination,
        `${team.id} reached trailhead ${reachedTrailhead}; awaiting escape test`,
      );
    }

    if (resolved.scenario.rules.revealHiddenContents && intent.outcome !== 'ineligible') {
      for (const content of board.contentsAt(destination)) {
        if (revealed.has(destination)) break;
        log(
          'content-revealed',
          [team.id],
          destination,
          `${destination} reveals ${content.kind}: ${content.label}`,
        );
      }
      if (board.contentsAt(destination).length > 0) revealed.add(destination);
    }

    const moved = destination !== team.hexId;
    nextTeams.push(
      Object.freeze({
        ...team,
        hexId: destination,
        status: reachedTrailhead !== null ? 'at_trailhead' : team.status,
        visited: moved ? Object.freeze([...team.visited, destination]) : team.visited,
        trailheadId: reachedTrailhead !== null ? reachedTrailhead : team.trailheadId,
        encounterCount: team.encounterCount + (met.length > 0 ? 1 : 0),
        stoppedOnRound: reachedTrailhead !== null ? round : team.stoppedOnRound,
      }),
    );

    if (intent.outcome !== 'ineligible') {
      moves.push(
        Object.freeze({
          teamId: team.id,
          fromHexId: team.hexId,
          toHexId: destination,
          requestedHexId: requested,
          outcome: intent.outcome,
          reachedTrailheadId: reachedTrailhead,
          encounteredTeamIds: Object.freeze(met),
        }),
      );
    }
  }

  // Keep the original team order in state so the UI roster is stable.
  const orderedTeams = state.teams.map((t) => nextTeams.find((n) => n.id === t.id)!);

  const rng = createRng(state.rngState); // milestone 1 draws nothing from it
  const nextState: SimState = Object.freeze({
    round: round + 1,
    teams: Object.freeze(orderedTeams),
    revealedHexIds: Object.freeze([...revealed].sort()),
    rngState: rng.state,
  });

  const summary: RoundSummary = Object.freeze({
    round,
    moves: Object.freeze(moves),
    encounters: Object.freeze(encounters),
    events: Object.freeze(events),
    rng: Object.freeze({ before: state.rngState, after: rng.state }),
  });

  return { state: nextState, summary };
}
