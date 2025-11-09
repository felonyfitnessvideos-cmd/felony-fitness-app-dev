/**
 * Inspect pro-routines table to see actual workout data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectProRoutines() {
  console.log('🔍 INSPECTING PRO-ROUTINES TABLE');
  console.log('='.repeat(80));
  console.log('');

  // Get all pro-routines
  const { data: routines, error } = await supabase
    .from('pro_routines')
    .select('*')
    .limit(10);

  if (error) {
    console.log(`❌ Error fetching pro_routines: ${error.message}`);
    console.log('Trying workout_routines instead...\n');
    
    // Try workout_routines
    const { data: workoutRoutines, error: wrError } = await supabase
      .from('workout_routines')
      .select('*')
      .limit(5);
    
    if (wrError) {
      console.log(`❌ Error: ${wrError.message}`);
      return;
    }
    
    console.log(`✅ Found ${workoutRoutines?.length || 0} workout routines\n`);
    
    if (workoutRoutines && workoutRoutines.length > 0) {
      // Get exercises for first routine
      const firstRoutine = workoutRoutines[0];
      console.log(`📋 Sample Routine: ${firstRoutine.routine_name || firstRoutine.name}`);
      console.log(`   ID: ${firstRoutine.id}`);
      console.log(`   Type: ${firstRoutine.routine_type || 'N/A'}`);
      console.log(`   Difficulty: ${firstRoutine.difficulty_level || 'N/A'}`);
      console.log('');
      
      // Get exercises for this routine
      const { data: exercises, error: exError } = await supabase
        .from('routine_exercises')
        .select(`
          *,
          exercise:exercises(*)
        `)
        .eq('routine_id', firstRoutine.id)
        .order('exercise_order');
      
      if (exError) {
        console.log(`❌ Error fetching exercises: ${exError.message}`);
        return;
      }
      
      console.log(`   Exercises (${exercises?.length || 0}):`);
      exercises?.forEach((ex, idx) => {
        console.log(`   ${idx + 1}. ${ex.exercise?.name || 'Unknown'}`);
        console.log(`      Sets: ${ex.sets}, Reps: ${ex.reps}, Rest: ${ex.rest_seconds}s`);
        if (ex.exercise?.primary_muscles) {
          console.log(`      Primary: ${ex.exercise.primary_muscles.join(', ')}`);
        }
        if (ex.exercise?.secondary_muscles) {
          console.log(`      Secondary: ${ex.exercise.secondary_muscles.join(', ')}`);
        }
        console.log('');
      });
      
      // Show full exercise data structure
      if (exercises && exercises.length > 0) {
        console.log('\n📊 SAMPLE EXERCISE DATA STRUCTURE:');
        console.log('-'.repeat(80));
        console.log(JSON.stringify(exercises[0], null, 2));
      }
    }
    
    return;
  }

  console.log(`✅ Found ${routines?.length || 0} pro-routines\n`);
  
  if (routines && routines.length > 0) {
    console.log('Sample pro-routine:');
    console.log(JSON.stringify(routines[0], null, 2));
  }
}

inspectProRoutines().catch(console.error);
