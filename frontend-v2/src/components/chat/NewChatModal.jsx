import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService, userService } from '../../services';
import { useChatStore, useTabsStore } from '../../stores';
import { Modal, ModalFooter, Button, Input, Avatar } from '../ui';
import toast from 'react-hot-toast';
import { reportErrorOnce } from '../../lib/reportError';

export function NewChatModal({ open, onOpenChange }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const { setActiveConversation } = useChatStore();
    const { openTab } = useTabsStore();
    const queryClient = useQueryClient();

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const results = await userService.searchUsers(query);
            setSearchResults(results);
        } catch (error) {
            reportErrorOnce('user-search', error, 'Search failed');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const createChatMutation = useMutation({
        mutationFn: (contactId) => chatService.createDirectChat(contactId),
        onSuccess: (conversation) => {
            queryClient.invalidateQueries(['conversations']);
            openTab(conversation);
            setActiveConversation(conversation.id);
            onOpenChange(false);
            setSearchQuery('');
            setSearchResults([]);
            toast.success('Chat created');
        },
        onError: () => {
            toast.error('Failed to create chat');
        }
    });

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="New Conversation"
            description="Search for a user to start chatting"
            size="md"
        >
            <div className="flex flex-col flex-1 min-h-0 space-y-4 py-2">
                <div>
                    <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1.5 block px-1">
                        Search Users
                    </label>
                    <Input
                        placeholder="Type a name or email…"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="bg-white/[0.03] border-white/5 focus:border-blue-500/40 h-10"
                        autoFocus
                        leftIcon={
                            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="text-[var(--color-gray-500)]">
                                <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                            </svg>
                        }
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 min-h-[200px]">
                    {isSearching ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mb-2" />
                            <span className="text-[10px] font-medium text-[var(--color-gray-500)]">Searching…</span>
                        </div>
                    ) : searchResults.length > 0 ? (
                        searchResults.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => createChatMutation.mutate(user.id)}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/20 hover:bg-white/[0.04] transition-all w-full text-left group"
                            >
                                <Avatar src={user.avatarUrl} name={user.username} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-[var(--color-foreground)] truncate group-hover:text-blue-400 transition-colors">
                                        {user.username}
                                    </p>
                                    <p className="text-[10px] text-[var(--color-gray-500)]">
                                        {user.email || 'User'}
                                    </p>
                                </div>
                                <svg width="12" height="12" viewBox="0 0 15 15" fill="none" className="text-[var(--color-gray-500)] group-hover:text-blue-400 transition-colors">
                                    <path d="M6.18194 4.18185C6.35767 4.00611 6.64236 4.00611 6.81809 4.18185L9.81809 7.18185C9.90672 7.27048 9.95652 7.3903 9.95652 7.51497C9.95652 7.63964 9.90672 7.75945 9.81809 7.84809L6.81809 10.8481C6.64236 11.0238 6.35767 11.0238 6.18194 10.8481C6.0062 10.6724 6.0062 10.3877 6.18194 10.2119L8.87891 7.51497L6.18194 4.81809C6.0062 4.64236 6.0062 4.35759 6.18194 4.18185Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                </svg>
                            </button>
                        ))
                    ) : searchQuery ? (
                        <div className="text-center py-12 text-xs text-[var(--color-gray-500)]">
                            No users found
                        </div>
                    ) : (
                        <div className="text-center py-12 text-xs text-[var(--color-gray-500)]">
                            Start typing to search
                        </div>
                    )}
                </div>
            </div>

            <ModalFooter>
                <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    className="text-xs font-medium text-[var(--color-gray-400)]"
                >
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}
