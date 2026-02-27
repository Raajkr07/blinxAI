import apiClient from './client';

export const newsService = {
    getFeed: async ({ sources, limit = 50, offset = 0 } = {}) => {
        const payload = {
            sources: Array.isArray(sources) ? sources : [],
            limit,
            offset,
        };
        const { data } = await apiClient.post('/api/v1/news/feed', payload);
        return data;
    },
};
