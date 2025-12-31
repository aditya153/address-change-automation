import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { UserCog, Plus, Trash2, Shield, Mail, Clock, X, Send } from 'lucide-react';
import './UserManagement.css';

import API_URL from '../utils/api';

export default function EmployeeManagement() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'admin' });
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const res = await axios.get(`${API_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Filter only admins (employees)
            const admins = (res.data.users || []).filter(u => u.role === 'admin');
            setEmployees(admins);
        } catch (err) {
            console.error('Error fetching employees:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInviteEmployee = async (e) => {
        e.preventDefault();
        if (!inviteData.name || !inviteData.email) {
            setMessage('Please fill in all fields');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            setInviting(true);
            const token = localStorage.getItem('authToken');
            await axios.post(`${API_URL}/admin/users/invite`,
                { ...inviteData, role: 'admin' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage('Employee invited successfully! They can now log in via Google.');
            setShowInviteModal(false);
            setInviteData({ name: '', email: '', role: 'admin' });
            fetchEmployees();
            setTimeout(() => setMessage(''), 5000);
        } catch (err) {
            console.error('Error inviting employee:', err);
            setMessage('Failed to invite employee: ' + (err.response?.data?.detail || err.message));
            setTimeout(() => setMessage(''), 5000);
        } finally {
            setInviting(false);
        }
    };

    const handleDemoteToUser = async (userId) => {
        if (!window.confirm('Are you sure you want to demote this employee to a regular user?')) return;
        try {
            const token = localStorage.getItem('authToken');
            await axios.put(`${API_URL}/admin/users/${userId}/role`,
                { role: 'user' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage('Employee demoted to user successfully');
            fetchEmployees();
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage('Failed to demote employee');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleDeleteEmployee = async (userId) => {
        if (!window.confirm('Are you sure you want to remove this employee? This cannot be undone.')) return;
        try {
            const token = localStorage.getItem('authToken');
            await axios.delete(`${API_URL}/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage('Employee removed successfully');
            fetchEmployees();
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage('Failed to remove employee');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString || dateString === 'Never') return 'Never';
        return new Date(dateString).toLocaleString();
    };

    if (loading) {
        return (
            <div className="user-management-loading">
                <div className="spinner"></div>
                <p>Loading employees...</p>
            </div>
        );
    }

    return (
        <div className="user-management-container">
            <div className="user-management-header">
                <div>
                    <h1 className="user-management-title">Employee Management</h1>
                    <p className="user-management-subtitle">Manage team members who handle address change cases</p>
                </div>
                <Button className="invite-btn" onClick={() => setShowInviteModal(true)}>
                    <Plus size={16} />
                    Invite Employee
                </Button>
            </div>

            {message && (
                <div className={`user-message ${message.includes('Failed') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            <div className="user-management-card">
                <table className="user-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="no-users">
                                    No employees found. Invite team members to get started.
                                </td>
                            </tr>
                        ) : (
                            employees.map((employee) => (
                                <tr key={employee.id}>
                                    <td>
                                        <div className="user-cell">
                                            <div className="user-avatar-small">
                                                {employee.picture ? (
                                                    <img src={employee.picture} alt={employee.name} referrerPolicy="no-referrer" />
                                                ) : (
                                                    <span>{employee.name ? employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'EM'}</span>
                                                )}
                                            </div>
                                            <span className="user-name-text">{employee.name || 'Unnamed'}</span>
                                        </div>
                                    </td>
                                    <td className="user-email">{employee.email}</td>
                                    <td>
                                        <span className="role-badge admin">
                                            <Shield size={12} />
                                            Admin
                                        </span>
                                    </td>
                                    <td className="last-login">
                                        <Clock size={14} />
                                        {formatDate(employee.last_login)}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDemoteToUser(employee.id)}
                                                className="demote-btn"
                                            >
                                                Demote to User
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteEmployee(employee.id)}
                                                className="delete-btn"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Employee Stats */}
            <div className="employee-stats-card">
                <h3>Team Overview</h3>
                <div className="employee-stats-grid">
                    <div className="stat-item">
                        <span className="stat-number">{employees.length}</span>
                        <span className="stat-label">Total Employees</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number">{employees.filter(e => e.last_login && e.last_login !== 'Never').length}</span>
                        <span className="stat-label">Active This Week</span>
                    </div>
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="invite-modal-backdrop" onClick={() => setShowInviteModal(false)}>
                    <div className="invite-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Invite New Employee</h3>
                            <p>Authorized employees can log in via Google to access the admin dashboard</p>
                        </div>
                        <form onSubmit={handleInviteEmployee} className="invite-form">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter employee name"
                                    value={inviteData.name}
                                    onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="employee@example.com"
                                    value={inviteData.email}
                                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="modal-actions">
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
                                    <Send size={16} />
                                    <span>{inviting ? 'Inviting...' : 'Send Invite'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
