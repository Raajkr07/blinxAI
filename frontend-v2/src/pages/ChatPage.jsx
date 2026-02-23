import { useState, lazy, Suspense, useEffect } from 'react';
import toast from 'react-hot-toast';
import { reportErrorOnce } from '../lib/reportError';
import { useAuthStore, useChatStore, useTabsStore, useUIStore } from '../stores';
import { socketService } from '../services/socketService';
import { cn } from '../lib/utils';
import { Avatar, Button, SimpleDropdown, SimpleDropdownItem } from '../components/ui';
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
} from '../components/layout';
import {
    ConversationList,
    MessageList,
    MessageInput,
    ChatHeader,
    ChatTabs,
    FilePermissionModal,
    EmailPreviewModal,
    CalendarPreviewModal,
    AIAssistantButton,
    OnlineUsersPanel,
} from '../components/chat';
import { CallLogs } from '../components/calls';

const NewChatModal = lazy(() => import('../components/chat/NewChatModal').then(m => ({ default: m.NewChatModal })));
const NewGroupModal = lazy(() => import('../components/chat/NewGroupModal').then(m => ({ default: m.NewGroupModal })));
const SettingsModal = lazy(() => import('../components/chat/SettingsModal').then(m => ({ default: m.SettingsModal })));
const BrowseGroupsModal = lazy(() => import('../components/chat/BrowseGroupsModal').then(m => ({ default: m.BrowseGroupsModal })));

const ChatPage = () => {
    const { user, logout } = useAuthStore();
    const { activeConversationId } = useChatStore();
    const { tabs, getActiveTab } = useTabsStore();
    const { isSidebarCollapsed, activeView, setActiveView, openModal, activeModal, modalData, closeModal } = useUIStore();

    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showNewGroupModal, setShowNewGroupModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showBrowseGroupsModal, setShowBrowseGroupsModal] = useState(false);

    useEffect(() => {
        let isCancelled = false;
        let sub = null;

        if (!user?.id) return;

        const initSocket = async () => {
            try {
                // We initiate connection but don't toast on first failure 
                // because socketService has internal auto-reconnect logic.
                await socketService.connect();
                if (isCancelled) return;

                sub = socketService.subscribe(`/topic/user/${user.id}/actions`, (message) => {
                    const payload = message.payload || message;
                    if (message.type === 'SAVE_FILE_REQUEST' || (message.fileName && message.content)) {
                        openModal('filePermission', payload);
                    } else if (message.type === 'SEND_EMAIL_REQUEST') {
                        if (payload.error) {
                            toast.error('Email failed');
                        } else {
                            toast.success('Email sent successfully! 📧');
                        }
                        openModal('emailPreview', payload);
                    } else if (message.type === 'ADD_TO_CALENDAR_REQUEST') {
                        if (payload.error) {
                            toast.error('Calendar sync failed');
                        } else {
                            toast.success('Event added to calendar! 📅');
                        }
                        openModal('calendarPreview', payload);
                    } else if (message.type === 'OPEN_URL') {
                        if (payload && payload.url) {
                            window.open(payload.url, '_blank', 'noopener,noreferrer');
                        }
                    }
                });
            } catch (error) {
                if (!isCancelled) {
                    reportErrorOnce('chat-connect', error, 'Connecting to server failed');
                }
            }
        };

        initSocket();
        return () => {
            isCancelled = true;
            if (sub) {
                sub.unsubscribe();
            }
        };
    }, [user?.id, openModal]);

    const activeTab = getActiveTab();
    const displayConversationId = activeTab?.conversationId || activeConversationId;

    const toggleCallsView = () => setActiveView(activeView === 'calls' ? 'chat' : 'calls');

    return (
        <>
            <AppShell
                sidebar={
                    <Sidebar>
                        <SidebarHeader>
                            <div
                                className={cn(
                                    "flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-lg transition-colors",
                                    isSidebarCollapsed ? "justify-center p-1" : "flex-1 p-2"
                                )}
                                onClick={() => setShowSettingsModal(true)}
                                title={isSidebarCollapsed ? user?.username : undefined}
                            >
                                <Avatar src={user?.avatarUrl} name={user?.username} size="sm" online />
                                {!isSidebarCollapsed && (
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-semibold text-sm truncate">{user?.username}</h2>
                                        <p className="text-xs text-[var(--color-gray-500)]">Online</p>
                                    </div>
                                )}
                            </div>

                            {!isSidebarCollapsed && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleCallsView}
                                    className={cn(activeView === 'calls' && "bg-blue-500/10 text-blue-500")}
                                >
                                    {activeView === 'calls' ? <BackIcon /> : <PhoneIcon />}
                                </Button>
                            )}
                        </SidebarHeader>

                        <div className={cn(
                            "border-b border-white/5 flex flex-col gap-2 transition-all duration-300",
                            isSidebarCollapsed ? "p-2 items-center" : "p-3"
                        )}>
                            <SimpleDropdown
                                trigger={
                                    <Button
                                        variant="default"
                                        className={cn("transition-all duration-300", isSidebarCollapsed ? "h-9 w-9 p-0" : "w-full h-10")}
                                        size="sm"
                                    >
                                        <PlusIcon className={isSidebarCollapsed ? "" : "mr-2"} />
                                        {!isSidebarCollapsed && "New Chat"}
                                    </Button>
                                }
                                align="start"
                            >
                                <SimpleDropdownItem onClick={() => setShowNewChatModal(true)} icon={<UserIcon />}>
                                    Direct Message
                                </SimpleDropdownItem>
                                <SimpleDropdownItem onClick={() => setShowNewGroupModal(true)} icon={<GroupIcon />}>
                                    New Group
                                </SimpleDropdownItem>
                                <SimpleDropdownItem onClick={() => setShowBrowseGroupsModal(true)} icon={<BrowseIcon />}>
                                    Browse Groups
                                </SimpleDropdownItem>
                            </SimpleDropdown>
                            <AIAssistantButton compact={isSidebarCollapsed} />
                        </div>

                        <SidebarContent>
                            <ConversationList />
                        </SidebarContent>

                        <OnlineUsersPanel />

                        <SidebarFooter>
                            <Button
                                id="logout-button"
                                variant="ghost"
                                className={cn(
                                    "transition-all duration-300",
                                    isSidebarCollapsed ? "h-9 w-9 p-0 justify-center" : "w-full h-10 justify-start"
                                )}
                                onClick={async () => {
                                    await logout();
                                    toast.success("Signed out");
                                }}
                                title={isSidebarCollapsed ? "Logout" : undefined}
                            >
                                <LogoutIcon className={cn("transition-all", isSidebarCollapsed ? "" : "mr-2")} />
                                {!isSidebarCollapsed && "Logout"}
                            </Button>
                        </SidebarFooter>
                    </Sidebar>
                }
            >
                <ChatWindow>
                    {activeView === 'calls' ? (
                        <>
                            <ChatWindowHeader>
                                <h1 className="text-lg font-semibold px-4">Call Logs</h1>
                            </ChatWindowHeader>
                            <CallLogs />
                        </>
                    ) : (
                        tabs.length > 0 ? (
                            <>
                                <ChatTabs />
                                {displayConversationId && (
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
                                )}
                            </>
                        ) : null
                    )}
                </ChatWindow>
            </AppShell>

            <Suspense fallback={null}>
                <NewChatModal open={showNewChatModal} onOpenChange={setShowNewChatModal} />
                <NewGroupModal open={showNewGroupModal} onOpenChange={setShowNewGroupModal} />
                <SettingsModal open={showSettingsModal} onOpenChange={setShowSettingsModal} />
                <BrowseGroupsModal open={showBrowseGroupsModal} onOpenChange={setShowBrowseGroupsModal} />
            </Suspense>

            <FilePermissionModal
                isOpen={activeModal === 'filePermission'}
                fileInfo={modalData}
                onApprove={closeModal}
                onDeny={closeModal}
                onClose={closeModal}
            />

            <EmailPreviewModal
                isOpen={activeModal === 'emailPreview'}
                emailInfo={modalData}
                onClose={closeModal}
            />

            <CalendarPreviewModal
                isOpen={activeModal === 'calendarPreview'}
                eventInfo={modalData}
                onClose={closeModal}
            />
        </>
    );
};

const PhoneIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

const BackIcon = () => (
    <svg width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.85355 3.14645C7.04882 3.34171 7.04882 3.65829 6.85355 3.85355L3.70711 7H12.5C12.7761 7 13 7.22386 13 7.5C13 7.77614 12.7761 8 12.5 8H3.70711L6.85355 11.1464C7.04882 11.3417 7.04882 11.6583 6.85355 11.8536C6.65829 12.0488 6.34171 12.0488 6.14645 11.8536L2.14645 7.85355C1.95118 7.65829 1.95118 7.34171 2.14645 7.14645L6.14645 3.14645C6.34171 2.95118 6.65829 2.95118 6.85355 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
);

const PlusIcon = ({ className }) => (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
);

const UserIcon = () => (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.50203 5.49797 8.125 7.5 8.125C9.50203 8.125 11.125 6.50203 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM0.875 13C0.875 10.7909 2.66586 9 4.875 9H10.125C12.3341 9 14.125 10.7909 14.125 13C14.125 13.5523 13.6773 14 13.125 14H1.875C1.32272 14 0.875 13.5523 0.875 13Z" fill="currentColor" />
    </svg>
);

const GroupIcon = () => (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.5 1C4.22386 1 4 1.22386 4 1.5C4 1.77614 4.22386 2 4.5 2H12.5C12.7761 2 13 1.77614 13 1.5C13 1.22386 12.7761 1 12.5 1H4.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H14.5C14.7761 3 15 3.22386 15 3.5C15 3.77614 14.7761 4 14.5 4H2.5C2.22386 4 2 3.77614 2 3.5ZM0 6.5C0 6.22386 0.223858 6 0.5 6H14.5C14.7761 6 15 6.22386 15 6.5C15 6.77614 14.7761 7 14.5 7H0.5C0.223858 7 0 6.77614 0 6.5Z" fill="currentColor" />
    </svg>
);

const LogoutIcon = ({ className }) => (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M3 1C2.44771 1 2 1.44772 2 2V13C2 13.5523 2.44772 14 3 14H10.5C10.7761 14 11 13.7761 11 13.5C11 13.2239 10.7761 13 10.5 13H3V2L10.5 2C10.7761 2 11 1.77614 11 1.5C11 1.22386 10.7761 1 10.5 1H3ZM12.6036 4.89645C12.4083 4.70118 12.0917 4.70118 11.8964 4.89645C11.7012 5.09171 11.7012 5.40829 11.8964 5.60355L13.2929 7H6.5C6.22386 7 6 7.22386 6 7.5C6 7.77614 6.22386 8 6.5 8H13.2929L11.8964 9.39645C11.7012 9.59171 11.7012 9.90829 11.8964 10.1036C12.0917 10.2988 12.4083 10.2988 12.6036 10.1036L14.8536 7.85355C15.0488 7.65829 15.0488 7.34171 14.8536 7.14645L12.6036 4.89645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
);

const BrowseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.5624 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.5624 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
);

export default ChatPage;
