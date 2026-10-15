import { describe, expect, it } from 'vitest';

import { createRng } from '../../src/core/rng';
import {
  parseItems,
  parseMap,
  parseRules,
  parseTerrains,
  parseTopics,
} from '../../src/forest/config';
import { resolveBand, type Choice, type GameState, type TeamState } from '../../src/forest/resolve';
import type { RuleParameters } from '../../src/forest/types';

const terrains = parseTerrains(
  {
    terrains: [
      { id: 'open', label: 'Open', description: 'o', fightRule: 'always', grantsIntel: true, lootTier: 2, symbol: '^' },
      { id: 'mixed', label: 'Mixed', description: 'm', fightRule: 'if-hunted', grantsIntel: false, lootTier: 1, symbol: '=' },
      { id: 'deep', label: 'Deep', description: 'd', fightRule: 'never', grantsIntel: false, lootTier: 0, symbol: '*' },
    ],
  },
  'fixture/terrain',
);

const items = parseItems(
  { items: [{ id: 'lamp', name: 'Lamp', kind: 'helper', effect: 'x', symbol: 'L' }] },
  'fixture/items',
);

const topics = parseTopics(
  { topics: [{ id: 'rocks', name: 'Rocks', description: 'r', symbol: 'R' }] },
  'fixture/topics',
);

const map = parseMap(
  {
    id: 'm',
    name: 'M',
    bands: [
      {
        id: 'b1',
        name: 'Band 1',
        locations: [
          { id: 'ridge', name: 'Ridge', terrain: 'open', topic: 'rocks', loot: ['lamp'] },
          { id: 'trail', name: 'Trail', terrain: 'mixed', topic: 'rocks', loot: ['lamp'] },
          { id: 'bog', name: 'Bog', terrain: 'deep', topic: 'rocks', loot: [] },
        ],
      },
      { id: 'end', name: 'Trailhead', locations: [{ id: 'station', name: 'Station', terrain: 'open', topic: 'rocks', loot: [] }] },
    ],
  },
  terrains,
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
      extraChaosAtTheTrailhead: 3,
    },
    itemsDrawnAtStart: 0,
    treasureForWinningAMatchup: 0,
    winnerAlsoTakesTheLosersItems: true,
    trapsSetByEachLoser: 1,
    itemsLostToATrap: 1,
    trapsStartFromRound: 2,
    aTeamAloneTakesWhatIsLyingThere: true,
    theWinnerTakesWhatIsLyingThere: true,
    everyMeetingIsAMatchup: false,
    hidingInDeepCoverAlwaysWorks: true,
    itemsLostByHuntingAndFindingNobody: 1,
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
    skillByTopic: { rocks: 1 },
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
  picks: Record<string, Choice>,
  over: Partial<RuleParameters> = {},
  traps: GameState['traps'] = [],
  seed = 1,
) {
  const state: GameState = { band: 0, teams, traps };
  return resolveBand(
    map,
    terrains,
    { ...rules, ...over },
    itemPool,
    state,
    new Map(Object.entries(picks)),
    createRng(seed),
  );
}

const at = (locationId: string, posture: 'hunt' | 'hide'): Choice => ({ locationId, posture });

describe('the hunt / hide matrix', () => {
  it('lets two hiders pass each other in the dark on mixed cover', () => {
    const { state, summary } = run([team('a'), team('b')], {
      a: at('trail', 'hide'),
      b: at('trail', 'hide'),
    });
    expect(summary.fights).toBe(0);
    expect(summary.eliminated).toEqual([]);
    expect(summary.outcomes.find((o) => o.locationId === 'trail')!.kind).toBe('passed-in-the-dark');
    expect(state.teams.every((t) => t.alive)).toBe(true);
  });

  it('starts a fight on mixed cover as soon as one team hunts', () => {
    const { summary } = run([team('a'), team('b')], {
      a: at('trail', 'hunt'),
      b: at('trail', 'hide'),
    });
    expect(summary.fights).toBe(1);
    expect(summary.eliminated).toHaveLength(1);
  });

  it('forces a fight on open ground even when both teams hid', () => {
    const { summary } = run([team('a'), team('b')], {
      a: at('ridge', 'hide'),
      b: at('ridge', 'hide'),
    });
    expect(summary.fights).toBe(1);
    expect(summary.outcomes.find((o) => o.locationId === 'ridge')!.kind).toBe('fight');
  });

  it('never starts a matchup in deep cover while hiding there works', () => {
    const { summary } = run([team('a'), team('b'), team('c')], {
      a: at('bog', 'hunt'),
      b: at('bog', 'hide'),
      c: at('bog', 'hunt'),
    });
    expect(summary.fights).toBe(0);
    expect(summary.eliminated).toEqual([]);
  });

  it('turns deep cover into ordinary ground when hiding there is switched off', () => {
    const { summary } = run(
      [team('a'), team('b')],
      { a: at('bog', 'hunt'), b: at('bog', 'hide') },
      { hidingInDeepCoverAlwaysWorks: false },
    );
    expect(summary.fights).toBe(1);
  });

  it('leaves exactly one team standing however many arrive', () => {
    const teams = ['a', 'b', 'c', 'd', 'e'].map((id) => team(id));
    const picks = Object.fromEntries(teams.map((t) => [t.id, at('ridge', 'hunt')]));
    const { state, summary } = run(teams, picks);
    expect(summary.eliminated).toHaveLength(4);
    expect(state.teams.filter((t) => t.alive)).toHaveLength(1);
    expect(summary.outcomes.find((o) => o.locationId === 'ridge')!.winnerId).toBe(
      state.teams.find((t) => t.alive)!.id,
    );
  });
});

