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
  console.log(`teams reaching the Trailhead: ${dist}`);
  console.log(
    `  mean ${stats.finalists.spread.mean.toFixed(2)} · ` +
      `in the target range of ${rules.targetTeamsAtTheTrailhead.min}-${rules.targetTeamsAtTheTrailhead.max}: ${pct(stats.finalists.inTarget)} · ` +
      `no final showdown ${pct(stats.finalists.noFinale)}`,
  );
  console.log(
    `matchups per round: ${stats.rounds.fightsPerRound.map((n) => n.toFixed(1)).join(' / ')}` +
      `   knocked out per round: ${stats.rounds.eliminationsPerRound.map((n) => n.toFixed(1)).join(' / ')}`,
  );
  console.log(
    `rounds where nothing happened: ${pct(stats.rounds.deadRoundShare)} of rounds, ` +
      `${pct(stats.rounds.gamesWithDeadRound)} of games have one`,
  );
  console.log(
    `contact: ${pct(stats.contact.teamsInAFight)} of teams play at least one matchup · ` +
      `${stats.contact.fightsPerGame.toFixed(1)} matchups per game · ` +
      `${stats.contact.trapsTriggeredPerGame.toFixed(1)} traps sprung per game`,
  );
  console.log(
    `winner: carried ${stats.champion.items.mean.toFixed(1)} items into the Trailhead · ` +
      `best equipped ${pct(stats.champion.hadMostItems)} of the time · ` +
      `sharpest at trivia ${pct(stats.champion.hadBestSkill)} of the time · ` +
      `never played a matchup ${pct(stats.champion.neverFought)}`,
  );
  const winners = Object.entries(stats.champion.byArchetype)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k} ${pct(v)}`)
    .join(', ');
  if (winners) console.log(`wins by archetype: ${winners}`);

  const problems = deadEnds(stats, rules);
  if (problems.length === 0) {
    console.log('problems: none detected');
  } else {
    console.log('PROBLEMS:');
    for (const p of problems) console.log(`  ! ${p}`);
  }
}
