import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Search,
    Download,
    Eye,
    X,
    User,
    Mail,
    Calendar,
    FileText,
    CheckCircle,
    AlertCircle,
    Clock,
    MessageSquare,
    Save
} from 'lucide-react';
import { Button } from './ui/button';
import './CitizenManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CitizenManagement = () => {
    const [citizens, setCitizens] = useState([]);
    const [filteredCitizens, setFilteredCitizens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCitizen, setSelectedCitizen] = useState(null);
    const [citizenCases, setCitizenCases] = useState([]);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [notes, setNotes] = useState({});
    const [loadingCases, setLoadingCases] = useState(false);
    const { getAuthToken } = useAuth();

    // Fetch all citizens (aggregated from cases)
    const fetchCitizens = async () => {
        try {
            setLoading(true);
            const token = getAuthToken();
            const config = { headers: { Authorization: `Bearer ${token}` } };

            const response = await axios.get(`${API_URL}/admin/citizens`, config);
            const citizenData = response.data.citizens || [];
            setCitizens(citizenData);
            setFilteredCitizens(citizenData);
        } catch (err) {
            console.error('Error fetching citizens:', err);
            // Fallback: aggregate from existing case data
            try {
                const [pending, hitl, completed] = await Promise.all([
                    axios.get(`${API_URL}/admin/pending-cases`),
                    axios.get(`${API_URL}/admin/hitl-cases`),
                    axios.get(`${API_URL}/admin/completed-cases`)
                ]);

                const allCases = [
                    ...(pending.data.cases || []),
                    ...(hitl.data.cases || []),
                    ...(completed.data.cases || [])
                ];

                // Aggregate by email
                const citizenMap = {};
                allCases.forEach(c => {
                    const email = c.email;
                    if (!citizenMap[email]) {
                        citizenMap[email] = {
                            email,
                            name: c.citizen_name || 'Unknown',
                            totalCases: 0,
                            completedCases: 0,
                            pendingCases: 0,
                            lastActivity: c.submitted_at,
                            verified: c.status === 'CLOSED'
                        };
                    }
                    citizenMap[email].totalCases++;
                    if (c.status === 'CLOSED') citizenMap[email].completedCases++;
                    else citizenMap[email].pendingCases++;

                    if (new Date(c.submitted_at) > new Date(citizenMap[email].lastActivity)) {
                        citizenMap[email].lastActivity = c.submitted_at;
                    }
                    if (c.status === 'CLOSED') citizenMap[email].verified = true;
                });

                const citizenList = Object.values(citizenMap);
                setCitizens(citizenList);
                setFilteredCitizens(citizenList);
            } catch (fallbackErr) {
                console.error('Fallback failed:', fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    };

    // Fetch cases for a specific citizen
    const fetchCitizenCases = async (email) => {
        setLoadingCases(true);
        try {
            const [pending, hitl, completed] = await Promise.all([
                axios.get(`${API_URL}/admin/pending-cases`),
                axios.get(`${API_URL}/admin/hitl-cases`),
                axios.get(`${API_URL}/admin/completed-cases`)
            ]);

            const allCases = [
                ...(pending.data.cases || []),
                ...(hitl.data.cases || []),
                ...(completed.data.cases || [])
            ].filter(c => c.email === email);

            setCitizenCases(allCases.sort((a, b) =>
                new Date(b.submitted_at) - new Date(a.submitted_at)
            ));
        } catch (err) {
            console.error('Error fetching citizen cases:', err);
        } finally {
            setLoadingCases(false);
        }
    };

    useEffect(() => {
        fetchCitizens();
    }, []);

    // Search filter
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredCitizens(citizens);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredCitizens(citizens.filter(c =>
                c.name?.toLowerCase().includes(query) ||
                c.email?.toLowerCase().includes(query)
            ));
        }
    }, [searchQuery, citizens]);

    // Open citizen profile modal
    const handleViewProfile = (citizen) => {
        setSelectedCitizen(citizen);
        setProfileModalOpen(true);
        fetchCitizenCases(citizen.email);
    };

    // Export to CSV
    const handleExportCSV = () => {
        const headers = ['Name', 'Email', 'Total Cases', 'Completed', 'Pending', 'Last Activity', 'Verified'];
        const rows = filteredCitizens.map(c => [
            c.name,
            c.email,
            c.totalCases,
            c.completedCases,
            c.pendingCases,
            formatDate(c.lastActivity),
            c.verified ? 'Yes' : 'No'
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `citizens_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Save notes for a citizen
    const handleSaveNotes = (email) => {
        // Notes are stored in local state for demo
        // In production, this would call an API endpoint
        console.log(`Notes saved for ${email}:`, notes[email]);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const mapStatus = (status) => {
        switch (status) {
            case 'PENDING': return { label: 'Pending', class: 'status-pending' };
            case 'PENDING_REVIEW': return { label: 'Review', class: 'status-review' };
            case 'WAITING_FOR_HUMAN': return { label: 'HITL', class: 'status-review' };
            case 'CLOSED': return { label: 'Completed', class: 'status-completed' };
            default: return { label: status, class: 'status-pending' };
        }
    };

    if (loading) {
        return (
            <div className="citizen-loading">
                <div className="loading-spinner"></div>
                <p>Loading citizens...</p>
            </div>
        );
    }

    return (
        <div className="citizen-management-container">
            {/* Header */}
            <div className="citizen-header">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Citizens</h1>
                    <p className="text-muted-foreground">Manage citizen profiles and case history</p>
                </div>
                <div className="citizen-actions">
                    <div className="citizen-search">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="export-btn" onClick={handleExportCSV}>
                        <Download size={16} />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="citizen-stats">
                <div className="stat-card">
                    <User className="stat-icon text-blue-500" />
                    <div>
                        <p className="stat-number">{citizens.length}</p>
                        <p className="stat-label">Total Citizens</p>
                    </div>
                </div>
                <div className="stat-card">
                    <CheckCircle className="stat-icon text-green-500" />
                    <div>
                        <p className="stat-number">{citizens.filter(c => c.verified).length}</p>
                        <p className="stat-label">Verified</p>
                    </div>
                </div>
                <div className="stat-card">
                    <FileText className="stat-icon text-purple-500" />
                    <div>
                        <p className="stat-number">{citizens.reduce((sum, c) => sum + c.totalCases, 0)}</p>
                        <p className="stat-label">Total Cases</p>
                    </div>
                </div>
            </div>

            {/* Citizens Table */}
            <div className="admin-card">
                <table className="clean-table citizen-table">
                    <thead>
                        <tr>
                            <th>Citizen</th>
                            <th>Email</th>
                            <th>Cases</th>
                            <th>Last Activity</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCitizens.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-muted-foreground">
                                    No citizens found
                                </td>
                            </tr>
                        ) : (
                            filteredCitizens.map((citizen) => (
                                <tr key={citizen.email} className="hover:bg-slate-50 transition-colors">
                                    <td>
                                        <div className="citizen-info">
                                            <div className="citizen-avatar">
                                                {citizen.name?.charAt(0)?.toUpperCase() || 'U'}
                                            </div>
                                            <span className="citizen-name">{citizen.name || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="text-muted-foreground">{citizen.email}</td>
                                    <td>
                                        <div className="case-counts">
                                            <span className="case-total">{citizen.totalCases} total</span>
                                            <span className="case-breakdown">
                                                {citizen.completedCases} completed, {citizen.pendingCases} pending
                                            </span>
                                        </div>
                                    </td>
                                    <td className="text-muted-foreground">{formatDate(citizen.lastActivity)}</td>
                                    <td>
                                        {citizen.verified ? (
                                            <span className="verification-badge verified">
                                                <CheckCircle size={14} />
                                                Verified
                                            </span>
                                        ) : (
                                            <span className="verification-badge unverified">
                                                <Clock size={14} />
                                                Pending
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="view-profile-btn"
                                            onClick={() => handleViewProfile(citizen)}
                                        >
                                            <Eye size={18} />
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Citizen Profile Modal */}
            {profileModalOpen && selectedCitizen && (
                <div className="modal-overlay" onClick={() => setProfileModalOpen(false)}>
                    <div className="modal-content citizen-profile-modal" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="modal-header profile-header">
                            <div className="profile-header-info">
                                <div className="profile-avatar-large">
                                    {selectedCitizen.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedCitizen.name}</h2>
                                    <p className="text-white/80">{selectedCitizen.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedCitizen.verified ? (
                                    <span className="badge-verified">✓ Verified Citizen</span>
                                ) : (
                                    <span className="badge-pending">Verification Pending</span>
                                )}
                                <button onClick={() => setProfileModalOpen(false)} className="close-btn">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="modal-body profile-body">
                            {/* Stats Row */}
                            <div className="profile-stats">
                                <div className="profile-stat-card">
                                    <FileText className="w-5 h-5 text-[#0066cc]" />
                                    <div>
                                        <p className="stat-value">{selectedCitizen.totalCases}</p>
                                        <p className="stat-label">Total Cases</p>
                                    </div>
                                </div>
                                <div className="profile-stat-card">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <div>
                                        <p className="stat-value">{selectedCitizen.completedCases}</p>
                                        <p className="stat-label">Completed</p>
                                    </div>
                                </div>
                                <div className="profile-stat-card">
                                    <Clock className="w-5 h-5 text-orange-500" />
                                    <div>
                                        <p className="stat-value">{selectedCitizen.pendingCases}</p>
                                        <p className="stat-label">Pending</p>
                                    </div>
                                </div>
                                <div className="profile-stat-card">
                                    <Calendar className="w-5 h-5 text-purple-500" />
                                    <div>
                                        <p className="stat-value">{formatDate(selectedCitizen.lastActivity)}</p>
                                        <p className="stat-label">Last Activity</p>
                                    </div>
                                </div>
                            </div>

                            {/* Notes Section */}
                            <div className="profile-section">
                                <h3 className="section-title">
                                    <MessageSquare size={18} />
                                    Internal Notes
                                </h3>
                                <div className="notes-container">
                                    <textarea
                                        placeholder="Add internal notes about this citizen..."
                                        value={notes[selectedCitizen.email] || ''}
                                        onChange={(e) => setNotes({
                                            ...notes,
                                            [selectedCitizen.email]: e.target.value
                                        })}
                                        className="notes-textarea"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="save-notes-btn"
                                        onClick={() => handleSaveNotes(selectedCitizen.email)}
                                    >
                                        <Save size={14} />
                                        Save Notes
                                    </Button>
                                </div>
                            </div>

                            {/* Case History */}
                            <div className="profile-section">
                                <h3 className="section-title">
                                    <FileText size={18} />
                                    Case History
                                </h3>
                                {loadingCases ? (
                                    <div className="cases-loading">Loading cases...</div>
                                ) : citizenCases.length === 0 ? (
                                    <p className="no-cases">No cases found for this citizen</p>
                                ) : (
                                    <div className="case-history-list">
                                        {citizenCases.map((caseItem) => {
                                            const status = mapStatus(caseItem.status);
                                            return (
                                                <div key={caseItem.case_id} className="case-history-item">
                                                    <div className="case-history-main">
                                                        <span className="case-id">AC-{caseItem.case_id}</span>
                                                        <span className={`status-badge ${status.class}`}>
                                                            <span className="dot"></span>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <div className="case-history-details">
                                                        <span className="case-address" title={caseItem.new_address_raw}>
                                                            → {caseItem.new_address_raw?.substring(0, 40)}...
                                                        </span>
                                                        <span className="case-date">{formatDate(caseItem.submitted_at)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CitizenManagement;
