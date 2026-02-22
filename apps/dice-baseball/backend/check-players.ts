import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkPlayers() {
  const { data: players, error } = await supabase
    .from('mlb_players')
    .select('mlb_id, full_name, primary_position, current_team')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('🎮 MLB Players in Database:\n');
  console.log('ID      | Name                  | Position | Team');
  console.log('--------|----------------------|----------|------------------');
  
  players?.forEach(player => {
    console.log(
      `${player.mlb_id.toString().padEnd(7)} | ` +
      `${(player.full_name || 'Unknown').padEnd(20)} | ` +
      `${(player.primary_position || '').padEnd(8)} | ` +
      `${player.current_team || 'N/A'}`
    );
  });

  console.log(`\nTotal players: ${players?.length || 0}`);
}

checkPlayers();