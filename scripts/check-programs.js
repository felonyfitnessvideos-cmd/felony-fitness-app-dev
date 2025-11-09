/**
 * Quick check to see if programs exist in the database
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkPrograms() {
  console.log('🔍 Checking programs in database...\n');

  const { data, error, count } = await supabase
    .from('programs')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${count || 0} programs in database\n`);

  if (data && data.length > 0) {
    data.forEach((prog, idx) => {
      console.log(`${idx + 1}. ${prog.name}`);
      console.log(`   Difficulty: ${prog.difficulty_level}`);
      console.log(`   Weeks: ${prog.estimated_weeks}`);
      console.log(`   Type: ${prog.program_type}`);
      console.log(`   Exercises: ${prog.exercise_pool?.length || 0}`);
      console.log(`   Template: ${prog.is_template}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No programs found!');
    console.log('   You need to run: scripts/populate-program-templates.sql');
    console.log('   In Supabase SQL Editor');
  }
}

checkPrograms().catch(console.error);
