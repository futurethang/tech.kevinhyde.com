import { describe, expect, it } from 'vitest';

import { resolveRound, validateChoices } from '../src/core/rounds';
import { createInitialState, legalMoves, type SimState } from '../src/core/state';
import { L, makeFixture, type FixtureTeam } from './fixtures';

const CENTRE = L(0, 0);
const EXIT = L(0, -2);

function setup(
  teams: readonly FixtureTeam[],
  rules: Record<string, unknown> = {},
  mapOptions: Record<string, unknown> = { trailheadHexIds: [EXIT] },
) {
  const { resolved, board } = makeFixture(teams, mapOptions, rules);
  return { resolved, board, state: createInitialState(resolved) };
}

function choices(pairs: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(pairs));
}

function positions(state: SimState): Record<string, string> {
  return Object.fromEntries(state.teams.map((t) => [t.id, t.hexId]));
}

describe('initial state', () => {
  it('places every team on its start hex, active, with its inventory', () => {
    const { resolved, state } = setup([{ id: 'a', startHexId: CENTRE }]);
    expect(state.round).toBe(1);
    const team = state.teams[0]!;
    expect(team.hexId).toBe(CENTRE);
    expect(team.status).toBe('active');
    expect(team.visited).toEqual([CENTRE]);
    expect(team.trailheadId).toBeNull();
    expect(state.rngState).toBe(resolved.scenario.seed);
  });
});

describe('legal moves', () => {
  it('offers the adjacent hexes plus holding position', () => {
    const { resolved, board, state } = setup([{ id: 'a', startHexId: CENTRE }]);
    const moves = legalMoves(board, resolved, state.teams[0]!);
    expect(moves).toContain(CENTRE);
    expect(moves).toHaveLength(7);
  });

  it('drops holding position when the scenario forbids it', () => {
    const { resolved, board, state } = setup([{ id: 'a', startHexId: CENTRE }], {
      allowStayInPlace: false,
    });
    const moves = legalMoves(board, resolved, state.teams[0]!);
    expect(moves).not.toContain(CENTRE);
    expect(moves).toHaveLength(6);
  });

  it('excludes impassable neighbours', () => {
    const { resolved, board, state } = setup(
      [{ id: 'a', startHexId: CENTRE }],
      {},
      { trailheadHexIds: [EXIT], water: ['1,0'] },
    );
    expect(legalMoves(board, resolved, state.teams[0]!)).not.toContain(L(1, 0));
  });
});

describe('choice validation', () => {
  const base = () =>
    setup([
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(2, 0) },
    ]);

  it('reports teams that have not committed', () => {
    const { resolved, board, state } = base();
    const problems = validateChoices(board, resolved, state, choices({ a: L(0, -1) }));
    expect(problems.missing).toEqual(['b']);
    expect(problems.illegal).toEqual([]);
  });

  it('reports a destination that is not adjacent', () => {
    const { resolved, board, state } = base();
    const problems = validateChoices(board, resolved, state, choices({ a: EXIT, b: L(2, 0) }));
    expect(problems.illegal).toEqual([{ teamId: 'a', hexId: EXIT }]);
  });

  it('reports a choice for a team that cannot move', () => {
    const { resolved, board, state } = base();
    const problems = validateChoices(
      board,
      resolved,
      state,
      choices({ a: CENTRE, b: L(2, 0), ghost: CENTRE }),
    );
    expect(problems.ineligible).toEqual(['ghost']);
  });
});

