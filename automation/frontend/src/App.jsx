import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import UserPortal from './pages/UserPortal';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/Login';
import ContactPage from './pages/ContactPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import './App.css';

function AppContent() {
  const { isAuthenticated, logout, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPortalRoute = location.pathname === '/portal' || location.pathname === '/contact';

  const handleHelpClick = () => {
    // Navigate to user portal and trigger chatbot open
    navigate('/portal');
    // Dispatch custom event to open chatbot
    window.dispatchEvent(new CustomEvent('openChatbot'));
  };

  return (
    <div className="app">
      <main>
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? (user?.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/portal" />) : <LoginPage />
          } />
          <Route path="/" element={
            isAuthenticated
              ? (user?.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/portal" />)
              : <Navigate to="/login" />
          } />
          <Route path="/portal" element={
            isAuthenticated ? <UserPortal /> : <Navigate to="/login" />
          } />
          <Route path="/admin" element={
            isAuthenticated
              ? (user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/portal" />)
              : <Navigate to="/login" />
          } />
          <Route path="/contact" element={
            isAuthenticated ? <ContactPage /> : <Navigate to="/login" />
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;

