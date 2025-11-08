/**
 * Populate Micronutrients Script
 * 
 * Fetches comprehensive nutrition data from USDA FoodData Central API
 * and updates food_servings table with vitamin/mineral information.
 * 
 * USDA API Key: Get free key at https://fdc.nal.usda.gov/api-key-signup.html
 * 
 * Usage:
 *   node scripts/populate-micronutrients.js
 * 
 * Environment Variables:
 *   USDA_API_KEY - Your USDA FoodData Central API key
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_KEY - Your Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local in the project root
const envPath = join(__dirname, '..', '.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env.local:', result.error);
  process.exit(1);
}

// Debug: Check if environment variables are loaded
console.log('🔍 Environment check:');
console.log('Loaded from:', envPath);
console.log('USDA_API_KEY:', process.env.USDA_API_KEY ? '✅ Set' : '❌ Missing');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
console.log('');

// USDA FoodData Central API Configuration
const USDA_API_KEY = process.env.USDA_API_KEY;
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// Supabase Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * USDA Nutrient ID Mapping
 * Maps USDA nutrient IDs to our database columns
 */
const NUTRIENT_MAP = {
  // Macros (already have these, but included for completeness)
  1008: 'calories',           // Energy (kcal)
  1003: 'protein_g',          // Protein
  1005: 'carbs_g',            // Carbohydrate
  1004: 'fat_g',              // Total lipid (fat)
  1079: 'fiber_g',            // Fiber, total dietary
  2000: 'sugar_g',            // Sugars, total
  
  // Minerals
  1093: 'sodium_mg',          // Sodium
  1087: 'calcium_mg',         // Calcium
  1089: 'iron_mg',            // Iron
  1092: 'potassium_mg',       // Potassium
  1090: 'magnesium_mg',       // Magnesium
  1091: 'phosphorus_mg',      // Phosphorus
  1095: 'zinc_mg',            // Zinc
  1098: 'copper_mg',          // Copper
  1103: 'selenium_mcg',       // Selenium (convert from µg)
  
  // Vitamins
  1106: 'vitamin_a_mcg',      // Vitamin A, RAE (convert from µg)
  1162: 'vitamin_c_mg',       // Vitamin C
  1109: 'vitamin_e_mg',       // Vitamin E (alpha-tocopherol)
  1185: 'vitamin_k_mcg',      // Vitamin K (phylloquinone) (convert from µg)
  1165: 'thiamin_mg',         // Thiamin (B1)
  1166: 'riboflavin_mg',      // Riboflavin (B2)
  1167: 'niacin_mg',          // Niacin (B3)
  1175: 'vitamin_b6_mg',      // Vitamin B6
  1177: 'folate_mcg',         // Folate, total (convert from µg)
  1178: 'vitamin_b12_mcg',    // Vitamin B12 (convert from µg)
};

/**
 * Search USDA FoodData Central for a food item
 * 
 * @param {string} foodName - Name of the food to search
 * @returns {Promise<Array>} - Array of matching foods
 */
