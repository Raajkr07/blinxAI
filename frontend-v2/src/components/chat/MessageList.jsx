import { useInfiniteQuery, useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { chatService, socketService, userService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore, useChatStore } from '../../stores';
import { Avatar, SkeletonMessage, EmptyState, NoMessagesIcon, AILogo } from '../ui';
import { cn, formatTime, stripMarkdown } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Date separator helper ───────────────────────────────────────────
function getDateLabel(dateString) {
    if (!dateString) return '';
    const raw = typeof dateString === 'string' && !dateString.endsWith('Z') && !dateString.includes('+')
        ? `${dateString}Z`
        : dateString;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const diffDays = Math.round((today - msgDay) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays === -1) return 'Tomorrow';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function getDateKey(dateString) {
    if (!dateString) return '';
    const raw = typeof dateString === 'string' && !dateString.endsWith('Z') && !dateString.includes('+')
        ? `${dateString}Z`
        : dateString;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ─── Date separator component ────────────────────────────────────────
const DateSeparator = memo(function DateSeparator({ label }) {
    return (
        <div className="flex items-center justify-center my-4 select-none pointer-events-none">
            <div className="flex items-center gap-3 w-full max-w-xs">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-[11px] font-medium tracking-wide uppercase text-[var(--color-gray-500)] bg-[var(--color-background)] px-3 py-1 rounded-full border border-[var(--color-border)] whitespace-nowrap">
                    {label}
                </span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>
        </div>
    );
});

// ─── Main component ──────────────────────────────────────────────────
export function MessageList({ conversationId }) {
    const { user } = useAuthStore();
    const { optimisticMessages, removeOptimisticMessage, addTypingUser, removeTypingUser, liveMessages, addLiveMessage } = useChatStore();
    const messagesEndRef = useRef(null);
    const topSentinelRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const prevScrollHeightRef = useRef(0);

    // Fetch conversations list
    const { data: conversationsData } = useQuery({
        queryKey: queryKeys.conversations,
        queryFn: chatService.listConversations,
    });

    // Fetch specific conversation details
    const { data: conversation } = useQuery({
        queryKey: queryKeys.conversation(conversationId),
        queryFn: () => chatService.getConversation(conversationId),
        enabled: !!conversationId,
    });

    const conversationsList = Array.isArray(conversationsData)
        ? conversationsData
        : (conversationsData?.conversations || conversationsData?.content || []);

    const currentConv = conversation || conversationsList.find(c => c && c.id?.toString() === conversationId?.toString());

    // Derive the partner's profile for 1-on-1 chats
    const isGroup = currentConv?.type === 'GROUP' || currentConv?.type === 'COMMUNITY';
    const isAI = currentConv?.type === 'AI_ASSISTANT';

    // Identity the other participant
    const otherParticipant = !isGroup && !isAI && user && currentConv?.participants
        ? currentConv.participants.find(p => {
            const pid = typeof p === 'string' ? p : (p.id || p._id);
            return pid?.toString() !== user.id?.toString();
        })
        : null;

    const otherUserId = (otherParticipant && typeof otherParticipant === 'object')
        ? (otherParticipant.id || otherParticipant._id)
        : otherParticipant;

    // Get the full profile if participants are just IDs
    const queryClient = useQueryClient();
    const { data: partnerProfile } = useQuery({
        queryKey: ['user', otherUserId],
        queryFn: () => userService.getUserById(otherUserId),
        enabled: !!otherUserId,
        staleTime: 1000 * 60 * 5,
        placeholderData: () => queryClient.getQueryData(['user', otherUserId]),
    });

    let partnerInfo = {
        avatar: currentConv?.avatarUrl,
        name: currentConv?.title
    };

    if (partnerProfile) {
        partnerInfo.avatar = partnerInfo.avatar || partnerProfile.avatarUrl;
        partnerInfo.name = partnerInfo.name || partnerProfile.username || partnerProfile.name;
    } else if (otherParticipant && typeof otherParticipant === 'object') {
        partnerInfo.avatar = partnerInfo.avatar || otherParticipant.avatarUrl;
        partnerInfo.name = partnerInfo.name || otherParticipant.username || otherParticipant.name;
    }

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error
    } = useInfiniteQuery({
        queryKey: queryKeys.messages(conversationId),
        queryFn: ({ pageParam = 0 }) => chatService.getMessages(conversationId, pageParam, 20),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const pageData = lastPage.content || lastPage;
            if (!pageData || pageData.length === 0 || lastPage.last) return undefined;
            return (lastPage.number || 0) + 1;
        },
        enabled: !!conversationId,
        refetchOnWindowFocus: false,
    });

    const optimisticMessagesRef = useRef(optimisticMessages);
    useEffect(() => {
        optimisticMessagesRef.current = optimisticMessages;
    }, [optimisticMessages]);

    // WebSocket subscription
    useEffect(() => {
        let subscription = null;
        let typingSubscription = null;
        let isMounted = true;

        const setupConnection = async () => {
            try {
                await socketService.connect();
                if (!isMounted) return;

                const topic = `/topic/conversations/${conversationId}`;
                subscription = socketService.subscribe(topic, (rawMessage) => {
                    if (!isMounted) return;

                    const message = {
                        ...rawMessage,
                        createdAt: rawMessage.createdAt && !rawMessage.createdAt.endsWith('Z')
                            ? `${rawMessage.createdAt}Z`
                            : rawMessage.createdAt
                    };

                    addLiveMessage(conversationId, message);

                    const currentOptimisticMessages = optimisticMessagesRef.current;
                    const optimisticEntries = Object.entries(currentOptimisticMessages);

                    const candidates = optimisticEntries.filter(([, optMsg]) => {
                        const contentMatch = optMsg.body?.trim() === message.body?.trim();
                        const senderMatch = optMsg.senderId === message.senderId ||
                            (optMsg.senderId === 'me' && message.senderId === user?.id) ||
                            (message.senderId === 'me' && optMsg.senderId === user?.id);
                        return optMsg.conversationId === conversationId && contentMatch && senderMatch;
                    });

                    if (candidates.length > 0) {
                        const msgTime = new Date(message.createdAt).getTime();
                        const bestMatch = candidates.reduce((best, current) => {
                            const [, currentMsg] = current;
                            const [, bestMsg] = best;
                            const currentDiff = Math.abs(new Date(currentMsg.createdAt).getTime() - msgTime);
                            const bestDiff = Math.abs(new Date(bestMsg.createdAt).getTime() - msgTime);
                            return currentDiff < bestDiff ? current : best;
                        });

                        const bestMsg = bestMatch[1];
                        const timeDiff = Math.abs(new Date(bestMsg.createdAt).getTime() - msgTime);
                        if (timeDiff < 300000) {
                            removeOptimisticMessage(bestMatch[0]);
                        }
                    }
                });

                if (user?.id) {
                    const typingTopic = `/topic/conversations/${conversationId}/typing`;
                    typingSubscription = socketService.subscribe(typingTopic, (payload) => {
                        if (!isMounted) return;
                        if (payload && payload.userId !== user.id) {
                            if (payload.typing === true) {
                                addTypingUser(conversationId, payload.userId);
                            } else {
                                removeTypingUser(conversationId, payload.userId);
                            }
                        }
                    });
                }
            } catch (err) {
                console.error('Failed to connect to WebSocket:', err);
                if (isMounted) {
                    toast.error('Real-time connection failed');
                }
            }
        };

        if (conversationId) {
            setupConnection();
        }

        return () => {
            isMounted = false;
            if (subscription) subscription.unsubscribe();
            if (typingSubscription) typingSubscription.unsubscribe();
        };
    }, [conversationId, removeOptimisticMessage, user?.id, addLiveMessage, addTypingUser, removeTypingUser]);

    const parseMessages = (page) => {
        if (!page) return [];
        if (Array.isArray(page)) {
            if (page.length === 2 && typeof page[0] === 'string' && Array.isArray(page[1])) {
                return page[1];
            }
            return page;
        }
        if (page.content && Array.isArray(page.content)) {
            return page.content;
        }
        return [];
    };

    // Deduplicate history messages by ID
    const historyMessages = useMemo(() => {
        const allHistoryMessages = data?.pages.flatMap(parseMessages) || [];
        const historyMessagesMap = new Map();
        allHistoryMessages.forEach(rxMsg => {
            const msg = {
                ...rxMsg,
                createdAt: rxMsg.createdAt && !rxMsg.createdAt.endsWith('Z')
                    ? `${rxMsg.createdAt}Z`
                    : rxMsg.createdAt
            };
            historyMessagesMap.set(msg.id, msg);
        });
        return Array.from(historyMessagesMap.values());
    }, [data]);

    const sortedMessages = useMemo(() => {
        const optimisticArray = Object.values(optimisticMessages).filter(
            (msg) => msg.conversationId === conversationId
        );

        // COMPREHENSIVE DEDUPLICATION
        const allMessagesMap = new Map();
        historyMessages.forEach(msg => { allMessagesMap.set(msg.id, msg); });

        const currentLive = liveMessages[conversationId] || [];
        currentLive.forEach(msg => { allMessagesMap.set(msg.id, msg); });

        optimisticArray.forEach(optMsg => {
            const isDuplicate = Array.from(allMessagesMap.values()).some(realMsg => {
                const contentMatch = realMsg.body?.trim() === optMsg.body?.trim();
                const senderMatch = realMsg.senderId === optMsg.senderId ||
                    (optMsg.senderId === 'me' && realMsg.senderId === user?.id) ||
                    (realMsg.senderId === 'me' && optMsg.senderId === user?.id);
                const timeDiff = Math.abs(new Date(realMsg.createdAt).getTime() - new Date(optMsg.createdAt).getTime());
                const timeMatch = timeDiff < 300000;
                return contentMatch && senderMatch && timeMatch;
            });
            if (!isDuplicate) {
                allMessagesMap.set(optMsg.id, optMsg);
            }
        });

        return Array.from(allMessagesMap.values()).sort((a, b) => {
            const isRealA = a.id && /^[0-9a-fA-F]{24}$/.test(a.id);
            const isRealB = b.id && /^[0-9a-fA-F]{24}$/.test(b.id);
            if (isRealA && isRealB) {
                return a.id.localeCompare(b.id);
            }
            return new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp);
        });
    }, [historyMessages, liveMessages, optimisticMessages, conversationId, user?.id]);

    // ─── Scroll helpers ──────────────────────────────────────────────
    const isInitialLoadRef = useRef(true);
    const prevMessagesLengthRef = useRef(0);
    const isPaginatingRef = useRef(false);
    const wasNearBottomRef = useRef(true);
    const savedScrollTopRef = useRef(0);

    const scrollToBottom = useCallback((behavior = 'auto') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
        }
    }, []);

    // Continuously track whether user is near the bottom via scroll events.
    // This captures the value BEFORE React commits new DOM, so it's accurate
    // even when an incoming message inflates scrollHeight.
    const hasMessages = sortedMessages.length > 0;
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            wasNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 250;
        };

        // Set initial value
        handleScroll();

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [hasMessages]);

    // Initial scroll to bottom after first load
    useEffect(() => {
        if (!isFetchingNextPage && sortedMessages.length > 0 && !prevScrollHeightRef.current) {
            if (isInitialLoadRef.current && !isLoading) {
                requestAnimationFrame(() => scrollToBottom('auto'));
                isInitialLoadRef.current = false;
            }
        }
    }, [conversationId, isLoading, isFetchingNextPage, sortedMessages.length, scrollToBottom]);

    // Auto-scroll on new messages (NOT on pagination)
    useEffect(() => {
        const prevLength = prevMessagesLengthRef.current;
        const currentLength = sortedMessages.length;

        // Skip auto-scroll while paginating — useLayoutEffect handles restoration.
        if (isPaginatingRef.current) {
            prevMessagesLengthRef.current = currentLength;
            return;
        }

        if (currentLength > prevLength && !isFetchingNextPage && !isLoading) {
            const lastMsg = sortedMessages[currentLength - 1];
            const isOwnMessage = lastMsg?.senderId === user?.id || lastMsg?.senderId === 'me';

            // Use the pre-render near-bottom value, not a post-render measurement.
            // This correctly handles AI responses / incoming messages that inflate
            // scrollHeight before this effect runs.
            if (wasNearBottomRef.current || isOwnMessage) {
                requestAnimationFrame(() => scrollToBottom('auto'));
            }
        }
        prevMessagesLengthRef.current = currentLength;
    }, [sortedMessages, isFetchingNextPage, isLoading, scrollToBottom, user?.id]);

    // Anchor scroll when footer resizes (e.g. textarea grows)
    useEffect(() => {
        const footer = document.querySelector('.chat-window-footer');
        if (!footer) return;
        const observer = new ResizeObserver(() => {
            const container = scrollContainerRef.current;
            if (container) {
                requestAnimationFrame(() => {
                    const { scrollTop, scrollHeight, clientHeight } = container;
                    if (scrollHeight - scrollTop - clientHeight < 300) {
                        scrollToBottom('auto');
                    }
                });
            }
        });
        observer.observe(footer);
        return () => observer.disconnect();
    }, [conversationId, scrollToBottom]);

    // Infinite scroll — load older messages when scrolled to top
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    isPaginatingRef.current = true;
                    if (scrollContainerRef.current) {
                        prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
                        savedScrollTopRef.current = scrollContainerRef.current.scrollTop;
                    }
                    fetchNextPage();
                }
            },
            { threshold: 0.5 }
        );
        if (topSentinelRef.current) {
            observer.observe(topSentinelRef.current);
        }
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Preserve scroll position when older pages load
    useLayoutEffect(() => {
        if (prevScrollHeightRef.current && scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            const addedHeight = newScrollHeight - prevScrollHeightRef.current;
            // Restore exact position: place scrollTop where it was + the height
            // of newly-inserted content above. Using absolute assignment avoids
            // issues with browser scroll-anchoring double-adjusting.
            if (addedHeight > 0) {
                scrollContainerRef.current.scrollTop = savedScrollTopRef.current + addedHeight;
            }
            prevScrollHeightRef.current = 0;
            savedScrollTopRef.current = 0;
        }
        // Clear pagination flag after scroll position is restored.
        // Use rAF to ensure it clears after the auto-scroll useEffect has run.
        if (isPaginatingRef.current) {
            requestAnimationFrame(() => {
                isPaginatingRef.current = false;
            });
        }
    }, [data]);

    // ─── Render states ───────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonMessage key={i} isOwn={i % 2 === 0} />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    icon={<NoMessagesIcon />}
                    title="Failed to load messages"
                    description="Please try again later"
                />
            </div>
        );
    }

    if (sortedMessages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <EmptyState
                    icon={<NoMessagesIcon />}
                    title="No messages yet"
                    description="Start the conversation by sending a message"
                />
            </div>
        );
    }

    // ─── Build messages with date separators ─────────────────────────
    let lastDateKey = null;
    const renderItems = [];

    sortedMessages.forEach((message) => {
        const dateKey = getDateKey(message.createdAt || message.timestamp);
        if (dateKey && dateKey !== lastDateKey) {
            const label = getDateLabel(message.createdAt || message.timestamp);
            renderItems.push({ type: 'date', key: `date-${dateKey}`, label });
            lastDateKey = dateKey;
        }
        renderItems.push({ type: 'message', key: message.id, message });
    });

    return (
        <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto min-h-0 px-2"
            style={{ overflowAnchor: 'none' }}
        >
            <div className="space-y-4 px-1 py-1">
                <div ref={topSentinelRef} className="h-4 w-full" />

                {isFetchingNextPage && (
                    <div className="flex justify-center p-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-primary)]"></div>
                    </div>
                )}

                {renderItems.map((item) => {
                    if (item.type === 'date') {
                        return <DateSeparator key={item.key} label={item.label} />;
                    }

                    const message = item.message;
                    const isOwn = (message.senderId?.toString() === user?.id?.toString()) || message.senderId === 'me';
                    const isOptimistic = !!optimisticMessages[message.id] || (message.id.toString().startsWith('temp-'));
                    const isAIAssistant = message.senderId === 'ai-assistant';

                    const sender = currentConv?.participants?.find(p => {
                        const pid = typeof p === 'string' ? p : (p.id || p._id);
                        return pid?.toString() === message.senderId?.toString();
                    });

                    let fallbackAvatar = null;
                    let fallbackName = null;

                    if (isAIAssistant) {
                        fallbackAvatar = null;
                        fallbackName = 'AI Assistant';
                    } else if (!isOwn) {
                        if (sender && typeof sender === 'object') {
                            fallbackAvatar = sender.avatarUrl;
                            fallbackName = sender.username || sender.name;
                        }
                        if (!isGroup && !isAI && !fallbackAvatar) {
                            fallbackAvatar = partnerInfo.avatar;
                            fallbackName = fallbackName || partnerInfo.name;
                        }
                    }

                    return (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            isOwn={isOwn}
                            showAvatar={true}
                            isOptimistic={isOptimistic}
                            currentUser={user}
                            fallbackAvatar={fallbackAvatar}
                            fallbackName={fallbackName}
                            isGroup={isGroup}
                            isAI={isAI}
                        />
                    );
                })}

                <div ref={messagesEndRef} className="h-2 w-full" />
            </div>
        </div>
    );
}

