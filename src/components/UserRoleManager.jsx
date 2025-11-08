/**
 * @file UserRoleManager.jsx
 * @description Component for managing user roles, tags, and trainer-client relationships
 * @author Felony Fitness Development Team
 * @version 1.0.0
 */

import {
    AlertCircle,
    Check,
    ChevronRight,
    Crown,
    Plus,
    Shield,
    Tag,
    User as UserIcon,
    UserPlus,
    Users,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import userRoleUtils from '../utils/userRoleUtils.js';
import './UserRoleManager.css';

/**
 * UserRoleManager Component
 * Provides interface for:
 * - Viewing and managing user roles/tags
 * - Creating trainer-client relationships
 * - Viewing role-based permissions
 */
const UserRoleManager = () => {
    const { user } = useAuth();

    // State management
    const [loading, setLoading] = useState(true);
    const [currentUserTags, setCurrentUserTags] = useState([]);
    const [_allTags, setAllTags] = useState([]);
    const [clients, setClients] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [_canAccessAdmin, setCanAccessAdmin] = useState(false);
    const [canAccessTrainer, setCanAccessTrainer] = useState(false);

    // UI state
    const [activeTab, setActiveTab] = useState('overview');
    const [showAddClient, setShowAddClient] = useState(false);
    const [newClientEmail, setNewClientEmail] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });

    // Load data on component mount
    useEffect(() => {
        if (user) {
            loadUserData();
        }
        // loadUserData changes on every render, so we can't include it safely
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    /**
     * Load all user role and relationship data
     */
    const loadUserData = async () => {
        setLoading(true);
        try {
            const [
                userTags,
                availableTags,
                userClients,
                userTrainers,
                adminAccess,
                trainerAccess
            ] = await Promise.all([
                userRoleUtils.getCurrentUserTags(),
                userRoleUtils.getAllTags(),
                userRoleUtils.getTrainerClients(user.id),
                userRoleUtils.getClientTrainers(user.id),
                userRoleUtils.canAccessAdminFeatures(),
                userRoleUtils.canAccessTrainerFeatures()
            ]);

            setCurrentUserTags(userTags);
            setAllTags(availableTags);
            setClients(userClients);
            setTrainers(userTrainers);
            setCanAccessAdmin(adminAccess);
            setCanAccessTrainer(trainerAccess);
        } catch (error) {
            console.error('Error loading user data:', error);
            showMessage('Error loading user data', 'error');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Show a temporary message to the user
     */
    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    /**
     * Get role icon based on tag name
     */
    const getRoleIcon = (tagName) => {
        switch (tagName) {
            case 'Admin': return <Shield size={16} className="role-icon admin" />;
            case 'Trainer': return <Users size={16} className="role-icon trainer" />;
            case 'Client': return <UserIcon size={16} className="role-icon client" />;
            case 'Premium': return <Crown size={16} className="role-icon premium" />;
            default: return <Tag size={16} className="role-icon default" />;
        }
    };

    /**
     * Handle adding a client by email
     */
    const handleAddClient = async (e) => {
        e.preventDefault();
        if (!newClientEmail.trim()) return;

        try {
            // First, we need to find the user by email
            // Note: In a real app, you'd need a function to find users by email
            // For now, we'll show how the relationship would be created
            showMessage('Client addition feature requires user lookup by email - implement user search first', 'info');
            setNewClientEmail('');
            setShowAddClient(false);
        } catch (error) {
            console.error('Error adding client:', error);
            showMessage('Error adding client', 'error');
        }
    };

    /**
     * Request trainer role assignment
     */
    const handleRequestTrainerRole = async () => {
        try {
            const success = await userRoleUtils.assignUserTag(user.id, 'Trainer');
            if (success) {
                showMessage('Trainer role assigned successfully!', 'success');
                await loadUserData(); // Refresh data
            } else {
                showMessage('Failed to assign trainer role', 'error');
            }
        } catch (error) {
            console.error('Error requesting trainer role:', error);
            showMessage('Error requesting trainer role', 'error');
        }
    };

    if (loading) {
        return (
            <div className="user-role-manager loading">
                <div className="loading-spinner">Loading roles and permissions...</div>
            </div>
        );
    }

    return (
        <div className="user-role-manager">
            {/* Header */}
            <div className="role-manager-header">
                <h2>
                    <Users size={24} />
                    Role Management
                </h2>
                <p>Manage your roles, permissions, and relationships</p>
            </div>

            {/* Message Display */}
            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.type === 'error' && <AlertCircle size={16} />}
                    {message.type === 'success' && <Check size={16} />}
                    {message.text}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="tab-navigation">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={activeTab === 'roles' ? 'active' : ''}
                    onClick={() => setActiveTab('roles')}
                >
                    My Roles
                </button>
                {canAccessTrainer && (
                    <button
                        className={activeTab === 'clients' ? 'active' : ''}
                        onClick={() => setActiveTab('clients')}
                    >
                        My Clients
                    </button>
                )}
                <button
                    className={activeTab === 'trainers' ? 'active' : ''}
                    onClick={() => setActiveTab('trainers')}
                >
                    My Trainers
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="overview-tab">
                        <div className="role-summary">
                            <h3>Your Account Summary</h3>
                            <div className="summary-grid">
                                <div className="summary-card">
                                    <Tag size={20} />
                                    <div>
                                        <span className="count">{currentUserTags.length}</span>
                                        <span className="label">Active Roles</span>
                                    </div>
                                </div>
                                {canAccessTrainer && (
                                    <div className="summary-card">
                                        <Users size={20} />
                                        <div>
                                            <span className="count">{clients.length}</span>
                                            <span className="label">Clients</span>
                                        </div>
                                    </div>
                                )}
                                <div className="summary-card">
                                    <UserIcon size={20} />
                                    <div>
                                        <span className="count">{trainers.length}</span>
                                        <span className="label">Trainers</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="quick-actions">
                            <h3>Quick Actions</h3>
                            <div className="action-buttons">
                                {!canAccessTrainer && (
                                    <button
                                        className="action-btn trainer"
                                        onClick={handleRequestTrainerRole}
                                    >
                                        <Users size={16} />
                                        Become a Trainer
                                    </button>
                                )}
                                {canAccessTrainer && (
                                    <button
                                        className="action-btn add-client"
                                        onClick={() => setShowAddClient(true)}
                                    >
                                        <UserPlus size={16} />
                                        Add Client
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* My Roles Tab */}
                {activeTab === 'roles' && (
                    <div className="roles-tab">
                        <h3>Your Roles & Permissions</h3>
                        <div className="roles-grid">
                            {currentUserTags.map((tag) => (
                                <div key={tag.tag_id} className={`role-card ${tag.tag_type}`}>
                                    <div className="role-header">
                                        {getRoleIcon(tag.tag_name)}
                                        <h4>{tag.tag_name}</h4>
                                    </div>
                                    <div className="role-info">
                                        <span className="role-type">{tag.tag_type}</span>
                                        <span className="assigned-date">
                                            Since {new Date(tag.assigned_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* My Clients Tab */}
                {activeTab === 'clients' && canAccessTrainer && (
                    <div className="clients-tab">
                        <div className="tab-header">
                            <h3>My Clients</h3>
                            <button
                                className="add-btn"
                                onClick={() => setShowAddClient(true)}
                            >
                                <Plus size={16} />
                                Add Client
                            </button>
                        </div>

                        {clients.length === 0 ? (
                            <div className="empty-state">
                                <UserPlus size={48} />
                                <p>No clients yet</p>
                                <span>Add clients to start training them</span>
                            </div>
                        ) : (
                            <div className="clients-list">
                                {clients.map((relationship) => (
                                    <div key={relationship.id} className="client-card">
                                        <div className="client-info">
                                            <div className="client-name">
                                                {relationship.client?.user_profiles?.[0]?.full_name ||
                                                    relationship.client?.email || 'Unknown Client'}
                                            </div>
                                            <div className="client-meta">
                                                Added {new Date(relationship.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* My Trainers Tab */}
                {activeTab === 'trainers' && (
                    <div className="trainers-tab">
                        <h3>My Trainers</h3>

                        {trainers.length === 0 ? (
                            <div className="empty-state">
                                <Users size={48} />
                                <p>No trainers assigned</p>
                                <span>A trainer will add you to their client list</span>
                            </div>
                        ) : (
                            <div className="trainers-list">
                                {trainers.map((relationship) => (
                                    <div key={relationship.id} className="trainer-card">
                                        <div className="trainer-info">
                                            <div className="trainer-name">
                                                {relationship.trainer?.user_profiles?.[0]?.full_name ||
                                                    relationship.trainer?.email || 'Unknown Trainer'}
                                            </div>
                                            <div className="trainer-meta">
                                                Training since {new Date(relationship.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add Client Modal */}
            {showAddClient && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Add New Client</h3>
                            <button
                                className="close-btn"
                                onClick={() => setShowAddClient(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleAddClient}>
                            <div className="form-group">
                                <label htmlFor="clientEmail">Client Email Address</label>
                                <input
                                    id="clientEmail"
                                    type="email"
                                    value={newClientEmail}
                                    onChange={(e) => setNewClientEmail(e.target.value)}
                                    placeholder="Enter client's email address"
                                    required
                                />
                                <small>The client must have an existing account</small>
                            </div>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setShowAddClient(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="submit-btn">
                                    Add Client
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserRoleManager;