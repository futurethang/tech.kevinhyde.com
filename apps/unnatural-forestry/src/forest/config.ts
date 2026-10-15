/** Parsers turning the Dark Forest JSON into validated, frozen configuration. */

import {
  arr,
  bool,
  ConfigError,
  indexById,
  int,
  num,
  obj,
  oneOf,
  optBool,
  requireRef,
  str,
  strArray,
} from '../core/validate';
import type {
  BandDefinition,
  FightModel,
  ItemDefinition,
  LocationDefinition,
  MapDefinition,
  RuleParameters,
  Ruleset,
  ScenarioDefinition,
  TeamSetup,
  TerrainType,
} from './types';

export function parseTerrains(raw: unknown, path = 'terrain.json'): Map<string, TerrainType> {
  const list = arr(obj(raw, path).terrains, `${path}.terrains`).map((item, i) => {
    const p = `${path}.terrains[${i}]`;
    const o = obj(item, p);
    return Object.freeze({
      id: str(o.id, `${p}.id`),
      label: str(o.label, `${p}.label`),
      description: str(o.description, `${p}.description`),
      fightRule: oneOf(o.fightRule, `${p}.fightRule`, ['always', 'if-hunted', 'never'] as const),
      grantsIntel: bool(o.grantsIntel, `${p}.grantsIntel`),
      lootTier: int(o.lootTier, `${p}.lootTier`),
      symbol: str(o.symbol, `${p}.symbol`),
    }) satisfies TerrainType;
  });
  return indexById(list, `${path}.terrains`);
}

export function parseItems(raw: unknown, path = 'items.json'): Map<string, ItemDefinition> {
  const list = arr(obj(raw, path).items, `${path}.items`).map((item, i) => {
    const p = `${path}.items[${i}]`;
    const o = obj(item, p);
    return Object.freeze({
      id: str(o.id, `${p}.id`),
      name: str(o.name, `${p}.name`),
      effect: str(o.effect, `${p}.effect`),
      symbol: str(o.symbol, `${p}.symbol`),
    }) satisfies ItemDefinition;
  });
  return indexById(list, `${path}.items`);
}

