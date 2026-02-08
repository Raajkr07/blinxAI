import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './authStore';

export const useTabsStore = create(
    persist(
        (set, get) => ({
            tabs: [],
            activeTabId: null,

            openTab: (conversation) => {
                const { tabs } = get();

                // Check if a tab already exists for this conversation
                const existingTab = tabs.find((tab) => tab.conversationId === conversation.id);

                if (existingTab) {
                    // Tab exists - just switch to it
                    set({ activeTabId: existingTab.id });
                } else {
                    // Find other user ID for direct chats
                    let otherUserId = null;
                    if (conversation.type === 'DIRECT' || !conversation.type) {
                        const currentUser = useAuthStore.getState().user;
                        if (currentUser && conversation.participants) {
                            const otherParticipant = conversation.participants.find(
                                p => (typeof p === 'string' ? p : p.id) !== currentUser.id
                            );
                            otherUserId = typeof otherParticipant === 'string' ? otherParticipant : otherParticipant?.id;
                        }
                    }

                    // Create a new tab
                    const newTab = {
                        id: `tab-${Date.now()}-${conversation.id}`,
                        conversationId: conversation.id,
                        title: conversation.title || 'Chat',
                        type: conversation.type || 'DIRECT',
                        avatar: conversation.avatarUrl,
                        otherUserId,
                    };

                    set({
                        tabs: [...tabs, newTab],
                        activeTabId: newTab.id,
                    });
                }
            },

            closeTab: (tabId) => {
                const { tabs, activeTabId } = get();
                const tabIndex = tabs.findIndex((tab) => tab.id === tabId);

                if (tabIndex === -1) return;

                const newTabs = tabs.filter((tab) => tab.id !== tabId);

                let newActiveTabId = activeTabId;
                if (activeTabId === tabId) {
                    if (newTabs.length > 0) {
                        const newIndex = tabIndex > 0 ? tabIndex - 1 : 0;
                        newActiveTabId = newTabs[newIndex]?.id || null;
                    } else {
                        newActiveTabId = null;
                    }
                }

                set({
                    tabs: newTabs,
                    activeTabId: newActiveTabId,
                });
            },

            setActiveTab: (tabId) => {
                set({ activeTabId: tabId });
            },

            closeAllTabs: () => {
                set({ tabs: [], activeTabId: null });
            },

            getActiveTab: () => {
                const { tabs, activeTabId } = get();
                return tabs.find((tab) => tab.id === activeTabId) || null;
            },

            getTabByConversationId: (conversationId) => {
                const { tabs } = get();
                return tabs.find((tab) => tab.conversationId === conversationId) || null;
            },
        }),
        {
            name: 'chat-tabs-storage',
            // Only persist tabs and activeTabId
            partialize: (state) => ({
                tabs: state.tabs,
                activeTabId: state.activeTabId,
            }),
            // Sync with chatStore when hydrated from localStorage
            onRehydrateStorage: () => (state) => {
                if (state?.activeTabId && state?.tabs?.length > 0) {
                    const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
                    if (activeTab) {
                        // Import chatStore dynamically to avoid circular dependency
                        import('./chatStore').then(({ useChatStore }) => {
                            useChatStore.getState().setActiveConversation(activeTab.conversationId);
                        });
                    }
                }
            },
        }
    )
);
