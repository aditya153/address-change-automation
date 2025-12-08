import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './ContactPage.css';

function ContactPage() {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name || !email || !subject || !message) {
            setStatus({ type: 'error', message: t('fillAllFields') });
            return;
        }

        setLoading(true);
        setStatus({ type: '', message: '' });

        // Simulate sending message
        setTimeout(() => {
            setStatus({ type: 'success', message: t('messageSent') });
            setLoading(false);
            setName('');
            setEmail('');
            setSubject('');
            setMessage('');
        }, 1500);
    };

    return (
        <div className="contact-page">
            <div className="contact-main-content">
                <div className="contact-form-section">
                    <div className="contact-form-header">
                        <h2>{t('contactTitle')}</h2>
                        <p>{t('contactSubtitle')}</p>
                    </div>

                    <div className="contact-form-body">
                        {/* Back Link */}
                        <Link to="/" className="back-link">{t('backToPortal')}</Link>

                        {/* Status Alert */}
                        {status.message && (
                            <div className={`contact-alert ${status.type}`}>
                                <span className="alert-icon">
                                    {status.type === 'success' ? '✅' : '❌'}
                                </span>
                                <div>{status.message}</div>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit}>
                            {/* Name */}
                            <div className="form-row">
                                <label className="form-label">
                                    {t('yourName')} <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('namePlaceholder')}
                                    required
                                />
                            </div>

                            {/* Email */}
                            <div className="form-row">
                                <label className="form-label">
                                    {t('emailAddress')} <span className="required">*</span>
                                </label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('emailPlaceholder')}
                                    required
                                />
                            </div>

                            {/* Subject */}
                            <div className="form-row">
                                <label className="form-label">
                                    {t('subject')} <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder={t('subjectPlaceholder')}
                                    required
                                />
                            </div>

                            {/* Message */}
                            <div className="form-row">
                                <label className="form-label">
                                    {t('message')} <span className="required">*</span>
                                </label>
                                <textarea
                                    className="form-textarea"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder={t('messagePlaceholder')}
                                    rows={6}
                                    required
                                />
                            </div>

                            {/* Submit */}
                            <div className="submit-section">
                                <button
                                    type="submit"
                                    className={`contact-submit-btn ${loading ? 'loading' : ''}`}
                                    disabled={loading}
                                >
                                    <span className="btn-spinner"></span>
                                    <span className="btn-text">{t('sendMessage')}</span>
                                    <span className="loading-text">{t('sending')}</span>
                                </button>
                            </div>
                        </form>

                        <div className="form-footer">
                            <span className="form-footer-icon">🔒</span>
                            <span>{t('dataEncrypted')}</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="contact-sidebar">
                    <div className="info-card">
                        <div className="info-card-header">
                            <span>📞</span> {t('contactHelp')}
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
        </div>
    );
}

export default ContactPage;
