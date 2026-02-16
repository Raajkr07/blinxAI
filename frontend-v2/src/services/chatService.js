import apiClient from './client';

export const chatService = {
    listConversations: async () => {
        const { data } = await apiClient.get('/api/v1/chat/conversations');
        return data;
    },

    getConversation: async (id) => {
        const { data } = await apiClient.get(`/api/v1/chat/${id}`);
        return data;
    },

    getMessages: async (id, page = 0, size = 20) => {
        const { data } = await apiClient.get(`/api/v1/chat/${id}/messages`, {
            params: { page, size }
        });
        return data;
    },

    sendMessage: async (id, body) => {
        const { data } = await apiClient.post(`/api/v1/chat/${id}/messages`, { body });
        return data;
    },

    deleteMessage: async (id) => {
        const { data } = await apiClient.delete(`/api/v1/chat/messages/${id}`);
        return data;
    },

    createDirectChat: async (contact) => {
        const { data } = await apiClient.post('/api/v1/chat/direct', { otherUserContact: contact });
        return data;
    },

    createGroup: async (title, participantIds) => {
        const { data } = await apiClient.post('/api/v1/chat/group', { title, participantIds });
        return data;
    },

    deleteConversation: async (id) => {
        const { data } = await apiClient.delete(`/api/v1/chat/${id}`);
        return data;
    },

    listGroups: async () => {
        const { data } = await apiClient.get('/api/v1/chat/groups');
        return data;
    },

    getGroup: async (id) => {
        const { data } = await apiClient.get(`/api/v1/chat/groups/${id}`);
        return data;
    },

    updateGroup: async (id, payload) => {
        const { data } = await apiClient.put(`/api/v1/chat/groups/${id}`, payload);
        return data;
    },

    joinGroup: async (id) => {
        const { data } = await apiClient.post(`/api/v1/chat/groups/${id}/join`, {});
        return data;
    },

    leaveGroup: async (id) => {
        const { data } = await apiClient.post(`/api/v1/chat/groups/${id}/leave`);
        return data;
    },

    addParticipants: async (id, participantIds) => {
        const { data } = await apiClient.post(`/api/v1/chat/groups/${id}/participants`, { participantIds });
        return data;
    },

    removeParticipant: async (id, userId) => {
        const { data } = await apiClient.delete(`/api/v1/chat/groups/${id}/participants/${userId}`);
        return data;
    },

    saveFile: async (fileName, content) => {
        const { data } = await apiClient.post('/api/v1/chat/save-file', { fileName, content });
        return data;
    },

    sendEmail: async (to, subject, body, conversationId) => {
        const { data } = await apiClient.post('/api/v1/chat/send-email', { to, subject, body, conversationId });
        return data;
    }
};
