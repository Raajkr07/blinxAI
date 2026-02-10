import { create } from 'zustand';

export const useChatStore = create((set) => ({
    activeConversationId: null,
    typingUsers: {},
    optimisticMessages: {},
    searchQuery: '',
    searchResults: [],
    setActiveConversation: (conversationId) =>
        set({ activeConversationId: conversationId }),

    clearActiveConversation: () => set({ activeConversationId: null }),

    addTypingUser: (conversationId, userId) =>
        set((state) => {
            const current = state.typingUsers[conversationId] || [];
            if (current.includes(userId)) return state;
            return {
                typingUsers: {
                    ...state.typingUsers,
                    [conversationId]: [...current, userId],
                },
            };
        }),

    removeTypingUser: (conversationId, userId) =>
        set((state) => {
            const current = state.typingUsers[conversationId] || [];
            return {
                typingUsers: {
                    ...state.typingUsers,
                    [conversationId]: current.filter((id) => id !== userId),
                },
            };
        }),

    addOptimisticMessage: (tempId, message) =>
        set((state) => ({
            optimisticMessages: {
                ...state.optimisticMessages,
                [tempId]: message,
            },
        })),

    removeOptimisticMessage: (tempId) =>
        set((state) => {
            const { [tempId]: _, ...rest } = state.optimisticMessages;
            return { optimisticMessages: rest };
        }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setSearchResults: (results) => set({ searchResults: results }),

    clearSearch: () => set({ searchQuery: '', searchResults: [] }),

    liveMessages: {},

    addLiveMessage: (conversationId, message) =>
        set((state) => {
            const current = state.liveMessages[conversationId] || [];

            // Normalize timestamp
            const normalizedMsg = {
                ...message,
                createdAt: message.createdAt && !message.createdAt.endsWith('Z')
                    ? `${message.createdAt}Z`
                    : message.createdAt
            };

            // Deduplicate
            if (current.some(m => m.id === normalizedMsg.id)) return state;

            return {
                liveMessages: {
                    ...state.liveMessages,
                    [conversationId]: [...current, normalizedMsg],
                },
            };
        }),

    clearLiveMessages: (conversationId) =>
        set((state) => {
            const { [conversationId]: _, ...rest } = state.liveMessages;
            return { liveMessages: rest };
        }),
}));
