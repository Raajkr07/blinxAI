import axios from 'axios';
import toast from 'react-hot-toast';
import { env } from '../config/env';
import { storage, STORAGE_KEYS } from '../lib/storage';

const apiClient = axios.create({
    baseURL: env.API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
    withCredentials: true,
});

const normalizeApiError = (error) => {
    const status = error?.response?.status ?? null;
    const data = error?.response?.data ?? null;

    let code = null;
    if (data && typeof data === 'object') {
        if (typeof data.code === 'string') code = data.code;
        else if (typeof data.errorCode === 'string') code = data.errorCode;
    }

    let message = 'Unexpected error';
    if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
        message = data.message;
    } else if (typeof data === 'string' && data.trim()) {
        message = data;
    } else if (typeof error?.message === 'string' && error.message.trim()) {
        message = error.message;
    }

    return { status, code, message, data };
};

const cleanResponseData = (data) => {
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        if (data.length === 2 && typeof data[0] === 'string' &&
            (data[0].includes('java.util') || data[0].includes('org.springframework'))) {
            return cleanResponseData(data[1]);
        }
        return data.map(cleanResponseData);
    }

    const { '@class': _, ...rest } = data;
    const cleaned = {};
    for (const key in rest) {
        cleaned[key] = cleanResponseData(rest[key]);
    }
    return cleaned;
};

apiClient.interceptors.request.use(
    (config) => {
        const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(normalizeApiError(error))
);

apiClient.interceptors.response.use(
    (response) => {
        response.data = cleanResponseData(response.data);
        return response;
    },
    async (error) => {
        const originalRequest = error?.config;
        const status = error?.response?.status;

        // 429 Too Many Requests
        if (status === 429) {
            const retryAfter = error.response?.data?.retryAfterSeconds
                ?? error.response?.headers?.['retry-after']
                ?? null;
            const msg = retryAfter
                ? `You're doing that too fast. Please wait ${retryAfter}s and try again.`
                : "You're doing that too fast. Please slow down and try again.";
            toast.error(msg, { id: 'rate-limit', duration: 4000 });
            return Promise.reject(normalizeApiError(error));
        }

        const isAuthError = status === 401 || status === 403;

        const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
        const hasSession = !!storage.get(STORAGE_KEYS.USER);

        // Try to refresh if we have a refresh token OR if we have a session (might be cookie-based OAuth)
        if (isAuthError && originalRequest && !originalRequest._retry && (refreshToken || hasSession)) {
            originalRequest._retry = true;
            try {
                let data;
                if (refreshToken) {
                    // Standard JWT refresh
                    const response = await axios.post(
                        `${env.API_BASE_URL}/api/v1/auth/refresh`,
                        { refreshToken },
                        { withCredentials: true }
                    );
                    data = response.data;
                } else {
                    // Try Google/OAuth cookie-based refresh
                    const response = await axios.post(
                        `${env.API_BASE_URL}/api/v1/auth/google/refresh`,
                        null,
                        { withCredentials: true }
                    );
                    // For Google refresh, it often just updates cookies and returns 200
                    // So we may need to call session again if it didn't return data
                    data = response.data || {};
                }

                if (data.accessToken) {
                    storage.set(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
                    originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                }
                if (data.refreshToken) {
                    storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
                }

                return apiClient(originalRequest);
            } catch (err) {
                storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
                storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
                storage.remove(STORAGE_KEYS.USER);
                const publicRoutes = ['/privacy-policy', '/terms', '/data-deletion', '/oauth-error'];
                const currentPath = window.location.pathname.replace(/\/$/, '');
                if (currentPath !== '' && !currentPath.includes('/auth') && !publicRoutes.includes(currentPath)) {
                    window.location.href = '/';
                }
                return Promise.reject(normalizeApiError(err));
            }
        }
        return Promise.reject(normalizeApiError(error));
    }
);

export default apiClient;
