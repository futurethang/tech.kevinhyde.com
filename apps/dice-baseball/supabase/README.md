# Supabase Setup for Dice Baseball V2

## Quick Start

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and keys

2. **Run Migrations**
   
   Option A: Via Supabase Dashboard
   - Go to SQL Editor in Supabase Dashboard
   - Run each migration file in order:
     1. `001_initial_schema.sql` - Creates all tables
     2. `002_row_level_security.sql` - Sets up RLS policies
     3. `003_stored_procedures.sql` - Adds functions and triggers
   
   Option B: Via Supabase CLI
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Link to your project
   supabase link --project-ref your-project-ref
   
   # Run migrations
   supabase db push
   ```

3. **Configure Authentication**
   - In Supabase Dashboard → Authentication → Providers
   - Enable Email/Password authentication
   - Configure JWT secret (copy for backend)

4. **Get Your Keys**
   - Go to Settings → API
   - Copy:
     - Project URL
     - `anon` key (for frontend)
     - `service_role` key (for backend)

## Environment Variables

### Backend (.env)
```bash
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# CORS (update with your frontend URL)
CORS_ORIGIN=https://tech.kevinhyde.com
```

### Frontend (.env)
```bash
VITE_API_URL=https://your-backend.railway.app/api
VITE_WS_URL=wss://your-backend.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Database Schema

### Core Tables
- `users` - User accounts and stats
- `mlb_players` - MLB player data (synced from MLB API)
- `teams` - User-created teams
- `roster_slots` - Team rosters (links teams to players)
- `game_sessions` - Active and completed games
- `game_moves` - Game history/replay data
- `friends` - Social connections (future feature)

### Key Features
- **Row Level Security** - Users can only modify their own data
- **Auto-generated join codes** - 6-character codes for games
- **Stored procedures** - Roster validation, game creation, stats updates
- **Triggers** - Auto-update timestamps, activity tracking

## Testing the Setup

After migrations are complete, test with:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Test join code generation
SELECT generate_join_code();

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

## MLB Data Sync

The `mlb_players` table needs to be populated. This will be done by the backend sync service:

1. Backend will fetch from MLB Stats API
2. Upsert players with current season stats
3. Run daily at 5 AM UTC via cron job

Initial sync will populate ~750 active MLB players.

## Troubleshooting

### RLS Policies Blocking Access
- Check that auth tokens are being sent correctly
- Verify `auth.uid()` matches the user's ID
- Use service role key for admin operations

### Migration Errors
- Ensure you run migrations in order
- Check for existing tables/conflicts
- UUID extension must be enabled

### Performance Issues
- All necessary indexes are created
- Monitor slow queries in Supabase Dashboard
- Consider connection pooling for high traffic

## Security Notes

- **Never expose** the `service_role` key to frontend
- Use `anon` key for frontend (safe to expose)
- RLS policies protect all user data
- JWT secret must match between Supabase and backend

## Next Steps

1. ✅ Migrations are ready to run
2. Create Supabase project
3. Run migrations
4. Configure auth
5. Update backend to use Supabase
6. Deploy and test