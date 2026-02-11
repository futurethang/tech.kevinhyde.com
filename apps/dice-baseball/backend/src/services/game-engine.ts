/**
 * Game Engine Service - Dice Baseball V2
 * Stats-weighted outcome calculations for at-bats
 *
 * Phase 4: TDD Implementation
 */

// ============================================
// TYPES
// ============================================

export type OutcomeType =
  | 'homeRun'
  | 'triple'
  | 'double'
  | 'single'
  | 'walk'
  | 'strikeout'
  | 'groundOut'
  | 'flyOut';

export interface BatterStats {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  bb: number; // walks
  so: number; // strikeouts
  ab: number; // at bats
}

export interface PitcherStats {
  era: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
}

export interface BaseState {
  bases: [boolean, boolean, boolean]; // [1st, 2nd, 3rd]
  outs: number;
}

export interface GameState {
  inning: number;
  isTopOfInning: boolean;
  outs: number;
  scores: [number, number]; // [visitor, home]
  bases: [boolean, boolean, boolean];
  currentBatterIndex: number;
  isGameOver?: boolean;
  winner?: string;
}

export interface PlayResult {
  diceRolls: [number, number];
  outcome: OutcomeType;
  batter: { mlbId: number; name: string };
  pitcher: { mlbId: number; name: string };
  description: string;
  runsScored: number;
  outsRecorded: number;
  newBases: [boolean, boolean, boolean];
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Base probabilities derived from 2d6 dice distribution
 */
export const BASE_PROBABILITIES: Record<OutcomeType, number> = {
  homeRun: 0.028, // ~2.8% (more realistic)
  triple: 0.005, // ~0.5% (triples are very rare)
  double: 0.046, // 4.6% (doubles are less common)
  single: 0.150, // 15% (singles most common hit)
  walk: 0.083, // 8.3% (walks unchanged)
  strikeout: 0.217, // 21.7% (modern game has more Ks)
  groundOut: 0.278, // 27.8% (ground outs common)
  flyOut: 0.193, // 19.3% (fly outs common)
};

/**
 * League average constants (approximate 2024 values)
 */
export const LEAGUE_AVG = {
  ops: 0.720,
  slg: 0.400,
  obp: 0.320,
  era: 4.0,
  whip: 1.3,
  kPer9: 8.5,
  bbPer9: 3.0,
  hrPer9: 1.2,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Weighted random selection from probability distribution
 */
export function weightedRandomSelect(probs: Record<OutcomeType, number>): OutcomeType {
  const rand = Math.random();
  let cumulative = 0;

  for (const [outcome, prob] of Object.entries(probs)) {
    cumulative += prob;
    if (rand < cumulative) {
      return outcome as OutcomeType;
    }
  }

  // Fallback (shouldn't reach here)
  return 'groundOut';
}

// ============================================
// MODIFIER CALCULATIONS
// ============================================

/**
 * Calculate batter modifiers based on stats
 * Returns modifiers where 1.0 = league average
 * >1.0 = better than average (more hits, walks)
 * <1.0 = worse than average (fewer hits, walks)
 */
export function calculateBatterModifiers(stats: BatterStats): Record<OutcomeType, number> {
  // Handle edge case: zero at-bats
  const ab = stats.ab || 1;
  const ops = stats.ops || LEAGUE_AVG.ops;
  const slg = stats.slg || LEAGUE_AVG.slg;

  // OPS-based overall hitting ability (1.0 = league average)
  const hitModifier = ops / LEAGUE_AVG.ops;

  // Power for extra-base hits (1.0 = league average)
  const powerModifier = slg / LEAGUE_AVG.slg;

  // Plate discipline
  const walkRate = stats.bb / ab || 0.08;
  const strikeoutRate = stats.so / ab || 0.2;

  // Avoid division by zero - normalized to league average rates
  const normalizedWalkRate = walkRate / 0.08 || 1;
  const normalizedKRate = strikeoutRate / 0.2 || 1;
  const disciplineModifier = normalizedKRate > 0 ? normalizedWalkRate / normalizedKRate : 1;

  return {
    // For league average (hitModifier = 1.0), single should be ~1.0
    single: clamp(hitModifier, 0.5, 1.5),
    double: clamp(hitModifier * powerModifier, 0.4, 1.8),
    triple: clamp(powerModifier, 0.3, 2.0),
    homeRun: clamp(powerModifier * 1.2, 0.3, 2.5),
    walk: clamp(disciplineModifier, 0.5, 2.0),
    strikeout: clamp(1 / (disciplineModifier || 1), 0.5, 2.0),
    groundOut: 1.0,
    flyOut: clamp(powerModifier, 0.7, 1.3),
  };
}

/**
 * Calculate pitcher modifiers based on stats
 */
export function calculatePitcherModifiers(stats: PitcherStats): Record<OutcomeType, number> {
  // Handle edge cases: zero/missing stats
  const whip = stats.whip || LEAGUE_AVG.whip;
  const kPer9 = stats.kPer9 || LEAGUE_AVG.kPer9;
  const bbPer9 = stats.bbPer9 || LEAGUE_AVG.bbPer9;
  const hrPer9 = stats.hrPer9 || LEAGUE_AVG.hrPer9;

  // ERA-based overall effectiveness could be reintroduced as a suppression factor.
  // For now, WHIP/K/BB/HR are the active pitcher controls.

  // WHIP affects hits allowed (lower WHIP = fewer hits)
  const clampedWhip = Math.max(whip, 0.8);
  const whipModifier = LEAGUE_AVG.whip / clampedWhip;

  // Strikeout ability
  const kModifier = kPer9 / LEAGUE_AVG.kPer9;

  // Walk tendency
  const bbModifier = bbPer9 / LEAGUE_AVG.bbPer9;

  // Home run tendency
  const hrModifier = hrPer9 / LEAGUE_AVG.hrPer9;

  return {
    single: clamp(1 / whipModifier, 0.5, 1.5),
    double: clamp(1 / (whipModifier * 0.9), 0.5, 1.5),
    triple: clamp(1 / (whipModifier * 0.8), 0.5, 1.5),
    homeRun: clamp(hrModifier, 0.4, 2.0),
    walk: clamp(bbModifier, 0.5, 1.8),
    strikeout: clamp(kModifier, 0.6, 1.8),
    groundOut: 1.0,
    flyOut: 1.0,
  };
}

// ============================================
// DICE BIAS
// ============================================

/**
 * Apply bias based on dice roll (high rolls favor good outcomes)
 */
export function applyDiceBias(
  probs: Record<OutcomeType, number>,
  bias: number
): Record<OutcomeType, number> {
  const result = { ...probs };
  const goodOutcomes: OutcomeType[] = ['homeRun', 'triple', 'double', 'single', 'walk'];
  const badOutcomes: OutcomeType[] = ['strikeout', 'groundOut', 'flyOut'];

  // Calculate how much to shift (max 5% shift for more balanced gameplay)
  const shiftAmount = Math.abs(bias) * 0.05;

  if (bias > 0) {
    // High roll: boost good outcomes
    const goodTotal = goodOutcomes.reduce((sum, o) => sum + result[o], 0);
    const badTotal = badOutcomes.reduce((sum, o) => sum + result[o], 0);

    if (goodTotal > 0 && badTotal > 0) {
      for (const o of goodOutcomes) {
        result[o] += (result[o] / goodTotal) * shiftAmount * badTotal;
      }
      for (const o of badOutcomes) {
        result[o] -= (result[o] / badTotal) * shiftAmount * badTotal;
      }
    }
  } else if (bias < 0) {
    // Low roll: boost bad outcomes
    const goodTotal = goodOutcomes.reduce((sum, o) => sum + result[o], 0);
    const badTotal = badOutcomes.reduce((sum, o) => sum + result[o], 0);

    if (goodTotal > 0 && badTotal > 0) {
      for (const o of badOutcomes) {
        result[o] += (result[o] / badTotal) * shiftAmount * goodTotal;
      }
      for (const o of goodOutcomes) {
        result[o] -= (result[o] / goodTotal) * shiftAmount * goodTotal;
      }
    }
  }

  // Ensure no negative probabilities
  for (const key of Object.keys(result) as OutcomeType[]) {
    result[key] = Math.max(0.01, result[key]);
  }

  // Renormalize to sum to 1.0
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(result) as OutcomeType[]) {
    result[key] /= total;
  }

  return result;
}

// ============================================
// OUTCOME RESOLUTION
// ============================================

/**
 * Resolve an at-bat outcome based on batter/pitcher stats and dice roll
 *
 * Modifier interpretation:
 * - batterMods > 1.0 = good batter (increases positive outcomes)
 * - pitcherMods < 1.0 = good pitcher (decreases positive outcomes for batter)
 */
export function resolveAtBat(
  batter: BatterStats,
  pitcher: PitcherStats,
  diceRoll: [number, number]
): OutcomeType {
  // Calculate modified probabilities
  const batterMods = calculateBatterModifiers(batter);
  const pitcherMods = calculatePitcherModifiers(pitcher);

  const adjusted: Record<OutcomeType, number> = {} as Record<OutcomeType, number>;
  const positiveOutcomes: OutcomeType[] = ['single', 'double', 'triple', 'homeRun', 'walk'];

  for (const outcome of Object.keys(BASE_PROBABILITIES) as OutcomeType[]) {
    const base = BASE_PROBABILITIES[outcome];

    if (positiveOutcomes.includes(outcome)) {
      // Good outcomes: batter helps (>1), good pitcher suppresses (<1)
      // Good pitcher with pitcherMods < 1 reduces probability
      adjusted[outcome] = base * batterMods[outcome] * pitcherMods[outcome];
    } else {
      // Bad outcomes: good batter reduces, good pitcher increases
      // For strikeouts, pitcherMods.strikeout > 1 for high-K pitchers
      adjusted[outcome] = base * (1 / batterMods[outcome]) * pitcherMods[outcome];
    }
  }

  // Normalize to sum to 1.0
  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(adjusted) as OutcomeType[]) {
    adjusted[key] /= total;
  }

