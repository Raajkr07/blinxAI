import { useState, useEffect } from 'react';
import {
  getGroup,
  updateGroup,
  addParticipantsToGroup,
  removeParticipantFromGroup,
} from '../../../api/chatApi';
import { searchUsers, getUserProfile } from '../../../api/userApi';

export default function GroupManagement({
  groupId,
  token,
  currentUserId,
  onClose,
  onUpdate,
}) {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('view'); // 'view', 'edit', 'addUsers', 'editParticipants'
  const [editData, setEditData] = useState({ title: '', avatarUrl: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (!groupId || !token) return;

    loadGroup();
  }, [groupId, token]);

  const loadGroup = async () => {
    setLoading(true);
    setError('');
    try {
      const groupData = await getGroup(token, groupId);
      setGroup(groupData);
      setEditData({
        title: groupData.title || '',
        avatarUrl: groupData.avatarUrl || '',
      });

      // Load participant details
      if (groupData.participants) {
        const participantDetails = await Promise.all(
          groupData.participants.map(async (userId) => {
            try {
              return await getUserProfile(token, userId);
            } catch {
              return { id: userId, username: userId };
            }
          })
        );
        setParticipants(participantDetails);
      }
    } catch (e) {
      setError(e.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchUsers(token, query);
      // Filter out users already in group
      const filtered = results.filter(
        (u) => !group?.participants?.includes(u.id)
      );
      setSearchResults(filtered);
    } catch (e) {
      console.error('Search failed:', e);
      setSearchResults([]);
    }
  };

  const handleAddUsers = async () => {
    if (selectedUsers.length === 0) return;

    setLoadingAction(true);
    setError('');
    try {
      const userIds = selectedUsers.map((u) => u.id).filter(Boolean);
      if (userIds.length === 0) {
        setError('No valid users selected');
        return;
      }
      
      await addParticipantsToGroup(token, groupId, userIds);
      await loadGroup();
      setMode('view');
      setSelectedUsers([]);
      setSearchQuery('');
      setSearchResults([]);
      if (onUpdate) onUpdate();
      
      // Show success feedback
      if (window.showToast) {
        window.showToast(`Successfully added ${userIds.length} member${userIds.length > 1 ? 's' : ''}`, 'success');
      }
    } catch (e) {
      setError(e.message || 'Failed to add users. Please try again.');
      console.error('Error adding users to group:', e);
      if (window.showToast) {
        window.showToast(e.message || 'Failed to add users', 'error');
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!confirm('Remove this user from the group?')) return;

    setLoadingAction(true);
    setError('');
    try {
      await removeParticipantFromGroup(token, groupId, userId);
      await loadGroup();
      if (onUpdate) onUpdate();
      
      // Show success feedback
      if (window.showToast) {
        window.showToast('User removed from group', 'success');
      }
    } catch (e) {
      setError(e.message || 'Failed to remove user');
      if (window.showToast) {
        window.showToast(e.message || 'Failed to remove user', 'error');
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUpdateGroup = async () => {
    setLoadingAction(true);
    setError('');
    try {
      await updateGroup(token, groupId, editData);
      await loadGroup();
      setMode('view');
      if (onUpdate) onUpdate();
      
      // Show success feedback
      if (window.showToast) {
        window.showToast('Group updated successfully', 'success');
      }
    } catch (e) {
      setError(e.message || 'Failed to update group');
      if (window.showToast) {
        window.showToast(e.message || 'Failed to update group', 'error');
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const isAdmin = group?.admins?.includes(currentUserId);

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 mx-4">
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 mx-4">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Group not found</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            {mode === 'edit' ? 'Edit Group' : 
             mode === 'addUsers' ? 'Add Members' : 
             mode === 'editParticipants' ? 'Manage Members' : 
             'Group Info'}
          </h2>
          <button
            onClick={() => {
              setMode('view');
              setSelectedUsers([]);
              setSearchQuery('');
              setSearchResults([]);
              onClose();
            }}
            className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {mode === 'view' && (
            <>
              {/* Group Avatar & Title */}
              <div className="flex flex-col items-center">
                {group.avatarUrl ? (
                  <img
                    src={group.avatarUrl}
                    alt={group.title || 'Group'}
                    className="w-24 h-24 rounded-full object-cover border-4 border-indigo-500"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-3xl font-bold border-4 border-indigo-500">
                    {getInitials(group.title || 'G')}
                  </div>
                )}
                <h3 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                  {group.title || 'Untitled Group'}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {participants.length} {participants.length === 1 ? 'member' : 'members'}
                </p>
              </div>

              {/* Actions */}
              {isAdmin && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode('edit')}
                    className="flex-1 px-4 py-2 border border-indigo-500 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
                  >
                    Edit Group
                  </button>
                  <button
                    onClick={() => setMode('addUsers')}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    Add Members
                  </button>
                </div>
              )}

              {/* Participants */}
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Members ({participants.length})
                </h4>
                <div className="space-y-2">
                  {participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all hover:scale-[1.01]"
                    >
                      <div className="flex items-center gap-3">
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.username || p.id}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-semibold">
                            {getInitials(p.username || p.id)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-neutral-50">
                            {p.username || p.id}
                          </p>
                          {p.id === currentUserId && (
                            <p className="text-xs text-neutral-500">You</p>
                          )}
                          {group.admins?.includes(p.id) && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">
                              Admin
                            </p>
                          )}
                        </div>
                      </div>
                      {isAdmin && p.id !== currentUserId && (
                        <button
                          onClick={() => handleRemoveUser(p.id)}
                          disabled={loadingAction}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'edit' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) =>
                    setEditData({ ...editData, title: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Avatar URL
                </label>
                <input
                  type="url"
                  value={editData.avatarUrl}
                  onChange={(e) =>
                    setEditData({ ...editData, avatarUrl: e.target.value })
                  }
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setMode('view')}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateGroup}
                  disabled={loadingAction || !editData.title.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loadingAction ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {mode === 'addUsers' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Search Users
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by username, email, or phone..."
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                        selectedUsers.some((u) => u.id === user.id)
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500'
                          : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:scale-[1.02]'
                      }`}
                      onClick={() => {
                        if (selectedUsers.some((u) => u.id === user.id)) {
                          setSelectedUsers(
                            selectedUsers.filter((u) => u.id !== user.id)
                          );
                        } else {
                          setSelectedUsers([...selectedUsers, user]);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.username || user.id}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-semibold">
                            {getInitials(user.username || user.id)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-neutral-50">
                            {user.username || user.id}
                          </p>
                          {user.maskedPhone && (
                            <p className="text-xs text-neutral-500">
                              {user.maskedPhone}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedUsers.some((u) => u.id === user.id) && (
                        <span className="text-indigo-600">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedUsers.length > 0 && (
                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                    {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setMode('view');
                        setSelectedUsers([]);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddUsers}
                      disabled={loadingAction}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {loadingAction ? 'Adding...' : 'Add Members'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'editParticipants' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Click on members to remove them from the group. You can add new members using the "Add Members" button.
              </p>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                      p.id === currentUserId
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.username || p.id}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-semibold">
                          {getInitials(p.username || p.id)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-neutral-50">
                          {p.username || p.id}
                          {p.id === currentUserId && (
                            <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">(You)</span>
                          )}
                        </p>
                        {group.admins?.includes(p.id) && (
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">Admin</p>
                        )}
                      </div>
                    </div>
                    {isAdmin && p.id !== currentUserId && (
                      <button
                        onClick={() => handleRemoveUser(p.id)}
                        disabled={loadingAction}
                        className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
                      >
                        {loadingAction ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => {
                    setMode('view');
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition hover:scale-105 active:scale-95"
                >
                  Done
                </button>
                <button
                  onClick={() => {
                    setMode('addUsers');
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition hover:scale-105 active:scale-95"
                >
                  Add More Members
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
