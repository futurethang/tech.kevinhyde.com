-- Dice Baseball V2: Stored Procedures and Functions
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