import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, ChevronDown, Sparkles, Clock, FileCheck, AlertTriangle, HelpCircle, Phone, Mail, ArrowRight, MessageCircle, X, Bot, Send, FileText, ExternalLink, ChevronRight, Save, Trash2, Check } from 'lucide-react';
import NeighborhoodMap from '../components/NeighborhoodMap';
import './UserPortal.css';

import API_URL from '../utils/api';

function UserPortal() {
    const { t, language } = useLanguage();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Form state
    const [email, setEmail] = useState('');
    const [landlordPdf, setLandlordPdf] = useState(null);
    const [addressPdf, setAddressPdf] = useState(null);
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [message, setMessage] = useState('');
    const [success, setSuccess] = useState(false);

    // Extracted data state
    const [extractedData, setExtractedData] = useState(null);
    const [isExtracted, setIsExtracted] = useState(false);
    const [citizenName, setCitizenName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dob, setDob] = useState('');
    const [oldAddress, setOldAddress] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [moveInDate, setMoveInDate] = useState('');
    const [landlordName, setLandlordName] = useState('');

    // Chatbot state
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [showUploadToast, setShowUploadToast] = useState(false);
    const [showGoodbye, setShowGoodbye] = useState(false);

    const messagesEndRef = useRef(null);
    const chatInputRef = useRef(null);

    // Initialize chat greeting
    useEffect(() => {
        setChatMessages([{ text: t('chatGreeting'), sender: 'bot' }]);
    }, [language]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, chatLoading]);

    useEffect(() => {
        if (chatOpen && chatInputRef.current && !chatLoading) {
            chatInputRef.current.focus();
        }
    }, [chatOpen, chatLoading]);

    // Extract data when both PDFs are uploaded
    useEffect(() => {
        if (landlordPdf && addressPdf && !extractedData && !extracting) {
            handleExtractPreview();
        }
    }, [landlordPdf, addressPdf]);

    const handleExtractPreview = async () => {
        if (!landlordPdf || !addressPdf) return;

        setExtracting(true);
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('landlord_pdf', landlordPdf);
            formData.append('address_pdf', addressPdf);

            const response = await axios.post(`${API_URL}/extract-preview`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const data = response.data.extracted_data;
                setExtractedData(data);
                setIsExtracted(true);

                // Split name into first/last
                const nameParts = (data.citizen_name || '').split(' ');
                setFirstName(nameParts[0] || '');
                setLastName(nameParts.slice(1).join(' ') || '');
                setCitizenName(data.citizen_name || '');
                setDob(data.dob || '');
                setOldAddress(data.old_address_raw || '');
                setNewAddress(data.new_address_raw || '');
                setMoveInDate(data.move_in_date_raw || '');
                setLandlordName(data.landlord_name || '');
            }
        } catch (error) {
            console.error('Extraction error:', error);
            // Show empty form for manual entry
            setExtractedData({});
            setIsExtracted(false);
        } finally {
            setExtracting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !landlordPdf || !addressPdf) {
            setMessage(language === 'de'
                ? 'Bitte füllen Sie alle Pflichtfelder aus.'
                : 'Please fill in all required fields.');
            setSuccess(false);
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('landlord_pdf', landlordPdf);
            formData.append('address_pdf', addressPdf);

            const response = await axios.post(`${API_URL}/submit-case`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setMessage(response.data.message || 'Antrag erfolgreich eingereicht!');
            setSuccess(true);
            // Reset form
            setEmail('');
            setLandlordPdf(null);
            setAddressPdf(null);
            setExtractedData(null);
            setIsExtracted(false);
        } catch (error) {
            setMessage(error.response?.data?.detail || 'Einreichung fehlgeschlagen.');
            setSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    const handleFileClick = (inputId) => {
        document.getElementById(inputId).click();
    };

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || chatLoading) return;

        const userMessage = chatInput.trim();
        setChatMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
        setChatInput('');
        setChatLoading(true);

        try {
            const response = await axios.post(`${API_URL}/chat`, { message: userMessage });
            setChatMessages(prev => [...prev, {
                text: response.data.reply,
                sender: 'bot',
                hasPreview: response.data.has_document_preview,
                documentUrl: response.data.document_url,
                documentUrl2: response.data.document_url2
            }]);
        } catch {
            setChatMessages(prev => [...prev, {
                text: 'Entschuldigung, es gibt ein Verbindungsproblem.',
                sender: 'bot'
            }]);
        } finally {
            setChatLoading(false);
        }
    };

    const getCompletedSteps = () => {
        const completed = [];
        if ((landlordPdf && addressPdf) && isExtracted) completed.push(1);
        if (firstName && lastName) completed.push(2);
        if (newAddress && oldAddress) completed.push(3);
        return completed;
    };

    const getCurrentStep = () => {
        if (!landlordPdf || !addressPdf) return 1;
        if (!firstName) return 2;
        if (!newAddress) return 3;
        return 4;
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleCloseChatbot = () => {
        setChatOpen(false);
        setShowGoodbye(true);
        setTimeout(() => setShowGoodbye(false), 2500);
    };

    const completedSteps = getCompletedSteps();
    const currentStep = getCurrentStep();

    return (
        <div className="portal-page">
            <header className="portal-header">
                <div className="header-inner">
                    <div className="header-brand">
                        <div className="brand-logo">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            <span className="sparkle-badge">✦</span>
                        </div>
                        <div className="brand-text">
                            <span className="brand-name">Bürgerportal</span>
                            <span className="brand-sub">DIGITAL ADMINISTRATION</span>
                        </div>
                    </div>

                    <nav className="header-nav">
                        <button className="nav-btn active">My Applications</button>
                        <button className="nav-btn">Documents</button>
                        <button className="nav-btn">Messages</button>
                        <button className="nav-btn">Help</button>
                    </nav>

                    <div className="header-actions">
                        <button className="notification-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </button>

                        <div className="header-divider"></div>

                        <div className="user-profile">
                            <div className="avatar-wrapper">
                                <div className="user-avatar">
                                    <User color="white" size={20} strokeWidth={2.5} />
                                </div>
                                <span className="avatar-status"></span>
                            </div>
                            <div className="user-details">
                                <span className="user-name">{user?.name || 'User'}</span>
                                <span className="user-id">ID: {user?.id || '888888'}</span>
                            </div>
                        </div>

                        {user?.role === 'admin' && (
                            <button className="admin-btn" onClick={() => navigate('/admin')}>Admin</button>
                        )}

                        <button className="signout-btn" onClick={handleLogout} title="Sign Out">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-bg">
                    <div className="hero-blob blob-1"></div>
                    <div className="hero-blob blob-2"></div>
                    <div className="hero-pattern"></div>
                </div>
                <div className="hero-content">
                    <div className="ai-tag">
                        <span>✨</span>
                        <span>AI-Powered Data Extraction</span>
                    </div>
                    <h1 className="hero-title">
                        Address Change<br />
                        <span>Fast & Easy</span>
                    </h1>
                    <p className="hero-desc">
                        Upload your document – our AI does the rest.
                        No more manual data entry required.
                    </p>
                </div>
                <div className="hero-wave">
                    <svg viewBox="0 0 1440 120" fill="none" preserveAspectRatio="none">
                        <path d="M0 120L0 60C360 60 540 0 900 0C1260 0 1440 40 1440 40L1440 120L0 120Z" />
                    </svg>
                </div>
            </section>

            {/* Progress Stepper */}
            <div className="stepper-container">
                <div className="stepper-card">
                    <div className="stepper">
                        <div className="stepper-line">
                            <div
                                className="stepper-progress"
                                style={{ width: `${(Math.max(...completedSteps, 0) / 3) * 100}%` }}
                            ></div>
                        </div>
                        {[
                            { id: 1, title: 'Document', desc: 'Upload' },
                            { id: 2, title: 'Personal', desc: 'Verify' },
                            { id: 3, title: 'Address', desc: 'Review' },
                            { id: 4, title: 'Submit', desc: 'Done' }
                        ].map(step => (
                            <div key={step.id} className={`step ${completedSteps.includes(step.id) ? 'completed' : ''} ${currentStep === step.id ? 'current' : ''}`}>
                                <div className="step-circle-wrapper">
                                    {currentStep === step.id && <div className="step-ping"></div>}
                                    <div className="step-circle">
                                        {completedSteps.includes(step.id) ? '✓' : currentStep === step.id ? <Sparkles size={18} /> : step.id}
                                    </div>
                                </div>
                                <span className="step-title">{step.title}</span>
                                <span className="step-desc">{step.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="main-content">
                <div className="content-grid">
                    {/* Form Column */}
                    <div className="form-column">
                        {/* Alert */}
                        {message && (
                            <div className={`alert ${success ? 'success' : 'error'}`}>
                                {message}
                            </div>
                        )}

                        {/* Document Upload Card */}
                        <div className="upload-card">
                            <div className="card-glow"></div>
                            <div className="card-header">
                                <div className="card-icon">
                                    <span>📄</span>
                                    <span className="icon-badge">✨</span>
                                </div>
                                <div className="card-title-group">
                                    <h2>Upload Documents</h2>
                                    <p>Our AI analyzes your documents and fills all fields automatically</p>
                                </div>
                            </div>

                            <div className="upload-grid">
                                {/* Address PDF */}
                                <div
                                    className={`upload-zone ${addressPdf ? 'has-file' : ''} ${extracting ? 'extracting' : ''}`}
                                    onClick={() => handleFileClick('addressPdf')}
                                >
                                    <input
                                        id="addressPdf"
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            setAddressPdf(e.target.files[0]);
                                            setExtractedData(null);
                                            setIsExtracted(false);
                                            setShowUploadToast(true);
                                            setTimeout(() => setShowUploadToast(false), 3000);
                                        }}
                                    />
                                    {extracting && addressPdf ? (
                                        <div className="upload-loading">
                                            <div className="loader"></div>
                                            <span>AI analyzing...</span>
                                        </div>
                                    ) : addressPdf ? (
                                        <div className="upload-success">
                                            <div className="success-icon-wrapper">
                                                <span className="success-icon"><Check size={32} strokeWidth={1.5} /></span>
                                                <button
                                                    className="remove-file-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAddressPdf(null);
                                                        setExtractedData(null);
                                                        setIsExtracted(false);
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="success-text-wrapper">
                                                <span className="success-title">Successfully processed!</span>
                                                <span className="file-name-subtext">{addressPdf.name}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="upload-placeholder">
                                            <span className="upload-icon">📋</span>
                                            <span className="upload-label">Registration Certificate</span>
                                            <span className="upload-hint">PDF • Max. 10 MB</span>
                                        </div>
                                    )}
                                </div>

                                {/* Landlord PDF */}
                                <div
                                    className={`upload-zone ${landlordPdf ? 'has-file' : ''} ${extracting ? 'extracting' : ''}`}
                                    onClick={() => handleFileClick('landlordPdf')}
                                >
                                    <input
                                        id="landlordPdf"
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            setLandlordPdf(e.target.files[0]);
                                            setExtractedData(null);
                                            setIsExtracted(false);
                                            setShowUploadToast(true);
                                            setTimeout(() => setShowUploadToast(false), 3000);
                                        }}
                                    />
                                    {extracting && landlordPdf ? (
                                        <div className="upload-loading">
                                            <div className="loader"></div>
                                            <span>AI analyzing...</span>
                                        </div>
                                    ) : landlordPdf ? (
                                        <div className="upload-success">
                                            <div className="success-icon-wrapper">
                                                <span className="success-icon"><Check size={32} strokeWidth={1.5} /></span>
                                                <button
                                                    className="remove-file-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setLandlordPdf(null);
                                                        setExtractedData(null);
                                                        setIsExtracted(false);
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="success-text-wrapper">
                                                <span className="success-title">Successfully processed!</span>
                                                <span className="file-name-subtext">{landlordPdf.name}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="upload-placeholder">
                                            <span className="upload-icon">🏠</span>
                                            <span className="upload-label">Landlord Confirmation</span>
                                            <span className="upload-hint">PDF • Max. 10 MB</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="upload-features">
                                <div className="feature">
                                    <div className="feature-icon blue">⚡</div>
                                    <div>
                                        <strong>Lightning Fast</strong>
                                        <span>Done in seconds</span>
                                    </div>
                                </div>
                                <div className="feature">
                                    <div className="feature-icon green">🛡️</div>
                                    <div>
                                        <strong>GDPR Compliant</strong>
                                        <span>Highest security</span>
                                    </div>
                                </div>
                            </div>
                        </div>



                        {/* Actions */}
                        <div className="form-actions">
                            <button className="btn-secondary btn-small">
                                <Save size={16} />
                                <span>Save Draft</span>
                            </button>
                            <div className="btn-group">
                                <button
                                    className="btn-primary btn-next"
                                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                >
                                    <span>Next</span>
                                    <ChevronRight size={18} />
                                </button>
                                {/* Submit button - hidden for now, will be used later
                                <button
                                    className={`btn-submit ${loading ? 'loading' : ''}`}
                                    onClick={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <div className="btn-loader"></div>
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Submit</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                                */}
                            </div>
                        </div>

                        {success && <NeighborhoodMap address="Kaiserslautern, Germany" />}
                    </div>

                    {/* Sidebar */}
                    <aside className="sidebar">
                        {/* Quick Info */}
                        <div className="sidebar-card">
                            <div className="card-accent"></div>
                            <h4><Sparkles size={18} className="sparkle-icon" /> Important Notes</h4>
                            <div className="info-list">
                                <div className="info-item">
                                    <div className="info-icon orange">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <strong>14-Day Deadline</strong>
                                        <span>Register after moving in</span>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <div className="info-icon blue">
                                        <FileCheck size={20} />
                                    </div>
                                    <div>
                                        <strong>Valid ID Required</strong>
                                        <span>ID Card or Passport</span>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <div className="info-icon yellow">
                                        <AlertTriangle size={20} />
                                    </div>
                                    <div>
                                        <strong>Landlord Confirmation</strong>
                                        <span>Submit if required</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Help Card */}
                        <div className="help-card">
                            <div className="help-header">
                                <div className="help-icon">
                                    <HelpCircle size={28} />
                                </div>
                                <div>
                                    <strong>Need Help?</strong>
                                    <span>We're here for you</span>
                                </div>
                            </div>
                            <div className="help-contacts">
                                <div><Phone size={16} /> 0800 123 4567 (free)</div>
                                <div><Mail size={16} /> help@citizenportal.com</div>
                            </div>
                            <button className="help-btn">
                                Open FAQ <ArrowRight size={16} />
                            </button>
                        </div>


                    </aside>
                </div>
            </main>

            {/* Footer */}
            <footer className="portal-footer">
                <div className="footer-content">
                    <span>© 2025 Federal Republic of Germany. All rights reserved.</span>
                    <div className="footer-links">
                        <a href="#">Imprint</a>
                        <a href="#">Privacy Policy</a>
                        <a href="#">Accessibility</a>
                    </div>
                </div>
            </footer>

            {/* Chatbot FAB */}
            <button className={`chat-fab ${chatOpen ? 'active' : ''}`} onClick={() => setChatOpen(!chatOpen)}>
                {chatOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>

            {/* Chatbot Window */}
            {chatOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <div className="chat-bot-info">
                            <span className="bot-avatar">
                                <Bot size={22} />
                            </span>
                            <div>
                                <strong>Assistant</strong>
                                <span className="bot-status">● Online</span>
                            </div>
                        </div>
                        <button onClick={handleCloseChatbot}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="chat-messages">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`chat-msg ${msg.sender}`}>
                                {msg.sender === 'bot' && (
                                    <span className="msg-avatar">
                                        <Bot size={16} />
                                    </span>
                                )}
                                {msg.sender === 'user' ? (
                                    <div className="msg-bubble">{msg.text}</div>
                                ) : (
                                    <div className="msg-content">
                                        <div className="msg-bubble">{msg.text}</div>
                                        {msg.hasPreview && (
                                            <div className="doc-previews">
                                                {msg.documentUrl && (
                                                    <div
                                                        className="doc-preview-card"
                                                        onClick={() => setPreviewImage(`${API_URL}${msg.documentUrl}`)}
                                                    >
                                                        <div className="doc-preview-icon">
                                                            <FileText size={24} />
                                                        </div>
                                                        <div className="doc-preview-info">
                                                            <span className="doc-preview-title">Landlord Certificate</span>
                                                            <span className="doc-preview-action">Click to view <ExternalLink size={12} /></span>
                                                        </div>
                                                    </div>
                                                )}
                                                {msg.documentUrl2 && (
                                                    <div
                                                        className="doc-preview-card"
                                                        onClick={() => setPreviewImage(`${API_URL}${msg.documentUrl2}`)}
                                                    >
                                                        <div className="doc-preview-icon">
                                                            <FileText size={24} />
                                                        </div>
                                                        <div className="doc-preview-info">
                                                            <span className="doc-preview-title">Address Change Form</span>
                                                            <span className="doc-preview-action">Click to view <ExternalLink size={12} /></span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="chat-msg bot">
                                <span className="msg-avatar">
                                    <Bot size={16} />
                                </span>
                                <div className="msg-bubble typing"><span></span><span></span><span></span></div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form className="chat-input" onSubmit={handleChatSubmit}>
                        <input
                            ref={chatInputRef}
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type your message..."
                            disabled={chatLoading}
                        />
                        <button type="submit" disabled={chatLoading || !chatInput.trim()}>
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}

            {/* Document Preview Modal */}
            {previewImage && (
                <div className="doc-preview-modal" onClick={() => setPreviewImage(null)}>
                    <div className="doc-preview-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="doc-preview-close" onClick={() => setPreviewImage(null)}>
                            <X size={24} />
                        </button>
                        <img src={previewImage} alt="Document Preview" />
                    </div>
                </div>
            )}

            {/* Document Processing Toast */}
            {showUploadToast && (
                <div className="upload-toast">
                    <div className="toast-icon">
                        <Check size={18} />
                    </div>
                    <div className="toast-content">
                        <div className="toast-title">Document successfully processed!</div>
                        <div className="toast-subtitle">All data was automatically extracted.</div>
                    </div>
                </div>
            )}

            {showGoodbye && (
                <div className="toast">Goodbye! We're here if you have any questions.</div>
            )}
        </div>
    );
}

export default UserPortal;