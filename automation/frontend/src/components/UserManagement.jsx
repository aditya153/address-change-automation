import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Plus, UserPlus, X, Save, Send, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import './UserManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'admin' });
    const { getAuthToken, user: currentUser } = useAuth();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = getAuthToken();
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            const response = await axios.get(`${API_URL}/admin/users`, config);
            // Filter only regular users (not admins - those are shown in Employees section)
            const regularUsers = (response.data.users || []).filter(u => u.role !== 'admin');
            setUsers(regularUsers);
            setError('');
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleInviteUser = async (e) => {
        e.preventDefault();
        if (!inviteData.name || !inviteData.email) {
            alert('Please fill in all fields');
            return;
        }

        try {
            setInviting(true);
            const token = getAuthToken();
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            await axios.post(`${API_URL}/admin/users/invite`, inviteData, config);

            setShowInviteModal(false);
            setInviteData({ name: '', email: '', role: 'admin' });
            fetchUsers();
            alert('User invited successfully! They can now log in via Google.');
        } catch (err) {
            console.error('Error inviting user:', err);
            alert('Failed to invite user: ' + (err.response?.data?.detail || err.message));
        } finally {
            setInviting(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
            return;
        }

        try {
            const token = getAuthToken();
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            await axios.put(
                `${API_URL}/admin/users/${userId}/role`,
                { role: newRole },
                config
            );

            // Refresh list
            fetchUsers();

        } catch (err) {
            console.error('Error updating role:', err);
            alert('Failed to update role: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user? This action is permanent and cannot be undone.')) {
            return;
        }

        try {
            const token = getAuthToken();
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            await axios.delete(`${API_URL}/admin/users/${userId}`, config);
            fetchUsers();
            alert('User deleted successfully.');
        } catch (err) {
            console.error('Error deleting user:', err);
            alert('Failed to delete user: ' + (err.response?.data?.detail || err.message));
        }
    };

    if (loading) return <div className="user-loading">Loading users...</div>;

    return (
        <div className="user-management-container">
            <div className="user-header">
                <div>
                    <h2>User Management</h2>
                    <p>View all users who have logged in via Google</p>
                </div>
            </div>

            {error && <div className="user-error">{error}</div>}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="invite-modal-backdrop">
                    <div className="invite-modal">
                        <div className="modal-header">
                            <h3>Invite New Admin</h3>
                            <p>Authorized users can log in via Google to access the dashboard</p>
                        </div>
                        <form onSubmit={handleInviteUser} className="invite-form">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter name"
                                    value={inviteData.name}
                                    onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="email@example.com"
                                    value={inviteData.email}
                                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowInviteModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-invite"
                                    disabled={inviting}
                                >
                                    {inviting ? 'Inviting...' : (
                                        <>
                                            <Send size={16} />
                                            <span>Send Invitation</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="users-table-wrapper">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className={user.id === currentUser?.id ? 'current-user-row' : ''}>
                                <td className="user-info-cell">
                                    <div className="user-avatar-small">
                                        {user.picture ? (
                                            <img src={user.picture} alt={user.name} />
                                        ) : (
                                            <span>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                                        )}
                                    </div>
                                    <span className="user-name">{user.name || 'Unnamed User'}</span>
                                    {user.id === currentUser?.id && <span className="badge-you">(You)</span>}
                                </td>
                                <td>{user.email}</td>
                                <td>
                                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                </td>
                                <td>
                                    <div className="user-actions-cell">
                                        {user.id !== currentUser?.id && (
                                            <button
                                                className="btn-delete-user"
                                                onClick={() => handleDeleteUser(user.id)}
                                                title="Delete User"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManagement;
