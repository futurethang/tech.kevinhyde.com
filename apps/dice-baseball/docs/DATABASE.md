# Dice Baseball V2: Database Schema

## Overview

The database is hosted on **Supabase (PostgreSQL)**. This document defines all tables, relationships, indexes, and constraints.

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│     users       │       │   mlb_players   │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ mlb_id (PK)     │
│ email           │       │ name            │
│ username        │       │ team            │
│ created_at      │       │ position        │
│ games_played    │       │ batting_stats   │
│ wins            │       │ pitching_stats  │
│ losses          │       │ photo_url       │
└────────┬────────┘       │ salary          │
         │                │ last_updated    │
         │                └────────┬────────┘
         │                         │
    ┌────┴────┐                    │
    ▼         ▼                    │
┌───────┐  ┌──────────┐            │
│friends│  │  teams   │            │
├───────┤  ├──────────┤            │
│user_id│  │ id (PK)  │            │
│friend │  │ user_id  │◀───────────┤
│  _id  │  │ name     │            │
└───────┘  │ is_active│            │
           └────┬─────┘            │
                │                  │
                ▼                  │
         ┌─────────────┐           │
         │roster_slots │           │
         ├─────────────┤           │
         │ id (PK)     │           │
         │ team_id (FK)│───────────┘
         │ position    │
         │ mlb_player  │
         │   _id (FK)  │
         │ batting_    │
         │   order     │
         └─────────────┘

┌─────────────────┐       ┌─────────────────┐
│  game_sessions  │       │   game_moves    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◀──────│ game_id (FK)    │
│ status          │       │ move_number     │
│ home_user_id    │       │ player_id       │
│ home_team_id    │       │ action          │
│ visitor_user_id │       │ result (JSONB)  │
│ visitor_team_id │       │ created_at      │
│ game_state      │       └─────────────────┘
│ winner_id       │
│ created_at      │
│ completed_at    │
└─────────────────┘
```

---

## Table Definitions

### 1. users

Stores registered user accounts.

```sql
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

-- Triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Notes:**
- `id` is UUID for security (non-sequential)
- `username` is 3-20 chars, alphanumeric + underscore only
- Auth handled by Supabase Auth; this table extends auth.users

---

### 2. friends

Many-to-many relationship for user friendships.

```sql
CREATE TABLE friends (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent self-friending
    CONSTRAINT no_self_friend CHECK (user_id != friend_id),

    PRIMARY KEY (user_id, friend_id)
);

-- Index for reverse lookups
CREATE INDEX idx_friends_reverse ON friends(friend_id, user_id);
```

**Notes:**
- Friendships are **bidirectional** - when A friends B, insert two rows: (A,B) and (B,A)
- This simplifies queries: `SELECT * FROM friends WHERE user_id = ?`

---

### 3. mlb_players

Cached MLB player data, refreshed nightly.

```sql
CREATE TABLE mlb_players (
    mlb_id INTEGER PRIMARY KEY,

    -- Basic info
    full_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    primary_position TEXT NOT NULL,  -- C, 1B, 2B, 3B, SS, LF, CF, RF, DH, SP, RP
    current_team TEXT,               -- Team abbreviation (NYY, LAD, etc.)
    current_team_id INTEGER,         -- MLB team ID

    -- Media
    photo_url TEXT,                  -- MLB headshot URL

    -- Contract
    salary_2025 INTEGER,             -- Annual salary in USD (NULL if unknown)

    -- Stats (JSONB for flexibility)
    batting_stats JSONB,
    pitching_stats JSONB,

    -- Metadata
    season_year INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure we have either batting or pitching stats
    CONSTRAINT has_stats CHECK (batting_stats IS NOT NULL OR pitching_stats IS NOT NULL)
);

-- Indexes for common queries
CREATE INDEX idx_mlb_players_position ON mlb_players(primary_position);
CREATE INDEX idx_mlb_players_team ON mlb_players(current_team);
CREATE INDEX idx_mlb_players_name ON mlb_players(last_name, first_name);
CREATE INDEX idx_mlb_players_active ON mlb_players(is_active) WHERE is_active = true;

-- Full-text search index for player search
CREATE INDEX idx_mlb_players_search ON mlb_players
    USING gin(to_tsvector('english', full_name || ' ' || COALESCE(current_team, '')));
```

**batting_stats JSONB structure:**
```json
{
    "gamesPlayed": 142,
    "atBats": 512,
    "runs": 95,
    "hits": 158,
    "doubles": 32,
    "triples": 4,
    "homeRuns": 34,
    "rbi": 95,
    "walks": 78,
    "strikeouts": 120,
    "stolenBases": 12,
    "avg": 0.309,
    "obp": 0.398,
    "slg": 0.587,
    "ops": 0.985
}
```

**pitching_stats JSONB structure:**
```json
{
    "gamesPlayed": 32,
    "gamesStarted": 32,
    "wins": 15,
    "losses": 7,
    "era": 3.12,
    "inningsPitched": 198.2,
    "hits": 165,
    "runs": 72,
    "earnedRuns": 69,
    "homeRuns": 22,
    "walks": 45,
    "strikeouts": 215,
    "whip": 1.06,
    "kPer9": 9.75,
    "bbPer9": 2.04,
    "hrPer9": 1.00
}
```

