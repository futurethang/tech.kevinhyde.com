/**
 * Runs a whole game: three rounds of secret location choice, then the finale
 * at the trailhead where every survivor converges.
 *
 * Deterministic for a given seed. The RNG is drawn in a fixed order — team
 * skills, then per round: choices in sorted team order, then trap placement,
 * then fights in sorted location order — so a replay reproduces the night.
 */

import { createRng, type Rng } from '../core/rng';
import { mergeRules, teamCount } from './config';
import { resolveBand, type Choice, type GameState, type RoundSummary, type TeamState } from './resolve';
import { getArchetype, placeTraps } from './strategy';
import type { Ruleset, ScenarioDefinition } from './types';

export interface GameRecord {
  readonly scenarioId: string;
  readonly seed: number;
  readonly rounds: readonly RoundSummary[];
  /** Teams that survived every round and reached the trailhead. */
  readonly finalists: readonly string[];
  /** The finale at the trailhead, or null when fewer than two teams got there. */
  readonly finale: RoundSummary | null;
  /**
   * Items each finalist carried *into* the finale. Measured before the showdown
   * because the winner then takes everyone else's, which would otherwise make
   * "the champion had the most items" true by construction.
   */
  readonly itemsAtFinale: Readonly<Record<string, number>>;
  readonly championId: string | null;
  readonly teams: readonly TeamState[];
}

export function buildTeams(scenario: ScenarioDefinition, ruleset: Ruleset, rng: Rng): TeamState[] {
  const rules = mergeRules(ruleset.rules, scenario.rules);
  const teams: TeamState[] = [];
  let n = 0;
  for (const setup of scenario.teams) {
    for (let i = 0; i < setup.count; i++) {
      n += 1;
      teams.push(
        Object.freeze({
          id: `t${String(n).padStart(2, '0')}`,
          name: `${getArchetype(setup.archetype).label} ${i + 1}`,
          archetype: setup.archetype,
          skill: rng.next() * rules.fight.skillSpread,
          items: Object.freeze(Array.from({ length: rules.startingItems }, () => 'owls-counsel')),
          alive: true,
          locationId: null,
          eliminatedRound: null,
          fightsWon: 0,
          fightsSurvived: 0,
          hasIntel: false,
        }),
      );
    }
  }
  return teams;
}

export function runGame(ruleset: Ruleset, scenario: ScenarioDefinition, seed: number): GameRecord {
  const map = ruleset.maps.get(scenario.mapId)!;
  const rules = mergeRules(ruleset.rules, scenario.rules);
  const rng = createRng(seed);

  let state: GameState = {
    band: 0,
    teams: buildTeams(scenario, ruleset, rng),
    traps: [],
  };

  const rounds: RoundSummary[] = [];
  // Every band but the last is a round of secret choice. The last is the trailhead.
  const choiceBands = map.bands.length - 1;

  for (let bandIndex = 0; bandIndex < choiceBands; bandIndex++) {
    const band = map.bands[bandIndex]!;
    const living = state.teams.filter((t) => t.alive).sort((a, b) => a.id.localeCompare(b.id));
    if (living.length <= 1) break;

    const choices = new Map<string, Choice>();
    for (const team of living) {
      const archetype = getArchetype(team.archetype);
      const choice = archetype.choose(team, {
        band,
        terrains: ruleset.terrains,
        teamsAlive: living.length,
        rng,
      });
      choices.set(team.id, choice);
    }

    const dead = state.teams.filter((t) => !t.alive).map((t) => t.id);
    const traps =
      bandIndex + 1 >= rules.trapsFromRound && dead.length > 0
        ? placeTraps(band, dead, rules.trapsPerDeadTeam, rng)
        : [];

    const result = resolveBand(map, ruleset.terrains, rules, { ...state, traps }, choices, rng);
    state = result.state;
    rounds.push(result.summary);
  }

  const finalists = state.teams.filter((t) => t.alive).map((t) => t.id).sort();

  // The finale: everyone left converges on the trailhead. No choice to make.
  let finale: RoundSummary | null = null;
  let championId: string | null = finalists[0] ?? null;
  const itemsAtFinale: Record<string, number> = {};
  for (const id of finalists) {
    itemsAtFinale[id] = state.teams.find((t) => t.id === id)!.items.length;
  }
  if (finalists.length >= 2) {
    const trailhead = map.bands[map.bands.length - 1]!;
    const choices = new Map<string, Choice>(
      finalists.map((id) => [id, { locationId: trailhead.locations[0]!.id, posture: 'hunt' as const }]),
    );
    const result = resolveBand(
      map,
      ruleset.terrains,
      rules,
      { ...state, band: map.bands.length - 1, traps: [] },
      choices,
      rng,
    );
    finale = result.summary;
    state = result.state;
    championId = result.summary.outcomes.find((o) => o.winnerId !== null)?.winnerId ?? null;
  }

  return Object.freeze({
    scenarioId: scenario.id,
    seed,
    rounds: Object.freeze(rounds),
    finalists: Object.freeze(finalists),
    finale,
    itemsAtFinale: Object.freeze(itemsAtFinale),
    championId,
    teams: state.teams,
  });
}

export function gameTeamCount(scenario: ScenarioDefinition): number {
  return teamCount(scenario);
}
