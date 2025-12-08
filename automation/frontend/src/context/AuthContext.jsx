import React, { createContext, useContext, useState } from 'react';

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

    const login = async (username, password) => {
        // Check credentials (admin/admin)
        if (username === 'admin' && password === 'admin') {
            setIsAuthenticated(true);
            setUser({ username: 'admin' });
            return { success: true };
        } else {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }
    };

    const logout = () => {
        setIsAuthenticated(false);
        setUser(null);
    };

    const value = {
        isAuthenticated,
        user,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
