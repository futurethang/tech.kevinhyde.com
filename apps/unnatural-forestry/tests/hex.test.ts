import { describe, expect, it } from 'vitest';

import {
  AXIAL_DIRECTIONS,
  axialDistance,
  axialKey,
  axialNeighbors,
  axialRing,
  axialToPixel,
  gridLabel,
  hexCorners,
  hexDisc,
  hexRing,
} from '../src/core/hex';

describe('axial geometry', () => {
  it('gives every hex exactly six neighbours', () => {
    const neighbors = axialNeighbors({ q: 0, r: 0 });
    expect(neighbors).toHaveLength(6);
    expect(new Set(neighbors.map(axialKey)).size).toBe(6);
  });

  it('neighbours are mutual', () => {
    const origin = { q: 2, r: -1 };
    for (const n of axialNeighbors(origin)) {
      expect(axialNeighbors(n).map(axialKey)).toContain(axialKey(origin));
    }
  });

  it('neighbours are exactly one step away', () => {
    for (const n of axialNeighbors({ q: -3, r: 1 })) {
      expect(axialDistance({ q: -3, r: 1 }, n)).toBe(1);
    }
  });

  it('distance is symmetric and zero on itself', () => {
    const a = { q: 1, r: 2 };
    const b = { q: -2, r: 0 };
    expect(axialDistance(a, b)).toBe(axialDistance(b, a));
    expect(axialDistance(a, a)).toBe(0);
    expect(axialDistance(a, b)).toBe(5);
  });

  it('directions are distinct unit steps', () => {
    expect(AXIAL_DIRECTIONS).toHaveLength(6);
    for (const d of AXIAL_DIRECTIONS) expect(axialRing(d)).toBe(1);
  });
});

describe('discs and rings', () => {
  it('a disc of radius n holds 3n(n+1)+1 hexes', () => {
    for (const radius of [0, 1, 2, 3, 4, 5]) {
      expect(hexDisc(radius)).toHaveLength(3 * radius * (radius + 1) + 1);
    }
  });

  it('a ring of radius n holds 6n hexes, all at distance n', () => {
    for (const radius of [1, 2, 3, 4, 5]) {
      const ring = hexRing(radius);
      expect(ring).toHaveLength(6 * radius);
      expect(new Set(ring.map(axialKey)).size).toBe(6 * radius);
      for (const hex of ring) expect(axialRing(hex)).toBe(radius);
    }
  });

  it('consecutive ring hexes are adjacent, and the ring closes', () => {
    const ring = hexRing(3);
    for (let i = 0; i < ring.length; i++) {
      const next = ring[(i + 1) % ring.length]!;
      expect(axialDistance(ring[i]!, next)).toBe(1);
    }
  });

  it('a ring of radius 0 is just the origin', () => {
    expect(hexRing(0)).toEqual([{ q: 0, r: 0 }]);
  });

  it('a disc contains its rings', () => {
    const disc = new Set(hexDisc(4).map(axialKey));
    for (const radius of [0, 1, 2, 3, 4]) {
      for (const hex of hexRing(radius)) expect(disc.has(axialKey(hex))).toBe(true);
    }
  });
});

describe('labels and layout', () => {
  it('grid labels are unique across a disc', () => {
    const labels = hexDisc(5).map((c) => gridLabel(c, 5));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('pixel centres of neighbours are one hex apart', () => {
    const size = 10;
    const origin = axialToPixel({ q: 0, r: 0 }, size);
    for (const n of axialNeighbors({ q: 0, r: 0 })) {
      const p = axialToPixel(n, size);
      const d = Math.hypot(p.x - origin.x, p.y - origin.y);
      expect(d).toBeCloseTo(Math.sqrt(3) * size, 5);
    }
  });

  it('a hex has six corners at the circumradius', () => {
    const corners = hexCorners(0, 0, 7);
    expect(corners).toHaveLength(6);
    for (const c of corners) expect(Math.hypot(c.x, c.y)).toBeCloseTo(7, 5);
  });
});
