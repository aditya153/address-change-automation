import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import NeighborhoodMap from '../components/NeighborhoodMap';
import './UserPortal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function UserPortal() {
    const { t, language } = useLanguage();
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

    // Show info alert initially
    const [showInfo, setShowInfo] = useState(true);

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
            setShowInfo(false);
            return;
        }

        setLoading(true);
        setMessage('');
        setSuccess(false);
        // Reset validation errors when attempting new submission
        setDocumentValidationErrors({ landlord: false, address: false });
        setShowInfo(false);

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
            // Handle document validation errors
            const errorData = error.response?.data;

            if (error.response?.status === 400 && errorData?.errors) {
                // Document validation failed - show detailed error
                const errorMessages = errorData.errors;
                const helpMessage = language === 'de'
                    ? 'Benötigen Sie Hilfe? Klicken Sie auf den Chatbot unten rechts für Unterstützung.'
                    : 'Need help? Click on the chatbot at the bottom right for assistance.';

                let displayMessage = language === 'de'
                    ? '❌ Dokumente ungültig:\n\n'
                    : '❌ Invalid documents:\n\n';

                // Determine which document(s) failed validation
                const validationErrors = { landlord: false, address: false };
                errorMessages.forEach(err => {
                    displayMessage += `• ${err}\n`;
                    const errLower = err.toLowerCase();
                    // Check for landlord document errors - match backend error patterns
                    // Backend uses: "Landlord document invalid: ..." or "First document is not..."
                    if (errLower.startsWith('landlord document') ||
                        errLower.includes('first document') ||
                        errLower.includes('wohnungsgeberbestätigung')) {
                        validationErrors.landlord = true;
                    }
                    // Check for address form errors - match backend error patterns
                    // Backend uses: "Address form invalid: ..." or "Second document is not..."
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
                // Generic error
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

        // Determine step2 status (address certificate)
        let step2Status = '';
        if (addressPdf) {
            step2Status = documentValidationErrors.address ? 'error' : 'completed';
        } else if (hasEmail) {
            step2Status = 'active';
        }

        // Determine step3 status (landlord certificate)
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

    return (
        <div className="gov-portal">
            {/* Main Content */}
            <div className="main-content">
                {/* Form Section */}
                <div className="form-section">
                    <div className="form-header">
                        <h2>{t('registeringApartment')}</h2>
                        <p>{t('registrationSubtitle')}</p>
                    </div>

                    <div className="form-body">
                        {/* Status Bar */}
                        <div className="status-bar">
                            <div className={`status-step ${steps.step1}`}>
                                <div className="status-icon">{steps.step1 === 'completed' ? '✓' : '1'}</div>
                                <span className="status-label">{t('personalData')}</span>
                            </div>
                            <div className={`status-step ${steps.step2}`}>
                                <div className="status-icon">
                                    {steps.step2 === 'completed' ? '✓' : steps.step2 === 'error' ? '✕' : '2'}
                                </div>
                                <span className="status-label">{t('registrationCertificate')}</span>
                            </div>
                            <div className={`status-step ${steps.step3}`}>
                                <div className="status-icon">
                                    {steps.step3 === 'completed' ? '✓' : steps.step3 === 'error' ? '✕' : '3'}
                                </div>
                                <span className="status-label">{t('landlordConfirmation')}</span>
                            </div>
                        </div>

                        {/* Info Alert */}
                        {showInfo && !message && (
                            <div className="gov-alert info">
                                <span className="alert-icon">ℹ️</span>
                                <div>
                                    <strong>{t('note')}</strong> {t('noteText')}
                                </div>
                            </div>
                        )}

                        {/* Success/Error Alert */}
                        {message && (
                            <div className={`gov-alert ${success ? 'success' : 'error'}`}>
                                <span className="alert-icon">{success ? '✅' : ''}</span>
                                <div style={{ whiteSpace: 'pre-line' }}>{message}</div>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit}>
                            {/* Email */}
                            <div className="form-row">
                                <label className="form-label">
                                    {t('emailAddress')} <span className="required">*</span>
                                </label>
                                <div className="input-with-icon">
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t('emailPlaceholder')}
                                        required
                                    />
                                    {email && email.includes('@') && (
                                        <span className="input-icon success">✓</span>
                                    )}
                                </div>
                            </div>

                            {/* Address Certificate */}
                            <div className="form-row">
                                <label className="form-label">
                                    Meldebescheinigung (Address Certificate) <span className="required">*</span>
                                </label>
                                <div
                                    className={`file-upload-area ${addressPdf ? 'has-file' : ''} ${documentValidationErrors.address ? 'has-error' : ''}`}
                                    onClick={() => handleFileClick('addressPdf')}
                                >
                                    <input
                                        id="addressPdf"
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            setAddressPdf(e.target.files[0]);
                                            // Clear validation error when new file is selected
                                            if (documentValidationErrors.address) {
                                                setDocumentValidationErrors(prev => ({ ...prev, address: false }));
                                            }
                                        }}
                                    />
                                    <div className="upload-content">
                                        <span className="upload-icon">📄</span>
                                        <div className="upload-text">
                                            Datei hier ablegen oder <strong>durchsuchen</strong>
                                        </div>
                                        <div className="upload-hint">Nur PDF-Dateien (max. 10 MB)</div>
                                    </div>
                                    <div className="file-selected-info">
                                        <div className={`file-icon-box ${documentValidationErrors.address ? 'error' : ''}`}>
                                            {documentValidationErrors.address ? '✕' : '✓'}
                                        </div>
                                        <div className="file-info">
                                            <div className={`file-info-name ${documentValidationErrors.address ? 'error' : ''}`}>{addressPdf?.name}</div>
                                            <div className={`file-info-status ${documentValidationErrors.address ? 'error' : ''}`}>
                                                {documentValidationErrors.address
                                                    ? (language === 'de' ? 'Dokument ungültig' : 'Document invalid')
                                                    : 'Bereit zum Hochladen'}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="file-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAddressPdf(null);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Landlord Certificate */}
                            <div className="form-row">
                                <label className="form-label">
                                    Wohnungsgeberbestätigung (Landlord Certificate) <span className="required">*</span>
                                </label>
                                <div
                                    className={`file-upload-area ${landlordPdf ? 'has-file' : ''} ${documentValidationErrors.landlord ? 'has-error' : ''}`}
                                    onClick={() => handleFileClick('landlordPdf')}
                                >
                                    <input
                                        id="landlordPdf"
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            setLandlordPdf(e.target.files[0]);
                                            // Clear validation error when new file is selected
                                            if (documentValidationErrors.landlord) {
                                                setDocumentValidationErrors(prev => ({ ...prev, landlord: false }));
                                            }
                                        }}
                                    />
                                    <div className="upload-content">
                                        <span className="upload-icon">🏠</span>
                                        <div className="upload-text">
                                            Datei hier ablegen oder <strong>durchsuchen</strong>
                                        </div>
                                        <div className="upload-hint">Nur PDF-Dateien (max. 10 MB)</div>
                                    </div>
                                    <div className="file-selected-info">
                                        <div className={`file-icon-box ${documentValidationErrors.landlord ? 'error' : ''}`}>
                                            {documentValidationErrors.landlord ? '✕' : '✓'}
                                        </div>
                                        <div className="file-info">
                                            <div className={`file-info-name ${documentValidationErrors.landlord ? 'error' : ''}`}>{landlordPdf?.name}</div>
                                            <div className={`file-info-status ${documentValidationErrors.landlord ? 'error' : ''}`}>
                                                {documentValidationErrors.landlord
                                                    ? (language === 'de' ? 'Dokument ungültig' : 'Document invalid')
                                                    : 'Bereit zum Hochladen'}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="file-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLandlordPdf(null);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="submit-section">
                                <button
                                    type="submit"
                                    className={`gov-submit-btn ${loading ? 'loading' : ''}`}
                                    disabled={loading}
                                >
                                    <span className="btn-spinner"></span>
                                    <span className="btn-text">{t('submitApplication')}</span>
                                    <span className="loading-text">{t('processing')}</span>
                                </button>
                            </div>
                        </form>

                        <div className="form-footer">
                            <span className="form-footer-icon">🔒</span>
                            <span>{t('dataEncrypted')}</span>
                        </div>

                        {/* Show Neighborhood Map after successful submission */}
                        {success && (
                            <NeighborhoodMap address="Kaiserslautern, Germany" />
                        )}

                    </div>
                </div>

                {/* Sidebar */}
                <div className="sidebar">

                    <div className="info-card">
                        <div className="info-card-header">
                            {t('requiredDocuments')}
                        </div>
                        <div className="info-card-body">
                            <ul className="info-list">
                                <li>
                                    <span className="info-list-icon">✓</span>
                                    <span>{t('validId')}</span>
                                </li>
                                <li>
                                    <span className="info-list-icon">✓</span>
                                    <span>{t('landlordConfirmationDoc')}</span>
                                </li>
                                <li>
                                    <span className="info-list-icon">✓</span>
                                    <span>{t('completedForm')}</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="info-card">
                        <div className="info-card-header">
                            {t('contactHelp')}
                        </div>
                        <div className="info-card-body">
                            <div className="contact-item">
                                <div className="contact-icon">📧</div>
                                <div className="contact-info">
                                    <strong>{t('email')}</strong>
                                    <span>buergerservice@stadt.de</span>
                                </div>
                            </div>
                            <div className="contact-item">
                                <div className="contact-icon">📞</div>
                                <div className="contact-info">
                                    <strong>{t('phone')}</strong>
                                    <span>+49 (0) 123 456 789</span>
                                </div>
                            </div>
                            <div className="contact-item">
                                <div className="contact-icon">🕐</div>
                                <div className="contact-info">
                                    <strong>{t('openingHours')}</strong>
                                    <span>{t('openingTime')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="gov-footer">
                <div className="footer-content">
                    <div className="footer-links">
                        <a href="#">{t('imprint')}</a>
                        <a href="#">{t('dataProtection')}</a>
                        <a href="#">{t('accessibility')}</a>
                        <a href="#">{t('termsOfUse')}</a>
                    </div>
                    <div className="footer-copyright">
                        {t('copyright')}
                    </div>
                </div>
            </footer>

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
                                                <span>📎 Wohnungsgeberbestätigung - Klicken zur Vorschau</span>
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
                                                    <span>📎 Meldebescheinigung - Klicken zur Vorschau</span>
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
                            placeholder="Ihre Nachricht..."
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