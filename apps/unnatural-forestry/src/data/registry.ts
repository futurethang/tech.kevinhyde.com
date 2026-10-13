/**
 * Scenario registry.
 *
 * Maps and scenarios are picked up by glob, so adding a playtest scenario means
 * dropping a JSON file into `src/data/scenarios/` — no source changes, no
 * import list to maintain.
 */

import {
  parseCharacters,
  parseItems,
  parseMap,
  parseScenario,
  parseTerrains,
  resolveScenario,
} from '../core/config';
import type { MapDefinition, ResolvedScenario, ScenarioDefinition } from '../core/types';

import charactersJson from './characters.json';
import itemsJson from './items.json';
import terrainJson from './terrain.json';

const mapModules = import.meta.glob<{ default: unknown }>('./maps/*.json', { eager: true });
const scenarioModules = import.meta.glob<{ default: unknown }>('./scenarios/*.json', { eager: true });

export const terrains = parseTerrains(terrainJson, 'data/terrain.json');
export const items = parseItems(itemsJson, 'data/items.json');
export const characters = parseCharacters(charactersJson, 'data/characters.json');

function build<T extends { id: string }>(
  modules: Record<string, { default: unknown }>,
  parse: (raw: unknown, path: string) => T,
): Map<string, T> {
  const out = new Map<string, T>();
  for (const [path, mod] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
    const parsed = parse(mod.default, path);
    if (out.has(parsed.id)) throw new Error(`${path}: duplicate id "${parsed.id}"`);
    out.set(parsed.id, parsed);
  }
  return out;
}

export const maps: ReadonlyMap<string, MapDefinition> = build(mapModules, (raw, path) =>
  parseMap(raw, terrains, path),
);

export const scenarios: ReadonlyMap<string, ScenarioDefinition> = build(
  scenarioModules,
  parseScenario,
);

/** Scenario id used when nothing is chosen (first by sorted filename). */
export const DEFAULT_SCENARIO_ID = [...scenarios.keys()][0]!;

export interface ScenarioListing {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly mapId: string;
  readonly teamCount: number;
}

export function listScenarios(): ScenarioListing[] {
  return [...scenarios.values()].map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    mapId: s.mapId,
    teamCount: s.teams.length,
  }));
}

/** Loads a scenario and every definition it names, fully cross-validated. */
export function loadScenario(id: string): ResolvedScenario {
  const scenario = scenarios.get(id);
  if (!scenario) throw new Error(`unknown scenario "${id}" (have: ${[...scenarios.keys()].join(', ')})`);
  const map = maps.get(scenario.mapId);
  if (!map) throw new Error(`scenario "${id}" names unknown map "${scenario.mapId}"`);
  return resolveScenario({ scenario, map, terrains, items, characters, path: `data/scenarios/${id}` });
}
