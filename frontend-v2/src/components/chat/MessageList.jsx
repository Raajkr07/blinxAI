import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { chatApi, socketService } from '../../api';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore, useChatStore } from '../../stores';
import { Avatar, SkeletonMessage, EmptyState, NoMessagesIcon } from '../ui';
import { cn, formatTime, stripMarkdown } from '../../lib/utils';
import toast from 'react-hot-toast';

export function MessageList({ conversationId }) {
    const { user } = useAuthStore();
    const { optimisticMessages, removeOptimisticMessage } = useChatStore();
    const [liveMessages, setLiveMessages] = useState([]);
    const messagesEndRef = useRef(null);
    const topSentinelRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const prevScrollHeightRef = useRef(0);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error
    } = useInfiniteQuery({
        queryKey: queryKeys.messages(conversationId),
        queryFn: ({ pageParam = 0 }) => chatApi.getMessages(conversationId, pageParam, 20),
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

    // Clear live messages when conversation changes
    useEffect(() => {
        // Reset live messages for new conversation
        setLiveMessages([]);
    }, [conversationId]);

    useEffect(() => {
        let subscription = null;
        let isMounted = true;

        const setupConnection = async () => {
            try {
                await socketService.connect();
                if (!isMounted) return;

                const topic = `/topic/conversations/${conversationId}`;
                subscription = socketService.subscribe(topic, (message) => {
                    if (!isMounted) return;

                    setLiveMessages((prev) => {
                        const existingIndex = prev.findIndex((m) => m.id === message.id);
                        if (existingIndex !== -1) {
                            const updated = [...prev];
                            updated[existingIndex] = message;
                            return updated;
                        }
                        return [...prev, message];
                    });

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

                        // Remove if within reasonable time window (60s)
                        const bestMsg = bestMatch[1];
                        const timeDiff = Math.abs(new Date(bestMsg.createdAt).getTime() - msgTime);

                        if (timeDiff < 60000) {
                            removeOptimisticMessage(bestMatch[0]);
                        }
                    }
                });
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
        };
    }, [conversationId, removeOptimisticMessage]);

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
    allHistoryMessages.forEach(msg => {
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

    // Add live messages (will overwrite if same ID, which is fine - live is more recent)
    liveMessages.forEach(msg => {
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

            // Time check (allow 60s drift to be safe)
            const timeDiff = Math.abs(new Date(realMsg.createdAt).getTime() - new Date(optMsg.createdAt).getTime());
            const timeMatch = timeDiff < 60000;

            return contentMatch && senderMatch && timeMatch;
        });

        // Only add optimistic message if it's not a duplicate
        if (!isDuplicate) {
            allMessagesMap.set(optMsg.id, optMsg);
        }
    });

    const sortedMessages = Array.from(allMessagesMap.values()).sort((a, b) =>
        new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
    );

    useEffect(() => {
        if (!isFetchingNextPage && sortedMessages.length > 0 && !prevScrollHeightRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [conversationId, isLoading, isFetchingNextPage, sortedMessages.length]);

    useEffect(() => {
        if (liveMessages.length > 0 || optimisticArray.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [liveMessages.length, optimisticArray.length]);

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
        <div className="space-y-4 p-4">
            <div ref={topSentinelRef} className="h-4 w-full" />

            {isFetchingNextPage && (
                <div className="flex justify-center p-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-primary)]"></div>
                </div>
            )}

            {sortedMessages.map((message) => {
                const isOwn = message.senderId === user?.id || message.senderId === 'me';
                const showAvatar = !isOwn;
                const isOptimistic = !!optimisticMessages[message.id] || (message.id.toString().startsWith('temp-'));

                return (
                    <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={isOwn}
                        showAvatar={showAvatar}
                        isOptimistic={isOptimistic}
                    />
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}

function MessageBubble({ message, isOwn, showAvatar, isOptimistic }) {
    const [isHovered, setIsHovered] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const queryClient = useQueryClient();

    const deleteMessageMutation = useMutation({
        mutationFn: () => chatApi.deleteMessage(message.id),
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
                'flex gap-3 animate-slide-in-up group relative',
                isOwn && 'flex-row-reverse',
                isOptimistic && 'opacity-60'
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {showAvatar && (
                <Avatar
                    src={message.senderAvatar}
                    name={message.senderName || 'User'}
                    size="sm"
                />
            )}

            <div
                className={cn(
                    'max-w-xs lg:max-w-md xl:max-w-lg',
                    'flex flex-col gap-1 relative'
                )}
            >
                {!isOwn && message.senderName && (
                    <span className="text-xs text-[var(--color-gray-500)] px-4">
                        {message.senderName}
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
                        <p className="text-sm whitespace-pre-wrap">
                            {message.senderId === 'ai-assistant'
                                ? stripMarkdown(message.body)
                                : message.body}
                        </p>

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
                            "absolute z-10 bg-white dark:bg-zinc-800 shadow-lg capitalize rounded-lg p-2 flex items-center gap-2",
                            isOwn ? "right-0 -bottom-12" : "-left-4 -bottom-12"
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
                                className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors"
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
                                'absolute -left-8 top-1/2 -translate-y-1/2',
                                'w-6 h-6 rounded-full',
                                'bg-red-500/10 hover:bg-red-500/20',
                                'text-red-500',
                                'flex items-center justify-center',
                                'transition-all opacity-0 group-hover:opacity-100'
                            )}
                            title="Delete message"
                        >
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.77614 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H5H10H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11V12C11 12.5523 10.5523 13 10 13H5C4.44772 13 4 12.5523 4 12V4H3.5C3.22386 4 3 3.77614 3 3.5ZM5 4H10V12H5V4Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
