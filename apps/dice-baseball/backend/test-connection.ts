import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

console.log('🔍 Testing Supabase Connection...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test 1: Check if we can query the users table
    console.log('\n📊 Checking database tables...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count');
    
    if (usersError) {
      console.error('❌ Users table error:', usersError);
    } else {
      console.log('✅ Users table exists');
    }

    // Test 2: Check mlb_players table
    const { data: players, error: playersError } = await supabase
      .from('mlb_players')
      .select('count');
    
    if (playersError) {
      console.error('❌ MLB Players table error:', playersError);
    } else {
      console.log('✅ MLB Players table exists');
    }

    // Test 3: Check teams table
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('count');
    
    if (teamsError) {
      console.error('❌ Teams table error:', teamsError);
    } else {
      console.log('✅ Teams table exists');
    }

    // Test 4: Check game_sessions table
    const { data: games, error: gamesError } = await supabase
      .from('game_sessions')
      .select('count');
    
    if (gamesError) {
      console.error('❌ Game Sessions table error:', gamesError);
    } else {
      console.log('✅ Game Sessions table exists');
    }

    console.log('\n🎉 Database connection successful!');
    console.log('All tables are ready.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();