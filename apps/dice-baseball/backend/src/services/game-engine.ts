/**
 * Game Engine Service - Dice Baseball V2
 * Stats-weighted outcome calculations for at-bats
 *
 * Data-driven outcomes registry: adding a new outcome requires only
 * adding a single entry to the OUTCOMES object below.
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

export interface TeamStats {
  hits: number;
  homeRuns: number;
  strikeouts: number;
  walks: number;
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
  inningScores?: Array<[number, number]>; // per-inning [visitor, home] runs
  teamStats?: [TeamStats, TeamStats]; // [visitor, home]
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
// OUTCOME DEFINITION & REGISTRY
// ============================================

interface BatterModifierContext {
  hitModifier: number;
  powerModifier: number;
  disciplineModifier: number;
}

interface PitcherModifierContext {
  whipModifier: number;
  kModifier: number;
  bbModifier: number;
  hrModifier: number;
}

export interface OutcomeDefinition {
  baseProbability: number;
  isPositive: boolean;
  batterModifier: (ctx: BatterModifierContext) => number;
  pitcherModifier: (ctx: PitcherModifierContext) => number;
  advanceRunners: (bases: [boolean, boolean, boolean]) => { newBases: [boolean, boolean, boolean]; runsScored: number };
  descriptions: string[];
}

/**
 * Central outcomes registry. To add a new outcome:
 * 1. Add it to OutcomeType union
 * 2. Add an entry here with all fields
 * That's it - no other files need to change.
 */
export const OUTCOMES: Record<OutcomeType, OutcomeDefinition> = {
  homeRun: {
    baseProbability: 0.028,
    isPositive: true,
    batterModifier: (ctx) => clamp(ctx.powerModifier * 1.2, 0.3, 2.5),
    pitcherModifier: (ctx) => clamp(ctx.hrModifier, 0.4, 2.0),
    advanceRunners: (bases) => ({
      newBases: [false, false, false] as [boolean, boolean, boolean],
      runsScored: 1 + bases.filter((b) => b).length,
    }),
    descriptions: [
      '{batter} crushes one! Home run!',
      '{batter} goes yard! It\'s outta here!',
      'Swing and a drive! {batter} with a homer!',
      '{batter} deposits one in the seats!',
    ],
  },

  triple: {
    baseProbability: 0.005,
    isPositive: true,
    batterModifier: (ctx) => clamp(ctx.powerModifier, 0.3, 2.0),
    pitcherModifier: (ctx) => clamp(1 / (ctx.whipModifier * 0.8), 0.5, 1.5),
    advanceRunners: (bases) => ({
      newBases: [false, false, true] as [boolean, boolean, boolean],
      runsScored: bases.filter((b) => b).length,
    }),
    descriptions: [
      '{batter} triples into the gap!',
      '{batter} legs out a triple!',
      'Off the wall! {batter} with a triple!',
    ],
  },

  double: {
    baseProbability: 0.046,
    isPositive: true,
    batterModifier: (ctx) => clamp(ctx.hitModifier * ctx.powerModifier, 0.4, 1.8),
    pitcherModifier: (ctx) => clamp(1 / (ctx.whipModifier * 0.9), 0.5, 1.5),
    advanceRunners: (bases) => {
      let runs = 0;
      if (bases[2]) runs++;
      if (bases[1]) runs++;
      const newThird = bases[0];
      return { newBases: [false, true, newThird] as [boolean, boolean, boolean], runsScored: runs };
    },
    descriptions: [
      '{batter} doubles down the line!',
      '{batter} rips one for extra bases!',
      'Off the wall! {batter} with a double!',
    ],
  },

  single: {
    baseProbability: 0.150,
    isPositive: true,
    batterModifier: (ctx) => clamp(ctx.hitModifier, 0.5, 1.5),
    pitcherModifier: (ctx) => clamp(1 / ctx.whipModifier, 0.5, 1.5),
    advanceRunners: (bases) => {
      let runs = 0;
      if (bases[2]) runs++;
      return {
        newBases: [true, bases[0], bases[1]] as [boolean, boolean, boolean],
        runsScored: runs,
      };
    },
    descriptions: [
      '{batter} singles through the infield.',
      '{batter} pokes one into the outfield.',
      'Base hit for {batter}!',
      '{batter} with a seeing-eye single.',
    ],
  },

  walk: {
    baseProbability: 0.083,
    isPositive: true,
    batterModifier: (ctx) => clamp(ctx.disciplineModifier, 0.5, 2.0),
    pitcherModifier: (ctx) => clamp(ctx.bbModifier, 0.5, 1.8),
    advanceRunners: (bases) => {
      let runs = 0;
      if (bases[0] && bases[1] && bases[2]) {
        runs++;
      }
      if (bases[0] && bases[1]) {
        return { newBases: [true, true, true] as [boolean, boolean, boolean], runsScored: runs };
      }
      if (bases[0]) {
        return { newBases: [true, true, bases[2]] as [boolean, boolean, boolean], runsScored: runs };
      }
      return { newBases: [true, bases[1], bases[2]] as [boolean, boolean, boolean], runsScored: runs };
    },
    descriptions: [
      '{batter} works a walk.',
      'Ball four. {batter} takes first.',
      '{pitcher} can\'t find the zone. Walk.',
    ],
  },

  strikeout: {
    baseProbability: 0.217,
    isPositive: false,
    batterModifier: (ctx) => clamp(1 / (ctx.disciplineModifier || 1), 0.5, 2.0),
    pitcherModifier: (ctx) => clamp(ctx.kModifier, 0.6, 1.8),
    advanceRunners: (bases) => ({
      newBases: [...bases] as [boolean, boolean, boolean],
      runsScored: 0,
    }),
    descriptions: [
      '{batter} goes down swinging!',
      'Struck out looking! {pitcher} gets {batter}.',
      '{pitcher} blows it by {batter}. K!',
      'Swing and a miss! That\'s strike three!',
    ],
  },

  groundOut: {
    baseProbability: 0.278,
    isPositive: false,
    batterModifier: () => 1.0,
    pitcherModifier: () => 1.0,
    advanceRunners: (bases) => ({
      newBases: [...bases] as [boolean, boolean, boolean],
      runsScored: 0,
    }),
    descriptions: [
      '{batter} grounds out to short.',
      'Easy grounder, and {batter} is out.',
      '{batter} rolls one to the infield. Out.',
    ],
  },

  flyOut: {
    baseProbability: 0.193,
    isPositive: false,
    batterModifier: (ctx) => clamp(ctx.powerModifier, 0.7, 1.3),
    pitcherModifier: () => 1.0,
    advanceRunners: (bases) => ({
      newBases: [...bases] as [boolean, boolean, boolean],
      runsScored: 0,
    }),
    descriptions: [
      '{batter} flies out to center.',
      'Can of corn. {batter} is out.',
      '{batter} skies one to left. Caught.',
    ],
  },
};

