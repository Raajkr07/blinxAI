import { useEffect, useRef, useState } from 'react';
import { getUserInfo } from '../../api/userApi';
import { deleteMessage } from '../../api/chatApi';
import ConfirmDialog from '../common/ConfirmDialog';
import { useUIStore } from '../../store/uiStore';

export default function ChatWindow({
  messages,
  currentUserId,
  loading = false,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  token,
  onMessageDeleted,
}) {
  const { showToast } = useUIStore();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const messagesStartRef = useRef(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [senderNames, setSenderNames] = useState(new Map());
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { messageId, isOwn }

  // ... (rest of code)



  // Load sender names
  useEffect(() => {
    if (!token || messages.length === 0) return;

    const loadSenderNames = async () => {
      const nameMap = new Map();
      // Set default name for AI assistant
      nameMap.set('ai-assistant', 'AI Assistant');

      for (const msg of messages) {
        if (msg.senderId && msg.senderId !== currentUserId && !nameMap.has(msg.senderId)) {
          // Skip fetching user info for ai-assistant (it's not a real user)
          if (msg.senderId === 'ai-assistant') {
            continue;
          }
          try {
            const userInfo = await getUserInfo(token, msg.senderId);
            if (userInfo) {
              nameMap.set(msg.senderId, userInfo.username || msg.senderId);
            }
          } catch {
            // Ignore errors
          }
        }
      }
      setSenderNames(nameMap);
    };

    loadSenderNames();
  }, [messages, token, currentUserId]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (shouldScrollToBottom && messages.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages, shouldScrollToBottom]);

  // Handle scroll to detect when user scrolls up
  const handleScroll = (e) => {
    const { scrollTop } = e.target;
    // If scrolled near top and has more messages, load more
    if (scrollTop < 100 && hasMore && onLoadMore && !loadingMore) {
      setShouldScrollToBottom(false);
      onLoadMore();
    }
    // If scrolled to bottom, enable auto-scroll
    const { scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setShouldScrollToBottom(true);
    }
  };

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
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

  const formatDateSeparator = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (messageDate.getTime() === today.getTime()) {
        return 'Today';
      } else if (messageDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
      }
    } catch {
      return '';
    }
  };

  const shouldShowDateSeparator = (currentMsg, previousMsg) => {
    if (!previousMsg || !currentMsg?.createdAt) return true;
    if (!previousMsg.createdAt) return true;

    const currentDate = new Date(currentMsg.createdAt);
    const previousDate = new Date(previousMsg.createdAt);

    // Show separator if different days
    return (
      currentDate.getDate() !== previousDate.getDate() ||
      currentDate.getMonth() !== previousDate.getMonth() ||
      currentDate.getFullYear() !== previousDate.getFullYear()
    );
  };

  const handleDeleteClick = (messageId, isOwn) => {
    setDeleteConfirm({ messageId, isOwn });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteMessage(token, deleteConfirm.messageId);
      if (onMessageDeleted) {
        onMessageDeleted(deleteConfirm.messageId);
      }
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      showToast(error.message || 'Failed to delete message', 'error');
      setDeleteConfirm(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  // Initial loading state only (no messages yet)
  if (loading && (!messages || messages.length === 0)) {
    return (
      <div className="w-full h-full flex flex-col bg-transparent items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-base font-medium text-slate-400 animate-pulse">
            Loading messages...
          </p>
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-transparent items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="mb-4 text-5xl opacity-80">💬</div>
          <p className="text-lg font-semibold text-white mb-1">
            No messages yet
          </p>
          <span className="text-sm text-slate-500">
            Start the conversation!
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full bg-transparent flex flex-col overflow-hidden"
      ref={containerRef}
    >
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3 custom-scrollbar"
        onScroll={handleScroll}
        style={{ minHeight: 0, maxHeight: '100%' }}
      >
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="px-4 py-1.5 rounded-full bg-black/20 text-xs font-medium text-slate-400 hover:text-white hover:bg-black/40 transition disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}
        <div ref={messagesStartRef} />
        {messages.map((m, index) => {
          const isOwn = m.senderId === currentUserId;
          const showAvatar =
            index === 0 || messages[index - 1]?.senderId !== m.senderId;
          const previousMsg = index > 0 ? messages[index - 1] : null;
          const showDateSeparator = shouldShowDateSeparator(m, previousMsg);

          return (
            <div key={m.id || index} className="flex flex-col gap-2">
              {showDateSeparator && (
                <div className="flex items-center justify-center py-6">
                  <div className="px-4 py-1.5 rounded-full bg-slate-800/80 backdrop-blur-sm border border-white/5 text-[11px] font-bold text-slate-400 uppercase tracking-wider shadow-sm select-none">
                    {formatDateSeparator(m.createdAt)}
                  </div>
                </div>
              )}

              <div
                className={
                  isOwn
                    ? 'flex items-end gap-3 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] self-end justify-end group animate-[messageSlideIn_0.2s_ease-out]'
                    : 'flex items-end gap-3 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] self-start justify-start group animate-[messageSlideIn_0.2s_ease-out]'
                }
              >
                {/* Receiver Avatar (Left) */}
                {!isOwn && (
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    {/* Show avatar only for the last message of a sequence from the same user, or if checking strict strict ordering */}
                    {showAvatar ? (
                      <div className="w-8 h-8 md:w-10 md:h-10">
                        {m.senderAvatarUrl ? (
                          <img
                            src={m.senderAvatarUrl}
                            alt={m.senderName || 'User'}
                            className="h-full w-full rounded-2xl object-cover border-2 border-slate-700 shadow-md hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="h-full w-full rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600 text-white flex items-center justify-center text-xs md:text-sm font-bold border-2 border-slate-700 shadow-md">
                            {getInitials(m.senderName || m.senderUsername || m.username || senderNames.get(m.senderId) || 'U')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-8 md:w-10" />
                    )}
                  </div>
                )}

                {/* Message Content Wrapper */}
                <div
                  className={
                    isOwn
                      ? 'flex flex-col gap-1 items-end min-w-0'
                      : 'flex flex-col gap-1 items-start min-w-0'
                  }
                >
                  {/* Sender Name (Only for received messages in groups usually, but here generally for clarity if changed) */}
                  {!isOwn && showAvatar && (
                    <div className="text-[11px] font-bold text-slate-400 px-1 select-none">
                      {m.senderName || m.senderUsername || m.username || senderNames.get(m.senderId) || m.senderId || 'User'}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={
                      isOwn
                        ? 'relative rounded-[20px] rounded-tr-[4px] bg-gradient-to-br from-indigo-600 to-indigo-700 text-white px-5 py-3 shadow-md shadow-indigo-900/20 transition-all hover:brightness-110'
                        : 'relative rounded-[20px] rounded-tl-[4px] bg-slate-800/90 text-white px-5 py-3 shadow-md border border-slate-700/50 transition-all hover:bg-slate-800'
                    }
                  >
                    {!m.deleted ? (
                      <p className="m-0 text-[0.95rem] md:text-[1rem] leading-relaxed whitespace-pre-wrap break-words">
                        {m.body || m.content || m.text || m.message || '(empty message)'}
                      </p>
                    ) : (
                      <p className="m-0 text-[0.9rem] leading-relaxed italic opacity-60 flex items-center gap-1.5">
                        <span className="text-xs">🚫</span> This message was deleted
                      </p>
                    )}

                    {/* Timestamp & Meta */}
                    <div className={`mt-1 flex items-center gap-1.5 select-none opacity-70 ${isOwn ? 'justify-end text-indigo-100/80' : 'justify-start text-slate-400'}`}>
                      <span className="text-[10px] font-medium tracking-wide">
                        {formatTime(m.createdAt)}
                      </span>
                    </div>

                    {/* Action Buttons (Delete) */}
                    {!m.deleted && (
                      <button
                        onClick={() => handleDeleteClick(m.id, isOwn)}
                        className={`absolute top-2 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-full hover:bg-black/20 text-white/50 hover:text-white transform scale-90 hover:scale-100 ${isOwn ? '-left-8' : '-right-8'}`}
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sender Avatar (Right - for Own Messages) */}
                {isOwn && (
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    {showAvatar ? (
                      <div className="w-8 h-8 md:w-10 md:h-10">
                        {m.senderAvatarUrl ? (
                          <img
                            src={m.senderAvatarUrl}
                            alt="You"
                            className="h-full w-full rounded-2xl object-cover border-2 border-indigo-500/50 shadow-md"
                          />
                        ) : (
                          <div className="h-full w-full rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center text-xs md:text-sm font-bold border-2 border-indigo-500/50 shadow-md">
                            {getInitials(m.senderName || 'You')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-8 md:w-10" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Message"
        message={deleteConfirm?.isOwn
          ? "Are you sure you want to delete this message?"
          : "Are you sure you want to delete this message for everyone?"}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
