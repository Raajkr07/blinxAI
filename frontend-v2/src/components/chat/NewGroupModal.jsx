import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService, chatService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore } from '../../stores';
import { Modal, ModalFooter, Button, Input, Avatar } from '../ui';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';


export function NewGroupModal({ open, onOpenChange }) {
    const [step, setStep] = useState('details'); // 'details' | 'members'
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { setActiveConversation } = useChatStore();
    const queryClient = useQueryClient();


    const { data: searchResults } = useQuery({
        queryKey: ['userSearch', searchQuery],
        queryFn: () => userService.searchUsers(searchQuery),
        enabled: searchQuery.length > 0 && step === 'members',
    });



    const createGroupMutation = useMutation({
        mutationFn: (data) => chatService.createGroup(data.title, data.participantIds),
        onSuccess: (conversation) => {
            toast.success('Group created successfully');
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            setActiveConversation(conversation.id);
            onOpenChange(false);
            resetModal();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to create group');
        },
    });

    const handleNext = () => {
        if (!groupName.trim()) {
            toast.error('Please enter a group name');
            return;
        }
        setStep('members');
    };

    const handleBack = () => {
        setStep('details');
    };

    const handleCreateGroup = () => {
        if (selectedMembers.length === 0) {
            toast.error('Please select at least one member');
            return;
        }

        createGroupMutation.mutate({
            title: groupName,
            participantIds: selectedMembers.map((m) => m.id),
        });
    };

    const toggleMember = (user) => {
        setSelectedMembers((prev) => {
            const exists = prev.find((m) => m.id === user.id);
            if (exists) {
                return prev.filter((m) => m.id !== user.id);
            }
            return [...prev, user];
        });
    };

    const resetModal = () => {
        setStep('details');
        setGroupName('');
        setSelectedMembers([]);
        setSearchQuery('');
    };

    const handleClose = () => {
        onOpenChange(false);
        resetModal();
    };

    return (
        <Modal
            open={open}
            onOpenChange={handleClose}
            title={step === 'details' ? 'New Group' : 'Add Members'}
            description={
                step === 'details'
                    ? 'Create a new group chat'
                    : `${selectedMembers.length} member${selectedMembers.length !== 1 ? 's' : ''} selected`
            }
            size="md"
        >


            {step === 'details' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Group Name *
                        </label>
                        <Input
                            placeholder="Enter group name..."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            maxLength={50}
                        />
                    </div>

                    <ModalFooter>
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button variant="default" onClick={handleNext}>
                            Next
                        </Button>
                    </ModalFooter>
                </div>
            )}

            {step === 'members' && (
                <div className="space-y-4">
                    {selectedMembers.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-3 bg-gray-950 rounded-lg">
                            {selectedMembers.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center gap-2 px-3 py-1 bg-gray-900 rounded-full"
                                >
                                    <Avatar src={member.avatarUrl} name={member.username} size="xs" />
                                    <span className="text-sm text-white">{member.username}</span>
                                    <button
                                        onClick={() => toggleMember(member)}
                                        className="text-gray-400 hover:text-white"
                                    >
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 15 15"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                                                fill="currentColor"
                                                fillRule="evenodd"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}


                    <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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

                    <div className="max-h-64 overflow-y-auto space-y-1">
                        {searchResults?.map((user) => {
                            const isSelected = selectedMembers.some((m) => m.id === user.id);
                            return (
                                <button
                                    key={user.id}
                                    onClick={() => toggleMember(user)}
                                    className={cn(
                                        'w-full px-4 py-3 flex items-center gap-3',
                                        'hover:bg-gray-900 transition-colors rounded-lg',
                                        'text-left',
                                        isSelected && 'bg-gray-900'
                                    )}
                                >
                                    <Avatar
                                        src={user.avatarUrl}
                                        name={user.username}
                                        size="sm"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-white truncate">
                                            {user.username}
                                        </h3>
                                    </div>
                                    {isSelected && (
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 15 15"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="text-white"
                                        >
                                            <path
                                                d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                                                fill="currentColor"
                                                fillRule="evenodd"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <ModalFooter>
                        <Button variant="outline" onClick={handleBack}>
                            Back
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleCreateGroup}
                            disabled={selectedMembers.length === 0 || createGroupMutation.isPending}
                            loading={createGroupMutation.isPending}
                        >
                            Create Group
                        </Button>
                    </ModalFooter>
                </div>
            )}
        </Modal>
    );
}
