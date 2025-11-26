import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function UserPortal() {
    const [email, setEmail] = useState('');
    const [landlordPdf, setLandlordPdf] = useState(null);
    const [addressPdf, setAddressPdf] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !landlordPdf || !addressPdf) {
            setMessage('Please fill all fields');
            setSuccess(false);
            return;
        }

        setLoading(true);
        setMessage('');
        setSuccess(false);

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

            setMessage(response.data.message || 'Request submitted successfully! You will receive an email when processing is complete.');
            setSuccess(true);
            setEmail('');
            setLandlordPdf(null);
            setAddressPdf(null);

            // Reset file inputs
            document.getElementById('landlordPdf').value = '';
            document.getElementById('addressPdf').value = '';

        } catch (error) {
            setMessage(error.response?.data?.detail || 'Submission failed. Please try again.');
            setSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="user-portal">
            <div className="card">
                <h2>📝 Submit Address Change Request</h2>
                <p className="subtitle">Upload your documents to start the address change process</p>

                {message && (
                    <div className={`alert ${success ? 'alert-success' : 'alert-error'}`}>
                        {success ? '✓' : '✕'} {message}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Email Address *</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="landlordPdf">Landlord Confirmation (PDF) *</label>
                        <input
                            id="landlordPdf"
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setLandlordPdf(e.target.files[0])}
                            required
                        />
                        {landlordPdf && <div className="file-name">✓ {landlordPdf.name}</div>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="addressPdf">Address Change Document (PDF) *</label>
                        <input
                            id="addressPdf"
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setAddressPdf(e.target.files[0])}
                            required
                        />
                        {addressPdf && <div className="file-name">✓ {addressPdf.name}</div>}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? '⏳ Submitting...' : '📤 Submit Request'}
                    </button>
                </form>

                <div className="partners-section">
                    <p className="partners-label">Powered by</p>
                    <div className="partners-logos">
                        <div className="partner-logo">
                            <div className="logo-placeholder fraunhofer">
                                <span>Fraunhofer IESE</span>
                            </div>
                        </div>
                        <div className="partner-logo">
                            <div className="logo-placeholder insiders">
                                <span>Insiders Technologies</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UserPortal;