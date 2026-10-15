/**
 * Round resolution for the Dark Forest ruleset.
 *
 * A round is: every surviving team secretly names a location in the next band
 * and a posture; the dead place traps; the Director reveals everything at once
 * and resolves each location independently.
 *
 * Resolution of one location, in order:
 *   1. A trap here strips items from every team that walked in (intel dodges it).
 *   2. Decide whether there is a fight, from the terrain and the postures.
 *   3. Matchup -> one team wins, draws a treasure, and takes what was lying
 *                 there. The losers are out, and each of them sets a trap.
 *      No matchup -> a team alone takes what was lying there; teams that merely
 *                 coexisted take nothing.
 *   4. Surviving on open ground earns intel: one trap dodged next round.
 *
 * Pure. Same state, same choices, same seed -> same result. Nothing depends on
 * the order teams or locations are stored in: everything is iterated sorted.
 */

import type { Rng } from '../core/rng';
import type { LocationDefinition, MapDefinition, RuleParameters } from './types';

export interface TeamState {
  readonly id: string;
  readonly name: string;
  readonly archetype: string;
  /** Overall trivia ability — the mean of the per-theme figures below. */
  readonly skill: number;
  /** How good this team is at each theme. Picking your subject is half the game. */
  readonly skillByTopic: Readonly<Record<string, number>>;
  readonly items: readonly string[];
  readonly alive: boolean;
  /** Where the team stands now; null before the first round. */
  readonly locationId: string | null;
  readonly eliminatedRound: number | null;
  readonly fightsWon: number;
  readonly fightsSurvived: number;
  /** Earned on open ground: dodges one trap next round. */
  readonly hasIntel: boolean;
}

export interface Choice {
  readonly locationId: string;
}

export interface TrapState {
  readonly locationId: string;
  readonly placedBy: string;
}

export interface GameState {
  /** The band index about to be resolved. 0 is the first band of locations. */
  readonly band: number;
  readonly teams: readonly TeamState[];
  readonly traps: readonly TrapState[];
}

export type LocationOutcomeKind =
  /** Nobody came here. */
  | 'empty'
  /** One team, alone and unopposed. */
  | 'solo'
  /** Two or more teams, but nobody found anybody. */
  | 'passed-in-the-dark'
  /** Two or more teams and a fight. One emerges. */
  | 'fight';

export interface LocationOutcome {
  readonly locationId: string;
  readonly kind: LocationOutcomeKind;
  readonly teamIds: readonly string[];
  readonly winnerId: string | null;
  readonly eliminatedIds: readonly string[];
  readonly trapTriggeredOn: readonly string[];
  readonly lootTakenBy: string | null;
  readonly lootTaken: readonly string[];
  readonly intelEarnedBy: readonly string[];
  /** The trivia theme this place was fought over. */
  readonly topicId: string;
  /** True when the winner was also the best of them at that theme. */
  readonly winnerKnewTheTheme: boolean | null;
}

export interface RoundSummary {
  readonly band: number;
  readonly bandName: string;
  readonly outcomes: readonly LocationOutcome[];
  readonly fights: number;
  readonly eliminated: readonly string[];
  readonly survivors: number;
}

export interface ResolveResult {
  readonly state: GameState;
  readonly summary: RoundSummary;
}

/**
 * Trivia stand-in: how good this team is at THIS theme, plus what their items
 * buy them, plus the luck of the question (and the dice, at the Trailhead).
 */
export function matchupScore(
  team: TeamState,
  topicId: string,
  rules: RuleParameters,
  luckRange: number,
  rng: Rng,
): number {
  const ability = team.skillByTopic[topicId] ?? team.skill;
  return ability + rules.matchup.helpPerItem * team.items.length + rng.next() * luckRange;
}

