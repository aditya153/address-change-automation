// src/components/AnalyticsDashboard.jsx
import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, Brain, Activity, Download, ArrowUpRight, ArrowDownRight, Users, PieChart as PieChartIcon } from 'lucide-react';
import { Button } from './ui/button';
import './AnalyticsDashboard.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AnalyticsDashboard() {
    const [analytics, setAnalytics] = useState(null);
    const [patterns, setPatterns] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPatterns, setShowPatterns] = useState(false);
    const [patternsLoading, setPatternsLoading] = useState(false);
    const [comparison, setComparison] = useState(null);
    const [period, setPeriod] = useState('week');
    const [exporting, setExporting] = useState(false);
    const [kpis, setKpis] = useState(null);

    useEffect(() => {
        fetchAnalytics();
        fetchComparison();
        fetchKpis();
    }, [period]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/analytics?period=${period}`);
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

    const fetchKpis = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/admin/analytics/kpis?period=${period}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setKpis(data);
            }
        } catch (err) {
            console.error('Failed to fetch KPIs:', err);
        }
    };

    const fetchComparison = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/admin/analytics/comparison?period=${period}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setComparison(data);
            }
        } catch (err) {
            console.error('Failed to fetch comparison:', err);
        }
    };

    const handleExport = async (format) => {
        setExporting(true);
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/admin/reports/export?format=${format}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                if (format === 'csv') {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'cases_report.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                } else {
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'cases_report.json';
                    a.click();
                    URL.revokeObjectURL(url);
                }
            }
        } catch (err) {
            console.error('Failed to export report:', err);
        } finally {
            setExporting(false);
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
                    <Icon className="w-5 h-5" style={{ color: '#0066cc' }} />
                    <h3 className="analytics-card-title">{title}</h3>
                </div>
                <div className="no-data-message">No data for this period</div>
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
                    <Icon className="w-5 h-5" style={{ color: '#0066cc' }} />
                    <h3 className="analytics-card-title">{title}</h3>
                    <span className="period-badge">{period === 'week' ? 'This Week' : 'This Month'}</span>
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
                <div className="loading-spinner-container">
                    <div className="loading-spinner"></div>
                    <p className="loading-text">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="analytics-error-container">
                <p className="error-text">Failed to load analytics data</p>
            </div>
        );
    }

    const periodLabel = period === 'week' ? 'Week' : 'Month';
    const casesThisPeriod = period === 'week' ? analytics.cases_this_week : analytics.cases_this_month;

    return (
        <div className="analytics-dashboard">
            {/* Page Header */}
            <div className="analytics-page-header">
                <div>
                    <h1 className="analytics-page-title">Analytics Dashboard</h1>
                    <p className="analytics-page-subtitle">System performance and automation efficiency insights</p>
                </div>
                <div className="analytics-actions">
                    <div className="period-selector">
                        <button
                            className={`period-btn ${period === 'week' ? 'active' : ''}`}
                            onClick={() => setPeriod('week')}
                        >
                            Week
                        </button>
                        <button
                            className={`period-btn ${period === 'month' ? 'active' : ''}`}
                            onClick={() => setPeriod('month')}
                        >
                            Month
                        </button>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('csv')}
                        disabled={exporting}
                        className="export-btn"
                    >
                        <Download className="w-4 h-4" />
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </Button>
                </div>
            </div>

            {/* Comparison Card */}
            {comparison && (
                <div className="analytics-comparison-card">
                    <div className="comparison-content">
                        <div className="comparison-period">
                            <span className="comparison-label">{comparison.current.label}</span>
                            <span className="comparison-value">{comparison.current.count}</span>
                        </div>
                        <div className="comparison-vs">vs</div>
                        <div className="comparison-period">
                            <span className="comparison-label">{comparison.previous.label}</span>
                            <span className="comparison-value">{comparison.previous.count}</span>
                        </div>
                        <div className={`comparison-change ${comparison.change_percent >= 0 ? 'positive' : 'negative'}`}>
                            {comparison.change_percent >= 0 ? (
                                <ArrowUpRight className="w-5 h-5" />
                            ) : (
                                <ArrowDownRight className="w-5 h-5" />
                            )}
                            <span>{Math.abs(comparison.change_percent)}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Key Metrics Grid */}
            <div className="analytics-metrics-grid">
                <div className="analytics-stat-card">
                    <div className="analytics-stat-icon" style={{ backgroundColor: '#ebf8ff' }}>
                        <Activity className="w-6 h-6" style={{ color: '#0066cc' }} />
                    </div>
                    <div className="analytics-stat-content">
                        <p className="analytics-stat-label">TOTAL CASES</p>
                        <p className="analytics-stat-value">{analytics.total_cases}</p>
                    </div>
                </div>

                <div className="analytics-stat-card">
                    <div className="analytics-stat-icon" style={{ backgroundColor: '#dcfce7' }}>
                        <TrendingUp className="w-6 h-6" style={{ color: '#22c55e' }} />
                    </div>
                    <div className="analytics-stat-content">
                        <p className="analytics-stat-label">CASES THIS {periodLabel.toUpperCase()}</p>
                        <p className="analytics-stat-value">{casesThisPeriod || 0}</p>
                    </div>
                </div>

                <div className="analytics-stat-card">
                    <div className="analytics-stat-icon" style={{ backgroundColor: '#ffedd5' }}>
                        <Clock className="w-6 h-6" style={{ color: '#f97316' }} />
                    </div>
                    <div className="analytics-stat-content">
                        <p className="analytics-stat-label">AVG. PROCESSING TIME</p>
                        <p className="analytics-stat-value">{formatTime(analytics.avg_processing_time_minutes)}</p>
                    </div>
                </div>

                <div className="analytics-stat-card clickable" onClick={fetchPatterns}>
                    <div className="analytics-stat-icon" style={{ backgroundColor: '#f3e8ff' }}>
                        <Brain className="w-6 h-6" style={{ color: '#a855f7' }} />
                    </div>
                    <div className="analytics-stat-content">
                        <p className="analytics-stat-label">LEARNED PATTERNS</p>
                        <p className="analytics-stat-value">{analytics.learned_patterns}</p>
                        <span className="analytics-stat-hint">{showPatterns ? '▲ Hide Details' : '▼ Show Details'}</span>
                    </div>
                </div>
            </div>

            {/* Learned Patterns Panel */}
            {showPatterns && (
                <div className="analytics-card patterns-card">
                    <div className="analytics-card-header">
                        <Brain className="w-5 h-5" style={{ color: '#0066cc' }} />
                        <h3 className="analytics-card-title">AI Memory - Learned Patterns</h3>
                    </div>
                    {patternsLoading ? (
                        <div className="patterns-loading">
                            <div className="loading-spinner small"></div>
                            <p className="loading-text">Loading patterns...</p>
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
                        <Activity className="w-5 h-5" style={{ color: '#0066cc' }} />
                        <h3 className="analytics-card-title">Status Distribution</h3>
                        <span className="period-badge">{period === 'week' ? 'This Week' : 'This Month'}</span>
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

            {/* Employee Performance */}
            {kpis?.cases_per_employee && kpis.cases_per_employee.length > 0 && (
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <Users className="w-5 h-5" style={{ color: '#0066cc' }} />
                        <h3 className="analytics-card-title">Cases per Employee</h3>
                    </div>
                    <div className="employee-performance-list">
                        {kpis.cases_per_employee.map((emp, idx) => (
                            <div key={idx} className="employee-row">
                                <span className="employee-name">{emp.name}</span>
                                <div className="employee-bar-container">
                                    <div
                                        className="employee-bar"
                                        style={{
                                            width: `${Math.min((emp.count / Math.max(...kpis.cases_per_employee.map(e => e.count), 1)) * 100, 100)}%`
                                        }}
                                    />
                                </div>
                                <span className="employee-count">{emp.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
