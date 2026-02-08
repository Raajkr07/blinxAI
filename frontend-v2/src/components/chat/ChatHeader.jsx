import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, callsApi, userApi } from '../../api';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore, useUIStore, useCallStore, useTabsStore, useAuthStore } from '../../stores';
import { Avatar, Button, SimpleDropdown, SimpleDropdownItem, ConfirmDialog } from '../ui';
import { SidebarToggle } from '../layout';
import { ConversationAnalysisModal } from './ConversationAnalysisModal';
import { ProfileModal } from './ProfileModal';
import toast from 'react-hot-toast';

export function ChatHeader() {
    const queryClient = useQueryClient();
    const { activeConversationId, clearActiveConversation } = useChatStore();
    const { user: currentUser } = useAuthStore();
    const { isMobile } = useUIStore();
    const { initiateCall, setCallActive } = useCallStore();
    const { closeTab, getTabByConversationId, getActiveTab } = useTabsStore();
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Use active tab's conversation ID if available, otherwise fall back to activeConversationId
    const activeTab = getActiveTab();
    const displayConversationId = activeTab?.conversationId || activeConversationId;

    const { data: conversation } = useQuery({
        queryKey: queryKeys.conversation(displayConversationId),
        queryFn: () => chatApi.getConversation(displayConversationId),
        enabled: !!displayConversationId,
    });

    const isGroup = conversation?.type === 'GROUP' || conversation?.type === 'COMMUNITY';
    const isAI = conversation?.type === 'AI_ASSISTANT';

    // Safely identify the other participant in direct chats
    const otherUserId = !isGroup && !isAI && conversation?.participants && currentUser
        ? conversation.participants?.find((p) => {
            const id = typeof p === 'string' ? p : p.id;
            return id !== currentUser.id;
        })
        : null;

    const { data: otherUser } = useQuery({
        queryKey: ['user', otherUserId],
        queryFn: () => userApi.getUserById(otherUserId),
        enabled: !!otherUserId && !conversation?.title,
        staleTime: 1000 * 60 * 5,
    });

    const initiateCallMutation = useMutation({
        mutationFn: ({ conversationId, callType }) =>
            callsApi.initiateCall(conversationId, callType),
        onSuccess: (data) => {
            setCallActive(data.id);
            toast.success('Call started');
        },
        onError: () => {
            toast.error('Failed to start call');
        },
    });

    const deleteConversationMutation = useMutation({
        mutationFn: () => chatApi.deleteConversation(displayConversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            const tab = getTabByConversationId(displayConversationId);
            if (tab) closeTab(tab.id);
            clearActiveConversation();
            toast.success('Conversation deleted');
        },
        onError: () => {
            toast.error('Failed to delete conversation');
        },
    });

    const leaveGroupMutation = useMutation({
        mutationFn: () => chatApi.leaveGroup(displayConversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            queryClient.invalidateQueries({ queryKey: queryKeys.groups });
            const tab = getTabByConversationId(displayConversationId);
            if (tab) closeTab(tab.id);
            clearActiveConversation();
            toast.success('Left group');
        },
        onError: (error) => {
            const message = error.response?.data?.message || 'Failed to leave group. Note: Last member cannot leave, try deleting the chat instead.';
            toast.error(message, { duration: 5000 });
        },
    });

    const handleVideoCall = () => {
        if (!conversation) return;

        initiateCall(
            displayConversationId,
            'video',
            conversation.participants || []
        );

        initiateCallMutation.mutate({
            conversationId: displayConversationId,
            callType: 'video',
        });
    };

    const handleAudioCall = () => {
        if (!conversation) return;

        initiateCall(
            displayConversationId,
            'audio',
            conversation.participants || []
        );

        initiateCallMutation.mutate({
            conversationId: displayConversationId,
            callType: 'audio',
        });
    };

    if (!conversation) return null;

    let displayTitle = conversation.title;
    let displayAvatar = conversation.avatarUrl;

    if (!isGroup && !isAI) {
        if (otherUser) {
            displayTitle = displayTitle || otherUser.username || otherUser.name;
            displayAvatar = displayAvatar || otherUser.avatarUrl;
        } else if (otherUserId && typeof otherUserId === 'object') {
            displayTitle = displayTitle || otherUserId.username || otherUserId.name;
            displayAvatar = displayAvatar || otherUserId.avatarUrl;
        }
    }

    displayTitle = displayTitle || 'Unknown Chat';

    return (
        <>
            <div className="flex items-center gap-4">
                {isMobile && <SidebarToggle />}

                <Avatar
                    src={displayAvatar}
                    name={displayTitle}
                    size="md"
                    online={false}
                />

                <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-[var(--color-foreground)] truncate">
                        {displayTitle}
                    </h2>
                    <p className="text-sm text-[var(--color-gray-400)]">
                        {isAI ? (
                            'AI Assistant'
                        ) : isGroup ? (
                            `${conversation.participants?.length || 0} members`
                        ) : (
                            'Online'
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {!isAI && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowAnalysisModal(true)}
                            aria-label="AI Insights"
                        >
                            <svg
                                fill="none"
                                viewBox="0 0 25 25"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                            </svg>
                        </Button>
                    )}

                    {!isAI && (
                        <SimpleDropdown
                            trigger={
                                <Button variant="ghost" size="icon" aria-label="Start Call">
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                    </svg>
                                </Button>
                            }
                            align="end"
                        >
                            <SimpleDropdownItem onClick={handleAudioCall}>Audio Call</SimpleDropdownItem>
                            <SimpleDropdownItem onClick={handleVideoCall}>Video Call</SimpleDropdownItem>
                        </SimpleDropdown>
                    )}

                    <SimpleDropdown
                        trigger={
                            <Button variant="ghost" size="icon" aria-label="More options">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 15 15"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM12.5 8.625C13.1213 8.625 13.625 8.12132 13.625 7.5C13.625 6.87868 13.1213 6.375 12.5 6.375C11.8787 6.375 11.375 6.87868 11.375 7.5C11.375 8.12132 11.8787 8.625 12.5 8.625Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </Button>
                        }
                        align="end"
                    >
                        <SimpleDropdownItem onClick={() => setShowProfileModal(true)}>View Profile</SimpleDropdownItem>

                        {isGroup && (
                            <SimpleDropdownItem
                                onClick={() => setShowLeaveConfirm(true)}
                                destructive
                            >
                                Leave Group
                            </SimpleDropdownItem>
                        )}

                        {!isAI && (
                            <SimpleDropdownItem
                                onClick={() => setShowDeleteConfirm(true)}
                                destructive
                            >
                                {isGroup ? 'Delete Group' : 'Delete Chat'}
                            </SimpleDropdownItem>
                        )}
                    </SimpleDropdown>
                </div>
            </div>

            <ConversationAnalysisModal
                open={showAnalysisModal}
                onOpenChange={setShowAnalysisModal}
                conversationId={displayConversationId}
            />

            <ProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                conversationId={displayConversationId}
                type={isGroup ? 'group' : isAI ? 'ai' : 'user'}
            />

            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Conversation"
                description="Are you sure you want to delete this conversation? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={() => {
                    deleteConversationMutation.mutate();
                    setShowDeleteConfirm(false);
                }}
            />

            <ConfirmDialog
                open={showLeaveConfirm}
                onOpenChange={setShowLeaveConfirm}
                title="Leave Group"
                description={
                    conversation.participants?.length <= 1
                        ? "You are the last member of this group. You cannot leave the group empty. Please delete the chat instead."
                        : "Are you sure you want to leave this group? You'll need to be re-added to join again."
                }
                confirmText={conversation.participants?.length <= 1 ? "Got it" : "Leave Group"}
                cancelText="Cancel"
                variant={conversation.participants?.length <= 1 ? "default" : "danger"}
                onConfirm={() => {
                    if (conversation.participants?.length <= 1) {
                        setShowLeaveConfirm(false);
                        return;
                    }
                    leaveGroupMutation.mutate();
                    setShowLeaveConfirm(false);
                }}
            />
        </>
    );
}
