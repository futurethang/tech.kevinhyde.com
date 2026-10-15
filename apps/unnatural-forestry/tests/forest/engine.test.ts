import { describe, expect, it } from 'vitest';

import { mergeRules, rulesetWarnings, teamCount } from '../../src/forest/config';
import { runGame } from '../../src/forest/engine';
import { loadRuleset } from '../../src/forest/ruleset';
import { deadEnds, summarize } from '../../src/forest/stats';

const ruleset = loadRuleset();

describe('the committed ruleset', () => {
  it('loads and cross-validates', () => {
    expect(ruleset.terrains.size).toBeGreaterThan(0);
    expect(ruleset.items.size).toBeGreaterThan(0);
    expect(ruleset.maps.size).toBeGreaterThan(0);
    expect(ruleset.scenarios.size).toBeGreaterThan(0);
  });

  it('gives every map a narrowing wedge ending in a single trailhead', () => {
    for (const map of ruleset.maps.values()) {
      const widths = map.bands.map((b) => b.locations.length);
      expect(widths.at(-1)).toBe(1);
      for (let i = 1; i < widths.length; i++) {
        expect(widths[i]!).toBeLessThanOrEqual(widths[i - 1]!);
      }
    }
  });

  it('points every scenario at a map that exists, with at least two teams', () => {
    for (const scenario of ruleset.scenarios.values()) {
      expect(ruleset.maps.has(scenario.mapId)).toBe(true);
      expect(teamCount(scenario)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe.each([...ruleset.scenarios.keys()])('scenario %s', (scenarioId) => {
  const scenario = ruleset.scenarios.get(scenarioId)!;

  it('always produces at least one survivor', () => {
    for (let seed = 0; seed < 25; seed++) {
      const record = runGame(ruleset, scenario, scenario.seed + seed);
      expect(record.finalists.length).toBeGreaterThanOrEqual(1);
      expect(record.championId).not.toBeNull();
    }
  });

  it('never resolves more rounds than the map has choice bands', () => {
    const map = ruleset.maps.get(scenario.mapId)!;
    const record = runGame(ruleset, scenario, scenario.seed);
    expect(record.rounds.length).toBeLessThanOrEqual(map.bands.length - 1);
  });

  it('replays identically from the same seed', () => {
    const a = runGame(ruleset, scenario, 1234);
    const b = runGame(ruleset, scenario, 1234);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('conserves teams: every team is a finalist or was eliminated', () => {
    const record = runGame(ruleset, scenario, scenario.seed);
    const alive = record.teams.filter((t) => t.alive).map((t) => t.id);
    const dead = record.teams.filter((t) => !t.alive);
    expect(alive.length + dead.length).toBe(teamCount(scenario));
    for (const team of dead) expect(team.eliminatedRound).not.toBeNull();
  });
});

describe('batch statistics', () => {
  const scenario = ruleset.scenarios.get('narrow-mixed')!;
  const rules = mergeRules(ruleset.rules, scenario.rules);
  const records = Array.from({ length: 60 }, (_, i) => runGame(ruleset, scenario, 500 + i));
  const stats = summarize(records, rules);

  it('counts every game once in the finalist distribution', () => {
    const total = Object.values(stats.finalists.distribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(records.length);
  });

  it('reports shares as fractions between 0 and 1', () => {
    for (const value of [
      stats.finalists.inTarget,
      stats.finalists.noFinale,
      stats.rounds.deadRoundShare,
      stats.champion.hadMostItems,
      stats.contact.teamsInAFight,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('measures the champion inventory entering the finale, not after it', () => {
    // After the finale the winner holds everyone's items, so a mean equal to the
    // whole field's inventory would mean we measured the wrong moment.
    const totalItems = records[0]!.teams.reduce((sum, t) => sum + t.items.length, 0);
    expect(stats.champion.items.mean).toBeLessThan(totalItems);
  });

  it('names dead ends as plain strings', () => {
    for (const problem of deadEnds(stats, rules)) expect(problem.length).toBeGreaterThan(10);
  });
});

describe('ruleset warnings', () => {
  it('flags a board too wide to force contact', () => {
    const warnings = rulesetWarnings(ruleset);
    expect(warnings.some((w) => w.includes('nothing forces contact'))).toBe(true);
  });
});
