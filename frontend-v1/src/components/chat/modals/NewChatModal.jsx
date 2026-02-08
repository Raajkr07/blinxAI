import React, { useState, useEffect } from 'react';
import { searchUsers } from '../../../api/userApi';
import { useAuthStore } from '../../../store/authStore';

export default function NewChatModal({
    onClose,
    onCreateGroup,
    onJoinDirect
}) {
    const [mode, setMode] = useState('create');
    const [title, setTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const { token } = useAuthStore();

    // Search for users when query changes
    useEffect(() => {
        if (mode !== 'join' || !searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setSearching(true);
            try {
                const results = await searchUsers(token, searchQuery);
                setSearchResults(results || []);
            } catch (error) {
                console.error('Search failed:', error);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300); // Debounce search

        return () => clearTimeout(timeoutId);
    }, [searchQuery, mode, token]);

    const getInitials = (name) => {
        if (!name) return '?';
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleUserSelect = (user) => {
        setSelectedUser(user);
        setSearchQuery(user.username || user.displayName || '');
        setSearchResults([]);
    };

    const handleStartChat = () => {
        if (mode === 'create') {
            // Create group with just a title, participants can be added later
            onCreateGroup(title, []);
        } else if (selectedUser) {
            // Direct message mode - start chat with selected user
            const contact = selectedUser.username || selectedUser.email || selectedUser.phone;
            onJoinDirect(contact);
        }
    };

    return (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-[#0f172a] border border-white/10 p-6 shadow-2xl animate-enter">
                <h2 className="text-xl font-bold text-white mb-6">Start a new conversation</h2>

                <div className="mb-6 flex p-1 bg-slate-900 rounded-lg">
                    <button
                        type="button"
                        className={mode === 'create' ? 'flex-1 rounded-md bg-indigo-600 py-1.5 text-xs font-semibold text-white shadow-sm' : 'flex-1 rounded-md py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition'}
                        onClick={() => {
                            setMode('create');
                            setSearchQuery('');
                            setSelectedUser(null);
                        }}
                    >
                        Create Group
                    </button>
                    <button
                        type="button"
                        className={mode === 'join' ? 'flex-1 rounded-md bg-indigo-600 py-1.5 text-xs font-semibold text-white shadow-sm' : 'flex-1 rounded-md py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition'}
                        onClick={() => {
                            setMode('join');
                            setTitle('');
                        }}
                    >
                        Direct Message
                    </button>
                </div>

                {mode === 'create' ? (
                    <div className="mb-6">
                        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Group Name</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Project Alpha..."
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
                            autoFocus
                        />
                    </div>
                ) : (
                    <div className="mb-6 relative">
                        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                            Search User
                        </label>
                        <div className="relative">
                            <input
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setSelectedUser(null);
                                }}
                                placeholder="Type username, email or phone..."
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
                                autoFocus
                            />
                            {searching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl">
                                {searchResults.map((user) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => handleUserSelect(user)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition border-b border-white/5 last:border-0"
                                    >
                                        <div className="size-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-indigo-500/20 flex-shrink-0">
                                            {user.avatarUrl ? (
                                                <img
                                                    src={user.avatarUrl}
                                                    alt={user.username}
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                getInitials(user.displayName || user.username || 'U')
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="truncate font-semibold text-slate-200">
                                                {user.displayName || user.username}
                                            </div>
                                            <div className="truncate text-xs text-slate-500">
                                                {user.email || user.phone || user.username}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* No results message */}
                        {searchQuery.trim() && !searching && searchResults.length === 0 && (
                            <div className="mt-2 text-xs text-slate-500 italic">
                                No users found. Try a different search term.
                            </div>
                        )}

                        {/* Selected user indicator */}
                        {selectedUser && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                <div className="size-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-[10px] font-bold">
                                    {getInitials(selectedUser.displayName || selectedUser.username || 'U')}
                                </div>
                                <span className="text-xs font-medium text-indigo-300">
                                    {selectedUser.displayName || selectedUser.username}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={mode === 'create' ? !title.trim() : !selectedUser}
                        onClick={handleStartChat}
                    >
                        {mode === 'create' ? 'Create Group' : 'Start Chat'}
                    </button>
                </div>
            </div>
        </div>
    );
}
