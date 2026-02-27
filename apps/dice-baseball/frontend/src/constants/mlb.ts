/**
 * MLB Team Constants and Data
 */

export interface MLBTeam {
  id: number;
  name: string;
  city: string;
  abbreviation: string;
  league: 'AL' | 'NL';
  division: 'East' | 'Central' | 'West';
}

export const MLB_TEAMS: MLBTeam[] = [
  // American League East
  { id: 147, name: 'Yankees', city: 'New York', abbreviation: 'NYY', league: 'AL', division: 'East' },
  { id: 111, name: 'Red Sox', city: 'Boston', abbreviation: 'BOS', league: 'AL', division: 'East' },
  { id: 139, name: 'Rays', city: 'Tampa Bay', abbreviation: 'TB', league: 'AL', division: 'East' },
  { id: 110, name: 'Orioles', city: 'Baltimore', abbreviation: 'BAL', league: 'AL', division: 'East' },
  { id: 141, name: 'Blue Jays', city: 'Toronto', abbreviation: 'TOR', league: 'AL', division: 'East' },
  
  // American League Central
  { id: 114, name: 'Guardians', city: 'Cleveland', abbreviation: 'CLE', league: 'AL', division: 'Central' },
  { id: 142, name: 'Twins', city: 'Minnesota', abbreviation: 'MIN', league: 'AL', division: 'Central' },
  { id: 145, name: 'White Sox', city: 'Chicago', abbreviation: 'CWS', league: 'AL', division: 'Central' },
  { id: 116, name: 'Tigers', city: 'Detroit', abbreviation: 'DET', league: 'AL', division: 'Central' },
  { id: 118, name: 'Royals', city: 'Kansas City', abbreviation: 'KC', league: 'AL', division: 'Central' },
  
  // American League West
  { id: 117, name: 'Astros', city: 'Houston', abbreviation: 'HOU', league: 'AL', division: 'West' },
  { id: 140, name: 'Rangers', city: 'Texas', abbreviation: 'TEX', league: 'AL', division: 'West' },
  { id: 133, name: 'Athletics', city: 'Oakland', abbreviation: 'OAK', league: 'AL', division: 'West' },
  { id: 108, name: 'Angels', city: 'Los Angeles', abbreviation: 'LAA', league: 'AL', division: 'West' },
  { id: 136, name: 'Mariners', city: 'Seattle', abbreviation: 'SEA', league: 'AL', division: 'West' },
  
  // National League East
  { id: 144, name: 'Braves', city: 'Atlanta', abbreviation: 'ATL', league: 'NL', division: 'East' },
  { id: 146, name: 'Marlins', city: 'Miami', abbreviation: 'MIA', league: 'NL', division: 'East' },
  { id: 121, name: 'Mets', city: 'New York', abbreviation: 'NYM', league: 'NL', division: 'East' },
  { id: 143, name: 'Phillies', city: 'Philadelphia', abbreviation: 'PHI', league: 'NL', division: 'East' },
  { id: 120, name: 'Nationals', city: 'Washington', abbreviation: 'WSH', league: 'NL', division: 'East' },
  
  // National League Central
  { id: 158, name: 'Brewers', city: 'Milwaukee', abbreviation: 'MIL', league: 'NL', division: 'Central' },
  { id: 112, name: 'Cubs', city: 'Chicago', abbreviation: 'CHC', league: 'NL', division: 'Central' },
  { id: 113, name: 'Reds', city: 'Cincinnati', abbreviation: 'CIN', league: 'NL', division: 'Central' },
  { id: 134, name: 'Pirates', city: 'Pittsburgh', abbreviation: 'PIT', league: 'NL', division: 'Central' },
  { id: 138, name: 'Cardinals', city: 'St. Louis', abbreviation: 'STL', league: 'NL', division: 'Central' },
  
  // National League West
  { id: 109, name: 'Diamondbacks', city: 'Arizona', abbreviation: 'AZ', league: 'NL', division: 'West' },
  { id: 115, name: 'Rockies', city: 'Colorado', abbreviation: 'COL', league: 'NL', division: 'West' },
  { id: 119, name: 'Dodgers', city: 'Los Angeles', abbreviation: 'LAD', league: 'NL', division: 'West' },
  { id: 135, name: 'Padres', city: 'San Diego', abbreviation: 'SD', league: 'NL', division: 'West' },
  { id: 137, name: 'Giants', city: 'San Francisco', abbreviation: 'SF', league: 'NL', division: 'West' },
];

export const LEAGUE_OPTIONS = [
  { value: '', label: 'All Leagues' },
  { value: 'AL', label: 'American League' },
  { value: 'NL', label: 'National League' },
];

export const TEAM_OPTIONS = [
  { value: '', label: 'All Teams' },
  ...MLB_TEAMS
    .sort((a, b) => a.city.localeCompare(b.city))
    .map(team => ({
      value: team.abbreviation,
      label: `${team.city} ${team.name}`,
    }))
];

// Helper functions
export function getTeamByAbbreviation(abbreviation: string | null): MLBTeam | undefined {
  if (!abbreviation) return undefined;
  return MLB_TEAMS.find(team => team.abbreviation === abbreviation);
}

export function getTeamById(id: number): MLBTeam | undefined {
  return MLB_TEAMS.find(team => team.id === id);
}

export function getTeamsByLeague(league: 'AL' | 'NL'): MLBTeam[] {
  return MLB_TEAMS.filter(team => team.league === league);
}

export function getTeamsByDivision(league: 'AL' | 'NL', division: 'East' | 'Central' | 'West'): MLBTeam[] {
  return MLB_TEAMS.filter(team => team.league === league && team.division === division);
}
