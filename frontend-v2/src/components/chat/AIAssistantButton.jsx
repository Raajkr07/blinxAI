import { useQuery } from '@tanstack/react-query';
import { aiApi } from '../../api';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore, useTabsStore, useUIStore } from '../../stores';
import { Button } from '../ui';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export function AIAssistantButton({ compact }) {
    const { setActiveConversation } = useChatStore();
    const { openTab } = useTabsStore();
    const { openModal } = useUIStore();

    const { data: aiConversation, isLoading } = useQuery({
        queryKey: queryKeys.aiConversation,
        queryFn: aiApi.getAiConversation,
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
            <svg
                width="16"
                height="16"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={compact ? "" : "mr-2"}
            >
                <rect
                    x="3"
                    y="2"
                    width="9"
                    height="7"
                    rx="2"
                    fill="currentColor"
                />

                <circle cx="6" cy="5.5" r="0.75" fill="black" />
                <circle cx="9" cy="5.5" r="0.75" fill="black" />

                <path
                    d="M7.5 0.75V2"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                />
                <circle cx="7.5" cy="0.75" r="0.75" fill="currentColor" />

                <path
                    d="M2 13c0-2 2-3.5 5.5-3.5S13 11 13 13v1H2v-1z"
                    fill="currentColor"
                />
            </svg>

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