describe('simultaneous resolution', () => {
  it('moves every team and records the round', () => {
    const { resolved, board, state } = setup([
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(2, 0) },
    ]);
    const { state: next, summary } = resolveRound(
      board,
      resolved,
      state,
      choices({ a: L(0, -1), b: L(1, 1) }),
    );
    expect(positions(next)).toEqual({ a: L(0, -1), b: L(1, 1) });
    expect(next.round).toBe(2);
    expect(summary.round).toBe(1);
    expect(summary.moves.map((m) => m.teamId)).toEqual(['a', 'b']);
    expect(summary.moves[0]).toMatchObject({
      fromHexId: CENTRE,
      toHexId: L(0, -1),
      requestedHexId: L(0, -1),
      outcome: 'moved',
    });
    expect(next.teams[0]!.visited).toEqual([CENTRE, L(0, -1)]);
  });

  it('does not mutate the state or choices it was given', () => {
    const { resolved, board, state } = setup([{ id: 'a', startHexId: CENTRE }]);
    const before = JSON.stringify(state);
    const given = choices({ a: L(0, -1) });
    resolveRound(board, resolved, state, given);
    expect(JSON.stringify(state)).toBe(before);
    expect([...given.keys()]).toEqual(['a']);
  });

  it('records a hold without extending the visited trail', () => {
    const { resolved, board, state } = setup([{ id: 'a', startHexId: CENTRE }]);
    const { state: next, summary } = resolveRound(board, resolved, state, choices({ a: CENTRE }));
    expect(summary.moves[0]!.outcome).toBe('held');
    expect(next.teams[0]!.visited).toEqual([CENTRE]);
  });

  it('refuses to resolve while a team has not committed', () => {
    const { resolved, board, state } = setup([
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(2, 0) },
    ]);
    expect(() => resolveRound(board, resolved, state, choices({ a: CENTRE }))).toThrow(
      /have not committed/,
    );
  });

  it('holds uncommitted teams when the facilitator overrides', () => {
    const { resolved, board, state } = setup([
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(2, 0) },
    ]);
    const { state: next, summary } = resolveRound(board, resolved, state, choices({ a: L(0, -1) }), {
      allowMissingChoices: true,
    });
    expect(positions(next)).toEqual({ a: L(0, -1), b: L(2, 0) });
    const held = summary.moves.find((m) => m.teamId === 'b')!;
    expect(held.outcome).toBe('held-no-choice');
    expect(held.requestedHexId).toBeNull();
    expect(summary.events.some((e) => e.type === 'missing-choice')).toBe(true);
  });

  it('throws on an illegal destination', () => {
    const { resolved, board, state } = setup([{ id: 'a', startHexId: CENTRE }]);
    expect(() => resolveRound(board, resolved, state, choices({ a: EXIT }))).toThrow(
      /illegal destination/,
    );
  });

  it('throws when a choice names a team that cannot move', () => {
    const { resolved, board, state } = setup([{ id: 'a', startHexId: CENTRE }]);
    expect(() =>
      resolveRound(board, resolved, state, choices({ a: CENTRE, ghost: CENTRE })),
    ).toThrow(/cannot move this round/);
  });
});

describe('resolution is order-independent and deterministic', () => {
  const teams: FixtureTeam[] = [
    { id: 'a', startHexId: CENTRE },
    { id: 'b', startHexId: L(1, -1) },
    { id: 'c', startHexId: L(0, -1) },
    { id: 'd', startHexId: L(2, 0) },
  ];
  const picks = { a: L(0, -1), b: L(0, -1), c: L(0, -1), d: L(1, 0) };

  it('produces the same result twice for the same inputs', () => {
    const { resolved, board, state } = setup(teams);
    const first = resolveRound(board, resolved, state, choices(picks));
    const second = resolveRound(board, resolved, state, choices(picks));
    expect(JSON.stringify(second.summary)).toBe(JSON.stringify(first.summary));
    expect(JSON.stringify(second.state)).toBe(JSON.stringify(first.state));
  });

  it('is unaffected by the order teams are stored in', () => {
    const { resolved, board, state } = setup(teams);
    const reversed: SimState = { ...state, teams: [...state.teams].reverse() };
    const normal = resolveRound(board, resolved, state, choices(picks));
    const flipped = resolveRound(board, resolved, reversed, choices(picks));
    expect(JSON.stringify(flipped.summary)).toBe(JSON.stringify(normal.summary));
    expect(positions(flipped.state)).toEqual(positions(normal.state));
  });

  it('keeps the roster order of the state it was given', () => {
    const { resolved, board, state } = setup(teams);
    const { state: next } = resolveRound(board, resolved, state, choices(picks));
    expect(next.teams.map((t) => t.id)).toEqual(state.teams.map((t) => t.id));
  });

  it('carries the rng state through the round', () => {
    const { resolved, board, state } = setup(teams);
    const { summary, state: next } = resolveRound(board, resolved, state, choices(picks));
    expect(summary.rng.before).toBe(state.rngState);
    expect(next.rngState).toBe(summary.rng.after);
  });
});

