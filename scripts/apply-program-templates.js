/**
 * Apply program templates SQL directly to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import * as fs from 'fs';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function applyProgramTemplates() {
  console.log('📥 APPLYING PROGRAM TEMPLATES TO DATABASE');
  console.log('='.repeat(80));
  console.log('');

  // Read SQL file
  const sql = fs.readFileSync('scripts/populate-program-templates.sql', 'utf8');
  
  // Extract individual INSERT statements (skip DELETE for safety)
  const insertStatements = sql
    .split('INSERT INTO programs')
    .slice(1) // Skip the first split (before first INSERT)
    .map(stmt => 'INSERT INTO programs' + stmt.trim());

  console.log(`📝 Found ${insertStatements.length} program templates to insert\n`);

  // First, delete existing templates
  console.log('🗑️  Clearing existing template programs...');
  const { error: deleteError } = await supabase
    .from('programs')
    .delete()
    .eq('is_template', true);

  if (deleteError) {
    console.error('❌ Error deleting templates:', deleteError.message);
    return;
  }
  console.log('✅ Existing templates cleared\n');

  // Parse and insert each program
  for (let i = 0; i < insertStatements.length; i++) {
    const stmt = insertStatements[i];
    
    // Extract values using regex
    const nameMatch = stmt.match(/name,.*?VALUES\s*\(\s*'([^']+)'/s);
    const descMatch = stmt.match(/'([^']+)',\s*'beginner|intermediate|advanced'/s);
    const diffMatch = stmt.match(/'(beginner|intermediate|advanced)'/);
    const weeksMatch = stmt.match(/(\d+),\s*'strength|hypertrophy'/);
    const typeMatch = stmt.match(/'(strength|hypertrophy)'/);
    const poolMatch = stmt.match(/'(\[{.*?}\])'::jsonb/s);
    
    if (!nameMatch || !descMatch || !diffMatch || !weeksMatch || !typeMatch || !poolMatch) {
      console.error(`❌ Failed to parse program ${i + 1}`);
      continue;
    }

    const programData = {
      name: nameMatch[1],
      description: descMatch[1],
      difficulty_level: diffMatch[1],
      estimated_weeks: parseInt(weeksMatch[1]),
      program_type: typeMatch[1],
      exercise_pool: JSON.parse(poolMatch[1].replace(/''/g, "'")),
      is_template: true,
      is_active: true
    };

    console.log(`📌 Inserting: ${programData.name}`);
    console.log(`   ${programData.difficulty_level} | ${programData.estimated_weeks} weeks | ${programData.program_type}`);
    console.log(`   ${programData.exercise_pool.length} exercises`);

    const { error } = await supabase
      .from('programs')
      .insert(programData);

    if (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    } else {
      console.log(`   ✅ Inserted successfully\n`);
    }
  }

  // Verify
  console.log('='.repeat(80));
  console.log('🔍 VERIFYING PROGRAMS IN DATABASE\n');
  
  const { data: programs, error: verifyError } = await supabase
    .from('programs')
    .select('*')
    .eq('is_template', true);

  if (verifyError) {
    console.error('❌ Verification error:', verifyError.message);
    return;
  }

  console.log(`✅ Found ${programs.length} template programs:\n`);
  programs.forEach((prog, idx) => {
    console.log(`${idx + 1}. ${prog.name}`);
    console.log(`   ${prog.difficulty_level} | ${prog.estimated_weeks} weeks | ${prog.program_type}`);
    console.log(`   ${prog.exercise_pool?.length || 0} exercises\n`);
  });

  console.log('🎉 Program templates applied successfully!');
}

applyProgramTemplates().catch(console.error);
