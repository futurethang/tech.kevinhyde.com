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
  minOps?: number;
  maxOps?: number;
  minEra?: number;
  maxEra?: number;
  minHr?: number;
  maxHr?: number;
  minRbi?: number;
  maxRbi?: number;
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

// Sample player data for development
const SAMPLE_PLAYERS: MLBPlayer[] = [
  // Batters
  { mlbId: 660271, fullName: 'Shohei Ohtani', firstName: 'Shohei', lastName: 'Ohtani', primaryPosition: 'DH', currentTeam: 'LAD', currentTeamId: 119, photoUrl: buildPhotoUrl(660271), battingStats: { gamesPlayed: 159, atBats: 568, runs: 134, hits: 197, doubles: 38, triples: 7, homeRuns: 54, rbi: 130, walks: 81, strikeouts: 141, stolenBases: 59, avg: 0.310, obp: 0.390, slg: 0.646, ops: 1.036 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 592450, fullName: 'Aaron Judge', firstName: 'Aaron', lastName: 'Judge', primaryPosition: 'RF', currentTeam: 'NYY', currentTeamId: 147, photoUrl: buildPhotoUrl(592450), battingStats: { gamesPlayed: 158, atBats: 546, runs: 122, hits: 180, doubles: 28, triples: 1, homeRuns: 58, rbi: 144, walks: 133, strikeouts: 171, stolenBases: 10, avg: 0.322, obp: 0.458, slg: 0.701, ops: 1.159 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 665742, fullName: 'Juan Soto', firstName: 'Juan', lastName: 'Soto', primaryPosition: 'RF', currentTeam: 'NYM', currentTeamId: 121, photoUrl: buildPhotoUrl(665742), battingStats: { gamesPlayed: 157, atBats: 526, runs: 128, hits: 166, doubles: 31, triples: 2, homeRuns: 41, rbi: 109, walks: 129, strikeouts: 119, stolenBases: 4, avg: 0.288, obp: 0.419, slg: 0.569, ops: 0.988 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 660670, fullName: 'Ronald Acuna Jr', firstName: 'Ronald', lastName: 'Acuna Jr', primaryPosition: 'CF', currentTeam: 'ATL', currentTeamId: 144, photoUrl: buildPhotoUrl(660670), battingStats: { gamesPlayed: 119, atBats: 467, runs: 101, hits: 135, doubles: 24, triples: 3, homeRuns: 17, rbi: 55, walks: 68, strikeouts: 100, stolenBases: 34, avg: 0.289, obp: 0.385, slg: 0.463, ops: 0.848 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 545361, fullName: 'Mike Trout', firstName: 'Mike', lastName: 'Trout', primaryPosition: 'CF', currentTeam: 'LAA', currentTeamId: 108, photoUrl: buildPhotoUrl(545361), battingStats: { gamesPlayed: 82, atBats: 309, runs: 54, hits: 86, doubles: 14, triples: 0, homeRuns: 18, rbi: 44, walks: 49, strikeouts: 90, stolenBases: 6, avg: 0.278, obp: 0.378, slg: 0.498, ops: 0.876 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 608369, fullName: 'Mookie Betts', firstName: 'Mookie', lastName: 'Betts', primaryPosition: 'SS', currentTeam: 'LAD', currentTeamId: 119, photoUrl: buildPhotoUrl(608369), battingStats: { gamesPlayed: 116, atBats: 442, runs: 87, hits: 125, doubles: 21, triples: 1, homeRuns: 19, rbi: 69, walks: 52, strikeouts: 78, stolenBases: 14, avg: 0.282, obp: 0.360, slg: 0.459, ops: 0.819 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 665489, fullName: 'Trea Turner', firstName: 'Trea', lastName: 'Turner', primaryPosition: 'SS', currentTeam: 'PHI', currentTeamId: 143, photoUrl: buildPhotoUrl(665489), battingStats: { gamesPlayed: 151, atBats: 607, runs: 102, hits: 172, doubles: 33, triples: 4, homeRuns: 21, rbi: 88, walks: 47, strikeouts: 104, stolenBases: 32, avg: 0.283, obp: 0.339, slg: 0.451, ops: 0.790 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 621566, fullName: 'Jose Ramirez', firstName: 'Jose', lastName: 'Ramirez', primaryPosition: '3B', currentTeam: 'CLE', currentTeamId: 114, photoUrl: buildPhotoUrl(621566), battingStats: { gamesPlayed: 158, atBats: 604, runs: 108, hits: 175, doubles: 36, triples: 1, homeRuns: 39, rbi: 118, walks: 65, strikeouts: 83, stolenBases: 21, avg: 0.290, obp: 0.355, slg: 0.535, ops: 0.890 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 665487, fullName: 'Bobby Witt Jr', firstName: 'Bobby', lastName: 'Witt Jr', primaryPosition: 'SS', currentTeam: 'KC', currentTeamId: 118, photoUrl: buildPhotoUrl(665487), battingStats: { gamesPlayed: 161, atBats: 648, runs: 125, hits: 211, doubles: 45, triples: 11, homeRuns: 32, rbi: 109, walks: 55, strikeouts: 138, stolenBases: 31, avg: 0.332, obp: 0.389, slg: 0.588, ops: 0.977 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 605141, fullName: 'Freddie Freeman', firstName: 'Freddie', lastName: 'Freeman', primaryPosition: '1B', currentTeam: 'LAD', currentTeamId: 119, photoUrl: buildPhotoUrl(605141), battingStats: { gamesPlayed: 147, atBats: 556, runs: 99, hits: 175, doubles: 37, triples: 4, homeRuns: 22, rbi: 89, walks: 73, strikeouts: 97, stolenBases: 8, avg: 0.282, obp: 0.378, slg: 0.476, ops: 0.854 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 502054, fullName: 'Salvador Perez', firstName: 'Salvador', lastName: 'Perez', primaryPosition: 'C', currentTeam: 'KC', currentTeamId: 118, photoUrl: buildPhotoUrl(502054), battingStats: { gamesPlayed: 151, atBats: 531, runs: 76, hits: 139, doubles: 27, triples: 1, homeRuns: 27, rbi: 104, walks: 31, strikeouts: 113, stolenBases: 1, avg: 0.262, obp: 0.309, slg: 0.458, ops: 0.767 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 519317, fullName: 'Marcus Semien', firstName: 'Marcus', lastName: 'Semien', primaryPosition: '2B', currentTeam: 'TEX', currentTeamId: 140, photoUrl: buildPhotoUrl(519317), battingStats: { gamesPlayed: 162, atBats: 667, runs: 101, hits: 168, doubles: 32, triples: 2, homeRuns: 23, rbi: 75, walks: 58, strikeouts: 145, stolenBases: 14, avg: 0.252, obp: 0.318, slg: 0.403, ops: 0.721 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 543685, fullName: 'Christian Yelich', firstName: 'Christian', lastName: 'Yelich', primaryPosition: 'LF', currentTeam: 'MIL', currentTeamId: 158, photoUrl: buildPhotoUrl(543685), battingStats: { gamesPlayed: 142, atBats: 516, runs: 87, hits: 139, doubles: 28, triples: 3, homeRuns: 16, rbi: 58, walks: 74, strikeouts: 144, stolenBases: 17, avg: 0.269, obp: 0.369, slg: 0.424, ops: 0.793 }, pitchingStats: null, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  // Pitchers
  { mlbId: 622663, fullName: 'Tarik Skubal', firstName: 'Tarik', lastName: 'Skubal', primaryPosition: 'SP', currentTeam: 'DET', currentTeamId: 116, photoUrl: buildPhotoUrl(622663), battingStats: null, pitchingStats: { gamesPlayed: 31, gamesStarted: 31, wins: 18, losses: 4, era: 2.39, inningsPitched: 192.0, hits: 140, runs: 56, earnedRuns: 51, homeRuns: 19, walks: 36, strikeouts: 228, whip: 0.92, kPer9: 10.7, bbPer9: 1.7, hrPer9: 0.9 }, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 669373, fullName: 'Zack Wheeler', firstName: 'Zack', lastName: 'Wheeler', primaryPosition: 'SP', currentTeam: 'PHI', currentTeamId: 143, photoUrl: buildPhotoUrl(669373), battingStats: null, pitchingStats: { gamesPlayed: 32, gamesStarted: 32, wins: 16, losses: 7, era: 2.57, inningsPitched: 200.0, hits: 165, runs: 62, earnedRuns: 57, homeRuns: 21, walks: 47, strikeouts: 224, whip: 1.06, kPer9: 10.1, bbPer9: 2.1, hrPer9: 0.9 }, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 477132, fullName: 'Chris Sale', firstName: 'Chris', lastName: 'Sale', primaryPosition: 'SP', currentTeam: 'ATL', currentTeamId: 144, photoUrl: buildPhotoUrl(477132), battingStats: null, pitchingStats: { gamesPlayed: 29, gamesStarted: 29, wins: 18, losses: 3, era: 2.38, inningsPitched: 177.2, hits: 131, runs: 54, earnedRuns: 47, homeRuns: 18, walks: 40, strikeouts: 225, whip: 0.96, kPer9: 11.4, bbPer9: 2.0, hrPer9: 0.9 }, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 594798, fullName: 'Jacob deGrom', firstName: 'Jacob', lastName: 'deGrom', primaryPosition: 'SP', currentTeam: 'TEX', currentTeamId: 140, photoUrl: buildPhotoUrl(594798), battingStats: null, pitchingStats: { gamesPlayed: 8, gamesStarted: 8, wins: 2, losses: 2, era: 4.02, inningsPitched: 40.1, hits: 38, runs: 19, earnedRuns: 18, homeRuns: 6, walks: 12, strikeouts: 55, whip: 1.24, kPer9: 12.3, bbPer9: 2.7, hrPer9: 1.3 }, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 519242, fullName: 'Justin Verlander', firstName: 'Justin', lastName: 'Verlander', primaryPosition: 'SP', currentTeam: 'HOU', currentTeamId: 117, photoUrl: buildPhotoUrl(519242), battingStats: null, pitchingStats: { gamesPlayed: 17, gamesStarted: 17, wins: 5, losses: 6, era: 5.48, inningsPitched: 90.1, hits: 96, runs: 59, earnedRuns: 55, homeRuns: 17, walks: 23, strikeouts: 80, whip: 1.32, kPer9: 8.0, bbPer9: 2.3, hrPer9: 1.7 }, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 623167, fullName: 'Tyler Glasnow', firstName: 'Tyler', lastName: 'Glasnow', primaryPosition: 'SP', currentTeam: 'LAD', currentTeamId: 119, photoUrl: buildPhotoUrl(623167), battingStats: null, pitchingStats: { gamesPlayed: 22, gamesStarted: 22, wins: 9, losses: 6, era: 3.49, inningsPitched: 134.0, hits: 105, runs: 58, earnedRuns: 52, homeRuns: 16, walks: 39, strikeouts: 168, whip: 1.07, kPer9: 11.3, bbPer9: 2.6, hrPer9: 1.1 }, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 656946, fullName: 'Ryan Helsley', firstName: 'Ryan', lastName: 'Helsley', primaryPosition: 'RP', currentTeam: 'STL', currentTeamId: 138, photoUrl: buildPhotoUrl(656946), battingStats: null, pitchingStats: { gamesPlayed: 66, gamesStarted: 0, wins: 6, losses: 4, era: 2.04, inningsPitched: 66.1, hits: 41, runs: 17, earnedRuns: 15, homeRuns: 5, walks: 18, strikeouts: 82, whip: 0.89, kPer9: 11.1, bbPer9: 2.4, hrPer9: 0.7 }, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
  { mlbId: 658551, fullName: 'Emmanuel Clase', firstName: 'Emmanuel', lastName: 'Clase', primaryPosition: 'RP', currentTeam: 'CLE', currentTeamId: 114, photoUrl: buildPhotoUrl(658551), battingStats: null, pitchingStats: { gamesPlayed: 71, gamesStarted: 0, wins: 5, losses: 3, era: 0.61, inningsPitched: 74.1, hits: 44, runs: 8, earnedRuns: 5, homeRuns: 1, walks: 11, strikeouts: 74, whip: 0.74, kPer9: 9.0, bbPer9: 1.3, hrPer9: 0.1 }, seasonYear: 2024, isActive: true, lastUpdated: new Date().toISOString() },
];

// In-memory store for players (can be seeded from sample data)
const playerStore: Map<number, MLBPlayer> = new Map();

// Initialize with sample data in development
if (process.env.NODE_ENV !== 'test') {
  SAMPLE_PLAYERS.forEach(p => playerStore.set(p.mlbId, p));
}

/**
 * Get players with filtering and pagination
 * Uses in-memory store (sample data in dev, mocked in tests)
 */
export async function getPlayers(options: GetPlayersOptions): Promise<GetPlayersResult> {
  let players = Array.from(playerStore.values());

  // Filter by position
  if (options.position) {
    players = players.filter(p => p.primaryPosition === options.position);
  }

  // Filter by team
  if (options.team) {
    players = players.filter(p => p.currentTeam === options.team);
  }

  // Search by name
  if (options.search) {
    const search = options.search.toLowerCase();
    players = players.filter(p => p.fullName.toLowerCase().includes(search));
  }

  if (options.minOps !== undefined) {
    players = players.filter((p) => (p.battingStats?.ops ?? -1) >= options.minOps!);
  }
  if (options.maxOps !== undefined) {
    players = players.filter((p) => (p.battingStats?.ops ?? Number.POSITIVE_INFINITY) <= options.maxOps!);
  }
  if (options.minEra !== undefined) {
    players = players.filter((p) => (p.pitchingStats?.era ?? -1) >= options.minEra!);
  }
  if (options.maxEra !== undefined) {
    players = players.filter((p) => (p.pitchingStats?.era ?? Number.POSITIVE_INFINITY) <= options.maxEra!);
  }
  if (options.minHr !== undefined) {
    players = players.filter((p) => (p.battingStats?.homeRuns ?? -1) >= options.minHr!);
  }
  if (options.maxHr !== undefined) {
    players = players.filter((p) => (p.battingStats?.homeRuns ?? Number.POSITIVE_INFINITY) <= options.maxHr!);
  }
  if (options.minRbi !== undefined) {
    players = players.filter((p) => (p.battingStats?.rbi ?? -1) >= options.minRbi!);
  }
  if (options.maxRbi !== undefined) {
    players = players.filter((p) => (p.battingStats?.rbi ?? Number.POSITIVE_INFINITY) <= options.maxRbi!);
  }

  // Filter to only pitchers when sorting by pitching stats
  const sort = options.sort || 'ops';
  if (sort === 'era' || sort === 'whip' || sort === 'wins') {
    players = players.filter(p => p.primaryPosition === 'SP' || p.primaryPosition === 'RP');
  }

  // Sort
  const order = options.order || 'desc';
  players.sort((a, b) => {
    let aVal = 0, bVal = 0;
    if (sort === 'name') {
      const nameCompare = a.fullName.localeCompare(b.fullName);
      return order === 'desc' ? -nameCompare : nameCompare;
    }
    if (sort === 'ops' || sort === 'avg' || sort === 'hr' || sort === 'rbi') {
      aVal = a.battingStats?.[sort === 'hr' ? 'homeRuns' : sort] ?? 0;
      bVal = b.battingStats?.[sort === 'hr' ? 'homeRuns' : sort] ?? 0;
    } else if (sort === 'era' || sort === 'whip' || sort === 'wins') {
      aVal = a.pitchingStats?.[sort] ?? 999;
      bVal = b.pitchingStats?.[sort] ?? 999;
    }
    return order === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const total = players.length;
  const offset = options.offset || 0;
  const limit = options.limit || 20;
  players = players.slice(offset, offset + limit);

  return { players, total };
}

/**
 * Get a single player by MLB ID
 */
export async function getPlayerById(mlbId: number): Promise<MLBPlayer | null> {
  return playerStore.get(mlbId) || null;
}

/**
 * Clear player store (for testing)
 */
export function clearPlayers(): void {
  playerStore.clear();
}

/**
 * Add players to store (for testing or seeding)
 */
export function addPlayers(players: MLBPlayer[]): void {
  players.forEach(p => playerStore.set(p.mlbId, p));
}
