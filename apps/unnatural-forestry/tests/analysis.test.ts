import { describe, expect, it } from 'vitest';

import {
  analyzeMap,
  analyzeStart,
  countShortestExitRoutes,
  distanceField,
  exitDistanceField,
  shortestPath,
} from '../src/core/analysis';
import { createBoard } from '../src/core/board';
import { parseMap } from '../src/core/config';
import { L, makeMapRaw, terrains } from './fixtures';

function board(options = {}) {
  return createBoard(parseMap(makeMapRaw(options), terrains, 'fixture/map'), terrains);
}

const CENTRE = L(0, 0);
const NORTH_EDGE = L(0, -2);

describe('distance fields', () => {
  it('measures the centre of a radius-2 disc as two moves from the edge', () => {
    const field = distanceField(board(), [NORTH_EDGE]);
    expect(field.dist.get(NORTH_EDGE)).toBe(0);
    expect(field.dist.get(CENTRE)).toBe(2);
  });

  it('reaches every passable hex on an open map', () => {
    const b = board();
    const field = distanceField(b, [CENTRE]);
    expect(field.dist.size).toBe(b.hexIds.length);
  });

  it('never assigns a distance to impassable hexes', () => {
    const b = board({ water: ['1,0'] });
    expect(distanceField(b, [CENTRE]).dist.has(L(1, 0))).toBe(false);
  });

  it('routes around impassable terrain rather than through it', () => {
    const open = distanceField(board(), [L(2, -2)]).dist.get(L(0, 0));
    const walled = distanceField(board({ water: ['1,-1'] }), [L(2, -2)]).dist.get(L(0, 0));
    expect(open).toBe(2);
    expect(walled).toBe(3);
  });

  it('ignores impassable sources', () => {
    const field = distanceField(board({ water: ['1,0'] }), [L(1, 0)]);
    expect(field.dist.size).toBe(0);
  });

  it('takes the nearest of several sources', () => {
    const field = distanceField(board(), [NORTH_EDGE, CENTRE]);
    expect(field.dist.get(CENTRE)).toBe(0);
  });
});

describe('exit distance', () => {
  it('counts only open trailheads', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE], closedTrailheadHexIds: [L(2, 0)] });
    const field = exitDistanceField(b);
    expect(field.dist.get(NORTH_EDGE)).toBe(0);
    expect(field.dist.get(L(2, 0))).toBe(4); // the far side of the disc
  });

  it('is empty when every trailhead is closed', () => {
    const b = board({ closedTrailheadHexIds: [NORTH_EDGE] });
    expect(exitDistanceField(b).dist.size).toBe(0);
  });
});

describe('shortest path', () => {
  it('returns an inclusive path of adjacent hexes', () => {
    const b = board();
    const path = shortestPath(b, CENTRE, NORTH_EDGE)!;
    expect(path[0]).toBe(CENTRE);
    expect(path.at(-1)).toBe(NORTH_EDGE);
    expect(path).toHaveLength(3);
    for (let i = 1; i < path.length; i++) {
      expect(b.neighbors(path[i - 1]!)).toContain(path[i]!);
    }
  });

  it('returns a single hex for a path to itself', () => {
    expect(shortestPath(board(), CENTRE, CENTRE)).toEqual([CENTRE]);
  });

  it('returns undefined when the destination is walled off', () => {
    const b = board({ water: ['2,-1', '1,0', '1,1'] });
    expect(shortestPath(b, CENTRE, L(2, 0))).toBeUndefined();
  });

  it('returns undefined when either end is impassable', () => {
    const b = board({ water: ['1,0'] });
    expect(shortestPath(b, CENTRE, L(1, 0))).toBeUndefined();
    expect(shortestPath(b, L(1, 0), CENTRE)).toBeUndefined();
  });
});

