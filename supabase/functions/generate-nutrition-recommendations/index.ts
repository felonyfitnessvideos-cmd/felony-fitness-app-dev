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
        // CRITICAL: Need quantity_consumed from nutrition_logs (how many servings eaten)
        // food_serving_id to join food details separately (avoiding RLS issues)
        .select('id, food_serving_id, quantity_consumed')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString()),
      supabase
        .from('workout_logs')
        .select('notes, duration_minutes')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString()),
    ]);

    if (profileRes.error) throw new Error('Profile query failed: ' + (profileRes.error.message ?? 'unknown'));
    if (metricsRes.error) throw new Error('Metrics query failed: ' + (metricsRes.error.message ?? 'unknown'));
    // Defensive: if a previous deployment used a nested select that caused
    // a PostgREST error about non-existent expanded columns, re-run a
    // simpler query selecting the raw `food_servings` column. This helps
    // during staged schema rollouts or client/server mismatches.
    if (nutritionRes.error) {
      const msg = String(nutritionRes.error.message || '').toLowerCase();
      // If the error mentions food_servings or nested expansion failures,
      // avoid attempting to select a non-existent `food_servings` column on
      // `nutrition_logs`. Instead, try to retrieve the lightweight
      // references (id, food_servings_id). If that also fails, continue so
      // downstream fallbacks will query the `food_servings` table by
      // user/date window.
      if (msg.includes('food_servings') || msg.includes('food_servings_1') || msg.includes('quantity_consumed')) {
        console.warn('Nutrition logs nested select failed; retrying with id, food_serving_id, quantity_consumed select');
        const fallback = await supabase
          .from('nutrition_logs')
          .select('id, food_serving_id, quantity_consumed')
          .eq('user_id', userId)
          .gte('created_at', sevenDaysAgo.toISOString());

        if (fallback.error) {
          // If even the simple select fails, log and set empty data so the
          // downstream logic will attempt the broad food_servings fallback.
          console.warn('Fallback nutrition_logs id select failed:', String(fallback.error.message || fallback.error));
          (nutritionRes as any).data = [];
        } else {
          (nutritionRes as any).data = fallback.data;
        }
      } else {
        throw new Error('Nutrition query failed: ' + (nutritionRes.error.message ?? 'unknown'));
      }
    }
    if (workoutRes.error) throw new Error('Workout query failed: ' + (workoutRes.error.message ?? 'unknown'));

    if (!profileRes.data) {
      throw new Error('User profile not found. Cannot generate recommendations without goals.');
    }

    const userProfile = profileRes.data as UserProfile;
    const latestMetrics = metricsRes.data as BodyMetrics | undefined;

    // Build category counts. Support two storage patterns:
    // 1) `nutrition_logs` contains a `food_servings` JSON array on the row.
    // 2) `food_servings` is a separate table and `nutrition_logs` contains
    //    a `food_servings_id` reference. We detect the pattern and fetch
    //    servings accordingly.
    let categoryCounts: Record<string, number> = {};

    const rows = nutritionRes.data || [];
    if (rows.length === 0) {
      categoryCounts = {};
    } else if (Array.isArray(rows) && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], 'food_servings')) {
      // Pattern 1: inline food_servings JSON on each log row
      categoryCounts = (rows as any[]).reduce((acc: Record<string, number>, log: any) => {
        const servings = Array.isArray(log.food_servings) ? log.food_servings : [];
        for (const s of servings) {
          const category = s?.foods?.category ?? 'Uncategorized';
          const qty = Number.isFinite(s?.quantity_consumed) ? s.quantity_consumed : 1;
          acc[category] = (acc[category] ?? 0) + qty;
        }
        return acc;
      }, {} as Record<string, number>);
    } else {
      // Pattern 2: separate food_servings table referenced by food_serving_id
      // Build a map from nutrition_logs for quantity_consumed per food_serving_id
      const logsByServingId = new Map<any, { quantity_consumed: number, count: number }>();
      
      for (const log of rows) {
        const servingId = (log as any)?.food_serving_id;
        const qty = Number.isFinite((log as any)?.quantity_consumed) ? (log as any).quantity_consumed : 1;
        
        if (!servingId) continue;
        
        const existing = logsByServingId.get(servingId) || { quantity_consumed: 0, count: 0 };
        existing.quantity_consumed += qty;
        existing.count += 1;
        logsByServingId.set(servingId, existing);
      }

      const idList = Array.from(logsByServingId.keys());
      if (idList.length > 0) {
        // Fetch referenced food_servings rows by id
        const fsRes = await supabase
          .from('food_servings')
          .select('id, food_name, category, brand')
          .in('id', idList as any[]);

        if (fsRes.error) {
          console.warn('Direct food_servings lookup by id failed:', String(fsRes.error.message || fsRes.error));
        } else if (fsRes.data && fsRes.data.length > 0) {
          // Now count categories using quantity_consumed from nutrition_logs
          categoryCounts = (fsRes.data || []).reduce((acc: Record<string, number>, serving: any) => {
            const servingId = serving.id;
            const logData = logsByServingId.get(servingId);
            
            if (!logData) return acc;
            
            // Use category from food_servings, fallback to food_name
            const category = serving?.category ?? serving?.food_name ?? 'Uncategorized';
            const totalQty = logData.quantity_consumed;
            
            acc[category] = (acc[category] ?? 0) + totalQty;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // If we still have no categoryCounts (schema variant), try a broad fallback:
      // query the food_servings table for entries in the last 7 days for this user.
      if (!Object.keys(categoryCounts).length) {
        try {
          const broad = await supabase
            .from('food_servings')
            .select('id, quantity_consumed, quantity, qty, foods(name, category), category, food_name, user_id, created_at')
            .eq('user_id', userId)
            .gte('created_at', sevenDaysAgo.toISOString());

          if (!broad.error && Array.isArray(broad.data) && broad.data.length > 0) {
            categoryCounts = (broad.data || []).reduce((acc: Record<string, number>, s: any) => {
              const category = s?.foods?.category ?? s?.category ?? s?.food?.category ?? s?.food_name ?? 'Uncategorized';
              const qty = Number.isFinite(s?.quantity_consumed) ? s.quantity_consumed : (Number.isFinite(s?.quantity) ? s.quantity : (Number.isFinite(s?.qty) ? s.qty : 1));
              acc[category] = (acc[category] ?? 0) + qty;
              return acc;
            }, {} as Record<string, number>);
          }
        } catch (broadErr) {
          console.warn('Broad food_servings fallback failed:', String(broadErr));
          // fall through to possibly empty categoryCounts
        }
      }
    }

    const nutritionSummary = Object.entries(categoryCounts)
      .map(([category, count]) => '- ' + category + ': ' + count + ' serving(s)')
      .join('\n');

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