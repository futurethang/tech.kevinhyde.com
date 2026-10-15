/**
 * Draws a layout reference for the physical board, from the same JSON the
 * simulator runs on. `pnpm map:draw` writes map-layout.svg.
 *
 * This is NOT the artwork. It is the ground truth an illustrator paints over:
 * where each region sits, roughly how big it is, what it is called, what it is
 * called ON (its trivia theme, which is also what it should look like), and
 * what treasure is lying there.
 *
 * Shape: a valley narrowing to a single road out. Teams start spread across the
 * wide end, deep in the woods, and every round the ground they can reach gets
 * tighter, until the last survivors are squeezed onto the Trailhead at the
 * bottom edge — where the road is, which is the only reason a trailhead exists.
 * The valley walls are impassable, so the funnel is the whole board.
 *
 * Regions are sized for roughly equal area, so band depths are solved by area
 * rather than spaced evenly. Every boundary wanders like a trail, and both
 * sides of every edge come from the same curve, so regions tile exactly instead
 * of reading as tiles butted together.
 *
 * The light fails as you go down: the wide end is late afternoon, the last band
 * is full dark.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRng } from '../src/core/rng';
import { loadRuleset } from '../src/forest/ruleset';
import type { LocationDefinition } from '../src/forest/types';

const WIDTH = 1500;
const MAP_HEIGHT = 1380;
const LEGEND_HEIGHT = 300;
const HEIGHT = MAP_HEIGHT + LEGEND_HEIGHT;

const Y_TOP = 86;
const Y_ROAD = MAP_HEIGHT - 40; // where the road leaves the sheet
const Y_TRAILHEAD = MAP_HEIGHT - 210; // top of the Trailhead block
const HALF_TOP = 690;
const HALF_BOTTOM = 150;
const CENTRE_X = WIDTH / 2;

const rng = createRng(1031);

/** Half-width of the valley at a given depth. */
const halfWidth = (y: number) =>
  HALF_TOP + ((HALF_BOTTOM - HALF_TOP) * (y - Y_TOP)) / (Y_TRAILHEAD - Y_TOP);

/** Map a position across the valley (0..1) at depth y to an x coordinate. */
const xAt = (u: number, y: number) => CENTRE_X + (u - 0.5) * 2 * halfWidth(y);

/** Low-frequency wobble so an edge wanders like a trail instead of ruling straight. */
function makeWobble(amplitude: number): (t: number) => number {
  const phases = [rng.next() * 7, rng.next() * 7, rng.next() * 7];
  return (t: number) =>
    (amplitude *
      (Math.sin(3 * t + phases[0]!) +
        0.55 * Math.sin(7 * t + phases[1]!) +
        0.3 * Math.sin(13 * t + phases[2]!))) /
    1.85;
}

const ruleset = loadRuleset();
const map = [...ruleset.maps.values()][0]!;
const bands = map.bands.slice(0, -1); // everything but the Trailhead
const counts = bands.map((b) => b.locations.length);
const totalCells = counts.reduce((a, b) => a + b, 0);

/** Area of the valley between two depths (exact: the sides are straight). */
const areaBetween = (y0: number, y1: number) => (halfWidth(y0) + halfWidth(y1)) * (y1 - y0);
const totalArea = areaBetween(Y_TOP, Y_TRAILHEAD);

/**
 * A band is laid out as two rows, so regions come out roughly square instead of
 * as tall thin strips. The rows carry no meaning in the game — every place in a
 * band is the same distance from the Trailhead — they are purely how the ground
 * is drawn. The wider row goes on top, where the valley is wider.
 */
interface Row {
  readonly bandIndex: number;
  readonly locations: readonly LocationDefinition[];
}

const rows: Row[] = [];
bands.forEach((band, bandIndex) => {
  const all = [...band.locations];
  const top = Math.ceil(all.length / 2);
  rows.push({ bandIndex, locations: all.slice(0, top) });
  if (all.length > top) rows.push({ bandIndex, locations: all.slice(top) });
});

// Solve row depths so every region ends up with roughly the same area.
const rowY: number[] = [Y_TOP];
let consumed = 0;
for (const row of rows) {
  consumed += row.locations.length;
  const target = (totalArea * consumed) / totalCells;
  let lo = rowY[rowY.length - 1]!;
  let hi = Y_TRAILHEAD;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (areaBetween(Y_TOP, mid) < target) lo = mid;
    else hi = mid;
  }
  rowY.push((lo + hi) / 2);
}

/** Depth of a row boundary, wandering across the valley. */
const boundaryWobble = rowY.map((_, i) => makeWobble(i === 0 ? 13 : 18));
const depthAt = (boundary: number, u: number) =>
  rowY[boundary]! + boundaryWobble[boundary]!(u * 6);