describe('collisions', () => {
  it('reports three teams landing on one hex as a single encounter', () => {
    const { resolved, board, state } = setup([
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(1, -1) },
      { id: 'c', startHexId: L(-1, 0) },
    ]);
    const { summary } = resolveRound(
      board,
      resolved,
      state,
      choices({ a: L(0, -1), b: L(0, -1), c: CENTRE }),
    );
    const shared = summary.encounters.filter((e) => e.kind === 'shared-hex');
    expect(shared).toHaveLength(1);
    expect(shared[0]).toEqual({ kind: 'shared-hex', hexId: L(0, -1), teamIds: ['a', 'b'] });
    expect(summary.moves.find((m) => m.teamId === 'a')!.encounteredTeamIds).toEqual(['b']);
    expect(summary.moves.find((m) => m.teamId === 'c')!.encounteredTeamIds).toEqual([]);
  });

  it('counts an encounter once per team per round', () => {
    const { resolved, board, state } = setup([
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(1, -1) },
      { id: 'c', startHexId: L(-1, 0) },
    ]);
    const { state: next } = resolveRound(
      board,
      resolved,
      state,
      choices({ a: L(0, -1), b: L(0, -1), c: L(0, -1) }),
    );
    for (const team of next.teams) expect(team.encounterCount).toBe(1);
  });

  it('can be switched off', () => {
    const { resolved, board, state } = setup(
      [
        { id: 'a', startHexId: CENTRE },
        { id: 'b', startHexId: L(1, -1) },
      ],
      { collisionTriggersEncounter: false },
    );
    const { summary } = resolveRound(
      board,
      resolved,
      state,
      choices({ a: L(0, -1), b: L(0, -1) }),
    );
    expect(summary.encounters).toEqual([]);
  });
});

describe('swaps', () => {
  it('lets two teams trade hexes and reports the crossing', () => {
    const { resolved, board, state } = setup([
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(0, -1) },
    ]);
    const { state: next, summary } = resolveRound(
      board,
      resolved,
      state,
      choices({ a: L(0, -1), b: CENTRE }),
    );
    expect(positions(next)).toEqual({ a: L(0, -1), b: CENTRE });
    expect(summary.encounters).toEqual([
      { kind: 'swap', hexId: [CENTRE, L(0, -1)].sort()[0], teamIds: ['a', 'b'] },
    ]);
    expect(summary.moves.every((m) => m.outcome === 'moved')).toBe(true);
  });

  it('bounces both teams back when swaps are forbidden', () => {
    const { resolved, board, state } = setup(
      [
        { id: 'a', startHexId: CENTRE },
        { id: 'b', startHexId: L(0, -1) },
      ],
      { allowSwaps: false },
    );
    const { state: next, summary } = resolveRound(
      board,
      resolved,
      state,
      choices({ a: L(0, -1), b: CENTRE }),
    );
    expect(positions(next)).toEqual({ a: CENTRE, b: L(0, -1) });
    expect(summary.moves.map((m) => m.outcome)).toEqual(['blocked-swap', 'blocked-swap']);
    expect(summary.encounters).toEqual([]);
    expect(summary.events.some((e) => e.type === 'blocked-swap')).toBe(true);
    expect(next.teams[0]!.visited).toEqual([CENTRE]);
  });

  it('is not a swap when only one team moves', () => {
    const { resolved, board, state } = setup(
      [
        { id: 'a', startHexId: CENTRE },
        { id: 'b', startHexId: L(0, -1) },
      ],
      { allowSwaps: false },
    );
    const { state: next, summary } = resolveRound(
      board,
      resolved,
      state,
      choices({ a: L(0, -1), b: L(0, -1) }),
    );
    expect(positions(next)).toEqual({ a: L(0, -1), b: L(0, -1) });
    expect(summary.encounters.map((e) => e.kind)).toEqual(['shared-hex']);
  });
});

