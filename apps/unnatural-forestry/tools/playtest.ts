/**
 * Batch playtest: runs every scenario over many seeds and reports the funnel,
 * the contact rate, who wins, and any dead ends that would ruin the one night.
 *
 *   pnpm playtest            all scenarios, 500 runs each
 *   pnpm playtest 2000       more runs
 *   pnpm playtest 500 all-cautious
 */

import { rulesetWarnings, mergeRules, teamCount } from '../src/forest/config';
import { runGame } from '../src/forest/engine';
import { loadRuleset } from '../src/forest/ruleset';
import { deadEnds, summarize } from '../src/forest/stats';

const runs = Number(process.argv[2] ?? 500);
const only = process.argv[3];

const ruleset = loadRuleset();

const warnings = rulesetWarnings(ruleset);
if (warnings.length > 0) {
  console.log('ruleset warnings:');
  for (const w of warnings) console.log(`  - ${w}`);
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

for (const scenario of ruleset.scenarios.values()) {
  if (only && scenario.id !== only) continue;
  const rules = mergeRules(ruleset.rules, scenario.rules);
  const records = Array.from({ length: runs }, (_, i) => runGame(ruleset, scenario, scenario.seed + i));
  const stats = summarize(records, rules);

  console.log(`\n${'='.repeat(72)}`);
  console.log(`${scenario.name}  —  ${teamCount(scenario)} teams, ${runs} runs`);
  console.log(scenario.description);
  console.log('-'.repeat(72));

  const dist = Object.entries(stats.finalists.distribution)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `${k}→${pct(v / runs)}`)
    .join('  ');
  console.log(`finalists at the trailhead: ${dist}`);
  console.log(
    `  mean ${stats.finalists.spread.mean.toFixed(2)} · ` +
      `on target (${rules.targetFinalists.min}-${rules.targetFinalists.max}) ${pct(stats.finalists.inTarget)} · ` +
      `no finale ${pct(stats.finalists.noFinale)}`,
  );
  console.log(
    `fights per round: ${stats.rounds.fightsPerRound.map((n) => n.toFixed(1)).join(' / ')}` +
      `   eliminations per round: ${stats.rounds.eliminationsPerRound.map((n) => n.toFixed(1)).join(' / ')}`,
  );
  console.log(
    `dead rounds: ${pct(stats.rounds.deadRoundShare)} of rounds, ` +
      `${pct(stats.rounds.gamesWithDeadRound)} of nights have one`,
  );
  console.log(
    `contact: ${pct(stats.contact.teamsInAFight)} of teams fight at least once · ` +
      `${stats.contact.fightsPerGame.toFixed(1)} fights/night · ` +
      `${stats.contact.trapsTriggeredPerGame.toFixed(1)} traps sprung/night`,
  );
  console.log(
    `champion: ${stats.champion.items.mean.toFixed(1)} items · ` +
      `had most items ${pct(stats.champion.hadMostItems)} · ` +
      `had best trivia ${pct(stats.champion.hadBestSkill)} · ` +
      `never fought ${pct(stats.champion.neverFought)}`,
  );
  const winners = Object.entries(stats.champion.byArchetype)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k} ${pct(v)}`)
    .join(', ');
  if (winners) console.log(`wins by archetype: ${winners}`);

  const problems = deadEnds(stats, rules);
  if (problems.length === 0) {
    console.log('dead ends: none detected');
  } else {
    console.log('DEAD ENDS:');
    for (const p of problems) console.log(`  ! ${p}`);
  }
}
