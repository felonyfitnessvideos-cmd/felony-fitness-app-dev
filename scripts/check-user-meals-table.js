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

async function checkTable() {
  try {
    console.log('Checking user_meals table structure...\n');
    
    // Try to query the table
    const { data, error } = await supabase
      .from('user_meals')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying user_meals:', error.message);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
    } else {
      console.log('✓ user_meals table exists');
      if (data && data.length > 0) {
        console.log('Sample row columns:', Object.keys(data[0]));
      } else {
        console.log('No rows in table yet');
      }
    }
    
    // Check if table exists in information_schema
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'user_meals'
          ORDER BY ordinal_position;
        `
      });
    
    if (tableError) {
      console.log('\nTrying direct query...');
      // Table might not exist
      const { data: tables, error: listError } = await supabase
        .rpc('exec_sql', {
          sql_query: `
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename LIKE '%meal%'
            ORDER BY tablename;
          `
        });
      
      if (!listError) {
        console.log('\nMeal-related tables found:');
        console.log(tables);
      }
    } else {
      console.log('\nTable structure:');
      console.table(tableInfo);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTable();
