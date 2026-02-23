import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userService, chatService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore, useTabsStore, useAuthStore, useUIStore } from '../../stores';
import { Avatar, Button, Skeleton, SkeletonAvatar } from '../ui';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const HEADER_HEIGHT = 25;

export function OnlineUsersPanel() {
    const { user: currentUser } = useAuthStore();
    const { setActiveConversation } = useChatStore();
    const { openTab } = useTabsStore();
    const {
        onlinePanelHeight,
        setOnlinePanelHeight,
        isOnlinePanelOpen,
        toggleOnlinePanel,
        isSidebarCollapsed,
        theme
    } = useUIStore();

    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef(null);

    const startResizing = useCallback((e) => {
        if (!isOnlinePanelOpen) return;
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = 'row-resize';
    }, [isOnlinePanelOpen]);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        document.body.style.cursor = '';
    }, []);

    const resize = useCallback(
        (e) => {
            if (isResizing) {
                const panelElement = panelRef.current;
                if (!panelElement) return;

                const rect = panelElement.getBoundingClientRect();
                const newHeight = rect.bottom - e.clientY;

                // Constraints: min height when open is 100, max is 500
                if (newHeight >= 100 && newHeight <= 500) {
                    setOnlinePanelHeight(newHeight);
                }
            }
        },
        [isResizing, setOnlinePanelHeight]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    // Fetch list of online user IDs
    const { data: onlineUserIds, isLoading: isLoadingIds } = useQuery({
        queryKey: queryKeys.onlineUsers,
        queryFn: userService.listOnlineUsers,
        staleTime: 10000,
    });

    // Fetch profiles for online users
    const onlineIdsToFetch = (onlineUserIds || []).filter(id => id !== currentUser?.id);

    const { data: onlineUsers, isLoading: isLoadingUsers } = useQuery({
        queryKey: ['users-batch-online', ...onlineIdsToFetch],
        queryFn: () => userService.getUsersBatch(onlineIdsToFetch),
        enabled: onlineIdsToFetch.length > 0,
        staleTime: 1000 * 60 * 2,
    });

    const handleStartChat = async (userId) => {
        try {
            const conversation = await chatService.createDirectChat(userId);
            openTab(conversation);
            setActiveConversation(conversation.id);
        } catch (err) {
            if (err?.status === 409 && err?.data?.id) {
                openTab(err.data);
                setActiveConversation(err.data.id);
                return;
            }
            toast.error('Failed to start chat');
        }
    };

    const isLoading = isLoadingIds || (onlineIdsToFetch.length > 0 && isLoadingUsers);

    if (isSidebarCollapsed) return null;

    return (
        <div
            ref={panelRef}
            className={cn(
                "flex flex-col border-t border-[var(--color-border)] bg-[var(--color-background)] overflow-hidden relative",
                isResizing ? "duration-0" : "transition-[height] duration-200 ease-in-out"
            )}
            style={{ height: isOnlinePanelOpen ? onlinePanelHeight : HEADER_HEIGHT }}
        >
            {/* Resize Handle - Only show and enable when panel is open */}
            {isOnlinePanelOpen && (
                <div
                    className="absolute top-0 left-0 w-full h-1 cursor-row-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-40"
                    onMouseDown={startResizing}
                />
            )}

            {/* Header */}
            <div
                className={cn(
                    "flex items-center justify-between px-4 cursor-pointer transition-colors flex-shrink-0 select-none",
                    theme === 'dark' ? "hover:bg-white/5" : "hover:bg-black/5"
                )}
                style={{ height: HEADER_HEIGHT }}
                onClick={toggleOnlinePanel}
            >
                <div className="flex items-center gap-2">
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 15 15"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={cn(
                            "transition-transform duration-200 text-[var(--color-gray-400)] font-bold",
                            !isOnlinePanelOpen && "-rotate-180"
                        )}
                    >
                        <path d="M4 9L7.5 5.5L11 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-gray-400)]">
                        Online Now {onlineUsers?.length > 0 && <span>({onlineUsers.length})</span>}
                    </span>
                </div>
                {isLoading && (
                    <div className="w-3 h-3 border-2 border-[var(--color-gray-500)] border-t-transparent rounded-full animate-spin" />
                )}
            </div>

            {/* Content Container */}
            <div className={cn(
                "flex-1 overflow-y-auto overflow-x-hidden transition-opacity duration-200",
                !isOnlinePanelOpen && "opacity-0 pointer-events-none"
            )}>
                <div className="p-2 pt-0 space-y-0.5">
                    {isLoading ? (
                        <div className="space-y-1 p-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-3 py-2">
                                    <SkeletonAvatar size="sm" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            ))}
                        </div>
                    ) : !onlineUsers || onlineUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                            <p className="text-xs text-[var(--color-gray-500)] italic">
                                No other users online at the moment
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-0.5">
                            {onlineUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => handleStartChat(user.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-2 rounded-md w-full text-left transition-all duration-200 group relative",
                                        theme === 'dark' ? "hover:bg-white/5" : "hover:bg-black/5"
                                    )}
                                    title={`Chat with ${user.username || user.name}`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <Avatar
                                            src={user.avatarUrl}
                                            name={user.username || user.name || '?'}
                                            size="sm"
                                            online
                                        />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-[var(--color-foreground)] truncate">
                                                {user.username || user.name || 'User'}
                                            </span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                        </div>
                                        <span className="text-[10px] text-[var(--color-gray-500)] leading-none mt-0.5">
                                            Active now
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
