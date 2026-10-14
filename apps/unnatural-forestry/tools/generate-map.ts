/**
 * Map generator / regenerator.
 *
 * The committed JSON map files are the canonical artefacts — this script exists
 * so a district can be re-rolled or retuned without hand-editing ~90 hexes.
 * Run `pnpm gen:map`; it rewrites every preset below and prints a route report.
 *
 * The party allows no more than three rounds, and a round moves a team one hex,
 * so a team has a budget of three moves. Starts are therefore chosen to sit
 * EXACTLY `targetExitDistance` moves from the nearest open trailhead: identical
 * for every team, so nobody can claim a worse draw, and with zero slack, so any
 * detour has to pay for itself. That exactness is the whole risk/reward tension
 * — change `targetExitDistance` to loosen or tighten it.
 *
 * Output is fully determined by each preset's seed and the tables below.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeMap, exitDistanceField } from '../src/core/analysis';
import { createBoard } from '../src/core/board';
import { mapWarnings, parseMap, parseTerrains } from '../src/core/config';
import { axialDistance, axialKey, axialRing, gridLabel, hexDisc, hexRing } from '../src/core/hex';
import { createRng, type Rng } from '../src/core/rng';
import terrainJson from '../src/data/terrain.json';
import type { Axial } from '../src/core/hex';
import type { HexContentDefinition } from '../src/core/types';

interface Preset {
  readonly id: string;
  readonly name: string;
  readonly seed: number;
  readonly radius: number;
  readonly hexSize: number;
  readonly trailheadCount: number;
  readonly startCount: number;
  /** Exact number of moves from every start to its nearest open trailhead. */
  readonly targetExitDistance: number;
  /** Starts must also sit this far inside the map, to keep them interior. */
  readonly minStartRing: number;
  /** Hand-placed impassable hexes, so the topology stays deliberate. */
  readonly barriers: readonly { readonly coord: Axial; readonly terrain: string }[];
  readonly trailheadNames: readonly string[];
}

const PRESETS: readonly Preset[] = [
  {
    id: 'ranger-district-01',
    name: 'Ranger District 01 — Lower Quilsap',
    seed: 19731031,
    radius: 4,
    hexSize: 46,
    trailheadCount: 6,
    startCount: 10,
    targetExitDistance: 3,
    minStartRing: 1,
    barriers: [
      { coord: { q: 1, r: 1 }, terrain: 'tarn' },
      { coord: { q: -1, r: -1 }, terrain: 'blowdown' },
    ],
    trailheadNames: [
      'Quilsap Pulloff',
      'Spur 2200 Gate',
      'Hoh Ridge Junction',
      'Old Mill Grade',
      'Cedar Bight Landing',
      'Section 14 Fenceline',
    ],
  },
  {
    id: 'ranger-district-02',
    name: 'Ranger District 02 — Upper Quilsap (small party)',
    seed: 20251031,
    radius: 4,
    hexSize: 52,
    trailheadCount: 6,
    startCount: 6,
    targetExitDistance: 3,
    minStartRing: 0,
    barriers: [
      { coord: { q: 2, r: -1 }, terrain: 'tarn' },
      { coord: { q: -2, r: 2 }, terrain: 'blowdown' },
      { coord: { q: 0, r: -2 }, terrain: 'blowdown' },
    ],
    trailheadNames: [
      'Burn Scar Pullout',
      'Gravel Pit 9',
      'Shelton Grade',
      'Wye Creek Bridge',
      'Unit 31 Gate',
      'Radio Repeater Spur',
    ],
  },
];

/** Terrain weights by distance from the perimeter: the edges open up. */
function ringWeights(ring: number, radius: number): Record<string, number> {
  if (ring === 0) return { station: 1 };
  const fromEdge = radius - ring;
  if (fromEdge === 0) return { trail: 4, 'second-growth': 3, ridge: 2, clearcut: 2 };
  if (fromEdge === 1) return { 'second-growth': 4, ridge: 3, clearcut: 2, bog: 2, trail: 2, creek: 1 };
  if (fromEdge === 2) return { 'old-growth': 4, 'second-growth': 3, creek: 2, bog: 2, ridge: 2 };
  return { 'old-growth': 5, creek: 2, bog: 2, 'second-growth': 2 };
}

