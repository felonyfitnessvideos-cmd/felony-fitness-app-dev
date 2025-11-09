/**
 * Generate realistic program templates with actual exercises from the database
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import * as fs from 'fs';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function generateProgramTemplates() {
  console.log('🏋️ GENERATING PROGRAM TEMPLATES FROM ACTUAL EXERCISES');
  console.log('='.repeat(80));
  console.log('');

  // Get exercises grouped by primary muscle
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('*')
    .limit(100);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`✅ Found ${exercises?.length || 0} exercises\n`);

  // Group exercises by primary muscle
  const byMuscle = {};
  exercises?.forEach(ex => {
    if (ex.primary_muscles && ex.primary_muscles.length > 0) {
      const primary = ex.primary_muscles[0];
      if (!byMuscle[primary]) byMuscle[primary] = [];
      byMuscle[primary].push(ex);
    }
  });

  console.log('📊 Exercises by Primary Muscle:');
  Object.keys(byMuscle).forEach(muscle => {
    console.log(`   ${muscle}: ${byMuscle[muscle].length} exercises`);
  });
  console.log('');

  // Create program templates
  const programs = [];

  // 1. Beginner Strength Foundation
  const beginnerExercises = [
    // Find basic compound movements
    ...(byMuscle['chest'] || []).slice(0, 2),
    ...(byMuscle['back'] || []).slice(0, 2),
    ...(byMuscle['legs'] || []).slice(0, 2),
    ...(byMuscle['shoulders'] || []).slice(0, 1),
    ...(byMuscle['core'] || []).slice(0, 1)
  ];

  programs.push({
    name: 'Beginner Strength Foundation',
    description: 'Full body strength program focusing on fundamental compound movements',
    difficulty: 'beginner',
    weeks: 8,
    type: 'strength',
    exercises: beginnerExercises.slice(0, 8).map(ex => ({
      exercise_id: ex.id,
      sets: 3,
      reps: '10-12',
      rest_seconds: 90,
      notes: null,
      muscle_groups: {
        primary: ex.primary_muscles || [],
        secondary: ex.secondary_muscles || [],
        tertiary: []
      }
    }))
  });

  // 2. Intermediate Hypertrophy
  const hypertrophyExercises = [
    ...(byMuscle['chest'] || []).slice(0, 3),
    ...(byMuscle['back'] || []).slice(0, 3),
    ...(byMuscle['legs'] || []).slice(0, 3),
    ...(byMuscle['shoulders'] || []).slice(0, 2),
    ...(byMuscle['arms'] || byMuscle['biceps'] || []).slice(0, 2)
  ];

  programs.push({
    name: 'Intermediate Hypertrophy Builder',
    description: 'Muscle building program with optimal volume for hypertrophy',
    difficulty: 'intermediate',
    weeks: 12,
    type: 'hypertrophy',
    exercises: hypertrophyExercises.slice(0, 12).map(ex => ({
      exercise_id: ex.id,
      sets: 4,
      reps: '8-12',
      rest_seconds: 60,
      notes: 'Focus on time under tension',
      muscle_groups: {
        primary: ex.primary_muscles || [],
        secondary: ex.secondary_muscles || [],
        tertiary: []
      }
    }))
  });

  // Generate SQL
  let sql = `-- Generated Program Templates with Real Exercises\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  sql += `-- Delete existing empty templates\n`;
  sql += `DELETE FROM programs WHERE is_template = TRUE AND exercise_pool = '[]'::jsonb;\n\n`;

  programs.forEach((prog, idx) => {
    // Escape single quotes for SQL safety
    const escapeSql = (str) => str.replace(/'/g, "''");
    const exerciseJson = JSON.stringify(prog.exercises).replace(/'/g, "''");
    
    sql += `-- ${idx + 1}. ${escapeSql(prog.name)}\n`;
    sql += `INSERT INTO programs (name, description, difficulty_level, estimated_weeks, program_type, exercise_pool, is_template, is_active)\n`;
    sql += `VALUES (\n`;
    sql += `    '${escapeSql(prog.name)}',\n`;
    sql += `    '${escapeSql(prog.description)}',\n`;
    sql += `    '${escapeSql(prog.difficulty)}',\n`;
    sql += `    ${prog.weeks},\n`;
    sql += `    '${escapeSql(prog.type)}',\n`;
    sql += `    '${exerciseJson}'::jsonb,\n`;
    sql += `    TRUE,\n`;
    sql += `    TRUE\n`;
    sql += `);\n\n`;
  });

  // Write to file
  const outputPath = 'scripts/insert-program-templates.sql';
  fs.writeFileSync(outputPath, sql);
  console.log(`✅ Generated SQL file: ${outputPath}\n`);
  console.log(sql);
}

generateProgramTemplates().catch(console.error);
