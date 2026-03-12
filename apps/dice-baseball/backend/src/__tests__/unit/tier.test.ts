/**
 * Tier Tests - Dice Baseball V2
 *
 * Tests for tier definitions, tier-aware game engine, and tier-aware roster validation.
 */

import { describe, it, expect } from 'vitest';

import {
  TIER_PROFILES,
  VALID_TIERS,
  isValidTier,
  getTierProfile,
  type GameTier,
  type TierProfile,
} from '../../../contracts/tier.js';

import {
  resolveAtBat,
  calculateFatigueModifier,
  type BatterStats,
  type PitcherStats,
  type GameContext,
} from '../../services/game-engine.js';

import { validateRosterForTier } from '../../services/roster-validation.js';

// ============================================
// FIXTURES
// ============================================

const averageBatter: BatterStats = {
  avg: 0.260,
  obp: 0.330,
  slg: 0.420,
  ops: 0.750,
  bb: 55,
  so: 120,
  ab: 500,
};

const averagePitcher: PitcherStats = {
  era: 4.0,
  whip: 1.3,
  kPer9: 8.5,
  bbPer9: 3.0,
  hrPer9: 1.2,
};

const VALID_10_PLAYER_ROSTER = [
  { position: 'C', mlbPlayerId: 518735, battingOrder: 9 },
  { position: '1B', mlbPlayerId: 518692, battingOrder: 4 },
  { position: '2B', mlbPlayerId: 543760, battingOrder: 8 },
  { position: '3B', mlbPlayerId: 571448, battingOrder: 5 },
  { position: 'SS', mlbPlayerId: 596115, battingOrder: 1 },
  { position: 'LF', mlbPlayerId: 665742, battingOrder: 7 },
  { position: 'CF', mlbPlayerId: 545361, battingOrder: 2 },
  { position: 'RF', mlbPlayerId: 605141, battingOrder: 6 },
  { position: 'DH', mlbPlayerId: 660271, battingOrder: 3 },
  { position: 'SP', mlbPlayerId: 543037, battingOrder: null },
];

// ============================================
// TIER PROFILE DEFINITIONS
// ============================================

describe('Tier Profiles', () => {
  it('defines exactly three tiers', () => {
    expect(VALID_TIERS).toHaveLength(3);
    expect(VALID_TIERS).toEqual(['arcade', 'teamBuilder', 'manager']);
  });

  it('has a profile for each valid tier', () => {
    for (const tier of VALID_TIERS) {
      expect(TIER_PROFILES[tier]).toBeDefined();
      expect(TIER_PROFILES[tier].tier).toBe(tier);
    }
  });

  describe('Arcade profile', () => {
    const profile = TIER_PROFILES.arcade;

    it('uses preset teams with no salary cap', () => {
      expect(profile.teamSource).toBe('preset');
      expect(profile.salaryCap).toBeNull();
    });

    it('has 10-player roster', () => {
      expect(profile.rosterSize).toBe(10);
    });

    it('disables all in-game decisions', () => {
      expect(profile.allowBattingOrderEdit).toBe(false);
      expect(profile.allowPinchHitters).toBe(false);
      expect(profile.allowPitchingChanges).toBe(false);
      expect(profile.allowDefensiveSubstitutions).toBe(false);
    });

    it('disables all engine modifiers', () => {
      expect(profile.enablePitcherFatigue).toBe(false);
      expect(profile.enablePlatoonSplits).toBe(false);
      expect(profile.enableSituationalModifiers).toBe(false);
    });

    it('disables wagers', () => {
      expect(profile.allowWagers).toBe(false);
    });
  });

  describe('Team Builder profile', () => {
    const profile = TIER_PROFILES.teamBuilder;

    it('uses custom teams with $250M salary cap', () => {
      expect(profile.teamSource).toBe('custom');
      expect(profile.salaryCap).toBe(250_000_000);
    });

    it('has 10-player roster', () => {
      expect(profile.rosterSize).toBe(10);
    });

    it('allows batting order and limited pinch hitters', () => {
      expect(profile.allowBattingOrderEdit).toBe(true);
      expect(profile.allowPinchHitters).toBe(true);
      expect(profile.pinchHitLimit).toBe(3);
    });

    it('disables pitching and defensive changes', () => {
      expect(profile.allowPitchingChanges).toBe(false);
      expect(profile.allowDefensiveSubstitutions).toBe(false);
    });

    it('disables engine modifiers', () => {
      expect(profile.enablePitcherFatigue).toBe(false);
      expect(profile.enablePlatoonSplits).toBe(false);
      expect(profile.enableSituationalModifiers).toBe(false);
    });

    it('disables wagers', () => {
      expect(profile.allowWagers).toBe(false);
    });
  });

  describe('Manager profile', () => {
    const profile = TIER_PROFILES.manager;

    it('uses custom teams with $180M salary cap', () => {
      expect(profile.teamSource).toBe('custom');
      expect(profile.salaryCap).toBe(180_000_000);
    });

    it('has 25-player roster', () => {
      expect(profile.rosterSize).toBe(25);
    });

    it('enables all in-game decisions', () => {
      expect(profile.allowBattingOrderEdit).toBe(true);
      expect(profile.allowPinchHitters).toBe(true);
      expect(profile.pinchHitLimit).toBeNull(); // unlimited
      expect(profile.allowPitchingChanges).toBe(true);
      expect(profile.allowDefensiveSubstitutions).toBe(true);
    });

    it('enables all engine modifiers', () => {
      expect(profile.enablePitcherFatigue).toBe(true);
      expect(profile.enablePlatoonSplits).toBe(true);
      expect(profile.enableSituationalModifiers).toBe(true);
    });

    it('enables wagers', () => {
      expect(profile.allowWagers).toBe(true);
    });
  });
});