/** Position across the valley of the divider between two regions of a row. */
const dividerWobble = rows.map((row) => row.locations.map(() => makeWobble(0.02)));
const acrossAt = (rowIndex: number, divider: number, count: number, t: number) => {
  if (divider === 0) return 0;
  if (divider === count) return 1;
  return divider / count + dividerWobble[rowIndex]![divider]!(t * 4 + divider);
};

const pt = (u: number, y: number) => `${xAt(u, y).toFixed(1)},${y.toFixed(1)}`;

interface Region {
  readonly location: LocationDefinition;
  readonly path: string;
  readonly centre: { x: number; y: number };
}

const regions: Region[] = [];
const STEPS = 24;

rows.forEach((row, rowIndex) => {
  const count = row.locations.length;
  row.locations.forEach((location, j) => {
    const points: string[] = [];
    for (let s = 0; s <= STEPS; s++) {
      const f = s / STEPS;
      const u0 = acrossAt(rowIndex, j, count, 0);
      const u1 = acrossAt(rowIndex, j + 1, count, 0);
      const u = u0 + (u1 - u0) * f;
      points.push(pt(u, depthAt(rowIndex, u)));
    }
    for (let s = 1; s <= STEPS; s++) {
      const f = s / STEPS;
      const u = acrossAt(rowIndex, j + 1, count, f);
      const y = depthAt(rowIndex, u) + (depthAt(rowIndex + 1, u) - depthAt(rowIndex, u)) * f;
      points.push(pt(u, y));
    }
    for (let s = STEPS; s >= 0; s--) {
      const f = s / STEPS;
      const u0 = acrossAt(rowIndex, j, count, 1);
      const u1 = acrossAt(rowIndex, j + 1, count, 1);
      const u = u0 + (u1 - u0) * f;
      points.push(pt(u, depthAt(rowIndex + 1, u)));
    }
    for (let s = STEPS - 1; s >= 1; s--) {
      const f = s / STEPS;
      const u = acrossAt(rowIndex, j, count, f);
      const y = depthAt(rowIndex, u) + (depthAt(rowIndex + 1, u) - depthAt(rowIndex, u)) * f;
      points.push(pt(u, y));
    }
    const midU = (acrossAt(rowIndex, j, count, 0.5) + acrossAt(rowIndex, j + 1, count, 0.5)) / 2;
    const midY = (rowY[rowIndex]! + rowY[rowIndex + 1]!) / 2;
    regions.push({
      location,
      path: `M${points.join(' L')} Z`,
      centre: { x: xAt(midU, midY), y: midY },
    });
  });
});

/** Band depth range, for the labels down the wall. */
const bandRange = bands.map((_, bandIndex) => {
  const first = rows.findIndex((r) => r.bandIndex === bandIndex);
  const last = rows.length - 1 - [...rows].reverse().findIndex((r) => r.bandIndex === bandIndex);
  return { top: rowY[first]!, bottom: rowY[last + 1]! };
});

// The creek comes in over the top edge and runs down to the Trailhead.
const creekStops = regions
  .filter((r) => r.location.topic === 'rain-and-river')
  .map((r) => r.centre)
  .sort((a, b) => a.y - b.y);
const creekPoints = [
  { x: creekStops[0]?.x ?? CENTRE_X, y: Y_TOP - 30 },
  ...creekStops,
  { x: CENTRE_X, y: Y_TRAILHEAD + 40 },
];
function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  const d = [`M${points[0]!.x.toFixed(0)},${points[0]!.y.toFixed(0)}`];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const next = points[i + 1]!;
    d.push(
      `Q${p.x.toFixed(0)},${p.y.toFixed(0)} ${((p.x + next.x) / 2).toFixed(0)},${((p.y + next.y) / 2).toFixed(0)}`,
    );
  }
  const last = points[points.length - 1]!;
  d.push(`L${last.x.toFixed(0)},${last.y.toFixed(0)}`);
  return d.join(' ');
}
const creekPath = smoothPath(creekPoints);

