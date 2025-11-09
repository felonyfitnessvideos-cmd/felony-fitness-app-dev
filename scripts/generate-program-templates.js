/**
 * Get detailed pro-routine data with exercises to create realistic program templates
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function getProRoutinesWithExercises() {
  console.log('🔍 FETCHING PRO-ROUTINES WITH EXERCISES');
  console.log('='.repeat(80));
  console.log('');

  // Get pro-routines
  const { data: routines, error } = await supabase
    .from('pro_routines')
    .select('*')
    .limit(5);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`✅ Found ${routines?.length || 0} pro-routines\n`);

  for (const routine of routines || []) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 ${routine.routine_name}`);
    console.log(`   Type: ${routine.routine_type} | Difficulty: ${routine.difficulty_level}`);
    console.log(`   Description: ${routine.description || 'N/A'}`);
    console.log(`${'='.repeat(80)}\n`);

    // Get exercises for this routine
    const { data: exercises, error: exError } = await supabase
      .from('routine_exercises')
      .select(`
        *,
        exercise:exercises(*)
      `)
      .eq('routine_id', routine.id)
      .order('exercise_order');

    if (exError) {
      console.log(`   ❌ Error fetching exercises: ${exError.message}\n`);
      continue;
    }

    console.log(`   Exercises (${exercises?.length || 0}):\n`);
    
    exercises?.forEach((ex, idx) => {
      const exercise = ex.exercise;
      console.log(`   ${idx + 1}. ${exercise?.name || 'Unknown Exercise'}`);
      console.log(`      Sets: ${ex.sets} | Reps: ${ex.reps} | Rest: ${ex.rest_seconds}s`);
      
      if (exercise?.primary_muscles && exercise.primary_muscles.length > 0) {
        console.log(`      🎯 Primary: ${exercise.primary_muscles.join(', ')}`);
      }
      if (exercise?.secondary_muscles && exercise.secondary_muscles.length > 0) {
        console.log(`      💪 Secondary: ${exercise.secondary_muscles.join(', ')}`);
      }
      
      // Build the exercise_pool format
      console.log(`      \n      📦 Exercise Pool Format:`);
      console.log(`      {`);
      console.log(`        exercise_id: "${ex.exercise_id}",`);
      console.log(`        sets: ${ex.sets},`);
      console.log(`        reps: "${ex.reps}",`);
      console.log(`        rest_seconds: ${ex.rest_seconds},`);
      console.log(`        notes: ${ex.notes ? `"${ex.notes}"` : 'null'},`);
      console.log(`        muscle_groups: {`);
      console.log(`          primary: [${exercise?.primary_muscles?.map(m => `"${m}"`).join(', ') || ''}],`);
      console.log(`          secondary: [${exercise?.secondary_muscles?.map(m => `"${m}"`).join(', ') || ''}],`);
      console.log(`          tertiary: []`);
      console.log(`        }`);
      console.log(`      }\n`);
    });
  }
  
  console.log('\n\n');
  console.log('🎯 GENERATING SQL FOR PROGRAM TEMPLATES...\n');
}

getProRoutinesWithExercises().catch(console.error);
