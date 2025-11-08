/**
 * @file ClientMessaging.jsx
 * @description Messaging component visible only to users with Client role
 * @author Felony Fitness Development Team
 */

import { MessageSquare, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { supabase } from '../supabaseClient.js';

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
                    .select('is_client')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                setIsClient(data?.is_client || false);
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

            // Get trainer emails from auth.users (bypassing schema cache issues)
            // Create trainer list with proper display names
            const trainersList = trainerIds.map(trainerId => {
                // For self-testing (when trainer ID equals user ID), show a friendly name
                const displayName = trainerId === user.id ? 'Your Trainer (David)' : `Trainer ${trainerId.slice(0, 8)}`;

                return {
                    id: trainerId,
                    email: displayName
                };
            });

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
        const names = name.trim().split(' ');
        if (names.length === 1) return names[0][0]?.toUpperCase() || '?';
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
            height: '500px'
        }}>
            {/* Header */}
            <div style={{
                background: 'rgba(255, 107, 53, 0.1)',
                padding: '1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <MessageSquare size={20} style={{ color: '#ff6b35' }} />
                    <h3 style={{ margin: 0, color: 'white' }}>
                        {trainers.length === 1 ? `Message ${selectedTrainer?.email || 'Trainer'}` : 'Messages'}
                    </h3>
                </div>

                {/* Trainer selector */}
                {trainers.length > 1 && (
                    <select
                        value={selectedTrainer?.id || ''}
                        onChange={(e) => {
                            const trainer = trainers.find(t => t.id === e.target.value);
                            setSelectedTrainer(trainer);
                        }}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            padding: '0.5rem',
                            color: 'white',
                            fontSize: '0.875rem'
                        }}
                    >
                        {trainers.map(trainer => (
                            <option key={trainer.id} value={trainer.id} style={{ background: '#1a1a1a' }}>
                                {trainer.email}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                paddingBottom: '100px',
                overflowY: 'auto',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column-reverse',
                gap: '0.5rem',
                background: 'var(--background-color)',
                minHeight: 0
            }}>
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#888', padding: '2rem 0' }}>
                        <p>No messages yet. Start a conversation with your trainer!</p>
                    </div>
                ) : (
                    messages.map((message) => {
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
                                        ? getInitials(user?.user_metadata?.full_name || user?.email)
                                        : getInitials(selectedTrainer?.email)
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
                    })
                )}
            </div>

            {/* Message input - iOS style - Fixed at Bottom */}
            <form onSubmit={sendMessage} style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '12px 16px',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--surface-color)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
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
        </div>
    );
};

export default ClientMessaging;