// @ts-nocheck
/**
 * MLB Stats API Integration Service
 * 
 * Fetches real MLB player data from the official MLB Stats API
 * and syncs it to our Supabase database
 */

import { supabase } from './supabase.js';
import type { MLBPlayer } from '../types/contracts/index';

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

// Use the most recent completed season for stats
// MLB season runs April-October; during off-season (Nov-Mar), use previous year
function getStatsSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // If we're before April, the previous year's season is the most recent complete one
  return month < 3 ? year - 1 : year;
}

const SEASON = getStatsSeason();

// API Response Types
interface MLBApiPlayer {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryPosition?: {
    code: string;
    abbreviation: string;
  };
  jerseyNumber?: string;
  currentTeam?: {
    id: number;
    name: string;
  };
  active: boolean;
  batSide?: {
    code: string;
  };
  pitchHand?: {
    code: string;
  };
  height?: string;
  weight?: number;
  birthDate?: string;
  mlbDebutDate?: string;
}

interface MLBApiStats {
  splits?: Array<{
    season: string;
    stat: {
      // Batting stats
      gamesPlayed?: number;
      atBats?: number;
      runs?: number;
      hits?: number;
      doubles?: number;
      triples?: number;
      homeRuns?: number;
      rbi?: number;
      baseOnBalls?: number;
      strikeOuts?: number;
      stolenBases?: number;
      avg?: string;
      obp?: string;
      slg?: string;
      ops?: string;
      // Pitching stats
      gamesStarted?: number;
      wins?: number;
      losses?: number;
      era?: string;
      inningsPitched?: string;
      earnedRuns?: number;
      whip?: string;
      strikeoutsPer9?: string;
      walksPer9?: string;
      homeRunsPer9?: string;
    };
  }>;
}

export class MLBApiSyncService {
  
  /**
   * Fetch all active MLB rosters and sync to database
   */
  async syncAllMLBPlayers(): Promise<void> {
    console.log('🔄 Starting MLB player sync...');
    
    try {
      // Get all MLB teams
      const teams = await this.fetchAllTeams();
      console.log(`📋 Found ${teams.length} MLB teams`);
      
      let totalPlayers = 0;
      
      // Fetch roster for each team
      for (const team of teams) {
        const players = await this.fetchTeamRoster(team.id, team.name);
        console.log(`  📊 ${team.name}: ${players.length} players`);
        
        // Sync each player with stats
        for (const player of players) {
          await this.syncPlayer(player);
          totalPlayers++;
          
          // Rate limit: 10 players per second
          if (totalPlayers % 10 === 0) {
            await this.delay(1000);
          }
        }
      }
      
      console.log(`✅ Synced ${totalPlayers} players successfully`);
    } catch (error) {
      console.error('❌ MLB sync failed:', error);
      throw error;
    }
  }
  
  /**
   * Fetch all MLB teams
   */
  private async fetchAllTeams(): Promise<Array<{ id: number; name: string }>> {
    const response = await fetch(`${MLB_API_BASE}/teams?sportId=1&season=${SEASON}`);
    const data = await response.json();
    
    return data.teams.map((team: any) => ({
      id: team.id,
      name: team.name
    }));
  }
  
  /**
   * Fetch roster for a specific team
   */
  private async fetchTeamRoster(teamId: number, teamName: string): Promise<MLBApiPlayer[]> {
    const response = await fetch(`${MLB_API_BASE}/teams/${teamId}/roster?rosterType=active`);
    const data = await response.json();

    return (data.roster || []).map((entry: any) => ({
      ...entry.person,
      // Position is on the roster entry, not inside entry.person
      primaryPosition: entry.position,
      jerseyNumber: entry.jerseyNumber,
      currentTeam: { id: teamId, name: teamName }
    }));
  }
  
  /**
   * Fetch player stats for the current season
   */
  private async fetchPlayerStats(playerId: number, group: 'hitting' | 'pitching'): Promise<MLBApiStats | null> {
    try {
      const response = await fetch(
        `${MLB_API_BASE}/people/${playerId}/stats?stats=season&season=${SEASON}&group=${group}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.stats?.[0] || null;
    } catch (error) {
      console.warn(`⚠️ Could not fetch ${group} stats for player ${playerId}`);
      return null;
    }
  }
  
  /**
   * Parse first and last name from fullName if individual fields are missing
   */
  private parsePlayerName(apiPlayer: MLBApiPlayer): { firstName: string; lastName: string } {
    // Use API fields if available
    if (apiPlayer.firstName && apiPlayer.lastName) {
      return {
        firstName: apiPlayer.firstName,
        lastName: apiPlayer.lastName
      };
    }
    
    // Parse from fullName if individual fields are missing
    const fullName = apiPlayer.fullName || '';
    const nameParts = fullName.trim().split(' ');
    
    if (nameParts.length >= 2) {
      return {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ')
      };
    }
    
    // Fallback for single names or empty
    return {
      firstName: nameParts[0] || 'Unknown',
      lastName: nameParts[0] || 'Player'
    };
  }

  /**
   * Sync a single player to the database
   */
  private async syncPlayer(apiPlayer: MLBApiPlayer): Promise<void> {
    try {
      // Use position abbreviation (e.g. "SS", "CF", "SP") not numeric code
      const positionAbbrev = apiPlayer.primaryPosition?.abbreviation || 'DH';
      const positionCode = apiPlayer.primaryPosition?.code || '';

      // Pitchers have code "1" or abbreviation "P"/"SP"/"RP"
      const isPitcher = positionCode === '1' || positionAbbrev === 'P';

      // Map generic "P" to "SP" for starting pitchers (most roster pitchers)
      const position = positionAbbrev === 'P' ? 'SP' : positionAbbrev;

      // Fetch stats based on position — fetch both for two-way players
      const battingData = !isPitcher ?
        await this.fetchPlayerStats(apiPlayer.id, 'hitting') : null;
      const pitchingData = isPitcher ?
        await this.fetchPlayerStats(apiPlayer.id, 'pitching') : null;

      // Parse name components
      const { firstName, lastName } = this.parsePlayerName(apiPlayer);

      // Transform to our format
      const player: Partial<MLBPlayer> = {
        mlbId: apiPlayer.id,
        fullName: apiPlayer.fullName,
        firstName,
        lastName,
        primaryPosition: position,
        jerseyNumber: apiPlayer.jerseyNumber,
        currentTeam: apiPlayer.currentTeam?.name || null,
        isActive: apiPlayer.active ?? true,
        photoUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${apiPlayer.id}/headshot/67/current`,
        height: apiPlayer.height,
        weight: apiPlayer.weight,
        batSide: apiPlayer.batSide?.code as any,
        throwSide: apiPlayer.pitchHand?.code as any,
        battingStats: battingData ? this.extractBattingStats(battingData) : null,
        pitchingStats: pitchingData ? this.extractPitchingStats(pitchingData) : null
      };

      // Upsert to database
      await supabase.upsertMLBPlayer(player);
    } catch (error) {
      console.error(`❌ Failed to sync player ${apiPlayer.fullName}:`, error);
    }
  }
  
