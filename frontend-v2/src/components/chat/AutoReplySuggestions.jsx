import { useQuery } from '@tanstack/react-query';
import { aiService } from '../../services';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores';

export function AutoReplySuggestions({ conversationId, messageId, messageContent, senderId, onSend }) {
    const { showAISuggestions } = useUIStore();

    const { data: suggestions, isLoading } = useQuery({
        queryKey: ['autoReplies', conversationId, messageId],
        queryFn: () => aiService.generateAutoReplies({
            messageId,
            content: messageContent,
            senderId,
        }),
        enabled: !!messageId && !!messageContent && !!conversationId && showAISuggestions,
        staleTime: 5 * 60 * 1000,
    });

    if (!messageId || !messageContent || !conversationId || !showAISuggestions) return null;

    const replies = suggestions?.suggested_replies || [];

    const filteredReplies = replies.filter(reply => {
        const words = reply.trim().split(/\s+/);
        return words.length >= 2;
    });

    if (filteredReplies.length === 0 && !isLoading) return null;

    return (
        <div className={cn("absolute bottom-full left-0 right-0 z-50 mb-[6px] p-1 rounded-xl transition-all duration-300",
            "bg-[var(--color-background)]/80 backdrop-blur-md border border-[var(--color-border)] shadow-xl")}>

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
        </div>
    );
}
