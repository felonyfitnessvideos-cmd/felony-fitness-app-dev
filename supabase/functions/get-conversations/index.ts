/**
 * @file supabase/functions/get-conversations/index.ts
 * @description Edge Function to retrieve all conversations for the current user.
 * 
 * This function provides a unified view of all messaging conversations for a user,
 * including metadata about the last message, unread counts, and participant information.
 * It queries the direct_messages table and aggregates conversation data with proper
 * filtering and ordering.
 * 
 * @project Felony Fitness
 * @author Felony Fitness Development Team
 * @version 1.0.0
 * @since 2025-11-05
 * 
 * @workflow
 * 1. Validates user authentication via Authorization header
 * 2. Queries direct_messages table for user's conversations
 * 3. Aggregates messages by conversation partner
 * 4. Calculates unread counts and last message timestamps
 * 5. Joins with user_profiles for participant names
 * 6. Returns sorted list of conversations (most recent first)
 * 
 * @security
 * - Requires valid JWT token in Authorization header
 * - Uses RLS policies to ensure user can only access their own conversations
 * - Validates authenticated user before querying
 * - Returns only conversations where user is sender or recipient
 * 
 * @returns {Response} JSON response with array of conversations or error
 * @returns {Object} response.body - Response body
 * @returns {Array<Object>} response.body.conversations - Array of conversation objects
 * @returns {string} response.body.conversations[].user_id - ID of the other user
 * @returns {string} response.body.conversations[].user_full_name - Full name of other user
 * @returns {string} response.body.conversations[].user_email - Email of other user
 * @returns {string} response.body.conversations[].last_message_content - Content of last message
 * @returns {string} response.body.conversations[].last_message_at - ISO timestamp of last message
 * @returns {number} response.body.conversations[].unread_count - Number of unread messages
 * @returns {boolean} response.body.conversations[].is_last_message_from_me - True if last message was sent by current user
 * @returns {string} response.body.error - Error message if query failed
 * 
 * @example
 * // Request
 * POST /functions/v1/get-conversations
 * Headers: { Authorization: "Bearer <jwt_token>" }
 * Body: {}
 * 
 * // Success Response (200)
 * {
 *   conversations: [
 *     {
 *       user_id: "user-456",
 *       user_full_name: "John Smith",
 *       user_email: "john@example.com",
 *       last_message_content: "Thanks for the workout plan!",
 *       last_message_at: "2025-11-05T10:30:00Z",
 *       unread_count: 2,
 *       is_last_message_from_me: false
 *     }
 *   ]
 * }
 * 
 * // Error Response (401/500)
 * { error: "Authentication failed" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

/**
 * CORS headers for cross-origin requests
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Main Edge Function handler for retrieving conversations
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's authentication context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query all messages where user is sender or recipient
    const { data: messages, error: messagesError } = await supabase
      .from("direct_messages")
      .select(`
        id,
        sender_id,
        recipient_id,
        content,
        created_at,
        read_at
      `)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (messagesError) {
      throw messagesError;
    }

    // Get unique user IDs from messages
    const userIds = new Set<string>();
    for (const message of messages || []) {
      userIds.add(message.sender_id);
      userIds.add(message.recipient_id);
    }

    // Fetch user profiles separately
    const { data: userProfiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", Array.from(userIds));

    if (profilesError) {
      console.error("Error fetching user profiles:", profilesError);
    }

    // Create a map of user profiles for quick lookup
    const profileMap: Record<string, any> = {};
    for (const profile of userProfiles || []) {
      profileMap[profile.user_id] = profile;
    }

    // Group messages by conversation partner
    const conversationsMap: Record<string, any> = {};

    for (const message of messages || []) {
      // Determine the other user in the conversation
      const otherUserId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
      const otherUser = message.sender_id === user.id ? message.recipient : message.sender;

      if (!conversationsMap[otherUserId]) {
        // Initialize conversation
        conversationsMap[otherUserId] = {
          user_id: otherUserId,
          user_full_name: `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || otherUser?.email || 'Unknown User',
          user_email: otherUser?.email || '',
          last_message_content: message.content,
          last_message_at: message.created_at,
          unread_count: 0,
          is_last_message_from_me: message.sender_id === user.id
        };
      }

      // Count unread messages (messages sent TO current user that haven't been read)
      if (message.recipient_id === user.id && !message.read_at) {
        conversationsMap[otherUserId].unread_count++;
      }
    }

    // Convert map to array and sort by last message time
    const conversations = Object.values(conversationsMap).sort((a: any, b: any) => {
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    // Return the conversations array
    return new Response(
      JSON.stringify({ conversations }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // Catch-all error handler
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
