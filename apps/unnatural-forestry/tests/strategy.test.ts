import { describe, expect, it } from 'vitest';

import { exitDistanceField } from '../src/core/analysis';
import { createRng } from '../src/core/rng';
import { Simulation } from '../src/core/simulation';
import { createInitialState, legalMoves, type SimState } from '../src/core/state';
import {
  chooseAllMoves,
  chooseMove,
  classifyMove,
  getStrategy,
  STRATEGIES,
} from '../src/core/strategy';
import { L, makeFixture, type FixtureTeam } from './fixtures';

const RADIUS = 3;
const CENTRE = L(0, 0, RADIUS);
const EXIT = L(0, -3, RADIUS);
const at = (q: number, r: number) => L(q, r, RADIUS);

function setup(teams: readonly FixtureTeam[], rules: Record<string, unknown> = {}) {
  const { resolved, board } = makeFixture(
    teams,
    { radius: RADIUS, trailheadHexIds: [EXIT] },
    rules,
  );
  return { resolved, board, state: createInitialState(resolved), field: exitDistanceField(board) };
}

describe('move classification', () => {
  it('grades a move by what it does to the exit distance', () => {
    const { board, field } = setup([{ id: 'a', startHexId: CENTRE }]);
    expect(field.dist.get(CENTRE)).toBe(3);
    expect(classifyMove(CENTRE, CENTRE, field)).toBe('hold');
    expect(classifyMove(CENTRE, at(0, -1), field)).toBe('toward');
    expect(classifyMove(CENTRE, at(0, 1), field)).toBe('away');
    const lateral = board
      .passableNeighbors(CENTRE)
      .find((id) => field.dist.get(id) === field.dist.get(CENTRE));
    expect(lateral).toBeDefined();
    expect(classifyMove(CENTRE, lateral!, field)).toBe('lateral');
  });

  it('calls a move lateral when either end has no route to an exit', () => {
    const { field } = setup([{ id: 'a', startHexId: CENTRE }]);
    expect(classifyMove(CENTRE, 'NOWHERE', field)).toBe('lateral');
  });
});

