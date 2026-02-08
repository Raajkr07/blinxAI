import { useState, useEffect } from 'react';
import { getUserProfile } from '../../api/userApi';

export default function UserProfile({ userId, token, currentUserId, onClose, onStartChat }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || !token) return;

    setLoading(true);
    setError(null);
    (async () => {
      try {
        const profile = await getUserProfile(token, userId);
        setUser(profile);
      } catch (e) {
        setError(e.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, token]);

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
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 mx-4">
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 mx-4">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error || 'User not found'}</p>
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

  const isSelf = user.id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Profile
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username || 'User'}
                className="w-24 h-24 rounded-full object-cover border-4 border-indigo-500"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-3xl font-bold border-4 border-indigo-500">
                {getInitials(user.username || user.email || user.phone)}
              </div>
            )}
            {user.online && (
              <span className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            )}
          </div>

          {/* User Info */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                Username
              </label>
              <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {user.username || 'Not set'}
              </p>
            </div>

            {user.bio && (
              <div>
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Bio
                </label>
                <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                  {user.bio}
                </p>
              </div>
            )}

            {user.email && (
              <div>
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Email
                </label>
                <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                  {user.email}
                </p>
              </div>
            )}

            {user.phone && (
              <div>
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Phone
                </label>
                <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                  {user.phone}
                </p>
              </div>
            )}

            {user.lastSeen && (
              <div>
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Last Seen
                </label>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {new Date(user.lastSeen).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isSelf && onStartChat && (
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => {
                  onStartChat(user);
                  onClose();
                }}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                Start Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
