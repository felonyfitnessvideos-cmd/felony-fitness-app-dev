/**
 * @file ClientMessaging.jsx
 * @description Messaging component visible only to users with Client role
 * @author Felony Fitness Development Team
 */

import { ChevronDown, ChevronUp, MessageSquare, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { supabase } from '../supabaseClient.js';
import { getUnreadMessageCount, subscribeToMessages } from '../utils/messagingUtils';

const ClientMessaging = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [isClient, setIsClient] = useState(false);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [trainers, setTrainers] = useState([]);
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [sendLoading, setSendLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUserName, setCurrentUserName] = useState('');
    const messagesEndRef = useRef(null);

    // Check if user is a client by checking is_client flag in user_profiles
    useEffect(() => {
        const checkClientStatus = async () => {
            if (!user) {
                setIsClient(false);
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('is_client, first_name, last_name')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                setIsClient(data?.is_client || false);
                
                // Store user's full name for avatars
                const fullName = `${data?.first_name || ''} ${data?.last_name || ''}`.trim();
                setCurrentUserName(fullName || user?.email || 'You');
            } catch (error) {
                console.error('Error checking client status:', error);
                setIsClient(false);
            } finally {
                setLoading(false);
            }
        };

        checkClientStatus();
    }, [user]);

    const loadTrainers = useCallback(async () => {
        try {
            // TEMP FIX: Simple query without embedded relationships to avoid schema cache issues
            const { data: relationships, error } = await supabase
                .from('trainer_clients')
                .select('trainer_id')
                .eq('client_id', user.id)
                .eq('status', 'active');

            if (error) throw error;

            // Get trainer details separately to avoid schema cache issues
            const trainerIds = relationships?.map(rel => rel.trainer_id) || [];

            if (trainerIds.length === 0) {
                setTrainers([]);
                return;
            }

            // Get trainer profiles
            const { data: trainerProfiles, error: profileError } = await supabase
                .from('user_profiles')
                .select('id, first_name, last_name, email')
                .in('id', trainerIds);

            if (profileError) throw profileError;

            // Create trainer list with proper display names
            const trainersList = (trainerProfiles || []).map(trainer => ({
                id: trainer.id,
                email: trainer.email,
                name: `${trainer.first_name || ''} ${trainer.last_name || ''}`.trim() || trainer.email
            }));

            setTrainers(trainersList);

            // Auto-select first trainer if available
            if (trainersList.length > 0 && !selectedTrainer) {
                setSelectedTrainer(trainersList[0]);
            }
        } catch (error) {
            console.error('Error loading trainers:', error);
        }
    }, [user, selectedTrainer]);

    const loadMessages = useCallback(async (trainerId) => {
        if (!trainerId) return;

        try {
            const { data, error } = await supabase
                .from('direct_messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},recipient_id.eq.${trainerId}),and(sender_id.eq.${trainerId},recipient_id.eq.${user.id})`)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
            
            // Scroll to bottom after messages load
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }, [user]);

    // Load trainers when user and client status are confirmed
    useEffect(() => {
        if (user && isClient) {
            loadTrainers();
        }
    }, [user, isClient, loadTrainers]);

    // Load messages when trainer is selected
    useEffect(() => {
        if (selectedTrainer) {
            loadMessages(selectedTrainer.id);
        }
    }, [selectedTrainer, loadMessages]);

    // Fetch unread message count and subscribe to updates
    useEffect(() => {
        if (!user || !isClient) return;

        let subscription = null;

        const loadUnreadCount = async () => {
            try {
                const count = await getUnreadMessageCount();
                setUnreadCount(count);
            } catch (error) {
                console.error('Error loading unread count:', error);
            }
        };

        const setupSubscription = async () => {
            loadUnreadCount();

            // Subscribe to new messages (returns a Promise)
            subscription = await subscribeToMessages(() => {
                // Reload count when new message arrives
                loadUnreadCount();
            });
        };

        setupSubscription();

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [user, isClient]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedTrainer || sendLoading) return;

        setSendLoading(true);
        try {
            // Import and use the proper messaging utilities
            const { sendMessage: sendMessageUtil } = await import('../utils/messagingUtils.js');

            await sendMessageUtil(selectedTrainer.id, newMessage.trim());

            // Clear the input and reload messages
            setNewMessage('');

            // Reload messages to show the new message
            loadMessages(selectedTrainer.id);
            
            // Scroll to bottom after sending
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (error) {
            console.error('Error sending message:', error);
            alert(`Failed to send message: ${error.message}`);
        } finally {
            setSendLoading(false);
        }
    };

    // Get initials from a name
    const getInitials = (name) => {
        if (!name) return '?';
        
        let nameToProcess = name.trim();
        
        // If it's an email, extract the local part and convert to name-like format
        if (nameToProcess.includes('@')) {
            const localPart = nameToProcess.split('@')[0];
            // Replace common separators with spaces
            nameToProcess = localPart.replace(/[._-]/g, ' ');
        }
        
        const names = nameToProcess.split(' ').filter(n => n.length > 0);
        
        if (names.length === 0) return '?';
        if (names.length === 1) return names[0][0]?.toUpperCase() || '?';
        
        // Return first and last initial
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    };

    // Don't render if user is not a client
    if (loading) {
        return <div style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>Loading permissions...</div>;
    }

    if (!isClient) {
        return null; // Hidden from non-clients
    }

    if (trainers.length === 0) {
        return (
            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
                color: '#888'
            }}>
                <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'white' }}>No Trainers Yet</h3>
                <p style={{ margin: 0 }}>You haven't been assigned to any trainers yet. Once a trainer adds you as a client, you'll be able to message them here.</p>
            </div>
        );
    }

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: isCollapsed ? 'auto' : '400px',
            transition: 'height 0.3s ease'
        }}>
            {/* Header */}
            <div style={{
                background: 'rgba(255, 107, 53, 0.1)',
                padding: '1rem',
                borderBottom: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0,
                cursor: 'pointer'
            }}
            onClick={() => {
                const newCollapsedState = !isCollapsed;
                setIsCollapsed(newCollapsedState);
                // Scroll to bottom when expanding
                if (!newCollapsedState) {
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 350); // Wait for expansion animation
                }
            }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <MessageSquare size={20} style={{ color: '#ff6b35' }} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-6px',
                                    right: '-6px',
                                    backgroundColor: '#ff6b35',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '16px',
                                    height: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    fontWeight: 'bold'
                                }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </div>
                        <h3 style={{ margin: 0, color: 'white' }}>
                            {trainers.length === 1 ? `Message ${selectedTrainer?.name || selectedTrainer?.email || 'Trainer'}` : 'Messages'}
                        </h3>
                    </div>
                    {isCollapsed ? <ChevronDown size={20} style={{ color: '#ff6b35' }} /> : <ChevronUp size={20} style={{ color: '#ff6b35' }} />}
                </div>

                {/* Trainer selector - Only show when expanded */}
                {!isCollapsed && trainers.length > 1 && (
                    <select
                        value={selectedTrainer?.id || ''}
                        onChange={(e) => {
                            e.stopPropagation(); // Prevent header click
                            const trainer = trainers.find(t => t.id === e.target.value);
                            setSelectedTrainer(trainer);
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent header click
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            padding: '0.5rem',
                            color: 'white',
                            fontSize: '0.875rem',
                            marginTop: '0.5rem'
                        }}
                    >
                        {trainers.map(trainer => (
                            <option key={trainer.id} value={trainer.id} style={{ background: '#1a1a1a' }}>
                                {trainer.name || trainer.email}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Messages - Only show when expanded */}
            {!isCollapsed && (
                <>
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        background: 'var(--background-color)',
                        minHeight: 0,
                        paddingBottom: '1rem'
                    }}>
                        {messages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#888', padding: '2rem 0' }}>
                                <p>No messages yet. Start a conversation with your trainer!</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((message) => {
                                    const isDark = theme === 'dark';
                                    const isFromClient = user && message.sender_id === user.id;
                                    return (
                                        <div
                                            key={message.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-end',
                                                gap: '8px',
                                                flexDirection: isFromClient ? 'row-reverse' : 'row'
                                            }}
                                        >
                                            {/* Avatar */}
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: isFromClient ? (isDark ? '#636366' : '#c7c7cc') : '#f97316',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                flexShrink: 0
                                            }}>
                                                {isFromClient
                                                    ? getInitials(message.sender_name || currentUserName)
                                                    : getInitials(message.sender_name || selectedTrainer?.name || selectedTrainer?.email)
                                                }
                                            </div>

                                            {/* Message bubble */}
                                            <div style={{
                                                maxWidth: '70%',
                                                background: isFromClient ? (isDark ? '#3a3a3c' : '#e5e5ea') : '#f97316',
                                                color: isFromClient ? (isDark ? '#ffffff' : '#000000') : 'white',
                                                padding: '12px 16px',
                                                borderRadius: '20px',
                                                borderBottomRightRadius: isFromClient ? '4px' : '20px',
                                                borderBottomLeftRadius: isFromClient ? '20px' : '4px',
                                                fontSize: '15px',
                                                lineHeight: '1.4'
                                            }}>
                                                {message.content}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Message input - iOS style - Fixed at Bottom */}
                    <form onSubmit={sendMessage} style={{
                        padding: '12px 16px',
                        borderTop: '1px solid var(--border-color)',
                        background: 'var(--surface-color)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        flexShrink: 0
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-end',
                            background: 'var(--background-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '24px',
                            padding: '8px 12px'
                        }}>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Message..."
                                disabled={sendLoading}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    color: 'var(--text-primary)',
                                    fontSize: '16px',
                                    padding: '8px 4px'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={sendLoading || !newMessage.trim()}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: sendLoading || !newMessage.trim() ? 'var(--border-color)' : '#007aff',
                                    border: 'none',
                                    color: 'white',
                                    cursor: sendLoading || !newMessage.trim() ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
};

export default ClientMessaging;