describe('trailheads', () => {
  it('parks a team at a trailhead awaiting its escape test', () => {
    const { resolved, board, state } = setup([{ id: 'a', startHexId: L(0, -1) }]);
    const { state: next, summary } = resolveRound(board, resolved, state, choices({ a: EXIT }));
    const team = next.teams[0]!;
    expect(team.status).toBe('at_trailhead');
    expect(team.trailheadId).toBe('TH-1');
    expect(team.stoppedOnRound).toBe(1);
    expect(summary.moves[0]!.reachedTrailheadId).toBe('TH-1');
    expect(summary.events.some((e) => e.type === 'trailhead-reached')).toBe(true);
  });

  it('leaves a team at a CLOSED trailhead active', () => {
    const { resolved, board, state } = setup(
      [{ id: 'a', startHexId: L(0, -1) }],
      {},
      { closedTrailheadHexIds: [EXIT] },
    );
    const { state: next } = resolveRound(board, resolved, state, choices({ a: EXIT }));
    expect(next.teams[0]!.status).toBe('active');
    expect(next.teams[0]!.trailheadId).toBeNull();
  });

  it('makes a team at a trailhead ineligible to move next round', () => {
    const { resolved, board, state } = setup([
      { id: 'a', startHexId: L(0, -1) },
      { id: 'b', startHexId: CENTRE },
    ]);
    const first = resolveRound(board, resolved, state, choices({ a: EXIT, b: L(1, 0) }));
    expect(legalMoves(board, resolved, first.state.teams[0]!)).toEqual([]);

    // Only team b must commit now; a choice for team a is rejected outright.
    expect(() =>
      resolveRound(board, resolved, first.state, choices({ a: L(0, -1), b: CENTRE })),
    ).toThrow(/cannot move this round/);

    const second = resolveRound(board, resolved, first.state, choices({ b: CENTRE }));
    expect(second.summary.moves.map((m) => m.teamId)).toEqual(['b']);
    expect(second.state.teams[0]!.hexId).toBe(EXIT);
  });

  it('still reports an encounter with a team parked at a trailhead', () => {
    const { resolved, board, state } = setup([
      { id: 'a', startHexId: L(0, -1) },
      { id: 'b', startHexId: L(1, -2) },
    ]);
    const first = resolveRound(board, resolved, state, choices({ a: EXIT, b: L(1, -1) }));
    const second = resolveRound(board, resolved, first.state, choices({ b: L(0, -1) }));
    const third = resolveRound(board, resolved, second.state, choices({ b: EXIT }));
    expect(third.summary.encounters).toEqual([
      { kind: 'shared-hex', hexId: EXIT, teamIds: ['a', 'b'] },
    ]);
  });
});

describe('hidden contents', () => {
  const mapWithContents = {
    trailheadHexIds: [EXIT],
    contents: [{ hexId: L(0, -1), kind: 'reward', label: 'Cache', itemId: 'rope' }],
  };

  it('logs a reveal on arrival when the scenario asks for it', () => {
    const { resolved, board, state } = setup(
      [{ id: 'a', startHexId: CENTRE }],
      { revealHiddenContents: true },
      mapWithContents,
    );
    const { state: next, summary } = resolveRound(board, resolved, state, choices({ a: L(0, -1) }));
    expect(summary.events.filter((e) => e.type === 'content-revealed')).toHaveLength(1);
    expect(next.revealedHexIds).toEqual([L(0, -1)]);
  });

  it('reveals a hex only once', () => {
    const { resolved, board, state } = setup(
      [{ id: 'a', startHexId: CENTRE }],
      { revealHiddenContents: true },
      mapWithContents,
    );
    const first = resolveRound(board, resolved, state, choices({ a: L(0, -1) }));
    const second = resolveRound(board, resolved, first.state, choices({ a: CENTRE }));
    const third = resolveRound(board, resolved, second.state, choices({ a: L(0, -1) }));
    expect(third.summary.events.filter((e) => e.type === 'content-revealed')).toHaveLength(0);
    expect(third.state.revealedHexIds).toEqual([L(0, -1)]);
  });

  it('stays quiet when reveals are off', () => {
    const { resolved, board, state } = setup(
      [{ id: 'a', startHexId: CENTRE }],
      { revealHiddenContents: false },
      mapWithContents,
    );
    const { state: next, summary } = resolveRound(board, resolved, state, choices({ a: L(0, -1) }));
    expect(summary.events.some((e) => e.type === 'content-revealed')).toBe(false);
    expect(next.revealedHexIds).toEqual([]);
  });
});