export function parseMap(
  raw: unknown,
  terrains: ReadonlyMap<string, TerrainType>,
  items: ReadonlyMap<string, ItemDefinition>,
  path = 'map.json',
): MapDefinition {
  const o = obj(raw, path);
  const bands = arr(o.bands, `${path}.bands`).map((b, bi) => {
    const bp = `${path}.bands[${bi}]`;
    const bo = obj(b, bp);
    const locations = arr(bo.locations, `${bp}.locations`).map((l, li) => {
      const lp = `${bp}.locations[${li}]`;
      const lo = obj(l, lp);
      const def: LocationDefinition = Object.freeze({
        id: str(lo.id, `${lp}.id`),
        name: str(lo.name, `${lp}.name`),
        terrain: str(lo.terrain, `${lp}.terrain`),
        loot: Object.freeze(lo.loot === undefined ? [] : strArray(lo.loot, `${lp}.loot`)),
      });
      requireRef(terrains, def.terrain, 'terrain', `${lp}.terrain`);
      def.loot.forEach((id, k) => requireRef(items, id, 'item', `${lp}.loot[${k}]`));
      return def;
    });
    if (locations.length === 0) throw new ConfigError('a band needs at least one location', bp);
    indexById(locations, `${bp}.locations`);
    return Object.freeze({
      id: str(bo.id, `${bp}.id`),
      name: str(bo.name, `${bp}.name`),
      locations: Object.freeze(locations),
    }) satisfies BandDefinition;
  });

  if (bands.length < 2) throw new ConfigError('a map needs at least two bands', `${path}.bands`);
  const last = bands[bands.length - 1]!;
  if (last.locations.length !== 1) {
    throw new ConfigError('the final band is the trailhead and must hold exactly one location', `${path}.bands`);
  }
  // Every location id must be unique across the whole map, not just its band.
  indexById(bands.flatMap((b) => [...b.locations]), `${path}.bands[*].locations`);

  return Object.freeze({
    id: str(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    bands: Object.freeze(bands),
  });
}

function parseFightModel(raw: unknown, path: string): FightModel {
  const o = obj(raw, path);
  return Object.freeze({
    skillSpread: num(o.skillSpread, `${path}.skillSpread`),
    itemEdge: num(o.itemEdge, `${path}.itemEdge`),
    luck: num(o.luck, `${path}.luck`),
  });
}

export function parseRules(raw: unknown, path = 'rules.json'): RuleParameters {
  const o = obj(raw, path);
  const target = obj(o.targetFinalists, `${path}.targetFinalists`);
  return Object.freeze({
    fight: parseFightModel(o.fight, `${path}.fight`),
    startingItems: int(o.startingItems, `${path}.startingItems`),
    hunterNoPreyPenalty: int(o.hunterNoPreyPenalty, `${path}.hunterNoPreyPenalty`),
    trapPenalty: int(o.trapPenalty, `${path}.trapPenalty`),
    trapsPerDeadTeam: int(o.trapsPerDeadTeam, `${path}.trapsPerDeadTeam`),
    trapsFromRound: int(o.trapsFromRound, `${path}.trapsFromRound`),
    deepCoverIsSanctuary: optBool(o.deepCoverIsSanctuary, `${path}.deepCoverIsSanctuary`, true),
    soloTakesLoot: optBool(o.soloTakesLoot, `${path}.soloTakesLoot`, true),
    winnerTakesItems: optBool(o.winnerTakesItems, `${path}.winnerTakesItems`, true),
    winnerTakesLoot: optBool(o.winnerTakesLoot, `${path}.winnerTakesLoot`, true),
    targetFinalists: Object.freeze({
      min: int(target.min, `${path}.targetFinalists.min`),
      max: int(target.max, `${path}.targetFinalists.max`),
    }),
  });
}

/** Shallow merge of scenario overrides over the base rules. */
export function mergeRules(base: RuleParameters, over?: Partial<RuleParameters>): RuleParameters {
  if (!over) return base;
  return Object.freeze({
    ...base,
    ...over,
    fight: Object.freeze({ ...base.fight, ...(over.fight ?? {}) }),
    targetFinalists: Object.freeze({ ...base.targetFinalists, ...(over.targetFinalists ?? {}) }),
  });
}

export function parseScenarios(
  raw: unknown,
  maps: ReadonlyMap<string, MapDefinition>,
  knownArchetypes: ReadonlySet<string>,
  path = 'scenarios.json',
): Map<string, ScenarioDefinition> {
  const list = arr(obj(raw, path).scenarios, `${path}.scenarios`).map((s, i) => {
    const p = `${path}.scenarios[${i}]`;
    const o = obj(s, p);
    const teams = arr(o.teams, `${p}.teams`).map((t, ti) => {
      const tp = `${p}.teams[${ti}]`;
      const to = obj(t, tp);
      const setup: TeamSetup = Object.freeze({
        archetype: str(to.archetype, `${tp}.archetype`),
        count: int(to.count, `${tp}.count`),
      });
      requireRef(knownArchetypes, setup.archetype, 'archetype', `${tp}.archetype`);
      if (setup.count < 1) throw new ConfigError('count must be at least 1', `${tp}.count`);
      return setup;
    });
    const def: ScenarioDefinition = Object.freeze({
      id: str(o.id, `${p}.id`),
      name: str(o.name, `${p}.name`),
      description: str(o.description, `${p}.description`),
      mapId: str(o.mapId, `${p}.mapId`),
      seed: int(o.seed, `${p}.seed`),
      teams: Object.freeze(teams),
      rules: o.rules as Partial<RuleParameters> | undefined,
    });
    requireRef(maps, def.mapId, 'map', `${p}.mapId`);
    if (teamCount(def) < 2) throw new ConfigError('a scenario needs at least two teams', `${p}.teams`);
    return def;
  });
  return indexById(list, `${path}.scenarios`);
}

export function teamCount(scenario: ScenarioDefinition): number {
  return scenario.teams.reduce((sum, t) => sum + t.count, 0);
}

/** Structural warnings a designer should see but which are not errors. */
export function rulesetWarnings(ruleset: Ruleset): string[] {
  const warnings: string[] = [];
  for (const map of ruleset.maps.values()) {
    const widths = map.bands.map((b) => b.locations.length);
    for (let i = 1; i < widths.length; i++) {
      if (widths[i]! > widths[i - 1]!) {
        warnings.push(`${map.id}: band "${map.bands[i]!.id}" is wider than the one before it — the wedge does not narrow`);
      }
    }
    for (const scenario of ruleset.scenarios.values()) {
      if (scenario.mapId !== map.id) continue;
      const teams = teamCount(scenario);
      if (teams <= widths[0]!) {
        warnings.push(
          `${scenario.id}: ${teams} teams on ${widths[0]} opening locations — nothing forces contact in round 1`,
        );
      }
    }
  }
  return warnings;
}
