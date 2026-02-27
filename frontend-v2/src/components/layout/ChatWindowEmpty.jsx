import { useTempViewsStore } from '../../stores/tempViewsStore';
import { IncognitoChatWindow } from '../../components/chat/temporarychat/IncognitoChatWindow';
import { WebToolsWindow } from '../../components/chat/temporarychat/WebToolsWindow';
import { DataAnalysisWindow } from '../../components/chat/temporarychat/DataAnalysisWindow';
import { ConfigureSystemWindow } from '../../components/chat/temporarychat/ConfigureSystemWindow';

export function ChatWindowEmpty() {
    const { activeView, setActiveView } = useTempViewsStore();

    return (
        <div className="relative h-full w-full bg-[var(--color-background)] overflow-hidden">

            {activeView === 'incognito' && <IncognitoChatWindow key="incognito" onClose={() => setActiveView(null)} />}
            {(activeView === 'news' || activeView === 'webTools') && <WebToolsWindow key="news" onClose={() => setActiveView(null)} />}
            {activeView === 'dataAnalysis' && <DataAnalysisWindow key="dataAnalysis" onClose={() => setActiveView(null)} />}
            {activeView === 'configureSystem' && <ConfigureSystemWindow key="configureSystem" onClose={() => setActiveView(null)} />}

            {!activeView && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center relative z-10 overflow-auto group/empty">

                    <div className="glass-strong border border-white/[0.05] rounded-[2rem] p-12 max-w-lg w-full shadow-2xl backdrop-blur-3xl relative overflow-hidden group/card transform transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
                        {/* Subtle sheen passing through card */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover/card:animate-[shimmer_2s_infinite] pointer-events-none" />

                        <div className="mb-8 relative z-10">
                            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-3xl flex items-center justify-center border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] transform transition-transform duration-500 rotate-0 group-hover/card:-rotate-3">
                                <svg
                                    className="h-10 w-10 text-white/70"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                    />
                                </svg>
                            </div>
                        </div>

                        <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 animate-pulse">
                            Select a conversation
                        </h3>
                        <p className="text-[15px] text-[var(--color-gray-400)] leading-relaxed max-w-sm mx-auto">
                            Choose an active conversation from the sidebar to continue chatting, or start something new.
                        </p>
                    </div>

                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
                        {/* Incognito */}
                        <button
                            onClick={() => setActiveView('incognito')}
                            className="flex flex-col items-start gap-2 p-4 rounded-xl bg-white/[0.03] hover:bg-indigo-500/10 border border-white/[0.05] hover:border-indigo-500/30 transition-all duration-300 text-left group"
                        >
                            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8Z" />
                                    <polyline points="15,9 18,9 22,15" />
                                    <path d="M2 15h4.5c.5 0 1-.2 1.4-.5l3.5-3.5" />
                                    <circle cx="9" cy="13" r="1.5" />
                                    <circle cx="16" cy="13" r="1.5" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-[var(--color-foreground)] group-hover:text-indigo-400 transition-colors">Incognito Chat</h4>
                                <p className="text-[11px] text-[var(--color-gray-500)] mt-0.5">Vanish mode ephemeral intelligence.</p>
                            </div>
                        </button>

                        {/* Browser Extension */}
                        <button
                            onClick={() => setActiveView('news')}
                            className="flex flex-col items-start gap-2 p-4 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 border border-white/[0.05] hover:border-emerald-500/30 transition-all duration-300 text-left group"
                        >
                            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m18 16 4-4-4-4" />
                                    <path d="m6 8-4 4 4 4" />
                                    <path d="m14.5 4-5 16" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-[var(--color-foreground)] group-hover:text-emerald-400 transition-colors">News</h4>
                                <p className="text-[11px] text-[var(--color-gray-500)] mt-0.5">Scroll headlines and open links.</p>
                            </div>
                        </button>

                        {/* Analytics */}
                        <button
                            onClick={() => setActiveView('dataAnalysis')}
                            className="flex flex-col items-start gap-2 p-4 rounded-xl bg-white/[0.03] hover:bg-blue-500/10 border border-white/[0.05] hover:border-blue-500/30 transition-all duration-300 text-left group"
                        >
                            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 3v18h18" />
                                    <path d="m19 9-5 5-4-4-3 3" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-[var(--color-foreground)] group-hover:text-blue-400 transition-colors">Data Cruncher</h4>
                                <p className="text-[11px] text-[var(--color-gray-500)] mt-0.5">Crunch complex CSV and trends.</p>
                            </div>
                        </button>

                        {/* Custom Settings */}
                        <button
                            onClick={() => setActiveView('configureSystem')}
                            className="flex flex-col items-start gap-2 p-4 rounded-xl bg-white/[0.03] hover:bg-rose-500/10 border border-white/[0.05] hover:border-rose-500/30 transition-all duration-300 text-left group"
                        >
                            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-[var(--color-foreground)] group-hover:text-rose-400 transition-colors">Configure System</h4>
                                <p className="text-[11px] text-[var(--color-gray-500)] mt-0.5">Personal rules and memories.</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}