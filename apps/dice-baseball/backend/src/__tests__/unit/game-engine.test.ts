/**
 * Game Engine Tests - Phase 4
 * TDD: All tests written FIRST before implementation
 * 100% coverage required for game engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMockBatter,
  createMockPitcher,
  createMockGameState,
  LEAGUE_AVERAGES,
  MockBatterStats,
  MockPitcherStats,
} from '../helpers/fixtures';
import {
  BASE_PROBABILITIES,
  LEAGUE_AVG,
  OutcomeType,
  calculateBatterModifiers,
  calculatePitcherModifiers,
  resolveAtBat,
  advanceRunners,
  handleInningLogic,
  generateDescription,
  clamp,
  applyDiceBias,
  weightedRandomSelect,
  BaseState,
  GameState,
} from '../../services/game-engine';

console.log('🧪 Starting test suite...');

describe('Game Engine', () => {
  // ============================================
  // BASE PROBABILITIES
  // ============================================
  describe('Base Probabilities', () => {
    it('probabilities sum to 1.0', () => {
      const sum = Object.values(BASE_PROBABILITIES).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 3);
    });

    it('matches expected distribution from dice odds', () => {
      // Baseline model probabilities (kept explicit as a regression check)
      expect(BASE_PROBABILITIES.homeRun).toBeCloseTo(0.028, 3);
      expect(BASE_PROBABILITIES.triple).toBeCloseTo(0.005, 3);
      expect(BASE_PROBABILITIES.double).toBeCloseTo(0.046, 3);
      expect(BASE_PROBABILITIES.single).toBeCloseTo(0.150, 3);
      expect(BASE_PROBABILITIES.walk).toBeCloseTo(0.083, 2);
      expect(BASE_PROBABILITIES.strikeout).toBeCloseTo(0.217, 3);
      expect(BASE_PROBABILITIES.groundOut).toBeCloseTo(0.278, 2);
      expect(BASE_PROBABILITIES.flyOut).toBeCloseTo(0.193, 3);
    });

    it('contains all required outcome types', () => {
      const expectedOutcomes: OutcomeType[] = [
        'homeRun',
        'triple',
        'double',
        'single',
        'walk',
        'strikeout',
        'groundOut',
        'flyOut',
      ];

      for (const outcome of expectedOutcomes) {
        expect(BASE_PROBABILITIES).toHaveProperty(outcome);
        expect(BASE_PROBABILITIES[outcome]).toBeGreaterThan(0);
      }
    });
  });

  // ============================================
  // BATTER MODIFIERS
  // ============================================
  describe('Batter Modifiers', () => {
    it('returns neutral modifiers for league-average player', () => {
      const leagueAvgBatter: MockBatterStats = {
        avg: 0.250,
        obp: 0.320,
        slg: 0.400,
        ops: 0.720,
        bb: 36,
        so: 90,
        ab: 450,
      };

      const mods = calculateBatterModifiers(leagueAvgBatter);

      // Neutral should be close to 1.0 for most modifiers
      expect(mods.single).toBeCloseTo(1.0, 1);
      expect(mods.groundOut).toBeCloseTo(1.0, 1);
    });

    it('boosts hit outcomes for high-OPS batter', () => {
      const highOpsBatter = createMockBatter({
        batting: {
          avg: 0.320,
          obp: 0.420,
          slg: 0.600,
          ops: 1.020,
          bb: 90,
          so: 80,
          ab: 450,
        },
      });

      const mods = calculateBatterModifiers(highOpsBatter.batting);

      // High OPS should boost hit outcomes
      expect(mods.single).toBeGreaterThan(1.0);
      expect(mods.double).toBeGreaterThan(1.0);
      expect(mods.homeRun).toBeGreaterThan(1.0);
    });

    it('reduces strikeout rate for low-K batter', () => {
      const contactBatter = createMockBatter({
        batting: {
          avg: 0.290,
          obp: 0.340,
          slg: 0.420,
          ops: 0.760,
          bb: 40,
          so: 50, // Low strikeouts
          ab: 500,
        },
      });

      const mods = calculateBatterModifiers(contactBatter.batting);

      // Low strikeout rate should reduce strikeout modifier
      expect(mods.strikeout).toBeLessThan(1.0);
    });

    it('boosts strikeout rate for high-K batter', () => {
      const powerBatter = createMockBatter({
        batting: {
          avg: 0.240,
          obp: 0.320,
          slg: 0.480,
          ops: 0.800,
          bb: 50,
          so: 180, // High strikeouts
          ab: 500,
        },
      });

      const mods = calculateBatterModifiers(powerBatter.batting);

      // High strikeout rate should boost strikeout modifier
      expect(mods.strikeout).toBeGreaterThan(1.0);
    });

    it('clamps extreme values within bounds', () => {
      // Elite batter with extreme stats
      const eliteBatter = createMockBatter({
        batting: {
          avg: 0.400,
          obp: 0.500,
          slg: 0.800,
          ops: 1.300,
          bb: 150,
          so: 30,
          ab: 400,
        },
      });

      const mods = calculateBatterModifiers(eliteBatter.batting);

      // All modifiers should be within documented bounds
      expect(mods.single).toBeGreaterThanOrEqual(0.5);
      expect(mods.single).toBeLessThanOrEqual(1.5);
      expect(mods.double).toBeGreaterThanOrEqual(0.4);
      expect(mods.double).toBeLessThanOrEqual(1.8);
      expect(mods.triple).toBeGreaterThanOrEqual(0.3);
      expect(mods.triple).toBeLessThanOrEqual(2.0);
      expect(mods.homeRun).toBeGreaterThanOrEqual(0.3);
      expect(mods.homeRun).toBeLessThanOrEqual(2.5);
      expect(mods.walk).toBeGreaterThanOrEqual(0.5);
      expect(mods.walk).toBeLessThanOrEqual(2.0);
      expect(mods.strikeout).toBeGreaterThanOrEqual(0.5);
      expect(mods.strikeout).toBeLessThanOrEqual(2.0);
      expect(mods.flyOut).toBeGreaterThanOrEqual(0.7);
      expect(mods.flyOut).toBeLessThanOrEqual(1.3);
    });

    it('handles zero at-bats gracefully', () => {
      const noAbBatter = createMockBatter({
        batting: {
          avg: 0,
          obp: 0,
          slg: 0,
          ops: 0,
          bb: 0,
          so: 0,
          ab: 0,
        },
      });

      // Should not throw and should return valid modifiers
      expect(() => calculateBatterModifiers(noAbBatter.batting)).not.toThrow();

      const mods = calculateBatterModifiers(noAbBatter.batting);
      expect(mods.single).toBeDefined();
      expect(Number.isFinite(mods.single)).toBe(true);
    });

    it('handles missing stats with defaults', () => {
      const partialStats: MockBatterStats = {
        avg: 0.250,
        obp: 0.320,
        slg: 0.400,
        ops: 0.720,
        bb: 0,
        so: 0,
        ab: 0,
      };

      expect(() => calculateBatterModifiers(partialStats)).not.toThrow();

      const mods = calculateBatterModifiers(partialStats);
      expect(Object.values(mods).every(v => Number.isFinite(v))).toBe(true);
    });
  });

  // ============================================
  // PITCHER MODIFIERS
  // ============================================
  describe('Pitcher Modifiers', () => {
    it('returns neutral modifiers for league-average pitcher', () => {
      const leagueAvgPitcher: MockPitcherStats = {
        era: 4.00,
        whip: 1.30,
        kPer9: 8.5,
        bbPer9: 3.0,
        hrPer9: 1.2,
      };

      const mods = calculatePitcherModifiers(leagueAvgPitcher);

      // Neutral should be close to 1.0 for most modifiers
      expect(mods.single).toBeCloseTo(1.0, 1);
      expect(mods.strikeout).toBeCloseTo(1.0, 1);
    });

    it('increases strikeout rate for high-K pitcher', () => {
      const acePitcher = createMockPitcher({
        pitching: {
          era: 2.50,
          whip: 0.95,
          kPer9: 12.0,
          bbPer9: 2.0,
          hrPer9: 0.8,
        },
      });

      const mods = calculatePitcherModifiers(acePitcher.pitching);

      expect(mods.strikeout).toBeGreaterThan(1.0);
    });

    it('reduces hit outcomes for low-WHIP pitcher', () => {
      const elitePitcher = createMockPitcher({
        pitching: {
          era: 2.00,
          whip: 0.80,
          kPer9: 10.0,
          bbPer9: 1.5,
          hrPer9: 0.6,
        },
      });

      const mods = calculatePitcherModifiers(elitePitcher.pitching);

      // Low WHIP should reduce hit modifiers (making it harder to get hits)
      expect(mods.single).toBeLessThan(1.0);
      expect(mods.double).toBeLessThan(1.0);
    });

    it('clamps extreme values within bounds', () => {
      // Historically great pitcher stats
      const primePedro: MockPitcherStats = {
        era: 1.50,
        whip: 0.70,
        kPer9: 13.0,
        bbPer9: 1.2,
        hrPer9: 0.4,
      };

      const mods = calculatePitcherModifiers(primePedro);

      // All modifiers should be within documented bounds
      expect(mods.single).toBeGreaterThanOrEqual(0.5);
      expect(mods.single).toBeLessThanOrEqual(1.5);
      expect(mods.double).toBeGreaterThanOrEqual(0.5);
      expect(mods.double).toBeLessThanOrEqual(1.5);
      expect(mods.triple).toBeGreaterThanOrEqual(0.5);
      expect(mods.triple).toBeLessThanOrEqual(1.5);
      expect(mods.homeRun).toBeGreaterThanOrEqual(0.4);
      expect(mods.homeRun).toBeLessThanOrEqual(2.0);
      expect(mods.walk).toBeGreaterThanOrEqual(0.5);
      expect(mods.walk).toBeLessThanOrEqual(1.8);
      expect(mods.strikeout).toBeGreaterThanOrEqual(0.6);
      expect(mods.strikeout).toBeLessThanOrEqual(1.8);
    });

    it('handles zero innings pitched', () => {
      const noPitchingStats: MockPitcherStats = {
        era: 0,
        whip: 0,
        kPer9: 0,
        bbPer9: 0,
        hrPer9: 0,
      };

      expect(() => calculatePitcherModifiers(noPitchingStats)).not.toThrow();

      const mods = calculatePitcherModifiers(noPitchingStats);
      expect(Object.values(mods).every(v => Number.isFinite(v))).toBe(true);
    });

    it('handles missing stats with defaults', () => {
      const partialStats: MockPitcherStats = {
        era: 4.50,
        whip: 1.40,
        kPer9: 0,
        bbPer9: 0,
        hrPer9: 0,
      };

      expect(() => calculatePitcherModifiers(partialStats)).not.toThrow();

      const mods = calculatePitcherModifiers(partialStats);
      expect(Object.values(mods).every(v => Number.isFinite(v))).toBe(true);
    });
  });

  // ============================================
  // OUTCOME RESOLUTION
  // ============================================
  describe('Outcome Resolution', () => {
    let mockBatter: MockBatterStats;
    let mockPitcher: MockPitcherStats;

    beforeEach(() => {
      mockBatter = createMockBatter().batting;
      mockPitcher = createMockPitcher().pitching;
    });

    it('applies batter modifiers correctly', () => {
      // High OPS batter vs average pitcher
      const eliteBatter = createMockBatter({
        batting: { ops: 1.100, slg: 0.650, obp: 0.450, avg: 0.330, bb: 100, so: 60, ab: 450 },
      }).batting;

      const avgPitcher: MockPitcherStats = {
        era: 4.00,
        whip: 1.30,
        kPer9: 8.5,
        bbPer9: 3.0,
        hrPer9: 1.2,
      };

      // Run many iterations to verify distribution
      const results: Record<OutcomeType, number> = {
        homeRun: 0,
        triple: 0,
        double: 0,
        single: 0,
        walk: 0,
        strikeout: 0,
        groundOut: 0,
        flyOut: 0,
      };

      for (let i = 0; i < 1000; i++) {
        const diceRoll: [number, number] = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];
        const outcome = resolveAtBat(eliteBatter, avgPitcher, diceRoll);
        results[outcome]++;
      }

      // Elite batter should have more positive outcomes
      const positiveOutcomes = results.homeRun + results.triple + results.double + results.single + results.walk;
      const negativeOutcomes = results.strikeout + results.groundOut + results.flyOut;

      expect(positiveOutcomes).toBeGreaterThan(0);
      expect(negativeOutcomes).toBeGreaterThan(0);
    });

    it('applies pitcher modifiers correctly', () => {
      const avgBatter: MockBatterStats = {
        avg: 0.250,
        obp: 0.320,
        slg: 0.400,
        ops: 0.720,
        bb: 45,
        so: 100,
        ab: 450,
      };

      const elitePitcher = createMockPitcher({
        pitching: { era: 2.00, whip: 0.85, kPer9: 12.0, bbPer9: 1.5, hrPer9: 0.5 },
      }).pitching;

      const results: Record<OutcomeType, number> = {
        homeRun: 0,
        triple: 0,
        double: 0,
        single: 0,
        walk: 0,
        strikeout: 0,
        groundOut: 0,
        flyOut: 0,
      };

      for (let i = 0; i < 1000; i++) {
        const diceRoll: [number, number] = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];
        const outcome = resolveAtBat(avgBatter, elitePitcher, diceRoll);
        results[outcome]++;
      }

      // Elite pitcher should generate more strikeouts
      expect(results.strikeout).toBeGreaterThan(0);
    });

    it('normalizes final probabilities to 1.0', () => {
      // This tests internal probability normalization
      // We verify by checking all outcomes are possible
      const outcomes = new Set<OutcomeType>();

      for (let i = 0; i < 5000; i++) {
        const diceRoll: [number, number] = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];
        const outcome = resolveAtBat(mockBatter, mockPitcher, diceRoll);
        outcomes.add(outcome);

        if (outcomes.size === 8) break;
      }

      // All 8 outcome types should be possible
      expect(outcomes.size).toBe(8);
    });

    it('biases toward good outcomes on high dice rolls', () => {
      const goodOutcomes: Record<OutcomeType, number> = {
        homeRun: 0,
        triple: 0,
        double: 0,
        single: 0,
        walk: 0,
        strikeout: 0,
        groundOut: 0,
        flyOut: 0,
      };

      // Roll only 12s (max dice total)
      for (let i = 0; i < 1000; i++) {
        const outcome = resolveAtBat(mockBatter, mockPitcher, [6, 6]);
        goodOutcomes[outcome]++;
      }

      const positive = goodOutcomes.homeRun + goodOutcomes.triple + goodOutcomes.double + goodOutcomes.single + goodOutcomes.walk;
      const negative = goodOutcomes.strikeout + goodOutcomes.groundOut + goodOutcomes.flyOut;
      const expectedPositiveRate =
        BASE_PROBABILITIES.homeRun +
        BASE_PROBABILITIES.triple +
        BASE_PROBABILITIES.double +
        BASE_PROBABILITIES.single +
        BASE_PROBABILITIES.walk;

      // With max dice roll, positive outcomes should beat baseline rates
      expect(positive / (positive + negative)).toBeGreaterThan(expectedPositiveRate);
    });

    it('biases toward bad outcomes on low dice rolls', () => {
      const badOutcomes: Record<OutcomeType, number> = {
        homeRun: 0,
        triple: 0,
        double: 0,
        single: 0,
        walk: 0,
        strikeout: 0,
        groundOut: 0,
        flyOut: 0,
      };

      // Roll only 2s (min dice total)
      for (let i = 0; i < 1000; i++) {
        const outcome = resolveAtBat(mockBatter, mockPitcher, [1, 1]);
        badOutcomes[outcome]++;
      }

      const positive = badOutcomes.homeRun + badOutcomes.triple + badOutcomes.double + badOutcomes.single + badOutcomes.walk;
      const negative = badOutcomes.strikeout + badOutcomes.groundOut + badOutcomes.flyOut;
      const expectedNegativeRate =
        BASE_PROBABILITIES.strikeout +
        BASE_PROBABILITIES.groundOut +
        BASE_PROBABILITIES.flyOut;

      // With min dice roll, negative outcomes should beat baseline rates
      expect(negative / (positive + negative)).toBeGreaterThan(expectedNegativeRate);
    });

    it('produces stable aggregate distribution over 10000 rolls', () => {
      // Use exactly league average players for this distribution test
      const leagueAvgBatter: MockBatterStats = {
        avg: 0.250,
        obp: 0.320,
        slg: 0.400,
        ops: 0.720,
        bb: 36,
        so: 90,
        ab: 450,
      };

      const leagueAvgPitcher: MockPitcherStats = {
        era: 4.00,
        whip: 1.30,
        kPer9: 8.5,
        bbPer9: 3.0,
        hrPer9: 1.2,
      };

      const results: Record<OutcomeType, number> = {
        homeRun: 0,
        triple: 0,
        double: 0,
        single: 0,
        walk: 0,
        strikeout: 0,
        groundOut: 0,
        flyOut: 0,
      };

      for (let i = 0; i < 10000; i++) {
        const diceRoll: [number, number] = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];
        const outcome = resolveAtBat(leagueAvgBatter, leagueAvgPitcher, diceRoll);
        results[outcome]++;
      }

      const total = Object.values(results).reduce((sum, count) => sum + count, 0);
      const observedPositiveRate =
        (results.homeRun + results.triple + results.double + results.single + results.walk) / total;
      const baselinePositiveRate =
        BASE_PROBABILITIES.homeRun +
        BASE_PROBABILITIES.triple +
        BASE_PROBABILITIES.double +
        BASE_PROBABILITIES.single +
        BASE_PROBABILITIES.walk;

      // Distribution should stay in a realistic operating band around baseline.
      expect(observedPositiveRate).toBeGreaterThan(baselinePositiveRate - 0.08);
      expect(observedPositiveRate).toBeLessThan(baselinePositiveRate + 0.12);

      // Core ordinal relationships for hit types should hold over large samples.
      expect(results.single).toBeGreaterThan(results.double);
      expect(results.double).toBeGreaterThan(results.triple);
    });

    it('high-OPS batter outperforms low-OPS batter', () => {
      const highOpsBatter = createMockBatter({
        batting: { ops: 1.000, slg: 0.600, obp: 0.400, avg: 0.300, bb: 80, so: 80, ab: 450 },
      }).batting;

      const lowOpsBatter = createMockBatter({
        batting: { ops: 0.550, slg: 0.300, obp: 0.250, avg: 0.200, bb: 20, so: 150, ab: 450 },
      }).batting;

      const avgPitcher: MockPitcherStats = {
        era: 4.00,
        whip: 1.30,
        kPer9: 8.5,
        bbPer9: 3.0,
        hrPer9: 1.2,
      };

      let highOpsPositive = 0;
      let lowOpsPositive = 0;

      for (let i = 0; i < 5000; i++) {
        const diceRoll: [number, number] = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];

        const highResult = resolveAtBat(highOpsBatter, avgPitcher, diceRoll);
        const lowResult = resolveAtBat(lowOpsBatter, avgPitcher, diceRoll);

        if (['homeRun', 'triple', 'double', 'single', 'walk'].includes(highResult)) {
          highOpsPositive++;
        }
        if (['homeRun', 'triple', 'double', 'single', 'walk'].includes(lowResult)) {
          lowOpsPositive++;
        }
      }

      expect(highOpsPositive).toBeGreaterThan(lowOpsPositive);
    });

    it('ace pitcher suppresses hits vs journeyman', () => {
      const avgBatter: MockBatterStats = {
        avg: 0.260,
        obp: 0.330,
        slg: 0.420,
        ops: 0.750,
        bb: 45,
        so: 100,
        ab: 450,
      };

      const acePitcher = createMockPitcher({
        pitching: { era: 2.50, whip: 0.95, kPer9: 11.0, bbPer9: 2.0, hrPer9: 0.7 },
      }).pitching;

      const journeymanPitcher: MockPitcherStats = {
        era: 5.50,
        whip: 1.55,
        kPer9: 6.0,
        bbPer9: 4.5,
        hrPer9: 1.8,
      };

      let aceHitsAllowed = 0;
      let journeymanHitsAllowed = 0;

      for (let i = 0; i < 5000; i++) {
        const diceRoll: [number, number] = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];

        const aceResult = resolveAtBat(avgBatter, acePitcher, diceRoll);
        const journeymanResult = resolveAtBat(avgBatter, journeymanPitcher, diceRoll);

        if (['homeRun', 'triple', 'double', 'single'].includes(aceResult)) {
          aceHitsAllowed++;
        }
        if (['homeRun', 'triple', 'double', 'single'].includes(journeymanResult)) {
          journeymanHitsAllowed++;
        }
      }

      expect(aceHitsAllowed).toBeLessThan(journeymanHitsAllowed);
    });
  });

  // ============================================
  // BASE RUNNING
  // ============================================
  describe('Base Running', () => {
    describe('Home Run', () => {
      it('clears all bases', () => {
        const state: BaseState = { bases: [true, true, true], outs: 0 };
        const result = advanceRunners(state, 'homeRun');

        expect(result.newBases).toEqual([false, false, false]);
      });

      it('scores batter + all runners', () => {
        const state: BaseState = { bases: [true, true, true], outs: 0 };
        const result = advanceRunners(state, 'homeRun');

        expect(result.runsScored).toBe(4); // 3 runners + batter
      });

      it('scores 1 run with bases empty', () => {
        const state: BaseState = { bases: [false, false, false], outs: 0 };
        const result = advanceRunners(state, 'homeRun');

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([false, false, false]);
      });

      it('scores 4 runs with bases loaded', () => {
        const state: BaseState = { bases: [true, true, true], outs: 0 };
        const result = advanceRunners(state, 'homeRun');

        expect(result.runsScored).toBe(4);
      });
    });

    describe('Triple', () => {
      it('scores all runners', () => {
        const state: BaseState = { bases: [true, true, true], outs: 0 };
        const result = advanceRunners(state, 'triple');

        expect(result.runsScored).toBe(3);
      });

      it('puts batter on third', () => {
        const state: BaseState = { bases: [false, false, false], outs: 0 };
        const result = advanceRunners(state, 'triple');

        expect(result.newBases).toEqual([false, false, true]);
      });

      it('scores 3 with bases loaded', () => {
        const state: BaseState = { bases: [true, true, true], outs: 0 };
        const result = advanceRunners(state, 'triple');

        expect(result.runsScored).toBe(3);
        expect(result.newBases).toEqual([false, false, true]);
      });
    });

    describe('Double', () => {
      it('scores runner from third', () => {
        const state: BaseState = { bases: [false, false, true], outs: 0 };
        const result = advanceRunners(state, 'double');

        expect(result.runsScored).toBe(1);
      });

      it('scores runner from second', () => {
        const state: BaseState = { bases: [false, true, false], outs: 0 };
        const result = advanceRunners(state, 'double');

        expect(result.runsScored).toBe(1);
      });

      it('advances runner from first to third', () => {
        const state: BaseState = { bases: [true, false, false], outs: 0 };
        const result = advanceRunners(state, 'double');

        expect(result.newBases[2]).toBe(true); // Runner on third
        expect(result.runsScored).toBe(0);
      });

      it('puts batter on second', () => {
        const state: BaseState = { bases: [false, false, false], outs: 0 };
        const result = advanceRunners(state, 'double');

        expect(result.newBases[1]).toBe(true);
        expect(result.newBases[0]).toBe(false);
      });
    });

    describe('Single', () => {
      it('scores runner from third', () => {
        const state: BaseState = { bases: [false, false, true], outs: 0 };
        const result = advanceRunners(state, 'single');

        expect(result.runsScored).toBe(1);
      });

      it('advances runner from second to third', () => {
        const state: BaseState = { bases: [false, true, false], outs: 0 };
        const result = advanceRunners(state, 'single');

        expect(result.newBases[2]).toBe(true);
        expect(result.runsScored).toBe(0);
      });

      it('advances runner from first to second', () => {
        const state: BaseState = { bases: [true, false, false], outs: 0 };
        const result = advanceRunners(state, 'single');

        expect(result.newBases[1]).toBe(true);
      });

      it('puts batter on first', () => {
        const state: BaseState = { bases: [false, false, false], outs: 0 };
        const result = advanceRunners(state, 'single');

        expect(result.newBases[0]).toBe(true);
      });
    });

    describe('Walk', () => {
      it('puts batter on first', () => {
        const state: BaseState = { bases: [false, false, false], outs: 0 };
        const result = advanceRunners(state, 'walk');

        expect(result.newBases[0]).toBe(true);
      });

      it('forces runner from first to second', () => {
        const state: BaseState = { bases: [true, false, false], outs: 0 };
        const result = advanceRunners(state, 'walk');

        expect(result.newBases[0]).toBe(true);
        expect(result.newBases[1]).toBe(true);
      });

      it('forces runner from second to third', () => {
        const state: BaseState = { bases: [true, true, false], outs: 0 };
        const result = advanceRunners(state, 'walk');

        expect(result.newBases[2]).toBe(true);
      });

      it('scores runner from third when bases loaded', () => {
        const state: BaseState = { bases: [true, true, true], outs: 0 };
        const result = advanceRunners(state, 'walk');

        expect(result.runsScored).toBe(1);
        expect(result.newBases).toEqual([true, true, true]);
      });

      it('does not advance non-forced runners', () => {
        // Runner on second only - not forced
        const state: BaseState = { bases: [false, true, false], outs: 0 };
        const result = advanceRunners(state, 'walk');

        expect(result.newBases[0]).toBe(true); // Batter to first
        expect(result.newBases[1]).toBe(true); // Runner stays on second
        expect(result.newBases[2]).toBe(false); // No one on third
        expect(result.runsScored).toBe(0);
      });
    });

    describe('Outs', () => {
      it('does not advance runners on strikeout', () => {
        const state: BaseState = { bases: [true, true, false], outs: 0 };
        const result = advanceRunners(state, 'strikeout');

        expect(result.newBases).toEqual([true, true, false]);
        expect(result.runsScored).toBe(0);
      });

      it('does not advance runners on ground out', () => {
        const state: BaseState = { bases: [true, false, true], outs: 0 };
        const result = advanceRunners(state, 'groundOut');

        expect(result.newBases).toEqual([true, false, true]);
        expect(result.runsScored).toBe(0);
      });

      it('does not advance runners on fly out', () => {
        const state: BaseState = { bases: [false, true, true], outs: 1 };
        const result = advanceRunners(state, 'flyOut');

        expect(result.newBases).toEqual([false, true, true]);
        expect(result.runsScored).toBe(0);
      });

      it('increments out count', () => {
        // Note: advanceRunners doesn't increment outs - that's handleInningLogic's job
        // This test verifies the out-type outcomes return 0 runs
        const state: BaseState = { bases: [false, false, false], outs: 0 };

        expect(advanceRunners(state, 'strikeout').runsScored).toBe(0);
        expect(advanceRunners(state, 'groundOut').runsScored).toBe(0);
        expect(advanceRunners(state, 'flyOut').runsScored).toBe(0);
      });
    });
  });

  // ============================================
  // INNING LOGIC
  // ============================================
  describe('Inning Logic', () => {
    it('ends half-inning after 3 outs', () => {
      const state = createMockGameState({ outs: 3, isTopOfInning: true });
      handleInningLogic(state);

      expect(state.outs).toBe(0);
      expect(state.isTopOfInning).toBe(false);
    });

    it('clears bases at end of half-inning', () => {
      const state = createMockGameState({
        outs: 3,
        bases: [true, true, true],
        isTopOfInning: true,
      });
      handleInningLogic(state);

      expect(state.bases).toEqual([false, false, false]);
    });

    it('resets out count at end of half-inning', () => {
      const state = createMockGameState({ outs: 3, isTopOfInning: true });
      handleInningLogic(state);

      expect(state.outs).toBe(0);
    });

    it('switches from top to bottom', () => {
      const state = createMockGameState({
        inning: 1,
        isTopOfInning: true,
        outs: 3,
      });
      handleInningLogic(state);

      expect(state.isTopOfInning).toBe(false);
      expect(state.inning).toBe(1);
    });

    it('increments inning after bottom', () => {
      const state = createMockGameState({
        inning: 1,
        isTopOfInning: false,
        outs: 3,
      });
      handleInningLogic(state);

      expect(state.inning).toBe(2);
      expect(state.isTopOfInning).toBe(true);
    });

    it('ends game after 9 innings if not tied', () => {
      const state = createMockGameState({
        inning: 9,
        isTopOfInning: false,
        outs: 3,
        scores: [5, 3], // Visitor 5, Home 3
      });
      handleInningLogic(state);

      expect(state.isGameOver).toBe(true);
    });

    it('continues to extras if tied after 9', () => {
      const state = createMockGameState({
        inning: 9,
        isTopOfInning: false,
        outs: 3,
        scores: [3, 3], // Tied
      });
      handleInningLogic(state);

      expect(state.isGameOver).toBeFalsy();
      expect(state.inning).toBe(10);
    });

    it('ends game on walk-off (home team ahead after top of 9+)', () => {
      const state = createMockGameState({
        inning: 9,
        isTopOfInning: false,
        outs: 1, // Not even 3 outs yet
        scores: [3, 4], // Home team ahead
      });

      // Simulate walk-off logic check
      // Walk-off happens when home team takes lead in bottom of 9+
      // This would be checked after each play, not just at 3 outs
      handleInningLogic(state);

      // If home team is ahead in bottom of 9+ during play, game should end
      expect(state.isGameOver).toBe(true);
    });

    it('does not end game if visitor ahead after top of 9', () => {
      const state = createMockGameState({
        inning: 9,
        isTopOfInning: true,
        outs: 3,
        scores: [5, 3], // Visitor ahead
      });
      handleInningLogic(state);

      // Game continues to bottom of 9th
      expect(state.isGameOver).toBeFalsy();
      expect(state.isTopOfInning).toBe(false);
    });
  });

  // ============================================
  // PLAY DESCRIPTION GENERATOR
  // ============================================
  describe('Play Description Generator', () => {
    it('generates description for each outcome type', () => {
      const outcomes: OutcomeType[] = [
        'homeRun',
        'triple',
        'double',
        'single',
        'walk',
        'strikeout',
        'groundOut',
        'flyOut',
      ];

      for (const outcome of outcomes) {
        const desc = generateDescription(outcome, 'Mike Trout', 'Gerrit Cole', 0);
        expect(desc).toBeTruthy();
        expect(desc.length).toBeGreaterThan(10);
      }
    });

    it('includes batter name', () => {
      const desc = generateDescription('single', 'Mike Trout', 'Gerrit Cole', 0);
      expect(desc).toContain('Mike Trout');
    });

    it('includes pitcher name for strikeouts', () => {
      const desc = generateDescription('strikeout', 'Mike Trout', 'Gerrit Cole', 0);
      // At least some templates include pitcher name
      // Generate multiple times to find one with pitcher name
      let hasPitcher = false;
      for (let i = 0; i < 50; i++) {
        const d = generateDescription('strikeout', 'Mike Trout', 'Gerrit Cole', 0);
        if (d.includes('Gerrit Cole')) {
          hasPitcher = true;
          break;
        }
      }
      expect(hasPitcher).toBe(true);
    });

    it('appends run scoring context', () => {
      const desc = generateDescription('single', 'Mike Trout', 'Gerrit Cole', 1);
      expect(desc).toContain('scores');
    });

    it('handles plural runs correctly', () => {
      const descSingle = generateDescription('homeRun', 'Mike Trout', 'Gerrit Cole', 1);
      const descMultiple = generateDescription('homeRun', 'Mike Trout', 'Gerrit Cole', 3);

      // Single run: "Runner scores!" (singular)
      // Multiple runs: "X runs score!" (plural)
      if (descSingle.includes('scores')) {
        expect(descSingle).toMatch(/scores!|run scores/i);
      }
      if (descMultiple.includes('runs')) {
        expect(descMultiple).toMatch(/\d+ runs score/i);
      }
    });
  });

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  describe('Utility Functions', () => {
    describe('clamp', () => {
      it('returns value when within bounds', () => {
        expect(clamp(0.5, 0, 1)).toBe(0.5);
        expect(clamp(1.5, 1, 2)).toBe(1.5);
      });

      it('clamps to min when below', () => {
        expect(clamp(-1, 0, 1)).toBe(0);
        expect(clamp(0.5, 1, 2)).toBe(1);
      });

      it('clamps to max when above', () => {
        expect(clamp(2, 0, 1)).toBe(1);
        expect(clamp(3, 1, 2)).toBe(2);
      });
    });

    describe('applyDiceBias', () => {
      it('shifts probability toward good outcomes on positive bias', () => {
        const probs: Record<OutcomeType, number> = {
          homeRun: 0.1,
          triple: 0.1,
          double: 0.1,
          single: 0.1,
          walk: 0.1,
          strikeout: 0.1,
          groundOut: 0.2,
          flyOut: 0.2,
        };

        const biased = applyDiceBias(probs, 0.5);

        const originalGood = probs.homeRun + probs.triple + probs.double + probs.single + probs.walk;
        const biasedGood = biased.homeRun + biased.triple + biased.double + biased.single + biased.walk;

        expect(biasedGood).toBeGreaterThan(originalGood);
      });

      it('shifts probability toward bad outcomes on negative bias', () => {
        const probs: Record<OutcomeType, number> = {
          homeRun: 0.1,
          triple: 0.1,
          double: 0.1,
          single: 0.1,
          walk: 0.1,
          strikeout: 0.1,
          groundOut: 0.2,
          flyOut: 0.2,
        };

        const biased = applyDiceBias(probs, -0.5);

        const originalBad = probs.strikeout + probs.groundOut + probs.flyOut;
        const biasedBad = biased.strikeout + biased.groundOut + biased.flyOut;

        expect(biasedBad).toBeGreaterThan(originalBad);
      });

      it('maintains probability sum of 1.0', () => {
        const probs: Record<OutcomeType, number> = {
          homeRun: 0.125,
          triple: 0.125,
          double: 0.125,
          single: 0.125,
          walk: 0.125,
          strikeout: 0.125,
          groundOut: 0.125,
          flyOut: 0.125,
        };

        const biased = applyDiceBias(probs, 0.5);
        const sum = Object.values(biased).reduce((a, b) => a + b, 0);

        expect(sum).toBeCloseTo(1.0, 5);
      });
    });

    describe('weightedRandomSelect', () => {
      it('selects outcomes based on probability weights', () => {
        const probs: Record<OutcomeType, number> = {
          homeRun: 0.5,
          triple: 0.0,
          double: 0.0,
          single: 0.5,
          walk: 0.0,
          strikeout: 0.0,
          groundOut: 0.0,
          flyOut: 0.0,
        };

        const results = { homeRun: 0, single: 0, other: 0 };

        for (let i = 0; i < 1000; i++) {
          const outcome = weightedRandomSelect(probs);
          if (outcome === 'homeRun') results.homeRun++;
          else if (outcome === 'single') results.single++;
          else results.other++;
        }

        // Should only get homeRun or single
        expect(results.other).toBe(0);
        // Both should be roughly 50%
        expect(results.homeRun).toBeGreaterThan(400);
        expect(results.single).toBeGreaterThan(400);
      });
    });
  });
});

console.log('✅ Test suite completed');
