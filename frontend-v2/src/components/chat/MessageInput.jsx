import { useState, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { chatService, socketService, aiService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore, useChatStore } from '../../stores';
import { Button, Textarea } from '../ui';
import { AutoReplySuggestions } from './AutoReplySuggestions';
import { generateId } from '../../lib/utils';
import toast from 'react-hot-toast';

export function MessageInput({ conversationId }) {
    const [message, setMessage] = useState('');
    const user = useAuthStore((state) => state.user);
    const { addOptimisticMessage, removeOptimisticMessage } = useChatStore();

    // Typing indicator refs
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    // Cleanup typing timer on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    const { data: messagesPage } = useQuery({
        queryKey: queryKeys.messages(conversationId, 0),
        queryFn: () => chatService.getMessages(conversationId, 0, 50),
        enabled: !!conversationId,
        staleTime: 5000,
    });

    const { data: aiConversation } = useQuery({
        queryKey: queryKeys.aiConversation,
        queryFn: aiService.getAiConversation,
        staleTime: Infinity,
    });

    const lastReceivedMessage = useMemo(() => {
        if (!messagesPage || !user) return null;

        const messages = Array.isArray(messagesPage)
            ? messagesPage
            : messagesPage.content || [];

        return messages
            .filter(msg => msg.senderId !== user.id && msg.senderId !== 'me')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }, [messagesPage, user]);

    // Check if this is an AI conversation
    const isAiChat = aiConversation?.id && conversationId === aiConversation.id;

    const sendMessageMutation = useMutation({
        mutationFn: async (body) => {
            // Use local check or closure variable. Closure variable 'isAiChat' is defined at line 55.
            if (!isAiChat && !socketService.connected) {
                await socketService.connect();
            }

            const destination = isAiChat ? '/app/ai.chat' : '/app/chat.sendMessage';

            const payload = { conversationId, body };

            socketService.send(destination, payload);
        },
        onMutate: async (body) => {
            const tempId = `temp-${generateId()}`;
            const optimisticMessage = {
                id: tempId,
                conversationId,
                body,
                createdAt: new Date().toISOString(),
                senderId: user?.id || 'me',
                seen: false,
                deleted: false,
            };

            addOptimisticMessage(tempId, optimisticMessage);

            return { tempId };
        },
        onSuccess: () => {
            // Don't invalidate queries - WebSocket will handle real-time updates
            // Invalidating causes refetch which can create duplicates
        },
        onError: (error, variables, context) => {
            if (context?.tempId) {
                removeOptimisticMessage(context.tempId);
            }
            toast.error('Failed to send message');
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        const trimmedMessage = message.trim();
        if (!trimmedMessage) return;

        sendMessageMutation.mutate(trimmedMessage);
        setMessage('');
    };

    const handleSuggestionSelect = (suggestion) => {
        sendMessageMutation.mutate(suggestion);
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setMessage(newValue);

        // Typing indicator logic
        if (!isAiChat && socketService.connected) {
            if (!isTypingRef.current) {
                isTypingRef.current = true;
                socketService.send('/app/chat.typing', { conversationId, typing: true });
            }

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
                socketService.send('/app/chat.typing', { conversationId, typing: false });
            }, 2000);
        }
    };

    return (
        <div className="space-y-2">
            {/* Only show suggestions for non-AI conversations */}
            {!isAiChat && lastReceivedMessage && (
                <AutoReplySuggestions
                    conversationId={conversationId}
                    messageId={lastReceivedMessage.id}
                    messageContent={lastReceivedMessage.body}
                    senderId={lastReceivedMessage.senderId}
                    onSend={handleSuggestionSelect}
                    className="mb-2"
                />
            )}

            <form onSubmit={handleSubmit} className="flex gap-3">
                <div className="flex-1">
                    <Textarea
                        value={message}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder="Type a message..."
                        disabled={sendMessageMutation.isPending}
                        className="h-12 min-h-[48px]"
                    />
                </div>
                <Button
                    type="submit"
                    variant="default"
                    disabled={!message.trim() || sendMessageMutation.isPending}
                    loading={sendMessageMutation.isPending}
                    className="h-12"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 15 15"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M1.20308 1.04312C1.00481 0.954998 0.772341 1.0048 0.627577 1.16641C0.482813 1.32802 0.458794 1.56455 0.568117 1.75196L3.92115 7.50002L0.568117 13.2481C0.458794 13.4355 0.482813 13.672 0.627577 13.8336C0.772341 13.9952 1.00481 14.045 1.20308 13.9569L14.7031 7.95693C14.8836 7.87668 15 7.69762 15 7.50002C15 7.30243 14.8836 7.12337 14.7031 7.04312L1.20308 1.04312ZM4.84553 7.10002L2.21234 2.586L13.2689 7.50002L2.21234 12.414L4.84552 7.90002H9C9.22092 7.90002 9.4 7.72094 9.4 7.50002C9.4 7.27911 9.22092 7.10002 9 7.10002H4.84553Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        />
                    </svg>
                </Button>
            </form>
        </div>
    );
}
