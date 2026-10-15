/**
 * Draws a layout reference for the physical board, from the same JSON the
 * simulator runs on. `pnpm map:draw` writes map-layout.svg.
 *
 * This is NOT the artwork. It is the ground truth an illustrator paints over:
 * where each region sits, roughly how big it is, what it is called, what it is
 * called ON (its trivia theme, which is also what it should look like), and
 * what treasure is lying there.
 *
 * Shape: the board is a set of rings converging on the Trailhead at the centre.
 * Regions are sized for roughly equal area, so ring radii are spaced by area
 * rather than evenly. Every boundary is drawn as a wandering line — the same
 * wobble function is used for both sides of every edge, so regions tile exactly
 * and read as trails between areas rather than as tiles butted together.
 *
 * The light fails as you go inward: the outer ring is late afternoon, the
 * middle is dusk, the last ring is full dark.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRng } from '../src/core/rng';
import { loadRuleset } from '../src/forest/ruleset';
import type { LocationDefinition } from '../src/forest/types';

const WIDTH = 1500;
const MAP_HEIGHT = 1420;
const LEGEND_HEIGHT = 300;
const HEIGHT = MAP_HEIGHT + LEGEND_HEIGHT;
const CENTRE_X = WIDTH / 2;
const CENTRE_Y = MAP_HEIGHT / 2 + 30;
const OUTER = MAP_HEIGHT / 2 - 50;
const rng = createRng(1031);

/** Low-frequency wobble so an edge wanders like a trail instead of ruling straight. */
function makeWobble(amplitude: number): (t: number) => number {
  const phases = [rng.next() * 7, rng.next() * 7, rng.next() * 7];
  return (t: number) =>
    amplitude *
    (Math.sin(3 * t + phases[0]!) + 0.55 * Math.sin(7 * t + phases[1]!) + 0.3 * Math.sin(13 * t + phases[2]!)) /
    1.85;
}

const ruleset = loadRuleset();
const map = [...ruleset.maps.values()][0]!;
// Rings run inward: the last band (the Trailhead) is the middle of the board.
const rings = [...map.bands].reverse();
const place = rings.slice(1); // everything except the Trailhead disc

// Radii spaced so every region has roughly the same area.
const cellCounts = place.map((b) => b.locations.length);
const totalCells = cellCounts.reduce((a, b) => a + b, 0);
const cellArea = (OUTER * OUTER) / (totalCells + 2.2); // 2.2 cells' worth for the Trailhead
const radii: number[] = [Math.sqrt(2.2 * cellArea)];
for (const count of cellCounts) {
  radii.push(Math.sqrt(radii[radii.length - 1]! ** 2 + count * cellArea));
}

const ringEdge = radii.map((r) => ({ r, wobble: makeWobble(r * 0.045) }));
const radiusAt = (ring: number, theta: number) => {
  const edge = ringEdge[ring]!;
  return edge.r + edge.wobble(theta) * 1.6;
};

/** Angle of the divider between region j and j+1 of a ring, as it crosses the ring. */
const dividerWobbles = place.map((band) =>
  band.locations.map(() => makeWobble(0.035)),
);
const angleAt = (ringIndex: number, divider: number, count: number, t: number) => {
  const base = (2 * Math.PI * divider) / count - Math.PI / 2;
  return base + dividerWobbles[ringIndex]![divider]!(t * 3 + divider);
};

const polar = (r: number, a: number) =>
  `${(CENTRE_X + r * Math.cos(a)).toFixed(1)},${(CENTRE_Y + r * Math.sin(a)).toFixed(1)}`;
const polarXY = (r: number, a: number) => ({
  x: CENTRE_X + r * Math.cos(a),
  y: CENTRE_Y + r * Math.sin(a),
});

interface Region {
  readonly location: LocationDefinition;
  readonly path: string;
  readonly centre: { x: number; y: number };
}

const regions: Region[] = [];

