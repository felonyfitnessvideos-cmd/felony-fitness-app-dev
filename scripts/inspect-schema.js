/**
 * Quick schema inspector - checks what columns exist in key tables
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectTables() {
  const tables = ['programs', 'trainer_clients', 'scheduled_routines', 'workout_routines'];
  
  console.log('DATABASE SCHEMA INSPECTION');
  console.log('='.repeat(80));
  console.log('');

  for (const table of tables) {
    console.log(`\n📋 ${table.toUpperCase()}`);
    console.log('-'.repeat(80));
    
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      continue;
    }
    
    if (!data || data.length === 0) {
      console.log('✅ Table exists but is empty');
      console.log('Cannot determine columns without data. Check Supabase dashboard.');
      continue;
    }
    
    const columns = Object.keys(data[0]);
    console.log(`✅ Table exists with ${columns.length} columns:`);
    console.log('');
    columns.forEach(col => {
      const value = data[0][col];
      const type = value === null ? 'null' : typeof value;
      const typeHint = Array.isArray(value) ? 'array' : type;
      console.log(`   • ${col.padEnd(30)} (${typeHint})`);
    });
  }
  
  console.log('\n');
  console.log('='.repeat(80));
}

inspectTables().catch(console.error);
