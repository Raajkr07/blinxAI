import { useQuery } from '@tanstack/react-query';
import { chatApi, userApi } from '../../api';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore } from '../../stores';
import { Modal, Avatar, Button } from '../ui';

export function ProfileModal({ isOpen, onClose, conversationId, type = 'user' }) {
    const { user: currentUser } = useAuthStore();

    const { data: conversation, isLoading: isLoadingConv } = useQuery({
        queryKey: queryKeys.conversation(conversationId),
        queryFn: () => chatApi.getConversation(conversationId),
        enabled: !!conversationId && isOpen,
    });

    const isGroup = type === 'group' || conversation?.type === 'GROUP' || conversation?.type === 'COMMUNITY';
    const isAI = type === 'ai' || conversation?.type === 'AI_ASSISTANT';

    const otherUserId = !isGroup && !isAI && conversation?.participants
        ? conversation.participants.find(id => id !== currentUser?.id)
        : null;

    const { data: userProfile, isLoading: isLoadingUser } = useQuery({
        queryKey: ['user', otherUserId],
        queryFn: () => userApi.getUserById(otherUserId),
        enabled: !!otherUserId && isOpen,
    });

    const isLoading = isLoadingConv || (!!otherUserId && isLoadingUser);

    const displayData = isGroup || isAI ? conversation : (userProfile || conversation);

    if (!isOpen) return null;

    return (
        <Modal
            open={isOpen}
            onOpenChange={(val) => !val && onClose()}
            title={isGroup ? 'Group Info' : isAI ? 'AI Assistant' : 'Profile'}
            size="md"
        >
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-foreground)]" />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex-col items-center gap-4 flex">
                        <Avatar
                            src={displayData?.avatarUrl}
                            name={displayData?.title || displayData?.username || displayData?.name}
                            size="xl"
                            className="w-24 h-24"
                        />
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-[var(--color-foreground)]">
                                {displayData?.title || displayData?.username || displayData?.displayName || displayData?.name}
                            </h2>
                        </div>
                    </div>

                    {displayData?.bio && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-[var(--color-gray-500)]">
                                {isGroup ? 'Description' : 'Bio'}
                            </h3>
                            <p className="text-[var(--color-foreground)]">
                                {displayData.bio}
                            </p>
                        </div>
                    )}

                    {!isGroup && !isAI && (
                        <div className="space-y-3">
                            {displayData?.email && (
                                <div className="space-y-1">
                                    <h3 className="text-sm font-medium text-[var(--color-gray-500)]">Email</h3>
                                    <p className="text-[var(--color-foreground)]">{displayData.email}</p>
                                </div>
                            )}
                            {displayData?.phone && (
                                <div className="space-y-1">
                                    <h3 className="text-sm font-medium text-[var(--color-gray-500)]">Phone</h3>
                                    <p className="text-[var(--color-foreground)]">{displayData.phone}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {isGroup && conversation?.participants && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-[var(--color-gray-500)]">
                                Members ({conversation.participants.length})
                            </h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {conversation.participants.map((participant) => (
                                    <div
                                        key={participant.id || participant}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                                    >
                                        <Avatar
                                            src={participant.avatarUrl}
                                            name={participant.username || participant.name || 'Unknown'}
                                            size="sm"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                                                    {participant.username || participant.name || 'Unknown'}
                                                </p>
                                                {participant.role && (
                                                    <span className="text-xs text-[var(--color-gray-500)] ml-2">
                                                        {participant.role}
                                                    </span>
                                                )}
                                            </div>
                                            {(participant.email || participant.phone) && (
                                                <p className="text-xs text-[var(--color-gray-500)] truncate">
                                                    {participant.email || participant.phone}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {isAI && (
                        <div className="space-y-3 p-4 rounded-lg bg-[var(--color-border)]">
                            <div className="flex items-center gap-2">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 15 15"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="text-[var(--color-foreground)]"
                                >
                                    <path
                                        d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.50203 5.49797 8.125 7.5 8.125C9.50203 8.125 11.125 6.50203 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM1.5 13.5C1.5 11.433 3.183 9.75 5.25 9.75H9.75C11.817 9.75 13.5 11.433 13.5 13.5C13.5 13.7761 13.2761 14 13 14H2C1.72386 14 1.5 13.7761 1.5 13.5Z"
                                        fill="currentColor"
                                    />
                                </svg>
                                <h3 className="text-sm font-medium text-[var(--color-foreground)]">
                                    AI-Powered Assistant
                                </h3>
                            </div>
                            <p className="text-sm text-[var(--color-gray-400)]">
                                I'm here to help you with tasks, answer questions, and provide assistance.
                                Feel free to ask me anything!
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-[var(--color-border)]">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
