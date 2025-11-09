/**
 * Generate realistic program templates based on actual exercises in the database
 * Creates SQL to populate programs table with real exercise data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import * as fs from 'fs';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function buildProgramTemplates() {
  console.log('🏋️  BUILDING PROGRAM TEMPLATES WITH REAL EXERCISES');
  console.log('='.repeat(80));
  console.log('');

  // Fetch all exercises
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name');

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`✅ Loaded ${exercises?.length || 0} exercises\n`);

  // Group by primary muscle
  const byMuscle = {};
  exercises?.forEach(ex => {
    const muscle = ex.primary_muscle;
    if (muscle) {
      if (!byMuscle[muscle]) byMuscle[muscle] = [];
      byMuscle[muscle].push(ex);
    }
  });

  console.log('📊 Exercises by Primary Muscle:');
  Object.keys(byMuscle).sort().forEach(muscle => {
    console.log(`   ${muscle}: ${byMuscle[muscle].length}`);
  });
  console.log('');

  // Helper to create exercise pool entry
  const createExerciseEntry = (exercise, sets, reps, rest, notes = null) => ({
    exercise_id: exercise.id,
    sets,
    reps,
    rest_seconds: rest,
    notes,
    muscle_groups: {
      primary: exercise.primary_muscle ? [exercise.primary_muscle] : [],
      secondary: exercise.secondary_muscle ? [exercise.secondary_muscle] : [],
      tertiary: exercise.tertiary_muscle ? [exercise.tertiary_muscle] : []
    }
  });

  // Create program templates with MORE exercises (15-20 each for flexible splits)
  const programs = [];

  // 1. Beginner Strength Foundation (8 weeks) - Full Body Focus
  const beginnerEx = [
    // Legs (5 exercises)
    ...byMuscle['Quadriceps']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    ...byMuscle['Hamstrings']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    ...byMuscle['Glutes']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 1) || [],
    // Chest (3 exercises)
    ...byMuscle['Middle Chest']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 3) || [],
    // Back (3 exercises)
    ...byMuscle['Latissimus Dorsi']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 3) || [],
    // Shoulders (2 exercises)
    ...byMuscle['Front Deltoids']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    // Arms (3 exercises)
    ...byMuscle['Biceps']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    ...byMuscle['Triceps']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 1) || [],
    // Core (2 exercises)
    ...byMuscle['Upper Abdominals']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 2) || []
  ].filter(Boolean).slice(0, 18);

  programs.push({
    name: 'Beginner Strength Foundation',
    description: 'Full body strength program focusing on fundamental movements. Perfect for newcomers building a solid base.',
    difficulty: 'beginner',
    weeks: 8,
    type: 'strength',
    exercises: beginnerEx.map(ex => createExerciseEntry(ex, 3, '10-12', 90))
  });

  // 2. Intermediate Hypertrophy Builder (12 weeks) - Comprehensive Volume
  const hypertrophyEx = [
    // Chest (4 exercises)
    ...byMuscle['Middle Chest']?.filter(ex => ex.difficulty_level === 'Intermediate' || ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    ...byMuscle['Upper Chest']?.filter(ex => ex.difficulty_level === 'Intermediate' || ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    // Back (4 exercises)
    ...byMuscle['Latissimus Dorsi']?.filter(ex => ex.difficulty_level === 'Intermediate' || ex.difficulty_level === 'Beginner').slice(0, 3) || [],
    ...byMuscle['Lower Back']?.filter(ex => ex.difficulty_level === 'Intermediate' || ex.difficulty_level === 'Beginner').slice(0, 1) || [],
    // Legs (4 exercises)
    ...byMuscle['Quadriceps']?.filter(ex => ex.difficulty_level === 'Intermediate' || ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    ...byMuscle['Hamstrings']?.filter(ex => ex.difficulty_level === 'Intermediate' || ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    // Shoulders (3 exercises)
    ...byMuscle['Front Deltoids']?.filter(ex => ex.difficulty_level === 'Intermediate' || ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    ...byMuscle['Side Deltoids']?.filter(ex => ex.difficulty_level === 'Intermediate' || ex.difficulty_level === 'Beginner').slice(0, 1) || [],
    // Arms (3 exercises)
    ...byMuscle['Biceps']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 2) || [],
    ...byMuscle['Triceps']?.filter(ex => ex.difficulty_level === 'Beginner').slice(0, 1) || []
  ].filter(Boolean).slice(0, 18);

  programs.push({
    name: 'Intermediate Hypertrophy Builder',
    description: 'Muscle building program with optimal volume for hypertrophy. Targets all major muscle groups with strategic variety.',
    difficulty: 'intermediate',
    weeks: 12,
    type: 'hypertrophy',
    exercises: hypertrophyEx.map(ex => createExerciseEntry(ex, 4, '8-12', 60, 'Focus on time under tension'))
  });

  // 3. Advanced Powerlifting Protocol (16 weeks) - Strength + Accessories
  const powerliftingEx = [
    // Big 3 Compound Lifts
    exercises.find(ex => ex.name === 'Barbell Bench Press'),
    exercises.find(ex => ex.name === 'Barbell Squat'),
    exercises.find(ex => ex.name === 'Conventional Deadlift'),
    // Compound Accessories (5 exercises)
    exercises.find(ex => ex.name === 'Overhead Press'),
    exercises.find(ex => ex.name === 'Barbell Row'),
    ...byMuscle['Quadriceps']?.filter(ex => ex.name.includes('Front Squat') || ex.name.includes('Pause')).slice(0, 1) || [],
    ...byMuscle['Middle Chest']?.filter(ex => ex.name.includes('Incline')).slice(0, 1) || [],
    ...byMuscle['Hamstrings']?.filter(ex => ex.name.includes('Romanian')).slice(0, 1) || [],
    // Isolation Accessories (8 exercises)
    ...byMuscle['Triceps']?.slice(0, 2) || [],
    ...byMuscle['Biceps']?.slice(0, 2) || [],
    ...byMuscle['Hamstrings']?.slice(0, 2) || [],
    ...byMuscle['Upper Abdominals']?.slice(0, 2) || []
  ].filter(Boolean).slice(0, 16);

  programs.push({
    name: 'Advanced Powerlifting Protocol',
    description: 'Competition-focused program emphasizing the big three lifts with strategic accessory work for balanced strength development.',
    difficulty: 'advanced',
    weeks: 16,
    type: 'strength',
    exercises: powerliftingEx.map((ex, idx) => {
      // Big 3 get heavy sets, accessories get moderate
      const isBig3 = idx < 3;
      return createExerciseEntry(
        ex, 
        isBig3 ? 5 : 3, 
        isBig3 ? '3-5' : '8-10', 
        isBig3 ? 180 : 90,
        isBig3 ? 'Focus on maximal strength' : 'Accessory work'
      );
    })
  });

  // Generate SQL
  let sql = `-- Program Templates with Real Exercises\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Total Programs: ${programs.length}\n\n`;
  
  sql += `-- Clear existing template programs\n`;
  sql += `DELETE FROM programs WHERE is_template = TRUE;\n\n`;

  programs.forEach((prog, idx) => {
    sql += `-- ${idx + 1}. ${prog.name} (${prog.exercises.length} exercises)\n`;
    sql += `INSERT INTO programs (\n`;
    sql += `  name,\n`;
    sql += `  description,\n`;
    sql += `  difficulty_level,\n`;
    sql += `  estimated_weeks,\n`;
    sql += `  program_type,\n`;
    sql += `  exercise_pool,\n`;
    sql += `  is_template,\n`;
    sql += `  is_active\n`;
    sql += `) VALUES (\n`;
    sql += `  '${prog.name.replace(/'/g, "''")}',\n`;
    sql += `  '${prog.description.replace(/'/g, "''")}',\n`;
    sql += `  '${prog.difficulty}',\n`;
    sql += `  ${prog.weeks},\n`;
    sql += `  '${prog.type}',\n`;
    sql += `  '${JSON.stringify(prog.exercises).replace(/'/g, "''")}'::jsonb,\n`;
    sql += `  TRUE,\n`;
    sql += `  TRUE\n`;
    sql += `);\n\n`;

    // Log summary
    console.log(`✅ ${prog.name}`);
    console.log(`   Difficulty: ${prog.difficulty} | Weeks: ${prog.weeks} | Type: ${prog.type}`);
    console.log(`   Exercises (${prog.exercises.length}):`);
    prog.exercises.slice(0, 5).forEach(ex => {
      const exercise = exercises.find(e => e.id === ex.exercise_id);
      if (exercise) {
        console.log(`     - ${exercise.name} (${ex.sets}x${ex.reps})`);
      }
    });
    if (prog.exercises.length > 5) {
      console.log(`     ... and ${prog.exercises.length - 5} more`);
    }
    console.log('');
  });

  // Write to file
  const outputPath = 'scripts/populate-program-templates.sql';
  fs.writeFileSync(outputPath, sql);
  console.log(`\n📁 SQL written to: ${outputPath}`);
  console.log(`\n✅ Ready to run in Supabase SQL Editor!`);
}

buildProgramTemplates().catch(console.error);
