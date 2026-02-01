/**
 * Test fixtures for Dice Baseball
 */

export interface MockBatterStats {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  bb: number;
  so: number;
  ab: number;
}

export interface MockPitcherStats {
  era: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
}

export interface MockBatter {
  mlbId: number;
  name: string;
  batting: MockBatterStats;
}

export interface MockPitcher {
  mlbId: number;
  name: string;
  pitching: MockPitcherStats;
}

export interface MockGameState {
  inning: number;
  isTopOfInning: boolean;
  outs: number;
  scores: [number, number];
  bases: [boolean, boolean, boolean];
  currentBatterIndex: number;
}

export function createMockBatter(overrides: Partial<MockBatter & { batting: Partial<MockBatterStats> }> = {}): MockBatter {
  return {
    mlbId: overrides.mlbId ?? 545361,
    name: overrides.name ?? 'Mike Trout',
    batting: {
      avg: 0.285,
      obp: 0.390,
      slg: 0.555,
      ops: 0.945,
      bb: 78,
      so: 120,
      ab: 450,
      ...overrides.batting,
    },
  };
}

export function createMockPitcher(overrides: Partial<MockPitcher & { pitching: Partial<MockPitcherStats> }> = {}): MockPitcher {
  return {
    mlbId: overrides.mlbId ?? 543037,
    name: overrides.name ?? 'Gerrit Cole',
    pitching: {
      era: 3.12,
      whip: 1.06,
      kPer9: 9.75,
      bbPer9: 2.04,
      hrPer9: 1.00,
      ...overrides.pitching,
    },
  };
}

export function createMockGameState(overrides: Partial<MockGameState> = {}): MockGameState {
  return {
    inning: 1,
    isTopOfInning: true,
    outs: 0,
    scores: [0, 0],
    bases: [false, false, false],
    currentBatterIndex: 0,
    ...overrides,
  };
}

/**
 * League average stats for comparison
 */
export const LEAGUE_AVERAGES = {
  batting: {
    avg: 0.250,
    obp: 0.320,
    slg: 0.400,
    ops: 0.720,
  },
  pitching: {
    era: 4.00,
    whip: 1.25,
    kPer9: 8.50,
    bbPer9: 3.00,
    hrPer9: 1.20,
  },
};
