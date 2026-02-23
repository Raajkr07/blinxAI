const STORAGE_KEYS = {
    ACCESS_TOKEN: 'blink_access_token',
    REFRESH_TOKEN: 'blink_refresh_token',
    USER: 'blink_user',
    THEME: 'blink_theme',
    AI_SUGGESTIONS: 'blink_ai_suggestions',
    ONLINE_PANEL_HEIGHT: 'blink_online_panel_height',
    ONLINE_PANEL_OPEN: 'blink_online_panel_open',
    SIDEBAR_COLLAPSED: 'blink_sidebar_collapsed',
};

class Storage {
    get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            void error;
            return null;
        }
    }

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            // Storage failures affect persistence; surface once without leaking details.
            // Lazy import avoids pulling toast into initial bundles unnecessarily.
            import('./reportError').then(({ reportErrorOnce }) => {
                reportErrorOnce('storage-unavailable', error, 'Storage is unavailable. Changes may not be saved.');
            });
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            import('./reportError').then(({ reportErrorOnce }) => {
                reportErrorOnce('storage-unavailable', error, 'Storage is unavailable. Changes may not be saved.');
            });
        }
    }

    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            import('./reportError').then(({ reportErrorOnce }) => {
                reportErrorOnce('storage-unavailable', error, 'Storage is unavailable. Changes may not be saved.');
            });
        }
    }
}

export const storage = new Storage();
export { STORAGE_KEYS };