  // Use dice roll to bias the selection
  // Higher dice totals favor better outcomes
  const diceTotal = diceRoll[0] + diceRoll[1];
  const diceBias = (diceTotal - 7) / 10; // Range: -0.5 to +0.5

  // Apply bias
  const biased = applyDiceBias(adjusted, diceBias);

  // Weighted random selection
  return weightedRandomSelect(biased);
}

// ============================================
// BASE RUNNING
// ============================================

/**
 * Advance runners based on outcome
 */
export function advanceRunners(
  currentState: BaseState,
  outcome: OutcomeType
): { newBases: [boolean, boolean, boolean]; runsScored: number } {
  const bases = [...currentState.bases] as [boolean, boolean, boolean];
  let runs = 0;

  switch (outcome) {
    case 'homeRun':
      // Everyone scores
      runs = 1 + bases.filter((b) => b).length;
      return { newBases: [false, false, false], runsScored: runs };

    case 'triple':
      // All runners score, batter to 3rd
      runs = bases.filter((b) => b).length;
      return { newBases: [false, false, true], runsScored: runs };

    case 'double':
      // Runners advance 2, batter to 2nd
      if (bases[2]) runs++; // 3rd scores
      if (bases[1]) runs++; // 2nd scores
      const newThird = bases[0]; // 1st to 3rd
      return { newBases: [false, true, newThird], runsScored: runs };

    case 'single':
      // Runners advance 1, batter to 1st
      if (bases[2]) runs++; // 3rd scores
      return {
        newBases: [true, bases[0], bases[1]],
        runsScored: runs,
      };

    case 'walk':
      // Forced advances only
      if (bases[0] && bases[1] && bases[2]) {
        runs++; // Bases loaded, run scores
      }
      if (bases[0] && bases[1]) {
        // First and second occupied, force to third
        return { newBases: [true, true, true], runsScored: runs };
      }
      if (bases[0]) {
        // Only first occupied, force to second
        return { newBases: [true, true, bases[2]], runsScored: runs };
      }
      // Just batter to first
      return { newBases: [true, bases[1], bases[2]], runsScored: runs };

    case 'strikeout':
    case 'groundOut':
    case 'flyOut':
      // No advancement (simplified for V2)
      return { newBases: bases, runsScored: 0 };

    default:
      return { newBases: bases, runsScored: 0 };
  }
}

