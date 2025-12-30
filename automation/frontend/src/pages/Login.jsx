import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const result = await login(username, password);
        if (result.success) {
            navigate('/admin');
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="login-page">
            {/* Top Banner */}
            <div className="gov-banner">
                <div className="gov-banner-content">
                    <span className="gov-banner-flag">🇩🇪</span>
                    <span className="gov-banner-text">An official website of the Federal Republic of Germany</span>
                </div>
                <button className="gov-banner-link">How you know →</button>
            </div>

            <div className="login-container">
                {/* Left Panel - Dark Blue */}
                <div className="login-left-panel">
                    <div className="login-left-content">
                        {/* Branding */}
                        <div className="portal-branding">
                            <div className="portal-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <line x1="3" y1="9" x2="21" y2="9" />
                                    <line x1="9" y1="21" x2="9" y2="9" />
                                </svg>
                            </div>
                            <div className="portal-info">
                                <h2 className="portal-name">Bürgerportal</h2>
                                <span className="portal-subtitle">Residents' Registration Office</span>
                            </div>
                        </div>

                        {/* Main Title */}
                        <div className="login-hero">
                            <h1 className="login-title">
                                Address Change<br />
                                Automation System
                            </h1>
                            <div className="title-underline"></div>
                            <p className="login-description">
                                Streamlined digital services for German residents.
                                Submit your address change documents securely
                                online.
                            </p>
                        </div>

                        {/* GDPR Footer */}
                        <div className="gdpr-section">
                            <div className="gdpr-badge">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <div className="gdpr-text">
                                    <strong>GDPR Compliant</strong>
                                    <span>Your data is protected by German law</span>
                                </div>
                            </div>
                            <p className="copyright">© 2025 Citizen Portal. All rights reserved.</p>
                        </div>
                    </div>
                </div>

                {/* Right Panel - White */}
                <div className="login-right-panel">
                    <div className="login-form-container">
                        <h2 className="form-title">Sign In</h2>
                        <p className="form-subtitle">Access the administrative portal</p>

                        {error && <div className="error-message">{error}</div>}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Username</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter username"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn-login">
                                Sign In <span className="btn-arrow">›</span>
                            </button>
                        </form>

                        {/* Demo Credentials */}
                        <div className="demo-credentials">
                            <p className="demo-title">Demo Credentials</p>
                            <div className="credentials-grid">
                                <div className="credential-item">
                                    <span className="credential-label">Admin Access</span>
                                    <code>admin / admin</code>
                                </div>
                                <div className="credential-item">
                                    <span className="credential-label">User Access</span>
                                    <code>user / user</code>
                                </div>
                            </div>
                        </div>

                        {/* Data Protection Notice */}
                        <p className="protection-notice">
                            Protected under the Federal Data Protection Act (BDSG)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;