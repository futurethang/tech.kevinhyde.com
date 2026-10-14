import { describe, expect, it } from 'vitest';

import { Simulation } from '../src/core/simulation';
import { buildViewModel, initials, type ViewOptions } from '../src/ui/viewModel';
import { layoutHexes, hexAtPoint, tokenOffsets } from '../src/render/layout';
import { L, makeFixture } from './fixtures';

const CENTRE = L(0, 0);
const EXIT = L(0, -2);

const BASE_OPTIONS: ViewOptions = {
  activeTeamId: null,
  inspectedHexId: null,
  showExitDistance: false,
  showSecrets: false,
  showExploration: true,
  revealAllPending: false,
};

function sim() {
  const { resolved } = makeFixture(
    [
      { id: 'a', startHexId: CENTRE },
      { id: 'b', startHexId: L(2, 0) },
    ],
    {
      trailheadHexIds: [EXIT],
      contents: [{ hexId: L(0, -1), kind: 'reward', label: 'Cache', itemId: 'rope' }],
    },
    { revealHiddenContents: true },
  );
  return new Simulation(resolved);
}

describe('view model', () => {
  it('renders one hex view per map hex, with terrain colour', () => {
    const vm = buildViewModel(sim(), BASE_OPTIONS);
    expect(vm.hexes).toHaveLength(19);
    expect(vm.hexes.every((h) => h.fill.startsWith('#'))).toBe(true);
  });

  it('highlights the active team legal moves only', () => {
    const vm = buildViewModel(sim(), { ...BASE_OPTIONS, activeTeamId: 'a' });
    const legal = vm.hexes.filter((h) => h.highlight === 'legal').map((h) => h.id);
    expect(legal).toContain(L(1, 0));
    expect(legal).not.toContain(EXIT);
    const none = buildViewModel(sim(), BASE_OPTIONS);
    expect(none.hexes.some((h) => h.highlight === 'legal')).toBe(false);
  });

  it('marks the selected destination and nothing else', () => {
    const s = sim();
    s.select('a', L(0, -1));
    const vm = buildViewModel(s, { ...BASE_OPTIONS, activeTeamId: 'a' });
    expect(vm.hexes.filter((h) => h.highlight === 'selected').map((h) => h.id)).toEqual([L(0, -1)]);
  });

  it('hides a committed destination belonging to another team', () => {
    const s = sim();
    s.selectAndCommit('b', L(1, 0));
    const vm = buildViewModel(s, { ...BASE_OPTIONS, activeTeamId: 'a' });
    expect(vm.hexes.some((h) => h.highlight === 'selected')).toBe(false);
    expect(vm.tokens.find((t) => t.teamId === 'b')!.pendingHexId).toBeNull();
    // ...but shows it when that team is the one being handled.
    const own = buildViewModel(s, { ...BASE_OPTIONS, activeTeamId: 'b' });
    expect(own.tokens.find((t) => t.teamId === 'b')!.pendingHexId).toBe(L(1, 0));
  });

  it('shows every pending move under the debug reveal override', () => {
    const s = sim();
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(1, 0));
    const vm = buildViewModel(s, { ...BASE_OPTIONS, activeTeamId: null, revealAllPending: true });
    expect(vm.tokens.find((t) => t.teamId === 'a')!.pendingHexId).toBe(L(0, -1));
    expect(vm.tokens.find((t) => t.teamId === 'b')!.pendingHexId).toBe(L(1, 0));
    expect(vm.hexes.filter((h) => h.highlight === 'selected').map((h) => h.id).sort()).toEqual(
      [L(0, -1), L(1, 0)].sort(),
    );
  });

  it('marks exploration from the teams visited hexes', () => {
    const s = sim();
    const before = buildViewModel(s, BASE_OPTIONS);
    expect(before.hexes.filter((h) => h.explored).map((h) => h.id).sort()).toEqual(
      [CENTRE, L(2, 0)].sort(),
    );
    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(1, 0));
    s.resolve();
    const after = buildViewModel(s, BASE_OPTIONS);
    expect(after.hexes.filter((h) => h.explored)).toHaveLength(4);
  });

  it('shows content markers only when revealed or when secrets are on', () => {
    const s = sim();
    const hidden = buildViewModel(s, BASE_OPTIONS).hexes.find((h) => h.id === L(0, -1))!;
    expect(hidden.revealedContent).toBe(false);
    expect(hidden.secretContent).toBe(false);

    const secrets = buildViewModel(s, { ...BASE_OPTIONS, showSecrets: true }).hexes.find(
      (h) => h.id === L(0, -1),
    )!;
    expect(secrets.secretContent).toBe(true);

    s.selectAndCommit('a', L(0, -1));
    s.selectAndCommit('b', L(1, 0));
    s.resolve();
    const revealed = buildViewModel(s, BASE_OPTIONS).hexes.find((h) => h.id === L(0, -1))!;
    expect(revealed.revealedContent).toBe(true);
  });

  it('adds the exit distance overlay on request', () => {
    const vm = buildViewModel(sim(), { ...BASE_OPTIONS, showExitDistance: true });
    expect(vm.hexes.find((h) => h.id === EXIT)!.overlayText).toBe('0');
    expect(vm.hexes.find((h) => h.id === CENTRE)!.overlayText).toBe('2');
    expect(buildViewModel(sim(), BASE_OPTIONS).hexes[0]!.overlayText).toBeNull();
  });

  it('flags trailheads and reports token status', () => {
    const s = sim();
    const vm = buildViewModel(s, BASE_OPTIONS);
    expect(vm.hexes.find((h) => h.id === EXIT)!.trailhead).toEqual({ id: 'TH-1', closed: false });
    expect(vm.tokens.every((t) => t.status === 'active')).toBe(true);
  });

  it('spreads co-located tokens apart', () => {
    const s = sim();
    s.selectAndCommit('a', L(1, 0));
    s.selectAndCommit('b', L(1, 0));
    s.resolve();
    const vm = buildViewModel(s, BASE_OPTIONS);
    const stacked = vm.tokens.filter((t) => t.hexId === L(1, 0));
    expect(stacked).toHaveLength(2);
    expect([stacked[0]!.dx, stacked[0]!.dy]).not.toEqual([stacked[1]!.dx, stacked[1]!.dy]);
    expect(stacked.every((t) => Math.hypot(t.dx, t.dy) <= 1.0001)).toBe(true);
  });
});

