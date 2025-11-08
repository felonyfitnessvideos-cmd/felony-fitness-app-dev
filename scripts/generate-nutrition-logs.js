import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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
const userId = '13564e60-efe2-4b55-ae83-0d266b55ebf8';

/**
 * Generate a month of nutrition logs with intentionally low protein
 * to test recommendations and progress tracking
 */
async function generateNutritionLogs() {
  console.log('🍽️  Generating nutrition logs for the past 30 days...\n');
  
  try {
    // First, get some food servings to use (focusing on low-protein, high-carb foods)
    const { data: foodServings, error: foodError } = await supabase
      .from('food_servings')
      .select('id, food_name, calories, protein_g, carbs_g, fat_g')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (foodError) throw foodError;
    
    if (!foodServings || foodServings.length === 0) {
      console.error('❌ No food servings found in database');
      return;
    }
    
    console.log(`Found ${foodServings.length} food servings to use\n`);
    
    // Filter foods by type for variety
    const lowProteinFoods = foodServings.filter(f => f.protein_g < 10); // Very low protein
    const someProteinFoods = foodServings.filter(f => f.protein_g >= 10); // Moderate
    
    // If we don't have enough variety, use what we have
    const availableFoods = lowProteinFoods.length > 0 ? lowProteinFoods : foodServings;
    const betterFoods = someProteinFoods.length > 0 ? someProteinFoods : foodServings;
    
    console.log(`Low protein foods: ${lowProteinFoods.length}`);
    console.log(`Some protein foods: ${someProteinFoods.length}\n`);
    
    const logs = [];
    const today = new Date();
    
    // Generate 30 days of data
    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      const logDate = new Date(today);
      logDate.setDate(today.getDate() - daysAgo);
      const dateStr = logDate.toISOString().split('T')[0];
      
      // Breakfast - mostly carbs, low protein
      const breakfastItems = Math.floor(Math.random() * 2) + 2; // 2-3 items
      for (let i = 0; i < breakfastItems; i++) {
        const food = availableFoods[Math.floor(Math.random() * availableFoods.length)];
        logs.push({
          user_id: userId,
          food_serving_id: food.id,
          meal_type: 'Breakfast',
          quantity_consumed: Math.random() < 0.7 ? 1 : 2,
          water_oz_consumed: 0,
          log_date: dateStr,
          notes: '',
          created_at: new Date(logDate.getTime() + Math.random() * 3600000).toISOString() // Random time in morning
        });
      }
      
      // Lunch - slightly better protein, but still low
      const lunchItems = Math.floor(Math.random() * 2) + 2; // 2-3 items
      for (let i = 0; i < lunchItems; i++) {
        // 70% low protein, 30% some protein
        const food = Math.random() < 0.7 
          ? availableFoods[Math.floor(Math.random() * availableFoods.length)]
          : betterFoods[Math.floor(Math.random() * betterFoods.length)];
        
        logs.push({
          user_id: userId,
          food_serving_id: food.id,
          meal_type: 'Lunch',
          quantity_consumed: Math.random() < 0.6 ? 1 : 2,
          water_oz_consumed: 0,
          log_date: dateStr,
          notes: '',
          created_at: new Date(logDate.getTime() + 43200000 + Math.random() * 7200000).toISOString() // Noon + random
        });
      }
      
      // Dinner - similar to lunch
      const dinnerItems = Math.floor(Math.random() * 2) + 2; // 2-3 items
      for (let i = 0; i < dinnerItems; i++) {
        const food = Math.random() < 0.65
          ? availableFoods[Math.floor(Math.random() * availableFoods.length)]
          : betterFoods[Math.floor(Math.random() * betterFoods.length)];
        
        logs.push({
          user_id: userId,
          food_serving_id: food.id,
          meal_type: 'Dinner',
          quantity_consumed: Math.random() < 0.5 ? 1 : 2,
          water_oz_consumed: 0,
          log_date: dateStr,
          notes: '',
          created_at: new Date(logDate.getTime() + 68400000 + Math.random() * 7200000).toISOString() // 7pm + random
        });
      }
      
      // Snacks - 1-2 per day, mostly low protein
      const snackCount = Math.random() < 0.6 ? 1 : 2;
      for (let i = 0; i < snackCount; i++) {
        const food = availableFoods[Math.floor(Math.random() * availableFoods.length)];
        logs.push({
          user_id: userId,
          food_serving_id: food.id,
          meal_type: 'Snack',
          quantity_consumed: 1,
          water_oz_consumed: 0,
          log_date: dateStr,
          notes: '',
          created_at: new Date(logDate.getTime() + 54000000 + Math.random() * 14400000).toISOString() // Afternoon
        });
      }
      
      // Water - 3-5 entries per day
      const waterCount = Math.floor(Math.random() * 3) + 3; // 3-5 water logs
      for (let i = 0; i < waterCount; i++) {
        logs.push({
          user_id: userId,
          food_serving_id: null,
          meal_type: 'Water',
          quantity_consumed: 1,
          water_oz_consumed: Math.floor(Math.random() * 12) + 8, // 8-20 oz
          log_date: dateStr,
          notes: '',
          created_at: new Date(logDate.getTime() + Math.random() * 86400000).toISOString() // Random throughout day
        });
      }
    }
    
    console.log(`📊 Generated ${logs.length} log entries for 30 days\n`);
    
    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('nutrition_logs')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
      
      inserted += batch.length;
      console.log(`✓ Inserted ${inserted} / ${logs.length} entries...`);
    }
    
    console.log('\n✅ Successfully generated nutrition logs!');
    console.log('\nSummary:');
    console.log(`- Total entries: ${logs.length}`);
    console.log(`- Date range: ${new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`);
    console.log(`- Protein levels: Intentionally LOW for testing recommendations`);
    console.log('\n💡 Tip: Check the recommendations page to see if AI detects protein deficiency!');
    
  } catch (error) {
    console.error('❌ Error generating logs:', error);
    process.exit(1);
  }
}

generateNutritionLogs();