place.forEach((band, ringIndex) => {
  const count = band.locations.length;
  const inner = ringIndex;
  const outer = ringIndex + 1;
  band.locations.forEach((location, j) => {
    const points: string[] = [];
    const STEPS = 26;
    // inner arc, from divider j to divider j+1
    for (let s = 0; s <= STEPS; s++) {
      const f = s / STEPS;
      const a0 = angleAt(ringIndex, j, count, 0);
      const a1 = angleAt(ringIndex, (j + 1) % count, count, 0) + (j + 1 === count ? 2 * Math.PI : 0);
      const a = a0 + (a1 - a0) * f;
      points.push(polar(radiusAt(inner, a), a));
    }
    // outward along divider j+1
    for (let s = 1; s <= STEPS; s++) {
      const f = s / STEPS;
      const a = angleAt(ringIndex, (j + 1) % count, count, f) + (j + 1 === count ? 2 * Math.PI : 0);
      const r = radiusAt(inner, a) + (radiusAt(outer, a) - radiusAt(inner, a)) * f;
      points.push(polar(r, a));
    }
    // outer arc, back from divider j+1 to divider j
    for (let s = STEPS; s >= 0; s--) {
      const f = s / STEPS;
      const a0 = angleAt(ringIndex, j, count, 1);
      const a1 = angleAt(ringIndex, (j + 1) % count, count, 1) + (j + 1 === count ? 2 * Math.PI : 0);
      const a = a0 + (a1 - a0) * f;
      points.push(polar(radiusAt(outer, a), a));
    }
    // inward along divider j
    for (let s = STEPS - 1; s >= 1; s--) {
      const f = s / STEPS;
      const a = angleAt(ringIndex, j, count, f);
      const r = radiusAt(inner, a) + (radiusAt(outer, a) - radiusAt(inner, a)) * f;
      points.push(polar(r, a));
    }
    const midAngle =
      (angleAt(ringIndex, j, count, 0.5) +
        angleAt(ringIndex, (j + 1) % count, count, 0.5) +
        (j + 1 === count ? 2 * Math.PI : 0)) /
      2;
    const midRadius = (ringEdge[inner]!.r + ringEdge[outer]!.r) / 2;
    regions.push({
      location,
      path: `M${points.join(' L')} Z`,
      centre: polarXY(midRadius, midAngle),
    });
  });
});

// The creek wanders in from the edge, through every Rain & River region, to the
// Trailhead. It is one continuous feature rather than a place of its own.
const creekStops = regions
  .filter((r) => r.location.topic === 'rain-and-river')
  .map((r) => r.centre)
  .sort(
    (a, b) =>
      Math.hypot(b.x - CENTRE_X, b.y - CENTRE_Y) - Math.hypot(a.x - CENTRE_X, a.y - CENTRE_Y),
  );
const first = creekStops[0] ?? { x: CENTRE_X, y: CENTRE_Y - OUTER };
const entryAngle = Math.atan2(first.y - CENTRE_Y, first.x - CENTRE_X);
const creekPoints = [polarXY(OUTER * 1.04, entryAngle), ...creekStops, { x: CENTRE_X, y: CENTRE_Y }];

