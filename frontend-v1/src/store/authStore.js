import { create } from 'zustand';
import { fetchMe, refreshAccessToken as apiRefreshToken } from '../api/authApi';

export const useAuthStore = create((set, get) => ({
    user: null,
    token: localStorage.getItem('token'),
    refreshToken: localStorage.getItem('refreshToken'),
    loading: true,
    isAuthenticated: false,

    initialize: async () => {
        const { token, refreshToken } = get();

        if (!token) {
            set({ loading: false, isAuthenticated: false });
            return;
        }

        try {
            // 1. Try with existing access token
            const user = await fetchMe(token);
            set({ user, isAuthenticated: true, loading: false });
        } catch (error) {
            console.warn('Session invalid, attempting refresh...', error);

            // 2. Try to refresh if we have a refresh token
            if (refreshToken) {
                try {
                    const tokens = await apiRefreshToken(refreshToken);

                    // Update storage and state
                    localStorage.setItem('token', tokens.accessToken);
                    localStorage.setItem('refreshToken', tokens.refreshToken); // Rotation

                    set({
                        token: tokens.accessToken,
                        refreshToken: tokens.refreshToken
                    });

                    // Retry profile fetch with new token
                    const user = await fetchMe(tokens.accessToken);
                    set({ user, isAuthenticated: true, loading: false });
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    get().logout();
                }
            } else {
                // No refresh token, just logout
                get().logout();
            }
        }
    },

    loginWithToken: async (accessToken) => {
        localStorage.setItem('token', accessToken);
        set({ token: accessToken });

        try {
            const user = await fetchMe(accessToken);
            set({ user, isAuthenticated: true, loading: false });
        } catch (e) {
            console.error("Login failed during profile fetch", e);
            get().logout();
            throw e;
        }
    },

    loginWithTokens: async (accessToken, refreshToken) => {
        localStorage.setItem('refreshToken', refreshToken);
        set({ refreshToken }); // Update state first
        await get().loginWithToken(accessToken);
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false, loading: false });
    },

    updateUser: (updates) => {
        set(state => ({ user: { ...state.user, ...updates } }));
    }
}));
