/**
 * @file supabase/functions/food-search-v2/index.ts
 * @description Enhanced Edge Function with AI guardrails for food data quality
 *
 * @project Felony Fitness
 *
 * GUARDRAIL PRINCIPLES:
 * 1. Data Consistency: Nutritional values must be within realistic ranges
 * 2. Serving Size Validation: Standard serving descriptions with reasonable portions
 * 3. Category Enforcement: Foods categorized by primary ingredient, not preparation
 * 4. Duplicate Prevention: Smart matching to prevent database bloat
 * 5. Quality Control: Multi-stage validation before database insertion
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// GUARDRAIL CONFIGURATION
const NUTRITIONAL_LIMITS = {
  calories: { min: 0, max: 2000 },     // Per serving
  protein_g: { min: 0, max: 100 },
  carbs_g: { min: 0, max: 200 },
  fat_g: { min: 0, max: 100 }
};

const VALID_CATEGORIES = [
  "Vegetables", "Fruits", "Meat & Poultry", "Seafood",
  "Dairy & Eggs", "Grains, Bread & Pasta", "Protein & Supplements",
  "Beverages", "Breakfast & Cereals", "Desserts & Sweets"
];

const SERVING_PATTERNS = [
  /^1 (cup|medium|large|small|piece|slice|serving|portion)/i,
  /^100g$/i,
  /^1 oz$/i,
  /^\d+\s*(g|oz|ml|cup|piece|slice|tbsp|tsp)$/i
];

/**
 * Clean search query to extract food name from serving size descriptions
 * Examples: "1/2 cup white rice" -> "white rice", "white rice 1 cup" -> "white rice"
 */