// ============================================
// CONSTANTS (derived from registry)
// ============================================

/**
 * Base probabilities derived from 2d6 dice distribution.
 * Exported for backward compatibility - values come from OUTCOMES registry.
 */
export const BASE_PROBABILITIES: Record<OutcomeType, number> = Object.fromEntries(
  Object.entries(OUTCOMES).map(([key, def]) => [key, def.baseProbability])
) as Record<OutcomeType, number>;

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
export function weightedRandomSelect(
  probs: Record<OutcomeType, number>,
  randomValue: number = Math.random()
): OutcomeType {
  const rand = randomValue;
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
 * Build batter modifier context from stats
 */
function buildBatterContext(stats: BatterStats): BatterModifierContext {
  const ab = stats.ab || 1;
  const ops = stats.ops || LEAGUE_AVG.ops;
  const slg = stats.slg || LEAGUE_AVG.slg;

  const hitModifier = ops / LEAGUE_AVG.ops;
  const powerModifier = slg / LEAGUE_AVG.slg;

  const walkRate = stats.bb / ab || 0.08;
  const strikeoutRate = stats.so / ab || 0.2;
  const normalizedWalkRate = walkRate / 0.08 || 1;
  const normalizedKRate = strikeoutRate / 0.2 || 1;
  const disciplineModifier = normalizedKRate > 0 ? normalizedWalkRate / normalizedKRate : 1;

  return { hitModifier, powerModifier, disciplineModifier };
}

/**
 * Build pitcher modifier context from stats
 */
function buildPitcherContext(stats: PitcherStats): PitcherModifierContext {
  const whip = stats.whip || LEAGUE_AVG.whip;
  const kPer9 = stats.kPer9 || LEAGUE_AVG.kPer9;
  const bbPer9 = stats.bbPer9 || LEAGUE_AVG.bbPer9;
  const hrPer9 = stats.hrPer9 || LEAGUE_AVG.hrPer9;

  const clampedWhip = Math.max(whip, 0.8);
  const whipModifier = LEAGUE_AVG.whip / clampedWhip;
  const kModifier = kPer9 / LEAGUE_AVG.kPer9;
  const bbModifier = bbPer9 / LEAGUE_AVG.bbPer9;
  const hrModifier = hrPer9 / LEAGUE_AVG.hrPer9;

  return { whipModifier, kModifier, bbModifier, hrModifier };
}

/**
 * Calculate batter modifiers based on stats
 * Returns modifiers where 1.0 = league average
 * >1.0 = better than average (more hits, walks)
 * <1.0 = worse than average (fewer hits, walks)
 */
export function calculateBatterModifiers(stats: BatterStats): Record<OutcomeType, number> {
  const ctx = buildBatterContext(stats);
  const result = {} as Record<OutcomeType, number>;

  for (const [key, def] of Object.entries(OUTCOMES) as [OutcomeType, OutcomeDefinition][]) {
    result[key] = def.batterModifier(ctx);
  }

  return result;
}

/**
 * Calculate pitcher modifiers based on stats
 */
export function calculatePitcherModifiers(stats: PitcherStats): Record<OutcomeType, number> {
  const ctx = buildPitcherContext(stats);
  const result = {} as Record<OutcomeType, number>;

  for (const [key, def] of Object.entries(OUTCOMES) as [OutcomeType, OutcomeDefinition][]) {
    result[key] = def.pitcherModifier(ctx);
  }

  return result;
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
  const goodOutcomes = (Object.entries(OUTCOMES) as [OutcomeType, OutcomeDefinition][])
    .filter(([, def]) => def.isPositive)
    .map(([key]) => key);
  const badOutcomes = (Object.entries(OUTCOMES) as [OutcomeType, OutcomeDefinition][])
    .filter(([, def]) => !def.isPositive)
    .map(([key]) => key);

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
  diceRoll: [number, number],
  randomValue: number = Math.random()
): OutcomeType {
  // Calculate modified probabilities
  const batterMods = calculateBatterModifiers(batter);
  const pitcherMods = calculatePitcherModifiers(pitcher);

  const adjusted: Record<OutcomeType, number> = {} as Record<OutcomeType, number>;

  for (const [key, def] of Object.entries(OUTCOMES) as [OutcomeType, OutcomeDefinition][]) {
    const base = def.baseProbability;

    if (def.isPositive) {
      // Good outcomes: batter helps (>1), good pitcher suppresses (<1)
      adjusted[key] = base * batterMods[key] * pitcherMods[key];
    } else {
      // Bad outcomes: good batter reduces, good pitcher increases
      adjusted[key] = base * (1 / batterMods[key]) * pitcherMods[key];
    }
  }

  // Normalize to sum to 1.0
  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(adjusted) as OutcomeType[]) {
    adjusted[key] /= total;
  }

  // Use dice roll to bias the selection
  const diceTotal = diceRoll[0] + diceRoll[1];
  const diceBias = (diceTotal - 7) / 10;

  // Apply bias
  const biased = applyDiceBias(adjusted, diceBias);

  // Weighted random selection
  return weightedRandomSelect(biased, randomValue);
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
  const def = OUTCOMES[outcome];
  if (!def) {
    return { newBases: [...currentState.bases] as [boolean, boolean, boolean], runsScored: 0 };
  }
  return def.advanceRunners(currentState.bases);
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
    } else {
      // End of full inning
      if (state.inning >= 9) {
        if (visitorScore !== homeScore) {
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

/**
 * Generate a play-by-play description for an outcome
 */
export function generateDescription(
  outcome: OutcomeType,
  batterName: string,
  pitcherName: string,
  runsScored: number,
  randomValue: number = Math.random()
): string {
  const def = OUTCOMES[outcome];
  const templates = def.descriptions;
  const template = templates[Math.floor(randomValue * templates.length)];

  let desc = template.replace(/{batter}/g, batterName).replace(/{pitcher}/g, pitcherName);

  // Add run scored context
  if (runsScored === 1) {
    desc += ' Runner scores!';
  } else if (runsScored > 1) {
    desc += ` ${runsScored} runs score!`;
  }

  return desc;
}
