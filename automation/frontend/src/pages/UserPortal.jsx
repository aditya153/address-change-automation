import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import NeighborhoodMap from '../components/NeighborhoodMap';
import './UserPortal.css';

import API_URL from '../utils/api';

function UserPortal() {
    const { t, language } = useLanguage();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [landlordPdf, setLandlordPdf] = useState(null);
    const [addressPdf, setAddressPdf] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [success, setSuccess] = useState(false);

    // Document validation error state
    const [documentValidationErrors, setDocumentValidationErrors] = useState({
        landlord: false,
        address: false
    });

    // Chatbot state
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);

    // Image preview modal state
    const [previewImage, setPreviewImage] = useState(null);

    // Goodbye toast state
    const [showGoodbye, setShowGoodbye] = useState(false);

    // Initialize chat greeting based on language
    useEffect(() => {
        setChatMessages([{ text: t('chatGreeting'), sender: 'bot' }]);
    }, [language]);

    // Listen for openChatbot event from Help button
    useEffect(() => {
        const handleOpenChatbot = () => {
            setChatOpen(true);
        };
        window.addEventListener('openChatbot', handleOpenChatbot);
        return () => window.removeEventListener('openChatbot', handleOpenChatbot);
    }, []);

    const handleCloseChatbot = () => {
        setChatOpen(false);
        setShowGoodbye(true);
        setTimeout(() => setShowGoodbye(false), 2500);
    };

    const messagesEndRef = useRef(null);
    const chatInputRef = useRef(null);

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
        setSuccess(false);
        setDocumentValidationErrors({ landlord: false, address: false });

        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('landlord_pdf', landlordPdf);
            formData.append('address_pdf', addressPdf);

            const response = await axios.post(`${API_URL}/submit-case`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setMessage(response.data.message || (language === 'de'
                ? 'Ihr Antrag wurde erfolgreich eingereicht. Sie erhalten eine Bestätigung per E-Mail.'
                : 'Your application has been successfully submitted. You will receive a confirmation by email.'));
            setSuccess(true);
            setEmail('');
            setLandlordPdf(null);
            setAddressPdf(null);
        } catch (error) {
            const errorData = error.response?.data;

            if (error.response?.status === 400 && errorData?.errors) {
                const errorMessages = errorData.errors;
                const helpMessage = language === 'de'
                    ? 'Benötigen Sie Hilfe? Klicken Sie auf den Chatbot unten rechts für Unterstützung.'
                    : 'Need help? Click on the chatbot at the bottom right for assistance.';

                let displayMessage = language === 'de'
                    ? '❌ Dokumente ungültig:\n\n'
                    : '❌ Invalid documents:\n\n';

                const validationErrors = { landlord: false, address: false };
                errorMessages.forEach(err => {
                    displayMessage += `• ${err}\n`;
                    const errLower = err.toLowerCase();
                    if (errLower.startsWith('landlord document') ||
                        errLower.includes('first document') ||
                        errLower.includes('wohnungsgeberbestätigung')) {
                        validationErrors.landlord = true;
                    }
                    if (errLower.startsWith('address form') ||
                        errLower.includes('second document') ||
                        errLower.includes('meldebescheinigung')) {
                        validationErrors.address = true;
                    }
                });
                setDocumentValidationErrors(validationErrors);
                displayMessage += `\n💡 ${helpMessage}`;

                setMessage(displayMessage);
            } else {
                setMessage(error.response?.data?.detail || (language === 'de'
                    ? 'Einreichung fehlgeschlagen. Bitte versuchen Sie es erneut.'
                    : 'Submission failed. Please try again.'));
            }
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
            const response = await axios.post(`${API_URL}/chat`, {
                message: userMessage
            });

            const botResponse = {
                text: response.data.reply,
                sender: 'bot',
                hasPreview: response.data.has_document_preview,
                documentUrl: response.data.document_url,
                documentUrl2: response.data.document_url2,
                documentName: response.data.document_name
            };

            setChatMessages(prev => [...prev, botResponse]);
        } catch (error) {
            setChatMessages(prev => [...prev, {
                text: 'Entschuldigung, es gibt ein Verbindungsproblem. Bitte versuchen Sie es erneut.',
                sender: 'bot'
            }]);
        } finally {
            setChatLoading(false);
        }
    };

    const getStepStatus = () => {
        const hasEmail = email && email.includes('@');

        let step2Status = '';
        if (addressPdf) {
            step2Status = documentValidationErrors.address ? 'error' : 'completed';
        } else if (hasEmail) {
            step2Status = 'active';
        }

        let step3Status = '';
        if (landlordPdf) {
            step3Status = documentValidationErrors.landlord ? 'error' : 'completed';
        } else if (addressPdf) {
            step3Status = 'active';
        }

        return {
            step1: hasEmail ? 'completed' : 'active',
            step2: step2Status,
            step3: step3Status
        };
    };

    const steps = getStepStatus();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="citizen-portal-page">
            {/* Top Government Banner */}
            <div className="gov-banner">
                <div className="gov-banner-content">
                    <span className="gov-banner-flag">🇩🇪</span>
                    <span className="gov-banner-text">An official website of the Federal Republic of Germany</span>
                </div>
                <div className="gov-banner-actions">
                    {user?.role === 'admin' && (
                        <button className="admin-dashboard-btn" onClick={() => navigate('/admin')}>
                            Admin Dashboard
                        </button>
                    )}
                    <button className="logout-btn" onClick={handleLogout}>Log out</button>
                </div>
            </div>

            {/* Main Split Container */}
            <div className="portal-container">
                {/* Left Panel - Blue */}
                <div className="portal-left-panel">
                    <div className="portal-left-content">
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
                                <h2 className="portal-name">Citizen Portal</h2>
                                <span className="portal-subtitle">Residents' Registration Office</span>
                            </div>
                        </div>

                        {/* Hero Section */}
                        <div className="portal-hero">
                            <h1 className="portal-title">
                                Address Change<br />
                                Registration
                            </h1>
                            <div className="title-underline"></div>
                            <p className="portal-description">
                                Submit your address change documents securely online. Our automated system will process your request within 48 hours.
                            </p>
                        </div>

                        {/* Step Progress */}
                        <div className="step-progress-vertical">
                            <div className={`step-item ${steps.step1}`}>
                                <div className="step-indicator">
                                    {steps.step1 === 'completed' ? '✓' : '1'}
                                </div>
                                <div className="step-content">
                                    <span className="step-title">{t('personalData')}</span>
                                    <span className="step-desc">Enter your email address</span>
                                </div>
                            </div>
                            <div className={`step-item ${steps.step2}`}>
                                <div className="step-indicator">
                                    {steps.step2 === 'completed' ? '✓' : steps.step2 === 'error' ? '✕' : '2'}
                                </div>
                                <div className="step-content">
                                    <span className="step-title">{t('registrationCertificate')}</span>
                                    <span className="step-desc">Upload Meldebescheinigung</span>
                                </div>
                            </div>
                            <div className={`step-item ${steps.step3}`}>
                                <div className="step-indicator">
                                    {steps.step3 === 'completed' ? '✓' : steps.step3 === 'error' ? '✕' : '3'}
                                </div>
                                <div className="step-content">
                                    <span className="step-title">{t('landlordConfirmation')}</span>
                                    <span className="step-desc">Upload Wohnungsgeberbestätigung</span>
                                </div>
                            </div>
                        </div>

                        {/* Required Documents Info */}
                        <div className="required-docs-section">
                            <h4>📋 {t('requiredDocuments')}</h4>
                            <ul>
                                <li>✓ {t('validId')}</li>
                                <li>✓ {t('landlordConfirmationDoc')}</li>
                                <li>✓ {t('completedForm')}</li>
                            </ul>
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
                <div className="portal-right-panel">
                    <div className="portal-form-container">
                        <h2 className="form-title">Submit Documents</h2>
                        <p className="form-subtitle">Complete your address registration</p>

                        {/* Success/Error Alert */}
                        {message && (
                            <div className={`portal-alert ${success ? 'success' : 'error'}`}>
                                <span className="alert-icon">{success ? '✅' : ''}</span>
                                <div style={{ whiteSpace: 'pre-line' }}>{message}</div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {/* Email Input */}
                            <div className="form-group">
                                <label>{t('emailAddress')} <span className="required">*</span></label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t('emailPlaceholder')}
                                        required
                                    />
                                    {email && email.includes('@') && (
                                        <span className="input-check">✓</span>
                                    )}
                                </div>
                            </div>

                            {/* Address Certificate Upload */}
                            <div className="form-group">
                                <label>Meldebescheinigung (Address Certificate) <span className="required">*</span></label>
                                <div
                                    className={`file-upload-card ${addressPdf ? 'has-file' : ''} ${documentValidationErrors.address ? 'has-error' : ''}`}
                                    onClick={() => handleFileClick('addressPdf')}
                                >
                                    <input
                                        id="addressPdf"
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            setAddressPdf(e.target.files[0]);
                                            if (documentValidationErrors.address) {
                                                setDocumentValidationErrors(prev => ({ ...prev, address: false }));
                                            }
                                        }}
                                    />
                                    {!addressPdf ? (
                                        <div className="upload-placeholder">
                                            <div className="upload-icon-box">📄</div>
                                            <div className="upload-text-content">
                                                <span className="upload-primary">Drop file here or <strong>browse</strong></span>
                                                <span className="upload-secondary">PDF files only (max. 10 MB)</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="file-selected">
                                            <div className={`file-status-icon ${documentValidationErrors.address ? 'error' : 'success'}`}>
                                                {documentValidationErrors.address ? '✕' : '✓'}
                                            </div>
                                            <div className="file-details">
                                                <span className="file-name">{addressPdf.name}</span>
                                                <span className={`file-status ${documentValidationErrors.address ? 'error' : ''}`}>
                                                    {documentValidationErrors.address ? 'Invalid document' : 'Ready to upload'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="file-remove"
                                                onClick={(e) => { e.stopPropagation(); setAddressPdf(null); }}
                                            >✕</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Landlord Certificate Upload */}
                            <div className="form-group">
                                <label>Wohnungsgeberbestätigung (Landlord Certificate) <span className="required">*</span></label>
                                <div
                                    className={`file-upload-card ${landlordPdf ? 'has-file' : ''} ${documentValidationErrors.landlord ? 'has-error' : ''}`}
                                    onClick={() => handleFileClick('landlordPdf')}
                                >
                                    <input
                                        id="landlordPdf"
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            setLandlordPdf(e.target.files[0]);
                                            if (documentValidationErrors.landlord) {
                                                setDocumentValidationErrors(prev => ({ ...prev, landlord: false }));
                                            }
                                        }}
                                    />
                                    {!landlordPdf ? (
                                        <div className="upload-placeholder">
                                            <div className="upload-icon-box">🏠</div>
                                            <div className="upload-text-content">
                                                <span className="upload-primary">Drop file here or <strong>browse</strong></span>
                                                <span className="upload-secondary">PDF files only (max. 10 MB)</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="file-selected">
                                            <div className={`file-status-icon ${documentValidationErrors.landlord ? 'error' : 'success'}`}>
                                                {documentValidationErrors.landlord ? '✕' : '✓'}
                                            </div>
                                            <div className="file-details">
                                                <span className="file-name">{landlordPdf.name}</span>
                                                <span className={`file-status ${documentValidationErrors.landlord ? 'error' : ''}`}>
                                                    {documentValidationErrors.landlord ? 'Invalid document' : 'Ready to upload'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="file-remove"
                                                onClick={(e) => { e.stopPropagation(); setLandlordPdf(null); }}
                                            >✕</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button type="submit" className={`submit-btn ${loading ? 'loading' : ''}`} disabled={loading}>
                                <span className="btn-spinner"></span>
                                <span className="btn-text">{t('submitApplication')} →</span>
                                <span className="loading-text">{t('processing')}</span>
                            </button>
                        </form>

                        {/* Contact Info */}
                        <div className="contact-section">
                            <h4>📞 {t('contactHelp')}</h4>
                            <div className="contact-grid">
                                <div className="contact-item">
                                    <span className="contact-label">{t('email')}</span>
                                    <span className="contact-value">buergerservice@stadt.de</span>
                                </div>
                                <div className="contact-item">
                                    <span className="contact-label">{t('phone')}</span>
                                    <span className="contact-value">+49 (0) 123 456 789</span>
                                </div>
                            </div>
                        </div>

                        {/* Data Protection Notice */}
                        <p className="protection-notice">
                            Protected under the Federal Data Protection Act (BDSG)
                        </p>

                        {/* Show Neighborhood Map after successful submission */}
                        {success && (
                            <NeighborhoodMap address="Kaiserslautern, Germany" />
                        )}
                    </div>
                </div>
            </div>

            {/* Chatbot FAB */}
            <button
                className={`chatbot-fab ${chatOpen ? 'active' : ''}`}
                onClick={() => setChatOpen(!chatOpen)}
            >
                {chatOpen ? '✕' : '💬'}
            </button>

            {/* Chatbot Window */}
            {chatOpen && (
                <div className="chatbot-window">
                    <div className="chatbot-header">
                        <div className="chatbot-header-info">
                            <div className="chatbot-avatar">🤖</div>
                            <div className="chatbot-header-text">
                                <h3>Bürger-Assistent</h3>
                                <span className="chatbot-status">● Online</span>
                            </div>
                        </div>
                        <button className="chatbot-close" onClick={handleCloseChatbot}>×</button>
                    </div>

                    <div className="chatbot-messages">
                        {chatMessages.map((msg, index) => (
                            <div key={index} className={`chat-message ${msg.sender}`}>
                                {msg.sender === 'bot' && (
                                    <div className="chat-avatar-small">🤖</div>
                                )}
                                <div className="chat-bubble">
                                    {msg.text}
                                    {msg.hasPreview && msg.documentUrl && (
                                        <div className="chat-documents-container">
                                            <div
                                                className="chat-document-preview"
                                                onClick={() => setPreviewImage({
                                                    url: `${API_URL}${msg.documentUrl}`,
                                                    name: 'Landlord Certificate'
                                                })}
                                            >
                                                <img src={`${API_URL}${msg.documentUrl}`} alt="Document 1" />
                                                <span>📎 Wohnungsgeberbestätigung - Click to preview</span>
                                            </div>
                                            {msg.documentUrl2 && (
                                                <div
                                                    className="chat-document-preview"
                                                    onClick={() => setPreviewImage({
                                                        url: `${API_URL}${msg.documentUrl2}`,
                                                        name: 'Address Change Form'
                                                    })}
                                                >
                                                    <img src={`${API_URL}${msg.documentUrl2}`} alt="Document 2" />
                                                    <span>📎 Meldebescheinigung - Click to preview</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="chat-message bot">
                                <div className="chat-avatar-small">🤖</div>
                                <div className="chat-bubble typing">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="chatbot-input" onSubmit={handleChatSubmit}>
                        <input
                            ref={chatInputRef}
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Your message..."
                            disabled={chatLoading}
                        />
                        <button type="submit" disabled={chatLoading || !chatInput.trim()}>
                            ➤
                        </button>
                    </form>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
                    <div className="image-preview-content" onClick={(e) => e.stopPropagation()}>
                        <button className="image-preview-close" onClick={() => setPreviewImage(null)}>×</button>
                        <img src={previewImage.url} alt={previewImage.name} />
                        <p>{previewImage.name}</p>
                    </div>
                </div>
            )}

            {/* Goodbye Toast */}
            {showGoodbye && (
                <div className="goodbye-toast">
                    <span>🤖</span> Auf Wiedersehen! Bei Fragen stehen wir Ihnen gerne zur Verfügung.
                </div>
            )}
        </div>
    );
}

export default UserPortal;