function weightedPick(rng: Rng, weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.next() * total;
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1]![0];
}

const IMPASSABLE = new Set(['tarn', 'blowdown']);

function buildMap(preset: Preset): Record<string, unknown> {
  const rng = createRng(preset.seed);
  const coords = hexDisc(preset.radius);
  const idByCoord = new Map<string, string>();
  const terrainById = new Map<string, string>();

  for (const coord of coords) {
    const id = gridLabel(coord, preset.radius);
    idByCoord.set(axialKey(coord), id);
    terrainById.set(id, weightedPick(rng, ringWeights(axialRing(coord), preset.radius)));
  }
  for (const barrier of preset.barriers) {
    const id = idByCoord.get(axialKey(barrier.coord));
    if (!id) throw new Error(`barrier ${axialKey(barrier.coord)} is off the map`);
    terrainById.set(id, barrier.terrain);
  }

  // Trailheads: evenly spaced around the perimeter ring, always walkable.
  const perimeter = hexRing(preset.radius);
  const step = perimeter.length / preset.trailheadCount;
  const trailheads = Array.from({ length: preset.trailheadCount }, (_, i) => {
    const coord = perimeter[Math.round(i * step) % perimeter.length]!;
    const hexId = idByCoord.get(axialKey(coord))!;
    terrainById.set(hexId, 'trail');
    return {
      id: `TH-${String(i + 1).padStart(2, '0')}`,
      hexId,
      name: preset.trailheadNames[i] ?? `Trailhead ${i + 1}`,
      closed: false,
    };
  });

  // Starts: every team exactly `targetExitDistance` moves from the nearest exit.
  // The distance field needs a board, so build an interim map with no starts,
  // measure it, then choose. Nothing downstream sees the interim version.
  const hexList = coords.map((coord) => {
    const id = idByCoord.get(axialKey(coord))!;
    return { id, q: coord.q, r: coord.r, terrain: terrainById.get(id)! };
  });
  const interim = parseMap(
    {
      id: preset.id,
      name: preset.name,
      layout: { shape: 'hex-disc', radius: preset.radius, hexSize: preset.hexSize },
      hexes: hexList,
      trailheads,
      startPositions: [],
      contents: [],
    },
    terrains,
    `${preset.id} (interim)`,
  );
  const field = exitDistanceField(createBoard(interim, terrains));
  const trailheadHexIds = new Set(trailheads.map((t) => t.hexId));
  const candidates = coords.filter((c) => {
    const id = idByCoord.get(axialKey(c))!;
    if (trailheadHexIds.has(id)) return false;
    if (axialRing(c) < preset.minStartRing) return false;
    if (IMPASSABLE.has(terrainById.get(id)!)) return false;
    return field.dist.get(id) === preset.targetExitDistance;
  });
  if (candidates.length < preset.startCount) {
    throw new Error(
      `${preset.id}: only ${candidates.length} hexes sit exactly ${preset.targetExitDistance} moves ` +
        `from an exit, but ${preset.startCount} starts are needed. Adjust the radius, the trailhead ` +
        `count, or targetExitDistance.`,
    );
  }
  const chosen: Axial[] = [candidates[0]!];
  while (chosen.length < preset.startCount) {
    let best = candidates[0]!;
    let bestScore = -1;
    for (const candidate of candidates) {
      if (chosen.some((c) => axialKey(c) === axialKey(candidate))) continue;
      const score = Math.min(...chosen.map((c) => axialDistance(c, candidate)));
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    chosen.push(best);
  }
  const startPositions = chosen.map((coord, i) => ({
    id: `SP-${String(i + 1).padStart(2, '0')}`,
    hexId: idByCoord.get(axialKey(coord))!,
  }));

  // Hidden contents: facilitator-secret, kept out of the `hexes` array.
  const reserved = new Set([...trailheads.map((t) => t.hexId), ...startPositions.map((s) => s.hexId)]);
  const pool = coords
    .map((c) => idByCoord.get(axialKey(c))!)
    .filter((id) => !reserved.has(id) && !IMPASSABLE.has(terrainById.get(id)!));

  const contents: HexContentDefinition[] = [];
  const used = new Set<string>();
  const take = (count: number, predicate: (terrain: string) => boolean): string[] => {
    const picks: string[] = [];
    for (const id of pool) {
      if (picks.length >= count) break;
      if (used.has(id) || !predicate(terrainById.get(id)!)) continue;
      used.add(id);
      picks.push(id);
    }
    return picks;
  };

  for (const hexId of take(4, (t) => t === 'bog' || t === 'clearcut')) {
    contents.push({ hexId, kind: 'hazard', label: 'Soft ground', note: 'Costs the team its next move.' });
  }
  for (const hexId of take(2, (t) => t === 'creek' || t === 'ridge')) {
    contents.push({ hexId, kind: 'hazard', label: 'Something keeping pace', note: 'Forced retreat one hex.' });
  }
  take(3, (t) => t === 'old-growth').forEach((hexId, i) => {
    contents.push({
      hexId,
      kind: 'reward',
      label: 'Cache in a nurse log',
      itemId: ['headlamp', 'huckleberries', 'elk-charm'][i]!,
    });
  });
  for (const hexId of take(2, (t) => t === 'ridge' || t === 'second-growth')) {
    contents.push({ hexId, kind: 'clue', label: 'Survey marker', note: 'Names the nearest trailhead. Accurately.' });
  }
  for (const hexId of take(1, (t) => t === 'trail')) {
    contents.push({
      hexId,
      kind: 'clue',
      label: 'Department signage',
      note: 'MISLEADING: points away from the nearest trailhead.',
    });
  }
  for (const hexId of take(1, (t) => t === 'station')) {
    contents.push({
      hexId,
      kind: 'special',
      label: 'Field Station',
      itemId: 'day-permit',
      note: 'Issues one Form 7-B per team.',
    });
  }

  return {
    _comment:
      'Generated by tools/generate-map.ts. Hex adjacency is derived from q/r at runtime and is never stored here. `contents` is facilitator-secret: keep it out of anything printed for players.',
    id: preset.id,
    name: preset.name,
    layout: { shape: 'hex-disc', radius: preset.radius, hexSize: preset.hexSize },
    hexes: hexList,
    trailheads,
    startPositions,
    contents,
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const terrains = parseTerrains(terrainJson);

for (const preset of PRESETS) {
  const map = buildMap(preset);
  const outPath = resolve(here, `../src/data/maps/${preset.id}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(map, null, 2)}\n`);

  const parsed = parseMap(map, terrains, outPath);
  const board = createBoard(parsed, terrains);
  const analysis = analyzeMap(board);

  console.log(`\n=== ${preset.id} -> src/data/maps/${preset.id}.json`);
  console.log(`hexes ${analysis.hexCount} (${analysis.passableHexCount} passable), ` +
    `trailheads ${parsed.trailheads.length}, starts ${parsed.startPositions.length}`);
  console.log(`stranded hexes: ${analysis.strandedHexIds.join(', ') || 'none'}`);
  console.log(`unreachable trailheads: ${analysis.unreachableTrailheadIds.join(', ') || 'none'}`);
  if (analysis.startDistance) {
    const { min, max, mean } = analysis.startDistance;
    console.log(`nearest-exit distance: min ${min}, max ${max}, mean ${mean.toFixed(2)}`);
  }
  for (const start of analysis.starts) {
    console.log(
      `  ${start.hexId}: exit in ${start.nearestExitDistance} via ${start.nearestTrailheadIds.join('/')}` +
        ` | first steps ${start.optimalFirstSteps.length} optimal / ${start.detourFirstSteps.length} detour` +
        ` | ${start.shortestRouteCount} shortest routes` +
        ` | ${start.reachableTrailheadCount} exits reachable`,
    );
  }
  const warnings = mapWarnings(parsed, terrains);
  console.log(warnings.length ? `warnings:\n  ${warnings.join('\n  ')}` : 'warnings: none');
}
