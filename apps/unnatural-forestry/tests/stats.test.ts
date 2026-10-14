import { describe, expect, it } from 'vitest';

import { Simulation } from '../src/core/simulation';
import { L, makeFixture, type FixtureTeam } from './fixtures';

const CENTRE = L(0, 0);
const EXIT = L(0, -2);

function sim(teams: readonly FixtureTeam[], rules: Record<string, unknown> = {}) {
  const { resolved } = makeFixture(teams, { trailheadHexIds: [EXIT] }, rules);
  return new Simulation(resolved);
}

describe('run stats', () => {
  const teams: FixtureTeam[] = [
    { id: 'a', startHexId: CENTRE },
    { id: 'b', startHexId: L(2, 0) },
  ];

  it('reports an untouched run as zero rounds and start-hex coverage', () => {
    const stats = sim(teams).stats();
    expect(stats.roundsResolved).toBe(0);
    expect(stats.teams).toEqual({ total: 2, active: 2, atTrailhead: 0, escaped: 0, eliminated: 0 });
    expect(stats.encounters.total).toBe(0);
    expect(stats.coverage.visited).toBe(2);
    expect(stats.coverage.passable).toBe(19);
    expect(stats.movesPerTeam).toEqual({ min: 0, max: 0, mean: 0 });
    expect(stats.roundsToTrailhead).toBeNull();
    expect(stats.trailheadUse).toEqual({});
  });

  it('counts moves, not distinct hexes, when a team doubles back', () => {
    const s = sim(teams);
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(2, 0));
    s.resolve();
    s.selectAndCommit('a', CENTRE);
    s.selectAndCommit('b', L(2, 0));
    s.resolve();
    const stats = s.stats();
    expect(stats.movesPerTeam).toEqual({ min: 0, max: 2, mean: 1 });
    expect(stats.coverage.visited).toBe(3); // centre, (0,-1), and b's hex
    expect(stats.roundsResolved).toBe(2);
  });

  it('separates shared-hex encounters from swaps and counts contact rounds', () => {
    const s = sim([
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(0, -1) },
      { id: 'c', startHexId: L(2, 0) },
    ]);
    // Round 1: a and b swap; c moves away alone.
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', CENTRE);
    s.selectAndCommit('c', L(1, 1));
    s.resolve();
    // Round 2: a and b land on the same hex; c holds.
    s.selectAndCommit('a', CENTRE);
    s.selectAndCommit('b', CENTRE);
    s.selectAndCommit('c', L(1, 1));
    s.resolve();

    const stats = s.stats();
    expect(stats.encounters).toEqual({
      total: 2,
      sharedHex: 1,
      swap: 1,
      roundsWithContact: 2,
      teamsInvolved: 2,
    });
  });

  it('records which trailhead each team came out of, and when', () => {
    const s = sim([
      { id: 'a', startHexId: L(0, -1) },
      { id: 'b', startHexId: L(1, -1) },
    ]);
    s.selectAndCommit('a', EXIT);
    s.selectAndCommit('b', L(1, -1));
    s.resolve();
    s.selectAndCommit('b', L(0, -1));
    s.resolve();
    s.selectAndCommit('b', EXIT);
    s.resolve();

    const stats = s.stats();
    expect(stats.teams.atTrailhead).toBe(2);
    expect(stats.teams.active).toBe(0);
    expect(stats.trailheadUse).toEqual({ 'TH-1': 2 });
    expect(stats.roundsToTrailhead).toEqual({ min: 1, max: 3, mean: 2 });
  });

  it('measures coverage as a fraction of passable hexes', () => {
    const s = sim(teams);
    s.autoPlayToEnd('wander', 6);
    const stats = s.stats();
    expect(stats.coverage.fraction).toBeCloseTo(stats.coverage.visited / stats.coverage.passable, 10);
    expect(stats.coverage.fraction).toBeGreaterThan(0);
    expect(stats.coverage.fraction).toBeLessThanOrEqual(1);
  });

  it('resets with the run', () => {
    const s = sim(teams);
    s.autoPlayToEnd('balanced', 4);
    expect(s.stats().roundsResolved).toBeGreaterThan(0);
    s.reset();
    expect(s.stats().roundsResolved).toBe(0);
    expect(s.stats().coverage.visited).toBe(2);
  });
});
