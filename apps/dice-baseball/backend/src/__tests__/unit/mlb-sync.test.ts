import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractBattingStats,
  extractPitchingStats,
  getCurrentSeason,
  buildPhotoUrl,
} from '../../services/mlb-sync.js';

describe('MLB Sync Service', () => {
  describe('extractBattingStats', () => {
    it('extracts all batting fields from MLB API response', () => {
      const stats = [
        {
          group: { displayName: 'hitting' },
          type: { displayName: 'season' },
          splits: [
            {
              stat: {
                gamesPlayed: 150,
                atBats: 550,
                runs: 95,
                hits: 165,
                doubles: 35,
                triples: 3,
                homeRuns: 30,
                rbi: 100,
                baseOnBalls: 75,
                strikeOuts: 120,
                stolenBases: 15,
                avg: '.300',
                obp: '.380',
                slg: '.550',
                ops: '.930',
              },
            },
          ],
        },
      ];

      const result = extractBattingStats(stats);

      expect(result).toEqual({
        gamesPlayed: 150,
        atBats: 550,
        runs: 95,
        hits: 165,
        doubles: 35,
        triples: 3,
        homeRuns: 30,
        rbi: 100,
        walks: 75,
        strikeouts: 120,
        stolenBases: 15,
        avg: 0.3,
        obp: 0.38,
        slg: 0.55,
        ops: 0.93,
      });
    });

    it('returns null for pitchers without batting stats', () => {
      const stats = [
        {
          group: { displayName: 'pitching' },
          type: { displayName: 'season' },
          splits: [{ stat: { wins: 15 } }],
        },
      ];

      const result = extractBattingStats(stats);
      expect(result).toBeNull();
    });

    it('returns null for empty stats array', () => {
      const result = extractBattingStats([]);
      expect(result).toBeNull();
    });

    it('returns null for undefined stats', () => {
      const result = extractBattingStats(undefined);
      expect(result).toBeNull();
    });

    it('handles missing fields gracefully with defaults', () => {
      const stats = [
        {
          group: { displayName: 'hitting' },
          type: { displayName: 'season' },
          splits: [
            {
              stat: {
                gamesPlayed: 50,
                atBats: 150,
                // Most fields missing
              },
            },
          ],
        },
      ];

      const result = extractBattingStats(stats);

      expect(result).toEqual({
        gamesPlayed: 50,
        atBats: 150,
        runs: 0,
        hits: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
        rbi: 0,
        walks: 0,
        strikeouts: 0,
        stolenBases: 0,
        avg: 0,
        obp: 0,
        slg: 0,
        ops: 0,
      });
    });

    it('handles missing splits array', () => {
      const stats = [
        {
          group: { displayName: 'hitting' },
          type: { displayName: 'season' },
          splits: [],
        },
      ];

      const result = extractBattingStats(stats);
      expect(result).toBeNull();
    });

    it('ignores non-season stats', () => {
      const stats = [
        {
          group: { displayName: 'hitting' },
          type: { displayName: 'career' },
          splits: [{ stat: { gamesPlayed: 1500 } }],
        },
      ];

      const result = extractBattingStats(stats);
      expect(result).toBeNull();
    });
  });

  describe('extractPitchingStats', () => {
    it('extracts all pitching fields from MLB API response', () => {
      const stats = [
        {
          group: { displayName: 'pitching' },
          type: { displayName: 'season' },
          splits: [
            {
              stat: {
                gamesPlayed: 32,
                gamesStarted: 32,
                wins: 15,
                losses: 7,
                era: '3.12',
                inningsPitched: '200.0',
                hits: 175,
                runs: 72,
                earnedRuns: 69,
                homeRuns: 22,
                baseOnBalls: 45,
                strikeOuts: 220,
                whip: '1.10',
                strikeoutsPer9Inn: '9.90',
                walksPer9Inn: '2.02',
                homeRunsPer9: '0.99',
              },
            },
          ],
        },
      ];

      const result = extractPitchingStats(stats);

      expect(result).toEqual({
        gamesPlayed: 32,
        gamesStarted: 32,
        wins: 15,
        losses: 7,
        era: 3.12,
        inningsPitched: 200.0,
        hits: 175,
        runs: 72,
        earnedRuns: 69,
        homeRuns: 22,
        walks: 45,
        strikeouts: 220,
        whip: 1.1,
        kPer9: 9.9,
        bbPer9: 2.02,
        hrPer9: 0.99,
      });
    });

    it('returns null for position players without pitching stats', () => {
      const stats = [
        {
          group: { displayName: 'hitting' },
          type: { displayName: 'season' },
          splits: [{ stat: { homeRuns: 30 } }],
        },
      ];

      const result = extractPitchingStats(stats);
      expect(result).toBeNull();
    });

    it('returns null for empty stats array', () => {
      const result = extractPitchingStats([]);
      expect(result).toBeNull();
    });

    it('returns null for undefined stats', () => {
      const result = extractPitchingStats(undefined);
      expect(result).toBeNull();
    });

    it('handles missing fields gracefully with defaults', () => {
      const stats = [
        {
          group: { displayName: 'pitching' },
          type: { displayName: 'season' },
          splits: [
            {
              stat: {
                gamesPlayed: 10,
                wins: 2,
                // Most fields missing
              },
            },
          ],
        },
      ];

      const result = extractPitchingStats(stats);

      expect(result).toEqual({
        gamesPlayed: 10,
        gamesStarted: 0,
        wins: 2,
        losses: 0,
        era: 0,
        inningsPitched: 0,
        hits: 0,
        runs: 0,
        earnedRuns: 0,
        homeRuns: 0,
        walks: 0,
        strikeouts: 0,
        whip: 0,
        kPer9: 0,
        bbPer9: 0,
        hrPer9: 0,
      });
    });

    it('handles missing splits array', () => {
      const stats = [
        {
          group: { displayName: 'pitching' },
          type: { displayName: 'season' },
          splits: [],
        },
      ];

      const result = extractPitchingStats(stats);
      expect(result).toBeNull();
    });
  });

  describe('getCurrentSeason', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('returns current year during baseball season (April-October)', () => {
      vi.setSystemTime(new Date('2025-07-15'));
      expect(getCurrentSeason()).toBe(2025);
    });

    it('returns current year in post-season (November)', () => {
      vi.setSystemTime(new Date('2025-11-01'));
      expect(getCurrentSeason()).toBe(2025);
    });

    it('returns previous year in off-season (January-March)', () => {
      vi.setSystemTime(new Date('2025-02-15'));
      expect(getCurrentSeason()).toBe(2024);
    });

    it('returns current year at start of season (April 1)', () => {
      vi.setSystemTime(new Date('2025-04-01'));
      expect(getCurrentSeason()).toBe(2025);
    });

    it('returns current year at end of regular season (September 30)', () => {
      vi.setSystemTime(new Date('2025-09-30'));
      expect(getCurrentSeason()).toBe(2025);
    });
  });

  describe('buildPhotoUrl', () => {
    it('builds correct MLB photo URL for a player', () => {
      const url = buildPhotoUrl(545361);
      expect(url).toBe(
        'https://img.mlb.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/545361/headshot/67/current'
      );
    });

    it('works with different player IDs', () => {
      const url = buildPhotoUrl(660271);
      expect(url).toContain('/people/660271/');
    });
  });
});
