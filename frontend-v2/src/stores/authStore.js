import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { authService } from '../services';
export const useAuthStore = create((set, get) => ({
    user: storage.get(STORAGE_KEYS.USER),
    accessToken: storage.get(STORAGE_KEYS.ACCESS_TOKEN),
    refreshToken: storage.get(STORAGE_KEYS.REFRESH_TOKEN),
    isAuthenticated: !!storage.get(STORAGE_KEYS.ACCESS_TOKEN),
    isLoading: false,
    error: null,

    setUser: (user) => {
        storage.set(STORAGE_KEYS.USER, user);
        set({ user, isAuthenticated: true });
    },

    setTokens: (accessToken, refreshToken) => {
        storage.set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        if (refreshToken) {
            storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        }
        set({ accessToken, refreshToken, isAuthenticated: true });
    },

    logout: async () => {
        const { refreshToken } = get();

        try {
            if (refreshToken) {
                await authService.logout(refreshToken);
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
            storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
            storage.remove(STORAGE_KEYS.USER);

            // Clear chat tabs from localStorage
            localStorage.removeItem('chat-tabs-storage');

            set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
                error: null,
            });
        }
    },

    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
}));