/** Decides a matchup. Ties break on team id so the result is reproducible. */
export function resolveMatchup(
  teams: readonly TeamState[],
  topicId: string,
  rules: RuleParameters,
  luckRange: number,
  rng: Rng,
): { winnerId: string; scores: ReadonlyMap<string, number> } {
  const ordered = [...teams].sort((a, b) => a.id.localeCompare(b.id));
  const scores = new Map<string, number>();
  for (const team of ordered) scores.set(team.id, matchupScore(team, topicId, rules, luckRange, rng));
  let winner = ordered[0]!;
  for (const team of ordered.slice(1)) {
    if (scores.get(team.id)! > scores.get(winner.id)!) winner = team;
  }
  return { winnerId: winner.id, scores };
}

function drop(items: readonly string[], count: number): string[] {
  return items.slice(0, Math.max(0, items.length - count));
}

/**
 * Resolves one band. `choices` must name a location in `map.bands[state.band]`
 * for every living team; `traps` are the traps in play for this band.
 */
export function resolveBand(
  map: MapDefinition,
  rules: RuleParameters,
  /** Every item id that can be drawn as treasure. */
  itemPool: readonly string[],
  state: GameState,
  choices: ReadonlyMap<string, Choice>,
  rng: Rng,
): ResolveResult {
  const band = map.bands[state.band];
  if (!band) throw new Error(`band ${state.band} is past the end of map "${map.id}"`);
  const luckRange = rules.matchup.luckRange;

  const living = state.teams.filter((t) => t.alive).sort((a, b) => a.id.localeCompare(b.id));
  const byLocation = new Map<string, TeamState[]>();
  const locationById = new Map(band.locations.map((l) => [l.id, l]));

  for (const team of living) {
    const choice = choices.get(team.id);
    if (!choice) throw new Error(`team "${team.id}" made no choice for band ${state.band}`);
    if (!locationById.has(choice.locationId)) {
      throw new Error(`team "${team.id}" named "${choice.locationId}", which is not in band "${band.id}"`);
    }
    const list = byLocation.get(choice.locationId);
    if (list) list.push(team);
    else byLocation.set(choice.locationId, [team]);
  }

  const trapsHere = new Map<string, TrapState>();
  for (const trap of [...state.traps].sort((a, b) => a.locationId.localeCompare(b.locationId))) {
    if (locationById.has(trap.locationId) && !trapsHere.has(trap.locationId)) {
      trapsHere.set(trap.locationId, trap);
    }
  }

  const next = new Map<string, MutableTeam>(state.teams.map((t) => [t.id, { ...t }]));
  const outcomes: LocationOutcome[] = [];
  const eliminated: string[] = [];

  // Locations resolve in a fixed order; they do not interact, but sorting keeps
  // the rng draw sequence stable.
  for (const location of [...band.locations].sort((a, b) => a.id.localeCompare(b.id))) {
    const present = (byLocation.get(location.id) ?? []).map((t) => next.get(t.id)!);
    const outcome = resolveLocation(
      location,
      present,
      trapsHere.get(location.id),
      rules,
      itemPool,
      luckRange,
      rng,
    );
    outcomes.push(outcome);
    for (const id of outcome.eliminatedIds) eliminated.push(id);
  }

  // Intel is spent on the trap that was dodged and re-earned on open ground.
  for (const outcome of outcomes) {
    for (const id of outcome.intelEarnedBy) next.get(id)!.hasIntel = true;
  }

  for (const team of next.values()) {
    if (!team.alive) continue;
    if (eliminated.includes(team.id)) {
      team.alive = false;
      team.eliminatedRound = state.band + 1;
    }
  }

  const survivors = [...next.values()].filter((t) => t.alive).length;
  return {
    state: Object.freeze({
      band: state.band + 1,
      teams: Object.freeze([...next.values()].map((t) => Object.freeze({ ...t }))),
      // Traps in this band are spent; traps elsewhere never existed.
      traps: Object.freeze([]),
    }),
    summary: Object.freeze({
      band: state.band,
      bandName: band.name,
      outcomes: Object.freeze(outcomes),
      fights: outcomes.filter((o) => o.kind === 'fight').length,
      eliminated: Object.freeze([...eliminated].sort()),
      survivors,
    }),
  };
}

