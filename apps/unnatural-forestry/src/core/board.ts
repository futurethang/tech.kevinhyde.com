/**
 * The board: a derived, read-only view of a MapDefinition.
 *
 * Adjacency is computed here from hex coordinates — it is never stored in JSON,
 * so editing a map means editing coordinates and nothing else. Impassable
 * terrain is excluded from `passableNeighbors`, which is what movement uses.
 */

import { axialKey, axialNeighbors, type Axial } from './hex';
import type { HexContentDefinition, HexDefinition, MapDefinition, TerrainType } from './types';

export interface Board {
  readonly map: MapDefinition;
  readonly hexIds: readonly string[];
  hex(id: string): HexDefinition;
  tryHex(id: string): HexDefinition | undefined;
  hexAt(coord: Axial): HexDefinition | undefined;
  terrain(hexId: string): TerrainType;
  isPassable(hexId: string): boolean;
  /** Every neighbouring hex that exists on the map, passable or not. */
  neighbors(hexId: string): readonly string[];
  /** Neighbours a team may legally enter (exist on the map and passable). */
  passableNeighbors(hexId: string): readonly string[];
  /** True if the hex carries an open trailhead. */
  isOpenTrailhead(hexId: string): boolean;
  trailheadAt(hexId: string): { id: string; name: string; closed: boolean } | undefined;
  /** Facilitator-secret contents of a hex (may be several). */
  contentsAt(hexId: string): readonly HexContentDefinition[];
  /** Hexes with fewer than six on-map neighbours. */
  readonly perimeterHexIds: readonly string[];
  readonly openTrailheadHexIds: readonly string[];
}

export function createBoard(map: MapDefinition, terrains: ReadonlyMap<string, TerrainType>): Board {
  const byId = new Map(map.hexes.map((h) => [h.id, h]));
  const byCoord = new Map(map.hexes.map((h) => [axialKey(h), h]));
  const trailheadByHex = new Map(map.trailheads.map((t) => [t.hexId, t]));

  const contentsByHex = new Map<string, HexContentDefinition[]>();
  for (const c of map.contents) {
    const list = contentsByHex.get(c.hexId);
    if (list) list.push(c);
    else contentsByHex.set(c.hexId, [c]);
  }

  const allNeighbors = new Map<string, string[]>();
  const passable = new Map<string, boolean>();
  for (const hex of map.hexes) {
    passable.set(hex.id, terrains.get(hex.terrain)!.passable);
    allNeighbors.set(
      hex.id,
      axialNeighbors(hex)
        .map((n) => byCoord.get(axialKey(n)))
        .filter((h): h is HexDefinition => h !== undefined)
        .map((h) => h.id),
    );
  }
  const passableNeighbors = new Map<string, string[]>();
  for (const [id, ns] of allNeighbors) {
    passableNeighbors.set(id, ns.filter((n) => passable.get(n) === true));
  }

  const perimeterHexIds = map.hexes
    .filter((h) => allNeighbors.get(h.id)!.length < 6)
    .map((h) => h.id);

  const openTrailheadHexIds = map.trailheads
    .filter((t) => !t.closed && passable.get(t.hexId) === true)
    .map((t) => t.hexId);

  const EMPTY: readonly string[] = Object.freeze([]);
  const EMPTY_CONTENTS: readonly HexContentDefinition[] = Object.freeze([]);

  const getHex = (id: string): HexDefinition => {
    const h = byId.get(id);
    if (!h) throw new Error(`unknown hex "${id}"`);
    return h;
  };

  const api: Board = {
    map,
    hexIds: Object.freeze(map.hexes.map((h) => h.id)),
    hex: getHex,
    tryHex: (id) => byId.get(id),
    hexAt: (coord) => byCoord.get(axialKey(coord)),
    terrain: (id) => terrains.get(getHex(id).terrain)!,
    isPassable: (id) => passable.get(id) === true,
    neighbors: (id) => allNeighbors.get(id) ?? EMPTY,
    passableNeighbors: (id) => passableNeighbors.get(id) ?? EMPTY,
    isOpenTrailhead(id) {
      const t = trailheadByHex.get(id);
      return t !== undefined && !t.closed && passable.get(id) === true;
    },
    trailheadAt: (id) => trailheadByHex.get(id),
    contentsAt: (id) => contentsByHex.get(id) ?? EMPTY_CONTENTS,
    perimeterHexIds: Object.freeze(perimeterHexIds),
    openTrailheadHexIds: Object.freeze(openTrailheadHexIds),
  };
  return Object.freeze(api);
}
