/**
 * @fileoverview Messaging Utilities with Smart Response Tracking
 * @description Comprehensive utilities for handling direct messaging functionality
 * with intelligent "turn-based" notification system using needs_response column
 * 
 * @author Felony Fitness Development Team
 * @version 2.0.0
 * @since 2025-11-08
 * 
 * @module messagingUtils
 * 
 * ARCHITECTURE OVERVIEW:
 * =====================
 * This module implements a "tennis ball" messaging system where the badge shows
 * whose turn it is to respond. Key features:
 * 
 * 1. SMART RESPONSE TRACKING
 *    - needs_response boolean column in direct_messages table
 *    - When you send a message, ALL previous messages in that conversation
 *      are marked needs_response = false
 *    - Your new message is marked needs_response = true (recipient's turn)
 *    - Badge shows count of messages where YOU are recipient and needs_response = true
 * 
 * 2. REAL-TIME SUBSCRIPTIONS
 *    - Listens for INSERT events (new messages received)
 *    - Listens for UPDATE events (needs_response changes)
 *    - Automatically triggers callback to refresh badge counts
 * 
 * 3. MESSAGE FLOW
 *    Client → Trainer:
 *      - Message inserted with needs_response = true
 *      - Trainer sees badge
 *      - Trainer responds
 *      - All previous client messages marked needs_response = false
 *      - Client sees badge
 * 
 * 4. DATABASE SCHEMA
 *    direct_messages table:
 *      - sender_id: UUID (FK to user_profiles)
 *      - recipient_id: UUID (FK to user_profiles)
 *      - content: TEXT
 *      - needs_response: BOOLEAN DEFAULT true
 *      - created_at: TIMESTAMP
 *      - read_at: TIMESTAMP (nullable)
 * 
 * USAGE EXAMPLES:
 * ===============
 * 
 * // Get unread count for badge
 * const count = await getUnreadMessageCount();
 * 
 * // Send a message (auto-clears previous needs_response)
 * await sendMessage(recipientId, "Hello!");
 * 
 * // Subscribe to real-time updates
 * const subscription = await subscribeToMessages(() => {
 *   // Reload badge count
 * });
 * 
 * // Clean up
 * subscription.unsubscribe();
 * 
 * @requires @supabase/supabase-js
 * @see {@link https://supabase.com/docs/guides/realtime|Supabase Realtime}
 */

import { supabase } from '../supabaseClient';

// =====================================================================================
// TYPES AND INTERFACES
// =====================================================================================

/**
 * @typedef {Object} Conversation
 * @property {string} user_id - The ID of the other user in the conversation
 * @property {string} user_full_name - Full name of the other user
 * @property {string} user_email - Email of the other user
 * @property {string} last_message_content - Content of the most recent message
 * @property {string} last_message_at - Timestamp of the most recent message
 * @property {number} unread_count - Number of messages where current user is recipient and needs_response = true
 * @property {boolean} is_last_message_from_me - Whether the last message was sent by current user
 */

/**
 * @typedef {Object} Message
 * @property {string} id - Unique message identifier (UUID)
 * @property {string} sender_id - ID of the message sender (UUID, FK to user_profiles)
 * @property {string} recipient_id - ID of the message recipient (UUID, FK to user_profiles)
 * @property {string} content - Message content (plain text, max 5000 characters)
 * @property {string} created_at - Message creation timestamp (ISO 8601)
 * @property {string|null} read_at - Message read timestamp (ISO 8601, null if unread)
 * @property {boolean} needs_response - Whether recipient needs to respond (turn-based tracking)
 * @property {string} sender_name - Full name of the message sender (for avatar display)
 * @property {boolean} is_from_current_user - Whether the message was sent by current user
 */

/**
 * @typedef {Object} SendMessageRequest
 * @property {string} recipient_id - ID of the message recipient (UUID)
 * @property {string} content - Message content to send (trimmed, 1-5000 characters)
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {string} message - Success or error message
 * @property {any} [data] - Optional response data
 * @property {string} [error] - Optional error details
 */

// =====================================================================================
// CONVERSATION MANAGEMENT
// =====================================================================================

/**
 * Fetch all conversations for the current user
 * 
 * Retrieves a list of all conversations where the current user has exchanged messages,
 * including conversation metadata, last message info, and unread counts.
 * 
 * @async
 * @returns {Promise<Conversation[]>} Array of conversation objects
 * @throws {Error} When database query fails or user is not authenticated
 * 
 * @example
 * const conversations = await getConversations();
 * console.log('User has', conversations.length, 'conversations');
 */
