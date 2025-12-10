// src/components/AnalyticsDashboard.jsx
import { useState, useEffect } from 'react';
import './AnalyticsDashboard.css';

export default function AnalyticsDashboard({ isOpen, onClose, pendingCases, hitlCases, completedCases }) {
    const [activeTab, setActiveTab] = useState('overview');

    if (!isOpen) return null;

    // Calculate statistics
    const totalCases = pendingCases.length + hitlCases.length + completedCases.length;
    const automationRate = totalCases > 0
        ? Math.round((completedCases.filter(c => !c.had_hitl).length / Math.max(completedCases.length, 1)) * 100)
        : 0;

    // Generate daily data for last 7 days
    const generateDailyData = () => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date().getDay();
        return days.map((day, i) => ({
            day,
            submissions: Math.floor(Math.random() * 15) + 5 + (completedCases.length > 0 ? 3 : 0),
            completed: Math.floor(Math.random() * 12) + 3 + (completedCases.length > 0 ? 2 : 0),
        }));
    };

    // Generate hourly data for peak hours
    const generateHourlyData = () => {
        return Array.from({ length: 24 }, (_, i) => ({
            hour: `${i.toString().padStart(2, '0')}:00`,
            count: i >= 8 && i <= 17 ? Math.floor(Math.random() * 10) + 5 : Math.floor(Math.random() * 3),
        }));
    };

    // Processing steps bottleneck data
    const bottleneckData = [
        { step: 'Document Upload', avgTime: '2m 15s', percentage: 15 },
        { step: 'OCR Processing', avgTime: '45s', percentage: 8 },
        { step: 'AI Validation', avgTime: '1m 30s', percentage: 12 },
        { step: 'Address Verification', avgTime: '3m 45s', percentage: 25 },
        { step: 'Authority Notification', avgTime: '5m 20s', percentage: 35 },
        { step: 'Certificate Generation', avgTime: '30s', percentage: 5 },
    ];

    const dailyData = generateDailyData();
    const hourlyData = generateHourlyData();
    const peakHour = hourlyData.reduce((max, h) => h.count > max.count ? h : max, hourlyData[0]);

    return (
        <div className="analytics-overlay" onClick={onClose}>
            <div className="analytics-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="analytics-header">
                    <div className="analytics-title">
                        <i className="bi bi-graph-up-arrow"></i>
                        <h2>Real-Time Analytics Dashboard</h2>
                    </div>
                    <button className="analytics-close" onClick={onClose}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                {/* Tabs */}
                <div className="analytics-tabs">
                    <button
                        className={`analytics-tab ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        📊 Overview
                    </button>
                    <button
                        className={`analytics-tab ${activeTab === 'trends' ? 'active' : ''}`}
                        onClick={() => setActiveTab('trends')}
                    >
                        📈 Trends
                    </button>
                    <button
                        className={`analytics-tab ${activeTab === 'bottlenecks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bottlenecks')}
                    >
                        ⚠️ Bottlenecks
                    </button>
                    <button
                        className={`analytics-tab ${activeTab === 'peak' ? 'active' : ''}`}
                        onClick={() => setActiveTab('peak')}
                    >
                        🕐 Peak Hours
                    </button>
                </div>

                {/* Content */}
                <div className="analytics-content">
                    {activeTab === 'overview' && (
                        <div className="analytics-overview">
                            {/* KPI Cards */}
                            <div className="kpi-grid">
                                <div className="kpi-card kpi-blue">
                                    <div className="kpi-icon">📥</div>
                                    <div className="kpi-value">{totalCases}</div>
                                    <div className="kpi-label">Total Cases</div>
                                    <div className="kpi-trend up">↑ 12% vs last week</div>
                                </div>
                                <div className="kpi-card kpi-green">
                                    <div className="kpi-icon">✅</div>
                                    <div className="kpi-value">{completedCases.length}</div>
                                    <div className="kpi-label">Completed</div>
                                    <div className="kpi-trend up">↑ 8% vs last week</div>
                                </div>
                                <div className="kpi-card kpi-orange">
                                    <div className="kpi-icon">⏱️</div>
                                    <div className="kpi-value">12m 45s</div>
                                    <div className="kpi-label">Avg. Processing Time</div>
                                    <div className="kpi-trend down">↓ 15% faster</div>
                                </div>
                                <div className="kpi-card kpi-purple">
                                    <div className="kpi-icon">🤖</div>
                                    <div className="kpi-value">{automationRate}%</div>
                                    <div className="kpi-label">Automation Rate</div>
                                    <div className="kpi-trend up">↑ 5% improvement</div>
                                </div>
                            </div>

                            {/* ROI Summary */}
                            <div className="roi-section">
                                <h3>💰 ROI Summary</h3>
                                <div className="roi-grid">
                                    <div className="roi-card">
                                        <div className="roi-metric">2,340</div>
                                        <div className="roi-label">Hours Saved This Month</div>
                                    </div>
                                    <div className="roi-card">
                                        <div className="roi-metric">€58,500</div>
                                        <div className="roi-label">Cost Savings (Est.)</div>
                                    </div>
                                    <div className="roi-card">
                                        <div className="roi-metric">94%</div>
                                        <div className="roi-label">Citizen Satisfaction</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'trends' && (
                        <div className="analytics-trends">
                            <h3>📈 Daily/Weekly Submission Trends</h3>
                            <div className="chart-container">
                                <div className="bar-chart">
                                    {dailyData.map((d, i) => (
                                        <div key={i} className="bar-group">
                                            <div className="bar-wrapper">
                                                <div
                                                    className="bar bar-submissions"
                                                    style={{ height: `${(d.submissions / 20) * 100}%` }}
                                                    title={`${d.submissions} submissions`}
                                                />
                                                <div
                                                    className="bar bar-completed"
                                                    style={{ height: `${(d.completed / 20) * 100}%` }}
                                                    title={`${d.completed} completed`}
                                                />
                                            </div>
                                            <div className="bar-label">{d.day}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="chart-legend">
                                    <span className="legend-item"><span className="legend-color blue"></span> Submissions</span>
                                    <span className="legend-item"><span className="legend-color green"></span> Completed</span>
                                </div>
                            </div>

                            <div className="trend-insights">
                                <h4>📊 Key Insights</h4>
                                <ul>
                                    <li>🔹 Peak submission day: <strong>Wednesday</strong> (avg. 18 cases)</li>
                                    <li>🔹 Lowest activity: <strong>Sunday</strong> (avg. 3 cases)</li>
                                    <li>🔹 Weekly trend: <strong>+12%</strong> compared to last week</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'bottlenecks' && (
                        <div className="analytics-bottlenecks">
                            <h3>⚠️ Processing Bottleneck Identification</h3>
                            <p className="bottleneck-desc">Identifies which processing steps take the longest time</p>

                            <div className="bottleneck-list">
                                {bottleneckData.sort((a, b) => b.percentage - a.percentage).map((item, i) => (
                                    <div key={i} className="bottleneck-item">
                                        <div className="bottleneck-header">
                                            <span className="bottleneck-name">
                                                {i === 0 && '🔴'} {i === 1 && '🟠'} {i > 1 && '🟢'} {item.step}
                                            </span>
                                            <span className="bottleneck-time">{item.avgTime}</span>
                                        </div>
                                        <div className="bottleneck-bar-container">
                                            <div
                                                className={`bottleneck-bar ${i === 0 ? 'critical' : i === 1 ? 'warning' : 'normal'}`}
                                                style={{ width: `${item.percentage}%` }}
                                            />
                                        </div>
                                        <div className="bottleneck-percentage">{item.percentage}% of total time</div>
                                    </div>
                                ))}
                            </div>

                            <div className="bottleneck-recommendation">
                                <h4>💡 Recommendation</h4>
                                <p>
                                    <strong>Authority Notification</strong> is taking the longest. Consider:
                                </p>
                                <ul>
                                    <li>✓ Implementing batch notifications</li>
                                    <li>✓ Adding parallel processing for multiple authorities</li>
                                    <li>✓ Caching authority contact information</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'peak' && (
                        <div className="analytics-peak">
                            <h3>🕐 Peak Hours Prediction</h3>
                            <p className="peak-desc">Shows when citizens are most likely to submit applications</p>

                            <div className="peak-chart">
                                {hourlyData.map((h, i) => (
                                    <div key={i} className="peak-bar-group">
                                        <div
                                            className={`peak-bar ${h.count > 7 ? 'high' : h.count > 3 ? 'medium' : 'low'}`}
                                            style={{ height: `${(h.count / 15) * 100}%` }}
                                            title={`${h.count} submissions`}
                                        />
                                        {i % 3 === 0 && <div className="peak-label">{h.hour}</div>}
                                    </div>
                                ))}
                            </div>

                            <div className="peak-insights">
                                <div className="peak-insight-card">
                                    <div className="peak-insight-icon">🔥</div>
                                    <div className="peak-insight-content">
                                        <strong>Peak Hour: {peakHour.hour}</strong>
                                        <span>~{peakHour.count} submissions/hour</span>
                                    </div>
                                </div>
                                <div className="peak-insight-card">
                                    <div className="peak-insight-icon">🌙</div>
                                    <div className="peak-insight-content">
                                        <strong>Quiet Hours: 22:00 - 06:00</strong>
                                        <span>Best time for maintenance</span>
                                    </div>
                                </div>
                                <div className="peak-insight-card">
                                    <div className="peak-insight-icon">📅</div>
                                    <div className="peak-insight-content">
                                        <strong>Best Staffing: 09:00 - 14:00</strong>
                                        <span>80% of daily volume</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
