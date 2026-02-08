import apiClient from './client';

export const authService = {
    requestOtp: async (identifier, email) => {
        const { data } = await apiClient.post('/api/v1/auth/request-otp', { identifier, email });
        return data;
    },

    verifyOtp: async (identifier, otp) => {
        const { data } = await apiClient.post('/api/v1/auth/verify-otp', { identifier, otp });
        return data;
    },

    signup: async (payload) => {
        const { data } = await apiClient.post('/api/v1/auth/signup', payload);
        return data;
    },

    login: async (payload) => {
        const { data } = await apiClient.post('/api/v1/auth/login', payload);
        return data;
    },

    refreshToken: async (token) => {
        const { data } = await apiClient.post('/api/v1/auth/refresh', { refreshToken: token });
        return data;
    },

    logout: async (token) => {
        const { data } = await apiClient.post('/api/v1/auth/logout', { refreshToken: token });
        return data;
    },

    ping: async () => {
        const { data } = await apiClient.get('/api/v1/auth/ping');
        return data;
    }
};