type MutableTeam = { -readonly [K in keyof TeamState]: TeamState[K] };

function resolveLocation(
  location: LocationDefinition,
  present: MutableTeam[],
  trap: TrapState | undefined,
  rules: RuleParameters,
  itemPool: readonly string[],
  luckRange: number,
  rng: Rng,
): LocationOutcome {
  const teamIds = present.map((t) => t.id).sort();
  const base = {
    locationId: location.id,
    teamIds: Object.freeze(teamIds),
    trapTriggeredOn: Object.freeze([] as string[]),
    lootTakenBy: null as string | null,
    lootTaken: Object.freeze([] as string[]),
    intelEarnedBy: Object.freeze([] as string[]),
    topicId: location.topic,
    winnerKnewTheTheme: null as boolean | null,
  };

  if (present.length === 0) {
    return Object.freeze({
      ...base,
      kind: 'empty' as const,
      winnerId: null,
      eliminatedIds: Object.freeze([]),
    });
  }

  // 1. Traps. Intel dodges one, and is spent doing so.
  const trapped: string[] = [];
  if (trap) {
    for (const team of present) {
      if (team.hasIntel) {
        team.hasIntel = false;
        continue;
      }
      if (team.items.length > 0) {
        team.items = drop(team.items, rules.itemsLostToATrap);
        trapped.push(team.id);
      }
    }
  }

  // 2. Two or more teams in the same place is a matchup. No exceptions.
  const fight = present.length >= 2;

  const intelEarned: string[] = [];

  if (fight) {
    const contenders = present;
    const { winnerId } = resolveMatchup(contenders, location.topic, rules, luckRange, rng);
    const bestAtTheme = Math.max(
      ...contenders.map((t) => t.skillByTopic[location.topic] ?? t.skill),
    );
    const winner = present.find((t) => t.id === winnerId)!;
    const losers = present.filter((t) => t.id !== winnerId);
    const spoils: string[] = [];
    for (const loser of losers) {
      if (rules.winnerAlsoTakesTheLosersItems) spoils.push(...loser.items);
      loser.items = [];
    }
    const loot = rules.theWinnerTakesWhatIsLyingThere ? [...location.loot] : [];
    // Win a matchup, draw a treasure.
    const treasure = Array.from({ length: rules.treasureForWinningAMatchup }, () =>
      itemPool[rng.int(itemPool.length)]!,
    );
    winner.items = [...winner.items, ...spoils, ...loot, ...treasure];
    winner.fightsWon += 1;
    winner.fightsSurvived += 1;
    if (location.vantage) intelEarned.push(winner.id);
    return Object.freeze({
      ...base,
      kind: 'fight' as const,
      winnerId,
      eliminatedIds: Object.freeze(losers.map((t) => t.id).sort()),
      trapTriggeredOn: Object.freeze(trapped.sort()),
      lootTakenBy: loot.length > 0 ? winnerId : null,
      lootTaken: Object.freeze(loot),
      intelEarnedBy: Object.freeze(intelEarned),
      winnerKnewTheTheme: (winner.skillByTopic[location.topic] ?? winner.skill) >= bestAtTheme,
    });
  }

  // 3. Nobody met. A team on its own picks up what was lying there.
  let lootTakenBy: string | null = null;
  let lootTaken: string[] = [];
  if (present.length === 1 && rules.aTeamAloneTakesWhatIsLyingThere && location.loot.length > 0) {
    const team = present[0]!;
    lootTaken = [...location.loot];
    team.items = [...team.items, ...lootTaken];
    lootTakenBy = team.id;
  }

  if (location.vantage) for (const team of present) intelEarned.push(team.id);

  return Object.freeze({
    ...base,
    kind: present.length === 1 ? ('solo' as const) : ('passed-in-the-dark' as const),
    winnerId: null,
    eliminatedIds: Object.freeze([]),
    trapTriggeredOn: Object.freeze(trapped.sort()),
    lootTakenBy,
    lootTaken: Object.freeze(lootTaken),
    intelEarnedBy: Object.freeze(intelEarned),
  });
}