  /**
   * Extract batting stats from API response
   */
  private extractBattingStats(data: MLBApiStats): any {
    const stats = data.splits?.[0]?.stat;
    if (!stats) return null;
    
    return {
      gamesPlayed: stats.gamesPlayed || 0,
      atBats: stats.atBats || 0,
      runs: stats.runs || 0,
      hits: stats.hits || 0,
      doubles: stats.doubles || 0,
      triples: stats.triples || 0,
      homeRuns: stats.homeRuns || 0,
      rbi: stats.rbi || 0,
      walks: stats.baseOnBalls || 0,
      strikeouts: stats.strikeOuts || 0,
      stolenBases: stats.stolenBases || 0,
      avg: parseFloat(stats.avg || '0'),
      obp: parseFloat(stats.obp || '0'),
      slg: parseFloat(stats.slg || '0'),
      ops: parseFloat(stats.ops || '0')
    };
  }
  
  /**
   * Extract pitching stats from API response
   */
  private extractPitchingStats(data: MLBApiStats): any {
    const stats = data.splits?.[0]?.stat;
    if (!stats) return null;
    
    return {
      gamesPlayed: stats.gamesPlayed || 0,
      gamesStarted: stats.gamesStarted || 0,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      era: parseFloat(stats.era || '0'),
      inningsPitched: parseFloat(stats.inningsPitched || '0'),
      hits: stats.hits || 0,
      runs: stats.runs || 0,
      earnedRuns: stats.earnedRuns || 0,
      homeRuns: stats.homeRuns || 0,
      walks: stats.baseOnBalls || 0,
      strikeouts: stats.strikeOuts || 0,
      whip: parseFloat(stats.whip || '0'),
      kPer9: parseFloat(stats.strikeoutsPer9 || '0'),
      bbPer9: parseFloat(stats.walksPer9 || '0'),
      hrPer9: parseFloat(stats.homeRunsPer9 || '0')
    };
  }
  
  /**
   * Sync specific high-profile players (for testing/demo)
   */
  async syncDemoPlayers(): Promise<void> {
    console.log('🎯 Syncing demo players...');
    
    const demoPlayerIds = [
      545361, // Mike Trout
      660271, // Shohei Ohtani
      605141, // Mookie Betts
      665487, // Juan Soto
      592450, // Aaron Judge
      668227, // Ronald Acuña Jr.
      543037, // Gerrit Cole
      605483, // Spencer Strider
      666201, // Corbin Burnes
      594798  // Jacob deGrom
    ];
    
    for (const playerId of demoPlayerIds) {
      try {
        const response = await fetch(`${MLB_API_BASE}/people/${playerId}`);
        const data = await response.json();
        
        if (data.people?.[0]) {
          await this.syncPlayer(data.people[0]);
          console.log(`  ✅ Synced ${data.people[0].fullName}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to sync player ${playerId}`);
      }
    }
    
    console.log('✅ Demo players synced');
  }
  
  /**
   * Utility: delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const mlbApiSync = new MLBApiSyncService();

// Cron job function for scheduled sync
export async function runMLBSync(): Promise<void> {
  console.log(`⏰ MLB Sync Cron Job Started at ${new Date().toISOString()}`);
  
  try {
    await mlbApiSync.syncAllMLBPlayers();
    console.log('✅ MLB Sync Cron Job Completed Successfully');
  } catch (error) {
    console.error('❌ MLB Sync Cron Job Failed:', error);
  }
}

// CLI command for manual sync
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'demo') {
    mlbApiSync.syncDemoPlayers().then(() => {
      console.log('Demo sync complete');
      process.exit(0);
    });
  } else if (command === 'full') {
    mlbApiSync.syncAllMLBPlayers().then(() => {
      console.log('Full sync complete');
      process.exit(0);
    });
  } else {
    console.log('Usage: node mlb-api-sync.js [demo|full]');
    console.log('  demo - Sync 10 demo players');
    console.log('  full - Sync all MLB players (~750)');
    process.exit(1);
  }
}