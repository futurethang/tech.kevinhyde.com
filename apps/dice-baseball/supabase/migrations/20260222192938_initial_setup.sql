-- Dice Baseball V2: Initial Database Schema
-- This migration creates all core tables for the application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Lifetime stats
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    
    -- Constraints
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    CONSTRAINT email_format CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$')
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- =====================================================
-- MLB PLAYERS TABLE
-- =====================================================
CREATE TABLE mlb_players (
    mlb_id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    primary_position TEXT NOT NULL,
    jersey_number TEXT,
    current_team TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    photo_url TEXT,
    
    -- Stats as JSONB for flexibility
    batting_stats JSONB,
    pitching_stats JSONB,
    fielding_stats JSONB,
    
    -- Metadata
    height TEXT,
    weight INTEGER,
    birth_date DATE,
    debut_date DATE,
    bat_side TEXT CHECK (bat_side IN ('L', 'R', 'S')),
    throw_side TEXT CHECK (throw_side IN ('L', 'R')),
    
    -- For game balance
    salary INTEGER,
    overall_rating INTEGER,
    
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mlb_players_position ON mlb_players(primary_position);
CREATE INDEX idx_mlb_players_team ON mlb_players(current_team);
CREATE INDEX idx_mlb_players_active ON mlb_players(is_active);
CREATE INDEX idx_mlb_players_search ON mlb_players 
    USING gin(to_tsvector('english', full_name || ' ' || COALESCE(current_team, '')));
CREATE INDEX idx_mlb_players_batting_stats ON mlb_players USING gin(batting_stats);
CREATE INDEX idx_mlb_players_pitching_stats ON mlb_players USING gin(pitching_stats);

-- =====================================================
-- TEAMS TABLE
-- =====================================================
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    abbreviation TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#FF0000',
    secondary_color TEXT DEFAULT '#FFFFFF',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Stats
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT team_name_length CHECK (char_length(name) >= 3 AND char_length(name) <= 30),
    CONSTRAINT abbreviation_length CHECK (char_length(abbreviation) <= 3)
);

-- Indexes
CREATE INDEX idx_teams_user ON teams(user_id);
CREATE INDEX idx_teams_active ON teams(user_id, is_active);

-- =====================================================
-- ROSTER SLOTS TABLE
-- =====================================================
CREATE TABLE roster_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    mlb_player_id INTEGER REFERENCES mlb_players(mlb_id) ON DELETE SET NULL,
    position TEXT NOT NULL,
    batting_order INTEGER,
    is_starting_pitcher BOOLEAN NOT NULL DEFAULT false,
    
    -- Ensure valid positions
    CONSTRAINT valid_position CHECK (position IN ('C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P')),
    -- Batting order 1-9 for position players, NULL for pitchers
    CONSTRAINT valid_batting_order CHECK (
        (position = 'P' AND batting_order IS NULL) OR 
        (position != 'P' AND batting_order BETWEEN 1 AND 9)
    ),
    -- One player per roster slot
    CONSTRAINT unique_player_per_team UNIQUE (team_id, mlb_player_id),
    -- One player per position per team
    CONSTRAINT unique_position_per_team UNIQUE (team_id, position)
);

-- Indexes
CREATE INDEX idx_roster_team ON roster_slots(team_id);
CREATE INDEX idx_roster_player ON roster_slots(mlb_player_id);

-- =====================================================
-- GAME SESSIONS TABLE
-- =====================================================
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    join_code TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'waiting',
    
    -- Home team
    home_user_id UUID REFERENCES users(id),
    home_team_id UUID REFERENCES teams(id),
    home_ready BOOLEAN NOT NULL DEFAULT false,
    
    -- Visitor team
    visitor_user_id UUID REFERENCES users(id),
    visitor_team_id UUID REFERENCES teams(id),
    visitor_ready BOOLEAN NOT NULL DEFAULT false,
    
    -- Game state (JSONB for flexibility)
    game_state JSONB NOT NULL DEFAULT '{
        "inning": 1,
        "isTopOfInning": true,
        "outs": 0,
        "bases": [false, false, false],
        "homeScore": 0,
        "visitorScore": 0,
        "currentBatterIndex": {"home": 0, "visitor": 0},
        "balls": 0,
        "strikes": 0
    }'::jsonb,
    
    -- Results
    winner_id UUID REFERENCES users(id),
    final_score_home INTEGER,
    final_score_visitor INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('waiting', 'active', 'paused', 'completed', 'abandoned')),
    CONSTRAINT valid_teams CHECK (home_user_id != visitor_user_id),
    CONSTRAINT join_code_format CHECK (join_code ~ '^[A-Z0-9]{6}$')
);

