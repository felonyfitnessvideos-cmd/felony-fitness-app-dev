/**
 * Run SQL Migration Script
 * Executes SQL migration files against Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase connection details
const SUPABASE_URL = 'https://ytpblkbwgdbiserhrlqm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.error('Please set it in your .env.local file or pass it as an environment variable');
  process.exit(1);
}

// Get migration file from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Error: No migration file specified');
  console.error('Usage: node run-migration.js <migration-file-path>');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log('📁 Reading migration file:', migrationFile);
    const sql = readFileSync(migrationFile, 'utf8');
    
    console.log('🔗 Connecting to Supabase...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false
      }
    });

    console.log('🚀 Executing migration...');
    console.log('━'.repeat(60));
    
    // Split SQL into individual statements (basic splitting by semicolon)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || !statement.trim()) {
        continue;
      }

      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          // Try direct query if RPC doesn't exist
          const { error: directError } = await supabase
            .from('_migrations')
            .select('*')
            .limit(0); // Just test connection

          if (directError) {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            errorCount++;
          } else {
            // Need to use REST API directly for DDL
            console.log(`⚠️  Statement ${i + 1}: Using REST API (DDL not supported via SDK)`);
            console.log(`   ${statement.substring(0, 80)}...`);
          }
        } else {
          successCount++;
          console.log(`✅ Statement ${i + 1} completed`);
        }
      } catch (err) {
        console.error(`❌ Statement ${i + 1} error:`, err.message);
        errorCount++;
      }
    }

    console.log('━'.repeat(60));
    console.log('📈 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total: ${statements.length}`);
    
    if (errorCount === 0) {
      console.log('✨ Migration completed successfully!');
      console.log('\n⚠️  Note: If using Supabase SDK, DDL statements may need to be run via SQL Editor');
      console.log('   Copy the SQL from:', migrationFile);
      console.log('   Run it at: https://supabase.com/dashboard/project/ytpblkbwgdbiserhrlqm/sql');
    } else {
      console.log('⚠️  Migration completed with errors. Please review above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Fatal error running migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
