import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { authService } from '../services';

export const useAuthStore = create((set, get) => ({
    user: storage.get(STORAGE_KEYS.USER),
    accessToken: storage.get(STORAGE_KEYS.ACCESS_TOKEN),
    refreshToken: storage.get(STORAGE_KEYS.REFRESH_TOKEN),
    isAuthenticated: !!storage.get(STORAGE_KEYS.ACCESS_TOKEN),
    isLoading: !storage.get(STORAGE_KEYS.ACCESS_TOKEN) && !!storage.get(STORAGE_KEYS.USER),
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
            } else {
                await authService.logoutGoogle();
            }
        } catch {
            // Failure to call logout API shouldn't prevent local state clearing
        } finally {
            storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
            storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
            storage.remove(STORAGE_KEYS.USER);

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

    checkSession: async () => {
        const { user: localUser, accessToken: localToken } = get();

        if (localUser && localToken) {
            set({ isAuthenticated: true, isLoading: false });
            return true;
        }

        // NEW USER OPTIMIZATION: If no local profile exists, don't show the loading screen
        if (!localUser) {
            set({ isLoading: false });
        } else {
            set({ isLoading: true });
        }

        try {
            const sessionPromise = authService.getGoogleSession();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Session check timeout')), 10000)
            );

            const { user, accessToken } = await Promise.race([sessionPromise, timeoutPromise]);

            if (user && user.id) {
                storage.set(STORAGE_KEYS.USER, user);
                if (accessToken) {
                    storage.set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
                }
                set({ user, accessToken, isAuthenticated: true, error: null });
                return true;
            }
        } catch (error) {
            console.warn('Session initialization fallback:', error.message);
            // If network fails or timeouts, we still stay on the auth page (or uses local if present)
            if (!localToken) {
                set({ isAuthenticated: false, user: null, accessToken: null });
            }
        } finally {
            set({ isLoading: false });
        }
        return false;
    },

    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
}));
