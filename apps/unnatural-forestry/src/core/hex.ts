/**
 * Hex geometry. Pure functions over axial coordinates — no game concepts here.
 *
 * Convention: POINTY-TOP hexes in axial coordinates (q, r).
 *   q increases to the east, r increases to the south-east.
 *   The third cube coordinate is implied: s = -q - r.
 *
 * This file is the only place that knows how hexes touch each other. Map JSON
 * stores coordinates; adjacency is always derived, never duplicated in data.
 */

export interface Axial {
  readonly q: number;
  readonly r: number;
}

/** The six axial neighbour offsets, in clockwise order starting due east. */
export const AXIAL_DIRECTIONS: readonly Axial[] = Object.freeze([
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]);

/** Canonical string form of a coordinate, for use as a Map/Set key. */
export function axialKey(a: Axial): string {
  return `${a.q},${a.r}`;
}

export function axialEquals(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

export function axialAdd(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

/** The six coordinates touching `a`, regardless of whether they exist on a map. */
export function axialNeighbors(a: Axial): Axial[] {
  return AXIAL_DIRECTIONS.map((d) => axialAdd(a, d));
}

/** Hex (cube) distance: the number of steps between two coordinates. */
export function axialDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/** Ring index of a coordinate measured from the origin (0 at the centre). */
export function axialRing(a: Axial): number {
  return axialDistance(a, { q: 0, r: 0 });
}

/** Every coordinate within `radius` steps of the origin, centre first. */
export function hexDisc(radius: number): Axial[] {
  const out: Axial[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rLow = Math.max(-radius, -q - radius);
    const rHigh = Math.min(radius, -q + radius);
    for (let r = rLow; r <= rHigh; r++) out.push({ q, r });
  }
  return out.sort((a, b) => axialRing(a) - axialRing(b) || a.q - b.q || a.r - b.r);
}

/** The coordinates exactly `radius` steps from the origin, in ring order. */
export function hexRing(radius: number): Axial[] {
  if (radius <= 0) return [{ q: 0, r: 0 }];
  const out: Axial[] = [];
  // Start at the "west" corner and walk the six sides.
  let cur: Axial = { q: -radius, r: radius };
  for (let side = 0; side < 6; side++) {
    const dir = AXIAL_DIRECTIONS[side]!;
    for (let step = 0; step < radius; step++) {
      out.push(cur);
      cur = axialAdd(cur, dir);
    }
  }
  return out;
}

/** Pixel centre of a pointy-top hex of the given circumradius (`size`). */
export function axialToPixel(a: Axial, size: number): { x: number; y: number } {
  const x = size * Math.sqrt(3) * (a.q + a.r / 2);
  const y = size * 1.5 * a.r;
  return { x, y };
}

/** The six corner points of a pointy-top hex centred at (cx, cy). */
export function hexCorners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 90);
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return pts;
}

/**
 * Human-readable grid reference, e.g. "C4" — row letter + column number.
 * Used to seed stable hex IDs when generating a map, and chosen so the same
 * label can be printed on the physical board. Logic never parses these back;
 * IDs are opaque strings once they are in JSON.
 */
export function gridLabel(a: Axial, radius: number): string {
  // odd-r offset coordinates, shifted so rows/cols start at 0.
  const row = a.r + radius;
  const col = a.q + Math.floor((a.r - (a.r & 1)) / 2) + radius;
  const letter = String.fromCharCode(65 + row);
  return `${letter}${col + 1}`;
}
