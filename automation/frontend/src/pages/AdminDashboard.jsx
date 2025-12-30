import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UserManagement from '../components/UserManagement';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import {
    Inbox,
    AlertTriangle,
    CheckCircle2,
    Clock,
    TrendingUp,
    ArrowRight,
    Eye,
    FileText,
    MoreHorizontal,
    Brain,
    BarChart3,
    X,
    User,
    MapPin,
    Calendar,
    File
} from "lucide-react";

import './AdminDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function AdminDashboard() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();

    // Data state
    const [pendingCases, setPendingCases] = useState([]);
    const [hitlCases, setHitlCases] = useState([]);
    const [completedCases, setCompletedCases] = useState([]);
    const [loading, setLoading] = useState(false);

    // Navigation & UI State
    const [activeNav, setActiveNav] = useState('dashboard');
    const [message, setMessage] = useState('');

    // Modal States
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedCase, setSelectedCase] = useState(null);
    const [docPreviewOpen, setDocPreviewOpen] = useState(false);
    const [previewDocs, setPreviewDocs] = useState({ landlord: null, address: null });
    const [activeDocTab, setActiveDocTab] = useState('both');
    const [hitlModalOpen, setHitlModalOpen] = useState(false);
    const [hitlCase, setHitlCase] = useState(null);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [correctedAddressInput, setCorrectedAddressInput] = useState('');
    const [loadingAi, setLoadingAi] = useState(false);
    const [caseDetails, setCaseDetails] = useState(null);
    const [auditLog, setAuditLog] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Fetching Logic
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

    // Helper Functions
    const getPdfUrl = (path) => {
        if (!path) return null;
        const filename = path.split('/').pop();
        return `${API_URL}/uploads/${filename}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            return `Today, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
        }
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    };

    const mapStatus = (status) => {
        switch (status) {
            case 'PENDING': return 'pending';
            case 'PENDING_REVIEW': return 'pending';
            case 'WAITING_FOR_HUMAN': return 'review';
            case 'CLOSED': return 'completed';
            default: return 'pending';
        }
    };

    // Actions
    const handlePreviewDocs = (caseItem) => {
        setPreviewDocs({
            landlord: getPdfUrl(caseItem.pdf_landlord_path),
            address: getPdfUrl(caseItem.pdf_address_change_path)
        });
        setActiveDocTab('both');
        setDocPreviewOpen(true);
    };

    const handleViewCase = async (caseItem) => {
        setSelectedCase(caseItem);
        setDrawerOpen(true);
        setLoadingDetails(true);
        setCaseDetails(null);
        setAuditLog([]);

        try {
            // Fetch full details and audit log in parallel
            const [detailsRes, auditRes] = await Promise.all([
                axios.get(`${API_URL}/cases/${encodeURIComponent(caseItem.case_id)}`),
                axios.get(`${API_URL}/cases/${encodeURIComponent(caseItem.case_id)}/audit`).catch(() => ({ data: { entries: [] } }))
            ]);
            setCaseDetails(detailsRes.data);
            setAuditLog(auditRes.data.entries || []);
        } catch (err) {
            console.error('Error fetching case details:', err);
            // Fallback to what we already have
            setCaseDetails({
                ...caseItem,
                dob: 'N/A',
                landlord_name: 'N/A',
                move_in_date_raw: 'N/A',
                old_address_raw: 'N/A'
            });
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleOpenHitlReview = async (caseItem) => {
        setHitlCase(caseItem);
        setHitlModalOpen(true);
        setLoadingAi(true);
        setAiAnalysis(null);
        setCorrectedAddressInput('');

        try {
            const res = await axios.get(`${API_URL}/case/${encodeURIComponent(caseItem.case_id)}/ai-analysis`);
            setAiAnalysis(res.data);
            if (res.data.suggested_address) {
                setCorrectedAddressInput(res.data.suggested_address);
            }
        } catch (err) {
            console.error('Failed to fetch AI analysis:', err);
            setAiAnalysis({
                error_explanation: 'Failed to load AI analysis.',
                issues_found: [],
                suggested_address: caseItem.new_address_raw || '',
                confidence: 'low'
            });
            setCorrectedAddressInput(caseItem.new_address_raw || '');
        } finally {
            setLoadingAi(false);
        }
    };

    const handleSubmitCorrection = async () => {
        if (!correctedAddressInput.trim()) return;
        if (!window.confirm(`Approve address: "${correctedAddressInput}"?`)) return;

        try {
            const formData = new FormData();
            formData.append('corrected_address', correctedAddressInput);
            await axios.post(`${API_URL}/admin/resolve-hitl/${encodeURIComponent(hitlCase.case_id)}`, formData);
            setMessage(`✅ Case ${hitlCase.case_id} corrected and resumed.`);
            setHitlModalOpen(false);
            fetchAllCases();
        } catch (err) {
            setMessage(`❌ Error: ${err.message}`);
        }
    };

    // Derived Data for UI
    const stats = [
        {
            label: "Pending Cases",
            value: pendingCases.length.toString(),
            change: "+3 today",
            icon: Inbox,
            color: "text-blue-500",
            bg: "bg-blue-50"
        },
        {
            label: "Needs Review",
            value: hitlCases.length.toString(),
            change: `${hitlCases.length > 0 ? hitlCases.length + ' urgent' : 'All clear'}`,
            icon: AlertTriangle,
            color: "text-orange-500",
            bg: "bg-orange-50"
        },
        {
            label: "Completed",
            value: completedCases.length.toString(),
            change: "+18 this week",
            icon: CheckCircle2,
            color: "text-green-500",
            bg: "bg-green-50"
        },
        {
            label: "Avg. Processing",
            value: "2.4h",
            change: "-12% faster",
            icon: Clock,
            color: "text-purple-500",
            bg: "bg-purple-50"
        },
    ];

    const allCases = [...pendingCases, ...hitlCases, ...completedCases].sort((a, b) =>
        new Date(b.submitted_at) - new Date(a.submitted_at)
    ).slice(0, 10);

    const statusStyles = {
        pending: { dot: "bg-info", label: "Pending", bg: "bg-info/10 text-info" },
        review: { dot: "bg-warning", label: "Review", bg: "bg-warning/10 text-warning" },
        completed: { dot: "bg-success", label: "Completed", bg: "bg-success/10 text-success" },
    };

    return (
        <DashboardLayout activeNav={activeNav} onNavChange={setActiveNav}>
            {/* VIEW SWITCHER */}
            {activeNav === 'users' ? (
                <UserManagement />
            ) : activeNav === 'analytics' ? (
                <div className="space-y-4">
                    <Button variant="outline" onClick={() => setActiveNav('dashboard')}>← Back to Dashboard</Button>
                    <AnalyticsDashboard />
                </div>
            ) : activeNav === 'cases' ? (
                <div className="space-y-8 animate-in" style={{ paddingTop: 0, marginTop: 0, alignSelf: 'flex-start', width: '100%' }}>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight mb-1">All Cases</h1>
                            <p className="text-muted-foreground">Complete list of all address change requests</p>
                        </div>
                        <Button variant="outline" onClick={() => setActiveNav('dashboard')}>← Back to Dashboard</Button>
                    </div>
                    <div className="admin-card">
                        <div className="overflow-x-auto">
                            <table className="clean-table">
                                <thead>
                                    <tr>
                                        <th>Case ID</th>
                                        <th>Citizen</th>
                                        <th>Submitted</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allCases.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">No cases found</td></tr>
                                    ) : (
                                        allCases.map((item) => {
                                            const statusKey = mapStatus(item.status);
                                            const style = statusStyles[statusKey] || statusStyles.pending;

                                            return (
                                                <tr key={item.case_id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="case-id-cell">AC-Case ID: {item.case_id}</td>
                                                    <td>
                                                        <div>
                                                            <p className="citizen-name">{item.citizen_name || 'Unknown'}</p>
                                                            <p className="citizen-email">{item.email}</p>
                                                        </div>
                                                    </td>
                                                    <td className="text-muted-foreground">{formatDate(item.submitted_at)}</td>
                                                    <td>
                                                        <span className={`status-badge status-${statusKey}`}>
                                                            <span className="dot" />
                                                            {style.label}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                onClick={() => {
                                                                    if (item.status === 'WAITING_FOR_HUMAN') handleOpenHitlReview(item);
                                                                    else handleOpenDetailDrawer(item.case_id);
                                                                }}
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                            {item.status === 'WAITING_FOR_HUMAN' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                    onClick={() => handleOpenHitlReview(item)}
                                                                >
                                                                    <FileEdit className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in">
                    {/* Page Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight mb-1">Dashboard</h1>
                            <p className="text-muted-foreground">Address Change Automation Overview</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                className="gap-2 bg-white border-slate-200 text-[#0066cc] hover:bg-[#f8fafc] hover:text-[#0052a3] transition-colors"
                                onClick={() => setActiveNav('analytics')}
                            >
                                <BarChart3 className="w-4 h-4" />
                                Analytics
                            </Button>
                            <Button
                                className="gap-2 bg-[#0066cc] hover:bg-[#0052a3] text-white border-none"
                                style={{ backgroundColor: '#0066cc' }}
                            >
                                <Brain className="w-4 h-4" />
                                AI Brain
                            </Button>
                        </div>
                    </div>

                    {/* Alert Message */}
                    {message && (
                        <div className="p-4 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex justify-between items-center">
                            <span>{message}</span>
                            <button onClick={() => setMessage('')}><X size={16} /></button>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {stats.map((stat) => (
                            <div key={stat.label} className="admin-card p-6">
                                <div className="stat-card-content">
                                    <div>
                                        <p className="stat-label">{stat.label}</p>
                                        <p className="stat-value">{stat.value}</p>
                                        <div className="stat-change text-muted-foreground">
                                            <TrendingUp className="w-3 h-3" />
                                            {stat.change}
                                        </div>
                                    </div>
                                    <div className={`stat-icon-wrapper ${stat.bg}`}>
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Recent Cases */}
                        <div className="lg:col-span-2 admin-card">
                            <div className="p-6 border-b border-border flex flex-row items-center justify-between">
                                <h3 className="text-lg font-bold m-0">Recent Cases</h3>
                                <Button variant="ghost" size="sm" className="gap-1 text-[#0066cc] p-0 h-auto hover:bg-transparent font-semibold" onClick={() => setActiveNav('cases')}>
                                    View All <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="clean-table">
                                    <thead>
                                        <tr>
                                            <th>Case ID</th>
                                            <th>Citizen</th>
                                            <th>Submitted</th>
                                            <th>Status</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allCases.length === 0 ? (
                                            <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">No recent cases</td></tr>
                                        ) : (
                                            allCases.slice(0, 5).map((item) => {
                                                const statusKey = mapStatus(item.status);
                                                const style = statusStyles[statusKey] || statusStyles.pending;

                                                return (
                                                    <tr key={item.case_id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="case-id-cell">AC-Case ID: {item.case_id}</td>
                                                        <td>
                                                            <div>
                                                                <p className="citizen-name">{item.citizen_name || 'Unknown'}</p>
                                                                <p className="citizen-email">{item.email}</p>
                                                            </div>
                                                        </td>
                                                        <td className="text-muted-foreground">{formatDate(item.submitted_at)}</td>
                                                        <td>
                                                            <span className={`status-badge status-${statusKey}`}>
                                                                <span className="dot" />
                                                                {style.label}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                    onClick={() => {
                                                                        if (item.status === 'WAITING_FOR_HUMAN') handleOpenHitlReview(item);
                                                                        else handleViewCase(item);
                                                                    }}
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </Button>
                                                                {(item.pdf_landlord_path || item.pdf_address_change_path) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                        onClick={() => handlePreviewDocs(item)}
                                                                    >
                                                                        <FileText className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Quick Actions & Guidelines */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="admin-card">
                                <h3 className="text-lg font-bold mb-4">Processing Guidelines</h3>
                                <div className="space-y-4">
                                    {[
                                        "Verify uploaded documents are readable and complete",
                                        "Confirm old and new addresses are plausible",
                                        "Mark low-confidence cases for manual review",
                                        "Complete processing within 48 hours",
                                    ].map((item, index) => (
                                        <div key={index} className="flex items-start gap-3">
                                            <div className="w-5 h-5 rounded-full border border-success flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <CheckCircle2 className="w-3 h-3 text-success" />
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Success Rate Card */}
                            <div className="success-rate-card">
                                <div>
                                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">This Month</p>
                                    <p className="text-4xl font-bold mb-1">94.2%</p>
                                    <p className="text-xs opacity-90">Automation Success Rate</p>

                                    <div className="success-rate-progress-bg">
                                        <div className="success-rate-progress-bar" style={{ width: '94.2%' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}

            {/* 1. DOCUMENT PREVIEW MODAL */}
            {docPreviewOpen && (
                <div className="modal-overlay" onClick={() => setDocPreviewOpen(false)}>
                    <div className="modal-content w-11/12 max-w-5xl h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="text-xl font-bold">Document Preview</h3>
                            <button onClick={() => setDocPreviewOpen(false)}><X /></button>
                        </div>
                        <div className="modal-body h-full flex flex-col">
                            <div className="flex gap-4 mb-4 border-b">
                                {previewDocs.landlord && (
                                    <button
                                        className={`pb-2 ${activeDocTab === 'landlord' ? 'border-b-2 border-primary font-bold' : ''}`}
                                        onClick={() => setActiveDocTab('landlord')}
                                    >
                                        Landlord Confirm
                                    </button>
                                )}
                                {previewDocs.address && (
                                    <button
                                        className={`pb-2 ${activeDocTab === 'address' ? 'border-b-2 border-primary font-bold' : ''}`}
                                        onClick={() => setActiveDocTab('address')}
                                    >
                                        Address Form
                                    </button>
                                )}
                                <button
                                    className={`pb-2 ${activeDocTab === 'both' ? 'border-b-2 border-primary font-bold' : ''}`}
                                    onClick={() => setActiveDocTab('both')}
                                >
                                    Side-by-Side
                                </button>
                            </div>
                            <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden flex">
                                {(activeDocTab === 'landlord' || activeDocTab === 'both') && previewDocs.landlord && (
                                    <iframe src={previewDocs.landlord} className="flex-1 h-full" title="Landlord" />
                                )}
                                {(activeDocTab === 'address' || activeDocTab === 'both') && previewDocs.address && (
                                    <iframe src={previewDocs.address} className="flex-1 h-full border-l" title="Address" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. CASE DETAIL MODAL (Redesigned - Card-Based Layout) */}
            {drawerOpen && selectedCase && (
                <div className="modal-overlay" onClick={() => setDrawerOpen(false)}>
                    <div className="modal-content case-detail-modal-redesign" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="modal-header-redesign">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-lg">
                                    <Inbox className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold mb-1">Case #{selectedCase.case_id.replace('Case ID: ', '')}</h3>
                                    <p className="text-white/80 text-sm">Submitted {formatDate(caseDetails?.created_at || selectedCase.submitted_at)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-4 py-2 rounded-lg font-semibold text-sm ${selectedCase.status === 'CLOSED' ? 'bg-green-500/20 text-white' : 'bg-yellow-500/20 text-white'}`}>
                                    {selectedCase.status === 'CLOSED' ? 'Completed' : selectedCase.status}
                                </span>
                                <button onClick={() => setDrawerOpen(false)} className="close-btn-redesign">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Body - Two Column Layout */}
                        <div className="modal-body-redesign">
                            {loadingDetails ? (
                                <div className="flex items-center justify-center h-64 w-full">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-10 h-10 border-4 border-[#0066cc]/30 border-t-[#0066cc] rounded-full animate-spin"></div>
                                        <p className="text-slate-500">Loading case details...</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Left Column - Info Cards */}
                                    <div className="modal-left-column">
                                        <div className="space-y-6">
                                            {/* Citizen Information Card */}
                                            <div className="info-card-redesign">
                                                <div className="card-header-redesign">
                                                    <User className="w-5 h-5 text-[#0066cc]" />
                                                    <h4 className="text-lg font-bold text-slate-800">Citizen Information</h4>
                                                </div>
                                                <div className="grid grid-cols-3 gap-6">
                                                    <div>
                                                        <p className="info-label">Full Name</p>
                                                        <p className="info-value">{caseDetails?.citizen_name || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="info-label">Email Address</p>
                                                        <p className="info-value text-[#0066cc]">{caseDetails?.email || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="info-label">Date of Birth</p>
                                                        <p className="info-value">{caseDetails?.dob ? new Date(caseDetails.dob).toLocaleDateString('de-DE') : 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Landlord Information Card */}
                                            <div className="info-card-redesign">
                                                <div className="card-header-redesign">
                                                    <File className="w-5 h-5 text-[#0066cc]" />
                                                    <h4 className="text-lg font-bold text-slate-800">Landlord Information</h4>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <p className="info-label">Landlord Name</p>
                                                        <p className="info-value">{caseDetails?.landlord_name || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="info-label">Move-in Date</p>
                                                        <p className="info-value">{caseDetails?.move_in_date_raw || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Address Information Card */}
                                            <div className="info-card-redesign">
                                                <div className="card-header-redesign">
                                                    <MapPin className="w-5 h-5 text-[#0066cc]" />
                                                    <h4 className="text-lg font-bold text-slate-800">Address Change Details</h4>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <p className="info-label mb-2">Previous Address</p>
                                                        <div className="address-box address-old">
                                                            {caseDetails?.old_address_raw || 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="info-label mb-2">New Address</p>
                                                        <div className="address-box address-new">
                                                            {caseDetails?.new_address_raw || 'N/A'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Processing Stats - Single Card */}
                                            <div className="stat-card-redesign" style={{ maxWidth: '320px' }}>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="stat-icon-redesign bg-blue-50">
                                                        <Clock className="w-5 h-5 text-[#0066cc]" />
                                                    </div>
                                                    <p className="stat-label-redesign">Processing Time</p>
                                                </div>
                                                <p className="stat-value-redesign">1m 21s</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column - Timeline */}
                                    <div className="modal-right-column">
                                        <div className="mb-6">
                                            <div className="flex items-center gap-3 mb-1">
                                                <Clock className="w-6 h-6 text-[#0066cc]" />
                                                <h4 className="text-xl font-bold text-slate-800 m-0" style={{ fontFamily: 'Merriweather, Georgia, serif' }}>Processing Timeline</h4>
                                            </div>
                                            <p className="text-sm text-slate-500 ml-9">Complete audit trail of case processing</p>
                                        </div>

                                        <div className="timeline-redesign">
                                            {auditLog.length > 0 ? (
                                                auditLog.map((entry, idx) => (
                                                    <div key={idx} className="timeline-item-redesign">
                                                        <div className="timeline-dot-redesign"></div>
                                                        <div className="timeline-content-redesign">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="timeline-timestamp">
                                                                    {new Date(entry.timestamp).toLocaleString('de-DE', {
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        second: '2-digit'
                                                                    })}
                                                                </span>
                                                            </div>
                                                            <p className="timeline-message">{entry.message}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-slate-400 text-sm italic">No timeline entries available</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. HITL REVIEW MODAL */}
            {hitlModalOpen && hitlCase && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <div>
                                <h3 className="text-lg font-bold">Human Review Required</h3>
                                <p className="text-sm text-gray-500">Case AC-{hitlCase.case_id}</p>
                            </div>
                            <button onClick={() => setHitlModalOpen(false)}><X /></button>
                        </div>
                        <div className="modal-body space-y-4">
                            {loadingAi ? (
                                <div className="p-8 text-center text-gray-500">Analyzing case with AI...</div>
                            ) : (
                                <>
                                    {aiAnalysis && (
                                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 text-sm">
                                            <p className="font-bold text-orange-800 mb-1">AI Detected Issues:</p>
                                            <ul className="list-disc pl-5 space-y-1 text-orange-700">
                                                {aiAnalysis.issues_found?.map((issue, i) => (
                                                    <li key={i}>{issue}</li>
                                                )) || <li>Manual review requested</li>}
                                            </ul>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Corrected Address</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded"
                                            value={correctedAddressInput}
                                            onChange={e => setCorrectedAddressInput(e.target.value)}
                                            placeholder="Type validated address here..."
                                        />
                                    </div>
                                    <div className="flex gap-2 text-sm text-gray-500">
                                        <Button size="sm" variant="outline" onClick={() => handlePreviewDocs(hitlCase)}>
                                            View Documents
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <Button variant="ghost" onClick={() => setHitlModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSubmitCorrection} className="bg-success hover:bg-success/90">
                                Approve Correction
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default AdminDashboard;
