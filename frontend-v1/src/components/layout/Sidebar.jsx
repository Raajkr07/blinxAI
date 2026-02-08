import { useState } from 'react';
import ConversationList from '../chat/ConversationList';

export default function Sidebar({
  conversations,
  selectedId,
  onSelect,
  onNewChatClick,
  onSearchChange,
  searchResults = [],
  onSearchResultClick,
  onlineUserIds = [],
  conversationUserNames = new Map(),
  currentUserId,
  onViewProfile,
  onDeleteConversation,
  onLeaveGroup,
  width = 320, // Default width
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {/* Sidebar Toggle Button (when closed) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed left-0 top-1/2 z-50 -translate-y-1/2 rounded-r-xl bg-indigo-600 p-1.5 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all hover:bg-indigo-500 hover:pl-3 hover:shadow-[0_0_20px_rgba(99,102,241,0.7)]"
          aria-label="Open sidebar"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Sidebar Container */}
      <div
        style={{ width: isOpen ? width : 0, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
        className="relative flex-shrink-0 h-full bg-slate-900/50 border-r border-white/5 overflow-visible group"
      >
        <div className="absolute inset-0 overflow-hidden w-full h-full">
          {/* Close Button - appearing on hover in the middle right */}
          <div className={`absolute -right-3 top-1/2 -translate-y-1/2 z-50 transition-opacity duration-200 ${isOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-800 text-slate-400 shadow-md border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={onSelect}
            onNewChatClick={onNewChatClick}
            onSearchChange={onSearchChange}
            searchResults={searchResults}
            onSearchResultClick={onSearchResultClick}
            onlineUserIds={onlineUserIds}
            conversationUserNames={conversationUserNames}
            currentUserId={currentUserId}
            onViewProfile={onViewProfile}
            onDeleteConversation={onDeleteConversation}
            onLeaveGroup={onLeaveGroup}
          />
        </div>
      </div>
    </>
  );
}
