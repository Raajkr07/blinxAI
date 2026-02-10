import { useQuery } from '@tanstack/react-query';
import { aiService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore, useTabsStore, useUIStore } from '../../stores';
import { Button, AILogo } from '../ui';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export function AIAssistantButton({ compact }) {
    const { setActiveConversation } = useChatStore();
    const { openTab } = useTabsStore();
    const { openModal } = useUIStore();

    const { data: aiConversation, isLoading } = useQuery({
        queryKey: queryKeys.aiConversation,
        queryFn: aiService.getAiConversation,
        staleTime: Infinity,
    });

    const handleOpenAI = () => {
        if (aiConversation?.id) {
            const promise = new Promise((resolve) => setTimeout(resolve, 1000));

            toast.promise(
                promise,
                {
                    loading: 'Opening...',
                    success: <b>Here I am, grateful for you! 💖</b>,
                    error: <b>I am deeply sorry... all connections are lost. 🥀</b>,
                },
                {
                    position: 'top-center',
                }
            );

            promise.then(() => {
                // Open AI conversation in its own tab
                openTab(aiConversation);
                setActiveConversation(aiConversation.id);
            });
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        openModal('settings');
    };

    return (
        <Button
            variant="glass"
            size={compact ? "icon" : "sm"}
            onClick={handleOpenAI}
            onContextMenu={handleContextMenu}
            disabled={isLoading || !aiConversation}
            className={cn(
                'justify-start',
                'hover-glow',
                'h-12',
                compact ? 'w-10 justify-center' : 'w-full'
            )}
            title="AI Assistant"
        >
            <AILogo className={cn(compact ? "w-5 h-5" : "w-5 h-5 mr-2")} />

            {!compact && (
                <>
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium">AI Assistant</div>
                        <div className="text-xs text-[var(--color-gray-400)]">your 2nd 🧠</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-foreground)]/10 text-[var(--color-foreground)]">
                        AI
                    </span>
                </>
            )}
        </Button>
    );
}
