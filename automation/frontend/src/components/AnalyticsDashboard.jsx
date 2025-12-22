// src/components/AnalyticsDashboard.jsx
import { useState, useEffect } from 'react';
import './AnalyticsDashboard.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AnalyticsDashboard({ isOpen, onClose }) {
    const [analytics, setAnalytics] = useState(null);
    const [patterns, setPatterns] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPatterns, setShowPatterns] = useState(false);
    const [patternsLoading, setPatternsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchAnalytics();
            setShowPatterns(false);
            setPatterns(null);
        }
    }, [isOpen]);

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

    if (!isOpen) return null;

    const formatTime = (minutes) => {
        if (!minutes || minutes < 1) return '< 1m';
        if (minutes < 60) return `${Math.round(minutes)}m`;
        return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
    };

    // Prepare pie chart data
    const getSourcePieData = () => {
        if (!analytics?.source_breakdown) return [];
        const colors = { portal: '#3b82f6', email: '#8b5cf6' };
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

    // SVG Pie Chart with legend below
    const PieChart = ({ data, title }) => {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total === 0) return (
            <div className="chart-card">
                <h4>{title}</h4>
                <div className="no-data">No data available</div>
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
            <div className="chart-card">
                <h4>{title}</h4>
                <div className="chart-content">
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
                        <text x="50" y="50" textAnchor="middle" dy=".3em" className="pie-total">
                            {total}
                        </text>
                    </svg>
                </div>
                <div className="chart-legend">
                    {segments.map((segment, i) => (
                        <div key={i} className="legend-row">
                            <div className="legend-info">
                                <span className="legend-dot" style={{ backgroundColor: segment.color }}></span>
                                <span className="legend-text">{segment.label}</span>
                            </div>
                            <span className="legend-num">{segment.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="analytics-overlay" onClick={onClose}>
            <div className="analytics-modal-wide" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="analytics-header">
                    <div className="analytics-title">
                        <i className="bi bi-graph-up-arrow"></i>
                        <h2>Analytics Overview</h2>
                    </div>
                    <button className="analytics-close" onClick={onClose}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="analytics-body">
                    {loading ? (
                        <div className="analytics-loading">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : analytics ? (
                        <>
                            {/* Stats Row */}
                            <div className="stats-grid">
                                <div className="analytics-stat-card analytics-stat-card-blue">
                                    <span className="stat-emoji">📥</span>
                                    <div className="stat-number">{analytics.total_cases}</div>
                                    <div className="stat-name">Total Cases</div>
                                </div>
                                <div className="analytics-stat-card analytics-stat-card-green">
                                    <span className="stat-emoji">🤖</span>
                                    <div className="stat-number">{analytics.automation_rate}%</div>
                                    <div className="stat-name">Automation Rate</div>
                                </div>
                                <div className="analytics-stat-card analytics-stat-card-orange">
                                    <span className="stat-emoji">⏱️</span>
                                    <div className="stat-number">{formatTime(analytics.avg_processing_time_minutes)}</div>
                                    <div className="stat-name">Avg. Processing</div>
                                </div>
                                <div className="analytics-stat-card analytics-stat-card-blue stat-card-click" onClick={fetchPatterns}>
                                    <span className="stat-emoji">🧠</span>
                                    <div className="stat-number">{analytics.learned_patterns}</div>
                                    <div className="stat-name">Learned Patterns</div>
                                    <span className="click-hint">{showPatterns ? '▲ Hide' : '▼ Show'}</span>
                                </div>
                            </div>

                            {/* Patterns Panel */}
                            {showPatterns && (
                                <div className="patterns-panel">
                                    <h4>🧠 AI Memory - Learned Patterns</h4>
                                    {patternsLoading ? (
                                        <div className="patterns-loading">Loading...</div>
                                    ) : patterns && patterns.length > 0 ? (
                                        <div className="patterns-scroll">
                                            <table className="patterns-tbl">
                                                <thead>
                                                    <tr>
                                                        <th>Original</th>
                                                        <th></th>
                                                        <th>Corrected</th>
                                                        <th>Type</th>
                                                        <th>Uses</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {patterns.map((p, i) => (
                                                        <tr key={i}>
                                                            <td><code className="code-red">{p.original}</code></td>
                                                            <td className="arrow-col">→</td>
                                                            <td><code className="code-green">{p.corrected}</code></td>
                                                            <td className="type-col">{p.type.replace(/_/g, ' ')}</td>
                                                            <td className="uses-col">{p.frequency}×</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="no-patterns">No patterns learned yet</div>
                                    )}
                                </div>
                            )}

                            {/* Charts Row */}
                            <div className="charts-grid">
                                <PieChart data={getSourcePieData()} title="📨 Submission Sources" />
                                <PieChart data={getHitlPieData()} title="⚙️ Processing Method" />
                            </div>

                            {/* Status Distribution */}
                            {analytics.status_breakdown && Object.keys(analytics.status_breakdown).length > 0 && (
                                <div className="status-panel">
                                    <h4>📊 Status Distribution</h4>
                                    <div className="status-tags">
                                        {Object.entries(analytics.status_breakdown).map(([status, count]) => (
                                            <span key={status} className="status-tag">
                                                {status.replace(/_/g, ' ')} <b>{count}</b>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="no-data">Failed to load analytics</div>
                    )}
                </div>
            </div>
        </div>
    );
}
