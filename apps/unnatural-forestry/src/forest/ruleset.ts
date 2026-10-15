/** Loads and cross-validates the committed Dark Forest JSON into one Ruleset. */

import { parseItems, parseMap, parseRules, parseScenarios, parseTerrains } from './config';
import { ARCHETYPE_IDS } from './strategy';
import type { MapDefinition, Ruleset } from './types';

import itemsJson from '../data/forest/items.json';
import mapJson from '../data/forest/map-quilsap-wedge.json';
import narrowMapJson from '../data/forest/map-quilsap-narrow.json';
import rulesJson from '../data/forest/rules.json';
import scenariosJson from '../data/forest/scenarios.json';
import terrainJson from '../data/forest/terrain.json';

export function loadRuleset(): Ruleset {
  const terrains = parseTerrains(terrainJson, 'data/forest/terrain.json');
  const items = parseItems(itemsJson, 'data/forest/items.json');
  const parsedMaps = [
    parseMap(mapJson, terrains, items, 'data/forest/map-quilsap-wedge.json'),
    parseMap(narrowMapJson, terrains, items, 'data/forest/map-quilsap-narrow.json'),
  ];
  const maps: ReadonlyMap<string, MapDefinition> = new Map(parsedMaps.map((m) => [m.id, m]));
  const rules = parseRules(rulesJson, 'data/forest/rules.json');
  const scenarios = parseScenarios(
    scenariosJson,
    maps,
    ARCHETYPE_IDS,
    'data/forest/scenarios.json',
  );
  return Object.freeze({ terrains, items, maps, rules, scenarios });
}
