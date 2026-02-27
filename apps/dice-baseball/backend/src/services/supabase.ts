// @ts-nocheck
/**
 * Supabase Service Layer
 * 
 * Provides database access and authentication integration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import type { 
  User,
  Team, 
  GameSession,
  MLBPlayer,
  RosterSlot,
  GameMove
} from '../types/contracts/index';

dotenv.config();

// Database types
interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          username: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          games_played: number;
          wins: number;
          losses: number;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      mlb_players: {
        Row: {
          mlb_id: number;
          full_name: string;
          first_name: string;
          last_name: string;
          primary_position: string;
          jersey_number: string | null;
          current_team: string | null;
          is_active: boolean;
          photo_url: string | null;
          batting_stats: any;
          pitching_stats: any;
          fielding_stats: any;
          height: string | null;
          weight: number | null;
          birth_date: string | null;
          debut_date: string | null;
          bat_side: 'L' | 'R' | 'S' | null;
          throw_side: 'L' | 'R' | null;
          salary: number | null;
          overall_rating: number | null;
          last_updated: string;
        };
        Insert: Omit<Database['public']['Tables']['mlb_players']['Row'], 'last_updated'>;
        Update: Partial<Database['public']['Tables']['mlb_players']['Insert']>;
      };
      teams: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          abbreviation: string | null;
          logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          games_played: number;
          wins: number;
          losses: number;
        };
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['teams']['Insert']>;
      };
      roster_slots: {
        Row: {
          id: string;
          team_id: string;
          mlb_player_id: number | null;
          position: string;
          batting_order: number | null;
          is_starting_pitcher: boolean;
        };
        Insert: Omit<Database['public']['Tables']['roster_slots']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['roster_slots']['Insert']>;
      };
      game_sessions: {
        Row: {
          id: string;
          join_code: string | null;
          status: string;
          home_user_id: string | null;
          home_team_id: string | null;
          home_ready: boolean;
          visitor_user_id: string | null;
          visitor_team_id: string | null;
          visitor_ready: boolean;
          game_state: any;
          winner_id: string | null;
          final_score_home: number | null;
          final_score_visitor: number | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          last_activity: string;
        };
        Insert: Omit<Database['public']['Tables']['game_sessions']['Row'], 'id' | 'created_at' | 'last_activity'>;
        Update: Partial<Database['public']['Tables']['game_sessions']['Insert']>;
      };
      game_moves: {
        Row: {
          id: string;
          game_id: string;
          move_number: number;
          inning: number;
          is_top_of_inning: boolean;
          player_id: string;
          batter_mlb_id: number | null;
          pitcher_mlb_id: number | null;
          dice_roll: number[] | null;
          outcome: string;
          description: string | null;
          state_after: any;
          runs_scored: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['game_moves']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['game_moves']['Insert']>;
      };
    };
  };
}

// Team abbreviation -> full MLB API name mapping
// The MLB API stores full team names (e.g. "New York Yankees") but the frontend filters by abbreviation ("NYY")
const TEAM_ABBREV_TO_NAME: Record<string, string> = {
  'NYY': 'New York Yankees',
  'BOS': 'Boston Red Sox',
  'TB': 'Tampa Bay Rays',
  'BAL': 'Baltimore Orioles',
  'TOR': 'Toronto Blue Jays',
  'CLE': 'Cleveland Guardians',
  'MIN': 'Minnesota Twins',
  'CWS': 'Chicago White Sox',
  'DET': 'Detroit Tigers',
  'KC': 'Kansas City Royals',
  'HOU': 'Houston Astros',
  'TEX': 'Texas Rangers',
  'OAK': 'Oakland Athletics',
  'LAA': 'Los Angeles Angels',
  'SEA': 'Seattle Mariners',
  'ATL': 'Atlanta Braves',
  'MIA': 'Miami Marlins',
  'NYM': 'New York Mets',
  'PHI': 'Philadelphia Phillies',
  'WSH': 'Washington Nationals',
  'MIL': 'Milwaukee Brewers',
  'CHC': 'Chicago Cubs',
  'CIN': 'Cincinnati Reds',
  'PIT': 'Pittsburgh Pirates',
  'STL': 'St. Louis Cardinals',
  'AZ': 'Arizona Diamondbacks',
  'COL': 'Colorado Rockies',
  'LAD': 'Los Angeles Dodgers',
  'SD': 'San Diego Padres',
  'SF': 'San Francisco Giants',
};

const AL_ABBREVS = ['NYY','BOS','TB','BAL','TOR','CLE','MIN','CWS','DET','KC','HOU','TEX','OAK','LAA','SEA'];
const NL_ABBREVS = ['ATL','MIA','NYM','PHI','WSH','MIL','CHC','CIN','PIT','STL','AZ','COL','LAD','SD','SF'];

function getTeamNamesForLeague(league: string): string[] {
  const abbrevs = league === 'AL' ? AL_ABBREVS : league === 'NL' ? NL_ABBREVS : [];
  return abbrevs.map(a => TEAM_ABBREV_TO_NAME[a]).filter(Boolean);
}

class SupabaseService {
  private client: SupabaseClient<Database>;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    this.client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });
  }

  // =========================================
  // User Management
  // =========================================
  
  async createUser(email: string, username: string, password: string): Promise<User> {
    // Create auth user
    const { data: authData, error: authError } = await this.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    
    if (authError) throw authError;
    
    // Create profile
    const { data, error } = await this.client
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        username,
        games_played: 0,
        wins: 0,
        losses: 0
      })
      .select()
      .single();
    
    if (error) {
      // Rollback auth user if profile creation fails
      await this.client.auth.admin.deleteUser(authData.user.id);
      throw error;
    }
    
    return this.mapToUser(data);
  }
  
  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) return null;
    return this.mapToUser(data);
  }
  
  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return null;
    return this.mapToUser(data);
  }
  
  async validatePassword(email: string, password: string): Promise<User | null> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    
    if (error || !data.user) return null;
    
    return this.getUserById(data.user.id);
  }
  
  // =========================================
  // MLB Player Management
  // =========================================
  
  async upsertMLBPlayer(player: Partial<MLBPlayer>): Promise<void> {
    const { error } = await this.client
      .from('mlb_players')
      .upsert({
        mlb_id: player.mlbId!,
        full_name: player.fullName!,
        first_name: player.firstName!,
        last_name: player.lastName!,
        primary_position: player.primaryPosition!,
        jersey_number: player.jerseyNumber,
        current_team: player.currentTeam,
        is_active: player.isActive ?? true,
        photo_url: player.photoUrl,
        batting_stats: player.battingStats,
        pitching_stats: player.pitchingStats,
        height: player.height,
        weight: player.weight,
        bat_side: player.batSide as any,
        throw_side: player.throwSide as any
      })
      .eq('mlb_id', player.mlbId!);
    
    if (error) throw error;
  }
  
  async getMLBPlayers(filters?: {
    position?: string;
    team?: string;
    league?: string;
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
  }): Promise<{ players: MLBPlayer[]; total: number }> {
    // Build the main query
    let query = this.client
      .from('mlb_players')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Apply filters
    if (filters?.position) {
      query = query.eq('primary_position', filters.position);
    }

    // Team filter: translate abbreviation to full team name stored in DB
    if (filters?.team) {
      const teamName = TEAM_ABBREV_TO_NAME[filters.team] || filters.team;
      query = query.eq('current_team', teamName);
    }

    // League filter: get all team names for the league and use IN filter
    if (filters?.league && !filters?.team) {
      const leagueTeamNames = getTeamNamesForLeague(filters.league);
      if (leagueTeamNames.length > 0) {
        query = query.in('current_team', leagueTeamNames);
      }
    }

    if (filters?.search) {
      query = query.ilike('full_name', `%${filters.search}%`);
    }

    // Stats filters - use -> (JSON accessor, preserves numeric type for comparison)
    // NOT ->> (text accessor, would do text comparison: "9" > "30")
    if (filters?.minOps !== undefined) {
      query = query.gte('batting_stats->ops', filters.minOps);
    }
    if (filters?.maxOps !== undefined) {
      query = query.lte('batting_stats->ops', filters.maxOps);
    }
    if (filters?.minEra !== undefined) {
      query = query.gte('pitching_stats->era', filters.minEra);
    }
    if (filters?.maxEra !== undefined) {
      query = query.lte('pitching_stats->era', filters.maxEra);
    }
    if (filters?.minHr !== undefined) {
      query = query.gte('batting_stats->homeRuns', filters.minHr);
    }
    if (filters?.maxHr !== undefined) {
      query = query.lte('batting_stats->homeRuns', filters.maxHr);
    }
    if (filters?.minRbi !== undefined) {
      query = query.gte('batting_stats->rbi', filters.minRbi);
    }
    if (filters?.maxRbi !== undefined) {
      query = query.lte('batting_stats->rbi', filters.maxRbi);
    }

    // Sorting - use -> for JSONB (preserves numeric type)
    const sort = filters?.sort || 'ops';
    const order = filters?.order || 'desc';

    if (sort === 'name') {
      query = query.order('full_name', { ascending: order === 'asc' });
    } else if (sort === 'ops' || sort === 'avg' || sort === 'hr' || sort === 'rbi') {
      const field = sort === 'hr' ? 'homeRuns' : sort;
      query = query.order(`batting_stats->${field}`, {
        ascending: order === 'asc',
        nullsFirst: false,
      });
    } else if (sort === 'era' || sort === 'whip' || sort === 'wins') {
      query = query.order(`pitching_stats->${sort}`, {
        ascending: order === 'asc',
        nullsFirst: false,
      });
    }

    // Pagination
    if (filters?.offset !== undefined && filters?.limit !== undefined) {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    } else if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      players: (data || []).map(this.mapToMLBPlayer),
      total: count || 0
    };
  }
  
  async getMLBPlayerById(mlbId: number): Promise<MLBPlayer | null> {
    const { data, error } = await this.client
      .from('mlb_players')
      .select('*')
      .eq('mlb_id', mlbId)
      .single();
    
    if (error || !data) return null;
    return this.mapToMLBPlayer(data);
  }
  
  // =========================================
  // Team Management
  // =========================================
  
  async createTeam(userId: string, name: string): Promise<Team> {
    const { data, error } = await this.client
      .from('teams')
      .insert({
        user_id: userId,
        name,
        primary_color: '#FF0000',
        secondary_color: '#FFFFFF',
        is_active: true,
        games_played: 0,
        wins: 0,
        losses: 0
      })
      .select()
      .single();
    
    if (error) throw error;
    return this.mapToTeam(data);
  }
  
  async getTeamsByUserId(userId: string): Promise<Team[]> {
    const { data, error } = await this.client
      .from('teams')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) throw error;
    return (data || []).map(this.mapToTeam);
  }
  
  async getTeamById(teamId: string): Promise<Team | null> {
    const { data, error } = await this.client
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();
    
    if (error || !data) return null;
    return this.mapToTeam(data);
  }
  
  async updateTeamRoster(teamId: string, roster: RosterSlot[]): Promise<void> {
    // Delete existing roster
    await this.client
      .from('roster_slots')
      .delete()
      .eq('team_id', teamId);
    
    // Insert new roster
    const rosterData = roster.map(slot => ({
      team_id: teamId,
      mlb_player_id: slot.playerId,
      position: slot.position,
      batting_order: slot.battingOrder,
      is_starting_pitcher: slot.position === 'P'
    }));
    
    const { error } = await this.client
      .from('roster_slots')
      .insert(rosterData);
    
    if (error) throw error;
  }
  
  async getTeamRoster(teamId: string): Promise<RosterSlot[]> {
    const { data, error } = await this.client
      .from('roster_slots')
      .select(`
        *,
        player:mlb_players(*)
      `)
      .eq('team_id', teamId);
    
    if (error) throw error;
    
    return (data || []).map(slot => ({
      position: slot.position,
      playerId: slot.mlb_player_id,
      battingOrder: slot.batting_order,
      player: slot.player ? this.mapToMLBPlayer(slot.player) : undefined
    }));
  }
  
  // =========================================
  // Game Management
  // =========================================
  
  async createGameSession(userId: string, teamId: string): Promise<GameSession> {
    const { data, error } = await this.client
      .rpc('create_game_session', {
        p_user_id: userId,
        p_team_id: teamId
      });
    
    if (error) throw error;
    
    return this.getGameSessionById(data);
  }
  
  async joinGameSession(joinCode: string, userId: string, teamId: string): Promise<GameSession> {
    const { data, error } = await this.client
      .rpc('join_game_session', {
        p_join_code: joinCode,
        p_user_id: userId,
        p_team_id: teamId
      });
    
    if (error) throw error;
    
    return this.getGameSessionById(data);
  }
  
  async getGameSessionById(gameId: string): Promise<GameSession> {
    const { data, error } = await this.client
      .from('game_sessions')
      .select(`
        *,
        home_user:users!game_sessions_home_user_id_fkey(*),
        visitor_user:users!game_sessions_visitor_user_id_fkey(*),
        home_team:teams!game_sessions_home_team_id_fkey(*),
        visitor_team:teams!game_sessions_visitor_team_id_fkey(*)
      `)
      .eq('id', gameId)
      .single();
    
    if (error) throw error;
    return this.mapToGameSession(data);
  }
  
  async updateGameState(gameId: string, gameState: any): Promise<void> {
    const { error } = await this.client
      .from('game_sessions')
      .update({
        game_state: gameState,
        last_activity: new Date().toISOString()
      })
      .eq('id', gameId);
    
    if (error) throw error;
  }
  
  async saveGameMove(move: Omit<GameMove, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await this.client
      .from('game_moves')
      .insert({
        game_id: move.gameId,
        move_number: move.moveNumber,
        inning: move.inning,
        is_top_of_inning: move.isTopOfInning,
        player_id: move.playerId,
        batter_mlb_id: move.batterMlbId,
        pitcher_mlb_id: move.pitcherMlbId,
        dice_roll: move.diceRoll,
        outcome: move.outcome,
        description: move.description,
        state_after: move.stateAfter,
        runs_scored: move.runsScored
      });
    
    if (error) throw error;
  }
  
  async completeGame(gameId: string, winnerId: string, homeScore: number, visitorScore: number): Promise<void> {
    const { error } = await this.client
      .from('game_sessions')
      .update({
        status: 'completed',
        winner_id: winnerId,
        final_score_home: homeScore,
        final_score_visitor: visitorScore,
        completed_at: new Date().toISOString()
      })
      .eq('id', gameId);
    
    if (error) throw error;
    
    // Update user and team stats
    await this.client.rpc('update_user_stats_after_game', {
      p_game_id: gameId
    });
  }
  
  // =========================================
  // Utility Mappers
  // =========================================
  
  private mapToUser(data: Database['public']['Tables']['users']['Row']): User {
    return {
      id: data.id,
      email: data.email,
      username: data.username,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      stats: {
        gamesPlayed: data.games_played,
        wins: data.wins,
        losses: data.losses,
        winRate: data.games_played > 0 ? data.wins / data.games_played : 0
      }
    };
  }
  
  private mapToMLBPlayer(data: any): MLBPlayer {
    return {
      mlbId: data.mlb_id,
      fullName: data.full_name,
      firstName: data.first_name,
      lastName: data.last_name,
      primaryPosition: data.primary_position,
      jerseyNumber: data.jersey_number,
      currentTeam: data.current_team,
      isActive: data.is_active,
      photoUrl: data.photo_url,
      battingStats: data.batting_stats,
      pitchingStats: data.pitching_stats,
      height: data.height,
      weight: data.weight,
      batSide: data.bat_side,
      throwSide: data.throw_side
    };
  }
  
  private mapToTeam(data: Database['public']['Tables']['teams']['Row']): Team {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      abbreviation: data.abbreviation,
      logoUrl: data.logo_url,
      primaryColor: data.primary_color,
      secondaryColor: data.secondary_color,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      stats: {
        gamesPlayed: data.games_played,
        wins: data.wins,
        losses: data.losses,
        winRate: data.games_played > 0 ? data.wins / data.games_played : 0
      }
    };
  }
  
  private mapToGameSession(data: any): GameSession {
    return {
      id: data.id,
      joinCode: data.join_code,
      status: data.status as any,
      homeUserId: data.home_user_id,
      homeTeamId: data.home_team_id,
      homeReady: data.home_ready,
      visitorUserId: data.visitor_user_id,
      visitorTeamId: data.visitor_team_id,
      visitorReady: data.visitor_ready,
      gameState: data.game_state,
      winnerId: data.winner_id,
      finalScoreHome: data.final_score_home,
      finalScoreVisitor: data.final_score_visitor,
      createdAt: data.created_at,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      lastActivity: data.last_activity,
      homeUser: data.home_user ? this.mapToUser(data.home_user) : undefined,
      visitorUser: data.visitor_user ? this.mapToUser(data.visitor_user) : undefined,
      homeTeam: data.home_team ? this.mapToTeam(data.home_team) : undefined,
      visitorTeam: data.visitor_team ? this.mapToTeam(data.visitor_team) : undefined
    };
  }
}

// Export singleton instance
export const supabase = new SupabaseService();

// Export types
export type { Database };