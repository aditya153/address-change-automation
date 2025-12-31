/**
 * Utility to get the API URL with proper protocol and formatting.
 * Handles cases where VITE_API_URL might be missing https:// or has trailing slashes.
 */
export const getApiUrl = () => {
    let url = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // If it's a relative path (e.g. /api), return as is
    if (url.startsWith('/')) {
        return url.replace(/\/$/, '');
    }

    // If URL is a domain/IP without protocol, add https:// (production assumption)
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    return url.replace(/\/$/, ''); // Remove trailing slash
};

const API_URL = getApiUrl();
export default API_URL;
