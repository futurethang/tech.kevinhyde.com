/**
 * Batch statistics and dead-end detection.
 *
 * The point is not to prove the game is good — a simulation cannot know that.
 * The point is to find the shapes of night that would be *bad*: a round where
 * nothing happens, a finale with nobody in it, a champion decided entirely by
 * who got lucky first.
 */

import type { GameRecord } from './engine';
import type { RuleParameters } from './types';

export interface Spread {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
}

export interface BatchStats {
  readonly games: number;
  readonly teams: number;
  readonly finalists: {
    readonly distribution: Readonly<Record<number, number>>;
    readonly spread: Spread;
    /** Share of games landing inside the target band of finalists. */
    readonly inTarget: number;
    /** Share of games with fewer than two finalists — no final challenge. */
    readonly noFinale: number;
  };
  readonly rounds: {
    /** Mean fights in each round of choice, outermost band first. */
    readonly fightsPerRound: readonly number[];
    /** Mean eliminations in each round. */
    readonly eliminationsPerRound: readonly number[];
    /** Share of rounds across all games in which no fight happened at all. */
    readonly deadRoundShare: number;
    /** Share of games containing at least one dead round. */
    readonly gamesWithDeadRound: number;
  };
  readonly champion: {
    /** Items the champion carried INTO the finale, before taking the spoils. */
    readonly items: Spread;
    /** Share of games where the champion was the best-equipped team entering the finale. */
    readonly hadMostItems: number;
    /** Share where the champion had the highest latent trivia skill. */
    readonly hadBestSkill: number;
    /** Share where the champion never fought before the finale. */
    readonly neverFought: number;
    /** Share of wins taken by each archetype. */
    readonly byArchetype: Readonly<Record<string, number>>;
  };
  readonly contact: {
    /** Mean share of teams that were in at least one fight. */
    readonly teamsInAFight: number;
    /** Mean fights per game, including the finale. */
    readonly fightsPerGame: number;
    readonly trapsTriggeredPerGame: number;
  };
}

function spread(values: readonly number[]): Spread {
  if (values.length === 0) return { min: 0, max: 0, mean: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
  };
}

const share = (count: number, total: number) => (total === 0 ? 0 : count / total);

