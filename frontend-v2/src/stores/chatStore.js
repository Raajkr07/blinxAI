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
            const { [tempId]: removed, ...rest } = state.optimisticMessages;
            return { optimisticMessages: rest };
        }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setSearchResults: (results) => set({ searchResults: results }),

    clearSearch: () => set({ searchQuery: '', searchResults: [] }),
}));
