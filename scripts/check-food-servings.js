import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL is missing from environment variables');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_KEY is missing from environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('Checking food_servings table structure...\n');
  
  const { data, error } = await supabase
    .from('food_servings')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('✓ food_servings columns:', Object.keys(data[0]));
    console.log('\nSample row:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No data found in food_servings table');
  }
}

checkColumns();
