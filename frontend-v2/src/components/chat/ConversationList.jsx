import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, userApi } from '../../api';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore, useTabsStore, useAuthStore } from '../../stores';
import { Avatar, SkeletonConversation, EmptyState, NoConversationsIcon, SimpleDropdown, SimpleDropdownItem, ConfirmDialog } from '../ui';
import { cn, formatRelativeTime, truncate } from '../../lib/utils';
import toast from 'react-hot-toast';

export function ConversationList() {
    const queryClient = useQueryClient();
    const { activeConversationId, setActiveConversation, clearActiveConversation } = useChatStore();
    const { openTab, getTabByConversationId, closeTab } = useTabsStore();
    const { user: currentUser } = useAuthStore();
    const [conversationToDelete, setConversationToDelete] = useState(null);

    const { data: conversations, isLoading, error } = useQuery({
        queryKey: queryKeys.conversations,
        queryFn: chatApi.listConversations,
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => chatApi.deleteConversation(id),
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            const tab = getTabByConversationId(deletedId);
            if (tab) closeTab(tab.id);
            if (activeConversationId === deletedId) clearActiveConversation();
            toast.success('Conversation deleted');
            setConversationToDelete(null);
        },
        onError: () => {
            toast.error('Failed to delete conversation');
        },
    });

    const handleConversationClick = (conversation, event) => {
        // Prevent click if clicking on the dropdown or its items
        if (event.defaultPrevented) return;

        if (event.ctrlKey || event.metaKey) {
            openTab(conversation);
        } else {
            setActiveConversation(conversation.id);
        }
    };

    if (isLoading) {
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

    if (!conversations || conversations.length === 0) {
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
            <div className="space-y-1">
                {conversations.map((conversation) => {
                    const hasTab = getTabByConversationId(conversation.id);
                    return (
                        <ConversationItem
                            key={conversation.id}
                            conversation={conversation}
                            currentUser={currentUser}
                            isActive={activeConversationId === conversation.id}
                            hasTab={!!hasTab}
                            onClick={(e) => handleConversationClick(conversation, e)}
                            onDelete={() => setConversationToDelete(conversation)}
                        />
                    );
                })}
            </div>

            <ConfirmDialog
                open={!!conversationToDelete}
                onOpenChange={(open) => !open && setConversationToDelete(null)}
                title="Delete Conversation"
                description={`Are you sure you want to delete the conversation with "${conversationToDelete?.title || 'this user'}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                loading={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate(conversationToDelete.id)}
            />
        </>
    );
}

function ConversationItem({ conversation, currentUser, isActive, hasTab, onClick, onDelete }) {
    const isGroup = conversation.type === 'GROUP' || conversation.type === 'COMMUNITY';
    const isAI = conversation.type === 'AI_ASSISTANT';

    const otherUserId = !isGroup && !isAI && currentUser
        ? conversation.participants?.find((p) => {
            const id = typeof p === 'string' ? p : p.id;
            return id !== currentUser.id;
        })
        : null;

    const { data: otherUser } = useQuery({
        queryKey: ['user', otherUserId],
        queryFn: () => userApi.getUserById(otherUserId),
        enabled: !!otherUserId && !conversation.title,
        staleTime: 1000 * 60 * 5,
    });

    let displayTitle = conversation.title;
    let displayAvatar = conversation.avatarUrl;

    if (otherUser) {
        displayTitle = displayTitle || otherUser.username || otherUser.name;
        displayAvatar = displayAvatar || otherUser.avatarUrl;
    }

    if (!isGroup && !isAI && currentUser) {
        const otherParticipant = conversation.participants?.find(
            p => (p.id || p) !== currentUser.id
        );

        if (otherParticipant && typeof otherParticipant === 'object') {
            displayTitle = displayTitle || otherParticipant.username || otherParticipant.name;
            displayAvatar = displayAvatar || otherParticipant.avatarUrl;
        }
    }

    displayTitle = displayTitle || 'Unknown Chat';

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

            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <SimpleDropdown
                    align="end"
                    trigger={
                        <button
                            className="p-1.5 rounded-md hover:bg-[var(--color-background)] text-[var(--color-gray-400)] hover:text-[var(--color-foreground)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM12.5 8.625C13.1213 8.625 13.625 8.12132 13.625 7.5C13.625 6.87868 13.1213 6.375 12.5 6.375C11.8787 6.375 11.375 6.87868 11.375 7.5C11.375 8.12132 11.8787 8.625 12.5 8.625Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                            </svg>
                        </button>
                    }
                >
                    <SimpleDropdownItem
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        destructive
                    >
                        Delete
                    </SimpleDropdownItem>
                </SimpleDropdown>
            </div>

            <div className="flex flex-col items-end gap-1 group-hover:opacity-0 transition-opacity">
                {isGroup && (
                    <span className="text-xs text-[var(--color-gray-500)]">
                        {conversation.participants?.length || 0} members
                    </span>
                )}
                {isAI && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-foreground)]">
                        AI
                    </span>
                )}
            </div>
        </div>
    );
}
