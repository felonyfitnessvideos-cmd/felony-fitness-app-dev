/**
 * @file supabase/functions/exercise-search/index.ts
 * @description Edge Function to perform a hybrid search for exercises.
 *
 * @project Felony Fitness
 *
 * @workflow
 * 1. Receives a search query from the client application.
 * 2. First, it searches the local `exercises` table in the Supabase database
 *    for a case-insensitive match.
 * 3. If local results are found, it returns them immediately, flagged with `source: 'local'`.
 * 4. If no local results are found, it calls the OpenAI API with a structured prompt
 *    to generate comprehensive exercise details.
 * 5. The AI's response is parsed and sent back to the client, flagged with `source: 'external'`.
 *
 * This creates a "self-improving" database system. The client application is responsible
 * for saving any new exercises returned from the 'external' source back into the
 * database, so they can be found locally in future searches.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Retrieve the OpenAI API key from environment variables.
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

/**
 * The main server function that handles incoming search requests.
 * @param {Request} req - The incoming HTTP request object, expected to contain a JSON body with a 'query' property.
 * @returns {Response} A JSON response containing the search results or an error.
 */
Deno.serve(async (req) => {
  // Standard handling for CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
      console.log('Received request body:', body);
    } catch (jsonErr) {
      console.error('Error parsing JSON body:', jsonErr);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { query } = body || {};
    if (!query) {
      console.error('Missing query in request body:', body);
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create an admin client to interact with the database using the service role key.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- Step 1: Search the local database first for performance and cost-saving. ---
    console.log('Searching local database for:', query);
    const { data: localResults, error: localError } = await supabaseAdmin
      .from('exercises')
      .select('*')
      .ilike('name', `%${query}%`) // Case-insensitive search
      .limit(5);

    if (localError) {
      console.error('Supabase exercises query error:', localError);
      throw localError;
    }

    // If local results are found, return them immediately.
    if (localResults && localResults.length > 0) {
      console.log('Found local results:', localResults.length);
      return new Response(JSON.stringify({ results: localResults, source: 'local' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // --- Step 2: If no local results, proceed to the AI fallback. ---
    console.log('No local results found, calling OpenAI API...');

    // Construct a detailed, structured prompt for the OpenAI API.
    const prompt = `
      You are a fitness exercise database assistant. Provide comprehensive details for the exercise "${query}".
      
      For muscle groups, use standard anatomical muscle names (e.g., "Chest", "Upper Chest", "Biceps", "Triceps", "Quadriceps", "Hamstrings", "Glutes", "Back", "Lats", "Traps", "Shoulders", "Anterior Deltoid", "Lateral Deltoid", "Posterior Deltoid", "Abs", "Obliques", "Calves", "Forearms").
      
      Respond in valid JSON with a "results" array containing ONE object with these exact keys:
      {
        "results": [{
          "name": "Exercise Name (string)",
          "description": "Brief description of the exercise (string, 1-2 sentences)",
          "instructions": "Step-by-step instructions (string, numbered list)",
          "primary_muscle": "Primary muscle worked (string)",
          "secondary_muscle": "Optional secondary muscle (string or null)",
          "tertiary_muscle": "Optional tertiary muscle (string or null)",
          "equipment_needed": "Equipment required (string: 'Barbell', 'Dumbbell', 'Machine', 'Bodyweight', 'Cable', 'Kettlebell', 'Resistance Band', or 'None')",
          "difficulty_level": "Difficulty (string: 'Beginner', 'Intermediate', or 'Advanced')",
          "exercise_type": "Type (string: 'strength', 'cardio', 'flexibility', or 'balance') - MUST BE LOWERCASE"
        }]
      }
      
      Example: 
      {
        "results": [{
          "name": "Incline Dumbbell Press",
          "description": "A chest exercise performed on an inclined bench that targets the upper chest muscles.",
          "instructions": "1. Set an adjustable bench to a 30-45 degree incline.\\n2. Sit on the bench with a dumbbell in each hand, resting them on your thighs.\\n3. Lie back and position the dumbbells at chest level with palms facing forward.\\n4. Press the dumbbells upward until your arms are fully extended.\\n5. Lower the dumbbells slowly back to chest level.\\n6. Repeat for desired reps.",
          "primary_muscle": "Upper Chest",
          "secondary_muscle": "Anterior Deltoid",
          "tertiary_muscle": "Triceps",
          "equipment_needed": "Dumbbell",
          "difficulty_level": "Intermediate",
          "exercise_type": "strength"
        }]
      }
    `;

    // Make the request to the OpenAI Chat Completions endpoint.
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
        temperature: 0.1 // Lower temperature for more deterministic, predictable results.
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`AI API request failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('OpenAI response:', aiData);
    const externalResults = JSON.parse(aiData.choices[0].message.content);

    // Return the AI-generated results to the client.
    return new Response(JSON.stringify({ ...externalResults, source: 'external' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    // Generic error handler for any failures in the try block.
    console.error('Error in exercise-search function:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});