---

### 4. teams

User-created teams with rosters.

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,  -- Only one active team per user

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT team_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 30)
);

-- Indexes
CREATE INDEX idx_teams_user ON teams(user_id);
CREATE INDEX idx_teams_active ON teams(user_id, is_active) WHERE is_active = true;

-- Ensure only one active team per user
CREATE UNIQUE INDEX idx_one_active_team ON teams(user_id) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

### 5. roster_slots

Individual player slots within a team roster.

```sql
CREATE TABLE roster_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- Position assignment
    position TEXT NOT NULL,  -- C, 1B, 2B, 3B, SS, LF, CF, RF, SP
    mlb_player_id INTEGER NOT NULL REFERENCES mlb_players(mlb_id),

    -- Batting order (1-9 for position players, NULL for pitcher)
    batting_order INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_position CHECK (position IN ('C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SP')),
    CONSTRAINT valid_batting_order CHECK (
        (position = 'SP' AND batting_order IS NULL) OR
        (position != 'SP' AND batting_order BETWEEN 1 AND 9)
    ),

    -- One player per position per team
    UNIQUE (team_id, position),

    -- One batting order slot per team
    UNIQUE (team_id, batting_order)
);

-- Indexes
CREATE INDEX idx_roster_team ON roster_slots(team_id);
CREATE INDEX idx_roster_player ON roster_slots(mlb_player_id);
```

**Notes:**
- Each team has exactly 9 positions filled + 1 SP
- Batting order 1-9 for position players, NULL for pitcher
- Same MLB player can be on multiple teams (different users)

---

### 6. game_sessions

Active and completed game records.

```sql
CREATE TYPE game_status AS ENUM ('waiting', 'active', 'completed', 'abandoned', 'forfeit');

CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Join code for private games (6 chars, uppercase)
    join_code TEXT UNIQUE,

    -- Game status
    status game_status NOT NULL DEFAULT 'waiting',

    -- Home team (creator)
    home_user_id UUID NOT NULL REFERENCES users(id),
    home_team_id UUID NOT NULL REFERENCES teams(id),

    -- Visitor team (joiner) - NULL until someone joins
    visitor_user_id UUID REFERENCES users(id),
    visitor_team_id UUID REFERENCES teams(id),

    -- Winner - NULL until game complete
    winner_id UUID REFERENCES users(id),

    -- Full game state (JSONB for flexibility)
    game_state JSONB NOT NULL DEFAULT '{
        "inning": 1,
        "isTopOfInning": true,
        "outs": 0,
        "scores": [0, 0],
        "inningScores": [[], []],
        "bases": [false, false, false],
        "currentBatterIndex": 0,
        "pitchCount": [0, 0],
        "lastPlay": null
    }'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,       -- When visitor joins
    completed_at TIMESTAMPTZ,     -- When game ends

    -- Constraints
    CONSTRAINT different_players CHECK (home_user_id != visitor_user_id),
    CONSTRAINT join_code_format CHECK (join_code ~ '^[A-Z0-9]{6}$')
);

-- Indexes
CREATE INDEX idx_games_home_user ON game_sessions(home_user_id);
CREATE INDEX idx_games_visitor_user ON game_sessions(visitor_user_id);
CREATE INDEX idx_games_status ON game_sessions(status);
CREATE INDEX idx_games_join_code ON game_sessions(join_code) WHERE join_code IS NOT NULL;
CREATE INDEX idx_games_waiting ON game_sessions(status, created_at) WHERE status = 'waiting';

-- Index for user's recent games
CREATE INDEX idx_games_recent ON game_sessions(created_at DESC)
    WHERE status IN ('completed', 'forfeit');
```

**game_state JSONB structure:**
```json
{
    "inning": 5,
    "isTopOfInning": true,
    "outs": 2,
    "scores": [3, 1],
    "inningScores": [
        [0, 2, 0, 1, null, null, null, null, null],
        [1, 0, 0, 0, null, null, null, null, null]
    ],
    "bases": [true, true, false],
    "currentBatterIndex": 4,
    "pitchCount": [2, 1],
    "lastPlay": {
        "batterName": "Mike Trout",
        "pitcherName": "Gerrit Cole",
        "outcome": "single",
        "description": "Trout singled to right, Turner scored from 2nd!",
        "runsScored": 1
    }
}
```

---

### 7. game_moves

Play-by-play history for each game (for replay and verification).

```sql
CREATE TABLE game_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,

    -- Sequence
    move_number INTEGER NOT NULL,

    -- Who made the move
    player_id UUID NOT NULL REFERENCES users(id),

    -- Action type
    action TEXT NOT NULL,  -- 'roll', 'timeout', 'forfeit', etc.

    -- Result details (for rolls)
    result JSONB,

    -- Snapshot of game state after this move
    game_state_after JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_action CHECK (action IN ('roll', 'timeout', 'forfeit', 'reconnect')),

    -- Unique move numbers per game
    UNIQUE (game_id, move_number)
);

-- Indexes
CREATE INDEX idx_moves_game ON game_moves(game_id, move_number);
CREATE INDEX idx_moves_player ON game_moves(player_id);
```