/** A smooth path through a list of points, using midpoints as curve anchors. */
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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const svg: string[] = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" font-family="Georgia, 'Times New Roman', serif">`);
svg.push(`<defs>
  <radialGradient id="nightfall" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#0b0b1a" stop-opacity="0.72"/>
    <stop offset="45%" stop-color="#0b0b1a" stop-opacity="0.34"/>
    <stop offset="100%" stop-color="#0b0b1a" stop-opacity="0"/>
  </radialGradient>
  <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
    <feComposite operator="in" in2="SourceGraphic"/></filter>
</defs>`);
svg.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="#e8dfc8"/>`);

for (const region of regions) {
  const topic = ruleset.topics.get(region.location.topic)!;
  svg.push(`<path d="${region.path}" fill="${topic.colour}" fill-opacity="0.85" stroke="#2b2316" stroke-width="2.2" stroke-linejoin="round"/>`);
}

// The creek, over the top of the regions it runs through.
svg.push(`<path d="${creekPath}" fill="none" stroke="#5e93a4" stroke-width="9" stroke-opacity="0.75" stroke-linecap="round"/>`);
svg.push(`<path d="${creekPath}" fill="none" stroke="#bcd8e0" stroke-width="3" stroke-opacity="0.8" stroke-linecap="round"/>`);

// The light fails toward the middle.
svg.push(`<circle cx="${CENTRE_X}" cy="${CENTRE_Y}" r="${OUTER * 1.1}" fill="url(#nightfall)"/>`);

// The Trailhead.
const stationAngles = Array.from({ length: 80 }, (_, i) => (i / 80) * Math.PI * 2);
const stationPath = stationAngles.map((a) => polar(radiusAt(0, a), a)).join(' L');
svg.push(`<path d="M${stationPath} Z" fill="#a8553c" fill-opacity="0.95" stroke="#2b2316" stroke-width="3"/>`);
svg.push(`<text x="${CENTRE_X}" y="${CENTRE_Y - 6}" text-anchor="middle" font-size="19" fill="#fff3e0" font-weight="bold">THE TRAILHEAD</text>`);
svg.push(`<text x="${CENTRE_X}" y="${CENTRE_Y + 16}" text-anchor="middle" font-size="13" fill="#fff3e0">Form 7-B issued here</text>`);

// Labels.
for (const region of regions) {
  const topic = ruleset.topics.get(region.location.topic)!;
  const { x, y } = region.centre;
  const treasure = region.location.loot.length;
  svg.push(`<text x="${x.toFixed(0)}" y="${(y - 14).toFixed(0)}" text-anchor="middle" font-size="17" fill="#f6efdd" font-weight="bold" stroke="#1a1710" stroke-width="3.5" paint-order="stroke">${esc(region.location.name)}</text>`);
  svg.push(`<text x="${x.toFixed(0)}" y="${(y + 6).toFixed(0)}" text-anchor="middle" font-size="13" fill="#f0e6cf" stroke="#1a1710" stroke-width="3" paint-order="stroke">${topic.symbol} ${esc(topic.name)}</text>`);
  if (treasure > 0) {
    svg.push(`<text x="${x.toFixed(0)}" y="${(y + 26).toFixed(0)}" text-anchor="middle" font-size="15" fill="#ffd978" stroke="#1a1710" stroke-width="3" paint-order="stroke">${'◆'.repeat(treasure)}</text>`);
  }
  if (region.location.vantage) {
    svg.push(`<text x="${x.toFixed(0)}" y="${(y + 44).toFixed(0)}" text-anchor="middle" font-size="11" fill="#cfe8ff" stroke="#1a1710" stroke-width="3" paint-order="stroke">▲ vantage</text>`);
  }
}

// Legend, in its own band below the map.
const LY0 = MAP_HEIGHT + 10;
svg.push(`<rect x="0" y="${MAP_HEIGHT}" width="${WIDTH}" height="${LEGEND_HEIGHT}" fill="#efe7d3"/>`);
svg.push(`<line x1="0" y1="${MAP_HEIGHT}" x2="${WIDTH}" y2="${MAP_HEIGHT}" stroke="#2b2316" stroke-width="2"/>`);
svg.push(`<text x="40" y="${LY0 + 32}" font-size="24" font-weight="bold" fill="#2b2316">${esc(map.name)}</text>`);
svg.push(`<text x="40" y="${LY0 + 56}" font-size="13" fill="#2b2316" opacity="0.8">Layout reference generated from the game data \u2014 not the artwork. Regions are roughly equal in area; boundaries are trails, not tile edges.</text>`);

let ly = LY0 + 92;
for (const topic of ruleset.topics.values()) {
  svg.push(`<rect x="42" y="${ly - 12}" width="16" height="16" fill="${topic.colour}" stroke="#2b2316"/>`);
  svg.push(
    `<text x="66" y="${ly}" font-size="13.5" fill="#2b2316"><tspan font-weight="bold">${topic.symbol} ${esc(topic.name)}</tspan> \u2014 ${esc(topic.terrainStyle)}</text>`,
  );
  ly += 23;
}

let ry = LY0 + 92;
svg.push(`<text x="920" y="${ry - 24}" font-size="13.5" font-weight="bold" fill="#2b2316">THE RINGS, OUTSIDE IN</text>`);
for (const band of [...place].reverse()) {
  svg.push(
    `<text x="920" y="${ry}" font-size="13" fill="#2b2316"><tspan font-weight="bold">${esc(band.name)}</tspan> \u2014 ${band.locations.length} places. ${esc(band.timeOfDay)}</text>`,
  );
  ry += 22;
}
ry += 12;
svg.push(`<text x="920" y="${ry}" font-size="13" fill="#2b2316">\u25c6 treasure lying here</text>`);
ry += 22;
svg.push(`<text x="920" y="${ry}" font-size="13" fill="#2b2316">\u25b2 vantage point \u2014 survive here and the Director tells you something</text>`);
ry += 22;
svg.push(`<text x="920" y="${ry}" font-size="13" fill="#2b2316">The creek runs right through the board, from the edge to the Trailhead.</text>`);

svg.push('</svg>');

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../map-layout.svg');
writeFileSync(out, svg.join('\n'));
console.log(`wrote ${out}`);
console.log(`${regions.length} regions across ${place.length} rings, plus the Trailhead`);
for (const band of place) {
  console.log(`  ${band.name}: ${band.locations.length} places — ${band.timeOfDay}`);
}
