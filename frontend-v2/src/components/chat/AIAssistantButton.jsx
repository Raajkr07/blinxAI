import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore, useTabsStore, useUIStore } from '../../stores';
import { Modal, Button, AILogo } from '../ui';
import { cn } from '../../lib/utils';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export function AIAssistantButton({ compact }) {
    const { setActiveConversation } = useChatStore();
    const { openTab } = useTabsStore();
    const { openModal } = useUIStore();
    const [showCapabilities, setShowCapabilities] = useState(false);

    const { data: aiConversation, isLoading } = useQuery({
        queryKey: queryKeys.aiConversation,
        queryFn: aiService.getAiConversation,
        staleTime: Infinity,
    });

    // Fetch AI capabilities (lazy — only when modal is opened)
    const { data: capabilities, isLoading: isLoadingCapabilities } = useQuery({
        queryKey: ['aiCapabilities'],
        queryFn: aiService.getCapabilities,
        enabled: showCapabilities,
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
        setShowCapabilities(true);
    };

    const capabilitiesList = Array.isArray(capabilities)
        ? capabilities
        : (capabilities?.capabilities || capabilities?.tools || []);

    return (
        <>
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
                title="AI Assistant (right-click for capabilities)"
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

            {/* AI Capabilities Modal */}
            <Modal
                open={showCapabilities}
                onOpenChange={setShowCapabilities}
                title="Blinx AI Capabilities"
                description="Discover what your AI assistant can do"
                size="md"
            >
                <div className="space-y-4 py-2">
                    {isLoadingCapabilities ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 border-3 border-white/5 border-t-blue-500 rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <AILogo className="w-5 h-5 text-blue-400" />
                                </div>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 animate-pulse">
                                Loading capabilities
                            </p>
                        </div>
                    ) : capabilitiesList.length > 0 ? (
                        <div className="grid gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                            <AnimatePresence>
                                {capabilitiesList.map((cap, index) => {
                                    const name = typeof cap === 'string' ? cap : (cap.name || cap.title || `Capability ${index + 1}`);
                                    const description = typeof cap === 'string' ? null : (cap.description || cap.desc);

                                    return (
                                        <Motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.04 }}
                                            className="flex gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 group hover:border-blue-500/20 transition-all"
                                        >
                                            <div className="mt-0.5 w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-[10px] font-black text-blue-400">
                                                    {String(index + 1).padStart(2, '0')}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-[var(--color-foreground)] leading-snug">
                                                    {name}
                                                </p>
                                                {description && (
                                                    <p className="text-[10px] text-[var(--color-gray-500)] mt-1 leading-relaxed">
                                                        {description}
                                                    </p>
                                                )}
                                            </div>
                                        </Motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center">
                                <AILogo className="w-8 h-8 text-[var(--color-gray-500)]" />
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-[var(--color-gray-400)]">Capabilities pending</p>
                                <p className="text-[10px] text-[var(--color-gray-500)] mt-1">
                                    AI capabilities will be available once the system is fully connected.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
}
