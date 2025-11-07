/**
 * @file supabase/functions/food-search/index.ts
 * @description Edge Function to perform a hybrid search for food items.
 *
 * @project Felony Fitness
 *
 * @workflow
 * 1. Receives a search query from the client application.
 * 2. It first performs a case-insensitive search on the local `foods` table in the database.
 * This local search is fast, free, and personalized to foods the user has logged before.
 * 3. If any matching foods are found locally, it returns them immediately, flagged with `source: 'local'`.
 * The result includes the food's details and all its associated serving sizes.
 * 4. If no local results are found, it calls the OpenAI API as a fallback.
 * 5. It constructs a prompt asking the AI for nutritional information for the query,
 * requesting up to three common serving sizes.
 * 6. The AI's JSON response is parsed and sent back to the client, flagged with `source: 'external'`.
 *
 * This function enables a "self-improving" database. The client app is responsible for
 * saving any new food selected from an 'external' source back into the database via the
 * `log_food_item` RPC function. This ensures that the next time the user searches for that
 * food, it will be found in the fast local search.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Retrieve the OpenAI API key from environment variables.
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

/**
 * The main server function that handles incoming food search requests.
 * @param {Request} req - The incoming HTTP request object, expected to contain a JSON body with a 'query' property.
 * @returns {Response} A JSON response containing the search results or an error.
 */
Deno.serve(async (req) => {
  // Standard handling for CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) {
      throw new Error("Search query is required.");
    }

    // Create an admin client to interact with the database using the service role key.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- Step 1: Search your local database first ---
    // CRITICAL FIX: Search food_servings directly by food_name (denormalized structure)
    // The food_servings table contains food_name as a string field, not a foreign key to foods table.
    // This matches the exercise-search pattern where exercises table has name field directly.
    const { data: localResults, error: localError } = await supabaseAdmin
      .from('food_servings')
      .select('*')
      .ilike('food_name', `%${query}%`)   // Case-insensitive search on food_name
      .limit(10);

    if (localError) {
      console.error('Database search error:', localError);
      throw localError;
    }

    // If we find good results locally, return them.
    if (localResults && localResults.length > 0) {
      console.log(`Found ${localResults.length} local results for "${query}"`);
      return new Response(JSON.stringify({ results: localResults, source: 'local' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // --- Step 2: If no local results, call OpenAI API as a fallback ---
    console.log(`No local results found for "${query}", calling OpenAI API...`);

    const prompt = `
      You are a nutrition database assistant. Provide detailed nutritional information for "${query}".
      
      Respond in valid JSON with a "results" array containing up to 3 common serving sizes:
      {
        "results": [{
          "food_name": "Food name (string)",
          "serving_description": "Serving size (e.g., '1 cup', '100g', '1 medium') (string)",
          "calories": number,
          "protein_g": number,
          "carbs_g": number,
          "fat_g": number,
          "fiber_g": number,
          "sugar_g": number,
          "sodium_mg": number
        }]
      }
      
      Example for "chicken breast":
      {
        "results": [
          {
            "food_name": "Chicken Breast",
            "serving_description": "4 oz (113g) cooked",
            "calories": 187,
            "protein_g": 35,
            "carbs_g": 0,
            "fat_g": 4,
            "fiber_g": 0,
            "sugar_g": 0,
            "sodium_mg": 84
          },
          {
            "food_name": "Chicken Breast",
            "serving_description": "1 cup diced (140g) cooked",
            "calories": 231,
            "protein_g": 43,
            "carbs_g": 0,
            "fat_g": 5,
            "fiber_g": 0,
            "sugar_g": 0,
            "sodium_mg": 104
          }
        ]
      }
    `;

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
        temperature: 0.1 // Very low temperature for factual, consistent nutrition data.
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`AI API request failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('OpenAI response received');
    const externalResults = JSON.parse(aiData.choices[0].message.content);

    // Return the AI-generated results to the client.
    return new Response(JSON.stringify({ ...externalResults, source: 'external' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    // Generic error handler for any failures in the try block.
    console.error('Error in food-search function:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});