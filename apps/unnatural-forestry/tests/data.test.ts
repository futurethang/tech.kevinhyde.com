/**
 * Integrity checks over the real, committed game data. These are the tests
 * that fail when a map is re-rolled into a bad shape.
 */

import { describe, expect, it } from 'vitest';

import { analyzeMap } from '../src/core/analysis';
import { createBoard } from '../src/core/board';
import { mapWarnings } from '../src/core/config';
import { Simulation } from '../src/core/simulation';
import {
  DEFAULT_SCENARIO_ID,
  listScenarios,
  loadScenario,
  maps,
  scenarios,
  terrains,
} from '../src/data/registry';

describe('definition tables', () => {
  it('loads terrain, maps and scenarios', () => {
    expect(terrains.size).toBeGreaterThan(0);
    expect(maps.size).toBeGreaterThan(0);
    expect(scenarios.size).toBeGreaterThan(0);
    expect(scenarios.has(DEFAULT_SCENARIO_ID)).toBe(true);
  });

  it('lists scenarios with their team counts', () => {
    for (const listing of listScenarios()) {
      expect(listing.teamCount).toBeGreaterThan(0);
      expect(maps.has(listing.mapId)).toBe(true);
    }
  });
});

describe.each([...maps.keys()])('map %s', (mapId) => {
  const map = maps.get(mapId)!;
  const board = createBoard(map, terrains);
  const analysis = analyzeMap(board);

  it('has no structural warnings', () => {
    expect(mapWarnings(map, terrains)).toEqual([]);
  });

  it('has 6-10 trailheads, all on the perimeter and all open', () => {
    expect(map.trailheads.length).toBeGreaterThanOrEqual(6);
    expect(map.trailheads.length).toBeLessThanOrEqual(10);
    for (const th of map.trailheads) {
      expect(board.perimeterHexIds).toContain(th.hexId);
      expect(board.isOpenTrailhead(th.hexId)).toBe(true);
    }
  });

  it('strands no passable hex and no trailhead', () => {
    expect(analysis.strandedHexIds).toEqual([]);
    expect(analysis.unreachableTrailheadIds).toEqual([]);
  });

  it('places every start position in the interior, not on the perimeter', () => {
    for (const start of map.startPositions) {
      expect(board.perimeterHexIds).not.toContain(start.hexId);
    }
  });

  it('separates start positions onto distinct hexes', () => {
    const hexIds = map.startPositions.map((s) => s.hexId);
    expect(new Set(hexIds).size).toBe(hexIds.length);
  });

  it('puts the nearest exit 3-5 moves from every start position', () => {
    for (const start of analysis.starts) {
      expect(start.nearestExitDistance).not.toBeNull();
      expect(start.nearestExitDistance!).toBeGreaterThanOrEqual(3);
      expect(start.nearestExitDistance!).toBeLessThanOrEqual(5);
    }
  });

  it('keeps hidden contents off the start positions and trailheads', () => {
    const reserved = new Set([
      ...map.startPositions.map((s) => s.hexId),
      ...map.trailheads.map((t) => t.hexId),
    ]);
    const stationHexIds = new Set(
      map.hexes.filter((h) => h.terrain === 'station').map((h) => h.id),
    );
    for (const content of map.contents) {
      if (stationHexIds.has(content.hexId)) continue; // the field station is public
      expect(reserved.has(content.hexId)).toBe(false);
    }
  });
});

describe.each([...scenarios.keys()])('scenario %s', (scenarioId) => {
  it('resolves against its map and definitions', () => {
    const resolved = loadScenario(scenarioId);
    expect(resolved.map.id).toBe(resolved.scenario.mapId);
  });

  it('starts a simulation where every team can move', () => {
    const sim = new Simulation(loadScenario(scenarioId));
    expect(sim.activeTeams()).toHaveLength(sim.resolved.scenario.teams.length);
    for (const team of sim.activeTeams()) {
      expect(sim.legalMoves(team.id).length).toBeGreaterThan(1);
    }
  });

  it('can be driven to an exit inside its own maxRounds', () => {
    const resolved = loadScenario(scenarioId);
    const sim = new Simulation(resolved);
    const worst = Math.max(...sim.analysis.starts.map((s) => s.nearestExitDistance ?? Infinity));
    expect(worst).toBeLessThanOrEqual(resolved.scenario.rules.maxRounds);
  });
});
