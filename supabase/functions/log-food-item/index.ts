/**
 * Log Food Item Edge Function
 * 
 * @module log-food-item
 * @description Logs a food item to the user's nutrition log with comprehensive validation
 * and quality scoring. Handles both local database foods and external API foods.
 * Provides quality warnings for suspicious or low-quality nutrition data.
 * 
 * @author Felony Fitness Development Team
 * @version 1.0.0
 * @since 2025-11-05
 * 
 * @security
 * - JWT authentication required
 * - RLS policies enforced on nutrition_logs table
 * - User can only log food for themselves
 * - External food data validated before insertion
 * 
 * @example
 * // Log local food from database
 * const { data, error } = await supabase.functions.invoke('log-food-item', {
 *   body: {
 *     p_food_serving_id: 123,
 *     p_meal_type: 'Breakfast',
 *     p_quantity_consumed: 1.5,
 *     p_user_id: userId,
 *     p_log_date: '2025-11-05'
 *   }
 * });
 * 
 * @example
 * // Log external food with validation
 * const { data, error } = await supabase.functions.invoke('log-food-item', {
 *   body: {
 *     p_external_food: { name: 'Banana', calories: 105, protein_g: 1.3 },
 *     p_meal_type: 'Snack',
 *     p_quantity_consumed: 1.0,
 *     p_user_id: userId
 *   }
 * });
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const {
      p_external_food,
      p_food_serving_id,
      p_meal_type = 'Snack',
      p_quantity_consumed = 1.0,
      p_user_id,
      p_log_date,
    } = await req.json();

    // Verify user can only log for themselves
    if (p_user_id && p_user_id !== user.id) {
      throw new Error('Cannot log food for other users');
    }

    const userId = p_user_id || user.id;
    const logDate = p_log_date || new Date().toISOString().split('T')[0];

    let servingId = p_food_serving_id;
    let qualityScore = 'verified';
    let warning = null;

    // Handle external food data
    if (p_external_food) {
      // Validate nutrition data
      const validation = validateNutritionData(p_external_food);

      if (!validation.isValid) {
        return new Response(
          JSON.stringify({
            error: validation.errors.join('; '),
            quality_score: 'invalid',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      if (validation.warnings.length > 0) {
        warning = validation.warnings.join('; ');
        qualityScore = 'needs_review';
      }

      // Insert external food into food_servings
      const { data: newServing, error: insertError } = await supabase
        .from('food_servings')
        .insert({
          food_name: p_external_food.name || 'Unknown Food',
          serving_description: p_external_food.serving_description || '1 serving',
          calories: p_external_food.calories || 0,
          protein_g: p_external_food.protein_g || 0,
          carbs_g: p_external_food.carbs_g || 0,
          fat_g: p_external_food.fat_g || 0,
          fiber_g: p_external_food.fiber_g || 0,
          sugar_g: p_external_food.sugar_g || 0,
          sodium_mg: p_external_food.sodium_mg || 0,
          is_verified: false,
          quality_score: qualityScore,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      servingId = newServing.id;
    }

    if (!servingId) {
      // Water entry - no food serving, just log water consumption
      const { data: logEntry, error: logError } = await supabase
        .from('nutrition_logs')
        .insert({
          user_id: userId,
          food_serving_id: null,
          meal_type: p_meal_type,
          quantity_consumed: p_quantity_consumed,
          log_date: logDate,
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        })
        .select()
        .single();

      if (logError) {
        throw logError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          log_id: logEntry.id,
          quality_score: qualityScore,
          warning: warning,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Fetch the food serving data to get macro values for denormalization
    const { data: foodServing, error: servingError } = await supabase
      .from('food_servings')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('id', servingId)
      .single();

    if (servingError) {
      throw new Error('Food serving not found: ' + servingError.message);
    }

    // Insert nutrition log entry with denormalized macro columns
    // Use 0 instead of null for missing values
    const { data: logEntry, error: logError } = await supabase
      .from('nutrition_logs')
      .insert({
        user_id: userId,
        food_serving_id: servingId,
        meal_type: p_meal_type,
        quantity_consumed: p_quantity_consumed,
        log_date: logDate,
        calories: foodServing.calories ?? 0,
        protein_g: foodServing.protein_g ?? 0,
        carbs_g: foodServing.carbs_g ?? 0,
        fat_g: foodServing.fat_g ?? 0,
      })
      .select()
      .single();

    if (logError) {
      throw logError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        log_id: logEntry.id,
        quality_score: qualityScore,
        warning: warning,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in log-food-item:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

/**
 * Validate nutrition data against realistic ranges
 * 
 * @param {Object} nutritionData - Nutrition data to validate
 * @returns {Object} Validation result with errors and warnings
 */
function validateNutritionData(nutritionData: any) {
  const limits = {
    calories: { min: 0, max: 2000 },
    protein_g: { min: 0, max: 100 },
    carbs_g: { min: 0, max: 200 },
    fat_g: { min: 0, max: 100 },
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check ranges
  for (const [nutrient, limit] of Object.entries(limits)) {
    const value = nutritionData[nutrient];
    if (value !== null && value !== undefined) {
      if (value < limit.min || value > limit.max) {
        errors.push(
          `${nutrient} (${value}) outside range (${limit.min}-${limit.max})`
        );
      }
    }
  }

  // Calorie consistency (4-4-9 rule)
  const estimatedCalories =
    (nutritionData.carbs_g || 0) * 4 +
    (nutritionData.protein_g || 0) * 4 +
    (nutritionData.fat_g || 0) * 9;

  const actualCalories = nutritionData.calories || 0;
  const difference = Math.abs(estimatedCalories - actualCalories);

  if (actualCalories > 0 && difference > actualCalories * 0.3) {
    warnings.push(
      `Calorie inconsistency: ${actualCalories} vs ${Math.round(estimatedCalories)} estimated`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
