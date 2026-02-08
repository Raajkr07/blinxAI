import React from 'react';

export default function EmptyState({ onStartNewChat, groups, onJoinGroup }) {
    return (
        <div className="flex flex-1 flex-col lg:flex-row relative z-10 h-full">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center text-slate-400 px-6 py-8 relative">
                <div className="mb-6 text-6xl opacity-50 animate-bounce-slow">✨</div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome to Blink</h2>
                <p className="text-lg font-medium text-slate-400 text-center max-w-md mb-8">
                    Connect with friends, create groups, and chat with our AI assistant.
                </p>
                <button
                    onClick={onStartNewChat}
                    className="px-6 py-3 rounded-xl bg-indigo-600 font-semibold text-white shadow-lg hover:bg-indigo-500 hover:-translate-y-1 transition-all"
                >
                    Start New Chat
                </button>
            </div>

            {/* Discover Groups */}
            <div className="w-full lg:max-w-xs border-l border-white/5 bg-slate-900/30 backdrop-blur-md p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Discover groups</h4>
                </div>
                <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 max-h-[500px]">
                    {groups.length === 0 ? (
                        <div className="text-xs text-slate-500 italic">No public groups found.</div>
                    ) : (
                        groups.map((g, idx) => (
                            <div key={g.id || `grp-${idx}`} className="group flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 hover:border-indigo-500/30 hover:bg-white/10 transition-all">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-semibold text-slate-200 group-hover:text-white transition-colors">
                                        {g.title || g.name || g.groupName || `Group ${idx + 1}`}
                                    </div>
                                    {g.description && (
                                        <div className="truncate text-xs text-slate-500 mt-0.5">{g.description}</div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onJoinGroup(g.id)}
                                    className="shrink-0 rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500 hover:text-white transition-all"
                                >
                                    Join
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
