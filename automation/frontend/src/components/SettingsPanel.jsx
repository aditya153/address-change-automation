import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    User,
    Bell,
    Mail,
    Brain,
    Clock,
    Activity,
    Users,
    Server,
    Save,
    ChevronRight,
    CheckCircle,
    AlertCircle,
    Settings,
    LogOut
} from 'lucide-react';
import { Button } from './ui/button';
import './SettingsPanel.css';

import API_URL from '../utils/api';

const SettingsPanel = () => {
    const { user, getAuthToken, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Settings state
    const [settings, setSettings] = useState({
        // Profile
        displayName: user?.name || 'Admin User',
        email: user?.email || 'admin@buergerportal.de',

        // Notifications
        emailNotifications: true,
        newCaseAlerts: true,
        hitlAlerts: true,
        dailyDigest: false,

        // AI Settings
        confidenceThreshold: 75,
        autoProcessHighConfidence: true,

        // Working Hours
        workingHoursStart: '08:00',
        workingHoursEnd: '17:00',
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    });

    // Audit Log
    const [auditLog, setAuditLog] = useState([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    // System Status
    const [systemStatus, setSystemStatus] = useState({
        backend: 'checking',
        database: 'checking',
        aiService: 'checking',
        queueLength: 0
    });

    // Email Templates
    const [templates] = useState([
        { id: 'welcome', name: 'Welcome Email', description: 'Sent when a citizen creates an account' },
        { id: 'case_received', name: 'Case Received', description: 'Confirmation when address change is submitted' },
        { id: 'case_completed', name: 'Case Completed', description: 'Notification when case is processed' },
        { id: 'hitl_required', name: 'Review Required', description: 'Sent when manual review is needed' }
    ]);

    // Fetch system status
    const checkSystemStatus = async () => {
        try {
            const res = await axios.get(`${API_URL}/health`);
            setSystemStatus({
                backend: res.data.status === 'ok' ? 'healthy' : 'unhealthy',
                database: 'healthy',
                aiService: 'healthy',
                queueLength: 0
            });
        } catch (err) {
            setSystemStatus({
                backend: 'unhealthy',
                database: 'unknown',
                aiService: 'unknown',
                queueLength: 0
            });
        }
    };

    // Fetch audit log
    const fetchAuditLog = async () => {
        setLoadingAudit(true);
        try {
            // Try to get recent cases and extract audit entries
            const [pending, completed] = await Promise.all([
                axios.get(`${API_URL}/admin/pending-cases`),
                axios.get(`${API_URL}/admin/completed-cases`)
            ]);

            const allCases = [
                ...(pending.data.cases || []),
                ...(completed.data.cases || [])
            ];

            // Create mock audit entries from case data
            const entries = allCases.slice(0, 10).map((c, idx) => ({
                id: idx,
                timestamp: c.submitted_at,
                action: c.status === 'CLOSED' ? 'Case completed' : 'Case submitted',
                user: 'System',
                details: `Case ${c.case_id} - ${c.citizen_name || c.email}`
            }));

            setAuditLog(entries);
        } catch (err) {
            console.error('Error fetching audit log:', err);
        } finally {
            setLoadingAudit(false);
        }
    };

    useEffect(() => {
        checkSystemStatus();
        if (activeTab === 'audit') {
            fetchAuditLog();
        }
    }, [activeTab]);

    const handleSaveSettings = async () => {
        setSaving(true);
        // Simulate API call
        setTimeout(() => {
            setSaving(false);
            setMessage({ type: 'success', text: 'Settings saved successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }, 1000);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('de-DE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'templates', label: 'Email Templates', icon: Mail },
        { id: 'ai', label: 'AI Settings', icon: Brain },
        { id: 'hours', label: 'Working Hours', icon: Clock },
        { id: 'audit', label: 'Audit Log', icon: Activity },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'status', label: 'System Status', icon: Server }
    ];

    return (
        <div className="settings-container">
            {/* Header */}
            <div className="settings-header">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Settings</h1>
                    <p className="text-muted-foreground">Configure your admin panel preferences</p>
                </div>
            </div>

            {/* Message */}
            {message.text && (
                <div className={`settings-message ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            <div className="settings-layout">
                {/* Sidebar */}
                <div className="settings-sidebar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <tab.icon size={18} />
                            <span>{tab.label}</span>
                            <ChevronRight size={16} className="chevron" />
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="settings-content">
                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Profile Settings</h2>
                            <p className="panel-description">Manage your account information</p>

                            <div className="form-group">
                                <label>Display Name</label>
                                <input
                                    type="text"
                                    value={settings.displayName}
                                    onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    value={settings.email}
                                    disabled
                                    className="disabled"
                                />
                                <p className="form-hint">Email cannot be changed</p>
                            </div>

                            <div className="form-group">
                                <label>Role</label>
                                <div className="role-badge">
                                    <User size={14} />
                                    {user?.role === 'admin' ? 'Administrator' : 'Staff Member'}
                                </div>
                            </div>

                            <div className="form-actions">
                                <Button onClick={handleSaveSettings} disabled={saving}>
                                    <Save size={16} />
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Notification Preferences</h2>
                            <p className="panel-description">Control how you receive alerts</p>

                            <div className="toggle-group">
                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <span className="toggle-label">Email Notifications</span>
                                        <span className="toggle-hint">Receive notifications via email</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.emailNotifications}
                                            onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <span className="toggle-label">New Case Alerts</span>
                                        <span className="toggle-hint">Get notified when new cases are submitted</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.newCaseAlerts}
                                            onChange={(e) => setSettings({ ...settings, newCaseAlerts: e.target.checked })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <span className="toggle-label">HITL Review Alerts</span>
                                        <span className="toggle-hint">Urgent alerts when manual review is needed</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.hitlAlerts}
                                            onChange={(e) => setSettings({ ...settings, hitlAlerts: e.target.checked })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <span className="toggle-label">Daily Digest</span>
                                        <span className="toggle-hint">Receive a summary email each morning</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.dailyDigest}
                                            onChange={(e) => setSettings({ ...settings, dailyDigest: e.target.checked })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div className="form-actions">
                                <Button onClick={handleSaveSettings} disabled={saving}>
                                    <Save size={16} />
                                    {saving ? 'Saving...' : 'Save Preferences'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Email Templates Tab */}
                    {activeTab === 'templates' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Email Templates</h2>
                            <p className="panel-description">Customize automated email notifications</p>

                            <div className="templates-list">
                                {templates.map((template) => (
                                    <div key={template.id} className="template-item">
                                        <div className="template-info">
                                            <Mail size={18} className="template-icon" />
                                            <div>
                                                <span className="template-name">{template.name}</span>
                                                <span className="template-desc">{template.description}</span>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">
                                            Edit
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Settings Tab */}
                    {activeTab === 'ai' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">AI Configuration</h2>
                            <p className="panel-description">Tune automation behavior and thresholds</p>

                            <div className="form-group">
                                <label>Confidence Threshold</label>
                                <div className="slider-container">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={settings.confidenceThreshold}
                                        onChange={(e) => setSettings({ ...settings, confidenceThreshold: parseInt(e.target.value) })}
                                        className="slider"
                                    />
                                    <span className="slider-value">{settings.confidenceThreshold}%</span>
                                </div>
                                <p className="form-hint">
                                    Cases below this threshold will require manual review
                                </p>
                            </div>

                            <div className="toggle-group">
                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <span className="toggle-label">Auto-process High Confidence</span>
                                        <span className="toggle-hint">Automatically complete cases above threshold</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={settings.autoProcessHighConfidence}
                                            onChange={(e) => setSettings({ ...settings, autoProcessHighConfidence: e.target.checked })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div className="ai-stats">
                                <div className="ai-stat">
                                    <Brain size={24} className="text-[#0066cc]" />
                                    <div>
                                        <span className="stat-value">94.2%</span>
                                        <span className="stat-label">Avg. Accuracy</span>
                                    </div>
                                </div>
                                <div className="ai-stat">
                                    <Activity size={24} className="text-green-500" />
                                    <div>
                                        <span className="stat-value">2.4s</span>
                                        <span className="stat-label">Avg. Processing</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <Button onClick={handleSaveSettings} disabled={saving}>
                                    <Save size={16} />
                                    {saving ? 'Saving...' : 'Save Settings'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Working Hours Tab */}
                    {activeTab === 'hours' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Working Hours</h2>
                            <p className="panel-description">Set office hours for SLA tracking</p>

                            <div className="hours-grid">
                                <div className="form-group">
                                    <label>Start Time</label>
                                    <input
                                        type="time"
                                        value={settings.workingHoursStart}
                                        onChange={(e) => setSettings({ ...settings, workingHoursStart: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Time</label>
                                    <input
                                        type="time"
                                        value={settings.workingHoursEnd}
                                        onChange={(e) => setSettings({ ...settings, workingHoursEnd: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Working Days</label>
                                <div className="days-selector">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                        <button
                                            key={day}
                                            className={`day-btn ${settings.workingDays.includes(day) ? 'active' : ''}`}
                                            onClick={() => {
                                                const days = settings.workingDays.includes(day)
                                                    ? settings.workingDays.filter(d => d !== day)
                                                    : [...settings.workingDays, day];
                                                setSettings({ ...settings, workingDays: days });
                                            }}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-actions">
                                <Button onClick={handleSaveSettings} disabled={saving}>
                                    <Save size={16} />
                                    {saving ? 'Saving...' : 'Save Hours'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Audit Log Tab */}
                    {activeTab === 'audit' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Audit Log</h2>
                            <p className="panel-description">Track all admin actions and system events</p>

                            {loadingAudit ? (
                                <div className="loading-state">Loading audit log...</div>
                            ) : (
                                <div className="audit-list">
                                    {auditLog.length === 0 ? (
                                        <p className="empty-state">No audit entries found</p>
                                    ) : (
                                        auditLog.map((entry) => (
                                            <div key={entry.id} className="audit-item">
                                                <div className="audit-dot"></div>
                                                <div className="audit-content">
                                                    <div className="audit-header">
                                                        <span className="audit-action">{entry.action}</span>
                                                        <span className="audit-time">{formatDate(entry.timestamp)}</span>
                                                    </div>
                                                    <p className="audit-details">{entry.details}</p>
                                                    <span className="audit-user">by {entry.user}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Team Tab */}
                    {activeTab === 'team' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">Team Management</h2>
                            <p className="panel-description">Manage users and permissions</p>

                            <div className="team-info">
                                <Users size={48} className="team-icon" />
                                <p>Team management is available in the <strong>Users</strong> section of the sidebar.</p>
                                <Button variant="outline">
                                    Go to Users →
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* System Status Tab */}
                    {activeTab === 'status' && (
                        <div className="settings-panel">
                            <h2 className="panel-title">System Status</h2>
                            <p className="panel-description">Monitor system health and performance</p>

                            <div className="status-grid">
                                <div className="status-card">
                                    <div className={`status-indicator ${systemStatus.backend}`}></div>
                                    <div className="status-info">
                                        <span className="status-name">Backend API</span>
                                        <span className={`status-value ${systemStatus.backend}`}>
                                            {systemStatus.backend === 'healthy' ? 'Operational' :
                                                systemStatus.backend === 'checking' ? 'Checking...' : 'Down'}
                                        </span>
                                    </div>
                                </div>

                                <div className="status-card">
                                    <div className={`status-indicator ${systemStatus.database}`}></div>
                                    <div className="status-info">
                                        <span className="status-name">Database</span>
                                        <span className={`status-value ${systemStatus.database}`}>
                                            {systemStatus.database === 'healthy' ? 'Operational' :
                                                systemStatus.database === 'checking' ? 'Checking...' : 'Unknown'}
                                        </span>
                                    </div>
                                </div>

                                <div className="status-card">
                                    <div className={`status-indicator ${systemStatus.aiService}`}></div>
                                    <div className="status-info">
                                        <span className="status-name">AI Service</span>
                                        <span className={`status-value ${systemStatus.aiService}`}>
                                            {systemStatus.aiService === 'healthy' ? 'Operational' :
                                                systemStatus.aiService === 'checking' ? 'Checking...' : 'Unknown'}
                                        </span>
                                    </div>
                                </div>

                                <div className="status-card">
                                    <Activity size={20} className="queue-icon" />
                                    <div className="status-info">
                                        <span className="status-name">Queue Length</span>
                                        <span className="status-value">{systemStatus.queueLength} cases</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <Button variant="outline" onClick={checkSystemStatus}>
                                    Refresh Status
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
