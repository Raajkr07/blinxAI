import { useQuery } from '@tanstack/react-query';
import { aiService } from '../../services';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function AutoReplySuggestions({ conversationId, messageId, messageContent, senderId, onSend }) {
    const [isOpen, setIsOpen] = useState(true);
    const { data: suggestions, isLoading } = useQuery({
        queryKey: ['autoReplies', conversationId, messageId],
        queryFn: () => aiService.generateAutoReplies({
            messageId,
            content: messageContent,
            senderId,
        }),
        enabled: !!messageId && !!messageContent && !!conversationId,
        staleTime: 5 * 60 * 1000,
    });

    if (!messageId || !messageContent || !conversationId) return null;

    const toggleOpen = () => {
        const newState = !isOpen;
        setIsOpen(newState);

        if (newState) {
            toast.success(<b>AI assistance engaged! ⚡</b>, {
                position: 'top-center',
                style: { background: 'var(--color-background)', color: 'var(--color-foreground)', border: '1px solid var(--color-primary)' }
            });
        } else {
            toast.success(<b>Suggestions minimized 💤</b>, {
                position: 'top-center',
            });
        }
    };

    const replies = suggestions?.suggested_replies || [];

    // Filter out empty or very short replies (less than 2 words)
    const filteredReplies = replies.filter(reply => {
        const words = reply.trim().split(/\s+/);
        return words.length >= 2;
    });

    if (filteredReplies.length === 0 && !isLoading) return null;

    return (
        <div className="relative group">
            <button
                onClick={toggleOpen}
                className={cn(
                    "absolute -top-3 left-0 z-10 p-1.5 rounded-full shadow-sm transition-all duration-200 border",
                    "bg-[var(--color-background)] text-[var(--color-foreground)] border-[var(--color-border)]",
                    "hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
                    isOpen ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                )}
                title={isOpen ? "Hide Suggestions" : "Show AI Suggestions"}
            >
                {isOpen ? (
                    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                    </svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.15288 4.98124 7.54738 6.49373 8.00685C6.72126 8.07598 6.875 8.28587 6.875 8.52375V10.5C6.875 10.8452 7.15482 11.125 7.5 11.125C7.84518 11.125 8.125 10.8452 8.125 10.5V8.52375C8.125 8.28587 8.27874 8.07598 8.50627 8.00685C10.0188 7.54738 11.125 6.15288 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM3.875 13C3.875 13.5523 4.32272 14 4.875 14H10.125C10.6773 14 11.125 13.5523 11.125 13C11.125 12.4477 10.6773 12 10.125 12H4.875C4.32272 12 3.875 12.4477 3.875 13Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                    </svg>
                )}
            </button>

            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    {isLoading ? (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="px-4 py-2 rounded-full bg-[var(--color-border)] animate-pulse min-w-[120px] h-9"
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-[2px]">
                            {filteredReplies.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => onSend && onSend(suggestion)}
                                    className={cn(
                                        'px-4 py-1 rounded-full whitespace-nowrap',
                                        'bg-[var(--color-border)] text-[var(--color-foreground)]',
                                        'hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)]',
                                        'transition-all',
                                        'border border-[var(--color-border)]',
                                        'flex-shrink-0'
                                    )}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
