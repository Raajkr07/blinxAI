import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '../lib/storage';
import toast from 'react-hot-toast';

export const useUIStore = create((set) => ({
    isSidebarOpen: true,
    sidebarWidth: 320,
    setSidebarWidth: (width) => set({ sidebarWidth: width }),
    isSidebarCollapsed: false,

    onlinePanelHeight: storage.get(STORAGE_KEYS.ONLINE_PANEL_HEIGHT) || 200,
    setOnlinePanelHeight: (height) => {
        storage.set(STORAGE_KEYS.ONLINE_PANEL_HEIGHT, height);
        set({ onlinePanelHeight: height });
    },
    isOnlinePanelOpen: storage.get(STORAGE_KEYS.ONLINE_PANEL_OPEN) !== null
        ? storage.get(STORAGE_KEYS.ONLINE_PANEL_OPEN)
        : false,
    toggleOnlinePanel: () => set((state) => {
        const newValue = !state.isOnlinePanelOpen;
        storage.set(STORAGE_KEYS.ONLINE_PANEL_OPEN, newValue);
        return { isOnlinePanelOpen: newValue };
    }),

    activeModal: null,
    modalData: null,

    theme: storage.get(STORAGE_KEYS.THEME) || 'dark',

    isMobile: window.innerWidth < 768,

    activeView: 'chat',
    setActiveView: (view) => set({ activeView: view }),

    showAISuggestions: storage.get(STORAGE_KEYS.AI_SUGGESTIONS) !== null
        ? storage.get(STORAGE_KEYS.AI_SUGGESTIONS)
        : false,

    setShowAISuggestions: (show) => {
        storage.set(STORAGE_KEYS.AI_SUGGESTIONS, show);
        set({ showAISuggestions: show });
    },

    toggleAISuggestions: () => set((state) => {
        const newValue = !state.showAISuggestions;
        storage.set(STORAGE_KEYS.AI_SUGGESTIONS, newValue);
        return { showAISuggestions: newValue };
    }),

    toggleSidebar: () => set((state) => {
        if (state.isMobile) {
            return { isSidebarOpen: !state.isSidebarOpen };
        }
        return { isSidebarCollapsed: !state.isSidebarCollapsed };
    }),

    openModal: (modalName, data = null) =>
        set({ activeModal: modalName, modalData: data }),

    closeModal: () => set({ activeModal: null, modalData: null }),

    setTheme: (theme) => {
        storage.set(STORAGE_KEYS.THEME, theme);
        set({ theme });
    },

    toggleTheme: () =>
        set((state) => {
            const newTheme = state.theme === 'dark' ? 'light' : 'dark';
            storage.set(STORAGE_KEYS.THEME, newTheme);

            if (newTheme === 'dark') {
                toast('Hello BatMan!', {
                    icon: '🦇',
                    position: 'bottom-left',
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                });
            } else {
                toast('Changed to light!', {
                    icon: '🌞',
                    position: 'bottom-left',
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                });
            }

            return { theme: newTheme };
        }),

    setIsMobile: (isMobile) => set({ isMobile }),
}));