// ============================================
// INNING LOGIC
// ============================================

/**
 * Handle inning transitions and game end conditions
 */
export function handleInningLogic(state: GameState): void {
  const [visitorScore, homeScore] = state.scores;

  // Check for walk-off in bottom of 9+ (home team takes lead)
  if (!state.isTopOfInning && state.inning >= 9 && homeScore > visitorScore) {
    state.isGameOver = true;
    return;
  }

  // Check if half-inning is over (3 outs)
  if (state.outs >= 3) {
    // Clear bases
    state.bases = [false, false, false];
    state.outs = 0;

    if (state.isTopOfInning) {
      // Switch to bottom of inning
      state.isTopOfInning = false;

      // Check if home team already won (ahead after top of 9+)
      // This scenario shouldn't happen - home batting with lead ends game
    } else {
      // End of full inning
      // Check for game end conditions
      if (state.inning >= 9) {
        if (visitorScore !== homeScore) {
          // Not tied, game over
          state.isGameOver = true;
          return;
        }
        // Tied, go to extras
      }

      // Move to next inning
      state.inning++;
      state.isTopOfInning = true;
    }
  }
}

// ============================================
// PLAY DESCRIPTION GENERATOR
// ============================================

const DESCRIPTIONS: Record<OutcomeType, string[]> = {
  homeRun: [
    '{batter} crushes one! Home run!',
    '{batter} goes yard! It\'s outta here!',
    'Swing and a drive! {batter} with a homer!',
    '{batter} deposits one in the seats!',
  ],
  triple: [
    '{batter} triples into the gap!',
    '{batter} legs out a triple!',
    'Off the wall! {batter} with a triple!',
  ],
  double: [
    '{batter} doubles down the line!',
    '{batter} rips one for extra bases!',
    'Off the wall! {batter} with a double!',
  ],
  single: [
    '{batter} singles through the infield.',
    '{batter} pokes one into the outfield.',
    'Base hit for {batter}!',
    '{batter} with a seeing-eye single.',
  ],
  walk: [
    '{batter} works a walk.',
    'Ball four. {batter} takes first.',
    '{pitcher} can\'t find the zone. Walk.',
  ],
  strikeout: [
    '{batter} goes down swinging!',
    'Struck out looking! {pitcher} gets {batter}.',
    '{pitcher} blows it by {batter}. K!',
    'Swing and a miss! That\'s strike three!',
  ],
  groundOut: [
    '{batter} grounds out to short.',
    'Easy grounder, and {batter} is out.',
    '{batter} rolls one to the infield. Out.',
  ],
  flyOut: [
    '{batter} flies out to center.',
    'Can of corn. {batter} is out.',
    '{batter} skies one to left. Caught.',
  ],
};

/**
 * Generate a play-by-play description for an outcome
 */
export function generateDescription(
  outcome: OutcomeType,
  batterName: string,
  pitcherName: string,
  runsScored: number
): string {
  const templates = DESCRIPTIONS[outcome];
  const template = templates[Math.floor(Math.random() * templates.length)];

  let desc = template.replace(/{batter}/g, batterName).replace(/{pitcher}/g, pitcherName);

  // Add run scored context
  if (runsScored === 1) {
    desc += ' Runner scores!';
  } else if (runsScored > 1) {
    desc += ` ${runsScored} runs score!`;
  }

  return desc;
}
