/**
 * @file supabase/functions/generate-nutrition-recommendations/index.ts
 * @description Edge Function that generates personalized nutrition recommendations using OpenAI.
 * 
 * @project Felony Fitness
 * 
 * @workflow
 * 1. Authenticates user via Supabase auth token (Authorization header)
 * 2. Fetches user profile (goals, dietary preferences, activity level)
 * 3. Fetches recent body metrics (weight, body fat %)
 * 4. Fetches nutrition logs and resolves food servings (last 7 days)
 * 5. Fetches workout history for context (last 7 days)
 * 6. Aggregates food consumption by category
 * 7. Constructs detailed prompt for OpenAI with nutrition focus
 * 8. Returns AI-generated analysis and actionable nutrition recommendations
 * 
 * @critical_fixes
 * - 2025-11-06: Changed 'dob' to 'date_of_birth' to match database schema
 * - 2025-11-06: Added fitness_goal, activity_level, daily_carb_goal, daily_fat_goal
 * - 2025-11-06: Enhanced TypeScript interfaces for new fields
 * 
 * @note This file runs on Deno inside Supabase Edge Functions and uses Deno globals.
 * @note Nutrition logs query avoids nested JOINs to prevent RLS issues.
 */

// Minimal local type shims so TypeScript can check this Deno-run file.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-expect-error: CDN ESM import used in Deno runtime; local types are not available.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const OPENAI_API_KEY: string | undefined = Deno.env.get('OPENAI_API_KEY');

// --- Types used in this function ---
/**
 * User profile data from user_profiles table.
 * @property {string} date_of_birth - User's date of birth in ISO format (YYYY-MM-DD)
 * @property {string} sex - User's biological sex
 * @property {number} daily_calorie_goal - Target daily calories
 * @property {number} daily_protein_goal - Target daily protein in grams
 * @property {number} daily_carb_goal - Target daily carbohydrates in grams
 * @property {number} daily_fat_goal - Target daily fats in grams
 * @property {string} diet_preference - Dietary restrictions (vegetarian, vegan, etc.)
 * @property {string} fitness_goal - User's fitness objective (build_muscle, lose_weight, etc.)
 * @property {string} activity_level - User's activity level (sedentary, very_active, etc.)
 */
interface UserProfile {
  date_of_birth?: string | null;
  sex?: string | null;
  daily_calorie_goal?: number | null;
  daily_protein_goal?: number | null;
  daily_carb_goal?: number | null;
  daily_fat_goal?: number | null;
  diet_preference?: string | null;
  fitness_goal?: string | null;
  activity_level?: string | null;
}

interface BodyMetrics {
  weight_lbs?: number | null;
  body_fat_percentage?: number | null;
}

interface Food {
  name?: string | null;
  category?: string | null;
}

interface FoodServing {
  quantity_consumed?: number | null;
  foods?: Food | null;
}

interface NutritionLogEntry {
  food_servings?: FoodServing[] | null;
}

/**
 * Calculate user's age from date of birth.
 * 
 * @param {string|null|undefined} dob - Date of birth in ISO format (YYYY-MM-DD)
 * @returns {number|null} Age in years, or null if dob not provided
 * 
 * @example
 * calculateAge('1990-05-15') // Returns 35 (as of 2025)
 */