// The outline of the whole valley, for the wall shading.
const valleyOutline: string[] = [];
for (let s = 0; s <= STEPS * 3; s++) {
  const u = s / (STEPS * 3);
  valleyOutline.push(pt(u, depthAt(0, u)));
}
valleyOutline.push(pt(1, Y_TRAILHEAD), `${xAt(1, Y_TRAILHEAD).toFixed(1)},${Y_ROAD + 60}`);
valleyOutline.push(`${xAt(0, Y_TRAILHEAD).toFixed(1)},${Y_ROAD + 60}`, pt(0, Y_TRAILHEAD));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const svg: string[] = [];
svg.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" font-family="Georgia, 'Times New Roman', serif">`,
);
svg.push(`<defs>
  <linearGradient id="nightfall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#0b0b1a" stop-opacity="0"/>
    <stop offset="55%" stop-color="#0b0b1a" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="#0b0b1a" stop-opacity="0.62"/>
  </linearGradient>
  <pattern id="walls" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
    <rect width="22" height="22" fill="#1c2a20"/>
    <path d="M0,11 h22" stroke="#101a13" stroke-width="7"/>
  </pattern>
  <clipPath id="valley"><path d="M${valleyOutline.join(' L')} Z"/></clipPath>
</defs>`);

// The valley walls: everything off the board.
svg.push(`<rect width="${WIDTH}" height="${MAP_HEIGHT}" fill="url(#walls)"/>`);
svg.push(`<rect width="${WIDTH}" height="${MAP_HEIGHT}" fill="#0d1410" opacity="0.35"/>`);

for (const region of regions) {
  const topic = ruleset.topics.get(region.location.topic)!;
  svg.push(
    `<path d="${region.path}" fill="${topic.colour}" fill-opacity="0.9" stroke="#2b2316" stroke-width="2.2" stroke-linejoin="round"/>`,
  );
}

// The creek, over the regions it runs through.
svg.push(
  `<g clip-path="url(#valley)"><path d="${creekPath}" fill="none" stroke="#5e93a4" stroke-width="10" stroke-opacity="0.8" stroke-linecap="round"/>` +
    `<path d="${creekPath}" fill="none" stroke="#bcd8e0" stroke-width="3.5" stroke-opacity="0.85" stroke-linecap="round"/></g>`,
);

// The light fails toward the bottom.
svg.push(`<rect width="${WIDTH}" height="${MAP_HEIGHT}" fill="url(#nightfall)" clip-path="url(#valley)"/>`);

// The Trailhead, sitting on the bottom edge where the road is.
const thPoints: string[] = [];
for (let s = 0; s <= STEPS; s++) {
  const u = s / STEPS;
  thPoints.push(pt(u, depthAt(rowY.length - 1, u)));
}
const thLeft = xAt(0, Y_TRAILHEAD);
const thRight = xAt(1, Y_TRAILHEAD);
svg.push(
  `<path d="M${thPoints.join(' L')} L${thRight.toFixed(1)},${Y_ROAD} L${thLeft.toFixed(1)},${Y_ROAD} Z" fill="#a8553c" stroke="#2b2316" stroke-width="3"/>`,
);
// The road out.
svg.push(
  `<path d="M${CENTRE_X},${Y_ROAD - 30} L${CENTRE_X},${MAP_HEIGHT}" stroke="#d9c9a4" stroke-width="34" stroke-linecap="butt"/>`,
);
svg.push(
  `<path d="M${CENTRE_X},${Y_ROAD - 30} L${CENTRE_X},${MAP_HEIGHT}" stroke="#2b2316" stroke-width="34" stroke-opacity="0.25" stroke-dasharray="2 16"/>`,
);
const thMidY = (Y_TRAILHEAD + Y_ROAD) / 2 - 16;
svg.push(
  `<text x="${CENTRE_X}" y="${thMidY}" text-anchor="middle" font-size="22" fill="#fff3e0" font-weight="bold">THE TRAILHEAD</text>`,
);
svg.push(
  `<text x="${CENTRE_X}" y="${thMidY + 24}" text-anchor="middle" font-size="13" fill="#fff3e0">Form 7-B issued here. One only.</text>`,
);
svg.push(
  `<text x="${CENTRE_X + 60}" y="${MAP_HEIGHT - 16}" text-anchor="start" font-size="12.5" fill="#cdd9c9" font-style="italic">the road out</text>`,
);

