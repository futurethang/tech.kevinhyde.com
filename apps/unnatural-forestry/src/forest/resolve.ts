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
 *   3. Fight  -> one team emerges, takes the losers' items and the loot.
 *      No fight -> hunters who found nobody drop an item; a team alone takes
 *                  the loot; teams that merely coexisted take nothing.
 *   4. Surviving on open ground earns intel: one trap dodged next round.
 *
 * Pure. Same state, same choices, same seed -> same result. Nothing depends on
 * the order teams or locations are stored in: everything is iterated sorted.
 */

import type { Rng } from '../core/rng';
import type { LocationDefinition, MapDefinition, RuleParameters, TerrainType } from './types';

export interface TeamState {
  readonly id: string;
  readonly name: string;
  readonly archetype: string;
  /** Latent trivia ability, drawn once per team. Stands in for "do they know it". */
  readonly skill: number;
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

export type Posture = 'hunt' | 'hide';

export interface Choice {
  readonly locationId: string;
  readonly posture: Posture;
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
  readonly hunterIds: readonly string[];
  readonly winnerId: string | null;
  readonly eliminatedIds: readonly string[];
  readonly trapTriggeredOn: readonly string[];
  /** Teams that hunted, found nobody, and dropped an item for their trouble. */
  readonly noisyHunterIds: readonly string[];
  readonly lootTakenBy: string | null;
  readonly lootTaken: readonly string[];
  readonly intelEarnedBy: readonly string[];
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

/** Trivia stand-in: skill, plus what the power-ups buy, plus the luck of the draw. */
export function fightScore(team: TeamState, rules: RuleParameters, rng: Rng): number {
  return team.skill + rules.fight.itemEdge * team.items.length + rng.next() * rules.fight.luck;
}

/** Decides a fight. Ties break on team id so the result is reproducible. */
export function resolveFight(
  teams: readonly TeamState[],
  rules: RuleParameters,
  rng: Rng,
): { winnerId: string; scores: ReadonlyMap<string, number> } {
  const ordered = [...teams].sort((a, b) => a.id.localeCompare(b.id));
  const scores = new Map<string, number>();
  for (const team of ordered) scores.set(team.id, fightScore(team, rules, rng));
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
  terrains: ReadonlyMap<string, TerrainType>,
  rules: RuleParameters,
  state: GameState,
  choices: ReadonlyMap<string, Choice>,
  rng: Rng,
): ResolveResult {
  const band = map.bands[state.band];
  if (!band) throw new Error(`band ${state.band} is past the end of map "${map.id}"`);

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
    const present = (byLocation.get(location.id) ?? []).map((t) => ({
      team: next.get(t.id)!,
      posture: choices.get(t.id)!.posture,
    }));
    const terrain = terrains.get(location.terrain)!;
    const outcome = resolveLocation(location, terrain, present, trapsHere.get(location.id), rules, rng);
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

/** A team standing on a location this round, with the posture it committed. */
interface Arrival {
  readonly team: MutableTeam;
  readonly posture: Posture;
}

function resolveLocation(
  location: LocationDefinition,
  terrain: TerrainType,
  present: Arrival[],
  trap: TrapState | undefined,
  rules: RuleParameters,
  rng: Rng,
): LocationOutcome {
  const teamIds = present.map((a) => a.team.id).sort();
  const base = {
    locationId: location.id,
    teamIds: Object.freeze(teamIds),
    trapTriggeredOn: Object.freeze([] as string[]),
    noisyHunterIds: Object.freeze([] as string[]),
    lootTakenBy: null as string | null,
    lootTaken: Object.freeze([] as string[]),
    intelEarnedBy: Object.freeze([] as string[]),
  };

  if (present.length === 0) {
    return Object.freeze({
      ...base,
      kind: 'empty' as const,
      hunterIds: Object.freeze([]),
      winnerId: null,
      eliminatedIds: Object.freeze([]),
    });
  }

  // 1. Traps. Intel dodges one, and is spent doing so.
  const trapped: string[] = [];
  if (trap) {
    for (const { team } of present) {
      if (team.hasIntel) {
        team.hasIntel = false;
        continue;
      }
      if (team.items.length > 0) {
        team.items = drop(team.items, rules.trapPenalty);
        trapped.push(team.id);
      }
    }
  }

  // 2. Is there a fight?
  const hunters = present.filter((a) => a.posture === 'hunt').map((a) => a.team.id);
  const hunterSet = new Set(hunters);
  // With postures removed, any meeting is a fight. Otherwise, with sanctuary
  // off, deep cover stops being an opt-out and behaves like mixed cover.
  const effectiveRule = rules.allMeetingsFight
    ? 'always'
    : terrain.fightRule === 'never' && !rules.deepCoverIsSanctuary
      ? 'if-hunted'
      : terrain.fightRule;
  const fight =
    present.length >= 2 &&
    (effectiveRule === 'always' || (effectiveRule === 'if-hunted' && hunters.length > 0));

  const intelEarned: string[] = [];

  if (fight) {
    const { winnerId } = resolveFight(present.map((a) => a.team), rules, rng);
    const winner = present.find((a) => a.team.id === winnerId)!.team;
    const losers = present.filter((a) => a.team.id !== winnerId).map((a) => a.team);
    const spoils: string[] = [];
    for (const loser of losers) {
      if (rules.winnerTakesItems) spoils.push(...loser.items);
      loser.items = [];
    }
    const loot = rules.winnerTakesLoot ? [...location.loot] : [];
    winner.items = [...winner.items, ...spoils, ...loot];
    winner.fightsWon += 1;
    winner.fightsSurvived += 1;
    if (terrain.grantsIntel) intelEarned.push(winner.id);
    return Object.freeze({
      ...base,
      kind: 'fight' as const,
      hunterIds: Object.freeze([...hunters].sort()),
      winnerId,
      eliminatedIds: Object.freeze(losers.map((t) => t.id).sort()),
      trapTriggeredOn: Object.freeze(trapped.sort()),
      lootTakenBy: loot.length > 0 ? winnerId : null,
      lootTaken: Object.freeze(loot),
      intelEarnedBy: Object.freeze(intelEarned),
    });
  }

  // 3. No fight. Hunters who found nobody make noise and drop something.
  const noisy: string[] = [];
  for (const { team } of present) {
    if (!hunterSet.has(team.id)) continue;
    if (team.items.length === 0) continue;
    team.items = drop(team.items, rules.hunterNoPreyPenalty);
    noisy.push(team.id);
  }

  let lootTakenBy: string | null = null;
  let lootTaken: string[] = [];
  if (present.length === 1 && rules.soloTakesLoot && location.loot.length > 0) {
    const team = present[0]!.team;
    lootTaken = [...location.loot];
    team.items = [...team.items, ...lootTaken];
    lootTakenBy = team.id;
  }

  if (terrain.grantsIntel) for (const { team } of present) intelEarned.push(team.id);

  return Object.freeze({
    ...base,
    kind: present.length === 1 ? ('solo' as const) : ('passed-in-the-dark' as const),
    hunterIds: Object.freeze([...hunters].sort()),
    winnerId: null,
    eliminatedIds: Object.freeze([]),
    trapTriggeredOn: Object.freeze(trapped.sort()),
    noisyHunterIds: Object.freeze(noisy.sort()),
    lootTakenBy,
    lootTaken: Object.freeze(lootTaken),
    intelEarnedBy: Object.freeze(intelEarned),
  });
}
