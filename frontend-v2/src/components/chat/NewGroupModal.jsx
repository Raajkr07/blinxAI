import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService, chatService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useChatStore } from '../../stores';
import { Modal, ModalFooter, Button, Input, Avatar } from '../ui';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export function NewGroupModal({ open, onOpenChange }) {
    const [step, setStep] = useState('details');
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { setActiveConversation } = useChatStore();
    const queryClient = useQueryClient();

    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['userSearch', searchQuery],
        queryFn: () => userService.searchUsers(searchQuery),
        enabled: searchQuery.length > 0 && step === 'members',
    });

    const createGroupMutation = useMutation({
        mutationFn: (data) => chatService.createGroup(data.title, data.participantIds),
        onSuccess: (conversation) => {
            toast.success('Group created');
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            setActiveConversation(conversation.id);
            onOpenChange(false);
            resetModal();
        },
        onError: (error) => {
            void error;
            toast.error('Failed to create group');
        },
    });

    const handleNext = () => {
        if (!groupName.trim()) {
            toast.error('Group name required');
            return;
        }
        setStep('members');
    };

    const handleBack = () => setStep('details');

    const handleCreateGroup = () => {
        if (selectedMembers.length === 0) {
            toast.error('Add at least one member');
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
            if (exists) return prev.filter((m) => m.id !== user.id);
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
                    ? 'Create a new group conversation'
                    : `${selectedMembers.length} member${selectedMembers.length !== 1 ? 's' : ''} selected`
            }
            size="md"
        >
            <div className="flex flex-col flex-1 min-h-0 space-y-4 py-2">
                {step === 'details' && (
                    <div className="space-y-5">
                        {/* Group avatar preview */}
                        <div className="flex flex-col items-center py-4 gap-3">
                            <div className="w-20 h-20 rounded-full bg-blue-500/10 border-2 border-dashed border-blue-500/20 flex items-center justify-center text-blue-400">
                                {groupName ? (
                                    <span className="text-2xl font-bold">{groupName[0].toUpperCase()}</span>
                                ) : (
                                    <svg width="24" height="24" viewBox="0 0 15 15" fill="none">
                                        <path d="M7.5 0.875c-3.658 0-6.625 2.967-6.625 6.625s2.967 6.625 6.625 6.625 6.625-2.967 6.625-6.625S11.158 0.875 7.5 0.875z" stroke="currentColor" strokeWidth="1" />
                                    </svg>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                            <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Group Name</label>
                            <Input
                                placeholder="e.g. Design Team"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                maxLength={50}
                                className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {step === 'members' && (
                    <div className="space-y-4">
                        {/* Selected chips */}
                        {selectedMembers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                {selectedMembers.map((member) => (
                                    <div key={member.id} className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                        <Avatar src={member.avatarUrl} name={member.username} size="xs" />
                                        <span className="text-[10px] font-medium text-blue-400">{member.username}</span>
                                        <button onClick={() => toggleMember(member)} className="text-blue-400/60 hover:text-red-400 transition-colors ml-0.5">
                                            <svg width="8" height="8" viewBox="0 0 15 15" fill="none">
                                                <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1.5 block px-1">Search Users</label>
                            <Input
                                placeholder="Type to search…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-white/[0.03] border-white/5 focus:border-blue-500/40 h-10"
                                leftIcon={
                                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="text-[var(--color-gray-500)]">
                                        <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                    </svg>
                                }
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 min-h-[180px]">
                            {isSearching ? (
                                <div className="text-center py-10">
                                    <div className="w-5 h-5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mx-auto mb-2" />
                                    <p className="text-[10px] text-[var(--color-gray-500)]">Searching…</p>
                                </div>
                            ) : searchResults?.length > 0 ? (
                                searchResults.map((user) => {
                                    const isSelected = selectedMembers.some((m) => m.id === user.id);
                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => toggleMember(user)}
                                            className={cn(
                                                'w-full p-3 flex items-center gap-3 rounded-xl transition-all border',
                                                isSelected
                                                    ? 'bg-blue-500/10 border-blue-500/20'
                                                    : 'bg-white/[0.02] border-transparent hover:border-white/5'
                                            )}
                                        >
                                            <Avatar src={user.avatarUrl} name={user.username} size="sm" />
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-xs font-semibold text-[var(--color-foreground)] truncate">{user.username}</p>
                                                <p className="text-[10px] text-[var(--color-gray-500)]">{user.email || 'User'}</p>
                                            </div>
                                            <div className={cn(
                                                "w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center flex-shrink-0",
                                                isSelected ? "bg-blue-500 border-blue-500" : "border-white/20"
                                            )}>
                                                {isSelected && (
                                                    <svg width="8" height="8" viewBox="0 0 15 15" fill="none">
                                                        <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3354 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.5553 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="white" fillRule="evenodd" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            ) : searchQuery ? (
                                <div className="text-center py-10 text-xs text-[var(--color-gray-500)]">No users found</div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            <ModalFooter>
                {step === 'details' ? (
                    <>
                        <Button variant="ghost" onClick={handleClose} className="text-xs font-medium text-[var(--color-gray-400)]">Cancel</Button>
                        <Button variant="default" onClick={handleNext} className="text-xs font-semibold h-9 px-6">Next</Button>
                    </>
                ) : (
                    <>
                        <Button variant="ghost" onClick={handleBack} className="text-xs font-medium text-[var(--color-gray-400)]">Back</Button>
                        <Button
                            variant="default"
                            onClick={handleCreateGroup}
                            disabled={selectedMembers.length === 0 || createGroupMutation.isPending}
                            loading={createGroupMutation.isPending}
                            className="text-xs font-semibold h-9 px-6"
                        >
                            Create Group
                        </Button>
                    </>
                )}
            </ModalFooter>
        </Modal>
    );
}
