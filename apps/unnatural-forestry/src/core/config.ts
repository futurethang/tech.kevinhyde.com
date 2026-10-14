/**
 * Parsers that turn raw JSON into validated, frozen configuration objects.
 *
 * Nothing downstream of this file should re-check config shapes; if it parsed,
 * every id reference inside it resolves.
 */

import { axialKey, axialNeighbors } from './hex';
import {
  DEFAULT_RULES,
  type CharacterDefinition,
  type HexContentDefinition,
  type HexDefinition,
  type ItemDefinition,
  type MapDefinition,
  type MapLayout,
  type ResolvedScenario,
  type RuleParameters,
  type ScenarioDefinition,
  type StartPositionDefinition,
  type TeamDefinition,
  type TerrainSignals,
  type TerrainType,
  type TrailheadDefinition,
} from './types';
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
  optStr,
  requireRef,
  str,
  strArray,
} from './validate';

// ---------------------------------------------------------------------------
// Terrain / items / characters
// ---------------------------------------------------------------------------

function parseSignals(raw: unknown, path: string): TerrainSignals {
  const o = obj(raw, path);
  return Object.freeze({
    risk: oneOf(o.risk, `${path}.risk`, ['low', 'medium', 'high'] as const),
    reward: oneOf(o.reward, `${path}.reward`, ['none', 'low', 'medium', 'high'] as const),
  });
}

export function parseTerrains(raw: unknown, path = 'terrain.json'): Map<string, TerrainType> {
  const list = arr(obj(raw, path).terrains, `${path}.terrains`).map((item, i) => {
    const p = `${path}.terrains[${i}]`;
    const o = obj(item, p);
    return Object.freeze({
      id: str(o.id, `${p}.id`),
      label: str(o.label, `${p}.label`),
      color: str(o.color, `${p}.color`),
      passable: bool(o.passable, `${p}.passable`),
      visibleClue: str(o.visibleClue, `${p}.visibleClue`),
      signals: parseSignals(o.signals, `${p}.signals`),
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
      description: str(o.description, `${p}.description`),
      kind: oneOf(o.kind, `${p}.kind`, ['tool', 'charm', 'document', 'consumable'] as const),
    }) satisfies ItemDefinition;
  });
  return indexById(list, `${path}.items`);
}

