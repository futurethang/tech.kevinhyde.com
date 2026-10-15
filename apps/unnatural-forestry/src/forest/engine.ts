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
  const itemPool = [...ruleset.items.keys()].sort();
  const topicIds = [...ruleset.topics.keys()].sort();
  const { triviaSkillRange, howMuchDependsOnTheTheme } = rules.matchup;
  const teams: TeamState[] = [];
  let n = 0;
  for (const setup of scenario.teams) {
    for (let i = 0; i < setup.count; i++) {
      n += 1;
      // Part of a team's ability is general trivia nous, part is knowing a
      // particular subject. The split is a tunable in rules.json.
      const general = rng.next() * triviaSkillRange * (1 - howMuchDependsOnTheTheme);
      const skillByTopic: Record<string, number> = {};
      for (const topicId of topicIds) {
        skillByTopic[topicId] =
          general + rng.next() * triviaSkillRange * howMuchDependsOnTheTheme;
      }
      const values = Object.values(skillByTopic);
      teams.push(
        Object.freeze({
          id: `t${String(n).padStart(2, '0')}`,
          name: `${getArchetype(setup.archetype).label} ${i + 1}`,
          archetype: setup.archetype,
          skill: values.reduce((a, b) => a + b, 0) / values.length,
          skillByTopic: Object.freeze(skillByTopic),
          // Everyone draws their starting items at random before the game.
          items: Object.freeze(
            Array.from({ length: rules.itemsDrawnAtStart }, () => itemPool[rng.int(itemPool.length)]!),
          ),
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
  const itemPool = [...ruleset.items.keys()].sort();

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
      const choice = archetype.choose(team, { band, teamsAlive: living.length, rng });
      choices.set(team.id, choice);
    }

    const dead = state.teams.filter((t) => !t.alive).map((t) => t.id);
    const traps =
      bandIndex + 1 >= rules.trapsStartFromRound && dead.length > 0
        ? placeTraps(band, dead, rules.trapsSetByEachLoser, rng)
        : [];

    const result = resolveBand(map, rules, itemPool, { ...state, traps }, choices, rng);
    state = result.state;
    rounds.push(result.summary);
  }

  const finalists = state.teams.filter((t) => t.alive).map((t) => t.id).sort();

  // The finale: everyone left converges on the trailhead. No choice to make.
  // Before the showdown, every team left draws one card from the chaos pile.
  if (rules.chaosDrawAtTheTrailhead && finalists.length >= 2) {
    const drawn = state.teams.map((team) => {
      if (!team.alive) return team;
      const good = rng.next() < rules.chanceTheChaosDrawIsGood;
      if (good) {
        return { ...team, items: [...team.items, itemPool[rng.int(itemPool.length)]!] };
      }
      return { ...team, items: team.items.slice(0, Math.max(0, team.items.length - 1)) };
    });
    state = { ...state, teams: Object.freeze(drawn) };
  }

  let finale: RoundSummary | null = null;
  let championId: string | null = finalists[0] ?? null;
  const itemsAtFinale: Record<string, number> = {};
  for (const id of finalists) {
    itemsAtFinale[id] = state.teams.find((t) => t.id === id)!.items.length;
  }
  if (finalists.length >= 2) {
    const trailhead = map.bands[map.bands.length - 1]!;
    const choices = new Map<string, Choice>(
      finalists.map((id) => [id, { locationId: trailhead.locations[0]!.id }]),
    );
    const result = resolveBand(
      map,
      rules,
      itemPool,
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
