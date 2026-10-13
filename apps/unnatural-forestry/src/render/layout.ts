/**
 * Pixel layout for a hex map. Pure geometry — no Phaser, no game state.
 * The same numbers drive the prototype renderer and, later, a print export.
 */

import { axialToPixel, hexCorners, type Axial } from '../core/hex';

export interface LayoutBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface MapLayoutResult {
  readonly size: number;
  /** hexId -> centre, already shifted so the map starts at (0, 0) plus padding. */
  readonly centers: ReadonlyMap<string, { x: number; y: number }>;
  readonly bounds: LayoutBounds;
}

/** Lays out hexes and returns centres shifted into a positive, padded box. */
export function layoutHexes(
  hexes: readonly (Axial & { id: string })[],
  size: number,
  padding = size,
): MapLayoutResult {
  const raw = hexes.map((h) => ({ id: h.id, ...axialToPixel(h, size) }));
  const minX = Math.min(...raw.map((p) => p.x)) - size - padding;
  const minY = Math.min(...raw.map((p) => p.y)) - size - padding;
  const maxX = Math.max(...raw.map((p) => p.x)) + size + padding;
  const maxY = Math.max(...raw.map((p) => p.y)) + size + padding;
  const centers = new Map(raw.map((p) => [p.id, { x: p.x - minX, y: p.y - minY }]));
  return {
    size,
    centers,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

/** Corner points of one laid-out hex, for drawing or for an SVG export. */
export function hexPolygon(
  layout: MapLayoutResult,
  hexId: string,
  inset = 0,
): { x: number; y: number }[] {
  const centre = layout.centers.get(hexId);
  if (!centre) throw new Error(`hex "${hexId}" is not in this layout`);
  return hexCorners(centre.x, centre.y, layout.size - inset);
}

/**
 * The hex whose centre is nearest a point, or null if the point is outside
 * every hex. Used for click hit-testing; cheap enough for ~100 hexes.
 */
export function hexAtPoint(
  layout: MapLayoutResult,
  x: number,
  y: number,
): string | null {
  let bestId: string | null = null;
  let bestDistance = Infinity;
  for (const [id, centre] of layout.centers) {
    const d = Math.hypot(centre.x - x, centre.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      bestId = id;
    }
  }
  // Inradius of a hex of circumradius `size`; outside it the click missed.
  return bestDistance <= layout.size * (Math.sqrt(3) / 2) ? bestId : null;
}

/** Offsets for stacking n tokens inside one hex without overlapping. */
export function tokenOffsets(count: number, size: number): { dx: number; dy: number }[] {
  if (count <= 1) return [{ dx: 0, dy: 0 }];
  const radius = size * 0.38;
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
  });
}
