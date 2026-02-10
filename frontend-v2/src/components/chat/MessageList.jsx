import { useInfiniteQuery, useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { chatService, socketService, userService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore, useChatStore } from '../../stores';
import { Avatar, SkeletonMessage, EmptyState, NoMessagesIcon, AILogo } from '../ui';
import { cn, formatTime, stripMarkdown } from '../../lib/utils';
import toast from 'react-hot-toast';

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
    const { data: partnerProfile } = useQuery({
        queryKey: ['user', otherUserId],
        queryFn: () => userService.getUserById(otherUserId),
        enabled: !!otherUserId,
        staleTime: 1000 * 60 * 5,
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

    // Clear live messages when conversation changes - handled by key prop remounting
    // useEffect(() => {
    //     // Reset live messages for new conversation
    //     setLiveMessages([]);
    // }, [conversationId]);

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

                    // Normalize message timestamp to UTC if needed
                    const message = {
                        ...rawMessage,
                        createdAt: rawMessage.createdAt && !rawMessage.createdAt.endsWith('Z')
                            ? `${rawMessage.createdAt}Z`
                            : rawMessage.createdAt
                    };

                    addLiveMessage(conversationId, message);

                    const currentOptimisticMessages = optimisticMessagesRef.current;
                    const optimisticEntries = Object.entries(currentOptimisticMessages);

                    // Find matching optimistic message to remove
                    const candidates = optimisticEntries.filter(([, optMsg]) => {
                        // Content check
                        const contentMatch = optMsg.body?.trim() === message.body?.trim();

                        // Sender check
                        const senderMatch = optMsg.senderId === message.senderId ||
                            (optMsg.senderId === 'me' && message.senderId === user?.id) ||
                            (message.senderId === 'me' && optMsg.senderId === user?.id);

                        return optMsg.conversationId === conversationId &&
                            contentMatch &&
                            senderMatch;
                    });

                    if (candidates.length > 0) {
                        const msgTime = new Date(message.createdAt).getTime();

                        // Find best match by time proximity
                        const bestMatch = candidates.reduce((best, current) => {
                            const [, currentMsg] = current;
                            const [, bestMsg] = best;

                            const currentTime = new Date(currentMsg.createdAt).getTime();
                            const bestTime = new Date(bestMsg.createdAt).getTime();

                            const currentDiff = Math.abs(currentTime - msgTime);
                            const bestDiff = Math.abs(bestTime - msgTime);

                            return currentDiff < bestDiff ? current : best;
                        });

                        // Remove if within reasonable time window (5 minutes to handle clock skew)
                        const bestMsg = bestMatch[1];
                        const timeDiff = Math.abs(new Date(bestMsg.createdAt).getTime() - msgTime);

                        if (timeDiff < 300000) { // Increased to 5 minutes
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
            if (subscription) {
                subscription.unsubscribe();
            }
            if (typingSubscription) {
                typingSubscription.unsubscribe();
            }
        };
    }, [conversationId, removeOptimisticMessage, user?.id]);

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

    // Deduplicate history messages by ID (in case API returns overlapping pages)
    const allHistoryMessages = data?.pages.flatMap(parseMessages) || [];
    const historyMessagesMap = new Map();
    allHistoryMessages.forEach(rxMsg => {
        // Normalize timestamp to UTC if needed
        const msg = {
            ...rxMsg,
            createdAt: rxMsg.createdAt && !rxMsg.createdAt.endsWith('Z')
                ? `${rxMsg.createdAt}Z`
                : rxMsg.createdAt
        };
        historyMessagesMap.set(msg.id, msg);
    });
    const historyMessages = Array.from(historyMessagesMap.values());

    const optimisticArray = Object.values(optimisticMessages).filter(
        (msg) => msg.conversationId === conversationId
    );

    // COMPREHENSIVE DEDUPLICATION LOGIC
    // Step 1: Deduplicate by ID (handles history + live message overlap)
    const allMessagesMap = new Map();

    // Add history messages first
    historyMessages.forEach(msg => {
        allMessagesMap.set(msg.id, msg);
    });

    // Add live messages
    const currentLive = liveMessages[conversationId] || [];
    currentLive.forEach(msg => {
        allMessagesMap.set(msg.id, msg);
    });

    // Step 2: Add optimistic messages ONLY if no real message exists with same content
    optimisticArray.forEach(optMsg => {
        // Check if this optimistic message already exists as a real message
        const isDuplicate = Array.from(allMessagesMap.values()).some(realMsg => {
            // Content check (normalized)
            const contentMatch = realMsg.body?.trim() === optMsg.body?.trim();

            // Sender check (handle 'me' vs actual ID)
            const senderMatch = realMsg.senderId === optMsg.senderId ||
                (optMsg.senderId === 'me' && realMsg.senderId === user?.id) ||
                (realMsg.senderId === 'me' && optMsg.senderId === user?.id);

            // Time check (allow 5m drift to be safe - handles clock skew)
            const timeDiff = Math.abs(new Date(realMsg.createdAt).getTime() - new Date(optMsg.createdAt).getTime());
            const timeMatch = timeDiff < 300000;

            return contentMatch && senderMatch && timeMatch;
        });

        // Only add optimistic message if it's not a duplicate
        if (!isDuplicate) {
            allMessagesMap.set(optMsg.id, optMsg);
        }
    });

    const sortedMessages = Array.from(allMessagesMap.values()).sort((a, b) => {
        // Use MongoDB ID for sorting real messages to ensure chronological order
        // despite potential timestamp skews (e.g. UTC vs Local)
        const isRealA = a.id && /^[0-9a-fA-F]{24}$/.test(a.id);
        const isRealB = b.id && /^[0-9a-fA-F]{24}$/.test(b.id);

        if (isRealA && isRealB) {
            return a.id.localeCompare(b.id);
        }

        return new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp);
    });

    // Track if this is the initial load
    const isInitialLoadRef = useRef(true);
    const prevMessagesLengthRef = useRef(0);

    useEffect(() => {
        // Only scroll to bottom on initial load, not when loading previous messages
        if (!isFetchingNextPage && sortedMessages.length > 0 && !prevScrollHeightRef.current) {
            if (isInitialLoadRef.current && !isLoading) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
                isInitialLoadRef.current = false;
            }
        }
    }, [conversationId, isLoading, isFetchingNextPage, sortedMessages.length]);

    useEffect(() => {
        // Only scroll to bottom when NEW messages arrive (not when loading history)
        const prevLength = prevMessagesLengthRef.current;
        const currentLength = sortedMessages.length;

        if (currentLength > prevLength && !isFetchingNextPage && !isLoading) {
            if (scrollContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
                const isNearBottom = scrollHeight - scrollTop - clientHeight < 250;

                if (isNearBottom || (currentLength - prevLength === 1 && sortedMessages[currentLength - 1].senderId === 'me')) {
                    // Use 'auto' behavior for instant feedback on your own messages or when near bottom
                    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
                }
            }
        }

        prevMessagesLengthRef.current = currentLength;
    }, [sortedMessages, isFetchingNextPage, isLoading]);

    useEffect(() => {
        const footer = document.querySelector('.chat-window-footer');
        if (!footer) return;

        const observer = new ResizeObserver(() => {
            if (scrollContainerRef.current) {
                requestAnimationFrame(() => {
                    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
                    // Proactive anchoring: If user is within 300px of bottom, stay glued during resize
                    if (scrollHeight - scrollTop - clientHeight < 300) {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
                    }
                });
            }
        });

        observer.observe(footer);
        return () => observer.disconnect();
    }, [conversationId]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    if (scrollContainerRef.current) {
                        prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
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

    useLayoutEffect(() => {
        if (prevScrollHeightRef.current && scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            const diff = newScrollHeight - prevScrollHeightRef.current;
            if (diff > 0) {
                scrollContainerRef.current.scrollTop += diff;
            }
            prevScrollHeightRef.current = 0;
        }
    }, [data]);

    useEffect(() => {
        if (messagesEndRef.current) {
            scrollContainerRef.current = messagesEndRef.current.closest('.overflow-y-auto, .scroll-area');
        }
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-4 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonMessage key={i} isOwn={i % 2 === 0} />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                icon={<NoMessagesIcon />}
                title="Failed to load messages"
                description="Please try again later"
            />
        );
    }

    if (sortedMessages.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4">
                <EmptyState
                    icon={<NoMessagesIcon />}
                    title="No messages yet"
                    description="Start the conversation by sending a message"
                />
            </div>
        );
    }

    return (
        <div
            className="space-y-4 px-1 py-1"
        >
            <div ref={topSentinelRef} className="h-4 w-full" />

            {isFetchingNextPage && (
                <div className="flex justify-center p-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-primary)]"></div>
                </div>
            )}

            {sortedMessages.map((message) => {
                const isOwn = (message.senderId?.toString() === user?.id?.toString()) || message.senderId === 'me';
                const isOptimistic = !!optimisticMessages[message.id] || (message.id.toString().startsWith('temp-'));

                const isAIAssistant = message.senderId === 'ai-assistant';

                // Try to find the specific sender in the participant list for this message
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

                    // For Direct messages ONLY, fall back to conversation metadata if sender lookup failed
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
    );
}

// Helper function to render message text with clickable links
function renderMessageWithLinks(text, isOwn) {
    if (!text) return null;

    // Regex to match markdown-style links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        // Add text before the link
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        // Add the clickable link
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

    // Add remaining text after the last link
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    // If no links found, return the original text
    return parts.length > 0 ? parts : text;
}

function MessageBubble({
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

    // Dynamically fetch sender profile if missing (crucial for Groups)
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
}
