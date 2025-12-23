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
            <div className="login-outer-box">
                <div className="login-card">
                    <h2>Admin Login</h2>
                    <p className="login-subtitle">Address Change Automation System</p>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                        </div>
                        <button type="submit" className="btn-login">Sign In</button>
                    </form>

                    <div className="demo-credentials">
                        <p className="demo-title">🔑 Demo Credentials</p>
                        <p><strong>Username:</strong> admin</p>
                        <p><strong>Password:</strong> admin</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;