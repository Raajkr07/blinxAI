import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useChatStore = create(
    persist(
        (set) => ({
            activeConversationId: null,
            typingUsers: {},
            optimisticMessages: {},
            pendingOutbox: {},
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

            addOptimisticMessage: (tempId, message, destination = null, payload = null) =>
                set((state) => {
                    const nextOptimistic = {
                        ...state.optimisticMessages,
                        [tempId]: message,
                    };
                    const nextOutbox = { ...state.pendingOutbox };
                    
                    if (destination && payload) {
                        nextOutbox[tempId] = { destination, payload, tempId };
                    }
                    
                    return {
                        optimisticMessages: nextOptimistic,
                        pendingOutbox: nextOutbox,
                    };
                }),

            removeOptimisticMessage: (tempId) =>
                set((state) => {
                    const { [tempId]: _, ...restOpt } = state.optimisticMessages;
                    const { [tempId]: __, ...restOutbox } = state.pendingOutbox;
                    return { 
                        optimisticMessages: restOpt,
                        pendingOutbox: restOutbox 
                    };
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

                    // If a live message matches the text of an optimistic message,
                    // we might want to clear the optimistic. For simplicity, 
                    // we just let the UI sort it out or the sender cleans it via tempId later.
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

            // Remove optimistic messages + outbox entries older than 24 hours
            cleanupStaleMessages: () =>
                set((state) => {
                    const now = Date.now();
                    const ONE_DAY = 24 * 60 * 60 * 1000;
                    const freshOptimistic = {};
                    const freshOutbox = {};

                    for (const [id, msg] of Object.entries(state.optimisticMessages)) {
                        const msgTime = new Date(msg.createdAt).getTime();
                        if (!isNaN(msgTime) && now - msgTime < ONE_DAY) {
                            freshOptimistic[id] = msg;
                        }
                    }

                    for (const [id, entry] of Object.entries(state.pendingOutbox)) {
                        if (id in freshOptimistic) {
                            freshOutbox[id] = entry;
                        }
                    }

                    return {
                        optimisticMessages: freshOptimistic,
                        pendingOutbox: freshOutbox,
                    };
                }),
        }),
        {
            name: 'chat-storage', // simple unique key in localStorage
            partialize: (state) => ({
                optimisticMessages: state.optimisticMessages,
                pendingOutbox: state.pendingOutbox,
            }),
        }
    )
);