-- Indexes
CREATE INDEX idx_games_status ON game_sessions(status, created_at);
CREATE INDEX idx_games_users ON game_sessions(home_user_id, visitor_user_id);
CREATE INDEX idx_games_join_code ON game_sessions(join_code) WHERE status = 'waiting';
CREATE INDEX idx_games_active ON game_sessions(status) WHERE status IN ('active', 'paused');

-- =====================================================
-- GAME MOVES TABLE
-- =====================================================
CREATE TABLE game_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    move_number INTEGER NOT NULL,
    inning INTEGER NOT NULL,
    is_top_of_inning BOOLEAN NOT NULL,
    
    -- Who made the move
    player_id UUID NOT NULL REFERENCES users(id),
    batter_mlb_id INTEGER REFERENCES mlb_players(mlb_id),
    pitcher_mlb_id INTEGER REFERENCES mlb_players(mlb_id),
    
    -- Action and result
    dice_roll INTEGER[],
    outcome TEXT NOT NULL,
    description TEXT,
    
    -- Game state after this move
    state_after JSONB NOT NULL,
    runs_scored INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure sequential moves
    CONSTRAINT unique_move_number UNIQUE (game_id, move_number),
    CONSTRAINT valid_dice_roll CHECK (
        array_length(dice_roll, 1) = 2 AND
        dice_roll[1] BETWEEN 1 AND 6 AND
        dice_roll[2] BETWEEN 1 AND 6
    )
);

-- Indexes
CREATE INDEX idx_moves_game ON game_moves(game_id, move_number);
CREATE INDEX idx_moves_player ON game_moves(player_id);

-- =====================================================
-- FRIENDS TABLE (for future social features)
-- =====================================================
CREATE TABLE friends (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (user_id, friend_id),
    CONSTRAINT no_self_friend CHECK (user_id != friend_id),
    CONSTRAINT valid_friend_status CHECK (status IN ('pending', 'accepted', 'blocked'))
);

-- Indexes
CREATE INDEX idx_friends_status ON friends(user_id, status);
CREATE INDEX idx_friends_reverse ON friends(friend_id, status);

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate join codes
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate join codes
CREATE OR REPLACE FUNCTION set_join_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.join_code IS NULL THEN
        LOOP
            NEW.join_code := generate_join_code();
            EXIT WHEN NOT EXISTS (SELECT 1 FROM game_sessions WHERE join_code = NEW.join_code);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_game_join_code BEFORE INSERT ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION set_join_code();-- Dice Baseball V2: Row Level Security Policies
-- This migration sets up RLS policies for secure data access

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlb_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Users can read all user profiles (for leaderboards, etc.)
CREATE POLICY "Users are viewable by everyone"
ON users FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- =====================================================
-- MLB PLAYERS TABLE POLICIES
-- =====================================================

-- Everyone can read MLB player data
CREATE POLICY "MLB players are viewable by everyone"
ON mlb_players FOR SELECT
USING (true);

-- Only service role can modify MLB player data (for sync job)
-- No user policies for INSERT/UPDATE/DELETE

-- =====================================================
-- TEAMS TABLE POLICIES
-- =====================================================

-- Everyone can view active teams
CREATE POLICY "Active teams are viewable by everyone"
ON teams FOR SELECT
USING (is_active = true);

-- Users can create their own teams
CREATE POLICY "Users can create own teams"
ON teams FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own teams
CREATE POLICY "Users can update own teams"
ON teams FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can soft delete their own teams
CREATE POLICY "Users can delete own teams"
ON teams FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- ROSTER SLOTS TABLE POLICIES
-- =====================================================

