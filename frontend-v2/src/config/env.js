const normalizeUrl = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\/$/, '');
};

// Keep this intentionally simple:
// - In Netlify prod you set VITE_API_BASE_URL and (optionally) VITE_WS_URL
// - In dev, fall back to localhost
const apiBaseUrl = normalizeUrl(
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? 'http://localhost:8080' : (typeof window !== 'undefined' ? window.location.origin : ''))
);

const wsUrl = normalizeUrl(
    import.meta.env.VITE_WS_URL ||
    (apiBaseUrl ? `${apiBaseUrl.replace(/^http/i, 'ws')}/ws`.replace(/\/ws\/ws$/, '/ws') : '')
);

export const env = {
    API_BASE_URL: apiBaseUrl,
    API_VERSION: import.meta.env.VITE_API_VERSION || 'v1',
    WS_URL: wsUrl,
    ENV: import.meta.env.MODE || 'development',
    IS_DEV: import.meta.env.DEV,
    IS_PROD: import.meta.env.PROD,

    // App Identity
    APP_NAME: 'Blinx AI Assistant',
    APP_DOMAIN: import.meta.env.VITE_APP_DOMAIN || 'blinxai.me',
    CONTACT_EMAIL: 'rk8210032@gmail.com',
};

export const getApiUrl = (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${env.API_BASE_URL}${cleanPath}`;
};