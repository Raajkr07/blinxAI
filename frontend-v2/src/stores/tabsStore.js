import { create } from 'zustand';



export const useTabsStore = create((set, get) => ({

    tabs: [],
    activeTabId: null,


    openTab: (conversation) => {
        const { tabs } = get();


        const existingTab = tabs.find((tab) => tab.conversationId === conversation.id);

        if (existingTab) {

            set({ activeTabId: existingTab.id });
        } else {

            const newTab = {
                id: `tab-${Date.now()}`,
                conversationId: conversation.id,
                title: conversation.title,
                type: conversation.type,
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
}));
