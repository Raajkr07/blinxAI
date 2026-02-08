import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
    conversations: [],
    messages: new Map(), // conversationId -> Message[]
    activeTab: null,
    openTabs: [], // array of conversationIds
    selectedConversation: null,

    // Socket & Connection state
    connected: false,
    onlineUserIds: [],
    typingUsers: new Map(), // conversationId -> Set<userId>

    // UI State
    loadingMessages: false,
    loadingConversations: false, // NEW

    // Actions
    setConversations: (conversations) => set({ conversations }),

    addConversation: (conversation) => set((state) => {
        // Check if exists
        if (state.conversations.find(c => c.id === conversation.id)) return state;
        return { conversations: [conversation, ...state.conversations] };
    }),

    updateConversation: (updatedConv) => set((state) => ({
        conversations: state.conversations.map(c => c.id === updatedConv.id ? updatedConv : c)
    })),

    setMessages: (conversationId, messages) => set((state) => {
        const newMap = new Map(state.messages);
        newMap.set(conversationId, messages);
        return { messages: newMap };
    }),

    addMessage: (message) => set((state) => {
        const conversationId = message.conversationId;
        const currentMessages = state.messages.get(conversationId) || [];
        // Check for duplicates
        if (currentMessages.some(m => m.id === message.id)) return state;

        const newMessages = [...currentMessages, message];
        const newMap = new Map(state.messages);
        newMap.set(conversationId, newMessages);

        // Also update conversation last message if needed
        // (This is usually handled by refetching conversations or updating specific conv item)

        return { messages: newMap };
    }),

    setActiveTab: (conversationId) => {
        const state = get();
        const conversation = state.conversations.find(c => c.id === conversationId);
        set({ activeTab: conversationId, selectedConversation: conversation });

        // Add to open tabs if not present
        if (conversationId && !state.openTabs.includes(conversationId)) {
            set(s => ({ openTabs: [...s.openTabs, conversationId] }));
        }
    },

    closeTab: (conversationId) => set((state) => {
        const newTabs = state.openTabs.filter(id => id !== conversationId);

        let newActive = state.activeTab;
        let newSelected = state.selectedConversation;

        // If closing the active tab
        if (state.activeTab === conversationId) {
            if (newTabs.length === 0) {
                newActive = null;
                newSelected = null;
            } else {
                // Try to find the tab before the closed one, or default to the last one
                const index = state.openTabs.indexOf(conversationId);
                // If there was a tab before, use it (index - 1), otherwise use the one that took its place or the last one
                // openTabs: [A, B, C]. Close B. New: [A, C]. index of B was 1. new index 1 is C.
                // We typically want the "previous" tab in history, but simpler is just the neighbor.
                // If we close the last tab, go to previous.
                const newIndex = index > 0 ? index - 1 : 0;
                newActive = newTabs[newIndex] || newTabs[0];
                newSelected = state.conversations.find(c => c.id === newActive) || null;
            }
        }

        return { openTabs: newTabs, activeTab: newActive, selectedConversation: newSelected };
    }),

    setConnected: (status) => set({ connected: status }),
    setOnlineUserIds: (ids) => set({ onlineUserIds: ids }),

    setTypingUser: (conversationId, userId, isTyping) => set((state) => {
        const newTyping = new Map(state.typingUsers);
        const oldSet = newTyping.get(conversationId) || new Set();
        const newSet = new Set(oldSet);

        if (isTyping) newSet.add(userId);
        else newSet.delete(userId);

        newTyping.set(conversationId, newSet);
        return { typingUsers: newTyping };
    }),

    setLoadingMessages: (loading) => set({ loadingMessages: loading }),
    setLoadingConversations: (loading) => set({ loadingConversations: loading }),
}));
