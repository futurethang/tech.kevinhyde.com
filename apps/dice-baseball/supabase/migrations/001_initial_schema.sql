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
    FOR EACH ROW EXECUTE FUNCTION set_join_code();