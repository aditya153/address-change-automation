import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'hitl' | 'completed'
    const [pendingCases, setPendingCases] = useState([]);
    const [completedCases, setCompletedCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [processingCase, setProcessingCase] = useState(null);

    // Audit Log State
    const [selectedCaseLogs, setSelectedCaseLogs] = useState(null);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // HITL State
    const [hitlCases, setHitlCases] = useState([]);
    const [correctingCase, setCorrectingCase] = useState(null);
    const [correctedAddresses, setCorrectedAddresses] = useState({});

    // Helper function to display user-friendly status
    const getStatusDisplay = (status) => {
        if (status === 'WAITING_FOR_HUMAN') {
            return 'Needs Review';
        }
        return status;
    };

    const fetchPendingCases = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/admin/pending-cases`);
            setPendingCases(response.data.cases || []);
        } catch (error) {
            console.error("Error fetching pending cases:", error);
            setMessage('Failed to load pending cases');
        } finally {
            setLoading(false);
        }
    };

    const fetchCompletedCases = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/admin/completed-cases`);
            setCompletedCases(response.data.cases || []);
        } catch (error) {
            console.error("Error fetching completed cases:", error);
            setMessage('Failed to load completed cases');
        } finally {
            setLoading(false);
        }
    };

    const fetchHitlCases = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/admin/hitl-cases`);
            setHitlCases(response.data.cases || []);
        } catch (error) {
            console.error("Error fetching HITL cases:", error);
            setMessage('Failed to load HITL cases');
        } finally {
            setLoading(false);
        }
    };

    const handleResolveHitl = async (caseId) => {
        const correctedAddress = correctedAddresses[caseId];

        if (!correctedAddress || !correctedAddress.trim()) {
            alert('Please enter a corrected address');
            return;
        }

        if (!confirm(`Correct address to: "${correctedAddress}" and resume workflow?`)) {
            return;
        }

        setCorrectingCase(caseId);
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('corrected_address', correctedAddress);

            const response = await axios.post(`${API_URL}/admin/resolve-hitl/${caseId}`, formData);
            setMessage(`✅ ${response.data.message}`);

            // Clear input and refresh HITL cases
            setCorrectedAddresses({ ...correctedAddresses, [caseId]: '' });
            setTimeout(() => {
                fetchHitlCases();
                fetchPendingCases(); // Refresh pendings as workflow resumes
            }, 1000);
        } catch (error) {
            setMessage(`❌ Error: ${error.response?.data?.detail || 'Failed to resolve HITL'}`);
        } finally {
            setCorrectingCase(null);
        }
    };

    useEffect(() => {
        if (activeTab === 'pending') {
            fetchPendingCases();
        } else if (activeTab === 'hitl') {
            fetchHitlCases();
        } else {
            fetchCompletedCases();
        }

        // Auto-refresh every 10 seconds
        const interval = setInterval(() => {
            if (activeTab === 'pending') fetchPendingCases();
            else if (activeTab === 'hitl') fetchHitlCases();
            else fetchCompletedCases();
        }, 10000);
        return () => clearInterval(interval);
    }, [activeTab]);

    const handleApprove = async (caseId) => {
        if (!confirm(`Approve case ${caseId}? This will trigger OCR and workflow processing.`)) {
            return;
        }
        setProcessingCase(caseId);
        setMessage(`Processing started for Case ID: ${caseId}`);

        try {
            await axios.post(`${API_URL}/admin/approve-case/${caseId}`);

            // Poll case status to update message when workflow completes
            const pollInterval = setInterval(async () => {
                try {
                    const pendingResponse = await axios.get(`${API_URL}/admin/pending-cases`);
                    const hitlResponse = await axios.get(`${API_URL}/admin/hitl-cases`);
                    const completedResponse = await axios.get(`${API_URL}/admin/completed-cases`);

                    const allCases = [
                        ...pendingResponse.data.cases,
                        ...hitlResponse.data.cases,
                        ...completedResponse.data.cases
                    ];

                    const currentCase = allCases.find(c => c.case_id === caseId);

                    if (currentCase) {
                        if (currentCase.status === 'CLOSED') {
                            setMessage(`✅ Case ${caseId} completed successfully!`);
                            clearInterval(pollInterval);
                            setProcessingCase(null);
                            fetchPendingCases();
                            fetchCompletedCases();
                        } else if (currentCase.status === 'WAITING_FOR_HUMAN') {
                            setMessage(`⏸️ Case ${caseId} needs your review - check "Needs Review" tab`);
                            clearInterval(pollInterval);
                            setProcessingCase(null);
                            fetchPendingCases();
                            fetchHitlCases();
                        } else if (currentCase.status === 'ERROR') {
                            setMessage(`❌ Case ${caseId} failed - check audit log`);
                            clearInterval(pollInterval);
                            setProcessingCase(null);
                            fetchPendingCases();
                        }
                    }
                } catch (error) {
                    console.error('Error polling case status:', error);
                }
            }, 5000); // Poll every 5 seconds

            // Stop polling after 5 minutes
            setTimeout(() => {
                clearInterval(pollInterval);
                setProcessingCase(null);
            }, 300000);

        } catch (error) {
            console.error("Error approving case:", error);
            setMessage(`Failed to approve case: ${error.response?.data?.detail || error.message}`);
            setProcessingCase(null);
        }
    };

    const handleViewAuditLog = async (caseId) => {
        setLoadingLogs(true);
        setShowAuditModal(true);
        setSelectedCaseLogs(null); // Clear previous logs
        try {
            const response = await axios.get(`${API_URL}/cases/${caseId}/audit`);
            setSelectedCaseLogs(response.data);
        } catch (error) {
            console.error("Error fetching audit logs:", error);
            alert("Failed to fetch audit logs");
            setShowAuditModal(false);
        } finally {
            setLoadingLogs(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="admin-dashboard">
            <div className="card">
                <div className="header-row">
                    <h2>👨‍💼 Admin Dashboard</h2>
                    <div className="header-actions">
                        <div className="tabs">
                            <button
                                className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                                onClick={() => setActiveTab('pending')}
                            >
                                Pending Cases
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'hitl' ? 'active' : ''}`}
                                onClick={() => setActiveTab('hitl')}
                            >
                                Needs Review
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
                                onClick={() => setActiveTab('completed')}
                            >
                                Completed Cases
                            </button>
                        </div>
                        <button
                            onClick={activeTab === 'pending' ? fetchPendingCases : activeTab === 'hitl' ? fetchHitlCases : fetchCompletedCases}
                            className="btn btn-secondary refresh-btn"
                            disabled={loading}
                        >
                            {loading ? '⏳' : '🔄 Refresh'}
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'}`}>
                        {message}
                    </div>
                )}

                <div className="stats">
                    <div className="stat-card">
                        <h3>{activeTab === 'pending' ? pendingCases.length : activeTab === 'hitl' ? hitlCases.length : completedCases.length}</h3>
                        <p>{activeTab === 'pending' ? 'Pending' : activeTab === 'hitl' ? 'Needs Review' : 'Completed'} Cases</p>
                    </div>
                </div>

                {/* PENDING CASES TABLE */}
                {activeTab === 'pending' && (
                    <>
                        {pendingCases.length === 0 ? (
                            <div className="empty-state">
                                <p>📭 No pending cases at the moment</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="cases-table">
                                    <thead>
                                        <tr>
                                            <th>Case ID</th>
                                            <th>Email</th>
                                            <th>Submitted</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingCases.map((caseItem) => (
                                            <tr key={caseItem.case_id}>
                                                <td className="case-id">{caseItem.case_id}</td>
                                                <td>{caseItem.email}</td>
                                                <td>{formatDate(caseItem.submitted_at)}</td>
                                                <td>
                                                    <span className={`status-badge status-${caseItem.status.toLowerCase().replace('_', '-')}`}>
                                                        {getStatusDisplay(caseItem.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => handleApprove(caseItem.case_id)}
                                                        className="btn btn-approve"
                                                        disabled={processingCase === caseItem.case_id || caseItem.status === 'PROCESSING' || caseItem.status === 'WAITING_FOR_HUMAN'}
                                                    >
                                                        {processingCase === caseItem.case_id ? '⏳ Processing...' :
                                                            caseItem.status === 'WAITING_FOR_HUMAN' ? '⏸️ Paused' : '✅ Approve'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* HITL CASES TABLE */}
                {activeTab === 'hitl' && (
                    <>
                        {hitlCases.length === 0 ? (
                            <div className="empty-state">
                                <p>🎉 No cases need review at the moment</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="cases-table">
                                    <thead>
                                        <tr>
                                            <th>Case ID</th>
                                            <th>Citizen Name</th>
                                            <th>Email</th>
                                            <th>Current Address (Low Confidence)</th>
                                            <th>Corrected Address</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hitlCases.map((caseItem) => (
                                            <tr key={caseItem.case_id}>
                                                <td className="case-id">{caseItem.case_id}</td>
                                                <td>{caseItem.citizen_name}</td>
                                                <td>{caseItem.email}</td>
                                                <td>
                                                    <div style={{ fontSize: '0.9em', color: '#e74c3c' }}>
                                                        <strong>⚠️ {caseItem.canonical_address || caseItem.new_address_raw}</strong>
                                                        <div style={{ fontSize: '0.85em', color: '#95a5a6', marginTop: '4px' }}>
                                                            (Confidence too low - needs verification)
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Enter correct address..."
                                                        value={correctedAddresses[caseItem.case_id] || ''}
                                                        onChange={(e) => setCorrectedAddresses({
                                                            ...correctedAddresses,
                                                            [caseItem.case_id]: e.target.value
                                                        })}
                                                        disabled={correctingCase === caseItem.case_id}
                                                        style={{ minWidth: '300px' }}
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => handleResolveHitl(caseItem.case_id)}
                                                        className="btn btn-approve"
                                                        disabled={correctingCase === caseItem.case_id}
                                                    >
                                                        {correctingCase === caseItem.case_id ? '⏳ Submitting...' : '✅ Correct & Resume'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* COMPLETED CASES TABLE */}
                {activeTab === 'completed' && (
                    <>
                        {completedCases.length === 0 ? (
                            <div className="empty-state">
                                <p>📭 No completed cases yet</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="cases-table">
                                    <thead>
                                        <tr>
                                            <th>Case ID</th>
                                            <th>Email</th>
                                            <th>Submitted</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {completedCases.map((caseItem) => (
                                            <tr key={caseItem.case_id}>
                                                <td className="case-id">{caseItem.case_id}</td>
                                                <td>{caseItem.email}</td>
                                                <td>{formatDate(caseItem.submitted_at)}</td>
                                                <td>
                                                    <span className={`status-badge status-${caseItem.status.toLowerCase()}`}>
                                                        {caseItem.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => handleViewAuditLog(caseItem.case_id)}
                                                        className="btn btn-secondary btn-sm"
                                                    >
                                                        📜 View Audit Log
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* AUDIT LOG MODAL */}
            {showAuditModal && (
                <div className="modal-overlay" onClick={() => setShowAuditModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📜 Audit Log: {selectedCaseLogs?.case_id || 'Loading...'}</h3>
                            <button className="close-btn" onClick={() => setShowAuditModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {loadingLogs ? (
                                <p className="loading-text">⏳ Loading audit logs...</p>
                            ) : (
                                <ul className="audit-list">
                                    {selectedCaseLogs?.entries?.map((entry, index) => (
                                        <li key={index} className="audit-item">
                                            <span className="audit-time">{new Date(entry.timestamp).toLocaleString()}</span>
                                            <span className="audit-message">{entry.message}</span>
                                        </li>
                                    )) || <p>No logs found.</p>}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Partners Section */}
            <div className="partners-section">
                <p className="partners-label">Powered by</p>
                <div className="partners-logos">
                    <div className="partner-logo">
                        <div className="logo-placeholder fraunhofer">
                            <span>Fraunhofer IESE</span>
                        </div>
                    </div>
                    <div className="partner-logo">
                        <div className="logo-placeholder insiders">
                            <span>Insiders Technologies</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;
