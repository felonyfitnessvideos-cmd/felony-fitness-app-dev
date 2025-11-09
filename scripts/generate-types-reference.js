/**
 * Generate a reference document of current database schema
 * Run this to get fresh types information before making schema changes
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateTypesReference() {
  console.log('🔍 Fetching table structures from database...\n');

  const tables = [
    'programs',
    'trainer_clients',
    'scheduled_routines',
    'workout_routines',
    'exercises',
    'routine_exercises',
    'mesocycles',
    'mesocycle_weeks',
    'cycle_sessions'
  ];

  let output = '# DATABASE SCHEMA REFERENCE\n';
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += '---\n\n';

  for (const tableName of tables) {
    console.log(`Checking table: ${tableName}`);
    
    // Query information_schema for column details
    const { data: columns, error } = await supabase.rpc('get_table_columns', {
      table_name_param: tableName
    });

    if (error) {
      console.log(`⚠️  Table ${tableName} - using fallback method`);
      
      // Fallback: try to query the table directly to see what columns exist
      const { data: sample, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (sampleError) {
        output += `## ${tableName}\n`;
        output += `**Status:** Table may not exist or not accessible\n`;
        output += `**Error:** ${sampleError.message}\n\n`;
        continue;
      }

      if (sample && sample.length > 0) {
        output += `## ${tableName}\n`;
        output += `**Status:** ✅ Exists (columns inferred from data)\n`;
        output += `**Columns:**\n`;
        const sampleRow = sample[0];
        Object.keys(sampleRow).forEach(col => {
          const value = sampleRow[col];
          const type = typeof value;
          output += `- \`${col}\` (${type})\n`;
        });
        output += '\n';
      } else {
        output += `## ${tableName}\n`;
        output += `**Status:** ✅ Exists but empty\n\n`;
      }
      
      continue;
    }

    output += `## ${tableName}\n`;
    output += `**Status:** ✅ Exists\n`;
    output += `**Columns:**\n`;
    
    if (columns && columns.length > 0) {
      columns.forEach(col => {
        output += `- \`${col.column_name}\`: ${col.data_type}`;
        if (col.is_nullable === 'NO') output += ' (NOT NULL)';
        if (col.column_default) output += ` DEFAULT ${col.column_default}`;
        output += '\n';
      });
    }
    output += '\n';
  }

  // Write to file
  const outputPath = 'docs/DATABASE_SCHEMA_REFERENCE.md';
  fs.writeFileSync(outputPath, output);
  console.log(`\n✅ Schema reference generated: ${outputPath}`);
}

generateTypesReference().catch(console.error);