**result JSONB structure (for roll action):**
```json
{
    "diceRolls": [4, 6],
    "rawTotal": 10,
    "batter": {
        "mlbId": 545361,
        "name": "Mike Trout",
        "ops": 0.905
    },
    "pitcher": {
        "mlbId": 543037,
        "name": "Gerrit Cole",
        "era": 3.12
    },
    "outcome": "double",
    "outcomeCategory": "hit",
    "basesAdvanced": 2,
    "runsScored": 1,
    "outsRecorded": 0,
    "description": "Trout doubled off the wall! Runner scores from first!"
}
```

---

## Utility Functions

### update_updated_at_column()

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### generate_join_code()

```sql
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- Exclude confusing chars: 0, O, 1, I
    code TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;
```

### update_user_stats()

Triggered after game completion to update win/loss records.

```sql
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when game transitions to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Update home player
        UPDATE users SET
            games_played = games_played + 1,
            wins = wins + CASE WHEN NEW.winner_id = NEW.home_user_id THEN 1 ELSE 0 END,
            losses = losses + CASE WHEN NEW.winner_id != NEW.home_user_id THEN 1 ELSE 0 END
        WHERE id = NEW.home_user_id;

        -- Update visitor player
        UPDATE users SET
            games_played = games_played + 1,
            wins = wins + CASE WHEN NEW.winner_id = NEW.visitor_user_id THEN 1 ELSE 0 END,
            losses = losses + CASE WHEN NEW.winner_id != NEW.visitor_user_id THEN 1 ELSE 0 END
        WHERE id = NEW.visitor_user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
    AFTER UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats();
```

---

## Row Level Security (RLS)

Supabase RLS policies for data access control.

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlb_players ENABLE ROW LEVEL SECURITY;

-- Users: can read all, update own
CREATE POLICY users_read ON users FOR SELECT USING (true);
CREATE POLICY users_update ON users FOR UPDATE USING (auth.uid() = id);

-- Friends: can read own, insert/delete own
CREATE POLICY friends_read ON friends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY friends_insert ON friends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY friends_delete ON friends FOR DELETE USING (auth.uid() = user_id);

-- Teams: can read all (for opponents), manage own
CREATE POLICY teams_read ON teams FOR SELECT USING (true);
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY teams_update ON teams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY teams_delete ON teams FOR DELETE USING (auth.uid() = user_id);

-- Roster slots: same as teams
CREATE POLICY roster_read ON roster_slots FOR SELECT USING (true);
CREATE POLICY roster_insert ON roster_slots FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND user_id = auth.uid())
);
CREATE POLICY roster_update ON roster_slots FOR UPDATE USING (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND user_id = auth.uid())
);
CREATE POLICY roster_delete ON roster_slots FOR DELETE USING (
    EXISTS (SELECT 1 FROM teams WHERE id = team_id AND user_id = auth.uid())
);

-- Game sessions: participants can read, home user can create
CREATE POLICY games_read ON game_sessions FOR SELECT USING (
    home_user_id = auth.uid() OR visitor_user_id = auth.uid() OR status = 'waiting'
);
CREATE POLICY games_insert ON game_sessions FOR INSERT WITH CHECK (auth.uid() = home_user_id);
CREATE POLICY games_update ON game_sessions FOR UPDATE USING (
    home_user_id = auth.uid() OR visitor_user_id = auth.uid()
);

-- Game moves: participants can read, handled by server for writes
CREATE POLICY moves_read ON game_moves FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM game_sessions
        WHERE id = game_id
        AND (home_user_id = auth.uid() OR visitor_user_id = auth.uid())
    )
);

-- MLB players: public read (populated by server cron)
CREATE POLICY mlb_read ON mlb_players FOR SELECT USING (true);
```

---

## Data Migration Scripts

### Initial setup

```sql
-- Run in order after creating tables:
-- 1. Create utility functions
-- 2. Create triggers
-- 3. Enable RLS and create policies
-- 4. Create indexes
```

### Seed data for development

```sql
-- Insert test users (handled by Supabase Auth in production)
INSERT INTO users (id, email, username) VALUES
    ('11111111-1111-1111-1111-111111111111', 'kevin@test.com', 'kevin'),
    ('22222222-2222-2222-2222-222222222222', 'sarah@test.com', 'sarah');

-- Make them friends
INSERT INTO friends (user_id, friend_id) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
```

---

## Backup & Recovery

### Automated backups
- Supabase provides daily automated backups
- Point-in-time recovery available on Pro plan

### Manual backup command
```bash
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql
```

---

## Performance Considerations

1. **mlb_players table**: ~1,700 rows, refreshed nightly. Small enough for full table scans but indexed for common queries.

2. **game_moves table**: Can grow large. Consider partitioning by month or archiving old games after 90 days.

3. **game_state JSONB**: Stored as single document for atomic updates. Supabase real-time works well with JSONB.

4. **Connection pooling**: Use Supabase's built-in PgBouncer for production.
