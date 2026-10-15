import { describe, expect, it } from 'vitest';

import { createRng } from '../../src/core/rng';
import { parseItems, parseMap, parseRules, parseTopics } from '../../src/forest/config';
import { resolveBand, type Choice, type GameState, type TeamState } from '../../src/forest/resolve';
import type { RuleParameters } from '../../src/forest/types';

const topics = parseTopics(
  {
    topics: [
      { id: 'rocks', name: 'Rocks', description: 'r', symbol: 'R', terrainStyle: 'bare rock', colour: '#888', spookiness: 1 },
      { id: 'owls', name: 'Owls', description: 'o', symbol: 'O', terrainStyle: 'dark wood', colour: '#333', spookiness: 3 },
    ],
  },
  'fixture/topics',
);

const items = parseItems(
  { items: [{ id: 'lamp', name: 'Lamp', kind: 'helper', effect: 'x', symbol: 'L' }] },
  'fixture/items',
);

const map = parseMap(
  {
    id: 'm',
    name: 'M',
    bands: [
      {
        id: 'b1',
        name: 'Band 1',
        timeOfDay: 'dusk',
        locations: [
          { id: 'quarry', name: 'Quarry', topic: 'rocks', vantage: true, loot: ['lamp'] },
          { id: 'thicket', name: 'Thicket', topic: 'owls', vantage: false, loot: ['lamp'] },
          { id: 'hollow', name: 'Hollow', topic: 'owls', vantage: false, loot: [] },
        ],
      },
      {
        id: 'end',
        name: 'Trailhead',
        timeOfDay: 'dark',
        locations: [{ id: 'station', name: 'Station', topic: 'rocks', vantage: true, loot: [] }],
      },
    ],
  },
  topics,
  items,
  'fixture/map',
);

const rules = parseRules(
  {
    matchup: {
      triviaSkillRange: 3,
      howMuchDependsOnTheTheme: 0.6,
      helpPerItem: 1,
      luckRange: 3,
    },
    itemsDrawnAtStart: 0,
    treasureForWinningAMatchup: 1,
    winnerAlsoTakesTheLosersItems: false,
    trapsSetByEachLoser: 1,
    itemsLostToATrap: 1,
    trapsStartFromRound: 2,
    aTeamAloneTakesWhatIsLyingThere: true,
    theWinnerTakesWhatIsLyingThere: true,
    chaosDrawAtTheTrailhead: true,
    chanceTheChaosDrawIsGood: 0.5,
    targetTeamsAtTheTrailhead: { min: 2, max: 3 },
  },
  'fixture/rules',
);

const itemPool = [...items.keys()];

function team(id: string, over: Partial<TeamState> = {}): TeamState {
  return {
    id,
    name: id,
    archetype: 'test',
    skill: 1,
    skillByTopic: { rocks: 1, owls: 1 },
    items: [],
    alive: true,
    locationId: null,
    eliminatedRound: null,
    fightsWon: 0,
    fightsSurvived: 0,
    hasIntel: false,
    ...over,
  };
}

function run(
  teams: readonly TeamState[],
  picks: Record<string, string>,
  over: Partial<RuleParameters> = {},
  traps: GameState['traps'] = [],
  seed = 1,
) {
  const choices = new Map<string, Choice>(
    Object.entries(picks).map(([id, locationId]) => [id, { locationId }]),
  );
  return resolveBand(map, { ...rules, ...over }, itemPool, { band: 0, teams, traps }, choices, createRng(seed));
}

describe('a meeting is a matchup', () => {
  it('leaves one team standing when two arrive', () => {
    const { state, summary } = run([team('a'), team('b')], { a: 'thicket', b: 'thicket' });
    expect(summary.fights).toBe(1);
    expect(summary.eliminated).toHaveLength(1);
    expect(state.teams.filter((t) => t.alive)).toHaveLength(1);
  });

  it('leaves one team standing however many arrive', () => {
    const teams = ['a', 'b', 'c', 'd', 'e'].map((id) => team(id));
    const picks = Object.fromEntries(teams.map((t) => [t.id, 'quarry']));
    const { state, summary } = run(teams, picks);
    expect(summary.eliminated).toHaveLength(4);
    expect(state.teams.filter((t) => t.alive)).toHaveLength(1);
  });

  it('leaves a team on its own alone', () => {
    const { summary } = run([team('a'), team('b')], { a: 'quarry', b: 'hollow' });
    expect(summary.fights).toBe(0);
    expect(summary.eliminated).toEqual([]);
    expect(summary.outcomes.find((o) => o.locationId === 'quarry')!.kind).toBe('solo');
  });

  it('records which theme the matchup was fought on', () => {
    const { summary } = run([team('a'), team('b')], { a: 'thicket', b: 'thicket' });
    const outcome = summary.outcomes.find((o) => o.locationId === 'thicket')!;
    expect(outcome.topicId).toBe('owls');
    expect(outcome.winnerKnewTheTheme).not.toBeNull();
  });

  it('favours the team that knows the theme', () => {
    let expertWins = 0;
    for (let seed = 0; seed < 60; seed++) {
      const { state } = run(
        [team('a', { skillByTopic: { rocks: 0, owls: 9 } }), team('b', { skillByTopic: { rocks: 9, owls: 0 } })],
        { a: 'thicket', b: 'thicket' },
        {},
        [],
        seed,
      );
      if (state.teams.find((t) => t.alive)!.id === 'a') expertWins += 1;
    }
    // 'a' knows owls and the thicket is an owls place; it should win nearly always.
    expect(expertWins).toBeGreaterThan(50);
  });
});

