import { useState, lazy, Suspense } from 'react';
import { useAuthStore, useChatStore, useTabsStore, useUIStore } from '../../stores';
import { cn } from '../../lib/utils';
import { Avatar, Button, SimpleDropdown, SimpleDropdownItem } from '../ui';
import {
    AppShell,
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    ChatWindow,
    ChatWindowHeader,
    ChatWindowContent,
    ChatWindowFooter,
} from '../layout';
import {
    ConversationList,
    MessageList,
    MessageInput,
    ChatHeader,
    ChatTabs,
} from '../chat';
import { CallLogs } from '../calls';
import { AIAssistantButton } from './AIAssistantButton';

const NewChatModal = lazy(() => import('./NewChatModal').then(m => ({ default: m.NewChatModal })));
const NewGroupModal = lazy(() => import('./NewGroupModal').then(m => ({ default: m.NewGroupModal })));
const SettingsModal = lazy(() => import('./SettingsModal').then(m => ({ default: m.SettingsModal })));

export function ChatInterface() {
    const { user, logout } = useAuthStore();
    const { activeConversationId } = useChatStore();
    const { tabs, getActiveTab } = useTabsStore();
    const { isSidebarCollapsed, activeView } = useUIStore();
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showNewGroupModal, setShowNewGroupModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    const activeTab = getActiveTab();
    const displayConversationId = activeTab?.conversationId || activeConversationId;

    return (
        <>
            <AppShell
                sidebar={
                    <Sidebar>
                        <SidebarHeader>
                            <div
                                className={cn(
                                    "flex items-center gap-3 flex-1 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors",
                                    isSidebarCollapsed && "justify-center px-0"
                                )}
                                onClick={() => setShowSettingsModal(true)}
                                title="Edit Profile"
                            >
                                <Avatar
                                    src={user?.avatarUrl}
                                    name={user?.username}
                                    size="sm"
                                    online={true}
                                />
                                {!isSidebarCollapsed && (
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-semibold text-[var(--color-foreground)] truncate text-sm">
                                            {user?.username}
                                        </h2>
                                        <p className="text-xs text-[var(--color-gray-500)] truncate">Online</p>
                                    </div>
                                )}
                            </div>

                            {/* Call Logs Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    const { setActiveView } = useUIStore.getState();
                                    setActiveView(activeView === 'calls' ? 'chat' : 'calls');
                                }}
                                title={activeView === 'calls' ? 'Back to Chat' : 'Call Logs'}
                                className={cn(
                                    "transition-colors",
                                    activeView === 'calls' && "bg-blue-500/10 text-blue-500"
                                )}
                            >
                                {activeView === 'calls' ? (
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 15 15"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M6.85355 3.14645C7.04882 3.34171 7.04882 3.65829 6.85355 3.85355L3.70711 7H12.5C12.7761 7 13 7.22386 13 7.5C13 7.77614 12.7761 8 12.5 8H3.70711L6.85355 11.1464C7.04882 11.3417 7.04882 11.6583 6.85355 11.8536C6.65829 12.0488 6.34171 12.0488 6.14645 11.8536L2.14645 7.85355C1.95118 7.65829 1.95118 7.34171 2.14645 7.14645L6.14645 3.14645C6.34171 2.95118 6.65829 2.95118 6.85355 3.14645Z"
                                            fill="currentColor"
                                            fillRule="evenodd"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                )}
                            </Button>
                        </SidebarHeader>

                        <div className={cn("p-4 border-b border-[var(--color-border)] space-y-3", isSidebarCollapsed && "px-2")}>
                            <SimpleDropdown
                                trigger={
                                    <Button variant="default" className="w-full" size={isSidebarCollapsed ? "icon" : "default"}>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 15 15"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={isSidebarCollapsed ? "" : "mr-2"}
                                        >
                                            <path
                                                d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z"
                                                fill="currentColor"
                                                fillRule="evenodd"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {!isSidebarCollapsed && "New Chat"}
                                    </Button>
                                }
                                align="start"
                            >
                                <SimpleDropdownItem
                                    onClick={() => setShowNewChatModal(true)}
                                    icon={
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 15 15"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.50203 5.49797 8.125 7.5 8.125C9.50203 8.125 11.125 6.50203 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM0.875 13C0.875 10.7909 2.66586 9 4.875 9H10.125C12.3341 9 14.125 10.7909 14.125 13C14.125 13.5523 13.6773 14 13.125 14H1.875C1.32272 14 0.875 13.5523 0.875 13Z"
                                                fill="currentColor"
                                            />
                                        </svg>
                                    }
                                >
                                    Direct Message
                                </SimpleDropdownItem>
                                <SimpleDropdownItem
                                    onClick={() => setShowNewGroupModal(true)}
                                    icon={
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 15 15"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                d="M4.5 1C4.22386 1 4 1.22386 4 1.5C4 1.77614 4.22386 2 4.5 2H12.5C12.7761 2 13 1.77614 13 1.5C13 1.22386 12.7761 1 12.5 1H4.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H14.5C14.7761 3 15 3.22386 15 3.5C15 3.77614 14.7761 4 14.5 4H2.5C2.22386 4 2 3.77614 2 3.5ZM0 6.5C0 6.22386 0.223858 6 0.5 6H14.5C14.7761 6 15 6.22386 15 6.5C15 6.77614 14.7761 7 14.5 7H0.5C0.223858 7 0 6.77614 0 6.5ZM0 9.5C0 9.22386 0.223858 9 0.5 9H14.5C14.7761 9 15 9.22386 15 9.5C15 9.77614 14.7761 10 14.5 10H0.5C0.223858 10 0 9.77614 0 9.5ZM2 12.5C2 12.2239 2.22386 12 2.5 12H14.5C14.7761 12 15 12.2239 15 12.5C15 12.7761 14.7761 13 14.5 13H2.5C2.22386 13 2 12.7761 2 12.5ZM4.5 14C4.22386 14 4 14.2239 4 14.5C4 14.7761 4.22386 15 4.5 15H12.5C12.7761 15 13 14.7761 13 14.5C13 14.2239 12.7761 14 12.5 14H4.5Z"
                                                fill="currentColor"
                                                fillRule="evenodd"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    }
                                >
                                    New Group
                                </SimpleDropdownItem>
                            </SimpleDropdown>

                            <AIAssistantButton compact={isSidebarCollapsed} />
                        </div>

                        <SidebarContent>
                            <ConversationList />
                        </SidebarContent>

                        <SidebarFooter>
                            <Button
                                variant="ghost"
                                size={isSidebarCollapsed ? "icon" : "sm"}
                                className={cn("justify-start", isSidebarCollapsed && "w-10 h-10")}
                                onClick={logout}
                                title="Logout"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 15 15"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={isSidebarCollapsed ? "" : "mr-2"}
                                >
                                    <path
                                        d="M3 1C2.44771 1 2 1.44772 2 2V13C2 13.5523 2.44772 14 3 14H10.5C10.7761 14 11 13.7761 11 13.5C11 13.2239 10.7761 13 10.5 13H3V2L10.5 2C10.7761 2 11 1.77614 11 1.5C11 1.22386 10.7761 1 10.5 1H3ZM12.6036 4.89645C12.4083 4.70118 12.0917 4.70118 11.8964 4.89645C11.7012 5.09171 11.7012 5.40829 11.8964 5.60355L13.2929 7H6.5C6.22386 7 6 7.22386 6 7.5C6 7.77614 6.22386 8 6.5 8H13.2929L11.8964 9.39645C11.7012 9.59171 11.7012 9.90829 11.8964 10.1036C12.0917 10.2988 12.4083 10.2988 12.6036 10.1036L14.8536 7.85355C15.0488 7.65829 15.0488 7.34171 14.8536 7.14645L12.6036 4.89645Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                {!isSidebarCollapsed && "Logout"}
                            </Button>
                        </SidebarFooter>
                    </Sidebar>
                }
            >
                < ChatWindow >
                    {activeView === 'calls' ? (
                        <>
                            <ChatWindowHeader>
                                <div className="flex items-center gap-3 px-4">
                                    <h1 className="text-lg font-semibold text-[var(--color-foreground)]">
                                        Call Logs
                                    </h1>
                                </div>
                            </ChatWindowHeader>
                            <CallLogs />
                        </>
                    ) : (
                        <>
                            {tabs.length > 0 && <ChatTabs />}

                            {
                                displayConversationId ? (
                                    <>
                                        <ChatWindowHeader>
                                            <ChatHeader />
                                        </ChatWindowHeader>

                                        <ChatWindowContent>
                                            <MessageList key={displayConversationId} conversationId={displayConversationId} />
                                        </ChatWindowContent>

                                        <ChatWindowFooter>
                                            <MessageInput conversationId={displayConversationId} />
                                        </ChatWindowFooter>
                                    </>
                                ) : null
                            }
                        </>
                    )}
                </ChatWindow >
            </AppShell >

            < Suspense fallback={null} >
                <NewChatModal
                    open={showNewChatModal}
                    onOpenChange={setShowNewChatModal}
                />
                <NewGroupModal
                    open={showNewGroupModal}
                    onOpenChange={setShowNewGroupModal}
                />
                <SettingsModal
                    key={showSettingsModal}
                    open={showSettingsModal}
                    onOpenChange={setShowSettingsModal}
                />
            </Suspense >
        </>
    );
}
