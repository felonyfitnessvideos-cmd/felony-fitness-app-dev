/**
 * @file RoleSystemTest.jsx
 * @description Component to test and demonstrate the role system functionality
 * @author Felony Fitness Development Team
 */

import { AlertCircle, Check, Shield, User, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { supabase } from '../supabaseClient.js';
import userRoleUtils from '../utils/userRoleUtils.js';

const RoleSystemTest = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [currentRoles, setCurrentRoles] = useState([]);

    const addResult = (message, success = true) => {
        setResults(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message,
            success,
            timestamp: Date.now()
        }]);
    };

    const loadCurrentRoles = async () => {
        if (!user) return;

        try {
            const tags = await userRoleUtils.getCurrentUserTags();
            setCurrentRoles(tags);
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    };

    useEffect(() => {
        if (user) {
            loadCurrentRoles();
        }
        // loadCurrentRoles changes on every render, so we can't include it safely
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const runFullTest = async () => {
        if (!user) {
            addResult('❌ No user logged in', false);
            return;
        }

        setLoading(true);
        setResults([]);

        try {
            addResult(`🚀 Starting role system test for ${user.email}`);
            addResult(`🔍 User ID: ${user.id}`);

            // Check if user exists in auth.users
            addResult('🔍 Checking if user exists in auth.users...');
            try {
                const { data: authUser, error: authError } = await supabase.auth.getUser();
                if (authError) {
                    addResult(`❌ Auth error: ${authError.message}`, false);
                } else if (authUser?.user?.id) {
                    addResult(`✅ Authenticated user found: ${authUser.user.id}`);
                    if (authUser.user.id === user.id) {
                        addResult(`✅ User IDs match - authentication is correct`);
                    } else {
                        addResult(`⚠️ User ID mismatch! Context: ${user.id}, Auth: ${authUser.user.id}`, false);
                    }
                } else {
                    addResult(`❌ No authenticated user found`, false);
                }
            } catch (authCheckError) {
                addResult(`❌ Auth check failed: ${authCheckError.message}`, false);
            }

            // Step 0: Database diagnostics
            addResult('0️⃣ Checking database setup...');
            try {
                // Check if tags table has required tags
                const { data: systemTags, error: tagsError } = await supabase
                    .from('tags')
                    .select('name, id')
                    .in('name', ['User', 'Trainer', 'Client']);

                if (tagsError) {
                    addResult(`❌ Tags table error: ${tagsError.message}`, false);
                } else {
                    addResult(`✅ Found ${systemTags?.length || 0} system tags: ${systemTags?.map(t => t.name).join(', ')}`);
                }

                // Check if trainer_clients table exists
                const { error: tcError } = await supabase
                    .from('trainer_clients')
                    .select('id')
                    .limit(1);

                if (tcError) {
                    addResult(`❌ trainer_clients table error: ${tcError.message}`, false);
                } else {
                    addResult(`✅ trainer_clients table accessible`);
                }

            } catch (diagError) {
                addResult(`❌ Database diagnostics failed: ${diagError.message}`, false);
            }

            // Step 1: Assign Trainer role
            addResult('1️⃣ Assigning Trainer role...');
            try {
                const trainerAssigned = await userRoleUtils.assignUserTag(user.id, 'Trainer');
                addResult(`Trainer role: ${trainerAssigned ? '✅ Assigned' : '⚠️ Already exists or failed'}`, trainerAssigned !== false);
            } catch (error) {
                addResult(`Trainer role: ❌ Error: ${error.message}`, false);
                console.error('Trainer role assignment error:', error);
            }

            // Step 2: Create trainer-client relationship with yourself
            addResult('2️⃣ Adding yourself as client...');
            try {
                const relationshipId = await userRoleUtils.addClientToTrainer(user.id, user.id, 'Self-test relationship');
                addResult(`Client relationship: ${relationshipId ? '✅ Created' : '❌ Failed'}`, !!relationshipId);
            } catch (error) {
                addResult(`Client relationship: ❌ Error: ${error.message}`, false);
                console.error('Client relationship error:', error);
            }

            // Step 3: Verify roles
            addResult('3️⃣ Checking updated roles...');
            const updatedRoles = await userRoleUtils.getCurrentUserTags();
            setCurrentRoles(updatedRoles);
            const roleNames = updatedRoles.map(r => r.tag_name);
            addResult(`Current roles: ${roleNames.join(', ')}`);

            // Step 4: Test messaging system
            addResult('4️⃣ Testing messaging system...');
            const testMessage = {
                sender_id: user.id,
                recipient_id: user.id,
                content: `Test message from trainer to client - ${new Date().toLocaleTimeString()}`
            };

            const { error: messageError } = await supabase
                .from('direct_messages')
                .insert([testMessage])
                .select();

            if (messageError) {
                addResult(`Messaging: ❌ ${messageError.message}`, false);
            } else {
                addResult('Messaging: ✅ Test message sent successfully');
            }

            // Step 5: Verify trainer-client relationships
            addResult('5️⃣ Checking trainer-client relationships...');
            const clients = await userRoleUtils.getTrainerClients(user.id);
            addResult(`Trainer has ${clients.length} client(s)`);

            const trainers = await userRoleUtils.getClientTrainers(user.id);
            addResult(`Client has ${trainers.length} trainer(s)`);

            addResult('🎉 Role system test completed!');

        } catch (error) {
            addResult(`❌ Test failed: ${error.message}`, false);
        } finally {
            setLoading(false);
        }
    };

    const getRoleIcon = (roleName) => {
        switch (roleName) {
            case 'Admin': return <Shield size={16} style={{ color: '#dc2626' }} />;
            case 'Trainer': return <Users size={16} style={{ color: '#10b981' }} />;
            case 'Client': return <User size={16} style={{ color: '#f59e0b' }} />;
            case 'User': return <User size={16} style={{ color: '#3b82f6' }} />;
            default: return <User size={16} style={{ color: '#6b7280' }} />;
        }
    };

    if (!user) {
        return (
            <div style={{ padding: '1rem', color: 'white', textAlign: 'center' }}>
                <AlertCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>Please log in to test the role system</p>
            </div>
        );
    }

    return (
        <div style={{
            padding: '1rem',
            color: 'white',
            maxWidth: '600px',
            margin: '0 auto',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
                🧪 Role System Test
            </h2>

            {/* Current Roles Display */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem'
            }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Current Roles:</h3>
                {currentRoles.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {currentRoles.map((role) => (
                            <div key={role.tag_id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                background: role.color || '#3b82f6',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.875rem'
                            }}>
                                {getRoleIcon(role.tag_name)}
                                {role.tag_name}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ margin: 0, opacity: 0.7 }}>No roles assigned yet</p>
                )}
            </div>

            {/* Test Button */}
            <button
                onClick={runFullTest}
                disabled={loading}
                style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: loading ? '#6b7280' : '#ff6b35',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '500',
                    marginBottom: '1rem'
                }}
            >
                {loading ? '🔄 Running Tests...' : '🚀 Run Full Role System Test'}
            </button>

            {/* Results Display */}
            {results.length > 0 && (
                <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '1rem',
                    borderRadius: '8px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Test Results:</h3>
                    {results.map((result) => (
                        <div key={result.id} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            marginBottom: '0.5rem',
                            padding: '0.5rem',
                            background: result.success !== false ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '4px',
                            fontSize: '0.875rem'
                        }}>
                            {result.success !== false ?
                                <Check size={16} style={{ color: '#22c55e', flexShrink: 0, marginTop: '1px' }} /> :
                                <X size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                            }
                            <span>{result.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Role Check */}
            <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                fontSize: '0.875rem'
            }}>
                <strong>💡 What this test does:</strong>
                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
                    <li>Assigns you the "Trainer" role</li>
                    <li>Adds you as your own client (auto-assigns "Client" role)</li>
                    <li>Tests the messaging system between roles</li>
                    <li>Verifies trainer-client relationships work</li>
                    <li>Shows your updated role tags</li>
                </ul>
            </div>
        </div>
    );
};

export default RoleSystemTest;