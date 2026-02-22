import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { authService, userService } from '../services';

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
        if (refreshToken) storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

        // Keep the existing refresh token if the caller didn't provide a new one.
        // (Some refresh endpoints only rotate the access token.)
        const effectiveRefreshToken = refreshToken || storage.get(STORAGE_KEYS.REFRESH_TOKEN);

        set({ accessToken, refreshToken: effectiveRefreshToken, isAuthenticated: true });
    },

    logout: async () => {
        const { refreshToken } = get();
        const { socketService } = await import('../services/socketService');

        try {
            // 1. Tell the server we're leaving (Revokes tokens & sets offline)
            if (refreshToken) {
                await authService.logout(refreshToken);
            } else {
                await authService.logoutGoogle();
            }
        } catch (error) {
            console.warn('Logout API call failed, proceeding with local cleanup:', error.message);
        } finally {
            // 2. Disconnect socket immediately
            socketService.disconnect();

            // 3. Clear local session data
            storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
            storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
            storage.remove(STORAGE_KEYS.USER);

            // 4. Clear app-specific local state
            localStorage.removeItem('chat-tabs-storage');

            set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
                error: null,
            });

            // 5. Redirect to landing if needed
            window.location.href = '/';
        }
    },

    checkSession: async () => {
        // If we're already authenticated with a valid user, nothing to do.
        const already = get();
        if (already.isAuthenticated && already.user?.id) return true;

        // Check for Google OAuth error in URL — redirect to dedicated error page
        const searchParams = new URLSearchParams(window.location.search);
        const oauthError = searchParams.get('error');
        if (oauthError === 'access_denied') {
            window.location.replace('/oauth-error');
            return false;
        }

        // Start session init. Important: this can overlap with a user logging in,
        // so we must not clobber newly-authenticated state on failure.
        set({ isLoading: true });

        try {
            // 1) If we have an access token but no profile, fetch `/me`.
            // This fixes a common state where login sets tokens first then user later.
            const tokenInStorage = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
            const userInStorage = storage.get(STORAGE_KEYS.USER);

            if (tokenInStorage && !(userInStorage && userInStorage.id)) {
                try {
                    const me = await userService.getMe();
                    if (me && me.id) {
                        storage.set(STORAGE_KEYS.USER, me);
                        set({ user: me, accessToken: tokenInStorage, isAuthenticated: true, error: null });
                        return true;
                    }
                } catch {
                    // Fall through to other session strategies
                }
            }

            // 2) Cookie-based Google session (OAuth)
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

            // If OAuth session check failed, try using standard refresh token if we have one
            // (Prefer storage as the in-memory state could be mid-update.)
            const localRT = storage.get(STORAGE_KEYS.REFRESH_TOKEN) || get().refreshToken;
            if (localRT) {
                try {
                    const data = await authService.refreshToken(localRT);
                    if (data.accessToken) {
                        get().setTokens(data.accessToken, data.refreshToken);
                        // Fetch fresh user data
                        const user = await userService.getMe();
                        get().setUser(user);
                        return true;
                    }
                } catch (refreshErr) {
                    console.error('Local refresh fallback failed:', refreshErr);
                }
            }

            // Only mark as unauthenticated if we *still* have no session.
            // This avoids a race where the user logs in while checkSession is in-flight.
            const currentToken = storage.get(STORAGE_KEYS.ACCESS_TOKEN) || get().accessToken;
            const currentUser = storage.get(STORAGE_KEYS.USER) || get().user;

            if (!currentToken && !(currentUser && currentUser.id)) {
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
