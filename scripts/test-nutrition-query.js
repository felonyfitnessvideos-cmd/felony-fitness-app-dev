/**
 * Test the nutrition_logs query that the Edge Function uses
 * to see if we can retrieve recent logs
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Need: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNutritionQuery() {
  console.log('🧪 Testing nutrition_logs query...\n');

  const userId = '13564e60-efe2-4b55-ae83-0d266b55ebf8';
  
  // Calculate 7 days ago (same logic as Edge Function)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const dateFilter = sevenDaysAgo.toISOString().split('T')[0];
  
  console.log('Today:', new Date().toISOString().split('T')[0]);
  console.log('7 days ago filter:', dateFilter);
  console.log('User ID:', userId);
  console.log('');

  try {
    // Test the exact query from the Edge Function
    const { data, error } = await supabase
      .from('nutrition_logs')
      .select('id, food_serving_id, quantity_consumed, log_date, created_at')
      .eq('user_id', userId)
      .gte('log_date', dateFilter)
      .order('log_date', { ascending: false });

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    console.log(`✅ Found ${data.length} nutrition log entries\n`);

    if (data.length > 0) {
      console.log('Sample entries:');
      data.slice(0, 10).forEach((entry, i) => {
        console.log(`  ${i + 1}. log_date: ${entry.log_date}, food_serving_id: ${entry.food_serving_id ? 'present' : 'NULL'}, quantity: ${entry.quantity_consumed}`);
      });
      
      // Group by log_date
      const byDate = {};
      data.forEach(entry => {
        if (!byDate[entry.log_date]) {
          byDate[entry.log_date] = 0;
        }
        byDate[entry.log_date]++;
      });
      
      console.log('\nEntries by date:');
      Object.keys(byDate).sort().forEach(date => {
        console.log(`  ${date}: ${byDate[date]} entries`);
      });
    } else {
      console.log('⚠️  No entries found - AI will say no food data available');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testNutritionQuery();