/** Split a long name across two lines, near the middle. */
function wrapName(name: string): string[] {
  if (name.length <= 17) return [name];
  const words = name.split(' ');
  let best = 1;
  let bestGap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    if (Math.abs(a - b) < bestGap) {
      bestGap = Math.abs(a - b);
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

// Labels.
for (const region of regions) {
  const topic = ruleset.topics.get(region.location.topic)!;
  const { x, y } = region.centre;
  const treasure = region.location.loot.length;
  const lines = wrapName(region.location.name);
  let ty = y - 20 - (lines.length - 1) * 9;
  for (const line of lines) {
    svg.push(
      `<text x="${x.toFixed(0)}" y="${ty.toFixed(0)}" text-anchor="middle" font-size="16" fill="#f6efdd" font-weight="bold" stroke="#1a1710" stroke-width="3.5" paint-order="stroke">${esc(line)}</text>`,
    );
    ty += 19;
  }
  svg.push(
    `<text x="${x.toFixed(0)}" y="${(ty + 2).toFixed(0)}" text-anchor="middle" font-size="12.5" fill="#f0e6cf" stroke="#1a1710" stroke-width="3" paint-order="stroke">${topic.symbol} ${esc(topic.name)}</text>`,
  );
  ty += 21;
  if (treasure > 0) {
    svg.push(
      `<text x="${x.toFixed(0)}" y="${ty.toFixed(0)}" text-anchor="middle" font-size="15" fill="#ffd978" stroke="#1a1710" stroke-width="3" paint-order="stroke">${'\u25c6'.repeat(treasure)}</text>`,
    );
    ty += 18;
  }
  if (region.location.vantage) {
    svg.push(
      `<text x="${x.toFixed(0)}" y="${ty.toFixed(0)}" text-anchor="middle" font-size="11" fill="#cfe8ff" stroke="#1a1710" stroke-width="3" paint-order="stroke">\u25b2 vantage</text>`,
    );
  }
}

// Band labels, down the left-hand wall.
bands.forEach((band, i) => {
  const range = bandRange[i]!;
  const y = (range.top + range.bottom) / 2;
  const x = Math.min(xAt(0, range.top), xAt(0, range.bottom)) - 28;
  svg.push(
    `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle" font-size="14" fill="#cdd9c9" font-weight="bold" letter-spacing="2" transform="rotate(-90 ${x.toFixed(0)} ${y.toFixed(0)})">${esc(band.name.toUpperCase())}</text>`,
  );
});
svg.push(
  `<text x="40" y="${MAP_HEIGHT - 150}" font-size="13" fill="#9fb09c" font-style="italic">the valley walls — no way through</text>`,
);

// Legend.
const LY0 = MAP_HEIGHT + 10;
svg.push(`<rect x="0" y="${MAP_HEIGHT}" width="${WIDTH}" height="${LEGEND_HEIGHT}" fill="#efe7d3"/>`);
svg.push(`<line x1="0" y1="${MAP_HEIGHT}" x2="${WIDTH}" y2="${MAP_HEIGHT}" stroke="#2b2316" stroke-width="2"/>`);
svg.push(`<text x="40" y="${LY0 + 32}" font-size="24" font-weight="bold" fill="#2b2316">${esc(map.name)}</text>`);
svg.push(
  `<text x="40" y="${LY0 + 56}" font-size="13" fill="#2b2316" opacity="0.8">Layout reference generated from the game data — not the artwork. Regions are roughly equal in area; boundaries are trails, not tile edges.</text>`,
);

let ly = LY0 + 92;
for (const topic of ruleset.topics.values()) {
  svg.push(`<rect x="42" y="${ly - 12}" width="16" height="16" fill="${topic.colour}" stroke="#2b2316"/>`);
  svg.push(
    `<text x="66" y="${ly}" font-size="13.5" fill="#2b2316"><tspan font-weight="bold">${topic.symbol} ${esc(topic.name)}</tspan> — ${esc(topic.terrainStyle)}</text>`,
  );
  ly += 23;
}

let ry = LY0 + 92;
svg.push(`<text x="920" y="${ry - 24}" font-size="13.5" font-weight="bold" fill="#2b2316">THE BANDS, TOP TO BOTTOM</text>`);
for (const band of bands) {
  svg.push(
    `<text x="920" y="${ry}" font-size="13" fill="#2b2316"><tspan font-weight="bold">${esc(band.name)}</tspan> — ${band.locations.length} places. ${esc(band.timeOfDay)}</text>`,
  );
  ry += 22;
}
ry += 12;
svg.push(`<text x="920" y="${ry}" font-size="13" fill="#2b2316">◆ treasure lying here</text>`);
ry += 22;
svg.push(`<text x="920" y="${ry}" font-size="13" fill="#2b2316">▲ vantage point — survive here and the Director tells you something</text>`);
ry += 22;
svg.push(`<text x="920" y="${ry}" font-size="13" fill="#2b2316">The creek runs the length of the valley. The walls are impassable.</text>`);

svg.push('</svg>');

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../map-layout.svg');
writeFileSync(out, svg.join('\n'));
console.log(`wrote ${out}`);
console.log(`${regions.length} regions in ${bands.length} bands, narrowing to the Trailhead on the bottom edge`);
bands.forEach((band, i) => {
  const range = bandRange[i]!;
  console.log(
    `  ${band.name}: ${band.locations.length} places, depth ${range.top.toFixed(0)}-${range.bottom.toFixed(0)}`,
  );
});