export function parseCharacters(
  raw: unknown,
  path = 'characters.json',
): Map<string, CharacterDefinition> {
  const list = arr(obj(raw, path).characters, `${path}.characters`).map((item, i) => {
    const p = `${path}.characters[${i}]`;
    const o = obj(item, p);
    const t = obj(o.trait, `${p}.trait`);
    return Object.freeze({
      id: str(o.id, `${p}.id`),
      name: str(o.name, `${p}.name`),
      species: str(o.species, `${p}.species`),
      trait: Object.freeze({
        id: str(t.id, `${p}.trait.id`),
        label: str(t.label, `${p}.trait.label`),
        description: str(t.description, `${p}.trait.description`),
      }),
    }) satisfies CharacterDefinition;
  });
  return indexById(list, `${path}.characters`);
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

function parseLayout(raw: unknown, path: string): MapLayout {
  const o = obj(raw, path);
  return Object.freeze({
    shape: oneOf(o.shape, `${path}.shape`, ['hex-disc'] as const),
    radius: int(o.radius, `${path}.radius`),
    hexSize: num(o.hexSize, `${path}.hexSize`),
  });
}

function parseHex(raw: unknown, path: string): HexDefinition {
  const o = obj(raw, path);
  return Object.freeze({
    id: str(o.id, `${path}.id`),
    q: int(o.q, `${path}.q`),
    r: int(o.r, `${path}.r`),
    terrain: str(o.terrain, `${path}.terrain`),
    notes: optStr(o.notes, `${path}.notes`),
  });
}

function parseTrailhead(raw: unknown, path: string): TrailheadDefinition {
  const o = obj(raw, path);
  return Object.freeze({
    id: str(o.id, `${path}.id`),
    hexId: str(o.hexId, `${path}.hexId`),
    name: str(o.name, `${path}.name`),
    closed: optBool(o.closed, `${path}.closed`, false),
  });
}

function parseContent(raw: unknown, path: string): HexContentDefinition {
  const o = obj(raw, path);
  return Object.freeze({
    hexId: str(o.hexId, `${path}.hexId`),
    kind: oneOf(o.kind, `${path}.kind`, ['hazard', 'reward', 'clue', 'special'] as const),
    label: str(o.label, `${path}.label`),
    itemId: optStr(o.itemId, `${path}.itemId`),
    note: optStr(o.note, `${path}.note`),
  });
}

/**
 * Validates a map file. Checks that hex coordinates are unique, that every
 * referenced hex exists, that no two trailheads share a hex, and that terrain
 * ids resolve against `terrains`.
 */
export function parseMap(
  raw: unknown,
  terrains: ReadonlyMap<string, TerrainType>,
  path = 'map.json',
): MapDefinition {
  const o = obj(raw, path);
  const hexes = arr(o.hexes, `${path}.hexes`).map((h, i) => parseHex(h, `${path}.hexes[${i}]`));
  const byId = indexById(hexes, `${path}.hexes`);

  const seenCoords = new Set<string>();
  hexes.forEach((h, i) => {
    const key = axialKey(h);
    if (seenCoords.has(key)) {
      throw new ConfigError(`duplicate coordinate ${key}`, `${path}.hexes[${i}]`);
    }
    seenCoords.add(key);
    requireRef(terrains, h.terrain, 'terrain', `${path}.hexes[${i}].terrain`);
  });

  const trailheads = arr(o.trailheads, `${path}.trailheads`).map((t, i) =>
    parseTrailhead(t, `${path}.trailheads[${i}]`),
  );
  indexById(trailheads, `${path}.trailheads`);
  const trailheadHexes = new Set<string>();
  trailheads.forEach((t, i) => {
    requireRef(byId, t.hexId, 'hex', `${path}.trailheads[${i}].hexId`);
    if (trailheadHexes.has(t.hexId)) {
      throw new ConfigError(`two trailheads on hex "${t.hexId}"`, `${path}.trailheads[${i}]`);
    }
    trailheadHexes.add(t.hexId);
  });

  const startPositions = arr(o.startPositions, `${path}.startPositions`).map((s, i) => {
    const p = `${path}.startPositions[${i}]`;
    const so = obj(s, p);
    const def: StartPositionDefinition = Object.freeze({
      id: str(so.id, `${p}.id`),
      hexId: str(so.hexId, `${p}.hexId`),
    });
    requireRef(byId, def.hexId, 'hex', `${p}.hexId`);
    return def;
  });
  indexById(startPositions, `${path}.startPositions`);

  const contents = arr(o.contents, `${path}.contents`).map((c, i) => {
    const def = parseContent(c, `${path}.contents[${i}]`);
    requireRef(byId, def.hexId, 'hex', `${path}.contents[${i}].hexId`);
    return def;
  });

  return Object.freeze({
    id: str(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    layout: parseLayout(o.layout, `${path}.layout`),
    hexes: Object.freeze(hexes),
    trailheads: Object.freeze(trailheads),
    startPositions: Object.freeze(startPositions),
    contents: Object.freeze(contents),
  });
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

function parseRules(raw: unknown, path: string): RuleParameters {
  if (raw === undefined) return DEFAULT_RULES;
  const o = obj(raw, path);
  const movesPerRound = o.movesPerRound === undefined
    ? DEFAULT_RULES.movesPerRound
    : int(o.movesPerRound, `${path}.movesPerRound`);
  if (movesPerRound < 1) throw new ConfigError('must be at least 1', `${path}.movesPerRound`);
  return Object.freeze({
    movesPerRound,
    allowStayInPlace: optBool(
      o.allowStayInPlace,
      `${path}.allowStayInPlace`,
      DEFAULT_RULES.allowStayInPlace,
    ),
    allowSwaps: optBool(o.allowSwaps, `${path}.allowSwaps`, DEFAULT_RULES.allowSwaps),
    revealHiddenContents: optBool(
      o.revealHiddenContents,
      `${path}.revealHiddenContents`,
      DEFAULT_RULES.revealHiddenContents,
    ),
    collisionTriggersEncounter: optBool(
      o.collisionTriggersEncounter,
      `${path}.collisionTriggersEncounter`,
      DEFAULT_RULES.collisionTriggersEncounter,
    ),
    maxRounds: o.maxRounds === undefined
      ? DEFAULT_RULES.maxRounds
      : int(o.maxRounds, `${path}.maxRounds`),
  });
}

export function parseScenario(raw: unknown, path = 'scenario.json'): ScenarioDefinition {
  const o = obj(raw, path);
  const teams = arr(o.teams, `${path}.teams`).map((t, i) => {
    const p = `${path}.teams[${i}]`;
    const to = obj(t, p);
    return Object.freeze({
      id: str(to.id, `${p}.id`),
      name: str(to.name, `${p}.name`),
      color: str(to.color, `${p}.color`),
      startHexId: str(to.startHexId, `${p}.startHexId`),
      characterId: str(to.characterId, `${p}.characterId`),
      items: Object.freeze(to.items === undefined ? [] : strArray(to.items, `${p}.items`)),
    }) satisfies TeamDefinition;
  });
  indexById(teams, `${path}.teams`);

  return Object.freeze({
    id: str(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    description: str(o.description, `${path}.description`),
    purpose:
      o.purpose === undefined
        ? 'party'
        : oneOf(o.purpose, `${path}.purpose`, ['party', 'rig'] as const),
    mapId: str(o.mapId, `${path}.mapId`),
    seed: int(o.seed, `${path}.seed`),
    rules: parseRules(o.rules, `${path}.rules`),
    teams: Object.freeze(teams),
  });
}

/**
 * Cross-checks a scenario against the map and definition tables it names.
 * Rejects unknown hexes/characters/items, a map id mismatch, and two teams
 * sharing a starting hex (teams must begin separated).
 */
export function resolveScenario(input: {
  scenario: ScenarioDefinition;
  map: MapDefinition;
  terrains: ReadonlyMap<string, TerrainType>;
  items: ReadonlyMap<string, ItemDefinition>;
  characters: ReadonlyMap<string, CharacterDefinition>;
  path?: string;
}): ResolvedScenario {
  const { scenario, map, terrains, items, characters } = input;
  const path = input.path ?? `scenario:${scenario.id}`;
  if (scenario.mapId !== map.id) {
    throw new ConfigError(
      `scenario expects map "${scenario.mapId}" but got "${map.id}"`,
      `${path}.mapId`,
    );
  }

  const hexIds = new Set(map.hexes.map((h) => h.id));
  const occupied = new Map<string, string>();
  scenario.teams.forEach((team, i) => {
    const p = `${path}.teams[${i}]`;
    requireRef(hexIds, team.startHexId, 'hex', `${p}.startHexId`);
    requireRef(characters, team.characterId, 'character', `${p}.characterId`);
    team.items.forEach((itemId, j) => requireRef(items, itemId, 'item', `${p}.items[${j}]`));
    const prior = occupied.get(team.startHexId);
    if (prior !== undefined) {
      throw new ConfigError(
        `teams "${prior}" and "${team.id}" share starting hex "${team.startHexId}"`,
        `${p}.startHexId`,
      );
    }
    occupied.set(team.startHexId, team.id);
  });

  return Object.freeze({ scenario, map, terrains, items, characters });
}

/**
 * Structural warnings a map author should see but which are not errors:
 * isolated hexes, impassable trailheads, trailheads that are not on the
 * perimeter. Returned as plain strings for the debug panel and tests.
 */
export function mapWarnings(map: MapDefinition, terrains: ReadonlyMap<string, TerrainType>): string[] {
  const warnings: string[] = [];
  const byCoord = new Map(map.hexes.map((h) => [axialKey(h), h]));
  const isPassable = (id: string) => terrains.get(id)?.passable ?? false;

  for (const hex of map.hexes) {
    const present = axialNeighbors(hex).filter((n) => byCoord.has(axialKey(n)));
    if (present.length === 0) warnings.push(`hex ${hex.id} has no neighbours on this map`);
    if (!isPassable(hex.terrain)) continue;
    if (present.every((n) => !isPassable(byCoord.get(axialKey(n))!.terrain))) {
      warnings.push(`hex ${hex.id} is passable but every neighbour is impassable`);
    }
  }
  for (const th of map.trailheads) {
    const hex = map.hexes.find((h) => h.id === th.hexId)!;
    if (!isPassable(hex.terrain)) {
      warnings.push(`trailhead ${th.id} sits on impassable hex ${hex.id}`);
    }
    const neighbourCount = axialNeighbors(hex).filter((n) => byCoord.has(axialKey(n))).length;
    if (neighbourCount === 6) {
      warnings.push(`trailhead ${th.id} on hex ${hex.id} is not on the map perimeter`);
    }
  }
  return warnings;
}