-- View roster slots for viewable teams
CREATE POLICY "Roster slots viewable with team"
ON roster_slots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE teams.id = roster_slots.team_id 
        AND teams.is_active = true
    )
);

-- Users can manage roster slots for their teams
CREATE POLICY "Users can insert roster slots for own teams"
ON roster_slots FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE teams.id = roster_slots.team_id 
        AND teams.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update roster slots for own teams"
ON roster_slots FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE teams.id = roster_slots.team_id 
        AND teams.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete roster slots for own teams"
ON roster_slots FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE teams.id = roster_slots.team_id 
        AND teams.user_id = auth.uid()
    )
);

-- =====================================================
-- GAME SESSIONS TABLE POLICIES
-- =====================================================

-- Users can view games they're involved in or public games
CREATE POLICY "Users can view relevant games"
ON game_sessions FOR SELECT
USING (
    auth.uid() IN (home_user_id, visitor_user_id) OR
    status = 'waiting' -- Can browse open games
);

-- Users can create games
CREATE POLICY "Users can create games"
ON game_sessions FOR INSERT
WITH CHECK (auth.uid() = home_user_id);

-- Users can update games they're in
CREATE POLICY "Users can update games they're in"
ON game_sessions FOR UPDATE
USING (auth.uid() IN (home_user_id, visitor_user_id))
WITH CHECK (auth.uid() IN (home_user_id, visitor_user_id));

-- =====================================================
-- GAME MOVES TABLE POLICIES
-- =====================================================

-- Users can view moves for games they can see
CREATE POLICY "Users can view moves for accessible games"
ON game_moves FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM game_sessions
        WHERE game_sessions.id = game_moves.game_id
        AND (
            auth.uid() IN (home_user_id, visitor_user_id) OR
            status = 'completed' -- Can view completed game history
        )
    )
);

-- Users can create moves in their active games
CREATE POLICY "Users can create moves in their games"
ON game_moves FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM game_sessions
        WHERE game_sessions.id = game_moves.game_id
        AND auth.uid() IN (home_user_id, visitor_user_id)
        AND status = 'active'
    )
);

-- =====================================================
-- FRIENDS TABLE POLICIES
-- =====================================================

-- Users can view their friends
CREATE POLICY "Users can view own friend relationships"
ON friends FOR SELECT
USING (auth.uid() IN (user_id, friend_id));

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
ON friends FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update friend status (accept/decline)
CREATE POLICY "Users can update friend status"
ON friends FOR UPDATE
USING (auth.uid() IN (user_id, friend_id))
WITH CHECK (auth.uid() IN (user_id, friend_id));