const calculateAge = (dob: string | null | undefined) => {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
      });
    }

    const rawAuth = req.headers.get('Authorization') || '';
    const match = rawAuth.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      console.warn('generate-nutrition-recommendations: invalid or missing Authorization header');
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="supabase", error="invalid_token"',
        },
        status: 401,
      });
    }

    const accessToken = match[1];
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Fail fast if environment is misconfigured to avoid obscure runtime failures
    const missingEnv: string[] = [];
    if (!supabaseUrl) missingEnv.push('SUPABASE_URL');
    if (!supabaseAnonKey) missingEnv.push('SUPABASE_ANON_KEY');
    if (missingEnv.length) {
      console.error('Missing environment variables for function:', missingEnv.join(', '));
      return new Response(JSON.stringify({ error: 'Service configuration error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Pass a normalized Authorization header with the extracted token only
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: 'Bearer ' + accessToken } },
    });

    const maskedPrefix = accessToken.slice(0, 12) + '...';

    // Supabase client library types are not available here; cast to any for typed destructuring.
    const { data: { user } = {}, error: authError }: { data?: { user?: any }, error?: any } = await (supabase as any).auth.getUser();
    if (authError || !user) {
      console.error(JSON.stringify({
        event: 'auth.resolve_user',
        auth_error_message: authError?.message ?? null,
        auth_header_prefix: maskedPrefix,
      }));

      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userId = user.id;

    // Fetch the last 7 days of relevant data in parallel
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    /**
     * Fetch user data from multiple tables in parallel.
     * 
     * COLUMN FIX (2025-11-06): Changed 'dob' to 'date_of_birth' to match actual database schema.
     * This was causing 400 errors identical to the workout recommendations function issue.
     * 
     * Query structure:
     * - user_profiles: Basic demographics, goals, and dietary preferences
     * - body_metrics: Most recent weight and body composition
     * - nutrition_logs: Food consumption history (last 7 days)
     * - workout_logs: Exercise activity (last 7 days)
     * 
     * @note nutrition_logs query is intentionally simple to avoid RLS issues with nested JOINs.
     * Food servings data is fetched separately and joined in memory.
     */
    const [profileRes, metricsRes, nutritionRes, workoutRes] = await Promise.all([
      supabase
        .from('user_profiles')
        // Include diet_preference when available so recommendations can respect
        // vegetarian/vegan preferences. If the column is not present in the DB
        // the query will surface an error which the function will report.
        .select('date_of_birth, sex, daily_calorie_goal, daily_protein_goal, diet_preference, fitness_goal, activity_level, daily_carb_goal, daily_fat_goal')
        .eq('id', userId)
        .single(),
      supabase
        .from('body_metrics')
        .select('weight_lbs, body_fat_percentage')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('nutrition_logs')
        // Simplified query: macros are now stored directly in nutrition_logs
        // Select quantity_consumed and denormalized macro columns
        .select('quantity_consumed, calories, protein_g, carbs_g, fat_g, food_serving_id')
        .eq('user_id', userId)
        .gte('log_date', sevenDaysAgo.toISOString().split('T')[0])
        .not('food_serving_id', 'is', null), // Exclude water entries
      supabase
        .from('workout_logs')
        .select('notes, duration_minutes')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString()),
    ]);

    if (profileRes.error) throw new Error('Profile query failed: ' + (profileRes.error.message ?? 'unknown'));
    if (metricsRes.error) throw new Error('Metrics query failed: ' + (metricsRes.error.message ?? 'unknown'));
    if (nutritionRes.error) throw new Error('Nutrition query failed: ' + (nutritionRes.error.message ?? 'unknown'));
    if (workoutRes.error) throw new Error('Workout query failed: ' + (workoutRes.error.message ?? 'unknown'));

    if (!profileRes.data) {
      throw new Error('User profile not found. Cannot generate recommendations without goals.');
    }

    const userProfile = profileRes.data as UserProfile;
    const latestMetrics = metricsRes.data as BodyMetrics | undefined;

    // Calculate macro totals directly from nutrition_logs (no joins needed!)
    const rows = nutritionRes.data || [];
    const macroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    for (const log of rows) {
      const qty = Number.isFinite((log as any)?.quantity_consumed) ? (log as any).quantity_consumed : 1;
      macroTotals.calories += ((log as any)?.calories || 0) * qty;
      macroTotals.protein += ((log as any)?.protein_g || 0) * qty;
      macroTotals.carbs += ((log as any)?.carbs_g || 0) * qty;
      macroTotals.fat += ((log as any)?.fat_g || 0) * qty;
    }
    
    // For backward compatibility, also fetch food_serving details for category counts
    // This is optional and can be removed if categories aren't needed
    let categoryCounts: Record<string, number> = {};
    
    if (rows.length > 0) {
      const servingIds = rows.map((r: any) => r.food_serving_id).filter(Boolean);
      
      if (servingIds.length > 0) {
        const { data: servings } = await supabase
          .from('food_servings')
          .select('id, category, food_name')
          .in('id', servingIds);
        
        if (servings) {
          const categoryMap = new Map(servings.map((s: any) => [s.id, s.category || s.food_name || 'Uncategorized']));
          
          for (const log of rows) {
            const servingId = (log as any)?.food_serving_id;
            const qty = Number.isFinite((log as any)?.quantity_consumed) ? (log as any).quantity_consumed : 1;
            const category = categoryMap.get(servingId) || 'Uncategorized';
            categoryCounts[category] = (categoryCounts[category] || 0) + qty;
          }
        }
      }
    }

    const nutritionSummary = Object.entries(categoryCounts)
      .map(([category, count]) => '- ' + category + ': ' + count + ' serving(s)')
      .join('\n');
    
    // Use the calculated macro totals
    const macroSummary = macroTotals.calories > 0
      ? `7-Day Macro Totals:\n- Calories: ${Math.round(macroTotals.calories)}\n- Protein: ${Math.round(macroTotals.protein)}g\n- Carbs: ${Math.round(macroTotals.carbs)}g\n- Fat: ${Math.round(macroTotals.fat)}g`
      : '';

    const workoutsList = (workoutRes.data || [])
      .map((log: any) => {
        const notes = log?.notes || 'Workout';
        // Use nullish coalescing so 0 is preserved but null/undefined become 'unknown'
        const duration = log?.duration_minutes ?? 'unknown';
        return `- ${notes} for ${duration} minutes`;
      })
      .join('\n') || 'No workouts logged.';

    const prompt = [
      'You are an expert fitness and nutrition coach for Felony Fitness, an organization helping formerly incarcerated individuals.',
      'Your tone should be encouraging, straightforward, and supportive.',
      'Analyze the following user data from the last 7 days and provide 3 actionable nutrition-related recommendations.',
      'IMPORTANT: Compare the 7-Day Macro Totals against the User Goals (daily goals × 7 days). Identify any significant deficiencies or excesses.',
      'User Profile:',
      '- Age: ' + (calculateAge(userProfile.date_of_birth)),
      '- Sex: ' + (userProfile.sex ?? 'Unknown'),
      '- Weight: ' + (latestMetrics?.weight_lbs || 'N/A') + ' lbs',
      '- Body Fat: ' + (latestMetrics?.body_fat_percentage || 'N/A') + '%',
      '- Fitness Goal: ' + (userProfile.fitness_goal ?? 'Not set'),
      '- Activity Level: ' + (userProfile.activity_level ?? 'Not set'),
      'User Goals:',
      '- Calories: ' + (userProfile.daily_calorie_goal ?? 'N/A'),
      '- Protein: ' + (userProfile.daily_protein_goal ?? 'N/A') + 'g',
      '- Carbs: ' + (userProfile.daily_carb_goal ?? 'N/A') + 'g',
      '- Fats: ' + (userProfile.daily_fat_goal ?? 'N/A') + 'g',
      '- Diet: ' + (userProfile.diet_preference ?? 'None'),
      macroSummary || '',
      '7-Day Nutrition Summary (by category):',
      (nutritionSummary || 'No nutrition logged.'),
      'Recent Workouts:',
      workoutsList,
      'Based on this data, provide a response in valid JSON format, focused on nutrition. The response must be a JSON object with two keys: "analysis_summary" and "recommendations".',
      'Here is the required JSON structure:',
      '{',
      '  "analysis_summary": "A brief, one-sentence summary of their recent activity and diet.",',
      '  "recommendations": [',
      '    {',
      '      "title": "Nutrition Recommendation Title 1",',
      '      "reason": "Explain WHY this recommendation is important based on their specific data (e.g., their food category summary).",',
      '      "action": "Provide a simple, concrete action they can take related to their diet."',
      '    }',
      '  ]',
      '}',
    ].join('\n');

    // Temporary debug response: if caller includes ?debug=1 or header x-debug: true
    // return a safe, non-sensitive snapshot of computed inputs (no secrets).
    try {
      const url = new URL(req.url);
      const debugQuery = url.searchParams.get('debug') === '1';
      const debugHeader = (req.headers.get('x-debug') || '').toLowerCase() === 'true';
      const debugMode = debugQuery || debugHeader;
      if (debugMode) {
        // Build a small, safe debug payload (avoid PII like full DOB or tokens).
        const safeProfile = {
          daily_calorie_goal: userProfile.daily_calorie_goal ?? null,
          daily_protein_goal: userProfile.daily_protein_goal ?? null,
          diet_preference: userProfile.diet_preference ?? null,
        };

        const debugPayload = {
          debug: true,
          user_id: userId,
          profile: safeProfile,
          nutrition_summary_preview: nutritionSummary.slice(0, 2000),
          recent_workouts_preview: workoutsList.slice(0, 2000),
          prompt_preview: prompt.slice(0, 2000),
        };

        return new Response(JSON.stringify(debugPayload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    } catch (dbgErr) {
      // If debug path check fails for any reason, continue to normal flow.
      // Use String(...) to avoid relying on dbgErr having a `message` property.
      console.warn('Debug path check failed:', String(dbgErr));
    }

    // Call OpenAI. Be defensive: capture status and body to help debug
    // transient upstream issues. Do NOT log API keys or full responses.
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      // Include some diagnostic context in logs and return a 502 to the client.
      const errorText = await aiResponse.text();
      const truncated = (errorText || '').slice(0, 2000);
      console.error('OpenAI API error', { status: aiResponse.status, bodyPreviewLength: truncated.length });
      console.error('OpenAI API body preview:', truncated);
      return new Response(JSON.stringify({ error: 'Upstream AI service error', detail: `OpenAI status ${aiResponse.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      });
    }

    const aiData = await aiResponse.json().catch((e) => {
      console.error('OpenAI JSON parse error:', e?.message ?? e);
      return null;
    });
    const aiText = aiData?.choices?.[0]?.message?.content;
    if (!aiText) {
      console.error('OpenAI returned missing content; choice count:', (aiData?.choices || []).length);
      return new Response(JSON.stringify({ error: 'AI returned unexpected response' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      });
    }

    let recommendations;
    try {
      recommendations = JSON.parse(aiText);
    } catch (e) {
      // Log a preview of the AI text to help debugging, but avoid logging secrets.
      const preview = (aiText || '').slice(0, 2000);
      console.error('Failed to parse AI JSON; preview length:', preview.length);
      console.error('AI text preview:', preview);
      return new Response(JSON.stringify({ error: 'AI returned unparsable JSON' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      });
    }

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    // Log the full error server-side (including stack) for operators.
    console.error('Function error:', err?.stack ?? err?.message ?? String(err));

    // Map well-known error messages to appropriate HTTP statuses.
    const msg = String(err?.message || 'Internal error').toLowerCase();
    let status = 500;
    let clientMessage = 'Internal server error';

    if (msg.includes('profile query failed') || msg.includes('user profile not found') || msg.includes('invalid')) {
      status = 400;
      clientMessage = 'Invalid request';
    } else if (msg.includes('ai api request failed') || msg.includes('ai returned')) {
      status = 502;
      clientMessage = 'Upstream service unavailable';
    } else if (msg.includes('service configuration error')) {
      status = 500;
      clientMessage = 'Service configuration error';
    }

    return new Response(JSON.stringify({ error: clientMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});