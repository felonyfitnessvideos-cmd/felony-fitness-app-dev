/**
 * @file supabase/functions/generate-workout-recommendations/index.ts
 * @description Edge Function that generates personalized workout recommendations using OpenAI.
 * 
 * @project Felony Fitness
 * 
 * @workflow
 * 1. Authenticates user via Supabase auth token
 * 2. Fetches user profile (goals, activity level, nutrition targets)
 * 3. Fetches recent body metrics (weight, body fat %)
 * 4. Fetches workout history (last 7 days)
 * 5. Fetches nutrition logs and food servings (last 7 days)
 * 6. Calculates average daily nutrition intake
 * 7. Constructs detailed prompt for OpenAI with all context
 * 8. Returns AI-generated analysis and actionable recommendations
 * 
 * @critical_fixes
 * - 2025-11-06: Split nutrition_logs query to avoid RLS issues with nested JOINs
 * - 2025-11-06: Changed 'dob' to 'date_of_birth' to match database schema
 * - 2025-11-06: Added fitness_goal, activity_level, and all macro goals
 * - 2025-11-06: Fixed variable naming conflict (recentNutrition used twice)
 * 
 * @note This file runs on Deno inside Supabase Edge Functions and uses Deno globals.
 */
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

/**
 * Calculate user's age from date of birth.
 * 
 * @param {string|null} dob - Date of birth in ISO format (YYYY-MM-DD)
 * @returns {number|null} Age in years, or null if dob not provided
 * 
 * @example
 * calculateAge('1990-05-15') // Returns 34 (as of 2025)
 */
