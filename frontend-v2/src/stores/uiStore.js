import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '../lib/storage';



export const useUIStore = create((set) => ({

    isSidebarOpen: true,
    isSidebarCollapsed: false,
    sidebarWidth: 320,
    setSidebarWidth: (width) => set({ sidebarWidth: width }),


    activeModal: null,
    modalData: null,


    theme: storage.get(STORAGE_KEYS.THEME) || 'dark',


    isMobile: window.innerWidth < 768,


    toggleSidebar: () => set((state) => {
        if (state.isMobile) {
            return { isSidebarOpen: !state.isSidebarOpen };
        }
        return { isSidebarCollapsed: !state.isSidebarCollapsed };
    }),

    collapseSidebar: () => set({ isSidebarCollapsed: true }),

    expandSidebar: () => set({ isSidebarCollapsed: false }),

    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

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
            return { theme: newTheme };
        }),

    setIsMobile: (isMobile) => set({ isMobile }),
}));
