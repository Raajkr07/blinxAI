import apiClient from './client';

export const callsApi = {
    // Start a new video or audio call with someone
    initiateCall: async (data) => {
        const response = await apiClient.post('/api/v1/calls/initiate', {
            receiverId: data.receiverId,
            type: data.type.toUpperCase(),
            conversationId: data.conversationId,
        });
        return response.data;
    },

    // Accept the incoming call
    acceptCall: async (callId) => {
        const response = await apiClient.post(`/api/v1/calls/${callId}/accept`);
        return response.data;
    },

    // Reject the call when you don't want to pick up
    rejectCall: async (callId) => {
        const response = await apiClient.post(`/api/v1/calls/${callId}/reject`);
        return response.data;
    },

    // End the ongoing call
    endCall: async (callId) => {
        const response = await apiClient.post(`/api/v1/calls/${callId}/end`);
        return response.data;
    },

    // Get complete details of any specific call
    getCall: async (callId) => {
        const response = await apiClient.get(`/api/v1/calls/${callId}`);
        return response.data;
    },

    // Fetch all active calls that are currently going on
    getActiveCalls: async () => {
        const response = await apiClient.get('/api/v1/calls/active');
        return response.data;
    },

    // Get call history with filters like date range, call type, status etc
    // Backend supports pagination so we can load data in chunks
    getCallHistory: async (params = {}) => {
        const response = await apiClient.get('/api/v1/calls/history', { params });
        return response.data;
    },
};