const calculateAge = (dob) => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// --- Main Function ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Function started."); // DEBUG

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const userId = user.id;
    console.log(`User ${userId} authenticated.`); // DEBUG

    // --- 1. Fetch all necessary user data ---
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log("Fetching data from database..."); // DEBUG

    /**
     * CRITICAL FIX (2025-11-06): Split nutrition_logs query into two steps.
     * Nested JOIN query food_servings(calories, protein_g) was causing 400 Bad Request
     * due to RLS policies or relationship access issues in Edge Function context.
     * 
     * Solution: Fetch nutrition_logs with food_serving_id, then fetch food_servings
     * separately and join data in memory. Same pattern used in WorkoutLogPage fix.
     * 
     * Enhanced (2025-11-06): Added fitness_goal, activity_level, and all nutrition goals
     * from user_profiles to provide comprehensive context to AI recommendations.
     * 
     * COLUMN FIX: Changed 'dob' to 'date_of_birth' to match actual database schema.
     */
    const [profileRes, metricsRes, workoutRes, nutritionRes] = await Promise.all([
      supabase.from('user_profiles').select('date_of_birth, sex, fitness_goal, activity_level, daily_calorie_goal, daily_protein_goal, daily_carb_goal, daily_fat_goal').eq('id', userId).single(),
      supabase.from('body_metrics').select('weight_lbs, body_fat_percentage').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('workout_logs').select('notes, duration_minutes, created_at').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString()).gt('duration_minutes', 0),
      supabase.from('nutrition_logs').select('quantity_consumed, food_serving_id, created_at').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString())
    ]);
    console.log("Database queries complete."); // DEBUG

    if (profileRes.error) throw new Error(`Profile query failed: ${profileRes.error.message}`);
    if (metricsRes.error) throw new Error(`Metrics query failed: ${metricsRes.error.message}`);
    if (workoutRes.error) throw new Error(`Workout query failed: ${workoutRes.error.message}`);
    if (nutritionRes.error) throw new Error(`Nutrition query failed: ${nutritionRes.error.message}`);
    console.log("All database queries successful."); // DEBUG

    // Fetch food_servings data separately for nutrition logs
    const nutritionLogsRaw = nutritionRes.data || [];
    const foodServingIds = [...new Set(nutritionLogsRaw.map(log => log.food_serving_id).filter(Boolean))];
    let foodServingsMap = {};

    if (foodServingIds.length > 0) {
      const { data: foodServingsData, error: foodServingsError } = await supabase
        .from('food_servings')
        .select('id, calories, protein_g, carbs_g, fat_g')
        .in('id', foodServingIds);

      if (!foodServingsError && foodServingsData) {
        foodServingsMap = Object.fromEntries(foodServingsData.map(fs => [fs.id, fs]));
        console.log(`Fetched ${foodServingsData.length} food servings.`); // DEBUG
      } else {
        console.warn('Food servings query failed:', foodServingsError?.message);
      }
    }

    // Join food_servings data into nutrition logs
    const nutritionLogsWithServings = nutritionLogsRaw.map(log => ({
      ...log,
      food_servings: log.food_serving_id ? foodServingsMap[log.food_serving_id] : null
    }));

    if (!profileRes.data) {
      throw new Error("User profile not found. Cannot generate recommendations without goals.");
    }

    /**
     * Process and summarize fetched data for AI prompt.
     * 
     * Data processing includes:
     * - Joining food_servings data with nutrition_logs in memory (avoids RLS issues)
     * - Calculating 7-day averages for all macros (calories, protein, carbs, fats)
     * - Formatting fitness goal and activity level for readability
     * - Aggregating workout history
     * 
     * @note Variable naming: nutritionLogsWithServings (joined data) vs nutritionLogsRaw (raw data)
     * This prevents the variable conflict that caused the original 400 error.
     */
    console.log("Processing data and constructing prompt..."); // DEBUG
    const userProfile = profileRes.data;
    const latestMetrics = metricsRes.data;
    const recentWorkouts = workoutRes.data || [];

    // Calculate nutrition averages from logs with servings
    const foodLogs = nutritionLogsWithServings.filter((log) => log.food_servings);
    const totalDays = 7;
    const avgCalories = foodLogs.reduce((sum, log) => sum + (log.food_servings?.calories || 0) * log.quantity_consumed, 0) / totalDays;
    const avgProtein = foodLogs.reduce((sum, log) => sum + (log.food_servings?.protein_g || 0) * log.quantity_consumed, 0) / totalDays;
    const avgCarbs = foodLogs.reduce((sum, log) => sum + (log.food_servings?.carbs_g || 0) * log.quantity_consumed, 0) / totalDays;
    const avgFats = foodLogs.reduce((sum, log) => sum + (log.food_servings?.fat_g || 0) * log.quantity_consumed, 0) / totalDays;

    /**
     * Format fitness goal from snake_case to Title Case.
     * @param {string|null} goal - Goal from database (e.g., 'build_muscle')
     * @returns {string} Formatted goal (e.g., 'Build Muscle')
     */
    const formatGoal = (goal) => {
      if (!goal) return 'Not set';
      return goal.replace(/_/g, ' ').split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    };

    /**
     * Format activity level from snake_case to Title Case.
     * @param {string|null} level - Activity level from database (e.g., 'very_active')
     * @returns {string} Formatted level (e.g., 'Very Active')
     */
    const formatActivityLevel = (level) => {
      if (!level) return 'Not set';
      return level.replace(/_/g, ' ').split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    };

    const summary = {
      profile: `Age: ${calculateAge(userProfile.date_of_birth)}, Sex: ${userProfile.sex}, Weight: ${latestMetrics?.weight_lbs || 'N/A'} lbs, Body Fat: ${latestMetrics?.body_fat_percentage || 'N/A'}%`,
      fitnessGoal: `Fitness Goal: ${formatGoal(userProfile.fitness_goal)}, Activity Level: ${formatActivityLevel(userProfile.activity_level)}`,
      nutritionGoals: `Daily Goals - Calories: ${userProfile.daily_calorie_goal || 'Not set'}, Protein: ${userProfile.daily_protein_goal || 'Not set'}g, Carbs: ${userProfile.daily_carb_goal || 'Not set'}g, Fats: ${userProfile.daily_fat_goal || 'Not set'}g`,
      avgIntake: `Avg Daily Intake (last 7 days): ${Math.round(avgCalories)} calories, ${Math.round(avgProtein)}g protein, ${Math.round(avgCarbs)}g carbs, ${Math.round(avgFats)}g fats`,
      workouts: `Completed ${recentWorkouts.length} workouts in the last 7 days.`,
      workoutList: recentWorkouts.map((w) => `- ${w.notes || 'Unnamed Workout'} (${w.duration_minutes} mins)`).join('\n') || 'No workouts logged.'
    };

    const prompt = `
      You are a fitness and nutrition expert for the app "Felony Fitness".
      Analyze the following user data and provide 3-4 actionable workout-related recommendations.
      The user is justice-impacted, so adopt a supportive, empowering, and straightforward tone.
      
      User Data:
      - Profile Metrics: ${summary.profile}
      - Fitness Goals: ${summary.fitnessGoal}
      - Nutrition Goals: ${summary.nutritionGoals}
      - 7-Day Average Nutrition Intake: ${summary.avgIntake}
      - 7-Day Workout Summary: ${summary.workouts}
      - Recent Workouts:
      ${summary.workoutList}
      
      Based on this data, provide an overall analysis summary and a list of specific recommendations focused on their training.
      Consider:
      - How their current workout frequency aligns with their fitness goal (${userProfile.fitness_goal || 'not set'})
      - Whether their activity level (${userProfile.activity_level || 'not set'}) matches their stated goals
      - If their nutrition intake supports their workout performance and fitness goal
      - Progressive overload, recovery, and consistency patterns
      
      Your response must be in valid JSON format, like this example:
      {
        "analysis_summary": "A brief, one-paragraph summary of their current training progress, nutrition adherence, and alignment with their stated fitness goal.",
        "recommendations": [
          {
            "title": "Workout Recommendation Title 1",
            "reason": "Explain why this recommendation is being made based on their data (e.g., 'Your goal is to build muscle, but your workout frequency is only 2x/week, which may limit hypertrophy.').",
            "action": "Provide a clear, simple, actionable step related to their workouts (e.g., 'Increase training frequency to 4x/week with an upper/lower split.')."
          }
        ]
      }
    `;
    console.log("Prompt constructed."); // DEBUG

    // --- 4. Call the OpenAI API ---
    console.log("Calling OpenAI API..."); // DEBUG
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7
      })
    });
    console.log("OpenAI response received."); // DEBUG

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API error response:", errorText); // DEBUG
      throw new Error(`AI API request failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log("Parsing AI JSON response..."); // DEBUG
    const recommendations = JSON.parse(aiData.choices[0].message.content);

    // --- 5. Return the final recommendations to the client. ---
    console.log("Success. Returning recommendations."); // DEBUG
    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err) {
    console.error("Error caught in function's main try block:", err.message); // DEBUG
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});