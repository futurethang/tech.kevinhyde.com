import { describe, expect, it } from 'vitest';

import {
  mapWarnings,
  parseCharacters,
  parseItems,
  parseMap,
  parseScenario,
  parseTerrains,
  resolveScenario,
} from '../src/core/config';
import { ConfigError } from '../src/core/validate';
import { DEFAULT_RULES } from '../src/core/types';
import {
  charactersRaw,
  itemsRaw,
  L,
  makeMapRaw,
  makeScenarioRaw,
  terrainRaw,
  terrains,
} from './fixtures';

const items = parseItems(itemsRaw, 'fixture/items');
const characters = parseCharacters(charactersRaw, 'fixture/characters');

describe('terrain parsing', () => {
  it('indexes terrain by id', () => {
    const parsed = parseTerrains(terrainRaw, 'fixture/terrain');
    expect(parsed.get('open')?.passable).toBe(true);
    expect(parsed.get('water')?.passable).toBe(false);
  });

  it('rejects a duplicate terrain id', () => {
    const raw = { terrains: [terrainRaw.terrains[0], terrainRaw.terrains[0]] };
    expect(() => parseTerrains(raw, 'x')).toThrow(/duplicate id "open"/);
  });

  it('names the failing path on a bad field', () => {
    const raw = { terrains: [{ ...terrainRaw.terrains[0], passable: 'yes' }] };
    expect(() => parseTerrains(raw, 'x')).toThrow(/x\.terrains\[0\]\.passable/);
  });
});

describe('map parsing', () => {
  it('parses the fixture map', () => {
    const map = parseMap(makeMapRaw(), terrains, 'm');
    expect(map.hexes).toHaveLength(19);
    expect(map.id).toBe('fixture-map');
  });

  it('rejects an unknown terrain reference', () => {
    const raw = makeMapRaw() as { hexes: { terrain: string }[] };
    raw.hexes[0]!.terrain = 'lava';
    expect(() => parseMap(raw, terrains, 'm')).toThrow(/unknown terrain "lava"/);
  });

  it('rejects duplicate hex ids', () => {
    const raw = makeMapRaw() as { hexes: { id: string }[] };
    raw.hexes[1]!.id = raw.hexes[0]!.id;
    expect(() => parseMap(raw, terrains, 'm')).toThrow(/duplicate id/);
  });

  it('rejects duplicate coordinates', () => {
    const raw = makeMapRaw() as { hexes: { q: number; r: number }[] };
    raw.hexes[1]!.q = raw.hexes[0]!.q;
    raw.hexes[1]!.r = raw.hexes[0]!.r;
    expect(() => parseMap(raw, terrains, 'm')).toThrow(/duplicate coordinate/);
  });

  it('rejects a trailhead on a hex that does not exist', () => {
    const raw = makeMapRaw({ trailheadHexIds: ['Z9'] });
    expect(() => parseMap(raw, terrains, 'm')).toThrow(/unknown hex "Z9"/);
  });

  it('rejects two trailheads on one hex', () => {
    const raw = makeMapRaw({ trailheadHexIds: [L(0, -2), L(0, -2)] });
    expect(() => parseMap(raw, terrains, 'm')).toThrow(/two trailheads on hex/);
  });

  it('rejects contents pointing at a missing hex', () => {
    const raw = makeMapRaw({ contents: [{ hexId: 'Z9', kind: 'clue', label: 'x' }] });
    expect(() => parseMap(raw, terrains, 'm')).toThrow(/unknown hex "Z9"/);
  });

  it('throws ConfigError carrying the json path', () => {
    const raw = makeMapRaw() as { hexes: { terrain: string }[] };
    raw.hexes[3]!.terrain = 'lava';
    try {
      parseMap(raw, terrains, 'maps/x.json');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).path).toBe('maps/x.json.hexes[3].terrain');
    }
  });
});

