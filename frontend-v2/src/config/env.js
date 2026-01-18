export const env = {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
    API_VERSION: import.meta.env.VITE_API_VERSION || 'v1',
    WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
    ENV: import.meta.env.MODE || 'development',
    IS_DEV: import.meta.env.DEV,
    IS_PROD: import.meta.env.PROD,
};

export const getApiUrl = (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${env.API_BASE_URL}${cleanPath}`;
};