describe('chooseMove', () => {
  it('only ever returns a legal destination', () => {
    const { resolved, board, state, field } = setup([{ id: 'a', startHexId: CENTRE }]);
    const rng = createRng(1);
    const legal = new Set(legalMoves(board, resolved, state.teams[0]!));
    for (let i = 0; i < 300; i++) {
      const choice = chooseMove(board, resolved, state.teams[0]!, field, rng, {
        toward: 1,
        lateral: 1,
        away: 1,
        hold: 1,
      })!;
      expect(legal.has(choice)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const { resolved, board, state, field } = setup([{ id: 'a', startHexId: CENTRE }]);
    const weights = getStrategy('balanced').weights;
    const run = () => {
      const rng = createRng(99);
      return Array.from({ length: 50 }, () =>
        chooseMove(board, resolved, state.teams[0]!, field, rng, weights),
      );
    };
    expect(run()).toEqual(run());
  });

  it('falls back to a flat draw when every weight is zero', () => {
    const { resolved, board, state, field } = setup([{ id: 'a', startHexId: CENTRE }]);
    const rng = createRng(3);
    const legal = new Set(legalMoves(board, resolved, state.teams[0]!));
    const picks = new Set(
      Array.from({ length: 100 }, () =>
        chooseMove(board, resolved, state.teams[0]!, field, rng, {
          toward: 0,
          lateral: 0,
          away: 0,
          hold: 0,
        })!,
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
    for (const pick of picks) expect(legal.has(pick)).toBe(true);
  });

  it('returns null when a team is walled in with no legal move', () => {
    const { resolved, board } = makeFixture(
      [{ id: 'a', startHexId: L(2, 0) }],
      { trailheadHexIds: [L(0, -2)], water: ['2,-1', '1,0', '1,1'] },
      { allowStayInPlace: false },
    );
    const state = createInitialState(resolved);
    const field = exitDistanceField(board);
    expect(chooseMove(board, resolved, state.teams[0]!, field, createRng(1), getStrategy('balanced').weights)).toBeNull();
  });
});

describe('strategy behaviour', () => {
  function classifyDraws(strategyId: string, draws = 600): Record<string, number> {
    const { resolved, board, state, field } = setup([{ id: 'a', startHexId: CENTRE }]);
    const rng = createRng(2024);
    const counts: Record<string, number> = { toward: 0, lateral: 0, away: 0, hold: 0 };
    for (let i = 0; i < draws; i++) {
      const choice = chooseMove(board, resolved, state.teams[0]!, field, rng, getStrategy(strategyId).weights)!;
      counts[classifyMove(CENTRE, choice, field)]!++;
    }
    return counts;
  }

  it('beelines toward the exit far more often than it detours', () => {
    const counts = classifyDraws('beeline');
    expect(counts.toward!).toBeGreaterThan(counts.away! * 5);
  });

  it('wanders away from the exit much more than a beeline does', () => {
    expect(classifyDraws('wander').away!).toBeGreaterThan(classifyDraws('beeline').away! * 3);
  });

  it('keeps a balanced drift between the two', () => {
    const balanced = classifyDraws('balanced');
    expect(balanced.toward!).toBeGreaterThan(balanced.away!);
    expect(balanced.away!).toBeGreaterThan(classifyDraws('beeline').away!);
  });

  it('exposes every strategy by id with sane weights', () => {
    for (const strategy of STRATEGIES) {
      expect(getStrategy(strategy.id)).toBe(strategy);
      for (const weight of Object.values(strategy.weights)) {
        expect(weight).toBeGreaterThanOrEqual(0);
      }
    }
    expect(() => getStrategy('nope')).toThrow(/unknown strategy/);
  });
});

describe('chooseAllMoves', () => {
  const teams: FixtureTeam[] = [
    { id: 'a', startHexId: CENTRE },
    { id: 'b', startHexId: at(1, 0) },
    { id: 'c', startHexId: at(-1, 0) },
  ];

  it('picks exactly one legal move for every active team', () => {
    const { resolved, board, state, field } = setup(teams);
    const picks = chooseAllMoves(board, resolved, state, field, createRng(5), getStrategy('balanced').weights);
    expect([...picks.keys()].sort()).toEqual(['a', 'b', 'c']);
    for (const team of state.teams) {
      expect(legalMoves(board, resolved, team)).toContain(picks.get(team.id)!);
    }
  });

  it('does not depend on the order teams are stored in', () => {
    const { resolved, board, state, field } = setup(teams);
    const reversed: SimState = { ...state, teams: [...state.teams].reverse() };
    const weights = getStrategy('balanced').weights;
    const normal = chooseAllMoves(board, resolved, state, field, createRng(7), weights);
    const flipped = chooseAllMoves(board, resolved, reversed, field, createRng(7), weights);
    expect(Object.fromEntries(flipped)).toEqual(Object.fromEntries(normal));
  });

  it('skips teams that are no longer active', () => {
    const { resolved } = setup([{ id: 'a', startHexId: at(0, -2) }, { id: 'b', startHexId: CENTRE }]);
    const sim = new Simulation(resolved);
    sim.selectAndCommit('a', at(0, -3));
    sim.selectAndCommit('b', at(0, -1));
    sim.resolve();
    expect(sim.team('a').status).toBe('at_trailhead');
    expect(sim.autoFillChoices('balanced')).toEqual([]);
    expect(sim.isCommitted('a')).toBe(false);
    expect(sim.isCommitted('b')).toBe(true);
  });
});

describe('scripted play through the simulation', () => {
  const teams: FixtureTeam[] = [
    { id: 'a', startHexId: CENTRE },
    { id: 'b', startHexId: at(1, 0) },
    { id: 'c', startHexId: at(-1, 0) },
  ];

  it('auto-fills and resolves a round', () => {
    const { resolved } = setup(teams);
    const sim = new Simulation(resolved);
    expect(sim.autoFillChoices('balanced')).toEqual([]);
    expect(sim.canResolve()).toBe(true);
    expect(sim.committedCount()).toBe(3);
    const summary = sim.resolve();
    expect(summary.moves).toHaveLength(3);
    expect(sim.round).toBe(2);
  });

  it('gives a different round each time it is re-rolled', () => {
    const { resolved } = setup(teams);
    const sim = new Simulation(resolved);
    const rolls = new Set<string>();
    for (let i = 0; i < 12; i++) {
      sim.autoFillChoices('wander');
      rolls.add(
        sim.activeTeams()
          .map((t) => `${t.id}:${sim.selectionFor(t.id)}`)
          .join(','),
      );
    }
    expect(rolls.size).toBeGreaterThan(1);
  });

  it('replays identically from a reset', () => {
    const { resolved } = setup(teams);
    const play = (sim: Simulation) => {
      sim.autoPlayRound('balanced');
      sim.autoPlayRound('balanced');
      return JSON.stringify(sim.state);
    };
    const sim = new Simulation(resolved);
    const first = play(sim);
    sim.reset();
    expect(play(sim)).toBe(first);
  });

  it('does not perturb the resolution rng stream', () => {
    const { resolved } = setup(teams);
    const sim = new Simulation(resolved);
    const before = sim.state.rngState;
    sim.autoFillChoices('wander');
    sim.autoFillChoices('wander');
    expect(sim.state.rngState).toBe(before);
  });

  it('runs to the end and parks teams at trailheads', () => {
    const { resolved } = setup(teams, { maxRounds: 30 });
    const sim = new Simulation(resolved);
    const played = sim.autoPlayToEnd('beeline');
    expect(played.length).toBeGreaterThan(0);
    expect(played.length).toBeLessThanOrEqual(30);
    expect(sim.activeTeams()).toHaveLength(0);
    for (const team of sim.state.teams) expect(team.status).toBe('at_trailhead');
  });

  it('stops at the round cap when teams never find an exit', () => {
    const { resolved } = setup(teams, { maxRounds: 3 });
    const sim = new Simulation(resolved);
    expect(sim.autoPlayToEnd('wander')).toHaveLength(3);
    expect(sim.round).toBe(4);
  });

  it('produces collisions often enough to be worth testing with', () => {
    const { resolved } = setup(teams, { maxRounds: 25 });
    let encounters = 0;
    for (let seed = 0; seed < 20; seed++) {
      const sim = new Simulation({
        ...resolved,
        scenario: { ...resolved.scenario, seed },
      });
      sim.autoPlayToEnd('balanced');
      encounters += sim.stats().encounters.total;
    }
    expect(encounters).toBeGreaterThan(0);
  });
});