describe('scenario parsing and resolution', () => {
  const map = parseMap(makeMapRaw({ trailheadHexIds: [L(0, -2)] }), terrains, 'm');

  it('fills in default rules when none are given', () => {
    const raw = makeScenarioRaw([{ id: 'a', startHexId: L(0, 0) }]) as Record<string, unknown>;
    delete raw.rules;
    expect(parseScenario(raw, 's').rules).toEqual(DEFAULT_RULES);
  });

  it('merges partial rules over the defaults', () => {
    const raw = makeScenarioRaw([{ id: 'a', startHexId: L(0, 0) }], { allowSwaps: false });
    const rules = parseScenario(raw, 's').rules;
    expect(rules.allowSwaps).toBe(false);
    expect(rules.allowStayInPlace).toBe(DEFAULT_RULES.allowStayInPlace);
  });

  it('rejects movesPerRound below 1', () => {
    const raw = makeScenarioRaw([{ id: 'a', startHexId: L(0, 0) }], { movesPerRound: 0 });
    expect(() => parseScenario(raw, 's')).toThrow(/at least 1/);
  });

  it('rejects two teams sharing a start hex', () => {
    const scenario = parseScenario(
      makeScenarioRaw([
        { id: 'a', startHexId: L(0, 0) },
        { id: 'b', startHexId: L(0, 0) },
      ]),
      's',
    );
    expect(() => resolveScenario({ scenario, map, terrains, items, characters })).toThrow(
      /share starting hex/,
    );
  });

  it('rejects a start hex that is not on the map', () => {
    const scenario = parseScenario(makeScenarioRaw([{ id: 'a', startHexId: 'Z9' }]), 's');
    expect(() => resolveScenario({ scenario, map, terrains, items, characters })).toThrow(
      /unknown hex "Z9"/,
    );
  });

  it('rejects a scenario pointed at the wrong map', () => {
    const raw = makeScenarioRaw([{ id: 'a', startHexId: L(0, 0) }]) as Record<string, unknown>;
    raw.mapId = 'other-map';
    const scenario = parseScenario(raw, 's');
    expect(() => resolveScenario({ scenario, map, terrains, items, characters })).toThrow(
      /expects map "other-map"/,
    );
  });

  it('rejects an unknown item in a team inventory', () => {
    const raw = makeScenarioRaw([{ id: 'a', startHexId: L(0, 0) }]) as {
      teams: { items: string[] }[];
    };
    raw.teams[0]!.items = ['jetpack'];
    const scenario = parseScenario(raw, 's');
    expect(() => resolveScenario({ scenario, map, terrains, items, characters })).toThrow(
      /unknown item "jetpack"/,
    );
  });

  it('does not mutate the config it returns', () => {
    const scenario = parseScenario(makeScenarioRaw([{ id: 'a', startHexId: L(0, 0) }]), 's');
    expect(Object.isFrozen(scenario)).toBe(true);
    expect(Object.isFrozen(scenario.rules)).toBe(true);
    expect(Object.isFrozen(map.hexes)).toBe(true);
  });
});

describe('map warnings', () => {
  it('flags a trailhead that is not on the perimeter', () => {
    const map = parseMap(makeMapRaw({ trailheadHexIds: [L(0, 0)] }), terrains, 'm');
    expect(mapWarnings(map, terrains).join('\n')).toMatch(/not on the map perimeter/);
  });

  it('flags a trailhead on impassable ground', () => {
    const map = parseMap(
      makeMapRaw({ trailheadHexIds: [L(0, -2)], water: ['0,-2'] }),
      terrains,
      'm',
    );
    expect(mapWarnings(map, terrains).join('\n')).toMatch(/impassable hex/);
  });

  it('flags a passable hex walled in by impassable neighbours', () => {
    const map = parseMap(makeMapRaw({ water: ['2,-1', '1,0', '1,1'] }), terrains, 'm');
    expect(mapWarnings(map, terrains).join('\n')).toMatch(/every neighbour is impassable/);
  });

  it('is silent on a clean map', () => {
    const map = parseMap(makeMapRaw({ trailheadHexIds: [L(0, -2)] }), terrains, 'm');
    expect(mapWarnings(map, terrains)).toEqual([]);
  });
});
