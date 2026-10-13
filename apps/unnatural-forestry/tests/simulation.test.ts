import { describe, expect, it } from 'vitest';

import { Simulation } from '../src/core/simulation';
import { L, makeFixture } from './fixtures';

const CENTRE = L(0, 0);
const EXIT = L(0, -2);

function sim(rules: Record<string, unknown> = {}) {
  const { resolved } = makeFixture(
    [
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(2, 0) },
    ],
    { trailheadHexIds: [EXIT] },
    rules,
  );
  return new Simulation(resolved);
}

describe('selection and commitment', () => {
  it('separates a tentative selection from a committed one', () => {
    const s = sim();
    s.select('a', L(0, -1));
    expect(s.selectionFor('a')).toBe(L(0, -1));
    expect(s.isCommitted('a')).toBe(false);
    s.commit('a');
    expect(s.isCommitted('a')).toBe(true);
    expect(s.committedCount()).toBe(1);
  });

  it('rejects an illegal selection', () => {
    const s = sim();
    expect(() => s.select('a', EXIT)).toThrow(/not a legal destination/);
  });

  it('refuses to commit nothing', () => {
    expect(() => sim().commit('a')).toThrow(/nothing selected/);
  });

  it('cancels one team or all of them', () => {
    const s = sim();
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(1, 0));
    s.cancel('a');
    expect(s.isCommitted('a')).toBe(false);
    expect(s.selectionFor('a')).toBeUndefined();
    expect(s.committedCount()).toBe(1);
    s.cancelAll();
    expect(s.committedCount()).toBe(0);
  });

  it('gates resolution until every active team has committed', () => {
    const s = sim();
    expect(s.canResolve()).toBe(false);
    s.selectAndCommit('a', L(0, -1));
    expect(s.canResolve()).toBe(false);
    expect(s.problems().missing).toEqual(['b']);
    s.selectAndCommit('b', L(1, 0));
    expect(s.canResolve()).toBe(true);
    expect(() => s.resolve()).not.toThrow();
  });

  it('allows a debug override that holds uncommitted teams', () => {
    const s = sim();
    s.selectAndCommit('a', L(0, -1));
    const summary = s.resolve({ allowMissingChoices: true });
    expect(summary.moves.find((m) => m.teamId === 'b')!.outcome).toBe('held-no-choice');
  });
});

describe('advancing rounds', () => {
  it('clears pending choices and records history', () => {
    const s = sim();
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(1, 0));
    const summary = s.resolve();
    expect(s.round).toBe(2);
    expect(s.committedCount()).toBe(0);
    expect(s.selectionFor('a')).toBeUndefined();
    expect(s.history).toEqual([summary]);
    expect(s.log.length).toBe(summary.events.length);
  });

  it('accumulates the log across rounds', () => {
    const s = sim();
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(1, 0));
    s.resolve();
    const afterFirst = s.log.length;
    s.selectAndCommit('a', CENTRE);
    s.selectAndCommit('b', L(2, 0));
    s.resolve();
    expect(s.log.length).toBeGreaterThan(afterFirst);
    expect(s.history).toHaveLength(2);
  });

  it('tracks explored hexes and occupancy', () => {
    const s = sim();
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(1, 0));
    s.resolve();
    expect([...s.exploredHexIds()].sort()).toEqual([CENTRE, L(0, -1), L(1, 0), L(2, 0)].sort());
    expect(s.occupancy().get(L(0, -1))).toEqual(['a']);
  });

  it('resets to the initial state', () => {
    const s = sim();
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(1, 0));
    s.resolve();
    s.select('a', CENTRE);
    s.reset();
    expect(s.round).toBe(1);
    expect(s.history).toEqual([]);
    expect(s.log).toEqual([]);
    expect(s.committedCount()).toBe(0);
    expect(s.selectionFor('a')).toBeUndefined();
    expect(s.team('a').hexId).toBe(CENTRE);
    expect(s.team('a').visited).toEqual([CENTRE]);
  });

  it('reproduces a replayed run exactly', () => {
    const run = (s: Simulation) => {
      s.selectAndCommit('a', L(0, -1));
      s.selectAndCommit('b', L(1, 0));
      s.resolve();
      s.selectAndCommit('a', L(1, -1));
      s.selectAndCommit('b', L(1, -1));
      s.resolve();
      return JSON.stringify(s.snapshot());
    };
    const first = run(sim());
    const second = run(sim());
    expect(second).toBe(first);
  });
});

describe('inspection', () => {
  it('exposes route analysis for the scenario start hexes', () => {
    const s = sim();
    expect(s.analysis.starts.map((a) => a.hexId)).toEqual([CENTRE, L(2, 0)]);
    expect(s.analysis.starts[0]!.nearestExitDistance).toBe(2);
  });

  it('dumps a serialisable snapshot', () => {
    const s = sim();
    s.select('a', L(0, -1));
    const snapshot = JSON.parse(JSON.stringify(s.snapshot()));
    expect(snapshot.scenarioId).toBe('fixture-scenario');
    expect(snapshot.pending.selections).toEqual({ a: L(0, -1) });
    expect(snapshot.pending.committed).toEqual({});
    expect(snapshot.state.teams).toHaveLength(2);
  });

  it('reports a team definition and its live state separately', () => {
    const s = sim();
    expect(s.teamDefinition('a').startHexId).toBe(CENTRE);
    expect(s.team('a').hexId).toBe(CENTRE);
    expect(() => s.team('nope')).toThrow(/unknown team/);
  });
});
