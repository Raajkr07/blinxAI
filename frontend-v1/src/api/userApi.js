import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

// Search users by username / display name / phone
export async function searchUsers(token, query) {
  if (!query || !query.trim()) return [];

  const res = await fetch(
    `${API_BASE}/users/search?query=${encodeURIComponent(query.trim())}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to search users');
    throw new Error(errorText || 'Failed to search users');
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Get user profile by ID
export async function getUserProfile(token, userId) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to fetch user profile');
    throw new Error(errorText || 'Failed to fetch user profile');
  }

  return res.json();
}

// Update current user profile
export async function updateProfile(token, { username, avatarUrl, bio, email, phone }) {
  const res = await fetch(`${API_BASE}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, avatarUrl, bio, email, phone }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to update profile');
    throw new Error(errorText || 'Failed to update profile');
  }

  return res.json();
}

// Presence: list of online userIds
export async function fetchOnlineUserIds(token) {
  const res = await fetch(`${API_BASE}/users/online`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to fetch presence');
    throw new Error(errorText || 'Failed to fetch presence');
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Check specific user online status
export async function checkUserOnline(token, userId) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/online`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to check user status');
  }

  return res.json(); // true/false
}

// Check my online status
export async function checkMyOnlineStatus(token) {
  const res = await fetch(`${API_BASE}/users/me/online`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to check my status');
  }

  return res.json(); // true/false
}

// Cache for user info to avoid repeated API calls
const userInfoCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get user info (with caching)
export async function getUserInfo(token, userId) {
  if (!userId) return null;

  // Check cache first
  const cached = userInfoCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const user = await getUserProfile(token, userId);
    userInfoCache.set(userId, { data: user, timestamp: Date.now() });
    return user;
  } catch (e) {
    console.warn('Failed to fetch user info:', e);
    return null;
  }
}

// Clear user cache
export function clearUserCache(userId) {
  if (userId) {
    userInfoCache.delete(userId);
  } else {
    userInfoCache.clear();
  }
}
