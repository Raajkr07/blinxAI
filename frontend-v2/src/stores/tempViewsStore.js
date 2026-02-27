import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../lib/utils';

const toNewsSource = (raw, isSelected = false) => {
    const url = typeof raw === 'string' ? raw.trim() : String(raw?.url || '').trim();
    if (!url) return null;

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    let alias = typeof raw === 'string' ? '' : String(raw?.alias || '').trim();
    if (!alias) {
        try {
            alias = new URL(normalizedUrl).host;
        } catch {
            alias = url;
        }
    }

    return {
        id: `src-${generateId()}`,
        url,
        alias,
        selected: !!(typeof raw === 'object' && raw?.selected) || isSelected,
    };
};

export const useTempViewsStore = create(
    persist(
        (set) => ({
            // Controls which view is currently open instead of the 'Select a conversation' screen
            // Can be: null, 'incognito', 'news', 'dataAnalysis', 'configureSystem'
            activeView: null,

            setActiveView: (view) => set({ activeView: view === 'webTools' ? 'news' : view }),
            closeView: () => set({ activeView: null }),

            // Incognito Messages (Ephemerally stored in RAM, lost on refresh)
            incognitoMessages: [
                {
                    id: 'init-1',
                    senderId: 'ai-incognito',
                    body: 'You are now in Incognito Chat. Your messages here are entirely temporary and will vanish the moment you refresh or navigate away. How can I help you in strict confidence?',
                    createdAt: new Date().toISOString(),
                }
            ],

            addIncognitoMessage: (msg) => set((state) => {
                // Keep max 200 messages in memory to prevent unbounded growth
                const messages = [...state.incognitoMessages, msg];
                return {
                    incognitoMessages: messages.length > 200 ? messages.slice(-200) : messages
                };
            }),

            clearIncognitoMessages: () => set({
                incognitoMessages: [{
                    id: `msg-${generateId()}`,
                    senderId: 'ai-incognito',
                    body: 'Memory cleared. What else would you like to discuss?',
                    createdAt: new Date().toISOString()
                }]
            }),

            // --- News Sources State ---
            newsSources: [],

            addNewsSource: ({ url, alias }) => set((state) => {
                const next = (state.newsSources || []).filter((s) => (s?.url || '').trim() !== (url || '').trim());
                const created = toNewsSource({ url, alias, selected: true }, true);
                if (!created) return { newsSources: next };

                // Single-select: adding selects this and deselects others.
                const deselected = next.map((s) => ({ ...s, selected: false }));
                return { newsSources: [created, ...deselected].slice(0, 50) };
            }),

            removeNewsSource: (id) => set((state) => {
                const remaining = (state.newsSources || []).filter((s) => s?.id !== id);
                if (remaining.length === 0) return { newsSources: [] };

                // Ensure one stays selected.
                const hasSelected = remaining.some((s) => s.selected);
                if (hasSelected) return { newsSources: remaining };
                return { newsSources: remaining.map((s, idx) => ({ ...s, selected: idx === 0 })) };
            }),

            selectNewsSource: (id) => set((state) => ({
                newsSources: (state.newsSources || []).map((s) => ({
                    ...s,
                    selected: s?.id === id,
                }))
            })),

            updateNewsSourceAlias: (id, alias) => set((state) => ({
                newsSources: (state.newsSources || []).map((s) => (
                    s?.id === id ? { ...s, alias: String(alias || '').trim() } : s
                ))
            })),

            // --- Data Analysis State ---
            isCrunching: false,
            analysisStatus: null,
            setIsCrunching: (val) => set({ isCrunching: val }),
            setAnalysisStatus: (val) => set({ analysisStatus: val })
        }),
        {
            name: 'temp-views-storage',
            version: 2,
            migrate: (persistedState) => {
                if (!persistedState || typeof persistedState !== 'object') return persistedState;

                // Back-compat: old key `successfulWebsites: string[]` -> new `newsSources` model
                const hasNewsSources = Array.isArray(persistedState.newsSources);
                const oldUrls = Array.isArray(persistedState.successfulWebsites) ? persistedState.successfulWebsites : null;

                if (!hasNewsSources && oldUrls) {
                    const mapped = oldUrls
                        .map((u, idx) => toNewsSource(u, idx === 0))
                        .filter(Boolean);
                    return {
                        ...persistedState,
                        activeView: persistedState.activeView === 'webTools' ? 'news' : persistedState.activeView,
                        newsSources: mapped,
                    };
                }

                return {
                    ...persistedState,
                    activeView: persistedState.activeView === 'webTools' ? 'news' : persistedState.activeView,
                };
            },
            partialize: (state) => Object.fromEntries(
                Object.entries(state).filter(([key]) => key !== 'incognitoMessages')
            ),
        }
    )
);
