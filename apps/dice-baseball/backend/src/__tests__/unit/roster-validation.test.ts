import { describe, it, expect } from 'vitest';
import {
  validateRoster,
  validateBattingOrder,
  REQUIRED_POSITIONS,
  type RosterSlot,
  type ValidationResult,
} from '../../services/roster-validation.js';

describe('Roster Validation', () => {
  const createValidRoster = (): RosterSlot[] => [
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

  describe('validateRoster', () => {
    it('accepts valid 9-player + 1-pitcher roster', () => {
      const roster = createValidRoster();
      const result = validateRoster(roster);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects roster with missing positions', () => {
      const roster = createValidRoster().filter((s) => s.position !== 'SS');
      const result = validateRoster(roster);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required position: SS');
    });

    it('rejects roster with multiple missing positions', () => {
      const roster = createValidRoster().filter(
        (s) => s.position !== 'SS' && s.position !== 'CF'
      );
      const result = validateRoster(roster);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required position: SS');
      expect(result.errors).toContain('Missing required position: CF');
    });

    it('rejects roster with duplicate players', () => {
      const roster = createValidRoster();
      roster[1].mlbPlayerId = roster[0].mlbPlayerId; // Duplicate player
      const result = validateRoster(roster);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
    });

    it('rejects roster without a pitcher', () => {
      const roster = createValidRoster().filter((s) => s.position !== 'SP');
      // Add another position player instead
      roster.push({ position: 'DH', mlbPlayerId: 999999, battingOrder: null });
      const result = validateRoster(roster);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required position: SP');
    });

    it('rejects empty roster', () => {
      const result = validateRoster([]);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects roster with invalid position', () => {
      const roster = createValidRoster();
      roster[0].position = 'INVALID' as RosterSlot['position'];
      const result = validateRoster(roster);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid position'))).toBe(true);
    });

    it('rejects roster with missing player ID', () => {
      const roster = createValidRoster();
      roster[0].mlbPlayerId = null as unknown as number;
      const result = validateRoster(roster);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('missing player'))).toBe(true);
    });
  });

  describe('validateBattingOrder', () => {
    it('accepts batting order 1-9 for position players', () => {
      const roster = createValidRoster();
      const result = validateBattingOrder(roster);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid batting order with gaps', () => {
      const roster = createValidRoster();
      // Create a gap: change 9 to 10
      const player = roster.find((s) => s.battingOrder === 9);
      if (player) player.battingOrder = 10;

      const result = validateBattingOrder(roster);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('gap') || e.includes('1-9'))).toBe(true);
    });

    it('rejects invalid batting order with duplicates', () => {
      const roster = createValidRoster();
      // Create duplicate batting order
      const player = roster.find((s) => s.battingOrder === 8);
      if (player) player.battingOrder = 1; // Duplicate of SS

      const result = validateBattingOrder(roster);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('duplicate') || e.includes('Duplicate'))).toBe(
        true
      );
    });

    it('rejects pitcher in batting order', () => {
      const roster = createValidRoster();
      // Give pitcher a batting order
      const pitcher = roster.find((s) => s.position === 'SP');
      if (pitcher) pitcher.battingOrder = 9;
      // Remove someone else's batting order to make room
      const catcher = roster.find((s) => s.position === 'C');
      if (catcher) catcher.battingOrder = null;

      const result = validateBattingOrder(roster);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('pitcher') || e.includes('Pitcher'))).toBe(true);
    });

    it('requires exactly 9 batters in order', () => {
      const roster = createValidRoster();
      // Remove one batter from the order
      const player = roster.find((s) => s.battingOrder === 5);
      if (player) player.battingOrder = null;

      const result = validateBattingOrder(roster);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('9') || e.includes('nine'))).toBe(true);
    });

    it('accepts roster where pitcher has null batting order', () => {
      const roster = createValidRoster();
      const pitcher = roster.find((s) => s.position === 'SP');
      expect(pitcher?.battingOrder).toBeNull();

      const result = validateBattingOrder(roster);
      expect(result.valid).toBe(true);
    });

    it('rejects batting order with zero', () => {
      const roster = createValidRoster();
      const player = roster.find((s) => s.battingOrder === 1);
      if (player) player.battingOrder = 0;

      const result = validateBattingOrder(roster);

      expect(result.valid).toBe(false);
    });

    it('rejects batting order with negative numbers', () => {
      const roster = createValidRoster();
      const player = roster.find((s) => s.battingOrder === 1);
      if (player) player.battingOrder = -1;

      const result = validateBattingOrder(roster);

      expect(result.valid).toBe(false);
    });
  });

  describe('REQUIRED_POSITIONS', () => {
    it('includes all 9 position player spots plus pitcher', () => {
      expect(REQUIRED_POSITIONS).toContain('C');
      expect(REQUIRED_POSITIONS).toContain('1B');
      expect(REQUIRED_POSITIONS).toContain('2B');
      expect(REQUIRED_POSITIONS).toContain('3B');
      expect(REQUIRED_POSITIONS).toContain('SS');
      expect(REQUIRED_POSITIONS).toContain('LF');
      expect(REQUIRED_POSITIONS).toContain('CF');
      expect(REQUIRED_POSITIONS).toContain('RF');
      expect(REQUIRED_POSITIONS).toContain('DH');
      expect(REQUIRED_POSITIONS).toContain('SP');
      expect(REQUIRED_POSITIONS).toHaveLength(10);
    });
  });
});