async function searchUSDAFood(foodName) {
  try {
    const searchUrl = `${USDA_BASE_URL}/foods/search`;
    const params = new URLSearchParams({
      api_key: USDA_API_KEY,
      query: foodName,
      pageSize: 5,
      dataType: 'Survey (FNDDS)', // Prioritize survey foods (most complete data)
    });

    const response = await fetch(`${searchUrl}?${params}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`USDA API Response (${response.status}):`, errorText);
      throw new Error(`USDA API error: ${response.statusText} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    return data.foods || [];
  } catch (error) {
    console.error(`Error searching USDA for "${foodName}":`, error.message);
    return [];
  }
}

/**
 * Get detailed nutrition data for a specific USDA food
 * 
 * @param {number} fdcId - USDA FDC ID
 * @returns {Promise<Object>} - Complete nutrition data
 */
async function getUSDAFoodDetails(fdcId) {
  try {
    const detailUrl = `${USDA_BASE_URL}/food/${fdcId}`;
    const params = new URLSearchParams({
      api_key: USDA_API_KEY,
    });

    const response = await fetch(`${detailUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`USDA API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching USDA food ${fdcId}:`, error.message);
    return null;
  }
}

/**
 * Extract nutrient values from USDA food data
 * 
 * @param {Object} usdaFood - USDA food details
 * @returns {Object} - Nutrient values mapped to our column names
 */
function extractNutrients(usdaFood) {
  const nutrients = {};
  
  if (!usdaFood || !usdaFood.foodNutrients) {
    return nutrients;
  }

  // Map USDA nutrients to our database columns
  usdaFood.foodNutrients.forEach(nutrient => {
    const nutrientId = nutrient.nutrient?.id;
    const columnName = NUTRIENT_MAP[nutrientId];
    
    if (columnName && nutrient.amount !== null && nutrient.amount !== undefined) {
      nutrients[columnName] = nutrient.amount;
    }
  });

  return nutrients;
}

/**
 * Update a food_servings row with micronutrient data
 * 
 * @param {string} foodId - food_servings ID
 * @param {Object} nutrients - Nutrient data to update
 * @returns {Promise<boolean>} - Success status
 */
async function updateFoodServingNutrients(foodId, nutrients) {
  try {
    const { error } = await supabase
      .from('food_servings')
      .update(nutrients)
      .eq('id', foodId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error updating food ${foodId}:`, error.message);
    return false;
  }
}

/**
 * Process a single food item
 * 
 * @param {Object} food - food_servings record
 * @returns {Promise<Object>} - Result with status and data
 */
async function processFoodItem(food) {
  console.log(`\n🔍 Processing: ${food.food_name}`);

  // Search USDA for matching foods
  const searchResults = await searchUSDAFood(food.food_name);
  
  if (searchResults.length === 0) {
    console.log(`   ⚠️  No USDA matches found`);
    return { success: false, reason: 'no_match' };
  }

  // Use the best match (first result)
  const bestMatch = searchResults[0];
  console.log(`   ✓ Found match: ${bestMatch.description} (FDC ID: ${bestMatch.fdcId})`);

  // Get detailed nutrition data
  const foodDetails = await getUSDAFoodDetails(bestMatch.fdcId);
  
  if (!foodDetails) {
    console.log(`   ⚠️  Failed to fetch details`);
    return { success: false, reason: 'fetch_failed' };
  }

  // Extract nutrients
  const nutrients = extractNutrients(foodDetails);
  const nutrientCount = Object.keys(nutrients).length;
  console.log(`   ✓ Extracted ${nutrientCount} nutrients`);

  if (nutrientCount === 0) {
    console.log(`   ⚠️  No nutrients found`);
    return { success: false, reason: 'no_nutrients' };
  }

  // Update database
  const updated = await updateFoodServingNutrients(food.id, nutrients);
  
  if (updated) {
    console.log(`   ✅ Updated successfully`);
    return { success: true, nutrientCount };
  } else {
    console.log(`   ❌ Update failed`);
    return { success: false, reason: 'update_failed' };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Micronutrient Population Script\n');

  // Validate environment variables
  if (!USDA_API_KEY) {
    console.error('❌ Error: USDA_API_KEY environment variable not set');
    console.log('Get a free API key at: https://fdc.nal.usda.gov/api-key-signup.html');
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase credentials not found in environment');
    process.exit(1);
  }

  console.log('✓ Environment variables validated\n');

  // Fetch all food_servings that need micronutrient data
  console.log('📥 Fetching foods from database...');
  const { data: foods, error } = await supabase
    .from('food_servings')
    .select('id, food_name, vitamin_a_mcg')
    .order('food_name');

  if (error) {
    console.error('❌ Error fetching foods:', error.message);
    process.exit(1);
  }

  console.log(`✓ Found ${foods.length} foods in database\n`);

  // Filter foods that don't have micronutrient data
  const foodsToUpdate = foods.filter(f => !f.vitamin_a_mcg);
  console.log(`📊 ${foodsToUpdate.length} foods need micronutrient data\n`);

  if (foodsToUpdate.length === 0) {
    console.log('✅ All foods already have micronutrient data!');
    return;
  }

  // Process foods in batches to avoid rate limiting
  const BATCH_SIZE = 10;
  const DELAY_MS = 1000; // 1 second between batches

  const stats = {
    total: foodsToUpdate.length,
    success: 0,
    noMatch: 0,
    failed: 0,
  };

  for (let i = 0; i < foodsToUpdate.length; i += BATCH_SIZE) {
    const batch = foodsToUpdate.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(foodsToUpdate.length / BATCH_SIZE)}`);

    // Process batch items sequentially (to respect rate limits)
    for (const food of batch) {
      const result = await processFoodItem(food);
      
      if (result.success) {
        stats.success++;
      } else if (result.reason === 'no_match') {
        stats.noMatch++;
      } else {
        stats.failed++;
      }

      // Small delay between items
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Delay between batches
    if (i + BATCH_SIZE < foodsToUpdate.length) {
      console.log(`\n⏸️  Waiting ${DELAY_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // Print final statistics
  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Statistics:');
  console.log('='.repeat(60));
  console.log(`Total foods processed:    ${stats.total}`);
  console.log(`✅ Successfully updated:  ${stats.success} (${Math.round(stats.success / stats.total * 100)}%)`);
  console.log(`⚠️  No USDA match found:  ${stats.noMatch} (${Math.round(stats.noMatch / stats.total * 100)}%)`);
  console.log(`❌ Failed:                ${stats.failed} (${Math.round(stats.failed / stats.total * 100)}%)`);
  console.log('='.repeat(60));
  console.log('\n✅ Micronutrient population complete!\n');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