-- Users can remove friends
CREATE POLICY "Users can remove friends"
ON friends FOR DELETE
USING (auth.uid() IN (user_id, friend_id));

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to check if a user owns a team
CREATE OR REPLACE FUNCTION user_owns_team(team_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM teams 
        WHERE id = team_uuid 
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user is in a game
CREATE OR REPLACE FUNCTION user_in_game(game_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM game_sessions 
        WHERE id = game_uuid 
        AND auth.uid() IN (home_user_id, visitor_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INDEXES FOR PERFORMANCE WITH RLS
-- =====================================================

-- Additional indexes to support RLS policies efficiently
CREATE INDEX idx_teams_user_active ON teams(user_id, is_active);
CREATE INDEX idx_game_sessions_participants ON game_sessions(home_user_id, visitor_user_id);
CREATE INDEX idx_friends_participants ON friends(user_id, friend_id);-- Dice Baseball V2: Stored Procedures and Functions
-- This migration creates database functions for game logic

-- =====================================================
-- GAME STATISTICS FUNCTIONS
-- =====================================================

-- Update user statistics after game completion
CREATE OR REPLACE FUNCTION update_user_stats_after_game(
    p_game_id UUID
) RETURNS VOID AS $$
DECLARE
    v_home_user_id UUID;
    v_visitor_user_id UUID;
    v_winner_id UUID;
BEGIN
    -- Get game details
    SELECT home_user_id, visitor_user_id, winner_id
    INTO v_home_user_id, v_visitor_user_id, v_winner_id
    FROM game_sessions
    WHERE id = p_game_id AND status = 'completed';
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Update home user stats
    UPDATE users
    SET games_played = games_played + 1,
        wins = wins + CASE WHEN id = v_winner_id THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN id != v_winner_id THEN 1 ELSE 0 END
    WHERE id = v_home_user_id;
    
    -- Update visitor user stats
    UPDATE users
    SET games_played = games_played + 1,
        wins = wins + CASE WHEN id = v_winner_id THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN id != v_winner_id THEN 1 ELSE 0 END
    WHERE id = v_visitor_user_id;
    
    -- Update team stats
    UPDATE teams
    SET games_played = games_played + 1,
        wins = wins + CASE WHEN user_id = v_winner_id THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN user_id != v_winner_id THEN 1 ELSE 0 END
    WHERE id IN (
        SELECT home_team_id FROM game_sessions WHERE id = p_game_id
        UNION
        SELECT visitor_team_id FROM game_sessions WHERE id = p_game_id
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROSTER VALIDATION FUNCTIONS
-- =====================================================

-- Validate a team's roster is complete and valid
CREATE OR REPLACE FUNCTION validate_roster(
    p_team_id UUID
) RETURNS TABLE(
    is_valid BOOLEAN,
    errors TEXT[]
) AS $$
DECLARE
    v_errors TEXT[] := '{}';
    v_position_count INTEGER;
    v_pitcher_count INTEGER;
    v_batting_order_check INTEGER;
BEGIN
    -- Check if we have exactly 9 position players
    SELECT COUNT(*)
    INTO v_position_count
    FROM roster_slots
    WHERE team_id = p_team_id AND position != 'P';
    
    IF v_position_count != 9 THEN
        v_errors := array_append(v_errors, 
            format('Need exactly 9 position players, have %s', v_position_count));
    END IF;
    
    -- Check if we have at least 1 pitcher
    SELECT COUNT(*)
    INTO v_pitcher_count
    FROM roster_slots
    WHERE team_id = p_team_id AND position = 'P';
    
    IF v_pitcher_count < 1 THEN
        v_errors := array_append(v_errors, 'Need at least 1 pitcher');
    END IF;
    
    -- Check batting order is 1-9 with no gaps
    SELECT COUNT(DISTINCT batting_order)
    INTO v_batting_order_check
    FROM roster_slots
    WHERE team_id = p_team_id AND position != 'P';
    
    IF v_batting_order_check != 9 THEN
        v_errors := array_append(v_errors, 'Batting order must be 1-9 with no duplicates or gaps');
    END IF;
    
    -- Check all positions are filled
    IF NOT EXISTS (SELECT 1 FROM roster_slots WHERE team_id = p_team_id AND position = 'C') THEN
        v_errors := array_append(v_errors, 'Missing Catcher');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roster_slots WHERE team_id = p_team_id AND position = '1B') THEN
        v_errors := array_append(v_errors, 'Missing First Baseman');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roster_slots WHERE team_id = p_team_id AND position = '2B') THEN
        v_errors := array_append(v_errors, 'Missing Second Baseman');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roster_slots WHERE team_id = p_team_id AND position = '3B') THEN
        v_errors := array_append(v_errors, 'Missing Third Baseman');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roster_slots WHERE team_id = p_team_id AND position = 'SS') THEN
        v_errors := array_append(v_errors, 'Missing Shortstop');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roster_slots WHERE team_id = p_team_id AND position = 'LF') THEN
        v_errors := array_append(v_errors, 'Missing Left Fielder');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roster_slots WHERE team_id = p_team_id AND position = 'CF') THEN
        v_errors := array_append(v_errors, 'Missing Center Fielder');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM roster_slots WHERE team_id = p_team_id AND position = 'RF') THEN
        v_errors := array_append(v_errors, 'Missing Right Fielder');
    END IF;
    
    RETURN QUERY
    SELECT 
        array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0,
        v_errors;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GAME MANAGEMENT FUNCTIONS
-- =====================================================

