// src/components/AnalyticsDashboard.jsx
import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, Brain, CheckCircle2, Activity } from 'lucide-react';
import './AnalyticsDashboard.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AnalyticsDashboard() {
    const [analytics, setAnalytics] = useState(null);
    const [patterns, setPatterns] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPatterns, setShowPatterns] = useState(false);
    const [patternsLoading, setPatternsLoading] = useState(false);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/analytics`);
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
            }
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPatterns = async () => {
        if (showPatterns) {
            setShowPatterns(false);
            return;
        }
        setPatternsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/learned-patterns`);
            if (res.ok) {
                const data = await res.json();
                setPatterns(data.patterns);
                setShowPatterns(true);
            }
        } catch (err) {
            console.error('Failed to fetch patterns:', err);
        } finally {
            setPatternsLoading(false);
        }
    };

    const formatTime = (minutes) => {
        if (!minutes || minutes < 1) return '< 1m';
        if (minutes < 60) return `${Math.round(minutes)}m`;
        return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
    };

    // Prepare pie chart data
    const getSourcePieData = () => {
        if (!analytics?.source_breakdown) return [];
        const colors = { portal: '#0066cc', email: '#8b5cf6' };
        const labels = { portal: '🌐 Portal', email: '📧 Email' };
        return Object.entries(analytics.source_breakdown).map(([key, value]) => ({
            label: labels[key] || key,
            value,
            color: colors[key] || '#6b7280'
        })).filter(d => d.value > 0);
    };

    const getHitlPieData = () => {
        if (!analytics?.hitl_breakdown) return [];
        return [
            { label: '🤖 Auto-Processed', value: analytics.hitl_breakdown.auto || 0, color: '#22c55e' },
            { label: '👤 Manual Review', value: analytics.hitl_breakdown.manual || 0, color: '#f59e0b' }
        ].filter(d => d.value > 0);
    };

    // SVG Pie Chart Component
    const PieChart = ({ data, title, icon: Icon }) => {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total === 0) return (
            <div className="analytics-card">
                <div className="analytics-card-header">
                    <Icon className="w-5 h-5 text-[#0066cc]" />
                    <h3 className="analytics-card-title">{title}</h3>
                </div>
                <div className="no-data-message">No data available</div>
            </div>
        );

        let cumulativePercent = 0;
        const segments = data.map((segment) => {
            const percent = (segment.value / total) * 100;
            const startAngle = cumulativePercent * 3.6;
            cumulativePercent += percent;
            return { ...segment, percent, startAngle };
        });

        return (
            <div className="analytics-card">
                <div className="analytics-card-header">
                    <Icon className="w-5 h-5 text-[#0066cc]" />
                    <h3 className="analytics-card-title">{title}</h3>
                </div>
                <div className="pie-chart-container">
                    <svg viewBox="0 0 100 100" className="pie-svg">
                        {segments.map((segment, i) => {
                            const radius = 40;
                            const circumference = 2 * Math.PI * radius;
                            const offset = (segment.startAngle / 360) * circumference;
                            const strokeLength = (segment.percent / 100) * circumference;

                            return (
                                <circle
                                    key={i}
                                    cx="50"
                                    cy="50"
                                    r={radius}
                                    fill="none"
                                    stroke={segment.color}
                                    strokeWidth="20"
                                    strokeDasharray={`${strokeLength} ${circumference}`}
                                    strokeDashoffset={-offset}
                                    transform="rotate(-90 50 50)"
                                />
                            );
                        })}
                        <text x="50" y="50" textAnchor="middle" dy=".3em" className="pie-total-text">
                            {total}
                        </text>
                    </svg>
                </div>
                <div className="pie-legend">
                    {segments.map((segment, i) => (
                        <div key={i} className="legend-item">
                            <div className="legend-label">
                                <span className="legend-dot" style={{ backgroundColor: segment.color }}></span>
                                <span className="legend-text">{segment.label}</span>
                            </div>
                            <span className="legend-value">{segment.value} ({Math.round(segment.percent)}%)</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="analytics-loading-container">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-[#0066cc]/30 border-t-[#0066cc] rounded-full animate-spin"></div>
                    <p className="text-slate-500">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="analytics-error-container">
                <p className="text-slate-500">Failed to load analytics data</p>
            </div>
        );
    }

    return (
        <div className="analytics-dashboard">
            {/* Page Header */}
            <div className="analytics-page-header">
                <div>
                    <h1 className="analytics-page-title">Analytics Overview</h1>
                    <p className="analytics-page-subtitle">Comprehensive insights into system performance and automation efficiency</p>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="analytics-metrics-grid">
                <div className="analytics-stat-card stat-blue">
                    <div className="analytics-stat-icon bg-blue-50">
                        <Activity className="w-6 h-6 text-[#0066cc]" />
                    </div>
                    <div className="analytics-stat-content">
                        <p className="analytics-stat-label">Total Cases</p>
                        <p className="analytics-stat-value">{analytics.total_cases}</p>
                    </div>
                </div>

                <div className="analytics-stat-card stat-green">
                    <div className="analytics-stat-icon bg-green-50">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="analytics-stat-content">
                        <p className="analytics-stat-label">Cases This Week</p>
                        <p className="analytics-stat-value">{analytics.cases_this_week || 0}</p>
                    </div>
                </div>

                <div className="analytics-stat-card stat-orange">
                    <div className="analytics-stat-icon bg-orange-50">
                        <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="analytics-stat-content">
                        <p className="analytics-stat-label">Avg. Processing Time</p>
                        <p className="analytics-stat-value">{formatTime(analytics.avg_processing_time_minutes)}</p>
                    </div>
                </div>

                <div className="analytics-stat-card stat-purple" onClick={fetchPatterns} style={{ cursor: 'pointer' }}>
                    <div className="analytics-stat-icon bg-purple-50">
                        <Brain className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="analytics-stat-content">
                        <p className="analytics-stat-label">Learned Patterns</p>
                        <p className="analytics-stat-value">{analytics.learned_patterns}</p>
                        <span className="analytics-stat-hint">{showPatterns ? '▲ Hide' : '▼ Show Details'}</span>
                    </div>
                </div>
            </div>

            {/* Learned Patterns Panel */}
            {showPatterns && (
                <div className="analytics-card patterns-card">
                    <div className="analytics-card-header">
                        <Brain className="w-5 h-5 text-[#0066cc]" />
                        <h3 className="analytics-card-title">AI Memory - Learned Patterns</h3>
                    </div>
                    {patternsLoading ? (
                        <div className="patterns-loading">
                            <div className="w-6 h-6 border-4 border-[#0066cc]/30 border-t-[#0066cc] rounded-full animate-spin"></div>
                            <p className="text-slate-500">Loading patterns...</p>
                        </div>
                    ) : patterns && patterns.length > 0 ? (
                        <div className="patterns-table-container">
                            <table className="patterns-table">
                                <thead>
                                    <tr>
                                        <th>Original</th>
                                        <th></th>
                                        <th>Corrected</th>
                                        <th>Type</th>
                                        <th>Frequency</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {patterns.map((p, i) => (
                                        <tr key={i}>
                                            <td><code className="code-red">{p.original}</code></td>
                                            <td className="arrow-cell">→</td>
                                            <td><code className="code-green">{p.corrected}</code></td>
                                            <td className="type-cell">{p.type.replace(/_/g, ' ')}</td>
                                            <td className="freq-cell">{p.frequency}×</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="no-data-message">No patterns learned yet</div>
                    )}
                </div>
            )}

            {/* Charts Grid */}
            <div className="analytics-charts-grid">
                <PieChart data={getSourcePieData()} title="Submission Sources" icon={TrendingUp} />
                <PieChart data={getHitlPieData()} title="Processing Method" icon={BarChart3} />
            </div>

            {/* Status Distribution */}
            {analytics.status_breakdown && Object.keys(analytics.status_breakdown).length > 0 && (
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <Activity className="w-5 h-5 text-[#0066cc]" />
                        <h3 className="analytics-card-title">Status Distribution</h3>
                    </div>
                    <div className="status-badges-container">
                        {Object.entries(analytics.status_breakdown).map(([status, count]) => (
                            <span key={status} className="status-badge">
                                <span className="status-badge-label">{status.replace(/_/g, ' ')}</span>
                                <span className="status-badge-count">{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
