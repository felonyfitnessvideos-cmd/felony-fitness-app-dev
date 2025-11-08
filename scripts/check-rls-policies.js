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

async function checkRLS() {
  console.log('Checking RLS policies for meals-related tables...\n');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT 
          schemaname,
          tablename,
          rowsecurity as rls_enabled
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('meals', 'user_meals', 'meal_foods', 'food_servings', 'foods')
        ORDER BY tablename;
      `
    });
    
    if (error) {
      console.error('Error checking RLS:', error);
      
      // Try alternative method
      console.log('\nTrying alternative query...');
      const { error: err2 } = await supabase
        .from('meals')
        .select('*')
        .limit(1);
      
      if (err2) {
        console.log('meals table error:', err2);
      } else {
        console.log('✓ Can query meals table');
      }
    } else {
      console.log('Table RLS Status:');
      console.table(data);
      
      // Check specific policies
      const { data: policies, error: policyError } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT 
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual
          FROM pg_policies
          WHERE schemaname = 'public'
          AND tablename IN ('meals', 'user_meals', 'meal_foods')
          ORDER BY tablename, policyname;
        `
      });
      
      if (!policyError && policies) {
        console.log('\nRLS Policies:');
        console.table(policies);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRLS();
