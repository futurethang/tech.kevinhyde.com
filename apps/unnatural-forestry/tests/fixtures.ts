/**
 * Small hand-built fixtures. Tests use these rather than the generated
 * districts so that a map re-roll can never quietly change an assertion.
 */

import {
  parseCharacters,
  parseItems,
  parseMap,
  parseScenario,
  parseTerrains,
  resolveScenario,
} from '../src/core/config';
import { axialKey, gridLabel, hexDisc } from '../src/core/hex';
import { createBoard } from '../src/core/board';
import type { ResolvedScenario, TerrainType } from '../src/core/types';

export const terrainRaw = {
  terrains: [
    {
      id: 'open',
      label: 'Open',
      color: '#aaaaaa',
      passable: true,
      visibleClue: 'walkable',
      signals: { risk: 'low', reward: 'none' },
    },
    {
      id: 'water',
      label: 'Water',
      color: '#0000ff',
      passable: false,
      visibleClue: 'wet',
      signals: { risk: 'high', reward: 'none' },
    },
  ],
};

export const terrains: ReadonlyMap<string, TerrainType> = parseTerrains(terrainRaw, 'fixture/terrain');

export const itemsRaw = {
  items: [
    { id: 'rope', name: 'Rope', description: 'A rope.', kind: 'tool' },
  ],
};

export const charactersRaw = {
  characters: [
    {
      id: 'mole',
      name: 'Mole',
      species: 'Scapanus',
      trait: { id: 'digger', label: 'Digger', description: 'Digs.' },
    },
  ],
};

export interface FixtureMapOptions {
  readonly radius?: number;
  /** Coordinates (as "q,r") to make impassable. */
  readonly water?: readonly string[];
  /** Hex ids that carry a trailhead. */
  readonly trailheadHexIds?: readonly string[];
  readonly closedTrailheadHexIds?: readonly string[];
  readonly contents?: readonly Record<string, unknown>[];
}

/**
 * A hex disc of the given radius, every hex "open" unless listed in `water`.
 * Hex ids are grid labels, so a radius-2 map has ids A1..E5.
 */
export function makeMapRaw(options: FixtureMapOptions = {}): Record<string, unknown> {
  const radius = options.radius ?? 2;
  const water = new Set(options.water ?? []);
  const hexes = hexDisc(radius).map((c) => ({
    id: gridLabel(c, radius),
    q: c.q,
    r: c.r,
    terrain: water.has(axialKey(c)) ? 'water' : 'open',
  }));
  const open = (options.trailheadHexIds ?? []).map((hexId, i) => ({
    id: `TH-${i + 1}`,
    hexId,
    name: `Trailhead ${i + 1}`,
    closed: false,
  }));
  const closed = (options.closedTrailheadHexIds ?? []).map((hexId, i) => ({
    id: `THC-${i + 1}`,
    hexId,
    name: `Closed trailhead ${i + 1}`,
    closed: true,
  }));
  return {
    id: 'fixture-map',
    name: 'Fixture Map',
    layout: { shape: 'hex-disc', radius, hexSize: 10 },
    hexes,
    trailheads: [...open, ...closed],
    startPositions: [{ id: 'SP-1', hexId: gridLabel({ q: 0, r: 0 }, radius) }],
    contents: options.contents ?? [],
  };
}

export interface FixtureTeam {
  readonly id: string;
  readonly startHexId: string;
}

export function makeScenarioRaw(
  teams: readonly FixtureTeam[],
  rules: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'fixture-scenario',
    name: 'Fixture Scenario',
    description: 'For tests.',
    mapId: 'fixture-map',
    seed: 1234,
    rules,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.id,
      color: '#ffffff',
      startHexId: t.startHexId,
      characterId: 'mole',
      items: [],
    })),
  };
}

export function makeFixture(
  teams: readonly FixtureTeam[],
  mapOptions: FixtureMapOptions = {},
  rules: Record<string, unknown> = {},
): { resolved: ResolvedScenario; board: ReturnType<typeof createBoard> } {
  const items = parseItems(itemsRaw, 'fixture/items');
  const characters = parseCharacters(charactersRaw, 'fixture/characters');
  const map = parseMap(makeMapRaw(mapOptions), terrains, 'fixture/map');
  const scenario = parseScenario(makeScenarioRaw(teams, rules), 'fixture/scenario');
  const resolved = resolveScenario({ scenario, map, terrains, items, characters });
  return { resolved, board: createBoard(map, terrains) };
}

/** Grid label for a coordinate on a fixture map of the given radius. */
export function L(q: number, r: number, radius = 2): string {
  return gridLabel({ q, r }, radius);
}
