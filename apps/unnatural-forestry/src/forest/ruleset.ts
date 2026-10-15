/** Loads and cross-validates the committed Dark Forest JSON into one Ruleset. */

import {
  parseItems,
  parseMap,
  parseRules,
  parseScenarios,
  parseTerrains,
  parseTopics,
} from './config';
import { ARCHETYPE_IDS } from './strategy';
import type { MapDefinition, Ruleset } from './types';

import itemsJson from '../data/forest/items.json';
import mapJson from '../data/forest/map-quilsap-wedge.json';
import narrowMapJson from '../data/forest/map-quilsap-narrow.json';
import extractionMapJson from '../data/forest/map-quilsap-extraction.json';
import rulesJson from '../data/forest/rules.json';
import scenariosJson from '../data/forest/scenarios.json';
import terrainJson from '../data/forest/terrain.json';
import topicsJson from '../data/forest/topics.json';

export function loadRuleset(): Ruleset {
  const terrains = parseTerrains(terrainJson, 'data/forest/terrain.json');
  const topics = parseTopics(topicsJson, 'data/forest/topics.json');
  const items = parseItems(itemsJson, 'data/forest/items.json');
  const parsedMaps = [
    parseMap(mapJson, terrains, topics, items, 'data/forest/map-quilsap-wedge.json'),
    parseMap(narrowMapJson, terrains, topics, items, 'data/forest/map-quilsap-narrow.json'),
    parseMap(extractionMapJson, terrains, topics, items, 'data/forest/map-quilsap-extraction.json'),
  ];
  const maps: ReadonlyMap<string, MapDefinition> = new Map(parsedMaps.map((m) => [m.id, m]));
  const rules = parseRules(rulesJson, 'data/forest/rules.json');
  const scenarios = parseScenarios(
    scenariosJson,
    maps,
    ARCHETYPE_IDS,
    'data/forest/scenarios.json',
  );
  return Object.freeze({ terrains, topics, items, maps, rules, scenarios });
}
