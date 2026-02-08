import React from 'react';
import ChatTab from './ChatTab';

export default function ChatTabBar({
    openTabs,
    conversations,
    activeTab,
    onSelectTab,
    onCloseTab,
    getConversationTitle
}) {
    if (!openTabs || openTabs.length === 0) return null;

    return (
        <div className="flex items-center h-12 border-b border-indigo-500/10 bg-slate-900/50 backdrop-blur-md overflow-x-auto flex-shrink-0 z-10 transition-all custom-scrollbar">
            {openTabs.map(tabId => {
                const c = conversations.find(x => x.id === tabId);
                if (!c) return null;
                return (
                    <ChatTab
                        key={tabId}
                        conversation={c}
                        isActive={tabId === activeTab}
                        onSelect={onSelectTab}
                        onClose={onCloseTab}
                        getConversationTitle={getConversationTitle}
                        getInitials={(name) => (name || '?').slice(0, 2).toUpperCase()}
                    />
                );
            })}
        </div>
    );
}
