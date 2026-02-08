import { useState, useRef, useEffect } from 'react';

export default function ConversationItem({
  conversation,
  isActive,
  isOnline,
  isGroup,
  conversationUserName,
  currentUserId,
  formatTime,
  getInitials,
  onSelect,
  onDelete,
  onLeave,
  onViewProfile,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (!conversation || !conversation.id) return;

    if (window.confirm(isGroup ? 'Leave this group?' : 'Delete this conversation?')) {
      if (isGroup && onLeave) {
        onLeave(conversation.id);
      } else if (onDelete) {
        onDelete(conversation.id);
      }
    }
    setShowMenu(false);
  };

  const handleViewProfile = (e) => {
    e.stopPropagation();
    if (conversation && conversation.type === 'DIRECT' && conversation.participants) {
      const otherUserId = conversation.participants.find((p) => p !== currentUserId);
      if (otherUserId && onViewProfile) {
        onViewProfile(otherUserId);
      }
    }
    setShowMenu(false);
  };

  if (!conversation || !conversation.id) {
    return null;
  }

  return (
    <div
      onClick={() => onSelect(conversation.id)}
      style={{ zIndex: showMenu ? 40 : 'auto' }}
      className={
        isActive
          ? 'flex cursor-pointer items-center gap-3 border-l-[3px] border-indigo-500 bg-white/10 pl-3 pr-4 py-3.5 transition-all relative group shadow-md shadow-indigo-900/10'
          : 'flex cursor-pointer items-center gap-3 border-l-[3px] border-transparent pl-3 pr-4 py-3.5 hover:bg-white/5 transition-all relative group'
      }
    >
      <div className="size-11 shrink-0 relative">
        {conversation.avatarUrl || conversation.avatar || conversation.imageUrl ? (
          <img
            src={conversation.avatarUrl || conversation.avatar || conversation.imageUrl}
            alt={conversation.title || conversation.name || 'Chat'}
            className="h-full w-full rounded-full object-cover border-2 border-indigo-500/10 ring-1 ring-white/5"
          />
        ) : (
          <div className="h-full w-full rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-indigo-500/20 border-2 border-white/5">
            {getInitials(conversation.title || conversation.name || conversation.groupName || conversationUserName || 'C')}
          </div>
        )}
        {isOnline && (
          <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[#0f1729] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div
            className="truncate text-[0.95rem] font-semibold text-slate-100 flex-1 cursor-pointer group-hover:text-white transition-colors"
          >
            {conversation.title ||
              conversation.name ||
              conversation.groupName ||
              (conversation.type === 'DIRECT' && conversation.participants
                ? conversationUserName || conversation.participants.find((p) => p !== currentUserId) || 'Direct chat'
                : conversation.type === 'AI_ASSISTANT'
                  ? 'AI Assistant'
                  : 'Chat')}
          </div>
          <div className="flex items-center gap-1">
            {(conversation.lastMessageAt || conversation.lastMessageTime) && (
              <div className="shrink-0 text-[0.65rem] font-medium text-slate-500 group-hover:text-slate-400 uppercase tracking-wider">
                {formatTime(conversation.lastMessageAt || conversation.lastMessageTime)}
              </div>
            )}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all transform scale-90 group-hover:scale-100"
                title="More options"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 z-50 w-40 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl py-1.5 overflow-hidden animate-enter">
                  {conversation.type === 'DIRECT' && onViewProfile && (
                    <button
                      type="button"
                      onClick={handleViewProfile}
                      className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      View Profile
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full px-4 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    {isGroup ? 'Leave Group' : 'Delete Chat'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="truncate text-[0.8rem] leading-snug text-slate-400 group-hover:text-slate-300 flex items-center gap-1.5 transition-colors">
          {conversation.type === 'AI_ASSISTANT' && (
            <span className="inline-flex items-center rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-purple-300 border border-purple-500/20">
              AI
            </span>
          )}
          {isGroup && (
            <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-indigo-300 border border-indigo-500/20">
              GROUP
            </span>
          )}
          {conversation.type === 'DIRECT' && conversation.participants && (
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-emerald-300 border border-emerald-500/20">
              DIRECT
            </span>
          )}
          <span className="truncate opacity-90">
            {conversation.lastMessagePreview || (conversation.type === 'AI_ASSISTANT' ? 'Ask me anything...' : 'No messages yet')}
          </span>
        </div>
      </div>
    </div>
  );
}
