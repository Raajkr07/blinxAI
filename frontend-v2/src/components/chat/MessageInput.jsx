import { useState, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { chatService, aiService } from '../../services';
import { socketService } from '../../services/socketService';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore, useChatStore, useUIStore } from '../../stores';
import { Button, Textarea } from '../ui';
import { AutoReplySuggestions } from './AutoReplySuggestions';
import { generateId } from '../../lib/utils';
import toast from 'react-hot-toast';

export function MessageInput({ conversationId }) {
    const [message, setMessage] = useState('');
    const user = useAuthStore((state) => state.user);
    const { addOptimisticMessage, removeOptimisticMessage, liveMessages } = useChatStore();

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
        if (!user) return null;

        const history = Array.isArray(messagesPage)
            ? messagesPage
            : messagesPage?.content || [];

        const live = liveMessages[conversationId] || [];

        // Combine and find latest non-own message
        const allMessages = [...history, ...live];

        return allMessages
            .filter(msg =>
                msg.senderId?.toString() !== user.id?.toString() &&
                msg.senderId !== 'me'
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }, [messagesPage, liveMessages, conversationId, user]);

    // Check if this is an AI conversation
    const isAiChat = aiConversation?.id && conversationId === aiConversation.id;

    const sendMessageMutation = useMutation({
        mutationFn: async ({ body, tempId }) => {
            const destination = isAiChat ? '/app/ai.chat' : '/app/chat.sendMessage';
            const payload = { conversationId, body };

            try {
                if (!socketService.connected) {
                    // Race against a timeout so the mutation doesn't hang forever
                    // when the server is completely unreachable
                    await Promise.race([
                        socketService.connect(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout')), 5000))
                    ]).catch(() => {});
                }

                const sent = socketService.send(destination, payload);

                if (sent) {
                    // Remove from pending outbox since sent (keep in optimisticMessages
                    // until server echoes back via WebSocket)
                    const state = useChatStore.getState();
                    if (state.pendingOutbox?.[tempId]) {
                        const newOutbox = { ...state.pendingOutbox };
                        delete newOutbox[tempId];
                        useChatStore.setState({ pendingOutbox: newOutbox });
                    }
                }
                // If not sent, message stays in outbox for App.jsx retry
            } catch (error) {
                console.warn('Network offline or backend down, message queued:', error);
                // Do NOT throw error, we want it to stay in optimistic and pendingOutbox
            }
        },
        onMutate: async ({ body, tempId }) => {
            const optimisticMessage = {
                id: tempId,
                conversationId,
                body,
                createdAt: new Date().toISOString(),
                senderId: user?.id || 'me',
                seen: false,
                deleted: false,
            };
            const destination = isAiChat ? '/app/ai.chat' : '/app/chat.sendMessage';
            const payload = { conversationId, body };

            addOptimisticMessage(tempId, optimisticMessage, destination, payload);

            return { tempId };
        },
        onSuccess: () => {
            // handled automatically via websocket
        },
        onError: (error, variables, context) => {
            if (context?.tempId) {
                removeOptimisticMessage(context.tempId);
            }
            toast.error('Failed to send message');
        },
    });

    // Focus management
    const inputRef = useRef(null);

    useEffect(() => {
        // Auto-focus the input whenever the conversation changes
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [conversationId]);

    const { openModal } = useUIStore();

    const handleSubmit = (e) => {
        e.preventDefault();

        const trimmedMessage = message.trim();
        if (!trimmedMessage) return;

        // Slash command handling
        if (trimmedMessage.startsWith('/')) {
            const [command, ...args] = trimmedMessage.split(' ');

            if (command === '/email') {
                // Usage: /email rk82100@example.com subject body
                if (args.length < 3) {
                    toast.error('Usage: /email <to> <subject> <body>');
                    return;
                }
                const to = args[0];
                const subject = args[1];
                const body = args.slice(2).join(' ');

                openModal('emailPreview', { to, subject, body });
                setMessage('');
                return;
            }

            if (command === '/save') {
                // Usage: /save filename.txt content
                if (args.length < 2) {
                    toast.error('Usage: /save <filename> <content>');
                    return;
                }
                const fileName = args[0];
                const content = args.slice(1).join(' ');

                openModal('filePermission', { fileName, content, location: 'Desktop' });
                setMessage('');
                return;
            }
        }

        // Clear input immediately for better responsiveness
        setMessage('');
        const tempId = `temp-${generateId()}`;
        sendMessageMutation.mutate({ body: trimmedMessage, tempId });

        // Ensure focus returns to input after sending
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 0);
    };

    const handleSuggestionSelect = (suggestion) => {
        const tempId = `temp-${generateId()}`;
        sendMessageMutation.mutate({ body: suggestion, tempId });
        // Regain focus after selecting a suggestion
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 0);
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
        <div className="relative w-full">
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
                        ref={inputRef}
                        id="message-input"
                        name="message"
                        value={message}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder="Type a message..."
                        className="min-h-12 h-12"
                    />
                </div>
                <Button
                    type="submit"
                    variant="default"
                    disabled={!message.trim()}
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
