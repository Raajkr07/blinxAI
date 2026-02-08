import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import {
  fetchConversations,
  fetchMessages,
  createDirectConversation,
  sendMessageRest,
  fetchGroups,
  joinGroup,
  deleteConversation,
  leaveGroup,
} from '../api/chatApi';
import { getAiConversation, chatWithAi, summarizeConversation } from '../api/aiApi';
import { searchUsers, fetchOnlineUserIds, getUserInfo, getUserProfile } from '../api/userApi';

// Layout Components
import Sidebar from '../components/layout/Sidebar';
import ChatTabBar from '../components/chat/ChatTabBar';
import ChatHeader from '../components/chat/ChatHeader';
import ChatWindow from '../components/chat/ChatWindow';
import MessageInput from '../components/chat/MessageInput';
import TypingIndicator from '../components/chat/TypingIndicator';
import EmptyState from '../components/chat/EmptyState';
import AutoReplyChips from '../components/chat/AutoReplyChips';
import VideoCallWindow from '../components/video/VideoCallWindow';

// Modal Container
import ChatModals from '../components/chat/modals/ChatModals';

// Hooks
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useVideoCall } from '../hooks/useVideoCall';

export default function ChatPage() {
  const { token, user } = useAuthStore();
  const {
    conversations, setConversations, addConversation, updateConversation,
    messages: messagesMap, setMessages, addMessage,
    activeTab, openTabs, setActiveTab, closeTab,
    onlineUserIds, setOnlineUserIds,
    connected, setConnected,
    typingUsers, setTypingUser,
    loadingMessages, setLoadingMessages,
    loadingConversations, setLoadingConversations,
    selectedConversation
  } = useChatStore();

  const { openModal, closeModal, showToast } = useUIStore();

  // Local UI State
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [tabPagination, setTabPagination] = useState(new Map());

  // Sidebar Resizing State
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  // AI Summary State (Data Only)
  const [summaryData, setSummaryData] = useState(null);

  // Helper for resolved user names
  const [conversationUserNames, setConversationUserNames] = useState(new Map());

  // Input Ref
  const messageInputRef = useRef(null);

  // Video call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [callerInfo, setCallerInfo] = useState(null);

  // Computed state
  const currentMessages = activeTab ? (messagesMap.get(activeTab) || []) : [];
  const activePagination = activeTab ? tabPagination.get(activeTab) : null;
  const showHasMore = activePagination ? activePagination.hasMore : false;

  // Last message from someone else (for auto-replies)
  const lastReceivedMessage = currentMessages.length > 0
    ? [...currentMessages].reverse().find(m => m.senderId !== user?.id && !m.deleted)
    : null;

  // --- Resizing Logic ---
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((mouseMoveEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth > 240 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Load user names for direct chats
  useEffect(() => {
    if (!token || conversations.length === 0) return;
    const loadNames = async () => {
      const nameMap = new Map();
      for (const conv of conversations) {
        if (conv.type === 'DIRECT' && conv.participants) {
          const otherId = conv.participants.find(p => p !== user?.id);
          if (otherId && !nameMap.has(otherId)) {
            try {
              const info = await getUserInfo(token, otherId);
              if (info) nameMap.set(otherId, info.username || otherId);
            } catch { /* ignore */ }
          }
        }
      }
      setConversationUserNames(nameMap);
    };
    loadNames();
  }, [conversations, token, user?.id]);

  // Initial Data Load
  useEffect(() => {
    if (!token) return;
    setLoadingConversations(true);

    // Load conversations and ensure AI chat exists
    (async () => {
      try {
        const convs = await fetchConversations(token);
        try {
          const aiConv = await getAiConversation(token);
          if (aiConv?.id) {
            const idx = convs.findIndex(c => c.id === aiConv.id);
            if (idx === -1) convs.unshift(aiConv);
            else convs[idx] = aiConv;
          }
        } catch { /* ignore AI error */ }

        setConversations(convs);
      } catch (e) {
        console.error('Fetch error:', e);
        setError('Failed to load conversations.');
      } finally {
        setLoadingConversations(false);
      }
    })();

    // Load available groups
    fetchGroups(token).then(setGroups).catch(() => { });
  }, [token, setConversations, setLoadingConversations]);

  // Presence Polling
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try { setOnlineUserIds(await fetchOnlineUserIds(token)); } catch { }
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [token, setOnlineUserIds]);

  // Messages Loading for Active Tab
  useEffect(() => {
    if (!token || !activeTab) return;

    // Check if we already have messages to prevent "buffering" feeling
    if (messagesMap.has(activeTab)) return;

    setLoadingMessages(true);
    (async () => {
      try {
        const page = await fetchMessages(token, activeTab, 0, 30);
        const sorted = (page.content || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(activeTab, sorted);
        setTabPagination(prev => new Map(prev).set(activeTab, {
          page: 0,
          hasMore: page.totalElements > sorted.length
        }));
      } catch (e) {
        console.error(e);
        setError('Failed to load messages.');
      } finally {
        setLoadingMessages(false);
      }
    })();
  }, [token, activeTab, setMessages, setLoadingMessages]);

  // --- Handlers ---

  const getConversationTitle = (conv) => {
    if (!conv) return 'Chat';
    if (conv.type === 'AI_ASSISTANT') return 'AI Assistant';
    if (conv.title) return conv.title;
    if (conv.type === 'DIRECT' && conv.participants) {
      const other = conv.participants.find(p => p !== user?.id);
      if (other) return conversationUserNames.get(other) || other;
    }
    return 'Chat';
  };

  const handleLoadMore = async () => {
    if (!token || !activeTab || loadingMoreMessages) return;
    const pagination = tabPagination.get(activeTab);
    if (!pagination?.hasMore) return;

    setLoadingMoreMessages(true);
    try {
      const nextPage = pagination.page + 1;
      const page = await fetchMessages(token, activeTab, nextPage, 30);
      const sorted = (page.content || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const current = messagesMap.get(activeTab) || [];
      // Merge and deduplicate
      const merged = [...sorted, ...current];
      const unique = merged.filter((m, idx, arr) => arr.findIndex(x => x.id === m.id) === idx);

      setMessages(activeTab, unique.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      setTabPagination(prev => new Map(prev).set(activeTab, {
        page: nextPage,
        hasMore: page.totalElements > unique.length
      }));
    } catch (e) { console.error(e); }
    finally { setLoadingMoreMessages(false); }
  };

  const handleSummarize = async () => {
    if (!activeTab || !token) return;
    try {
      const summary = await summarizeConversation(token, activeTab);
      setSummaryData(summary);
      openModal('summary');
    } catch {
      showToast('Failed to generate summary', 'error');
    }
  };

  const handleAutoReplySelect = (text) => {
    if (messageInputRef.current) {
      messageInputRef.current.setText(text);
    }
  };

  // Video Call Hook
  const {
    localVideoRef, remoteVideoRef, isMuted, isVideoEnabled,
    currentCall, callStatus, initiateCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleVideo
  } = useVideoCall({
    token,
    userId: user?.id,
    onIncomingCall: async (notif) => {
      setIncomingCall(notif);
      try {
        setCallerInfo(await getUserProfile(token, notif.callerId));
      } catch { setCallerInfo({ username: 'Unknown' }); }
    },
    onCallEnded: () => {
      setIncomingCall(null);
      setCallerInfo(null);
    }
  });

  // WebSocket Hook
  const { sendMessage, sendTyping } = useChatWebSocket({
    token,
    userId: user?.id,
    conversationIds: conversations.map(c => c.id),
    onMessage: (msg) => {
      const convId = msg.conversationId || msg.convId;
      if (!convId) return;
      addMessage(msg);

      const existing = conversations.find(c => c.id === convId);
      if (existing) {
        updateConversation({
          ...existing,
          lastMessagePreview: msg.body || existing.lastMessagePreview,
          lastMessageAt: msg.createdAt || existing.lastMessageAt
        });
      }
    },
    onConversationCreated: (conv) => conv?.id && addConversation(conv),
    onPresence: (evt) => {
      const id = String(evt.userId);
      setOnlineUserIds(evt.online
        ? [...onlineUserIds.filter(uid => uid !== id), id]
        : onlineUserIds.filter(uid => uid !== id)
      );
    },
    onTyping: (evt) => {
      if (evt.conversationId && evt.userId) setTypingUser(evt.conversationId, evt.userId, evt.typing);
    },
    onConnectionChange: setConnected
  });

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    onSearch: () => document.querySelector('input[placeholder*="Search"]')?.focus(),
    onNewChat: () => openModal('newChat'),
    onEscape: () => closeModal()
  });

  const handleSend = async (text, convId = activeTab) => {
    if (!convId) return;

    const conv = conversations.find(c => c.id === convId);

    // AI Chat
    if (conv?.type === 'AI_ASSISTANT') {
      const tempMsg = { id: `temp-${Date.now()}`, conversationId: convId, senderId: user?.id, body: text, createdAt: new Date().toISOString(), seen: false };
      addMessage(tempMsg);

      try {
        const aiResponse = await chatWithAi(token, text);
        if (aiResponse) {
          addMessage(aiResponse);
        }

        // Refresh to ensure we have the latest server state (resolving temp IDs etc)
        const page = await fetchMessages(token, convId, 0, 50);
        setMessages(convId, (page.content || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      } catch { setError('Failed to chat with AI'); }
      return;
    }

    // Regular Chat
    if (connected && sendMessage(convId, text)) {
      return;
    }

    // Fallback REST
    try {
      const saved = await sendMessageRest(token, convId, text);
      addMessage(saved);
    } catch {
      setError('Failed to send message');
    }
  };

  // --- Render ---

  if (loadingConversations) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center bg-slate-950">
        <div className="mb-4 h-12 w-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-400 animate-pulse">Loading blink...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-1 relative overflow-hidden h-full ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {/* Search Sidebar - Resizable */}
      <Sidebar
        width={sidebarWidth}
        conversations={conversations}
        selectedId={activeTab}
        onSelect={setActiveTab}
        onNewChatClick={() => openModal('newChat')}
        onSearchChange={(v) => {
          if (v.trim()) searchUsers(token, v).then(setSearchResults).catch(() => { });
          else setSearchResults([]);
        }}
        searchResults={searchResults}
        onSearchResultClick={async (u) => {
          try {
            const conv = await createDirectConversation(token, u.id);
            if (!conversations.find(c => c.id === conv.id)) setConversations([conv, ...conversations]);
            setActiveTab(conv.id);
            setSearchResults([]);
          } catch (e) { setError(e.message); }
        }}
        onlineUserIds={onlineUserIds}
        conversationUserNames={conversationUserNames}
        currentUserId={user?.id}
        onViewProfile={(uid) => openModal('viewProfile', uid)}
        onDeleteConversation={async (id) => {
          await deleteConversation(token, id);
          setConversations(conversations.filter(c => c.id !== id));
          closeTab(id);
        }}
        onLeaveGroup={async (id) => {
          try {
            await leaveGroup(token, id);
            setConversations(await fetchConversations(token));
            closeTab(id);
          } catch (e) { setError(e.message); }
        }}
      />

      {/* Resize Handle */}
      <div
        className="w-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-50 flex-shrink-0"
        onMouseDown={startResizing}
      />

      {/* Main Chat Content */}
      <div className="flex flex-1 flex-col relative min-w-0 overflow-hidden h-full">
        {openTabs.length > 0 ? (
          <>
            <ChatTabBar
              openTabs={openTabs}
              conversations={conversations}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onCloseTab={closeTab}
              getConversationTitle={getConversationTitle}
            />

            {activeTab && selectedConversation && (
              <>
                <ChatHeader
                  conversation={selectedConversation}
                  title={getConversationTitle(selectedConversation)}
                  user={user}
                  onViewProfile={(uid) => openModal('viewProfile', uid)}
                  onManageGroup={(gid) => openModal('groupManagement', gid)}
                  onVideoCall={() => {
                    const other = selectedConversation.participants.find(p => p !== user?.id);
                    if (other) initiateCall(other, 'VIDEO', selectedConversation.id);
                  }}
                  onAudioCall={() => {
                    const other = selectedConversation.participants.find(p => p !== user?.id);
                    if (other) initiateCall(other, 'AUDIO', selectedConversation.id);
                  }}
                  callStatus={callStatus}
                  onSummarize={handleSummarize}
                />

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                  {/* Background Decor */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px]" />
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden relative z-10">
                    <ChatWindow
                      messages={currentMessages}
                      currentUserId={user?.id}
                      loading={loadingMessages && !showHasMore && currentMessages.length === 0}
                      onLoadMore={handleLoadMore}
                      hasMore={showHasMore}
                      loadingMore={loadingMoreMessages}
                      token={token}
                      onMessageDeleted={(id) => setMessages(activeTab, currentMessages.filter(m => m.id !== id))}
                    />
                  </div>

                  {activeTab && selectedConversation.type !== 'AI_ASSISTANT' && typingUsers.get(activeTab)?.size > 0 && (
                    <div className="flex-shrink-0 px-6 py-2 bg-slate-900/40 backdrop-blur-sm border-t border-white/5 z-20">
                      {Array.from(typingUsers.get(activeTab)).map(uid => (
                        <TypingIndicator key={uid} userName={conversationUserNames.get(uid) || uid} />
                      ))}
                    </div>
                  )}

                  <div className="flex-shrink-0 z-20 bg-[#0f172a]/80 backdrop-blur-lg border-t border-white/10 p-4">
                    {selectedConversation.type === 'DIRECT' && lastReceivedMessage && (
                      <AutoReplyChips
                        token={token}
                        lastMessage={lastReceivedMessage}
                        onSelectReply={handleAutoReplySelect}
                      />
                    )}

                    <MessageInput
                      ref={messageInputRef}
                      onSend={handleSend}
                      disabled={loadingMessages}
                      onTypingChange={(t) => {
                        if (activeTab && sendTyping && selectedConversation.type !== 'AI_ASSISTANT')
                          sendTyping(activeTab, t);
                      }}
                    />
                    {selectedConversation.type !== 'AI_ASSISTANT' && (
                      <div className="flex items-center justify-between gap-4 mt-3 px-1">
                        <div className="flex items-center gap-2">
                          <div className={connected ? 'h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)] animate-pulse' : 'h-1.5 w-1.5 rounded-full bg-red-500'} />
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{connected ? 'Live' : 'Offline'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
                          <span>{onlineUserIds.length > 0 ? `${onlineUserIds.length} online` : 'No online users'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <EmptyState
            onStartNewChat={() => openModal('newChat')}
            groups={groups}
            onJoinGroup={async (gid) => {
              try {
                const conv = await joinGroup(token, gid);
                if (!conversations.find(c => c.id === conv.id)) setConversations([conv, ...conversations]);
                setActiveTab(conv.id);
              } catch (e) { setError(e.message); }
            }}
          />
        )}
      </div>

      <ChatModals
        incomingCall={incomingCall}
        callerInfo={callerInfo}
        summaryData={summaryData}
        onAcceptCall={async () => {
          const callObj = { ...incomingCall, id: incomingCall.id || incomingCall.callId };
          try { await acceptCall(callObj); setIncomingCall(null); } catch { }
        }}
        onRejectCall={async () => {
          const callId = incomingCall.callId || incomingCall.id;
          try { await rejectCall(callId); setIncomingCall(null); setCallerInfo(null); } catch { }
        }}
      />

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center justify-between bg-red-500/90 backdrop-blur-md rounded-full shadow-lg px-6 py-2.5 text-sm text-white border border-red-400/50 animate-[slideDown_0.3s_ease-out]">
          <span className="flex items-center gap-2 font-medium"><span>⚠️</span><span>{error}</span></span>
          <button type="button" className="ml-4 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {(currentCall && callStatus !== 'idle') && (
        <VideoCallWindow
          localVideoRef={localVideoRef} remoteVideoRef={remoteVideoRef}
          isMuted={isMuted} isVideoEnabled={isVideoEnabled}
          callStatus={callStatus} currentCall={currentCall}
          onToggleMute={toggleMute} onToggleVideo={toggleVideo} onEndCall={endCall}
          callerName={currentCall.callerId === user?.id ? (conversationUserNames.get(currentCall.receiverId) || 'User') : (conversationUserNames.get(currentCall.callerId) || 'User')}
        />
      )}
    </div>
  );
}
