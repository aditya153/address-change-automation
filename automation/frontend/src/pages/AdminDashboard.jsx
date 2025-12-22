// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import TerminalWidget from '../components/TerminalWidget';
import './AdminDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function AdminDashboard() {
    const { t } = useLanguage();

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
            {/* MAIN CONTENT */}
            <main className="page-content">
                <div className="container-fluid">

                    {/* PAGE HEADER + FILTERS */}
                    <div className="row mb-3">
                        <div className="col-12">
                            <div className="card card-page-header">
                                <div className="card-body d-flex flex-wrap align-items-center justify-content-between">
                                    <div className="mb-2 mb-md-0">
                                        <h2 className="h4 mb-1">Address Change – Admin Dashboard</h2>
                                        <p className="text-muted mb-0">
                                            Manage and review submitted address change cases.
                                        </p>
                                    </div>

                                    <div className="admin-filters">
                                        {/* Status filter */}
                                        <select
                                            id="filterStatus"
                                            className="form-select form-select-sm"
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value)}
                                        >
                                            <option value="">All statuses</option>
                                            <option value="pending">Pending</option>
                                            <option value="review">Needs review</option>
                                            <option value="completed">Completed</option>
                                        </select>

                                        {/* Date range */}
                                        <input
                                            type="text"
                                            id="filterDate"
                                            className="form-control form-control-sm"
                                            placeholder="Date range"
                                        />

                                        {/* Search */}
                                        <div className="input-group input-group-sm">
                                            <input
                                                type="text"
                                                id="searchCases"
                                                className="form-control"
                                                placeholder="Search by Case ID or e-mail"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                            <button className="btn btn-outline-secondary" type="button">
                                                <i className="bi bi-search" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ALERT MESSAGE */}
                    {message && (
                        <div className="row mb-3">
                            <div className="col-12">
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
                        </div>
                    )}

                    {/* ANALYTICS & AI BRAIN BUTTONS */}
                    <div className="row mb-3">
                        <div className="col-12 d-flex justify-content-end gap-2">
                            <button
                                className="btn btn-primary btn-sm d-flex align-items-center gap-2"
                                onClick={() => setAnalyticsOpen(true)}
                            >
                                <i className="bi bi-graph-up-arrow"></i>
                                📊 View Analytics Dashboard
                            </button>
                            <button
                                className="btn btn-primary btn-sm d-flex align-items-center gap-2"
                                onClick={() => setAiBrainOpen(true)}
                            >
                                <i className="bi bi-cpu"></i>
                                🧠 Live AI Brain
                            </button>
                        </div>
                    </div>



                    {/* SUMMARY CARDS */}
                    <div className="row g-3 mb-4">
                        {/* Pending */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div
                                className={`card card-stat card-stat-primary card-stat-clickable ${filterStatus === 'pending' ? 'card-stat-active' : ''}`}
                                onClick={() => setFilterStatus(filterStatus === 'pending' ? '' : 'pending')}
                            >
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="card-stat-label text-uppercase small">
                                                Pending cases
                                            </div>
                                            <div className="card-stat-value display-6">
                                                {pendingCases.length}
                                            </div>
                                            <div className="small">Awaiting approval</div>
                                        </div>
                                        <div className="card-stat-icon">
                                            <i className="bi bi-inbox-fill" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Needs review */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div
                                className={`card card-stat card-stat-warning card-stat-clickable ${filterStatus === 'review' ? 'card-stat-active' : ''}`}
                                onClick={() => setFilterStatus(filterStatus === 'review' ? '' : 'review')}
                            >
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="card-stat-label text-uppercase small">
                                                Needs review
                                            </div>
                                            <div className="card-stat-value display-6">
                                                {hitlCases.length}
                                            </div>
                                            <div className="small">Requires manual correction</div>
                                        </div>
                                        <div className="card-stat-icon">
                                            <i className="bi bi-exclamation-triangle-fill" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Completed */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div
                                className={`card card-stat card-stat-success card-stat-clickable ${filterStatus === 'completed' ? 'card-stat-active' : ''}`}
                                onClick={() => setFilterStatus(filterStatus === 'completed' ? '' : 'completed')}
                            >
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="card-stat-label text-uppercase small">
                                                Completed
                                            </div>
                                            <div className="card-stat-value display-6">
                                                {completedCases.length}
                                            </div>
                                            <div className="small">Successfully processed</div>
                                        </div>
                                        <div className="card-stat-icon">
                                            <i className="bi bi-check-circle-fill" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Avg processing time (placeholder for now) */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="card card-stat card-stat-neutral">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="card-stat-label text-uppercase text-muted small">
                                                Avg. processing time
                                            </div>
                                            <div className="card-stat-value h3 mb-0">–</div>
                                            <div className="text-muted small">Last 30 days</div>
                                        </div>
                                        <div className="card-stat-icon text-muted">
                                            <i className="bi bi-clock-history" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN ROW: CASES TABLE + SIDE HELP */}
                    <div className="row">
                        {/* CASES TABLE */}
                        <div className="col-12 col-xl-9">
                            <div className="card">
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h3 className="h5 mb-0">
                                        <i className="bi bi-list-ul me-1" />
                                        {filterStatus === 'pending'
                                            ? 'Pending cases'
                                            : filterStatus === 'review'
                                                ? 'Cases needing review'
                                                : filterStatus === 'completed'
                                                    ? 'Completed cases'
                                                    : 'Pending cases'}
                                    </h3>
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="badge bg-secondary">
                                            {filteredCases.length} cases
                                        </span>
                                    </div>
                                </div>

                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-hover mb-0 align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th scope="col">Case ID</th>
                                                    <th scope="col">Citizen e-mail</th>
                                                    <th scope="col">Submitted on</th>
                                                    <th scope="col">Status</th>
                                                    <th scope="col" className="text-end">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCases.length === 0 ? (
                                                    <tr className="table-empty-state">
                                                        <td colSpan={5} className="text-center py-5">
                                                            <div className="mb-2">
                                                                <i className="bi bi-mailbox fs-1 text-muted" />
                                                            </div>
                                                            <p className="mb-0 fw-semibold">
                                                                No pending cases at the moment
                                                            </p>
                                                            <p className="text-muted small mb-0">
                                                                New submissions will appear here automatically.
                                                            </p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredCases.map((caseItem) => (
                                                        <tr key={caseItem.case_id} className="case-row">
                                                            <td>AC-{caseItem.case_id}</td>
                                                            <td>{caseItem.email}</td>
                                                            <td>{formatDate(caseItem.submitted_at)}</td>
                                                            <td>
                                                                <span
                                                                    className={`badge ${getStatusBadge(
                                                                        caseItem.status
                                                                    )}`}
                                                                >
                                                                    {getStatusDisplay(caseItem.status)}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="btn-group btn-group-sm">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline-secondary btn-view-case"
                                                                        onClick={() => {
                                                                            if (caseItem.status === 'CLOSED') {
                                                                                handleViewCaseDetail(caseItem);
                                                                            } else if (caseItem.status === 'WAITING_FOR_HUMAN') {
                                                                                handleOpenHitlReview(caseItem);
                                                                            } else {
                                                                                handleViewCase(caseItem);
                                                                            }
                                                                        }}
                                                                    >
                                                                        View
                                                                    </button>
                                                                    {(caseItem.status === 'PENDING' || caseItem.status === 'PENDING_REVIEW') && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline-success"
                                                                            onClick={() =>
                                                                                handleApprove(caseItem.case_id)
                                                                            }
                                                                            disabled={
                                                                                processingCase === caseItem.case_id
                                                                            }
                                                                        >
                                                                            {processingCase === caseItem.case_id
                                                                                ? 'Processing...'
                                                                                : 'Approve & Process'}
                                                                        </button>
                                                                    )}
                                                                    {caseItem.status === 'CLOSED' && (caseItem.pdf_landlord_path || caseItem.pdf_address_change_path) && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline-info"
                                                                            onClick={() => handlePreviewDocs(caseItem)}
                                                                            title="Preview uploaded documents"
                                                                        >
                                                                            <i className="bi bi-file-earmark-pdf me-1" />
                                                                            Docs
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Simple pagination placeholder */}
                                <div className="card-footer d-flex justify-content-between align-items-center">
                                    <div className="text-muted small">
                                        Showing {filteredCases.length} of {filteredCases.length} cases
                                    </div>
                                    <nav>
                                        <ul className="pagination pagination-sm mb-0">
                                            <li className="page-item disabled">
                                                <button className="page-link" type="button">
                                                    «
                                                </button>
                                            </li>
                                            <li className="page-item active">
                                                <button className="page-link" type="button">
                                                    1
                                                </button>
                                            </li>
                                            <li className="page-item disabled">
                                                <button className="page-link" type="button">
                                                    »
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                </div>
                            </div>
                        </div>

                        {/* SIDE HELP / CONTACT */}
                        <div className="col-12 col-xl-3 mt-3 mt-xl-0">
                            <div className="card mb-3">
                                <div className="card-header">
                                    <i className="bi bi-info-circle me-1" />
                                    Processing guidelines
                                </div>
                                <div className="card-body">
                                    <ul className="list-unstyled small mb-0">
                                        <li className="mb-2">
                                            ✔ Verify that uploaded documents are readable and complete.
                                        </li>
                                        <li className="mb-2">
                                            ✔ Check that old and new addresses are plausible.
                                        </li>
                                        <li className="mb-2">
                                            ✔ If confidence is low, mark the case as{' '}
                                            <strong>Needs review</strong>.
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <i className="bi bi-telephone me-1" />
                                    Contact &amp; Help
                                </div>
                                <div className="card-body small">
                                    <p className="mb-2">
                                        <strong>E-mail</strong>
                                        <br />
                                        <a href="mailto:buergerservice@stadt.de">
                                            buergerservice@stadt.de
                                        </a>
                                    </p>
                                    <p className="mb-2">
                                        <strong>Phone</strong>
                                        <br />
                                        +49 (0) 123 456 789
                                    </p>
                                    <p className="mb-0">
                                        <strong>Opening hours</strong>
                                        <br />
                                        Mon–Fri: 8:00 – 16:00
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main >

            {/* FOOTER (light, admin-specific) */}
            < footer className="admin-footer" >
                <div className="admin-footer-content">
                    <div className="admin-footer-links">
                        <a href="#">{t('imprint')}</a>
                        <a href="#">{t('dataProtection')}</a>
                        <a href="#">{t('accessibility')}</a>
                        <a href="#">{t('termsOfUse')}</a>
                    </div>
                    <div className="admin-footer-copy">{t('copyright')}</div>
                </div>
            </footer >

            {/* CASE DETAIL DRAWER */}
            < aside className={`case-detail-drawer ${drawerOpen ? 'active' : ''}`
            }>
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
            {aiBrainOpen && (
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
            )}
        </div >
    );
}

export default AdminDashboard;
