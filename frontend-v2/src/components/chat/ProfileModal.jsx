import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService, userService } from '../../services';
import { queryKeys } from '../../lib/queryClient';
import { useAuthStore } from '../../stores';
import { Modal, Avatar, Button, AILogo, Input, ModalFooter } from '../ui';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export function ProfileModal({ isOpen, onClose, conversationId, type = 'user' }) {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editAvatarUrl, setEditAvatarUrl] = useState('');
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');

    const { data: conversation, isLoading: isLoadingConv } = useQuery({
        queryKey: queryKeys.conversation(conversationId),
        queryFn: () => chatService.getConversation(conversationId),
        enabled: !!conversationId && isOpen,
    });

    const isGroup = type === 'group' || conversation?.type === 'GROUP' || conversation?.type === 'COMMUNITY';
    const isAI = type === 'ai' || conversation?.type === 'AI_ASSISTANT';
    const isAdmin = isGroup && conversation?.admins?.includes(currentUser?.id);

    const otherUserId = !isGroup && !isAI && conversation?.participants
        ? conversation.participants.find(id => id !== currentUser?.id)
        : null;

    const { data: userProfile, isLoading: isLoadingUser } = useQuery({
        queryKey: ['user', otherUserId],
        queryFn: () => userService.getUserById(otherUserId),
        enabled: !!otherUserId && isOpen,
        staleTime: 1000 * 60 * 5,
    });

    const { data: groupParticipants, isLoading: isLoadingParticipants } = useQuery({
        queryKey: ['group-participants', conversationId],
        queryFn: async () => {
            if (!conversation?.participants) return [];
            return await userService.getUsersBatch([...conversation.participants]);
        },
        enabled: isGroup && !!conversation?.participants && isOpen,
        staleTime: 1000 * 60 * 5,
    });

    const { data: searchResults } = useQuery({
        queryKey: ['users', memberSearch],
        queryFn: () => userService.searchUsers(memberSearch),
        enabled: showAddMember && memberSearch.length >= 2,
    });

    const filteredSearchResults = searchResults?.filter(
        u => !conversation?.participants?.includes(u.id)
    ) || [];

    const updateGroupMutation = useMutation({
        mutationFn: () => chatService.updateGroup(conversationId, {
            title: editTitle || undefined,
            avatarUrl: editAvatarUrl || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            setIsEditing(false);
            toast.success('Group updated');
        },
        onError: () => toast.error('Failed to update group'),
    });

    const addParticipantMutation = useMutation({
        mutationFn: (participantIds) => chatService.addParticipants(conversationId, participantIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
            queryClient.invalidateQueries({ queryKey: ['group-participants', conversationId] });
            toast.success('Member added');
        },
    });

    const removeParticipantMutation = useMutation({
        mutationFn: (userId) => chatService.removeParticipant(conversationId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
            queryClient.invalidateQueries({ queryKey: ['group-participants', conversationId] });
            toast.success('Member removed');
        },
    });

    const leaveGroupMutation = useMutation({
        mutationFn: () => chatService.leaveGroup(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            onClose();
            toast.success('Left group');
        },
        onError: () => toast.error('Failed to leave group'),
    });

    const deleteChatMutation = useMutation({
        mutationFn: () => chatService.deleteConversation(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            onClose();
            toast.success('Chat deleted');
        },
        onError: () => toast.error('Failed to delete chat'),
    });

    const isLoading = isLoadingConv || (!!otherUserId && isLoadingUser) || (isGroup && isLoadingParticipants);
    const displayData = isGroup || isAI ? conversation : (userProfile || conversation);

    const handleStartEdit = () => {
        setEditTitle(conversation?.title || '');
        setEditAvatarUrl(conversation?.avatarUrl || '');
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        if (!editTitle.trim()) {
            toast.error('Group name required');
            return;
        }
        updateGroupMutation.mutate();
    };

    const handleClose = () => {
        setIsEditing(false);
        setShowAddMember(false);
        setMemberSearch('');
        onClose();
    };

    if (!isOpen) return null;

    const getTitle = () => {
        if (isEditing) return 'Edit Group';
        if (showAddMember) return 'Add Members';
        if (isGroup) return 'Group Info';
        if (isAI) return 'AI Assistant';
        return 'Profile';
    };

    return (
        <Modal
            open={isOpen}
            onOpenChange={(val) => !val && handleClose()}
            title={getTitle()}
            size="md"
        >
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                        <p className="text-[10px] text-[var(--color-gray-500)]">Loading…</p>
                    </div>
                ) : isEditing ? (
                    /* Edit View */
                    <div className="space-y-5 py-4">
                        <div className="flex flex-col items-center py-2 gap-3">
                            <Avatar src={editAvatarUrl} name={editTitle} size="xl" className="w-20 h-20 ring-2 ring-white/10" />
                        </div>
                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
                            <div className="p-4">
                                <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Group Name</label>
                                <Input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Group name"
                                    className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                                />
                            </div>
                            <div className="p-4">
                                <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Avatar URL</label>
                                <Input
                                    value={editAvatarUrl}
                                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                                />
                            </div>
                        </div>
                    </div>
                ) : showAddMember ? (
                    /* Add Member View */
                    <div className="space-y-4 py-4">
                        <Input
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Search users…"
                            className="bg-white/[0.03] border-white/5 focus:border-blue-500/40 h-10"
                            autoFocus
                            leftIcon={
                                <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="text-[var(--color-gray-500)]">
                                    <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                </svg>
                            }
                        />
                        <div className="space-y-1.5">
                            {filteredSearchResults.map((user) => (
                                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                                    <Avatar src={user.avatarUrl} name={user.username} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{user.username}</p>
                                        <p className="text-[10px] text-[var(--color-gray-500)]">{user.email || 'User'}</p>
                                    </div>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="text-[10px] font-semibold h-7 px-3"
                                        onClick={() => addParticipantMutation.mutate([user.id])}
                                    >
                                        Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Main Profile View */
                    <div className="space-y-5 py-4">
                        {/* Avatar & Name */}
                        <div className="flex flex-col items-center text-center gap-2">
                            <div className="relative mb-1">
                                <Avatar
                                    src={isAI ? 'https://img.freepik.com/free-vector/chatbot-chat-message-vectorart_78370-4104.jpg' : displayData?.avatarUrl}
                                    name={displayData?.title || displayData?.username}
                                    size="xl"
                                    className="w-24 h-24 ring-2 ring-white/10"
                                />
                                {displayData?.online && (
                                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-3 border-[var(--color-background)] rounded-full" />
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-[var(--color-foreground)]">
                                {displayData?.title || displayData?.username}
                            </h2>
                            {displayData?.status && (
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">{displayData.status}</p>
                            )}
                        </div>

                        {/* Info Cards */}
                        <div className="space-y-3">
                            {displayData?.bio && (
                                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                                    <h3 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)] mb-2">About</h3>
                                    <p className="text-sm text-[var(--color-gray-300)] leading-relaxed">{displayData.bio}</p>
                                </div>
                            )}

                            {isGroup && groupParticipants && (
                                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)]">Members ({groupParticipants.length})</h3>
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowAddMember(true)}
                                                className="text-[10px] font-medium text-blue-400 h-6 px-2"
                                            >
                                                + Add
                                            </Button>
                                        )}
                                    </div>
                                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                        {groupParticipants.map((p) => (
                                            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar src={p.avatarUrl} name={p.username} size="sm" />
                                                    <span className="text-xs font-medium text-[var(--color-foreground)]">{p.username}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {conversation?.admins?.includes(p.id) && (
                                                        <span className="text-[9px] font-semibold uppercase text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">Admin</span>
                                                    )}
                                                    {isAdmin && p.id !== currentUser?.id && (
                                                        <button
                                                            onClick={() => removeParticipantMutation.mutate(p.id)}
                                                            className="text-[var(--color-gray-500)] hover:text-red-400 transition-colors text-sm px-1"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isAI && (
                                <div className="rounded-2xl bg-blue-500/5 border border-blue-500/10 p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <AILogo className="w-4 h-4 text-blue-400" />
                                        <h3 className="text-[10px] uppercase font-semibold tracking-wider text-blue-400">Capabilities</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {['MCP Tools', 'Reasoning', 'Real-time Chat', 'Memory'].map((feat, i) => (
                                            <span key={i} className="px-2.5 py-1 rounded-lg bg-black/30 border border-white/5 text-[10px] font-medium text-blue-300">
                                                {feat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <ModalFooter>
                {isEditing ? (
                    <>
                        <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-xs font-medium text-[var(--color-gray-400)]">Cancel</Button>
                        <Button variant="default" onClick={handleSaveEdit} loading={updateGroupMutation.isPending} className="text-xs font-semibold h-9 px-6">Save</Button>
                    </>
                ) : showAddMember ? (
                    <Button variant="ghost" onClick={() => setShowAddMember(false)} className="text-xs font-medium text-[var(--color-gray-400)] w-full">Back to Profile</Button>
                ) : (
                    <>
                        {isGroup ? (
                            <>
                                {isAdmin && (
                                    <Button variant="ghost" onClick={handleStartEdit} className="text-xs font-medium text-blue-400 mr-auto">Edit</Button>
                                )}
                                <Button
                                    variant="ghost"
                                    onClick={() => leaveGroupMutation.mutate()}
                                    className="text-xs font-medium text-red-400 hover:bg-red-500/10"
                                    loading={leaveGroupMutation.isPending}
                                >
                                    Leave
                                </Button>
                            </>
                        ) : !isAI && (
                            <Button
                                variant="ghost"
                                onClick={() => deleteChatMutation.mutate()}
                                className="text-xs font-medium text-red-400 hover:bg-red-500/10 mr-auto"
                                loading={deleteChatMutation.isPending}
                            >
                                Delete Chat
                            </Button>
                        )}
                        <Button variant="default" onClick={handleClose} className="text-xs font-semibold h-9 px-6">Done</Button>
                    </>
                )}
            </ModalFooter>
        </Modal>
    );
}