describe('spoils and penalties', () => {
  it('gives the winner the losers items and the location loot', () => {
    const { state } = run([team('a', { items: ['lamp'] }), team('b', { items: ['lamp', 'lamp'] })], {
      a: at('ridge', 'hunt'),
      b: at('ridge', 'hunt'),
    });
    const winner = state.teams.find((t) => t.alive)!;
    // one lamp of its own + the loser's + the ridge's loot
    expect(winner.items).toHaveLength(4);
    expect(state.teams.filter((t) => !t.alive)[0]!.items).toEqual([]);
  });

  it('lets a team alone on a location pick up the loot', () => {
    const { state, summary } = run([team('a')], { a: at('ridge', 'hide') });
    expect(summary.outcomes.find((o) => o.locationId === 'ridge')!.kind).toBe('solo');
    expect(state.teams[0]!.items).toEqual(['lamp']);
  });

  it('gives nothing to teams that merely coexisted', () => {
    const { state } = run([team('a'), team('b')], { a: at('trail', 'hide'), b: at('trail', 'hide') });
    expect(state.teams.every((t) => t.items.length === 0)).toBe(true);
  });

  it('makes a hunter who finds nobody drop an item', () => {
    const { state, summary } = run([team('a', { items: ['lamp', 'lamp'] })], { a: at('trail', 'hunt') });
    const outcome = summary.outcomes.find((o) => o.locationId === 'trail')!;
    expect(outcome.noisyHunterIds).toEqual(['a']);
    // dropped one, then picked up the trail's loot for being alone
    expect(state.teams[0]!.items).toHaveLength(2);
  });

  it('costs an empty-handed hunter nothing it does not have', () => {
    const { state } = run([team('a')], { a: at('trail', 'hunt') });
    expect(state.teams[0]!.items).toEqual(['lamp']);
  });
});

describe('traps', () => {
  it('strips one item from every team that walks in', () => {
    const { state, summary } = run(
      [team('a', { items: ['lamp', 'lamp'] }), team('b', { items: ['lamp'] })],
      { a: at('trail', 'hide'), b: at('trail', 'hide') },
      {},
      [{ locationId: 'trail', placedBy: 'ghost' }],
    );
    expect(summary.outcomes.find((o) => o.locationId === 'trail')!.trapTriggeredOn).toEqual(['a', 'b']);
    expect(state.teams.find((t) => t.id === 'a')!.items).toHaveLength(1);
    expect(state.teams.find((t) => t.id === 'b')!.items).toHaveLength(0);
  });

  it('never eliminates anybody', () => {
    const { state } = run([team('a', { items: ['lamp'] })], { a: at('bog', 'hide') }, {}, [
      { locationId: 'bog', placedBy: 'ghost' },
    ]);
    expect(state.teams[0]!.alive).toBe(true);
  });

  it('is dodged by a team carrying intel, which is then spent', () => {
    const { state, summary } = run(
      [team('a', { items: ['lamp'], hasIntel: true })],
      { a: at('bog', 'hide') },
      {},
      [{ locationId: 'bog', placedBy: 'ghost' }],
    );
    expect(summary.outcomes.find((o) => o.locationId === 'bog')!.trapTriggeredOn).toEqual([]);
    expect(state.teams[0]!.items).toEqual(['lamp']);
    expect(state.teams[0]!.hasIntel).toBe(false);
  });
});

describe('intel', () => {
  it('is earned by surviving on open ground and nowhere else', () => {
    const { state } = run([team('a'), team('b')], { a: at('ridge', 'hide'), b: at('bog', 'hide') });
    expect(state.teams.find((t) => t.id === 'a')!.hasIntel).toBe(true);
    expect(state.teams.find((t) => t.id === 'b')!.hasIntel).toBe(false);
  });
});

describe('determinism and order independence', () => {
  const teams = [team('a'), team('b'), team('c')];
  const picks = { a: at('ridge', 'hunt'), b: at('ridge', 'hunt'), c: at('trail', 'hide') };

  it('gives the same result for the same seed', () => {
    const first = run(teams, picks, {}, [], 42);
    const second = run(teams, picks, {}, [], 42);
    expect(JSON.stringify(second.summary)).toBe(JSON.stringify(first.summary));
  });

  it('does not depend on the order teams are stored in', () => {
    const normal = run(teams, picks, {}, [], 42);
    const flipped = run([...teams].reverse(), picks, {}, [], 42);
    expect(flipped.summary.eliminated).toEqual(normal.summary.eliminated);
    expect(
      flipped.summary.outcomes.find((o) => o.locationId === 'ridge')!.winnerId,
    ).toBe(normal.summary.outcomes.find((o) => o.locationId === 'ridge')!.winnerId);
  });

  it('rejects a choice naming a location in another band', () => {
    expect(() => run([team('a')], { a: at('station', 'hide') })).toThrow(/not in band/);
  });

  it('rejects a living team with no choice', () => {
    expect(() => run([team('a'), team('b')], { a: at('bog', 'hide') })).toThrow(/made no choice/);
  });
});
