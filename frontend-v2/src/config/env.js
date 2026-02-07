const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

// Determine Websocket Protocol based on API Protocol
const isSecure = apiBaseUrl.startsWith('https');
const wsProtocol = isSecure ? 'wss' : 'ws';
const wsBaseUrl = apiBaseUrl.replace(/^https?:\/\//, '');
const defaultWsUrl = `${wsProtocol}://${wsBaseUrl}/ws`;

export const env = {
    API_BASE_URL: apiBaseUrl,
    API_VERSION: import.meta.env.VITE_API_VERSION || 'v1',
    WS_URL: import.meta.env.VITE_WS_URL || defaultWsUrl,
    ENV: import.meta.env.MODE || 'development',
    IS_DEV: import.meta.env.DEV,
    IS_PROD: import.meta.env.PROD,
};

export const getApiUrl = (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${env.API_BASE_URL}${cleanPath}`;
};