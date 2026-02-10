import { useQuery } from '@tanstack/react-query';
import { chatService, userService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore } from '../../stores';
import { Modal, Avatar, Button, AILogo } from '../ui';

export function ProfileModal({ isOpen, onClose, conversationId, type = 'user' }) {
    const { user: currentUser } = useAuthStore();

    const { data: conversation, isLoading: isLoadingConv } = useQuery({
        queryKey: queryKeys.conversation(conversationId),
        queryFn: () => chatService.getConversation(conversationId),
        enabled: !!conversationId && isOpen,
    });

    const isGroup = type === 'group' || conversation?.type === 'GROUP' || conversation?.type === 'COMMUNITY';
    const isAI = type === 'ai' || conversation?.type === 'AI_ASSISTANT';

    const otherUserId = !isGroup && !isAI && conversation?.participants
        ? conversation.participants.find(id => id !== currentUser?.id)
        : null;

    const { data: userProfile, isLoading: isLoadingUser } = useQuery({
        queryKey: ['user', otherUserId],
        queryFn: () => userService.getUserById(otherUserId),
        enabled: !!otherUserId && isOpen,
    });

    // Fetch all participants for group chats
    const { data: groupParticipants, isLoading: isLoadingParticipants } = useQuery({
        queryKey: ['group-participants', conversationId],
        queryFn: async () => {
            if (!conversation?.participants) return [];

            const participantPromises = conversation.participants.map(async (participantId) => {
                try {
                    const user = await userService.getUserById(participantId);
                    return user;
                } catch (error) {
                    console.error(`Failed to fetch user ${participantId}:`, error);
                    return {
                        id: participantId,
                        username: 'Unknown User',
                        email: null,
                        phone: null,
                    };
                }
            });

            return Promise.all(participantPromises);
        },
        enabled: isGroup && !!conversation?.participants && isOpen,
    });

    const isLoading = isLoadingConv || (!!otherUserId && isLoadingUser) || (isGroup && isLoadingParticipants);

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
                            src={isAI ? 'https://img.freepik.com/free-vector/chatbot-chat-message-vectorart_78370-4104.jpg' : displayData?.avatarUrl}
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

                    {isGroup && groupParticipants && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-[var(--color-gray-500)]">
                                Members ({groupParticipants.length})
                            </h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {groupParticipants.map((participant) => (
                                    <div
                                        key={participant.id}
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
                                                    {participant.username || participant.name || 'Unknown User'}
                                                </p>
                                                {participant.id === currentUser?.id && (
                                                    <span className="text-xs text-[var(--color-primary)] ml-2">
                                                        You
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
                                <AILogo className="w-5 h-5 text-[var(--color-foreground)]" />
                                <h3 className="text-sm font-medium text-[var(--color-foreground)]">
                                    AI & MCP based Assistant
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