describe('treasure', () => {
  it('goes to the team that wins, on top of what was lying there', () => {
    const { state } = run([team('a'), team('b')], { a: 'thicket', b: 'thicket' });
    const winner = state.teams.find((t) => t.alive)!;
    // one drawn treasure + the lamp lying in the thicket
    expect(winner.items).toHaveLength(2);
  });

  it('does not strip the loser by default', () => {
    const { state } = run([team('a', { items: ['lamp', 'lamp'] }), team('b')], {
      a: 'thicket',
      b: 'thicket',
    });
    const loser = state.teams.find((t) => !t.alive)!;
    if (loser.id === 'a') expect(loser.items).toHaveLength(2);
  });

  it('is taken by a team standing somewhere on its own', () => {
    const { state } = run([team('a')], { a: 'quarry' });
    expect(state.teams[0]!.items).toEqual(['lamp']);
  });

  it('is left alone where there is none', () => {
    const { state } = run([team('a')], { a: 'hollow' });
    expect(state.teams[0]!.items).toEqual([]);
  });
});

describe('traps', () => {
  it('cost an item and never knock a team out', () => {
    const { state, summary } = run(
      [team('a', { items: ['lamp', 'lamp'] })],
      { a: 'hollow' },
      {},
      [{ locationId: 'hollow', placedBy: 'ghost' }],
    );
    expect(summary.outcomes.find((o) => o.locationId === 'hollow')!.trapTriggeredOn).toEqual(['a']);
    expect(state.teams[0]!.items).toHaveLength(1);
    expect(state.teams[0]!.alive).toBe(true);
  });

  it('catch everyone who walks in', () => {
    const { summary } = run(
      [team('a', { items: ['lamp'] }), team('b', { items: ['lamp'] })],
      { a: 'hollow', b: 'hollow' },
      {},
      [{ locationId: 'hollow', placedBy: 'ghost' }],
    );
    expect(summary.outcomes.find((o) => o.locationId === 'hollow')!.trapTriggeredOn).toEqual(['a', 'b']);
  });

  it('are dodged by a team the Director has whispered to, which spends the whisper', () => {
    const { state, summary } = run(
      [team('a', { items: ['lamp'], hasIntel: true })],
      { a: 'hollow' },
      {},
      [{ locationId: 'hollow', placedBy: 'ghost' }],
    );
    expect(summary.outcomes.find((o) => o.locationId === 'hollow')!.trapTriggeredOn).toEqual([]);
    expect(state.teams[0]!.items).toEqual(['lamp']);
    expect(state.teams[0]!.hasIntel).toBe(false);
  });
});

describe('vantage points', () => {
  it('earn the Director a whisper, and nowhere else does', () => {
    const { state } = run([team('a'), team('b')], { a: 'quarry', b: 'hollow' });
    expect(state.teams.find((t) => t.id === 'a')!.hasIntel).toBe(true);
    expect(state.teams.find((t) => t.id === 'b')!.hasIntel).toBe(false);
  });
});

describe('determinism', () => {
  const teams = [team('a'), team('b'), team('c')];
  const picks = { a: 'quarry', b: 'quarry', c: 'hollow' };

  it('gives the same result for the same seed', () => {
    const first = run(teams, picks, {}, [], 42);
    const second = run(teams, picks, {}, [], 42);
    expect(JSON.stringify(second.summary)).toBe(JSON.stringify(first.summary));
  });

  it('does not depend on the order teams are stored in', () => {
    const normal = run(teams, picks, {}, [], 42);
    const flipped = run([...teams].reverse(), picks, {}, [], 42);
    expect(flipped.summary.eliminated).toEqual(normal.summary.eliminated);
  });

  it('rejects a place in another band', () => {
    expect(() => run([team('a')], { a: 'station' })).toThrow(/not in band/);
  });

  it('rejects a team that made no choice', () => {
    expect(() => run([team('a'), team('b')], { a: 'hollow' })).toThrow(/made no choice/);
  });
});
