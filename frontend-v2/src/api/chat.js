import apiClient from './client';

export const chatApi = {
    listConversations: async () => {
        const response = await apiClient.get('/api/v1/chat/conversations');
        return response.data;
    },

    getConversation: async (conversationId) => {
        const response = await apiClient.get(`/api/v1/chat/${conversationId}`);
        return response.data;
    },

    getMessages: async (conversationId, page = 0, size = 20) => {
        const response = await apiClient.get(
            `/api/v1/chat/${conversationId}/messages`,
            {
                params: { page, size },
            }
        );
        return response.data;
    },

    sendMessage: async (conversationId, body) => {
        const response = await apiClient.post(
            `/api/v1/chat/${conversationId}/messages`,
            { body }
        );
        return response.data;
    },

    deleteMessage: async (messageId) => {
        const response = await apiClient.delete(`/api/v1/chat/messages/${messageId}`);
        return response.data;
    },

    createDirectChat: async (otherUserContact) => {
        const response = await apiClient.post('/api/v1/chat/direct', {
            otherUserContact,
        });
        return response.data;
    },

    createGroup: async (title, participantIds) => {
        const response = await apiClient.post('/api/v1/chat/group', {
            title,
            participantIds,
        });
        return response.data;
    },

    deleteConversation: async (conversationId) => {
        const response = await apiClient.delete(`/api/v1/chat/${conversationId}`);
        return response.data;
    },

    listGroups: async () => {
        const response = await apiClient.get('/api/v1/chat/groups');
        return response.data;
    },

    getGroup: async (groupId) => {
        const response = await apiClient.get(`/api/v1/chat/groups/${groupId}`);
        return response.data;
    },

    updateGroup: async (groupId, data) => {
        const response = await apiClient.put(`/api/v1/chat/groups/${groupId}`, data);
        return response.data;
    },

    joinGroup: async (groupId) => {
        const response = await apiClient.post(`/api/v1/chat/groups/${groupId}/join`, {});
        return response.data;
    },

    leaveGroup: async (groupId) => {
        const response = await apiClient.post(`/api/v1/chat/groups/${groupId}/leave`, null);
        return response.data;
    },

    addParticipants: async (groupId, participantIds) => {
        const response = await apiClient.post(
            `/api/v1/chat/groups/${groupId}/participants`,
            { participantIds }
        );
        return response.data;
    },

    removeParticipant: async (groupId, userId) => {
        const response = await apiClient.delete(
            `/api/v1/chat/groups/${groupId}/participants/${userId}`
        );
        return response.data;
    },

    saveFile: async (fileName, content) => {
        const response = await apiClient.post('/api/v1/chat/save-file', {
            fileName,
            content,
        });
        return response.data;
    },

    sendEmail: async (to, subject, body) => {
        const response = await apiClient.post('/api/v1/chat/send-email', {
            to,
            subject,
            body,
        });
        return response.data;
    },
};