// ─── Link renderer ───────────────────────────────────────────────────
function renderMessageWithLinks(text, isOwn) {
    if (!text) return null;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        const linkText = match[1];
        const url = match[2];
        parts.push(
            <a
                key={match.index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    "underline hover:opacity-80 transition-opacity",
                    isOwn
                        ? "text-[var(--color-background)]"
                        : "text-blue-600 dark:text-blue-400"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {linkText}
            </a>
        );
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
}

// ─── Message bubble ──────────────────────────────────────────────────
const MessageBubble = memo(function MessageBubble({
    message,
    isOwn,
    showAvatar,
    isOptimistic,
    currentUser,
    fallbackAvatar,
    fallbackName,
    isGroup,
    isAI
}) {
    const [isHovered, setIsHovered] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const queryClient = useQueryClient();

    const { data: senderProfile } = useQuery({
        queryKey: ['user', message.senderId],
        queryFn: () => userService.getUserById(message.senderId),
        enabled: !isOwn && !message.senderAvatar && !fallbackAvatar && !!message.senderId && message.senderId !== 'ai-assistant',
        staleTime: 1000 * 60 * 5,
    });

    const displayAvatar = isOwn
        ? currentUser?.avatarUrl
        : (message.senderAvatar || fallbackAvatar || senderProfile?.avatarUrl);

    const displayName = isOwn
        ? (currentUser?.username || currentUser?.name)
        : (message.senderName || fallbackName || senderProfile?.username || senderProfile?.name || 'User');

    const deleteMessageMutation = useMutation({
        mutationFn: () => chatService.deleteMessage(message.id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.messages(message.conversationId),
            });
            toast.success('Message deleted', {
                position: 'bottom-right',
                duration: 2000,
            });
        },
        onError: () => {
            toast.error('Failed to delete message', {
                position: 'bottom-right',
            });
        },
    });

    return (
        <div
            className={cn(
                'flex gap-2 animate-slide-in-up group relative',
                isOwn ? 'flex-row-reverse' : 'flex-row',
                isOptimistic && 'opacity-60'
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {showAvatar && (
                <div className="flex-shrink-0 mt-auto mb-1">
                    <Avatar
                        src={message.senderId === 'ai-assistant' ? null : displayAvatar}
                        name={displayName}
                        size="xs"
                    >
                        {message.senderId === 'ai-assistant' && <AILogo className="w-4 h-4" />}
                    </Avatar>
                </div>
            )}

            <div
                className={cn(
                    'max-w-[80%] lg:max-w-md xl:max-w-lg',
                    'flex flex-col gap-1 relative',
                    isOwn ? 'items-end' : 'items-start'
                )}
            >
                {!isOwn && displayName && (isGroup || isAI) && (
                    <span className="text-xs text-[var(--color-gray-500)] px-4">
                        {displayName}
                    </span>
                )}

                <div className="relative">
                    <div
                        className={cn(
                            'px-4 py-2 rounded-2xl',
                            'break-words',
                            isOwn
                                ? 'bg-[var(--color-foreground)] text-[var(--color-background)] rounded-br-sm'
                                : 'bg-[var(--color-border)] rounded-bl-sm text-[var(--color-foreground)]'
                        )}
                    >
                        <div className="text-sm whitespace-pre-wrap">
                            {renderMessageWithLinks(
                                message.senderId === 'ai-assistant'
                                    ? stripMarkdown(message.body)
                                    : message.body,
                                isOwn
                            )}
                        </div>

                        <div className={cn(
                            'flex items-center gap-2 mt-1',
                            isOwn && 'justify-end'
                        )}>
                            <span className={cn(
                                'text-xs',
                                isOwn
                                    ? 'text-[var(--color-background)]/60'
                                    : 'text-[var(--color-foreground)]/60'
                            )}>
                                {formatTime(message.createdAt)}
                            </span>
                            {isOwn && (
                                <span className={cn(
                                    'text-xs',
                                    isOwn
                                        ? 'text-[var(--color-background)]/60'
                                        : 'text-[var(--color-foreground)]/60'
                                )}>
                                    {isOptimistic ? (
                                        <span>• Sending...</span>
                                    ) : message.seen ? (
                                        <span>• Read</span>
                                    ) : (
                                        <span>• Sent</span>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>

                    {!isOptimistic && showDeleteConfirm && (
                        <div className={cn(
                            "absolute z-10 bg-[var(--color-background)] border border-[var(--color-border)] shadow-xl capitalize rounded-lg p-2 flex items-center gap-2 mb-2",
                            isOwn ? "right-0 bottom-full" : "left-0 bottom-full"
                        )}>
                            <span className="text-xs font-medium whitespace-nowrap px-1">Delete?</span>
                            <button
                                onClick={() => deleteMessageMutation.mutate()}
                                className="p-1 rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="p-1 rounded bg-[var(--color-border)] hover:bg-[var(--color-gray-500)] text-[var(--color-foreground)] transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                    )}

                    {!isOptimistic && isHovered && !showDeleteConfirm && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className={cn(
                                'absolute top-1/2 -translate-y-1/2 transition-all opacity-0 group-hover:opacity-100',
                                'w-6 h-6 rounded-full flex items-center justify-center',
                                'bg-red-500/10 hover:bg-red-500/20 text-red-500',
                                isOwn ? '-left-8' : '-right-8'
                            )}
                            title="Delete message"
                        >
                            <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H5H10H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11V12C11 12.5523 10.5523 13 10 13H5C4.44772 13 4 12.5523 4 12V4H3.5C3.22386 4 3 3.77614 3 3.5ZM5 4H10V12H5V4Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});
