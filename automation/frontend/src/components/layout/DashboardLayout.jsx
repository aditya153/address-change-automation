import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BarChart3, Settings, LogOut, Search, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../pages/AdminDashboard.css'; // Ensure CSS is available

export const DashboardLayout = ({ children, activeNav, onNavChange }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="admin-dashboard-root">
            {/* Government Banner */}
            <div className="admin-gov-banner">
                <div className="gov-banner-left">
                    <span className="gov-flag">🇩🇪</span>
                    <span>An official website of the Federal Republic of Germany</span>
                </div>
            </div>

            {/* SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <div className="sidebar-icon">
                            <LayoutDashboard className="w-6 h-6 text-white" />
                        </div>
                        <div className="sidebar-brand-text">
                            <span className="brand-name">Bürgerportal</span>
                            <span className="brand-subtitle">Admin Panel</span>
                        </div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    <button
                        className={`sidebar-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
                        onClick={() => onNavChange('dashboard')}
                    >
                        <LayoutDashboard size={18} />
                        <span>Dashboard</span>
                    </button>
                    <button
                        className={`sidebar-nav-item ${activeNav === 'cases' ? 'active' : ''}`}
                        onClick={() => onNavChange('cases')}
                    >
                        <FileText size={18} />
                        <span>Cases</span>
                    </button>
                    <button
                        className={`sidebar-nav-item ${activeNav === 'citizens' ? 'active' : ''}`}
                        onClick={() => onNavChange('citizens')}
                    >
                        <Users size={18} />
                        <span>Citizens</span>
                    </button>
                    <button
                        className={`sidebar-nav-item ${activeNav === 'analytics' ? 'active' : ''}`}
                        onClick={() => onNavChange('analytics')}
                    >
                        <BarChart3 size={18} />
                        <span>Analytics</span>
                    </button>
                    <button
                        className={`sidebar-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
                        onClick={() => onNavChange('settings')}
                    >
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>
                    {/* Show Users tab ONLY for Real Admins */}
                    {user && user.role === 'admin' && user.id !== 999999 && (
                        <button
                            className={`sidebar-nav-item ${activeNav === 'users' ? 'active' : ''}`}
                            onClick={() => onNavChange('users')}
                        >
                            <Users size={18} />
                            <span>Users</span>
                        </button>
                    )}
                </nav>
                <div className="sidebar-footer">
                    <button className="sidebar-signout" onClick={() => { logout(); navigate('/login'); }}>
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* MAIN WRAPPER */}
            <div className="admin-main-wrapper">
                {/* TOP HEADER */}
                <header className="admin-top-header">
                    <div className="header-search">
                        <Search size={18} className="text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search cases, citizens..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="header-actions">
                        <button className="header-notification">
                            <Bell size={20} />
                            <span className="notification-badge"></span>
                        </button>
                        <div className="header-user">
                            <button
                                className="user-dropdown-trigger"
                                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                            >
                                <span className="user-avatar">AD</span>
                                <span className="user-name">Admin</span>
                                <ChevronDown size={16} />
                            </button>
                            {userDropdownOpen && (
                                <div className="user-dropdown-menu">
                                    <button onClick={() => setUserDropdownOpen(false)}>Profile</button>
                                    <button onClick={() => setUserDropdownOpen(false)}>Settings</button>
                                    <button className="signout-option" onClick={() => { logout(); navigate('/login'); }}>Sign Out</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* MAIN CONTENT */}
                <main className="page-content">
                    <div className="container-fluid">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
