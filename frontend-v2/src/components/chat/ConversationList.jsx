import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { chatService, userService, aiService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore, useTabsStore, useAuthStore, useUIStore } from '../../stores';
import { Avatar, Skeleton, SkeletonAvatar, SkeletonConversation, EmptyState, NoConversationsIcon, NoSearchResultsIcon } from '../ui';
import { cn, formatRelativeTime, truncate } from '../../lib/utils';

export function ConversationList() {
    const { activeConversationId, setActiveConversation, searchQuery, setSearchQuery, clearSearch } = useChatStore();
    const { openTab, getTabByConversationId, activeTabId, tabs } = useTabsStore();
    const { user: currentUser } = useAuthStore();
    const { isSidebarCollapsed } = useUIStore();
    const queryClient = useQueryClient();

    // Local search input + debounce
    const [localSearch, setLocalSearch] = useState('');
    const searchInputRef = useRef(null);
    const debounceRef = useRef(null);

    const handleSearchChange = useCallback((e) => {
        const value = e.target.value;
        setLocalSearch(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchQuery(value.trim());
        }, 300);
    }, [setSearchQuery]);

    const handleClearSearch = useCallback(() => {
        setLocalSearch('');
        clearSearch();
        searchInputRef.current?.focus();
    }, [clearSearch]);

    // AI-enhanced search parsing — fires when search query is a natural language query
    const isNaturalLanguageQuery = searchQuery.length > 3 && /\s/.test(searchQuery);
    const { data: aiSearchCriteria } = useQuery({
        queryKey: ['aiSearchParse', searchQuery],
        queryFn: () => aiService.parseSearchQuery(searchQuery),
        enabled: isNaturalLanguageQuery,
        staleTime: 60000,
        retry: false,
    });

    const { data: conversations, isLoading, error } = useQuery({
        queryKey: queryKeys.conversations,
        queryFn: chatService.listConversations,
    });

    const conversationsArray = Array.isArray(conversations)
        ? conversations
        : (conversations?.conversations || conversations?.content || conversations?.data || []);

    const normalizedConversations = conversationsArray
        .map(c => ({
            ...c,
            lastMessageAt: c.lastMessageAt && !c.lastMessageAt.endsWith('Z')
                ? `${c.lastMessageAt}Z`
                : c.lastMessageAt
        }))
        .filter(c =>
            c.type?.toUpperCase() !== 'AI_ASSISTANT'
        );

    // Collect all participant IDs that need user profiles (for DIRECT chats without title)
    const userIdsToFetch = useMemo(() => {
        if (!currentUser || !normalizedConversations.length) return [];
        const ids = new Set();
        for (const conv of normalizedConversations) {
            const isGroup = conv.type === 'GROUP' || conv.type === 'COMMUNITY';
            if (isGroup || conv.title) continue;
            const otherParticipant = conv.participants?.find(p => {
                const id = typeof p === 'string' ? p : p.id;
                return id !== currentUser.id;
            });
            const otherId = typeof otherParticipant === 'string' ? otherParticipant : otherParticipant?.id;
            if (otherId) ids.add(otherId);
        }
        return [...ids];
    }, [normalizedConversations, currentUser]);

    // Single batch fetch for all user profiles needed by direct chats
    const { data: batchUsers, isLoading: isBatchLoading } = useQuery({
        queryKey: ['users-batch', ...userIdsToFetch],
        queryFn: () => userService.getUsersBatch(userIdsToFetch),
        enabled: userIdsToFetch.length > 0,
        staleTime: 1000 * 60 * 5,
    });

    // Pre-seed individual user query caches so ConversationItem doesn't refetch
    useEffect(() => {
        if (batchUsers && Array.isArray(batchUsers)) {
            for (const user of batchUsers) {
                if (user?.id) {
                    queryClient.setQueryData(['user', user.id], user);
                }
            }
        }
    }, [batchUsers, queryClient]);

    // Build a lookup map for quick access
    const userMap = useMemo(() => {
        const map = {};
        if (batchUsers && Array.isArray(batchUsers)) {
            for (const user of batchUsers) {
                if (user?.id) map[user.id] = user;
            }
        }
        return map;
    }, [batchUsers]);

    // Apply search filtering
    const filteredConversations = useMemo(() => {
        if (!searchQuery) return normalizedConversations;

        const lowerQuery = searchQuery.toLowerCase();

        return normalizedConversations.filter(conv => {
            // Basic title match
            const title = (conv.title || '').toLowerCase();
            if (title.includes(lowerQuery)) return true;

            // Match against participant names from userMap
            if (conv.participants && currentUser) {
                for (const p of conv.participants) {
                    const id = typeof p === 'string' ? p : p.id;
                    if (id === currentUser.id) continue;
                    const user = userMap[id];
                    if (user) {
                        const name = (user.username || user.name || '').toLowerCase();
                        if (name.includes(lowerQuery)) return true;
                    }
                }
            }

            // AI-parsed criteria matching (if available and includes keywords)
            if (aiSearchCriteria) {
                const keywords = aiSearchCriteria.keywords || [];
                for (const kw of keywords) {
                    if (title.includes(kw.toLowerCase())) return true;
                }
                // Match by type if AI detected it
                if (aiSearchCriteria.type && conv.type?.toLowerCase() === aiSearchCriteria.type.toLowerCase()) {
                    return true;
                }
            }

            // Last message preview match
            const preview = (conv.lastMessagePreview || '').toLowerCase();
            if (preview.includes(lowerQuery)) return true;

            return false;
        });
    }, [normalizedConversations, searchQuery, userMap, currentUser, aiSearchCriteria]);

    const handleConversationClick = (conversation, event) => {
        if (event.defaultPrevented) return;
        openTab(conversation);
        setActiveConversation(conversation.id);
    };

    // Show skeletons while conversations OR batch users are loading
    if (isLoading || (userIdsToFetch.length > 0 && isBatchLoading)) {
        return (
            <div className="space-y-1">
                {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonConversation key={i} />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                icon={<NoConversationsIcon />}
                title="Failed to load conversations"
                description="Please try again later"
            />
        );
    }

    if (!conversationsArray || conversationsArray.length === 0) {
        return (
            <EmptyState
                icon={<NoConversationsIcon />}
                title="No conversations yet"
                description="Start a new chat to begin messaging"
            />
        );
    }

    return (
        <>
            {/* Search Bar */}
            {!isSidebarCollapsed && (
                <div className="px-4 py-2 border-b border-[var(--color-border)]">
                    <div className="relative">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 15 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-500)]"
                        >
                            <path
                                d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.5624 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.5624 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                            />
                        </svg>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={localSearch}
                            onChange={handleSearchChange}
                            placeholder="Search conversations..."
                            className={cn(
                                "w-full h-9 pl-9 pr-8 rounded-xl text-xs",
                                "bg-[var(--color-border)] border border-transparent",
                                "text-[var(--color-foreground)] placeholder:text-[var(--color-gray-500)]",
                                "focus:outline-none focus:border-blue-500/40 focus:bg-transparent",
                                "transition-all duration-200"
                            )}
                        />
                        {localSearch && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors text-[var(--color-gray-500)] hover:text-[var(--color-foreground)]"
                            >
                                <svg width="10" height="10" viewBox="0 0 15 15" fill="none">
                                    <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {/* AI search indicator */}
                    {isNaturalLanguageQuery && aiSearchCriteria && (
                        <div className="flex items-center gap-1.5 mt-1.5 px-1">
                            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400/70">
                                AI-enhanced search
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Conversation List */}
            <div className="space-y-1">
                {filteredConversations.length === 0 && searchQuery ? (
                    <EmptyState
                        icon={<NoSearchResultsIcon />}
                        title="No results found"
                        description={`No conversations matching "${searchQuery}"`}
                    />
                ) : (
                    filteredConversations.map((conversation) => {
                        const activeTab = tabs?.find(t => t.id === activeTabId);
                        const highlightId = activeTab?.conversationId || activeConversationId;
                        const hasTab = getTabByConversationId(conversation.id);
                        return (
                            <ConversationItem
                                key={conversation.id}
                                conversation={conversation}
                                currentUser={currentUser}
                                userMap={userMap}
                                isActive={highlightId === conversation.id}
                                hasTab={!!hasTab}
                                onClick={(e) => handleConversationClick(conversation, e)}
                            />
                        );
                    })
                )}
            </div>
        </>
    );
}

function ConversationItem({ conversation, currentUser, userMap, isActive, hasTab, onClick }) {
    const isGroup = conversation.type === 'GROUP' || conversation.type === 'COMMUNITY';
    const isAI = conversation.type === 'AI_ASSISTANT';

    let displayTitle = conversation.title;
    let displayAvatar = conversation.avatarUrl;

    if (!isGroup && !isAI && currentUser) {
        const otherParticipant = conversation.participants?.find(p => {
            const id = typeof p === 'string' ? p : p.id;
            return id !== currentUser.id;
        });

        const otherId = typeof otherParticipant === 'string' ? otherParticipant : otherParticipant?.id;

        // Use batch-fetched user data from the map (already loaded)
        if (otherId && userMap[otherId]) {
            const otherUser = userMap[otherId];
            displayTitle = displayTitle || otherUser.username || otherUser.name;
            displayAvatar = displayAvatar || otherUser.avatarUrl;
        }

        // Also check inline participant objects
        if (otherParticipant && typeof otherParticipant === 'object') {
            displayTitle = displayTitle || otherParticipant.username || otherParticipant.name;
            displayAvatar = displayAvatar || otherParticipant.avatarUrl;
        }
    }

    displayTitle = displayTitle || 'Chat';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick(e);
                }
            }}
            className={cn(
                'group w-full px-4 py-3 flex items-center gap-3 cursor-pointer outline-none focus-visible:bg-[var(--color-border)]',
                'hover:bg-[var(--color-border)] transition-colors',
                'border-b border-[var(--color-border)]',
                'text-left relative',
                isActive && 'bg-[var(--color-border)] border-l-2 border-l-[var(--color-foreground)]'
            )}
            title="Click to open, Ctrl+Click to open in new tab"
        >
            {hasTab && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" />
            )}

            <Avatar
                src={displayAvatar}
                name={displayTitle}
                size="lg"
                online={false}
            />

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-[var(--color-foreground)] truncate pr-6">
                        {displayTitle}
                    </h3>
                    {conversation.lastMessageAt && (
                        <span className="text-xs text-[var(--color-gray-500)] flex-shrink-0 ml-2 group-hover:hidden">
                            {formatRelativeTime(conversation.lastMessageAt)}
                        </span>
                    )}
                </div>
                {conversation.lastMessagePreview && (
                    <p className="text-sm text-[var(--color-gray-400)] truncate pr-6">
                        {truncate(conversation.lastMessagePreview, 60)}
                    </p>
                )}
            </div>
        </div>
    );
}
