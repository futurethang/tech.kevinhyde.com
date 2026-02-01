/**
 * MLB Stats Sync Service
 *
 * Fetches and caches current season MLB player statistics.
 */

export interface BattingStats {
  gamesPlayed: number;
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PitchingStats {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  era: number;
  inningsPitched: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  homeRuns: number;
  walks: number;
  strikeouts: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
}

export interface MLBPlayer {
  mlbId: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryPosition: string;
  currentTeam: string | null;
  currentTeamId: number | null;
  photoUrl: string;
  battingStats: BattingStats | null;
  pitchingStats: PitchingStats | null;
  seasonYear: number;
  isActive: boolean;
  lastUpdated: string;
}

export interface GetPlayersOptions {
  position?: string;
  team?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GetPlayersResult {
  players: MLBPlayer[];
  total: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MLBApiStats = any[];

/**
 * Extract batting stats from MLB API response
 */
export function extractBattingStats(stats: MLBApiStats | undefined): BattingStats | null {
  if (!stats || !Array.isArray(stats)) {
    return null;
  }

  const hitting = stats.find(
    (s) => s.group?.displayName === 'hitting' && s.type?.displayName === 'season'
  );

  if (!hitting?.splits?.[0]?.stat) {
    return null;
  }

  const s = hitting.splits[0].stat;

  return {
    gamesPlayed: s.gamesPlayed ?? 0,
    atBats: s.atBats ?? 0,
    runs: s.runs ?? 0,
    hits: s.hits ?? 0,
    doubles: s.doubles ?? 0,
    triples: s.triples ?? 0,
    homeRuns: s.homeRuns ?? 0,
    rbi: s.rbi ?? 0,
    walks: s.baseOnBalls ?? 0,
    strikeouts: s.strikeOuts ?? 0,
    stolenBases: s.stolenBases ?? 0,
    avg: parseFloat(s.avg) || 0,
    obp: parseFloat(s.obp) || 0,
    slg: parseFloat(s.slg) || 0,
    ops: parseFloat(s.ops) || 0,
  };
}

/**
 * Extract pitching stats from MLB API response
 */
export function extractPitchingStats(stats: MLBApiStats | undefined): PitchingStats | null {
  if (!stats || !Array.isArray(stats)) {
    return null;
  }

  const pitching = stats.find(
    (s) => s.group?.displayName === 'pitching' && s.type?.displayName === 'season'
  );

  if (!pitching?.splits?.[0]?.stat) {
    return null;
  }

  const s = pitching.splits[0].stat;

  return {
    gamesPlayed: s.gamesPlayed ?? 0,
    gamesStarted: s.gamesStarted ?? 0,
    wins: s.wins ?? 0,
    losses: s.losses ?? 0,
    era: parseFloat(s.era) || 0,
    inningsPitched: parseFloat(s.inningsPitched) || 0,
    hits: s.hits ?? 0,
    runs: s.runs ?? 0,
    earnedRuns: s.earnedRuns ?? 0,
    homeRuns: s.homeRuns ?? 0,
    walks: s.baseOnBalls ?? 0,
    strikeouts: s.strikeOuts ?? 0,
    whip: parseFloat(s.whip) || 0,
    kPer9: parseFloat(s.strikeoutsPer9Inn) || 0,
    bbPer9: parseFloat(s.walksPer9Inn) || 0,
    hrPer9: parseFloat(s.homeRunsPer9) || 0,
  };
}

/**
 * Determine the current MLB season year
 */
export function getCurrentSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = January)
  const year = now.getFullYear();

  // MLB season: April (3) through October (9)
  // Off-season: November through March
  // During off-season (Jan-Mar), use previous year's stats
  if (month >= 3) {
    return year; // April onwards - current season
  } else {
    return year - 1; // Jan-Mar - use last year's stats
  }
}

/**
 * Build MLB headshot photo URL
 */
export function buildPhotoUrl(mlbId: number): string {
  return `https://img.mlb.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbId}/headshot/67/current`;
}

/**
 * Get players with filtering and pagination
 * This is a placeholder that would connect to Supabase in production
 */
export async function getPlayers(_options: GetPlayersOptions): Promise<GetPlayersResult> {
  // This would be implemented with Supabase queries
  // For now, return empty result - tests mock this function
  return {
    players: [],
    total: 0,
  };
}

/**
 * Get a single player by MLB ID
 * This is a placeholder that would connect to Supabase in production
 */
export async function getPlayerById(_mlbId: number): Promise<MLBPlayer | null> {
  // This would be implemented with Supabase queries
  // For now, return null - tests mock this function
  return null;
}
