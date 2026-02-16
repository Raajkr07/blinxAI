import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore, useChatStore, useTabsStore } from '../../stores';
import { Modal, Avatar, Button, Input, ModalFooter } from '../ui';
import toast from 'react-hot-toast';
import { useState, useMemo } from 'react';

export function BrowseGroupsModal({ open, onOpenChange }) {
    const { user: currentUser } = useAuthStore();
    const { setActiveConversation } = useChatStore();
    const { openTab } = useTabsStore();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

    const { data: groups, isLoading } = useQuery({
        queryKey: queryKeys.groups,
        queryFn: chatService.listGroups,
        enabled: open,
    });

    const filteredGroups = useMemo(() => {
        if (!groups) return [];
        if (!search.trim()) return groups;
        const q = search.toLowerCase();
        return groups.filter(g =>
            g.title?.toLowerCase().includes(q) ||
            g.id?.toLowerCase().includes(q)
        );
    }, [groups, search]);

    const joinGroupMutation = useMutation({
        mutationFn: (groupId) => chatService.joinGroup(groupId),
        onSuccess: (conversation) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            queryClient.invalidateQueries({ queryKey: queryKeys.groups });
            openTab(conversation);
            setActiveConversation(conversation.id);
            onOpenChange(false);
            toast.success('Joined group');
        },
        onError: () => toast.error('Failed to join'),
    });

    const handleClose = () => {
        setSearch('');
        onOpenChange(false);
    };

    return (
        <Modal
            open={open}
            onOpenChange={(val) => !val && handleClose()}
            title="Browse Groups"
            description="Find and join group conversations"
            size="md"
        >
            <div className="space-y-4 py-2">
                <div>
                    <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1.5 block px-1">
                        Search Groups
                    </label>
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter by name…"
                        className="bg-white/[0.03] border-white/5 focus:border-blue-500/40 h-10"
                        autoFocus
                        leftIcon={
                            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="text-[var(--color-gray-500)]">
                                <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                            </svg>
                        }
                    />
                </div>

                <div className="min-h-[250px] space-y-1.5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-7 h-7 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mb-2" />
                            <p className="text-[10px] text-[var(--color-gray-500)]">Loading groups…</p>
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-xs text-[var(--color-gray-500)]">No groups found</p>
                        </div>
                    ) : (
                        filteredGroups.map((group) => {
                            const isMember = group.participants?.includes(currentUser?.id);
                            return (
                                <div key={group.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                                    <Avatar src={group.avatarUrl} name={group.title} size="md" className="w-10 h-10" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-[var(--color-foreground)] truncate">{group.title || 'Untitled Group'}</p>
                                        <p className="text-[10px] text-[var(--color-gray-500)]">{group.participants?.length || 0} members</p>
                                    </div>
                                    {isMember ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-[10px] font-medium text-[var(--color-gray-400)] h-7 px-3"
                                            onClick={() => { openTab(group); setActiveConversation(group.id); handleClose(); }}
                                        >
                                            Open
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="text-[10px] font-semibold h-7 px-4"
                                            onClick={() => joinGroupMutation.mutate(group.id)}
                                            disabled={joinGroupMutation.isPending}
                                        >
                                            Join
                                        </Button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <ModalFooter>
                <Button variant="ghost" onClick={handleClose} className="text-xs font-medium text-[var(--color-gray-400)]">Close</Button>
            </ModalFooter>
        </Modal>
    );
}
