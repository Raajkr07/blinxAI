import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, chatApi } from '../../api';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore } from '../../stores';
import { Modal, ModalFooter, Button, Input, Avatar, EmptyState, NoSearchResultsIcon } from '../ui';
import { cn, debounce } from '../../lib/utils';
import toast from 'react-hot-toast';



export function NewChatModal({ open, onOpenChange }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const { setActiveConversation } = useChatStore();
    const queryClient = useQueryClient();



    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['userSearch', searchQuery],
        queryFn: () => userApi.searchUsers(searchQuery),
        enabled: searchQuery.length > 0,
        staleTime: 30000,
    });



    const createChatMutation = useMutation({
        mutationFn: (userContact) => chatApi.createDirectChat(userContact),
        onSuccess: (conversation) => {
            toast.success('Chat created successfully');
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            setActiveConversation(conversation.id);
            onOpenChange(false);
            resetModal();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to create chat');
        },
    });

    const handleSearch = debounce((value) => {
        setSearchQuery(value);
    }, 300);

    const handleCreateChat = () => {
        if (!selectedUser) {
            toast.error('Please select a user');
            return;
        }

        const userContact = selectedUser.username || selectedUser.id;
        createChatMutation.mutate(userContact);
    };

    const resetModal = () => {
        setSearchQuery('');
        setSelectedUser(null);
    };

    const handleClose = () => {
        onOpenChange(false);
        resetModal();
    };

    return (
        <Modal
            open={open}
            onOpenChange={handleClose}
            title="New Chat"
            description="Search for a user to start a conversation"
            size="md"
        >
            <div className="space-y-4">
                <Input
                    placeholder="Search by username, phone, or email..."
                    onChange={(e) => handleSearch(e.target.value)}
                    leftIcon={
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 15 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                            />
                        </svg>
                    }
                />



                <div className="max-h-96 overflow-y-auto">
                    {isSearching && (
                        <div className="text-center py-8 text-gray-400">
                            Searching...
                        </div>
                    )}

                    {!isSearching && searchQuery && searchResults?.length === 0 && (
                        <EmptyState
                            icon={<NoSearchResultsIcon />}
                            title="No users found"
                            description="Try searching with a different query"
                        />
                    )}

                    {!isSearching && searchResults && searchResults.length > 0 && (
                        <div className="space-y-1">
                            {searchResults.map((user) => (
                                <UserSearchItem
                                    key={user.id}
                                    user={user}
                                    isSelected={selectedUser?.id === user.id}
                                    onClick={() => setSelectedUser(user)}
                                />
                            ))}
                        </div>
                    )}

                    {!searchQuery && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                            Start typing to search for users
                        </div>
                    )}
                </div>
            </div>

            <ModalFooter>
                <Button variant="outline" onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    variant="default"
                    onClick={handleCreateChat}
                    disabled={!selectedUser || createChatMutation.isPending}
                    loading={createChatMutation.isPending}
                >
                    Start Chat
                </Button>
            </ModalFooter>
        </Modal>
    );
}



function UserSearchItem({ user, isSelected, onClick }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full px-4 py-3 flex items-center gap-3',
                'hover:bg-gray-900 transition-colors rounded-lg',
                'text-left',
                isSelected && 'bg-gray-900 ring-2 ring-white'
            )}
        >
            <Avatar
                src={user.avatarUrl}
                name={user.username || user.displayName}
                size="md"
                online={user.online}
            />

            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">
                    {user.username || user.displayName}
                </h3>
                {user.maskedPhone && (
                    <p className="text-sm text-gray-400 truncate">
                        {user.maskedPhone}
                    </p>
                )}
            </div>

            {user.contact && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                    Contact
                </span>
            )}
        </button>
    );
}
