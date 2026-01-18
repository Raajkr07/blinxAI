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
    const { closeTab, getTabByConversationId } = useTabsStore();
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);

    const { data: conversation } = useQuery({
        queryKey: queryKeys.conversation(activeConversationId),
        queryFn: () => chatApi.getConversation(activeConversationId),
        enabled: !!activeConversationId,
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
        mutationFn: () => chatApi.deleteConversation(activeConversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            const tab = getTabByConversationId(activeConversationId);
            if (tab) closeTab(tab.id);
            clearActiveConversation();
            toast.success('Conversation deleted');
        },
        onError: () => {
            toast.error('Failed to delete conversation');
        },
    });

    const leaveGroupMutation = useMutation({
        mutationFn: () => chatApi.leaveGroup(activeConversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            queryClient.invalidateQueries({ queryKey: queryKeys.groups });
            const tab = getTabByConversationId(activeConversationId);
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
            activeConversationId,
            'video',
            conversation.participants || []
        );

        initiateCallMutation.mutate({
            conversationId: activeConversationId,
            callType: 'video',
        });
    };

    const handleAudioCall = () => {
        if (!conversation) return;

        initiateCall(
            activeConversationId,
            'audio',
            conversation.participants || []
        );

        initiateCallMutation.mutate({
            conversationId: activeConversationId,
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
                                width="20"
                                height="20"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.50203 5.49797 8.125 7.5 8.125C9.50203 8.125 11.125 6.50203 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM1.5 13.5C1.5 11.433 3.183 9.75 5.25 9.75H9.75C11.817 9.75 13.5 11.433 13.5 13.5C13.5 13.7761 13.2761 14 13 14H2C1.72386 14 1.5 13.7761 1.5 13.5Z"
                                    fill="currentColor"
                                />
                            </svg>
                        </Button>
                    )}

                    {!isAI && (
                        <SimpleDropdown
                            trigger={
                                <Button variant="ghost" size="icon" aria-label="Start Call">
                                    <svg width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M7.5 1C6.67157 1 6 1.67157 6 2.5V7.5C6 8.32843 6.67157 9 7.5 9C8.32843 9 9 8.32843 9 7.5V2.5C9 1.67157 8.32843 1 7.5 1ZM4 6.5C4.27614 6.5 4.5 6.72386 4.5 7V7.5C4.5 9.15685 5.84315 10.5 7.5 10.5C9.15685 10.5 10.5 9.15685 10.5 7.5V7C10.5 6.72386 10.7239 6.5 11 6.5C11.2761 6.5 11.5 6.72386 11.5 7V7.5C11.5 9.70914 9.70914 11.5 7.5 11.5V13H9C9.27614 13 9.5 13.2239 9.5 13.5C9.5 13.7761 9.27614 14 9 14H6C5.72386 14 5.5 13.7761 5.5 13.5C5.5 13.2239 5.72386 13 6 13H7.5V11.5C5.29086 11.5 3.5 9.70914 3.5 7.5V7C3.5 6.72386 3.72386 6.5 4 6.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                    </svg>
                                </Button>
                            }
                            align="end"
                        >
                            <SimpleDropdownItem onClick={handleAudioCall}>Audio Call</SimpleDropdownItem>
                            <SimpleDropdownItem onClick={handleVideoCall}>Video Call</SimpleDropdownItem>
                        </SimpleDropdown>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            const tab = getTabByConversationId(activeConversationId);
                            if (tab) closeTab(tab.id);
                            clearActiveConversation();
                        }}
                        aria-label="Close Chat"
                    >
                        <svg width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                        </svg>
                    </Button>

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
                conversationId={activeConversationId}
            />

            <ProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                conversationId={activeConversationId}
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
