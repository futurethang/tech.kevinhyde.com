-- Dice Baseball V2: Row Level Security Policies
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
CREATE INDEX idx_friends_participants ON friends(user_id, friend_id);