export async function getConversations() {
  try {
    console.log('📥 Fetching conversations...');

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ No authenticated user');
      return [];
    }

    const conversations = [];

    // Get trainer-client relationships to show potential conversations
    const { data: relationships, error: relationshipsError } = await supabase
      .from('trainer_clients')
      .select('client_id, trainer_id')
      .or(`trainer_id.eq.${user.id},client_id.eq.${user.id}`)
      .eq('status', 'active');

    if (!relationshipsError && relationships) {
      // Get unique user IDs (excluding self)
      const otherUserIds = relationships.map(rel =>
        rel.trainer_id === user.id ? rel.client_id : rel.trainer_id
      ).filter(id => id !== user.id);

      // Fetch user profiles separately
      if (otherUserIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name, email')
          .in('id', otherUserIds);

        if (!usersError && users) {
          // Get unread counts for each user
          for (const otherUser of users) {
            const unreadCount = await getConversationUnreadCount(otherUser.id);
            
            conversations.push({
              user_id: otherUser.id,
              user_full_name: `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.email,
              user_email: otherUser.email,
              last_message_content: 'Start a conversation...',
              last_message_at: new Date().toISOString(),
              unread_count: unreadCount,
              is_last_message_from_me: false
            });
          }
        }
      }
    }

    console.log('✅ Fetched', conversations.length, 'conversations');
    return conversations;
  } catch (error) {
    console.error('Error in getConversations:', error);
    return [];
  }
}

/**
 * Fetch messages for a specific conversation
 * 
 * Retrieves all messages between the current user and another user,
 * ordered chronologically from oldest to newest.
 * 
 * @async
 * @param {string} otherUserId - ID of the other user in the conversation
 * @returns {Promise<Message[]>} Array of message objects
 * @throws {Error} When database query fails or user is not authenticated
 * 
 * @example
 * const messages = await getConversationMessages('user-123');
 * messages.forEach(msg => console.log(msg.is_from_me ? 'You:' : 'Them:', msg.content));
 */
export async function getConversationMessages(otherUserId) {
  try {
    console.log('📥 Fetching messages for conversation with:', otherUserId);

    if (!otherUserId) {
      throw new Error('Other user ID is required');
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ No authenticated user');
      return [];
    }

    // Query the direct_messages table directly
    const { data: messages, error: messagesError } = await supabase
      .from('direct_messages')
      .select('id, sender_id, recipient_id, content, created_at, read_at')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return [];
    }

    // Get sender info separately if we have messages
    let senderNames = {};
    if (messages && messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: senders } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .in('id', senderIds);

      if (senders) {
        senders.forEach(sender => {
          senderNames[sender.id] = `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || sender.email;
        });
      }
    }

    // Transform messages to match expected format
    const formattedMessages = (messages || []).map(message => ({
      id: message.id,
      sender_id: message.sender_id,
      recipient_id: message.recipient_id,
      content: message.content,
      created_at: message.created_at,
      read_at: message.read_at,
      sender_name: senderNames[message.sender_id] || 'Unknown User',
      is_from_current_user: message.sender_id === user.id,
      is_read: message.read_at !== null
    }));

    console.log('✅ Fetched', formattedMessages.length, 'messages');
    return formattedMessages;
  } catch (_error) {
    console.error('Error in getConversationMessages:', _error);
    return [];
  }
}

/**
 * Get total count of unread messages for current user
 * 
 * For trainers: Counts messages from clients that need a response (needs_response = true)
 * For clients: Counts unread messages from trainers (read_at is null)
 * 
 * @async
 * @returns {Promise<number>} Total number of unread messages
 * 
 * @example
 * const unreadCount = await getUnreadMessageCount();
 * console.log('You have', unreadCount, 'unread messages');
 */
export async function getUnreadMessageCount() {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return 0;
    }

    // Count messages where user is recipient and needs_response = true (their turn to respond)
    const { count, error } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('needs_response', true);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getUnreadMessageCount:', error);
    return 0;
  }
}

/**
 * Get unread message count for a specific conversation
 * 
 * For trainers: Counts messages from specific client that need a response
 * For clients: Counts unread messages from specific trainer
 * 
 * @async
 * @param {string} otherUserId - ID of the other user in the conversation
 * @returns {Promise<number>} Number of unread messages from that user
 * 
 * @example
 * const unreadCount = await getConversationUnreadCount('user-123');
 * console.log('You have', unreadCount, 'unread messages from this user');
 */
