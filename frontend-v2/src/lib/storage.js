const STORAGE_KEYS = {
    ACCESS_TOKEN: 'blink_access_token',
    REFRESH_TOKEN: 'blink_refresh_token',
    USER: 'blink_user',
    THEME: 'blink_theme',
    AI_SUGGESTIONS: 'blink_ai_suggestions',
    ONLINE_PANEL_HEIGHT: 'blink_online_panel_height',
    ONLINE_PANEL_OPEN: 'blink_online_panel_open',
};

class Storage {
    get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Error reading from localStorage (${key}):`, error);
            return null;
        }
    }

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error writing to localStorage (${key}):`, error);
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`Error removing from localStorage (${key}):`, error);
        }
    }

    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }
}

export const storage = new Storage();
export { STORAGE_KEYS };
