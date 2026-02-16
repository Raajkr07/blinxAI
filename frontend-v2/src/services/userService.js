import apiClient from './client';

export const userService = {
    getMe: async () => {
        const { data } = await apiClient.get('/api/v1/me');
        return data;
    },

    updateProfile: async (payload) => {
        const { data } = await apiClient.put('/api/v1/me', payload);
        return data;
    },

    getUserById: async (id) => {
        const { data } = await apiClient.get(`/api/v1/users/${id}`);
        return data;
    },

    getUsersBatch: async (ids) => {
        if (!ids || ids.length === 0) return [];
        const { data } = await apiClient.post('/api/v1/users/batch', { ids });
        return data;
    },

    searchUsers: async (query) => {
        const { data } = await apiClient.get('/api/v1/users/search', { params: { query } });
        return data;
    },

    isUserOnline: async (id) => {
        const { data } = await apiClient.get(`/api/v1/users/${id}/online`);
        return data;
    },

    listOnlineUsers: async () => {
        const { data } = await apiClient.get('/api/v1/users/online');
        return data;
    },

    amIOnline: async () => {
        const { data } = await apiClient.get('/api/v1/users/me/online');
        return data;
    }
};
