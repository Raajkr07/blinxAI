import { create } from 'zustand';

export const useUIStore = create((set) => ({
    // Toast State
    toast: null,
    showToast: (message, type = 'info', duration = 3000) => {
        set({ toast: { message, type, duration } });
    },
    hideToast: () => set({ toast: null }),

    // Modal State
    activeModal: null, // 'newChat', 'editProfile', 'viewProfile', 'groupManagement', 'summary', 'incomingCall'
    modalData: null, // extra data for the modal (e.g. userId for viewProfile)

    openModal: (modalName, data = null) => set({ activeModal: modalName, modalData: data }),
    closeModal: () => set({ activeModal: null, modalData: null }),

    // Sidebar State
    sidebarWidth: 320,
    setSidebarWidth: (width) => set({ sidebarWidth: width }),
}));
