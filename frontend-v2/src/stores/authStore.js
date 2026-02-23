import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { authService, userService } from '../services';
import { reportErrorOnce } from '../lib/reportError';

export const useAuthStore = create((set, get) => ({
    user: storage.get(STORAGE_KEYS.USER),
    accessToken: storage.get(STORAGE_KEYS.ACCESS_TOKEN),
    refreshToken: storage.get(STORAGE_KEYS.REFRESH_TOKEN),
    isAuthenticated: !!storage.get(STORAGE_KEYS.ACCESS_TOKEN),
    isLoading: !storage.get(STORAGE_KEYS.ACCESS_TOKEN) && !!storage.get(STORAGE_KEYS.USER),
    hasCheckedSession: false,
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
            reportErrorOnce('logout-failed', error, 'Logout failed');
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
        if (already.isAuthenticated && already.user?.id) {
            set({ hasCheckedSession: true });
            return true;
        }

        // If we have no tokens and no cached user, do not probe protected endpoints.
        // This avoids unnecessary 401s for anonymous visitors.
        const storedAccess = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
        const storedRefresh = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
        const storedUser = storage.get(STORAGE_KEYS.USER);
        if (!storedAccess && !storedRefresh && !(storedUser && storedUser.id)) {
            set({ isAuthenticated: false, user: null, accessToken: null, refreshToken: null, error: null, hasCheckedSession: true, isLoading: false });
            return false;
        }

        // Check for Google OAuth error in URL — redirect to dedicated error page
        const searchParams = new URLSearchParams(window.location.search);
        const oauthError = searchParams.get('error');
        if (oauthError === 'access_denied') {
            window.location.replace('/oauth-error');
            set({ hasCheckedSession: true });
            return false;
        }

        // Start session init. Important: this can overlap with a user logging in,
        // so we must not clobber newly-authenticated state on failure.
        set({ isLoading: true, hasCheckedSession: false });

        try {
            // 1) If we have an access token but no profile, fetch `/me`.
            // This fixes a common state where login sets tokens first then user later.
            const tokenInStorage = storedAccess;
            const userInStorage = storedUser;

            if (tokenInStorage && !(userInStorage && userInStorage.id)) {
                try {
                    const me = await userService.getMe();
                    if (me && me.id) {
                        storage.set(STORAGE_KEYS.USER, me);
                        set({ user: me, accessToken: tokenInStorage, isAuthenticated: true, error: null });
                        return true;
                    }
                } catch (error) {
                    // If token is expired/invalid, try refresh token and retry.
                    const localRT = storedRefresh || get().refreshToken;
                    if (localRT && (error?.status === 401 || error?.status === 403)) {
                        try {
                            const data = await authService.refreshToken(localRT);
                            if (data?.accessToken) {
                                get().setTokens(data.accessToken, data.refreshToken);
                                const me = await userService.getMe();
                                if (me && me.id) {
                                    get().setUser(me);
                                    return true;
                                }
                            }
                        } catch (refreshErr) {
                            set({ error: refreshErr });
                            reportErrorOnce('session-refresh', refreshErr, 'Session expired. Please sign in again.');
                        }
                    } else {
                        set({ error });
                        reportErrorOnce('session-check', error, 'Session check failed');
                    }
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
            set({ error });

            // If OAuth session check failed, try using standard refresh token if we have one
            // (Prefer storage as the in-memory state could be mid-update.)
            const localRT = storage.get(STORAGE_KEYS.REFRESH_TOKEN) || get().refreshToken;
            if (localRT && (error?.status === 401 || error?.status === 403)) {
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
                    set({ error: refreshErr });
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
            set({ isLoading: false, hasCheckedSession: true });
        }
        return false;
    },

    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
}));
