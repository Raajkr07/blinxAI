import ConversationItem from './ConversationItem';

export default function ConversationList({
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
}) {
  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isOnline = (conversation) => {
    const candidateIds = [
      conversation.otherUserId,
      conversation.participantId,
      conversation.userId,
    ].filter(Boolean);

    if (candidateIds.length === 0) return false;
    return candidateIds.some((id) => onlineUserIds.includes(id));
  };

  const isGroup = (conversation) => {
    return (
      conversation.type === 'GROUP' ||
      conversation.group === true ||
      conversation.isGroup === true
    );
  };

  // Deduplicate conversations to prevent key warnings and filter invalid ones
  const uniqueConversations = Array.from(
    new Map((conversations || []).filter(c => c && c.id).map(c => [c.id, c])).values()
  );

  if (!uniqueConversations || uniqueConversations.length === 0) {
    return (
      <div className="w-80 min-w-70 max-w-[320px] border-r border-indigo-500/10 flex flex-col glass backdrop-blur-xl h-full">
        <div className="border-b border-indigo-500/10 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-xl font-bold text-white tracking-tight">
              Messages
            </h2>
            {onNewChatClick && (
              <button
                type="button"
                onClick={onNewChatClick}
                className="size-8 rounded-full bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center font-bold"
              >
                +
              </button>
            )}
          </div>

          {onSearchChange && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl border border-indigo-500/20 bg-slate-900/50 pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-8 text-center bg-slate-900/20">
          <div className="mb-4 text-5xl opacity-80 scale-110">💬</div>
          <p className="text-lg font-medium text-slate-300 mb-1">
            No chats yet
          </p>
          <span className="text-sm text-slate-500 mb-6 block">
            Start a new conversation to connect.
          </span>
          {onNewChatClick && (
            <button
              type="button"
              onClick={onNewChatClick}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 hover:-translate-y-0.5 transition-all"
            >
              Start Chatting
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 min-w-70 max-w-[320px] border-r border-indigo-500/10 flex flex-col glass backdrop-blur-xl h-full">
      <div className="px-5 py-4 border-b border-indigo-500/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Messages
            <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-indigo-500/20 text-[0.65rem] font-bold text-indigo-300 px-1.5">
              {uniqueConversations.length}
            </span>
          </h2>
          {onNewChatClick && (
            <button
              type="button"
              onClick={onNewChatClick}
              className="size-8 rounded-full bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500 hover:text-white transition flex items-center justify-center font-bold"
            >
              +
            </button>
          )}
        </div>

        {onSearchChange && (
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-xl border border-indigo-500/10 bg-slate-900/40 pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-900/60 shadow-inner transition-all"
            />
          </div>
        )}

        {searchResults && searchResults.length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-xl border border-indigo-500/20 bg-slate-900/90 shadow-2xl animate-enter">
            {searchResults.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onSearchResultClick && onSearchResultClick(u)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition border-b border-white/5 last:border-0"
              >
                <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-indigo-500/20">
                  {getInitials(u.displayName || u.username || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold text-slate-200">
                    {u.displayName || u.username}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {u.maskedPhone || u.username}
                  </div>
                </div>
                {u.online && (
                  <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {uniqueConversations.map((c, index) => {
          const otherUserId = c.type === 'DIRECT' && c.participants
            ? c.participants.find((p) => p !== currentUserId)
            : null;

          return (
            <ConversationItem
              key={c.id || `temp-conv-${index}`}
              conversation={c}
              isActive={c.id === selectedId}
              isOnline={isOnline(c)}
              isGroup={isGroup(c)}
              conversationUserName={otherUserId ? conversationUserNames.get(otherUserId) : null}
              currentUserId={currentUserId}
              formatTime={formatTime}
              getInitials={getInitials}
              onSelect={onSelect}
              onDelete={onDeleteConversation}
              onLeave={onLeaveGroup}
              onViewProfile={onViewProfile}
            />
          );
        })}
      </div>
    </div>
  );
}
