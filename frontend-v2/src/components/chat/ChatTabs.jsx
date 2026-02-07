import { useTabsStore, useChatStore } from '../../stores';
import { Button, Avatar } from '../ui';
import { cn } from '../../lib/utils';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export function ChatTabs() {
    const { tabs, activeTabId, setActiveTab, closeTab } = useTabsStore();

    if (tabs.length === 0) return null;

    return (
        <div className="flex h-12 bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border)] overflow-x-auto no-scrollbar scroll-smooth">
            <AnimatePresence mode="popLayout">
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                        <Motion.div
                            key={tab.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                "flex items-center min-w-[120px] max-w-[240px] px-3 gap-2 border-r border-[var(--color-border)] cursor-pointer transition-all hover:bg-[var(--color-border)]/50",
                                isActive
                                    ? "bg-[var(--color-background)] border-b-2 border-b-[var(--color-primary)] shadow-sm"
                                    : "text-[var(--color-gray-500)]"
                            )}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.type === 'direct' ? (
                                <Avatar src={tab.avatar} name={tab.title} size="xs" />
                            ) : (
                                <div className="w-5 h-5 rounded-md bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] text-[10px] font-bold">
                                    🟢
                                </div>
                            )}
                            <span className="text-sm font-medium truncate flex-1">
                                {tab.title}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const wasActive = tab.id === useTabsStore.getState().activeTabId;
                                    closeTab(tab.id);
                                    
                                    // If we closed the active tab and there are no tabs left, clear the main active conversation
                                    if (wasActive && !useTabsStore.getState().activeTabId) {
                                        useChatStore.getState().clearActiveConversation();
                                    }

                                    toast.success(<b>Chat closed!</b>, {
                                        position: 'top-center',
                                    });
                                }}
                                className="p-0.5 rounded-full hover:bg-[var(--color-border)] text-[var(--color-gray-500)]"
                            >
                                <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                            </button>
                        </Motion.div>
                    );
                })}
            </AnimatePresence>

            {tabs.length > 1 && (
                <div className="flex items-center px-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            useTabsStore.getState().closeAllTabs();
                            useChatStore.getState().clearActiveConversation();
                            toast.success(<b>All chats closed!</b>, {
                                position: 'top-center',
                            });
                        }}
                        className="text-xs"
                    >
                        Close All
                    </Button>
                </div>
            )}
        </div>
    );
}