describe('route counting', () => {
  it('counts one route when the exit is adjacent in a single direction', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE] });
    const field = exitDistanceField(b);
    expect(countShortestExitRoutes(b, field, NORTH_EDGE)).toBe(1);
    expect(countShortestExitRoutes(b, field, L(0, -1))).toBe(1);
  });

  it('counts both routes when two paths of equal length exist', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE] });
    const field = exitDistanceField(b);
    // (1,-1) reaches the north-edge exit via either (1,-2) or (0,-1).
    expect(countShortestExitRoutes(b, field, L(1, -1))).toBe(2);
    // The centre has only one two-step route: through (0,-1).
    expect(countShortestExitRoutes(b, field, CENTRE)).toBe(1);
  });

  it('counts zero routes from a hex with no exit', () => {
    const b = board({ trailheadHexIds: [L(2, 0)], water: ['2,-1', '1,0', '1,1'] });
    const field = exitDistanceField(b);
    expect(countShortestExitRoutes(b, field, CENTRE)).toBe(0);
  });
});

describe('start analysis', () => {
  it('reports the nearest exit, its trailheads, and route choice', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE, L(2, 0)] });
    const start = analyzeStart(b, CENTRE);
    expect(start.nearestExitDistance).toBe(2);
    expect([...start.nearestTrailheadIds].sort()).toEqual(['TH-1', 'TH-2']);
    expect(start.reachableTrailheadCount).toBe(2);
    expect(start.optimalFirstSteps.length).toBeGreaterThan(0);
    for (const step of start.optimalFirstSteps) {
      expect(start.detourFirstSteps).not.toContain(step);
    }
    expect(start.optimalFirstSteps.length + start.detourFirstSteps.length).toBe(
      b.passableNeighbors(CENTRE).length,
    );
  });

  it('reports a null distance for a closed trailhead', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE], closedTrailheadHexIds: [L(2, 0)] });
    const start = analyzeStart(b, CENTRE);
    const closed = start.trailheadDistances.find((t) => t.closed)!;
    expect(closed.distance).toBeNull();
    expect(start.reachableTrailheadCount).toBe(1);
  });

  it('reports no exit when none is reachable', () => {
    const b = board({ trailheadHexIds: [L(2, 0)], water: ['2,-1', '1,0', '1,1'] });
    const start = analyzeStart(b, CENTRE);
    expect(start.nearestExitDistance).toBeNull();
    expect(start.optimalFirstSteps).toEqual([]);
  });
});

describe('map analysis', () => {
  it('summarises hex counts, starts, and spread', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE, L(2, 0)] });
    const analysis = analyzeMap(b, [CENTRE, L(0, -1)]);
    expect(analysis.hexCount).toBe(19);
    expect(analysis.passableHexCount).toBe(19);
    expect(analysis.starts).toHaveLength(2);
    expect(analysis.startDistance).toEqual({ min: 1, max: 2, mean: 1.5 });
    expect(analysis.strandedHexIds).toEqual([]);
    expect(analysis.unreachableTrailheadIds).toEqual([]);
  });

  it('identifies stranded hexes', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE], water: ['2,-1', '1,0', '1,1'] });
    const analysis = analyzeMap(b, [CENTRE]);
    expect(analysis.strandedHexIds).toEqual([L(2, 0)]);
    expect(analysis.passableHexCount).toBe(16);
  });

  it('identifies a trailhead no start can reach', () => {
    const b = board({ trailheadHexIds: [L(2, 0)], water: ['2,-1', '1,0', '1,1'] });
    const analysis = analyzeMap(b, [CENTRE]);
    expect(analysis.unreachableTrailheadIds).toEqual(['TH-1']);
    expect(analysis.startDistance).toBeNull();
  });

  it('defaults to the map declared start positions', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE] });
    expect(analyzeMap(b).starts.map((s) => s.hexId)).toEqual([CENTRE]);
  });

  it('is deterministic', () => {
    const b = board({ trailheadHexIds: [NORTH_EDGE, L(2, 0)] });
    const a1 = analyzeMap(b, [CENTRE]);
    const a2 = analyzeMap(b, [CENTRE]);
    expect(JSON.stringify(a1.starts)).toBe(JSON.stringify(a2.starts));
  });
});