// ============================================
// TIER VALIDATION HELPERS
// ============================================

describe('isValidTier', () => {
  it('returns true for valid tiers', () => {
    expect(isValidTier('arcade')).toBe(true);
    expect(isValidTier('teamBuilder')).toBe(true);
    expect(isValidTier('manager')).toBe(true);
  });

  it('returns false for invalid tiers', () => {
    expect(isValidTier('invalid')).toBe(false);
    expect(isValidTier('')).toBe(false);
    expect(isValidTier('ARCADE')).toBe(false);
  });
});

describe('getTierProfile', () => {
  it('returns correct profile for each tier', () => {
    expect(getTierProfile('arcade')).toEqual(TIER_PROFILES.arcade);
    expect(getTierProfile('teamBuilder')).toEqual(TIER_PROFILES.teamBuilder);
    expect(getTierProfile('manager')).toEqual(TIER_PROFILES.manager);
  });
});

// ============================================
// TIER-AWARE GAME ENGINE
// ============================================

describe('Tier-aware resolveAtBat', () => {
  it('produces valid outcome without rules (backward compat)', () => {
    const outcome = resolveAtBat(averageBatter, averagePitcher, [3, 4], 0.5);
    expect([
      'homeRun', 'triple', 'double', 'single',
      'walk', 'strikeout', 'groundOut', 'flyOut',
    ]).toContain(outcome);
  });

  it('produces valid outcome with arcade rules (no modifiers enabled)', () => {
    const outcome = resolveAtBat(
      averageBatter,
      averagePitcher,
      [3, 4],
      0.5,
      TIER_PROFILES.arcade,
      { pitcherAtBatCount: 10, outs: 1, runners: [false, false, false] }
    );
    expect([
      'homeRun', 'triple', 'double', 'single',
      'walk', 'strikeout', 'groundOut', 'flyOut',
    ]).toContain(outcome);
  });

  it('produces identical results with and without arcade rules for same inputs', () => {
    // Arcade rules disable all modifiers, so result should be identical to no-rules call
    const seed = 0.42;
    const dice: [number, number] = [4, 5];
    const withoutRules = resolveAtBat(averageBatter, averagePitcher, dice, seed);
    const withArcadeRules = resolveAtBat(
      averageBatter,
      averagePitcher,
      dice,
      seed,
      TIER_PROFILES.arcade,
      { pitcherAtBatCount: 10, outs: 0, runners: [false, false, false] }
    );
    expect(withArcadeRules).toBe(withoutRules);
  });

  it('accepts manager rules with all modifiers enabled', () => {
    const context: GameContext = {
      pitcherAtBatCount: 30,
      batterHandedness: 'R',
      pitcherHandedness: 'L',
      outs: 2,
      runners: [true, true, false],
    };

    const outcome = resolveAtBat(
      averageBatter,
      averagePitcher,
      [6, 5],
      0.3,
      TIER_PROFILES.manager,
      context
    );
    expect([
      'homeRun', 'triple', 'double', 'single',
      'walk', 'strikeout', 'groundOut', 'flyOut',
    ]).toContain(outcome);
  });
});

// ============================================
// FATIGUE MODIFIER (STUB)
// ============================================

describe('calculateFatigueModifier', () => {
  it('returns 1.0 (stub) for any pitch count', () => {
    expect(calculateFatigueModifier(0)).toBe(1.0);
    expect(calculateFatigueModifier(15)).toBe(1.0);
    expect(calculateFatigueModifier(50)).toBe(1.0);
    expect(calculateFatigueModifier(100)).toBe(1.0);
  });
});

// ============================================
// TIER-AWARE ROSTER VALIDATION
// ============================================

describe('validateRosterForTier', () => {
  it('accepts valid 10-player roster for arcade tier', () => {
    const result = validateRosterForTier(VALID_10_PLAYER_ROSTER, TIER_PROFILES.arcade);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid 10-player roster for teamBuilder tier', () => {
    const result = validateRosterForTier(VALID_10_PLAYER_ROSTER, TIER_PROFILES.teamBuilder);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects 10-player roster for manager tier (needs 25)', () => {
    const result = validateRosterForTier(VALID_10_PLAYER_ROSTER, TIER_PROFILES.manager);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('25');
  });

  it('rejects empty roster for any tier', () => {
    const result = validateRosterForTier([], TIER_PROFILES.arcade);
    expect(result.valid).toBe(false);
  });
});

// ============================================
// TIER INTEGRATION WITH GAME CREATION
// ============================================

describe('Game creation with tier (route-level)', () => {
  // These tests verify the route accepts tier parameter.
  // The actual route integration tests are in game-routes.test.ts.
  // Here we verify tier data integrity.

  it('all tier profiles have consistent tier field', () => {
    const tiers: GameTier[] = ['arcade', 'teamBuilder', 'manager'];
    for (const tier of tiers) {
      const profile = TIER_PROFILES[tier];
      expect(profile.tier).toBe(tier);
    }
  });

  it('manager mode has strictly lower salary cap than teamBuilder', () => {
    expect(TIER_PROFILES.manager.salaryCap).not.toBeNull();
    expect(TIER_PROFILES.teamBuilder.salaryCap).not.toBeNull();
    expect(TIER_PROFILES.manager.salaryCap!).toBeLessThan(TIER_PROFILES.teamBuilder.salaryCap!);
  });

  it('manager mode has larger roster than arcade and teamBuilder', () => {
    expect(TIER_PROFILES.manager.rosterSize).toBeGreaterThan(TIER_PROFILES.arcade.rosterSize);
    expect(TIER_PROFILES.manager.rosterSize).toBeGreaterThan(TIER_PROFILES.teamBuilder.rosterSize);
  });
});
