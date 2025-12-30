// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import TerminalWidget from '../components/TerminalWidget';
import UserManagement from '../components/UserManagement';
import './AdminDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function AdminDashboard() {
    const { t } = useLanguage();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Navigation state
    const [activeNav, setActiveNav] = useState('dashboard');
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);

    // Data state
    const [pendingCases, setPendingCases] = useState([]);
    const [hitlCases, setHitlCases] = useState([]);
    const [completedCases, setCompletedCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [processingCase, setProcessingCase] = useState(null);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedCase, setSelectedCase] = useState(null);

    // HITL state
    const [correctingCase, setCorrectingCase] = useState(null);
    const [correctedAddresses, setCorrectedAddresses] = useState({});

    // Search / filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Document preview modal state
    const [docPreviewOpen, setDocPreviewOpen] = useState(false);
    const [previewDocs, setPreviewDocs] = useState({ landlord: null, address: null });
    const [previewCaseId, setPreviewCaseId] = useState(null);
    const [activeDocTab, setActiveDocTab] = useState('both'); // 'both', 'landlord', 'address'

    // Case detail modal state (for completed cases)
    const [caseDetailOpen, setCaseDetailOpen] = useState(false);
    const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    // HITL Review Modal state (for cases needing human review)
    const [hitlModalOpen, setHitlModalOpen] = useState(false);
    const [hitlCase, setHitlCase] = useState(null);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);

    // AI Brain Modal state
    const [aiBrainOpen, setAiBrainOpen] = useState(false);
    const [correctedAddressInput, setCorrectedAddressInput] = useState('');
    const [submittingCorrection, setSubmittingCorrection] = useState(false);

    // Analytics Dashboard state
    const [analyticsOpen, setAnalyticsOpen] = useState(false);

    // Helper to get PDF URL from path
    const getPdfUrl = (path) => {
        if (!path) return null;
        // Extract just the filename from the full path
        const filename = path.split('/').pop();
        return `${API_URL}/uploads/${filename}`;
    };

    // Open document preview modal
    const handlePreviewDocs = (caseItem) => {
        setPreviewDocs({
            landlord: getPdfUrl(caseItem.pdf_landlord_path),
            address: getPdfUrl(caseItem.pdf_address_change_path)
        });
        setPreviewCaseId(caseItem.case_id);
        setActiveDocTab('both');
        setDocPreviewOpen(true);
    };

    // Open case detail modal with audit logs
    const handleViewCaseDetail = async (caseItem) => {
        setSelectedCaseDetail(caseItem);
        setCaseDetailOpen(true);
        setLoadingAudit(true);
        setAuditLogs([]);

        try {
            const res = await axios.get(`${API_URL}/cases/${encodeURIComponent(caseItem.case_id)}/audit`);
            setAuditLogs(res.data.entries || []);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
            setAuditLogs([]);
        } finally {
            setLoadingAudit(false);
        }
    };

    // Calculate processing time
    const calculateProcessingTime = (submittedAt, lastAuditTime) => {
        if (!submittedAt) return 'N/A';
        const start = new Date(submittedAt);
        const end = lastAuditTime ? new Date(lastAuditTime) : new Date();
        const diffMs = end - start;

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    };

    // Lock body scroll when modals are open
    useEffect(() => {
        if (docPreviewOpen || caseDetailOpen || hitlModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [docPreviewOpen, caseDetailOpen, hitlModalOpen]);

    // --- API calls ------------------------------------------------------

    const fetchPendingCases = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/pending-cases`);
            setPendingCases(res.data.cases || []);
        } catch (err) {
            console.error('Error fetching pending cases:', err);
        }
    };

    const fetchHitlCases = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/hitl-cases`);
            setHitlCases(res.data.cases || []);
        } catch (err) {
            console.error('Error fetching HITL cases:', err);
        }
    };

    const fetchCompletedCases = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/completed-cases`);
            setCompletedCases(res.data.cases || []);
        } catch (err) {
            console.error('Error fetching completed cases:', err);
        }
    };

    const fetchAllCases = async () => {
        setLoading(true);
        await Promise.all([fetchPendingCases(), fetchHitlCases(), fetchCompletedCases()]);
        setLoading(false);
    };

    useEffect(() => {
        fetchAllCases();
        const interval = setInterval(fetchAllCases, 10000);
        return () => clearInterval(interval);
    }, []);

    // --- Helpers --------------------------------------------------------

    const getFilteredCases = () => {
        let cases = [];
        if (filterStatus === 'pending') cases = pendingCases;
        else if (filterStatus === 'review') cases = hitlCases;
        else if (filterStatus === 'completed') cases = completedCases;
        else cases = [...pendingCases, ...hitlCases]; // default: open work

        if (searchQuery) {
            cases = cases.filter(c =>
                c.case_id?.toString().includes(searchQuery) ||
                c.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return cases;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING_REVIEW': return 'bg-warning text-dark';
            case 'PENDING': return 'bg-primary';
            case 'PROCESSING': return 'bg-info';
            case 'WAITING_FOR_HUMAN': return 'bg-danger';
            case 'CLOSED': return 'bg-success';
            case 'ERROR': return 'bg-danger';
            default: return 'bg-secondary';
        }
    };

    const getStatusDisplay = (status) => {
        if (status === 'WAITING_FOR_HUMAN') return 'Needs HITL Review';
        if (status === 'PENDING_REVIEW') return 'Pending Review';
        if (status === 'PROCESSING') return 'Auto-Processing';
        return status || 'N/A';
    };

    const filteredCases = getFilteredCases();

    // --- Actions --------------------------------------------------------

    const handleApprove = async (caseId) => {
        if (!window.confirm(`Approve case ${caseId}? This will trigger OCR and workflow processing.`)) return;

        setProcessingCase(caseId);
        setMessage(`⏳ Processing started for Case ID: ${caseId}`);

        try {
            await axios.post(`${API_URL}/admin/approve-case/${caseId}`);

            const pollInterval = setInterval(async () => {
                await fetchAllCases();
                const all = [...pendingCases, ...hitlCases, ...completedCases];
                const current = all.find(c => c.case_id === caseId);

                if (current) {
                    if (current.status === 'CLOSED') {
                        setMessage(`✅ Case ${caseId} completed successfully!`);
                        clearInterval(pollInterval);
                        setProcessingCase(null);
                    } else if (current.status === 'WAITING_FOR_HUMAN') {
                        setMessage(`⚠️ Case ${caseId} needs review`);
                        clearInterval(pollInterval);
                        setProcessingCase(null);
                    } else if (current.status === 'ERROR') {
                        setMessage(`❌ Case ${caseId} failed`);
                        clearInterval(pollInterval);
                        setProcessingCase(null);
                    }
                }
            }, 5000);

            setTimeout(() => {
                clearInterval(pollInterval);
                setProcessingCase(null);
            }, 300000);
        } catch (err) {
            setMessage(`❌ Failed to approve: ${err.response?.data?.detail || err.message}`);
            setProcessingCase(null);
        }
    };

    const handleResolveHitl = async (caseId) => {
        const correctedAddress = correctedAddresses[caseId];
        if (!correctedAddress?.trim()) {
            window.alert('Please enter a corrected address');
            return;
        }
        if (!window.confirm(`Correct address to: "${correctedAddress}" and resume?`)) return;

        setCorrectingCase(caseId);
        try {
            const formData = new FormData();
            formData.append('corrected_address', correctedAddress);
            await axios.post(`${API_URL}/admin/resolve-hitl/${caseId}`, formData);
            setMessage(`✅ Case ${caseId} corrected and resumed`);
            setCorrectedAddresses(prev => ({ ...prev, [caseId]: '' }));
            fetchAllCases();
        } catch (err) {
            setMessage(`❌ Error: ${err.response?.data?.detail || 'Failed'}`);
        } finally {
            setCorrectingCase(null);
        }
    };

    const handleViewCase = (caseItem) => {
        setSelectedCase(caseItem);
        setDrawerOpen(true);
    };

    // Open HITL Review Modal with AI Analysis
    const handleOpenHitlReview = async (caseItem) => {
        setHitlCase(caseItem);
        setHitlModalOpen(true);
        setLoadingAi(true);
        setAiAnalysis(null);
        setCorrectedAddressInput('');

        try {
            const res = await axios.get(`${API_URL}/case/${encodeURIComponent(caseItem.case_id)}/ai-analysis`);
            setAiAnalysis(res.data);
            // Pre-fill the input with AI suggestion
            if (res.data.suggested_address) {
                setCorrectedAddressInput(res.data.suggested_address);
            }
        } catch (err) {
            console.error('Failed to fetch AI analysis:', err);
            setAiAnalysis({
                error_explanation: 'Failed to load AI analysis. Please review manually.',
                issues_found: ['Unable to connect to AI service'],
                suggested_address: caseItem.new_address_raw || '',
                confidence: 'low'
            });
            setCorrectedAddressInput(caseItem.new_address_raw || '');
        } finally {
            setLoadingAi(false);
        }
    };

    // Close HITL Modal
    const handleCloseHitlModal = () => {
        setHitlModalOpen(false);
        setHitlCase(null);
        setAiAnalysis(null);
        setCorrectedAddressInput('');
    };

    // Submit correction and resume workflow
    const handleSubmitCorrection = async () => {
        if (!correctedAddressInput.trim()) {
            setMessage('❌ Please enter a corrected address');
            return;
        }
        if (!window.confirm(`Approve address: "${correctedAddressInput}"?\n\nThis will resume the automation workflow.`)) {
            return;
        }

        setSubmittingCorrection(true);
        try {
            const formData = new FormData();
            formData.append('corrected_address', correctedAddressInput);
            await axios.post(`${API_URL}/admin/resolve-hitl/${encodeURIComponent(hitlCase.case_id)}`, formData);
            setMessage(`✅ Case ${hitlCase.case_id} approved with corrected address. Workflow resumed.`);
            handleCloseHitlModal();
            fetchAllCases();
        } catch (err) {
            setMessage(`❌ Error: ${err.response?.data?.detail || 'Failed to submit correction'}`);
        } finally {
            setSubmittingCorrection(false);
        }
    };

    // -------------------------------------------------------------------

    return (
        <div className="admin-dashboard-root">
            {/* Government Banner */}
            <div className="admin-gov-banner">
                <div className="gov-banner-left">
                    <span className="gov-flag">🇩🇪</span>
                    <span>An official website of the Federal Republic of Germany</span>
                </div>
            </div>

            {/* SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <div className="sidebar-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                            </svg>
                        </div>
                        <div className="sidebar-brand-text">
                            <span className="brand-name">Bürgerportal</span>
                            <span className="brand-subtitle">Admin Panel</span>
                        </div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    <button
                        className={`sidebar-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveNav('dashboard')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        <span>Dashboard</span>
                    </button>
                    <button
                        className={`sidebar-nav-item ${activeNav === 'cases' ? 'active' : ''}`}
                        onClick={() => setActiveNav('cases')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>Cases</span>
                    </button>
                    <button
                        className={`sidebar-nav-item ${activeNav === 'citizens' ? 'active' : ''}`}
                        onClick={() => setActiveNav('citizens')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>Citizens</span>
                    </button>
                    <button
                        className={`sidebar-nav-item ${activeNav === 'analytics' ? 'active' : ''}`}
                        onClick={() => { setActiveNav('analytics'); setAnalyticsOpen(true); }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        <span>Analytics</span>
                    </button>
                    <button
                        className={`sidebar-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveNav('settings')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        <span>Settings</span>
                    </button>
                    {/* Show Users tab ONLY for Real Admins (Not distinct users, and Not Demo Admin) */}
                    {user && user.role === 'admin' && user.id !== 999999 && (
                        <button
                            className={`sidebar-nav-item ${activeNav === 'users' ? 'active' : ''}`}
                            onClick={() => setActiveNav('users')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span>Users</span>
                        </button>
                    )}
                </nav>
                <div className="sidebar-footer">
                    <button className="sidebar-signout" onClick={() => { logout(); navigate('/login'); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* MAIN WRAPPER */}
            <div className="admin-main-wrapper">
                {/* TOP HEADER */}
                <header className="admin-top-header">
                    <div className="header-search">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search cases, citizens..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="header-actions">
                        <button className="header-notification">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            {hitlCases.length > 0 && <span className="notification-badge"></span>}
                        </button>
                        <div className="header-user">
                            <button
                                className="user-dropdown-trigger"
                                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                            >
                                <span className="user-avatar">AD</span>
                                <span className="user-name">Admin</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            {userDropdownOpen && (
                                <div className="user-dropdown-menu">
                                    <button onClick={() => setUserDropdownOpen(false)}>Profile</button>
                                    <button onClick={() => setUserDropdownOpen(false)}>Settings</button>
                                    <button className="signout-option" onClick={() => { logout(); navigate('/login'); }}>Sign Out</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* MAIN CONTENT */}
                <main className="page-content">
                    <div className="container-fluid">
                        {activeNav === 'users' ? (
                            <UserManagement />
                        ) : (
                            <>

                                {/* PAGE HEADER */}
                                <div className="dashboard-header">
                                    <div className="dashboard-title-section">
                                        <h1>Dashboard</h1>
                                        <p>Address Change Automation Overview</p>
                                    </div>
                                    <div className="dashboard-actions">
                                        <button
                                            className="btn-analytics"
                                            onClick={() => setAnalyticsOpen(true)}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="20" x2="18" y2="10" />
                                                <line x1="12" y1="20" x2="12" y2="4" />
                                                <line x1="6" y1="20" x2="6" y2="14" />
                                            </svg>
                                            Analytics
                                        </button>
                                        <button
                                            className="btn-ai-brain"
                                            onClick={() => setAiBrainOpen(true)}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" />
                                                <path d="M12 16v-4" />
                                                <path d="M12 8h.01" />
                                            </svg>
                                            AI Brain
                                        </button>
                                    </div>
                                </div>

                                {/* ALERT MESSAGE */}
                                {message && (
                                    <div className="alert-container">
                                        <div
                                            className={`alert ${message.includes('✅')
                                                ? 'alert-success'
                                                : message.includes('⏳')
                                                    ? 'alert-info'
                                                    : 'alert-warning'
                                                } alert-dismissible fade show mb-0`}
                                        >
                                            {message}
                                            <button
                                                type="button"
                                                className="btn-close"
                                                onClick={() => setMessage('')}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* SUMMARY CARDS */}
                                <div className="stats-grid">
                                    {/* Pending */}
                                    <div
                                        className={`stat-card stat-pending ${filterStatus === 'pending' ? 'active' : ''}`}
                                        onClick={() => setFilterStatus(filterStatus === 'pending' ? '' : 'pending')}
                                    >
                                        <div className="stat-content">
                                            <span className="stat-label">Pending Cases</span>
                                            <span className="stat-value">{pendingCases.length}</span>
                                            <span className="stat-trend">↗ +3 today</span>
                                        </div>
                                        <div className="stat-icon pending">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Needs Review */}
                                    <div
                                        className={`stat-card stat-review ${filterStatus === 'review' ? 'active' : ''}`}
                                        onClick={() => setFilterStatus(filterStatus === 'review' ? '' : 'review')}
                                    >
                                        <div className="stat-content">
                                            <span className="stat-label">Needs Review</span>
                                            <span className="stat-value">{hitlCases.length}</span>
                                            <span className="stat-trend warning">↗ 2 urgent</span>
                                        </div>
                                        <div className="stat-icon review">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                                <line x1="12" y1="9" x2="12" y2="13" />
                                                <line x1="12" y1="17" x2="12.01" y2="17" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Completed */}
                                    <div
                                        className={`stat-card stat-completed ${filterStatus === 'completed' ? 'active' : ''}`}
                                        onClick={() => setFilterStatus(filterStatus === 'completed' ? '' : 'completed')}
                                    >
                                        <div className="stat-content">
                                            <span className="stat-label">Completed</span>
                                            <span className="stat-value">{completedCases.length}</span>
                                            <span className="stat-trend success">↗ +18 this week</span>
                                        </div>
                                        <div className="stat-icon completed">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                <polyline points="22 4 12 14.01 9 11.01" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Avg Processing */}
                                    <div className="stat-card stat-time">
                                        <div className="stat-content">
                                            <span className="stat-label">Avg. Processing</span>
                                            <span className="stat-value">2.4h</span>
                                            <span className="stat-trend success">↘ -12% faster</span>
                                        </div>
                                        <div className="stat-icon time">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 16 14" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* MAIN CONTENT ROW */}
                                <div className="content-row">
                                    {/* CASES TABLE */}
                                    <div className="cases-section">
                                        <div className="section-header">
                                            <h2>Recent Cases</h2>
                                            <button className="view-all-btn" onClick={() => setFilterStatus('')}>
                                                View All →
                                            </button>
                                        </div>
                                        <div className="cases-table">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>CASE ID</th>
                                                        <th>CITIZEN</th>
                                                        <th>SUBMITTED</th>
                                                        <th>STATUS</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredCases.length === 0 ? (
                                                        <tr className="empty-row">
                                                            <td colSpan={5}>
                                                                <div className="empty-state">
                                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                                        <polyline points="22,6 12,13 2,6" />
                                                                    </svg>
                                                                    <p>No cases at the moment</p>
                                                                    <span>New submissions will appear here</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredCases.slice(0, 5).map((caseItem) => (
                                                            <tr key={caseItem.case_id}>
                                                                <td className="case-id">AC-{caseItem.case_id}</td>
                                                                <td className="citizen-info">
                                                                    <span className="citizen-name">{caseItem.citizen_name || 'Unknown'}</span>
                                                                    <span className="citizen-email">{caseItem.email}</span>
                                                                </td>
                                                                <td className="submitted-date">
                                                                    {formatDate(caseItem.submitted_at)}
                                                                </td>
                                                                <td>
                                                                    <span className={`status-badge status-${caseItem.status?.toLowerCase().replace('_', '-')}`}>
                                                                        <span className="status-dot"></span>
                                                                        {getStatusDisplay(caseItem.status)}
                                                                    </span>
                                                                </td>
                                                                <td className="actions-cell">
                                                                    <button
                                                                        className="action-btn"
                                                                        onClick={() => {
                                                                            if (caseItem.status === 'CLOSED') {
                                                                                handleViewCaseDetail(caseItem);
                                                                            } else if (caseItem.status === 'WAITING_FOR_HUMAN') {
                                                                                handleOpenHitlReview(caseItem);
                                                                            } else {
                                                                                handleViewCase(caseItem);
                                                                            }
                                                                        }}
                                                                        title="View"
                                                                    >
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                            <circle cx="12" cy="12" r="3" />
                                                                        </svg>
                                                                    </button>
                                                                    {(caseItem.pdf_landlord_path || caseItem.pdf_address_change_path) && (
                                                                        <button
                                                                            className="action-btn"
                                                                            onClick={() => handlePreviewDocs(caseItem)}
                                                                            title="Documents"
                                                                        >
                                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                                                <polyline points="14 2 14 8 20 8" />
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                    <button className="action-btn" title="More">
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <circle cx="12" cy="12" r="1" />
                                                                            <circle cx="19" cy="12" r="1" />
                                                                            <circle cx="5" cy="12" r="1" />
                                                                        </svg>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* SIDEBAR CARDS */}
                                    <div className="sidebar-cards">
                                        {/* Processing Guidelines */}
                                        <div className="guidelines-card">
                                            <h3>Processing Guidelines</h3>
                                            <ul className="guidelines-list">
                                                <li>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                    Verify uploaded documents are readable and complete
                                                </li>
                                                <li>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                    Confirm old and new addresses are plausible
                                                </li>
                                                <li>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                    Mark low-confidence cases for manual review
                                                </li>
                                                <li>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                    Complete processing within 48 hours
                                                </li>
                                            </ul>
                                        </div>

                                        {/* Success Rate Card */}
                                        <div className="success-card">
                                            <span className="success-label">This Month</span>
                                            <span className="success-value">94.2%</span>
                                            <span className="success-subtitle">Automation Success Rate</span>
                                            <div className="success-bar">
                                                <div className="success-fill" style={{ width: '94.2%' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>

            {/* FOOTER */}
            <footer className="admin-footer">
                <div className="admin-footer-content">
                    <div className="admin-footer-links">
                        <a href="#">{t('imprint')}</a>
                        <a href="#">{t('dataProtection')}</a>
                        <a href="#">{t('accessibility')}</a>
                        <a href="#">{t('termsOfUse')}</a>
                    </div>
                    <div className="admin-footer-copy">{t('copyright')}</div>
                </div>
            </footer>

            {/* CASE DETAIL DRAWER */}
            <aside className={`case-detail-drawer ${drawerOpen ? 'active' : ''}`}>
                <div
                    className="case-detail-drawer-backdrop"
                    onClick={() => setDrawerOpen(false)}
                />
                <div className="case-detail-panel">
                    <div className="case-detail-header d-flex justify-content-between align-items-center">
                        <div>
                            <h3 className="h5 mb-1">
                                Case AC-{selectedCase?.case_id ?? '–'}
                            </h3>
                            <p className="text-muted small mb-0">
                                Submitted on {formatDate(selectedCase?.submitted_at)}
                            </p>
                        </div>
                        <div className="text-end">
                            <span
                                className={`badge ${getStatusBadge(
                                    selectedCase?.status
                                )} mb-2`}
                            >
                                {getStatusDisplay(selectedCase?.status)}
                            </span>
                            <br />
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary btn-close-detail"
                                onClick={() => setDrawerOpen(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    <div className="case-detail-body">
                        {/* Citizen info */}
                        <section className="mb-3">
                            <h4 className="h6 mb-2">Citizen information</h4>
                            <dl className="row small mb-0">
                                <dt className="col-4 text-muted">E-mail</dt>
                                <dd className="col-8">{selectedCase?.email || 'N/A'}</dd>

                                <dt className="col-4 text-muted">Name</dt>
                                <dd className="col-8">
                                    {selectedCase?.citizen_name || 'N/A'}
                                </dd>

                                <dt className="col-4 text-muted">Case ID</dt>
                                <dd className="col-8">
                                    AC-{selectedCase?.case_id ?? '–'}
                                </dd>
                            </dl>
                        </section>

                        {/* Address info */}
                        <section className="mb-3">
                            <h4 className="h6 mb-2">Address information</h4>
                            <dl className="row small mb-0">
                                <dt className="col-4 text-muted">New address</dt>
                                <dd className="col-8">
                                    {selectedCase?.canonical_address ||
                                        selectedCase?.new_address_raw ||
                                        'Pending extraction'}
                                </dd>
                            </dl>
                        </section>

                        {/* HITL correction */}
                        {selectedCase?.status === 'WAITING_FOR_HUMAN' && (
                            <section className="mb-3">
                                <h4 className="h6 mb-2">Correction required</h4>
                                <div className="alert alert-warning small py-2">
                                    <i className="bi bi-exclamation-triangle me-1" />
                                    Low confidence detected. Please verify and correct the
                                    address.
                                </div>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Enter correct address..."
                                    value={correctedAddresses[selectedCase?.case_id] || ''}
                                    onChange={(e) =>
                                        setCorrectedAddresses((prev) => ({
                                            ...prev,
                                            [selectedCase?.case_id]: e.target.value
                                        }))
                                    }
                                />
                            </section>
                        )}
                    </div>

                    <div className="case-detail-footer d-flex justify-content-between align-items-center">
                        <div className="small text-muted">
                            All actions are logged for audit purposes.
                        </div>
                        <div className="d-flex gap-2">
                            {selectedCase?.status === 'PENDING' && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-success"
                                    onClick={() => {
                                        handleApprove(selectedCase.case_id);
                                        setDrawerOpen(false);
                                    }}
                                >
                                    Approve
                                </button>
                            )}
                            {selectedCase?.status === 'WAITING_FOR_HUMAN' && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-success"
                                    onClick={() => {
                                        handleResolveHitl(selectedCase.case_id);
                                        setDrawerOpen(false);
                                    }}
                                    disabled={correctingCase === selectedCase?.case_id}
                                >
                                    {correctingCase === selectedCase?.case_id
                                        ? 'Saving...'
                                        : 'Correct & Resume'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </aside >

            {/* DOCUMENT PREVIEW MODAL */}
            {
                docPreviewOpen && (
                    <div className="doc-preview-overlay">
                        <div className="doc-preview-modal">
                            <div className="doc-preview-header">
                                <h4 className="mb-0">
                                    <i className="bi bi-file-earmark-pdf me-2" />
                                    Documents for {previewCaseId}
                                </h4>
                                <div className="doc-preview-tabs">
                                    <button
                                        className={`doc-tab-btn ${activeDocTab === 'both' ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab('both')}
                                    >
                                        <i className="bi bi-layout-split me-1" />
                                        Side by Side
                                    </button>
                                    <button
                                        className={`doc-tab-btn ${activeDocTab === 'landlord' ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab('landlord')}
                                    >
                                        <i className="bi bi-house-door me-1" />
                                        Landlord
                                    </button>
                                    <button
                                        className={`doc-tab-btn ${activeDocTab === 'address' ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab('address')}
                                    >
                                        <i className="bi bi-geo-alt me-1" />
                                        Address Form
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light"
                                    onClick={() => setDocPreviewOpen(false)}
                                >
                                    <i className="bi bi-x-lg" /> Close
                                </button>
                            </div>
                            <div className={`doc-preview-body ${activeDocTab !== 'both' ? 'doc-preview-single' : ''}`}>
                                {(activeDocTab === 'both' || activeDocTab === 'landlord') && (
                                    <div className="doc-preview-pane">
                                        <div className="doc-preview-title">
                                            <span>
                                                <i className="bi bi-house-door me-1" />
                                                Landlord Confirmation
                                            </span>
                                            {previewDocs.landlord && (
                                                <a
                                                    href={previewDocs.landlord}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-sm btn-outline-primary doc-open-btn"
                                                >
                                                    <i className="bi bi-box-arrow-up-right me-1" />
                                                    Open Full
                                                </a>
                                            )}
                                        </div>
                                        {previewDocs.landlord ? (
                                            <iframe
                                                src={previewDocs.landlord}
                                                title="Landlord PDF"
                                                className="doc-preview-iframe"
                                            />
                                        ) : (
                                            <div className="doc-preview-placeholder">
                                                <i className="bi bi-file-earmark-x" />
                                                <p>No document available</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {(activeDocTab === 'both' || activeDocTab === 'address') && (
                                    <div className="doc-preview-pane">
                                        <div className="doc-preview-title">
                                            <span>
                                                <i className="bi bi-geo-alt me-1" />
                                                Address Registration Form
                                            </span>
                                            {previewDocs.address && (
                                                <a
                                                    href={previewDocs.address}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-sm btn-outline-primary doc-open-btn"
                                                >
                                                    <i className="bi bi-box-arrow-up-right me-1" />
                                                    Open Full
                                                </a>
                                            )}
                                        </div>
                                        {previewDocs.address ? (
                                            <iframe
                                                src={previewDocs.address}
                                                title="Address PDF"
                                                className="doc-preview-iframe"
                                            />
                                        ) : (
                                            <div className="doc-preview-placeholder">
                                                <i className="bi bi-file-earmark-x" />
                                                <p>No document available</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CASE DETAIL MODAL (for completed cases) */}
            {
                caseDetailOpen && selectedCaseDetail && (
                    <div className="case-detail-overlay">
                        <div className="case-detail-modal">
                            <div className="case-detail-modal-header">
                                <div className="case-detail-title">
                                    <h4 className="mb-0">
                                        <i className="bi bi-folder2-open me-2" />
                                        {selectedCaseDetail.case_id}
                                    </h4>
                                    <span className={`badge ${selectedCaseDetail.status === 'CLOSED' ? 'bg-success' : 'bg-secondary'} ms-2`}>
                                        {selectedCaseDetail.status === 'CLOSED' ? 'Completed' : selectedCaseDetail.status}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light"
                                    onClick={() => setCaseDetailOpen(false)}
                                >
                                    <i className="bi bi-x-lg" /> Close
                                </button>
                            </div>

                            <div className="case-detail-modal-body">
                                {/* Left Column: Case Info */}
                                <div className="case-detail-info">
                                    {/* Submitted On */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-calendar-event me-2" />Submitted On</h5>
                                        <p className="case-info-highlight">
                                            {formatDate(selectedCaseDetail.submitted_at)}
                                        </p>
                                    </div>

                                    {/* Citizen Info */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-person me-2" />Citizen Information</h5>
                                        <dl className="case-info-list">
                                            <dt>Name</dt>
                                            <dd>{selectedCaseDetail.citizen_name || 'N/A'}</dd>
                                            <dt>Email</dt>
                                            <dd>{selectedCaseDetail.email || 'N/A'}</dd>
                                            <dt>Date of Birth</dt>
                                            <dd>{selectedCaseDetail.dob || 'N/A'}</dd>
                                        </dl>
                                    </div>

                                    {/* Landlord Info */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-building me-2" />Landlord Information</h5>
                                        <dl className="case-info-list">
                                            <dt>Landlord Name</dt>
                                            <dd>{selectedCaseDetail.landlord_name || 'N/A'}</dd>
                                            <dt>Move-in Date</dt>
                                            <dd>{selectedCaseDetail.move_in_date_raw || 'N/A'}</dd>
                                        </dl>
                                    </div>

                                    {/* Old Address */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-geo me-2" />Old Address</h5>
                                        <p className="case-address old-address">
                                            {selectedCaseDetail.old_address_raw || 'Not available'}
                                        </p>
                                    </div>

                                    {/* New Address */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-geo-alt-fill me-2" />New Address</h5>
                                        <p className="case-address new-address">
                                            {selectedCaseDetail.canonical_address || selectedCaseDetail.new_address_raw || 'Not available'}
                                        </p>
                                        {selectedCaseDetail.canonical_address && selectedCaseDetail.new_address_raw &&
                                            selectedCaseDetail.canonical_address !== selectedCaseDetail.new_address_raw && (
                                                <p className="text-muted small" style={{ marginTop: '-0.5rem' }}>
                                                    <i className="bi bi-arrow-left-right me-1" />
                                                    Original: {selectedCaseDetail.new_address_raw}
                                                </p>
                                            )}
                                    </div>


                                    {/* Processing Stats */}
                                    <div className="case-info-section case-stats">
                                        <h5><i className="bi bi-speedometer2 me-2" />Processing Stats</h5>
                                        <div className="stat-card">
                                            <span className="stat-label">Total Processing Time</span>
                                            <span className="stat-value">
                                                {calculateProcessingTime(
                                                    selectedCaseDetail.submitted_at,
                                                    auditLogs.length > 0 ? auditLogs[auditLogs.length - 1].timestamp : null
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Audit Log */}
                                <div className="case-detail-audit">
                                    <h5><i className="bi bi-clock-history me-2" />Audit Log Timeline</h5>
                                    {loadingAudit ? (
                                        <div className="audit-loading">
                                            <div className="spinner-border spinner-border-sm me-2" role="status" />
                                            Loading audit log...
                                        </div>
                                    ) : auditLogs.length === 0 ? (
                                        <div className="audit-empty">
                                            <i className="bi bi-inbox" />
                                            <p>No audit entries found</p>
                                        </div>
                                    ) : (
                                        <div className="audit-timeline">
                                            {auditLogs.map((entry, index) => (
                                                <div key={index} className="audit-entry">
                                                    <div className="audit-time">
                                                        {new Date(entry.timestamp).toLocaleString('de-DE', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            second: '2-digit'
                                                        })}
                                                    </div>
                                                    <div className="audit-message">
                                                        {entry.message}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* HITL REVIEW MODAL (AI-powered human review) */}
            {
                hitlModalOpen && hitlCase && (
                    <div className="case-detail-overlay">
                        <div className="case-detail-modal hitl-review-modal">
                            <div className="case-detail-modal-header hitl-header">
                                <div className="case-detail-title">
                                    <h4 className="mb-0">
                                        <i className="bi bi-robot me-2" />
                                        Human Review Required
                                    </h4>
                                    <span className="badge bg-warning text-dark ms-2">
                                        {hitlCase.case_id}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light"
                                    onClick={handleCloseHitlModal}
                                >
                                    <i className="bi bi-x-lg" /> Close
                                </button>
                            </div>

                            <div className="case-detail-modal-body">
                                {/* Left Column: Case Info */}
                                <div className="case-detail-info">
                                    {/* Submitted On */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-calendar-event me-2" />Submitted On</h5>
                                        <p className="case-info-highlight">
                                            {aiAnalysis ? new Date(aiAnalysis.submitted_at).toLocaleString('de-DE') : 'Loading...'}
                                        </p>
                                    </div>

                                    {/* Citizen Info */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-person me-2" />Citizen Information</h5>
                                        <dl className="case-info-list">
                                            <dt>Name</dt>
                                            <dd>{aiAnalysis?.citizen_name || hitlCase.citizen_name || 'N/A'}</dd>
                                            <dt>Email</dt>
                                            <dd>{aiAnalysis?.email || hitlCase.email || 'N/A'}</dd>
                                            <dt>Date of Birth</dt>
                                            <dd>{aiAnalysis?.dob || 'N/A'}</dd>
                                        </dl>
                                    </div>

                                    {/* Landlord Info */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-building me-2" />Landlord Information</h5>
                                        <dl className="case-info-list">
                                            <dt>Landlord Name</dt>
                                            <dd>{aiAnalysis?.landlord_name || 'N/A'}</dd>
                                            <dt>Move-in Date</dt>
                                            <dd>{aiAnalysis?.move_in_date || 'N/A'}</dd>
                                        </dl>
                                    </div>

                                    {/* Old Address */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-geo me-2" />Old Address</h5>
                                        <p className="case-address old-address">
                                            {aiAnalysis?.old_address || 'Not available'}
                                        </p>
                                    </div>

                                    {/* Original Address (with issues) */}
                                    <div className="case-info-section">
                                        <h5><i className="bi bi-exclamation-triangle me-2 text-warning" />Extracted Address (Has Issues)</h5>
                                        <p className="case-address problem-address">
                                            {aiAnalysis?.original_address || hitlCase.new_address_raw || 'Not available'}
                                        </p>
                                    </div>
                                </div>

                                {/* Right Column: AI Analysis & Correction */}
                                <div className="case-detail-audit hitl-correction-panel">
                                    <h5><i className="bi bi-cpu me-2" />AI Analysis</h5>

                                    {loadingAi ? (
                                        <div className="ai-loading">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                            <p>Analyzing case with AI...</p>
                                        </div>
                                    ) : aiAnalysis ? (
                                        <>
                                            {/* Error Explanation */}
                                            <div className="ai-error-box">
                                                <h6><i className="bi bi-info-circle me-1" />Why Review is Needed</h6>
                                                <p>{aiAnalysis.error_explanation}</p>
                                            </div>

                                            {/* Issues Found */}
                                            <div className="ai-issues-box">
                                                <h6><i className="bi bi-list-check me-1" />Issues Detected</h6>
                                                <ul className="issues-list">
                                                    {aiAnalysis.issues_found?.map((issue, idx) => (
                                                        <li key={idx}>
                                                            <i className="bi bi-exclamation-circle text-warning me-1" />
                                                            {issue}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Confidence */}
                                            <div className="ai-confidence">
                                                <span className="confidence-label">AI Confidence:</span>
                                                <span className={`confidence-badge confidence-${aiAnalysis.confidence}`}>
                                                    {aiAnalysis.confidence?.toUpperCase() || 'UNKNOWN'}
                                                </span>
                                            </div>

                                            {/* Additional Notes */}
                                            {aiAnalysis.additional_notes && (
                                                <div className="ai-notes">
                                                    <small><i className="bi bi-lightbulb me-1" />{aiAnalysis.additional_notes}</small>
                                                </div>
                                            )}

                                            {/* Corrected Address Input */}
                                            <div className="correction-input-section">
                                                <h6><i className="bi bi-magic me-1" />AI Suggested Correction</h6>
                                                <div className="input-group">
                                                    <span className="input-group-text">
                                                        <i className="bi bi-geo-alt-fill" />
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="form-control correction-input"
                                                        value={correctedAddressInput}
                                                        onChange={(e) => setCorrectedAddressInput(e.target.value)}
                                                        placeholder="Enter corrected address"
                                                    />
                                                </div>
                                                <small className="form-text text-muted">
                                                    Review the AI suggestion above. Edit if needed, then approve.
                                                </small>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="hitl-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-success btn-lg hitl-approve-btn"
                                                    onClick={handleSubmitCorrection}
                                                    disabled={submittingCorrection || !correctedAddressInput.trim()}
                                                >
                                                    {submittingCorrection ? (
                                                        <>
                                                            <span className="spinner-border spinner-border-sm me-2" role="status" />
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="bi bi-check-circle me-2" />
                                                            Approve & Resume Workflow
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    onClick={handleCloseHitlModal}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="ai-error">
                                            <i className="bi bi-exclamation-triangle text-danger" />
                                            <p>Failed to load AI analysis</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ANALYTICS DASHBOARD MODAL */}
            <AnalyticsDashboard
                isOpen={analyticsOpen}
                onClose={() => setAnalyticsOpen(false)}
                pendingCases={pendingCases}
                hitlCases={hitlCases}
                completedCases={completedCases}
            />

            {/* AI BRAIN MODAL */}
            {
                aiBrainOpen && (
                    <div className="modal-backdrop-custom" onClick={() => setAiBrainOpen(false)}>
                        <div className="ai-brain-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="ai-brain-modal-header">
                                <h5><i className="bi bi-cpu me-2"></i>🧠 Live AI Brain</h5>
                                <button className="btn-close btn-close-white" onClick={() => setAiBrainOpen(false)}></button>
                            </div>
                            <div className="ai-brain-modal-body">
                                <TerminalWidget />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default AdminDashboard;
