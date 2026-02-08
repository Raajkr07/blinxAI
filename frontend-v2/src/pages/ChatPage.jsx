import { useState, lazy, Suspense, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore, useChatStore, useTabsStore, useUIStore } from '../stores';
import { socketService } from '../services';
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
} from '../components/chat';
import { CallLogs } from '../components/calls';
import { FilePermissionModal } from '../components/chat/FilePermissionModal';
import { EmailPreviewModal } from '../components/chat/EmailPreviewModal';
import { AIAssistantButton } from '../components/chat/AIAssistantButton';

const NewChatModal = lazy(() => import('../components/chat/NewChatModal').then(m => ({ default: m.NewChatModal })));
const NewGroupModal = lazy(() => import('../components/chat/NewGroupModal').then(m => ({ default: m.NewGroupModal })));
const SettingsModal = lazy(() => import('../components/chat/SettingsModal').then(m => ({ default: m.SettingsModal })));

const ChatPage = () => {
    const { user, logout } = useAuthStore();
    const { activeConversationId } = useChatStore();
    const { tabs, getActiveTab } = useTabsStore();
    const { isSidebarCollapsed, activeView, setActiveView } = useUIStore();

    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showNewGroupModal, setShowNewGroupModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [filePermissionRequest, setFilePermissionRequest] = useState(null);
    const [emailPreviewRequest, setEmailPreviewRequest] = useState(null);

    useEffect(() => {
        let sub;
        if (!user?.id) return;

        const initSocket = async () => {
            try {
                await socketService.connect();
                sub = socketService.subscribe(`/topic/user/${user.id}/actions`, (message) => {
                    const payload = message.payload || message;
                    if (message.type === 'SAVE_FILE_REQUEST' || (message.fileName && message.content)) {
                        toast.success('File request received');
                        setFilePermissionRequest(payload);
                    } else if (message.type === 'SEND_EMAIL_REQUEST') {
                        toast.success('Email draft received');
                        setEmailPreviewRequest(payload);
                    }
                });
            } catch {
                toast.error('Real-time connection failed');
            }
        };

        initSocket();
        return () => sub?.unsubscribe();
    }, [user?.id]);

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
                                    "flex items-center gap-3 flex-1 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors",
                                    isSidebarCollapsed && "justify-center px-0"
                                )}
                                onClick={() => setShowSettingsModal(true)}
                            >
                                <Avatar src={user?.avatarUrl} name={user?.username} size="sm" online />
                                {!isSidebarCollapsed && (
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-semibold text-sm truncate">{user?.username}</h2>
                                        <p className="text-xs text-slate-500">Online</p>
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleCallsView}
                                className={cn(activeView === 'calls' && "bg-blue-500/10 text-blue-500")}
                            >
                                {activeView === 'calls' ? <BackIcon /> : <PhoneIcon />}
                            </Button>
                        </SidebarHeader>

                        <div className={cn("p-4 border-b border-white/5 space-y-3", isSidebarCollapsed && "px-2")}>
                            <SimpleDropdown
                                trigger={
                                    <Button variant="default" className="w-full" size={isSidebarCollapsed ? "icon" : "default"}>
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
                                onClick={() => {
                                    logout();
                                    toast.success("Signed out");
                                }}
                            >
                                <LogoutIcon className={isSidebarCollapsed ? "" : "mr-2"} />
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
                        <>
                            {tabs.length > 0 && <ChatTabs />}
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
                    )}
                </ChatWindow>
            </AppShell>

            <Suspense fallback={null}>
                <NewChatModal open={showNewChatModal} onOpenChange={setShowNewChatModal} />
                <NewGroupModal open={showNewGroupModal} onOpenChange={setShowNewGroupModal} />
                <SettingsModal open={showSettingsModal} onOpenChange={setShowSettingsModal} />
            </Suspense>

            <FilePermissionModal
                isOpen={!!filePermissionRequest}
                fileInfo={filePermissionRequest}
                onApprove={() => setFilePermissionRequest(null)}
                onDeny={() => setFilePermissionRequest(null)}
                onClose={() => setFilePermissionRequest(null)}
            />

            <EmailPreviewModal
                isOpen={!!emailPreviewRequest}
                emailInfo={emailPreviewRequest}
                onApprove={() => setEmailPreviewRequest(null)}
                onDeny={() => setEmailPreviewRequest(null)}
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

export default ChatPage;
