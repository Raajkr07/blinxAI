import apiClient from './client';

export const aiService = {
    getAiConversation: async () => {
        const { data } = await apiClient.get('/api/v1/ai/conversation');
        return data;
    },

    chatWithAi: async (message) => {
        const { data } = await apiClient.post('/api/v1/ai/chat', { message });
        return data;
    },

    chatWithIncognitoAi: async (message) => {
        const { data } = await apiClient.post('/api/v1/ai/incognito/chat', { message });
        return data;
    },

    generateAutoReplies: async (payload) => {
        const { data } = await apiClient.post('/api/v1/ai/analysis/auto-replies', payload);
        return data;
    },

    summarizeConversation: async (id) => {
        const { data } = await apiClient.post(`/api/v1/ai/analysis/conversation/${id}/summarize`);
        return data;
    },

    extractTask: async (text) => {
        const { data } = await apiClient.post('/api/v1/ai/analysis/extract-task', { text });
        return data;
    },

    extractTasksFromConversation: async (conversationId) => {
        const { data } = await apiClient.post(`/api/v1/ai/analysis/extract-tasks/${conversationId}`);
        return data;
    },

    parseSearchQuery: async (query) => {
        const { data } = await apiClient.post('/api/v1/ai/analysis/search-query', { query });
        return data;
    },

    simulateTyping: async (text) => {
        const { data } = await apiClient.post('/api/v1/ai/analysis/typing-indicator', { text });
        return data;
    },

    getCapabilities: async () => {
        const { data } = await apiClient.get('/api/v1/ai/capabilities');
        return data;
    },

    saveIncognitoConfig: async (payload) => {
        const { data } = await apiClient.post('/api/v1/ai/incognito/config', payload);
        return data;
    },

    crunchDataAnalysis: async (formData) => {
        const { data } = await apiClient.post('/api/v1/ai/incognito/data-analysis/crunch', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return data;
    }
};