export async function getConversationUnreadCount(otherUserId) {
  try {
    if (!otherUserId) {
      return 0;
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return 0;
    }

    // Count messages from other user where current user is recipient and needs_response = true
    const { count, error } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', user.id)
      .eq('needs_response', true);

    if (error) {
      console.error('Error getting conversation unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getConversationUnreadCount:', error);
    return 0;
  }
}

// =====================================================================================
// MESSAGE SENDING
// =====================================================================================

/**
 * Send a new message with smart response tracking
 * 
 * @description
 * This function implements the "tennis ball" messaging pattern where sending a message:
 * 1. Clears needs_response on ALL previous messages in the conversation
 * 2. Sets needs_response = true on the new message (recipient's turn)
 * 3. Triggers real-time subscriptions to update badges
 * 
 * WORKFLOW:
 * =========
 * Step 1: Validate inputs (recipient ID, content length, authentication)
 * Step 2: Clear needs_response on all messages in this conversation
 *         Uses OR condition to match both directions:
 *         - (sender=you AND recipient=them)
 *         - (sender=them AND recipient=you)
 * Step 3: Insert new message with needs_response = true
 * Step 4: Real-time subscription triggers on recipient's device
 * Step 5: Recipient's badge shows new count
 * 
 * TURN-BASED LOGIC:
 * =================
 * Before: Client has 3 messages with needs_response = true
 * Trainer sends message:
 *   - All 3 client messages → needs_response = false
 *   - New trainer message → needs_response = true
 *   - Client's badge clears, Trainer's badge clears, Client sees new badge
 * 
 * @async
 * @param {string} recipientId - UUID of the message recipient
 * @param {string} content - Message content (1-5000 characters, will be trimmed)
 * @returns {Promise<Object>} Result object
 * @returns {string} return.message_id - UUID of the created message
 * @returns {boolean} return.success - Whether message was sent successfully
 * 
 * @throws {Error} If recipient ID or content is missing
 * @throws {Error} If content is empty after trimming
 * @throws {Error} If content exceeds 5000 characters
 * @throws {Error} If user is not authenticated
 * @throws {Error} If database insert fails
 * 
 * @example
 * // Send a simple message
 * try {
 *   const result = await sendMessage('user-123', 'Hello! How is your training?');
 *   console.log('Message sent:', result.message_id);
 * } catch (error) {
 *   console.error('Failed to send:', error.message);
 * }
 * 
 * @example
 * // With error handling
 * const handleSend = async (recipientId, message) => {
 *   if (!message.trim()) {
 *     alert('Message cannot be empty');
 *     return;
 *   }
 *   
 *   try {
 *     await sendMessage(recipientId, message);
 *     setMessage(''); // Clear input
 *     loadMessages(); // Refresh messages
 *   } catch (error) {
 *     alert(`Failed to send: ${error.message}`);
 *   }
 * };
 */
export async function sendMessage(recipientId, content) {
  try {
    console.log('📤 Sending message to:', recipientId);

    if (!recipientId || !content) {
      throw new Error('Recipient ID and content are required');
    }

    if (content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    if (content.length > 5000) {
      throw new Error('Message too long (maximum 5000 characters)');
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Authentication required to send messages');
    }

    // Mark all previous messages in this conversation as NOT needing response
    // This ensures only the most recent message (from sender) shows as needing response
    await supabase
      .from('direct_messages')
      .update({ needs_response: false })
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`);

    // Insert message directly into database
    // needs_response = true means the RECIPIENT needs to respond (it's their turn)
    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content: content.trim(),
        message_type: 'text',
        needs_response: true, // Recipient needs to respond
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Database insert error:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }

    console.log('✅ Message sent successfully:', data.id);
    return { message_id: data.id, success: true };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    throw error;
  }
}

/**
 * Fallback method to send messages when Edge Function is not available
 * Uses the send_direct_message database function
 */
async function _sendMessageFallback(recipientId, content) {
  try {
    console.log('📤 Using fallback send message method (database function)...');

    // Use the database function to send message
    const { data: result, error: functionError } = await supabase
      .rpc('send_direct_message', {
        recipient_id: recipientId,
        message_content: content.trim()
      });

    if (functionError) {
      console.error('Database function error in fallback:', functionError);
      throw new Error(`Failed to send message: ${functionError.message}`);
    }

    if (!result || !result.success) {
      throw new Error('Message sending failed via database function');
    }

    console.log('✅ Fallback: message sent successfully via database function');
    return {
      message_id: result.message_id,
      success: true,
      created_at: result.created_at,
      message: result.message || 'Message sent successfully (via fallback method)'
    };
  } catch (error) {
    console.error('Error in fallback send message:', error);
    throw error;
  }
}

// =====================================================================================
// MESSAGE STATUS MANAGEMENT
// =====================================================================================

/**
 * Mark messages as read in a conversation
 * 
 * Marks all unread messages from a specific user as read, updating the database
 * and returning the number of messages that were updated.
 * 
 * @async
 * @param {string} otherUserId - ID of the other user in the conversation
 * @returns {Promise<number>} Number of messages marked as read
 * @throws {Error} When database update fails
 * 
 * @example
 * const markedCount = await markMessagesAsRead('user-123');
 * console.log('Marked', markedCount, 'messages as read');
 */
export async function markMessagesAsRead(otherUserId) {
  try {
    console.log('📖 Marking messages as read for conversation with:', otherUserId);

    if (!otherUserId) {
      throw new Error('Other user ID is required');
    }

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('mark-messages-as-read', {
      body: { other_user_id: otherUserId }
    });

    if (error) {
      // If Edge Function fails, use fallback
      console.log('⚠️ Edge Function failed. Using fallback approach...');
      return await markMessagesAsReadFallback(otherUserId);
    }

    const markedCount = data?.marked_count || 0;
    console.log('✅ Marked', markedCount, 'messages as read');
    return markedCount;
  } catch (error) {
    console.error('Error in markMessagesAsRead:', error);
    throw error;
  }
}

/**
 * Fallback method to mark messages as read when database functions are not available
 */
async function markMessagesAsReadFallback(otherUserId) {
  try {
    console.log('📖 Using fallback mark as read method...');

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ No authenticated user for mark as read fallback');
      return 0;
    }

    // Update messages directly
    const { error: updateError, count } = await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', user.id)
      .is('read_at', null);

    if (updateError) {
      console.error('Error in fallback mark as read:', updateError);
      return 0;
    }

    const markedCount = count || 0;
    console.log('✅ Fallback: marked', markedCount, 'messages as read via direct update');
    return markedCount;
  } catch (error) {
    console.error('Error in fallback mark as read:', error);
    return 0;
  }
}

// =====================================================================================
// REAL-TIME SUBSCRIPTIONS
// =====================================================================================

/**
 * Subscribe to real-time message changes (INSERT and UPDATE events)
 * 
 * @description
 * Sets up a real-time subscription to listen for message changes that affect
 * the current user's badge count. This implements the core of the "tennis ball"
 * notification system.
 * 
 * SUBSCRIPTION EVENTS:
 * ====================
 * 1. INSERT Events (filter: recipient_id = current user)
 *    - Triggered when someone sends YOU a message
 *    - Callback fires → reload badge count
 *    - Badge shows new count
 * 
 * 2. UPDATE Events (no filter - catches all updates)
 *    - Triggered when ANY message's needs_response changes
 *    - This includes when YOU send a message (clears previous needs_response)
 *    - Callback fires → reload badge count
 *    - Badge updates to reflect new state
 * 
 * WHY NO FILTER ON UPDATE:
 * ========================
 * When you send a message, the UPDATE query affects messages where:
 * - You are the sender AND recipient is them (your sent messages)
 * - You are the recipient AND sender is them (their messages to you)
 * 
 * If we filtered UPDATE by recipient_id=you, we'd miss the updates to
 * messages where you're the sender. No filter = catch all updates = badge
 * updates immediately when you send.
 * 
 * USAGE PATTERN:
 * ==============
 * ```javascript
 * useEffect(() => {
 *   let subscription;
 *   
 *   const setup = async () => {
 *     subscription = await subscribeToMessages(() => {
 *       // Reload badge count
 *       loadUnreadCount();
 *     });
 *   };
 *   
 *   setup();
 *   
 *   return () => {
 *     if (subscription) {
 *       subscription.unsubscribe();
 *     }
 *   };
 * }, [user]);
 * ```
 * 
 * @async
 * @param {Function} callback - Function to call when messages change
 *                               Receives payload: { eventType, old, new }
 * @returns {Promise<Object|null>} Subscription object with unsubscribe() method,
 *                                  or null if user not authenticated
 * @throws {Error} If callback is not a function
 * @throws {Error} If subscription setup fails
 * 
 * @example
 * // Basic usage in a React component
 * const [unreadCount, setUnreadCount] = useState(0);
 * 
 * useEffect(() => {
 *   const loadCount = async () => {
 *     const count = await getUnreadMessageCount();
 *     setUnreadCount(count);
 *   };
 *   
 *   loadCount();
 *   
 *   const setupSub = async () => {
 *     const sub = await subscribeToMessages(() => {
 *       loadCount(); // Reload on any message change
 *     });
 *     
 *     return () => sub?.unsubscribe();
 *   };
 *   
 *   return setupSub();
 * }, []);
 * 
 * @example
 * // With detailed logging
 * const subscription = await subscribeToMessages((payload) => {
 *   console.log('Event:', payload.eventType);
 *   console.log('Old data:', payload.old);
 *   console.log('New data:', payload.new);
 *   
 *   if (payload.eventType === 'INSERT') {
 *     console.log('New message received!');
 *   } else if (payload.eventType === 'UPDATE') {
 *     console.log('Message updated (needs_response changed)');
 *   }
 *   
 *   reloadBadgeCount();
 * });
 */
export async function subscribeToMessages(callback) {
  try {
    console.log('🔔 Setting up real-time message subscription...');

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Get current user synchronously
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('⚠️ No authenticated user for message subscription');
      return null;
    }

    const subscription = supabase
      .channel('message_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📨 New message received:', payload);
          callback(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages'
          // No filter - catch all updates to recalculate badge
        },
        (payload) => {
          console.log('📝 Message updated (needs_response changed):', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Message subscription status:', status);
      });

    console.log('✅ Real-time subscription established');
    return subscription;
  } catch (error) {
    console.error('Error setting up message subscription:', error);
    throw error;
  }
}

/**
 * Subscribe to message read status updates
 * 
 * Sets up a real-time subscription to listen for when messages are marked as read.
 * Useful for updating UI indicators when the recipient reads your messages.
 * 
 * @param {Function} callback - Function to call when message read status changes
 * @returns {Object} Subscription object that can be used to unsubscribe
 * @throws {Error} When subscription setup fails
 * 
 * @example
 * const subscription = subscribeToMessageUpdates((payload) => {
 *   if (payload.new.is_read && !payload.old.is_read) {
 *     console.log('Message was read:', payload.new.id);
 *   }
 * });
 */
export function subscribeToMessageUpdates(callback) {
  try {
    console.log('🔔 Setting up message update subscription...');

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const subscription = supabase
      .channel('message_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages'
        },
        (payload) => {
          console.log('📝 Message updated:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('Update subscription status:', status);
      });

    console.log('✅ Message update subscription established');
    return subscription;
  } catch (error) {
    console.error('Error setting up message update subscription:', error);
    throw error;
  }
}

// =====================================================================================
// UTILITY FUNCTIONS
// =====================================================================================

/**
 * Format message timestamp for display
 * 
 * Converts a message timestamp into a human-readable format,
 * showing relative time for recent messages and absolute time for older ones.
 * 
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted timestamp for display
 * 
 * @example
 * formatMessageTime('2025-11-02T10:30:00Z') // "10:30 AM"
 * formatMessageTime('2025-11-01T15:00:00Z') // "Yesterday"
 * formatMessageTime('2025-10-30T12:00:00Z') // "Oct 30"
 */
export function formatMessageTime(timestamp) {
  try {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - messageDate) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    // Less than 1 minute ago
    if (diffInMinutes < 1) {
      return 'Just now';
    }

    // Less than 1 hour ago
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }

    // Less than 24 hours ago (same day)
    if (diffInHours < 24 && messageDate.getDate() === now.getDate()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Yesterday
    if (diffInDays === 1) {
      return 'Yesterday';
    }

    // Within the past week
    if (diffInDays < 7) {
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    }

    // Within the current year
    if (messageDate.getFullYear() === now.getFullYear()) {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // Older than current year
    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (error) {
    console.error('Error formatting message time:', error);
    return 'Unknown time';
  }
}

/**
 * Truncate message content for preview
 * 
 * Truncates long message content to a specified length for display in conversation lists.
 * Preserves word boundaries when possible.
 * 
 * @param {string} content - Original message content
 * @param {number} maxLength - Maximum length for truncated content (default: 100)
 * @returns {string} Truncated content with ellipsis if needed
 * 
 * @example
 * truncateMessage('This is a very long message that should be truncated', 20)
 * // Returns: "This is a very long..."
 */
export function truncateMessage(content, maxLength = 100) {
  try {
    if (!content || typeof content !== 'string') {
      return '';
    }

    if (content.length <= maxLength) {
      return content;
    }

    // Try to truncate at word boundary
    const truncated = content.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    if (lastSpaceIndex > maxLength * 0.7) { // Only use word boundary if it's not too short
      return truncated.substring(0, lastSpaceIndex) + '...';
    }

    return truncated + '...';
  } catch (error) {
    console.error('Error truncating message:', error);
    return content || '';
  }
}

/**
 * Validate message content before sending
 * 
 * Performs client-side validation of message content to ensure it meets
 * requirements before attempting to send via the Edge Function.
 * 
 * @param {string} content - Message content to validate
 * @returns {Object} Validation result with isValid boolean and error message
 * 
 * @example
 * const validation = validateMessageContent('Hello there!');
 * if (validation.isValid) {
 *   await sendMessage(recipientId, content);
 * } else {
 *   console.error('Invalid message:', validation.error);
 * }
 */
export function validateMessageContent(content) {
  try {
    if (!content || typeof content !== 'string') {
      return { isValid: false, error: 'Message content is required' };
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    if (trimmedContent.length > 5000) {
      return { isValid: false, error: 'Message too long (maximum 5000 characters)' };
    }

    // Check for potentially problematic content
    if (trimmedContent.length < 1) {
      return { isValid: false, error: 'Message too short' };
    }

    return { isValid: true, error: null };
  } catch (error) {
    console.error('Error validating message content:', error);
    return { isValid: false, error: 'Validation error occurred' };
  }
}

// =====================================================================================
// ERROR HANDLING UTILITIES
// =====================================================================================

/**
 * Handle messaging errors with user-friendly messages
 * 
 * Converts technical error messages into user-friendly explanations
 * that can be displayed in the UI.
 * 
 * @param {Error} error - The error object to handle
 * @returns {string} User-friendly error message
 * 
 * @example
 * try {
 *   await sendMessage(recipientId, content);
 * } catch (error) {
 *   const userMessage = handleMessagingError(error);
 *   showErrorToUser(userMessage);
 * }
 */
export function handleMessagingError(error) {
  console.error('Messaging error:', error);

  if (!error) {
    return 'An unknown error occurred';
  }

  const errorMessage = error.message || error.toString();

  // Authentication errors
  if (errorMessage.includes('Authentication') || errorMessage.includes('auth')) {
    return 'Please log in to send messages';
  }

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'Network error. Please check your connection and try again';
  }

  // Validation errors
  if (errorMessage.includes('empty') || errorMessage.includes('required')) {
    return 'Please enter a message before sending';
  }

  if (errorMessage.includes('too long')) {
    return 'Message is too long. Please shorten it and try again';
  }

  // Server errors
  if (errorMessage.includes('server') || errorMessage.includes('500')) {
    return 'Server error. Please try again in a moment';
  }

  // Default fallback
  return 'Unable to send message. Please try again';
}

/**
 * Retry messaging operation with exponential backoff
 * 
 * Retries a messaging operation (like sending a message) with increasing delays
 * between attempts. Useful for handling temporary network or server issues.
 * 
 * @async
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @returns {Promise} Result of the successful operation
 * @throws {Error} If all retry attempts fail
 * 
 * @example
 * const result = await retryMessagingOperation(
 *   () => sendMessage(recipientId, content),
 *   3,
 *   1000
 * );
 */
export async function retryMessagingOperation(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Messaging operation attempt ${attempt + 1}/${maxRetries + 1}`);
      const result = await operation();
      console.log('✅ Messaging operation succeeded');
      return result;
    } catch (error) {
      lastError = error;
      console.error(`❌ Messaging operation attempt ${attempt + 1} failed:`, error);

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry certain types of errors
      if (error.message?.includes('Authentication') ||
        error.message?.includes('validation') ||
        error.message?.includes('empty') ||
        error.message?.includes('too long')) {
        console.log('🚫 Not retrying due to error type');
        break;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

console.log('📡 Messaging utilities loaded successfully');