-- Create a new game session
CREATE OR REPLACE FUNCTION create_game_session(
    p_user_id UUID,
    p_team_id UUID
) RETURNS UUID AS $$
DECLARE
    v_game_id UUID;
    v_roster_valid BOOLEAN;
BEGIN
    -- Validate roster first
    SELECT is_valid INTO v_roster_valid
    FROM validate_roster(p_team_id);
    
    IF NOT v_roster_valid THEN
        RAISE EXCEPTION 'Team roster is not valid';
    END IF;
    
    -- Create the game
    INSERT INTO game_sessions (
        home_user_id,
        home_team_id,
        status
    ) VALUES (
        p_user_id,
        p_team_id,
        'waiting'
    ) RETURNING id INTO v_game_id;
    
    RETURN v_game_id;
END;
$$ LANGUAGE plpgsql;

-- Join an existing game session
CREATE OR REPLACE FUNCTION join_game_session(
    p_join_code TEXT,
    p_user_id UUID,
    p_team_id UUID
) RETURNS UUID AS $$
DECLARE
    v_game_id UUID;
    v_roster_valid BOOLEAN;
    v_home_user_id UUID;
BEGIN
    -- Validate roster first
    SELECT is_valid INTO v_roster_valid
    FROM validate_roster(p_team_id);
    
    IF NOT v_roster_valid THEN
        RAISE EXCEPTION 'Team roster is not valid';
    END IF;
    
    -- Find and update the game
    UPDATE game_sessions
    SET visitor_user_id = p_user_id,
        visitor_team_id = p_team_id,
        status = 'active',
        started_at = NOW()
    WHERE join_code = p_join_code
        AND status = 'waiting'
        AND home_user_id != p_user_id
    RETURNING id, home_user_id INTO v_game_id, v_home_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid join code or game not available';
    END IF;
    
    RETURN v_game_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- LEADERBOARD FUNCTIONS
-- =====================================================

-- Get user leaderboard
CREATE OR REPLACE FUNCTION get_user_leaderboard(
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE(
    rank BIGINT,
    user_id UUID,
    username TEXT,
    games_played INTEGER,
    wins INTEGER,
    losses INTEGER,
    win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY 
            CASE WHEN u.games_played >= 5 
                THEN u.wins::NUMERIC / NULLIF(u.games_played, 0) 
                ELSE 0 
            END DESC,
            u.wins DESC
        ) as rank,
        u.id as user_id,
        u.username,
        u.games_played,
        u.wins,
        u.losses,
        ROUND(
            CASE WHEN u.games_played > 0 
                THEN (u.wins::NUMERIC / u.games_played) * 100 
                ELSE 0 
            END, 2
        ) as win_rate
    FROM users u
    WHERE u.games_played > 0
    ORDER BY rank
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CLEANUP FUNCTIONS
-- =====================================================

-- Clean up abandoned games (called by cron job)
CREATE OR REPLACE FUNCTION cleanup_abandoned_games() RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE game_sessions
    SET status = 'abandoned',
        completed_at = NOW()
    WHERE status IN ('waiting', 'active')
        AND last_activity < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Update last_activity timestamp on game moves
CREATE OR REPLACE FUNCTION update_game_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE game_sessions
    SET last_activity = NOW()
    WHERE id = NEW.game_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_game_activity_on_move
    AFTER INSERT ON game_moves
    FOR EACH ROW
    EXECUTE FUNCTION update_game_activity();

-- =====================================================
-- UTILITY FUNCTIONS FOR DEVELOPMENT
-- =====================================================

-- Reset all game data (for development only)
CREATE OR REPLACE FUNCTION reset_all_game_data()
RETURNS VOID AS $$
BEGIN
    -- Only allow in development
    IF current_setting('app.environment', true) != 'development' THEN
        RAISE EXCEPTION 'This function can only be run in development';
    END IF;
    
    DELETE FROM game_moves;
    DELETE FROM game_sessions;
    UPDATE users SET games_played = 0, wins = 0, losses = 0;
    UPDATE teams SET games_played = 0, wins = 0, losses = 0;
END;
$$ LANGUAGE plpgsql;