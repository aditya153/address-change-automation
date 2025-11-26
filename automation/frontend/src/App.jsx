import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import UserPortal from './pages/UserPortal';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="container">
            <h1>🏛️ German Address Change System</h1>
            <div className="nav-links">
              <Link to="/">User Portal</Link>
              <Link to="/admin">Admin Dashboard</Link>
            </div>
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<UserPortal />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
