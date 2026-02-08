import React from 'react';
import CallButton from '../video/CallButton';

export default function ChatHeader({
    conversation,
    title,
    user,
    onViewProfile,
    onManageGroup,
    onVideoCall,
    onAudioCall,
    callStatus,
    onSummarize
}) {
    if (!conversation) return null;

    return (
        <div className="border-b border-indigo-500/10 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex-shrink-0 z-10 block transition-all">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {conversation.type === 'GROUP' && (
                        <span className="inline-flex items-center rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/20 shadow-sm">
                            GROUP
                        </span>
                    )}
                    <div className="flex flex-col">
                        <h3 className="m-0 text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                            {conversation.type === 'AI_ASSISTANT' && <span className="text-xl pt-1">🤖</span>}
                            {title}
                        </h3>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* AI Summary Button */}
                    {conversation.type !== 'AI_ASSISTANT' && (
                        <button
                            onClick={onSummarize}
                            className="group relative px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-all border border-indigo-500/20 hover:border-indigo-500/40"
                            title="Summarize Conversation"
                        >
                            <span className="text-sm font-medium flex items-center gap-1.5">
                                ✨ <span className="hidden sm:inline">Insights</span>
                            </span>
                        </button>
                    )}

                    {conversation.type !== 'AI_ASSISTANT' && conversation.participants && (
                        <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block"></div>
                    )}

                    {conversation.type !== 'AI_ASSISTANT' && conversation.participants && (
                        <div className="text-xs font-medium text-slate-400 hidden sm:block">
                            {conversation.participants.length} {conversation.participants.length === 1 ? 'member' : 'members'}
                        </div>
                    )}
                    {conversation.type === 'GROUP' && (
                        <button
                            onClick={() => onManageGroup(conversation.id)}
                            className="px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 rounded transition"
                            title="Group Settings"
                        >
                            ⚙️
                        </button>
                    )}
                    {conversation.type === 'DIRECT' && conversation.participants && (
                        <>
                            <CallButton
                                onVideoCall={onVideoCall}
                                onAudioCall={onAudioCall}
                                disabled={callStatus !== 'idle'}
                            />
                            <button
                                onClick={() => {
                                    const other = conversation.participants.find(p => p !== user?.id);
                                    if (other) onViewProfile(other);
                                }}
                                className="px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 rounded transition"
                                title="View Profile"
                            >
                                👤
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