describe('initials', () => {
  it('abbreviates multi-word names and truncates single words', () => {
    expect(initials('Fern Gully Irregulars')).toBe('FGI');
    expect(initials('Crew')).toBe('CRE');
    expect(initials('Nurse Log Local 12')).toBe('NLL');
  });
});

describe('layout', () => {
  const hexes = [
    { id: 'a', q: 0, r: 0 },
    { id: 'b', q: 1, r: 0 },
    { id: 'c', q: 0, r: 1 },
  ];

  it('shifts every centre into a positive padded box', () => {
    const layout = layoutHexes(hexes, 20);
    for (const centre of layout.centers.values()) {
      expect(centre.x).toBeGreaterThan(0);
      expect(centre.y).toBeGreaterThan(0);
    }
    expect(layout.bounds.width).toBeGreaterThan(0);
  });

  it('hit-tests a point inside a hex and misses outside the map', () => {
    const layout = layoutHexes(hexes, 20);
    const centre = layout.centers.get('b')!;
    expect(hexAtPoint(layout, centre.x, centre.y)).toBe('b');
    expect(hexAtPoint(layout, -500, -500)).toBeNull();
  });

  it('throws for a hex that is not laid out', () => {
    const layout = layoutHexes(hexes, 20);
    expect(() => layout.centers.get('zz')!.x).toThrow();
  });

  it('gives one offset per token, all inside the hex', () => {
    expect(tokenOffsets(1, 20)).toEqual([{ dx: 0, dy: 0 }]);
    const offsets = tokenOffsets(4, 20);
    expect(offsets).toHaveLength(4);
    for (const o of offsets) expect(Math.hypot(o.dx, o.dy)).toBeLessThan(20);
  });
});