export function summarize(records: readonly GameRecord[], rules: RuleParameters): BatchStats {
  const games = records.length;
  const teams = records[0]?.teams.length ?? 0;
  const roundCount = Math.max(...records.map((r) => r.rounds.length), 0);

  const finalistCounts = records.map((r) => r.finalists.length);
  const distribution: Record<number, number> = {};
  for (const n of finalistCounts) distribution[n] = (distribution[n] ?? 0) + 1;

  const fightsPerRound: number[] = [];
  const eliminationsPerRound: number[] = [];
  for (let i = 0; i < roundCount; i++) {
    const rows = records.map((r) => r.rounds[i]).filter((r) => r !== undefined);
    fightsPerRound.push(spread(rows.map((r) => r!.fights)).mean);
    eliminationsPerRound.push(spread(rows.map((r) => r!.eliminated.length)).mean);
  }

  let deadRounds = 0;
  let totalRounds = 0;
  let gamesWithDeadRound = 0;
  for (const record of records) {
    let hasDead = false;
    for (const round of record.rounds) {
      totalRounds += 1;
      if (round.fights === 0) {
        deadRounds += 1;
        hasDead = true;
      }
    }
    if (hasDead) gamesWithDeadRound += 1;
  }

  const championItems: number[] = [];
  let hadMostItems = 0;
  let hadBestSkill = 0;
  let neverFought = 0;
  const byArchetype: Record<string, number> = {};
  let championed = 0;

  for (const record of records) {
    if (record.championId === null) continue;
    championed += 1;
    const champion = record.teams.find((t) => t.id === record.championId)!;
    // Measured entering the finale: afterwards the winner holds everyone's items.
    const entering = Object.values(record.itemsAtFinale);
    const championEntering = record.itemsAtFinale[champion.id] ?? champion.items.length;
    championItems.push(championEntering);
    if (entering.length > 0 && championEntering >= Math.max(...entering)) hadMostItems += 1;
    const maxSkill = Math.max(...record.teams.map((t) => t.skill));
    if (champion.skill >= maxSkill) hadBestSkill += 1;
    // fightsSurvived counts the finale too, so "never fought" means at most that one.
    if (champion.fightsSurvived <= (record.finale ? 1 : 0)) neverFought += 1;
    byArchetype[champion.archetype] = (byArchetype[champion.archetype] ?? 0) + 1;
  }
  for (const key of Object.keys(byArchetype)) {
    byArchetype[key] = share(byArchetype[key]!, championed);
  }

  const inAFight: number[] = [];
  const fightsPerGame: number[] = [];
  const trapsPerGame: number[] = [];
  for (const record of records) {
    const all = [...record.rounds, ...(record.finale ? [record.finale] : [])];
    const fought = new Set<string>();
    let traps = 0;
    for (const round of all) {
      for (const outcome of round.outcomes) {
        if (outcome.kind === 'fight') for (const id of outcome.teamIds) fought.add(id);
        traps += outcome.trapTriggeredOn.length;
      }
    }
    inAFight.push(share(fought.size, record.teams.length));
    fightsPerGame.push(all.reduce((sum, r) => sum + r.fights, 0));
    trapsPerGame.push(traps);
  }

  const { min, max } = rules.targetFinalists;
  return Object.freeze({
    games,
    teams,
    finalists: {
      distribution,
      spread: spread(finalistCounts),
      inTarget: share(finalistCounts.filter((n) => n >= min && n <= max).length, games),
      noFinale: share(finalistCounts.filter((n) => n < 2).length, games),
    },
    rounds: {
      fightsPerRound,
      eliminationsPerRound,
      deadRoundShare: share(deadRounds, totalRounds),
      gamesWithDeadRound: share(gamesWithDeadRound, games),
    },
    champion: {
      items: spread(championItems),
      hadMostItems: share(hadMostItems, championed),
      hadBestSkill: share(hadBestSkill, championed),
      neverFought: share(neverFought, championed),
      byArchetype,
    },
    contact: {
      teamsInAFight: spread(inAFight).mean,
      fightsPerGame: spread(fightsPerGame).mean,
      trapsTriggeredPerGame: spread(trapsPerGame).mean,
    },
  });
}

/**
 * Turns the statistics into a list of things that would actually ruin the one
 * night we get. Each entry names the measurement that triggered it.
 */
export function deadEnds(stats: BatchStats, rules: RuleParameters): string[] {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const found: string[] = [];
  const { min, max } = rules.targetFinalists;

  if (stats.finalists.noFinale > 0.02) {
    found.push(
      `NO FINALE: ${pct(stats.finalists.noFinale)} of nights end with fewer than two teams at the trailhead.`,
    );
  }
  if (stats.finalists.inTarget < 0.6) {
    found.push(
      `FUNNEL OFF TARGET: only ${pct(stats.finalists.inTarget)} of nights land on ${min}-${max} finalists ` +
        `(mean ${stats.finalists.spread.mean.toFixed(1)}, range ${stats.finalists.spread.min}-${stats.finalists.spread.max}).`,
    );
  }
  if (stats.rounds.gamesWithDeadRound > 0.15) {
    found.push(
      `DEAD ROUND: ${pct(stats.rounds.gamesWithDeadRound)} of nights contain a round where no fight happens — ` +
        `the party gathers for the reveal and nothing is revealed.`,
    );
  }
  if (stats.contact.teamsInAFight < 0.6) {
    found.push(
      `NO CONTACT: only ${pct(stats.contact.teamsInAFight)} of teams ever get into a fight — ` +
        `most guests never experience the head-to-head.`,
    );
  }
  if (stats.champion.hadMostItems > 0.85) {
    found.push(
      `ITEMS DECIDE: the champion carried the most power-ups in ${pct(stats.champion.hadMostItems)} of nights — ` +
        `the quiz is decoration.`,
    );
  }
  if (stats.champion.hadBestSkill > 0.7) {
    found.push(
      `SKILL DECIDES: the sharpest trivia team won ${pct(stats.champion.hadBestSkill)} of nights — ` +
        `the map is decoration.`,
    );
  }
  if (stats.champion.neverFought > 0.4) {
    found.push(
      `COWARD WINS: the champion reached the finale without a single fight in ${pct(stats.champion.neverFought)} of nights — ` +
        `hiding all evening is a winning line.`,
    );
  }
  return found;
}