function cleanSearchQuery(query: string): string {
  const cleanQuery = query.toLowerCase().trim();

  // Common serving size patterns to remove
  const servingPatterns = [
    // Fractions with units: "1/2 cup", "3/4 oz", etc.
    /\b\d+\/\d+\s*(cup|cups|oz|ounce|ounces|g|grams|ml|milliliters|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|pound|pounds|lb|slice|slices)\b/gi,
    // Decimal amounts: "1.5 cups", "0.5 oz", etc.
    /\b\d+(\.\d+)?\s*(cup|cups|oz|ounce|ounces|g|grams|ml|milliliters|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|pound|pounds|lb|slice|slices)\b/gi,
    // Whole numbers: "2 cups", "100 grams", etc.
    /\b\d+\s*(cup|cups|oz|ounce|ounces|g|grams|ml|milliliters|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|pound|pounds|lb|slice|slices|small|medium|large|piece|pieces|item|items)\b/gi,
    // Word-based quantities: "half cup", "quarter pound", etc.
    /\b(half|quarter|one|two|three|four|five)\s*(cup|cups|oz|ounce|ounces|g|grams|ml|milliliters|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|pound|pounds|lb|slice|slices)\b/gi,
    // Standalone serving words: "cooked", "raw", "diced", "chopped", etc.
    /\b(cooked|raw|fresh|frozen|diced|chopped|sliced|steamed|boiled|grilled|baked)\b/gi
  ];

  let cleaned = cleanQuery;

  // Remove serving patterns
  for (const pattern of servingPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Clean up extra spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If we removed everything, return original query
  if (!cleaned || cleaned.length < 2) {
    return query.trim();
  }

  return cleaned;
}

/**
 * Validates nutritional data against realistic ranges
 */
function validateNutrition(nutrition: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [nutrient, limits] of Object.entries(NUTRITIONAL_LIMITS)) {
    const value = nutrition[nutrient];
    if (value !== null && value !== undefined) {
      if (value < limits.min || value > limits.max) {
        errors.push(`${nutrient} value ${value} outside acceptable range (${limits.min}-${limits.max})`);
      }
    }
  }

  // Calorie consistency check (rough estimate: 4*carbs + 4*protein + 9*fat)
  const estimatedCalories = (nutrition.carbs_g || 0) * 4 + (nutrition.protein_g || 0) * 4 + (nutrition.fat_g || 0) * 9;
  const actualCalories = nutrition.calories || 0;
  const calorieDifference = Math.abs(estimatedCalories - actualCalories);

  if (calorieDifference > actualCalories * 0.3) { // 30% tolerance
    errors.push(`Calorie inconsistency: estimated ${estimatedCalories}, provided ${actualCalories}`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates and normalizes food category
 */
function validateCategory(food: any): string {
  const foodName = food.name?.toLowerCase() || '';

  // Category enforcement rules based on primary ingredient
  if (foodName.includes('chicken') || foodName.includes('beef') || foodName.includes('pork') ||
    foodName.includes('turkey') || foodName.includes('meat')) {
    return "Meat & Poultry";
  }

  if (foodName.includes('fish') || foodName.includes('salmon') || foodName.includes('tuna') ||
    foodName.includes('shrimp') || foodName.includes('crab')) {
    return "Seafood";
  }

  if (foodName.includes('milk') || foodName.includes('cheese') || foodName.includes('yogurt') ||
    foodName.includes('egg')) {
    return "Dairy & Eggs";
  }

  if (foodName.includes('rice') || foodName.includes('bread') || foodName.includes('pasta') ||
    foodName.includes('oats') || foodName.includes('cereal') || foodName.includes('chip')) {
    return "Grains, Bread & Pasta";
  }

  if (foodName.includes('protein') || foodName.includes('whey') || foodName.includes('casein') ||
    foodName.includes('supplement')) {
    return "Protein & Supplements";
  }

  if (foodName.includes('apple') || foodName.includes('banana') || foodName.includes('orange') ||
    foodName.includes('berry') || foodName.includes('fruit')) {
    return "Fruits";
  }

  if (foodName.includes('broccoli') || foodName.includes('spinach') || foodName.includes('carrot') ||
    foodName.includes('vegetable')) {
    return "Vegetables";
  }

  if (foodName.includes('coffee') || foodName.includes('tea') || foodName.includes('water') ||
    foodName.includes('juice') || foodName.includes('soda')) {
    return "Beverages";
  }

  if (foodName.includes('cake') || foodName.includes('cookie') || foodName.includes('ice cream') ||
    foodName.includes('candy') || foodName.includes('chocolate')) {
    return "Desserts & Sweets";
  }

  // Default fallback
  return "Grains, Bread & Pasta";
}

/**
 * Validates serving description format
 */
function validateServingDescription(description: string): boolean {
  return SERVING_PATTERNS.some(pattern => pattern.test(description.trim()));
}

/**
 * Enhanced AI prompt with strict guardrails
 */
function createEnhancedPrompt(query: string): string {
  return `You are a nutrition database expert. Provide comprehensive nutritional information for "${query}".

STRICT REQUIREMENTS:
1. Return 1-3 common serving sizes only
2. Use ONLY these categories: ${VALID_CATEGORIES.join(', ')}
3. Serving descriptions must follow patterns: "1 cup", "100g", "1 medium", "1 slice", etc.
4. Nutritional values must be realistic per serving:
   - Calories: 0-2000
   - Protein: 0-100g  
   - Carbs: 0-200g
   - Fat: 0-100g
5. Categorize by PRIMARY ingredient, not preparation method
6. Ensure calories ≈ (4×carbs + 4×protein + 9×fat)
7. Include COMPLETE micronutrient data (vitamins & minerals)
8. Calculate PDCAAS score (Protein Digestibility-Corrected Amino Acid Score) 0.0-1.0:
   - Whey/Egg: 1.0
   - Beef/Chicken: 0.92
   - Soy: 0.91
   - Legumes: 0.7
   - Grains: 0.4-0.5
   - Vegetables: 0.3-0.7
9. If micronutrient data is unknown/insignificant, explicitly set to 0 (no nulls)

Format as valid JSON:
{
  "results": [
    {
      "name": "exact food name",
      "brand": "brand name if applicable, null otherwise",
      "category": "category from approved list",
      "serving_description": "standard serving format",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "sugar_g": number,
      "sodium_mg": number,
      "calcium_mg": number,
      "iron_mg": number,
      "vitamin_c_mg": number,
      "potassium_mg": number,
      "vitamin_a_mcg": number,
      "vitamin_e_mg": number,
      "vitamin_k_mcg": number,
      "thiamin_mg": number,
      "riboflavin_mg": number,
      "niacin_mg": number,
      "vitamin_b6_mg": number,
      "folate_mcg": number,
      "vitamin_b12_mcg": number,
      "magnesium_mg": number,
      "phosphorus_mg": number,
      "zinc_mg": number,
      "copper_mg": number,
      "selenium_mcg": number,
      "pdcaas_score": number (0.0-1.0)
    }
  ]
}`;
}

/**
 * Fuzzy matching to prevent duplicates
 */
async function findSimilarFoods(supabase: any, foodName: string) {
  // Only check for very close matches (exact or near-exact)
  const { data } = await supabase
    .from('foods')
    .select('id, name, category')
    .or(`name.ilike.${foodName},name.ilike.${foodName.replace(/\s+/g, '%')}`)
    .limit(3);

  // Only return if we find an exact match (case insensitive)
  const exactMatches = (data || []).filter((food: any) =>
    food.name.toLowerCase() === foodName.toLowerCase()
  );

  return exactMatches;
}

/**
 * Main handler with comprehensive guardrails
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
      console.log('Received request body:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Failed to parse JSON body:', parseError);
      throw new Error("Invalid JSON in request body");
    }

    const { query } = body;
    console.log('Extracted query:', query);

    if (!query) {
      throw new Error("Search query is required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Step 1: Clean the search query to extract food name from serving sizes
    const cleanedQuery = cleanSearchQuery(query);
    console.log(`Original query: "${query}" -> Cleaned: "${cleanedQuery}"`);

    // Step 2: Enhanced local search with better relevance ranking
    const searchTerms = cleanedQuery.toLowerCase().split(' ');
    const primaryTerm = searchTerms[0];
    const fullQuery = cleanedQuery.toLowerCase();

    // CRITICAL FIX: food_servings table is denormalized - food_name is a text field, not a foreign key!
    // Search food_servings directly (similar to exercise-search pattern)
    console.log('Starting database search on food_servings...');
    const { data: allMatches, error: localError } = await supabaseAdmin
      .from('food_servings')
      .select('*')
      .ilike('food_name', `%${cleanedQuery}%`)
      .limit(20); // Get more results to rank them

    console.log('Database search complete:', { matchCount: allMatches?.length || 0, error: localError });

    if (localError) {
      console.error('Database error:', localError);
      throw localError;
    }

    // If cleaned query returns no results, try original query as fallback
    let searchResults = allMatches || [];
    if (searchResults.length === 0 && cleanedQuery !== query.toLowerCase()) {
      console.log('No results with cleaned query, trying original query as fallback...');
      const { data: fallbackMatches, error: fallbackError } = await supabaseAdmin
        .from('food_servings')
        .select('*')
        .ilike('food_name', `%${query}%`)
        .limit(20);

      if (!fallbackError && fallbackMatches) {
        searchResults = fallbackMatches;
        console.log(`Fallback search found ${searchResults.length} results`);
      }
    }

    // Rank results by relevance
    const rankedResults = (searchResults || [])
      .map((food: any) => {
        const name = (food.food_name || food.name || '').toLowerCase();
        let score = 0;

        // Use cleanedQuery for scoring, but original query as backup
        const scoringQuery = searchResults === allMatches ? fullQuery : query.toLowerCase();
        const scoringTerms = searchResults === allMatches ? searchTerms : query.toLowerCase().split(' ');

        // Exact match gets highest score
        if (name === scoringQuery) score += 100;

        // Name starts with query gets high score
        if (name.startsWith(scoringQuery)) score += 50;

        // Contains all search terms gets good score
        if (scoringTerms.every((term: string) => name.includes(term))) score += 30;

        // Contains primary term gets base score
        const primaryScoringTerm = scoringTerms[0];
        if (name.includes(primaryScoringTerm)) score += 10;

        // Penalty for very different length (likely irrelevant)
        const lengthDiff = Math.abs(name.length - scoringQuery.length);
        if (lengthDiff > scoringQuery.length * 2) score -= 20;

        return { ...food, relevanceScore: score };
      })
      .filter((food: any) => food.relevanceScore > 0)
      .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);

    if (rankedResults.length > 0) {
      return new Response(JSON.stringify({
        results: rankedResults,
        source: 'local',
        quality_score: 'verified'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 3: Check for similar foods to prevent duplicates (optional - skip for now since no foods table relationship)
    // TODO: Re-enable after schema consolidation

    // Step 4: AI generation with enhanced guardrails
    const enhancedPrompt = createEnhancedPrompt(cleanedQuery);

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: enhancedPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Very low for consistency
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API request failed: ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
    const aiResults = JSON.parse(aiData.choices[0].message.content);

    // Step 4: Comprehensive validation and normalization
    const validatedResults = [];
    const validationErrors = [];

    for (const food of aiResults.results || []) {
      // Normalize all nutrition fields - ensure no nulls, set to 0 if missing
      const normalizedFood = {
        name: food.name,
        brand: food.brand || null,
        category: food.category,
        serving_description: food.serving_description,
        // Core macronutrients
        calories: food.calories ?? 0,
        protein_g: food.protein_g ?? 0,
        carbs_g: food.carbs_g ?? 0,
        fat_g: food.fat_g ?? 0,
        fiber_g: food.fiber_g ?? 0,
        sugar_g: food.sugar_g ?? 0,
        // Micronutrients - all default to 0 if not provided
        sodium_mg: food.sodium_mg ?? 0,
        calcium_mg: food.calcium_mg ?? 0,
        iron_mg: food.iron_mg ?? 0,
        vitamin_c_mg: food.vitamin_c_mg ?? 0,
        potassium_mg: food.potassium_mg ?? 0,
        vitamin_a_mcg: food.vitamin_a_mcg ?? 0,
        vitamin_e_mg: food.vitamin_e_mg ?? 0,
        vitamin_k_mcg: food.vitamin_k_mcg ?? 0,
        thiamin_mg: food.thiamin_mg ?? 0,
        riboflavin_mg: food.riboflavin_mg ?? 0,
        niacin_mg: food.niacin_mg ?? 0,
        vitamin_b6_mg: food.vitamin_b6_mg ?? 0,
        folate_mcg: food.folate_mcg ?? 0,
        vitamin_b12_mcg: food.vitamin_b12_mcg ?? 0,
        magnesium_mg: food.magnesium_mg ?? 0,
        phosphorus_mg: food.phosphorus_mg ?? 0,
        zinc_mg: food.zinc_mg ?? 0,
        copper_mg: food.copper_mg ?? 0,
        selenium_mcg: food.selenium_mcg ?? 0,
        // Protein quality score
        pdcaas_score: food.pdcaas_score ?? 0
      };

      // Validate nutrition
      const nutritionCheck = validateNutrition(normalizedFood);
      if (!nutritionCheck.isValid) {
        validationErrors.push(`${normalizedFood.name}: ${nutritionCheck.errors.join(', ')}`);
        continue;
      }

      // Validate category
      if (!VALID_CATEGORIES.includes(normalizedFood.category)) {
        normalizedFood.category = validateCategory(normalizedFood);
      }

      // Validate serving description
      if (!validateServingDescription(normalizedFood.serving_description || '')) {
        validationErrors.push(`${normalizedFood.name}: Invalid serving description format`);
        continue;
      }

      validatedResults.push({
        ...normalizedFood,
        quality_score: 85 // AI-validated foods get high quality score (0-100)
      });
    }

    return new Response(JSON.stringify({
      results: validatedResults,
      source: 'external',
      validation_errors: validationErrors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      quality_score: 'error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});