/**
 * Test the routine generator with real program data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { generateRoutines } from '../src/utils/routineGenerator.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testRoutineGeneration() {
  console.log('🧪 TESTING ROUTINE GENERATION');
  console.log('='.repeat(80));
  console.log('');

  // Fetch a program
  const { data: programs, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_template', true)
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Error fetching program:', error.message);
    return;
  }

  console.log(`📋 Testing with: ${programs.name}`);
  console.log(`   Difficulty: ${programs.difficulty_level}`);
  console.log(`   Exercises in pool: ${programs.exercise_pool?.length || 0}\n`);

  // Test different frequencies
  const frequencies = [2, 3, 4, 5, 6];

  for (const freq of frequencies) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🔢 Generating ${freq}-Day Split:`);
    console.log('─'.repeat(80));

    try {
      const routines = generateRoutines(programs.exercise_pool, freq);

      routines.forEach((routine, idx) => {
        console.log(`\n📅 Day ${idx + 1}: ${routine.name}`);
        console.log(`   Exercises: ${routine.exercises.length}`);
        console.log(`   Total Sets: ${routine.total_sets}`);
        console.log(`   Volume Status: ${routine.volume_status || 'N/A'}`);
        console.log(`   Target Muscles: ${routine.muscle_groups.slice(0, 5).join(', ')}${routine.muscle_groups.length > 5 ? '...' : ''}`);
        
        // Show first 3 exercises
        console.log(`   Exercises:`);
        routine.exercises.slice(0, 3).forEach(ex => {
          const muscles = ex.muscle_groups?.primary?.join(', ') || 'Unknown';
          console.log(`     • ${muscles} - ${ex.sets}x${ex.reps}`);
        });
        if (routine.exercises.length > 3) {
          console.log(`     ... and ${routine.exercises.length - 3} more`);
        }
      });

      // Stats
      const totalExercises = routines.reduce((sum, r) => sum + r.exercises.length, 0);
      const totalSets = routines.reduce((sum, r) => sum + r.total_sets, 0);
      const avgExPerDay = (totalExercises / freq).toFixed(1);
      const avgSetsPerDay = (totalSets / freq).toFixed(1);

      console.log(`\n📊 Split Statistics:`);
      console.log(`   Total Exercises: ${totalExercises}`);
      console.log(`   Total Sets: ${totalSets}`);
      console.log(`   Avg Exercises/Day: ${avgExPerDay}`);
      console.log(`   Avg Sets/Day: ${avgSetsPerDay}`);

    } catch (err) {
      console.error(`❌ Error generating ${freq}-day split:`, err.message);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ Testing complete!');
}

testRoutineGeneration().catch(console.error);
