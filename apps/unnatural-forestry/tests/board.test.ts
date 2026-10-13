import { describe, expect, it } from 'vitest';

import { createBoard } from '../src/core/board';
import { parseMap } from '../src/core/config';
import { L, makeMapRaw, terrains } from './fixtures';

function board(options = {}) {
  return createBoard(parseMap(makeMapRaw(options), terrains, 'fixture/map'), terrains);
}

describe('board adjacency', () => {
  it('derives six neighbours for an interior hex and fewer on the perimeter', () => {
    const b = board();
    expect(b.neighbors(L(0, 0))).toHaveLength(6);
    expect(b.neighbors(L(0, -2)).length).toBeLessThan(6);
  });

  it('never lists a hex as its own neighbour', () => {
    const b = board();
    for (const id of b.hexIds) expect(b.neighbors(id)).not.toContain(id);
  });

  it('adjacency is symmetric', () => {
    const b = board();
    for (const id of b.hexIds) {
      for (const n of b.neighbors(id)) expect(b.neighbors(n)).toContain(id);
    }
  });

  it('excludes impassable hexes from passable neighbours', () => {
    const b = board({ water: ['1,0'] });
    expect(b.neighbors(L(0, 0))).toContain(L(1, 0));
    expect(b.passableNeighbors(L(0, 0))).not.toContain(L(1, 0));
    expect(b.isPassable(L(1, 0))).toBe(false);
  });

  it('reports the perimeter as hexes with fewer than six neighbours', () => {
    const b = board();
    expect(b.perimeterHexIds).toHaveLength(6 * 2); // the outer ring of a radius-2 disc
    expect(b.perimeterHexIds).not.toContain(L(0, 0));
  });

  it('throws on an unknown hex id rather than returning undefined', () => {
    expect(() => board().hex('NOPE')).toThrow(/unknown hex/);
  });
});

describe('board trailheads and contents', () => {
  it('treats only open trailheads as exits', () => {
    const b = board({
      trailheadHexIds: [L(0, -2)],
      closedTrailheadHexIds: [L(2, 0)],
    });
    expect(b.isOpenTrailhead(L(0, -2))).toBe(true);
    expect(b.isOpenTrailhead(L(2, 0))).toBe(false);
    expect(b.openTrailheadHexIds).toEqual([L(0, -2)]);
    expect(b.trailheadAt(L(2, 0))?.closed).toBe(true);
  });

  it('groups several contents on one hex', () => {
    const b = board({
      contents: [
        { hexId: L(0, 0), kind: 'clue', label: 'A' },
        { hexId: L(0, 0), kind: 'hazard', label: 'B' },
        { hexId: L(1, 0), kind: 'reward', label: 'C' },
      ],
    });
    expect(b.contentsAt(L(0, 0)).map((c) => c.label)).toEqual(['A', 'B']);
    expect(b.contentsAt(L(1, -1))).toEqual([]);
  });
});
