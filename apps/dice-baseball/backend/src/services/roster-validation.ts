/**
 * Roster Validation Service
 *
 * Validates team rosters and batting orders for Dice Baseball.
 */

export const REQUIRED_POSITIONS = [
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'DH',
  'SP',
] as const;

export const BATTING_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const;

export type Position = (typeof REQUIRED_POSITIONS)[number];
export type BattingPosition = (typeof BATTING_POSITIONS)[number];

export interface RosterSlot {
  position: Position;
  mlbPlayerId: number;
  battingOrder: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a complete roster
 */
export function validateRoster(roster: RosterSlot[]): ValidationResult {
  const errors: string[] = [];

  // Check for invalid positions
  for (const slot of roster) {
    if (!REQUIRED_POSITIONS.includes(slot.position as Position)) {
      errors.push(`Invalid position: ${slot.position}`);
    }
  }

  // Check for missing positions
  for (const position of REQUIRED_POSITIONS) {
    const hasPosition = roster.some((s) => s.position === position);
    if (!hasPosition) {
      errors.push(`Missing required position: ${position}`);
    }
  }

  // Check for duplicate players
  const playerIds = roster.map((s) => s.mlbPlayerId).filter((id) => id != null);
  const uniquePlayerIds = new Set(playerIds);
  if (playerIds.length !== uniquePlayerIds.size) {
    errors.push('Roster contains duplicate players');
  }

  // Check for missing player IDs
  for (const slot of roster) {
    if (slot.mlbPlayerId == null) {
      errors.push(`Position ${slot.position} has missing player ID`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate batting order
 */
export function validateBattingOrder(roster: RosterSlot[]): ValidationResult {
  const errors: string[] = [];

  // Get all batting order values (excluding nulls and pitchers)
  const batters = roster.filter((s) => s.position !== 'SP' && s.battingOrder != null);
  const battingOrders = batters.map((s) => s.battingOrder as number);

  // Check pitcher is not in batting order
  const pitcher = roster.find((s) => s.position === 'SP');
  if (pitcher && pitcher.battingOrder != null) {
    errors.push('Pitcher cannot be in batting order');
  }

  // Check we have exactly 9 batters
  if (battingOrders.length !== 9) {
    errors.push(`Batting order must have exactly 9 batters, found ${battingOrders.length}`);
  }

  // Check for valid range (1-9)
  for (const order of battingOrders) {
    if (order < 1 || order > 9) {
      errors.push(`Invalid batting order position: ${order}. Must be 1-9`);
    }
  }

  // Check for duplicates
  const uniqueOrders = new Set(battingOrders);
  if (battingOrders.length !== uniqueOrders.size) {
    errors.push('Duplicate batting order positions found');
  }

  // Check for gaps (must have all numbers 1-9)
  if (battingOrders.length === 9 && uniqueOrders.size === 9) {
    const sorted = [...battingOrders].sort((a, b) => a - b);
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const hasGaps = !sorted.every((val, idx) => val === expected[idx]);
    if (hasGaps) {
      errors.push('Batting order must be consecutive 1-9 with no gaps');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a new batting order array (just positions, not full roster)
 */
export function validateBattingOrderArray(order: string[]): ValidationResult {
  const errors: string[] = [];

  // Must have exactly 9 positions
  if (order.length !== 9) {
    errors.push(`Batting order must have exactly 9 positions, got ${order.length}`);
  }

  // Cannot include pitcher
  if (order.includes('SP') || order.includes('RP')) {
    errors.push('Pitcher cannot be in batting order');
  }

  // Check for valid positions
  for (const pos of order) {
    if (!BATTING_POSITIONS.includes(pos as BattingPosition)) {
      errors.push(`Invalid batting position: ${pos}`);
    }
  }

  // Check for duplicates
  const uniquePositions = new Set(order);
  if (order.length !== uniquePositions.size) {
    errors.push('Duplicate positions in batting order');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
