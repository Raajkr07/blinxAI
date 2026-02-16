import { QueryClient } from '@tanstack/react-query';



export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 10 * 60 * 1000, // 10 minutes
        },
        mutations: {
            retry: false,
        },
    },
});



export const queryKeys = {

    me: ['me'],


    user: (userId) => ['user', userId],
    users: (query) => ['users', query],
    onlineUsers: ['onlineUsers'],


    conversations: ['conversations'],
    conversation: (id) => ['conversation', id],


    messages: (conversationId, page) => ['messages', conversationId, page],


    groups: ['groups'],
    group: (groupId) => ['group', groupId],


    aiConversation: ['aiConversation'],


    calls: ['calls'],
    call: (callId) => ['call', callId],
    callHistory: (params) => ['callHistory', params],
};
