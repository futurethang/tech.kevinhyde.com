/**
 * Tier Definitions - Dice Baseball V2
 *
 * Defines the three play tiers: Arcade, Team Builder, Manager Mode.
 * This is the single source of truth for what each tier enables.
 *
 * IMPORTANT: Check rules.allowX, never tier === 'manager'.
 * See docs/TIER-ARCHITECTURE.md for patterns and rationale.
 */

export type GameTier = 'arcade' | 'teamBuilder' | 'manager';

export interface TierProfile {
  tier: GameTier;

  // Team building
  teamSource: 'preset' | 'custom';
  salaryCap: number | null;           // null = no cap (arcade)
  rosterSize: number;                  // 10 (arcade/builder) or 25 (manager)
  allowBattingOrderEdit: boolean;

  // In-game decisions
  allowPinchHitters: boolean;
  pinchHitLimit: number | null;        // null = unlimited (manager)
  allowPitchingChanges: boolean;
  allowDefensiveSubstitutions: boolean;

  // Engine modifiers
  enablePitcherFatigue: boolean;
  enablePlatoonSplits: boolean;
  enableSituationalModifiers: boolean;

  // Social
  allowWagers: boolean;
}

export const TIER_PROFILES: Record<GameTier, TierProfile> = {
  arcade: {
    tier: 'arcade',
    teamSource: 'preset',
    salaryCap: null,
    rosterSize: 10,
    allowBattingOrderEdit: false,
    allowPinchHitters: false,
    pinchHitLimit: null,
    allowPitchingChanges: false,
    allowDefensiveSubstitutions: false,
    enablePitcherFatigue: false,
    enablePlatoonSplits: false,
    enableSituationalModifiers: false,
    allowWagers: false,
  },
  teamBuilder: {
    tier: 'teamBuilder',
    teamSource: 'custom',
    salaryCap: 250_000_000,
    rosterSize: 10,
    allowBattingOrderEdit: true,
    allowPinchHitters: true,
    pinchHitLimit: 3,
    allowPitchingChanges: false,
    allowDefensiveSubstitutions: false,
    enablePitcherFatigue: false,
    enablePlatoonSplits: false,
    enableSituationalModifiers: false,
    allowWagers: false,
  },
  manager: {
    tier: 'manager',
    teamSource: 'custom',
    salaryCap: 180_000_000,
    rosterSize: 25,
    allowBattingOrderEdit: true,
    allowPinchHitters: true,
    pinchHitLimit: null,
    allowPitchingChanges: true,
    allowDefensiveSubstitutions: true,
    enablePitcherFatigue: true,
    enablePlatoonSplits: true,
    enableSituationalModifiers: true,
    allowWagers: true,
  },
};

export const VALID_TIERS: GameTier[] = ['arcade', 'teamBuilder', 'manager'];

export function isValidTier(value: string): value is GameTier {
  return VALID_TIERS.includes(value as GameTier);
}

export function getTierProfile(tier: GameTier): TierProfile {
  return TIER_PROFILES[tier];
}
