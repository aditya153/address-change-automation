import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './UserManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
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
            setUsers(response.data.users);
            setError('');
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to load users');
        } finally {
            setLoading(false);
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

    if (loading) return <div className="user-loading">Loading users...</div>;

    return (
        <div className="user-management-container">
            <div className="user-header">
                <h2>User Management</h2>
                <p>Manage system access and roles</p>
            </div>

            {error && <div className="user-error">{error}</div>}

            <div className="users-table-wrapper">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
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
                                    <span className={`role-badge ${user.role}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>
                                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                </td>
                                <td>
                                    {user.id !== currentUser?.id && (
                                        <button
                                            className={`btn-role ${user.role === 'admin' ? 'btn-demote' : 'btn-promote'}`}
                                            onClick={() => handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')}
                                        >
                                            {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                                        </button>
                                    )}
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
