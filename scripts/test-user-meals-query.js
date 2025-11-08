import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const userId = '13564e60-efe2-4b55-ae83-0d266b55ebf8';

async function testQuery() {
  console.log('Testing user_meals query...\n');
  
  // Test 1: Simple query
  console.log('Test 1: Simple user_meals query');
  const { data: simple, error: simpleError } = await supabase
    .from('user_meals')
    .select('*')
    .eq('user_id', userId)
    .limit(3);
  
  if (simpleError) {
    console.error('❌ Error:', simpleError);
  } else {
    console.log('✓ Success! Found', simple.length, 'rows');
    console.log('Sample:', simple[0]);
  }
  
  // Test 2: Query with meals relationship
  console.log('\nTest 2: Query with meals relationship');
  const { data: withMeals, error: mealsError } = await supabase
    .from('user_meals')
    .select(`
      is_favorite,
      custom_name,
      meals (
        id,
        name,
        category
      )
    `)
    .eq('user_id', userId)
    .limit(3);
  
  if (mealsError) {
    console.error('❌ Error:', mealsError.message);
    console.error('Details:', mealsError.details);
    console.error('Hint:', mealsError.hint);
    console.error('Code:', mealsError.code);
  } else {
    console.log('✓ Success! Found', withMeals.length, 'rows');
    console.log('Sample:', JSON.stringify(withMeals[0], null, 2));
  }
  
  // Test 3: Try alternative relationship name
  console.log('\nTest 3: Try meal (singular) relationship');
  const { data: withMeal, error: mealError } = await supabase
    .from('user_meals')
    .select(`
      is_favorite,
      custom_name,
      meal:meal_id (
        id,
        name,
        category
      )
    `)
    .eq('user_id', userId)
    .limit(3);
  
  if (mealError) {
    console.error('❌ Error:', mealError.message);
  } else {
    console.log('✓ Success! Found', withMeal.length, 'rows');
    console.log('Sample:', JSON.stringify(withMeal[0], null, 2));
  }
}

testQuery();
