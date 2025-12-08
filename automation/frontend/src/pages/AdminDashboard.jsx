// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
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

                    {/* SUMMARY CARDS */}
                    <div className="row g-3 mb-4">
                        {/* Pending */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="card card-stat card-stat-primary">
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
                            <div className="card card-stat card-stat-warning">
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
                            <div className="card card-stat card-stat-success">
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
                                                                        onClick={() => handleViewCase(caseItem)}
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
                                                                    {caseItem.status === 'WAITING_FOR_HUMAN' && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline-warning"
                                                                            onClick={() => handleViewCase(caseItem)}
                                                                        >
                                                                            Needs review
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
            </main>

            {/* FOOTER (light, admin-specific) */}
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
            </aside>
        </div>
    );
}

export default AdminDashboard;
