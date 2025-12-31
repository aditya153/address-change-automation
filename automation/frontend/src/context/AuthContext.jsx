import React, { createContext, useContext, useState, useEffect } from 'react';
import API_URL from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check for existing token on mount
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            setIsAuthenticated(true);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    // Traditional login (for demo purposes - falls back to hardcoded)
    const login = async (username, password) => {
        // Check demo credentials (admin/admin or user/user)
        if ((username === 'admin' && password === 'admin') ||
            (username === 'user' && password === 'user')) {
            const role = username === 'admin' ? 'admin' : 'user';
            const demoUser = {
                id: role === 'admin' ? 999999 : 888888,
                username,
                name: username.charAt(0).toUpperCase() + username.slice(1),
                email: `${username}@demo.com`,
                role,
                picture: null
            };

            setIsAuthenticated(true);
            setUser(demoUser);
            localStorage.setItem('authToken', 'demo-token');
            localStorage.setItem('user', JSON.stringify(demoUser));

            return { success: true, user: demoUser };
        } else {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }
    };

    // Google OAuth login
    const loginWithGoogle = async (googleCredential) => {
        try {
            const response = await fetch(`${API_URL}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ credential: googleCredential }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Google login failed');
            }

            const data = await response.json();

            if (data.success) {
                setIsAuthenticated(true);
                setUser(data.user);
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                return { success: true, user: data.user };
            } else {
                return { success: false, message: 'Login failed' };
            }
        } catch (error) {
            console.error('Google login error:', error);
            return { success: false, message: error.message };
        }
    };

    // Get auth token for API calls
    const getAuthToken = () => {
        return localStorage.getItem('authToken');
    };

    // Check if user is admin
    const isAdmin = () => {
        return user?.role === 'admin';
    };

    const logout = () => {
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    };

    const value = {
        isAuthenticated,
        user,
        loading,
        login,
        loginWithGoogle,
        logout,
        getAuthToken,
        isAdmin
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
