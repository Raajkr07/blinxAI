import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

// Get all conversations for logged-in user
export async function fetchConversations(token) {
  const res = await fetch(`${API_BASE}/chat/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to fetch conversations');
    throw new Error(errorText || 'Failed to fetch conversations');
  }
  const data = await res.json();
  // backend returns a plain array -> return as-is
  // but also handle { content: [...] } just in case
  return Array.isArray(data) ? data : (data.content || data.conversations || []);
}

// Get messages for a conversation (paged)
export async function fetchMessages(token, conversationId, page = 0, size = 30) {
  const res = await fetch(
    `${API_BASE}/chat/${conversationId}/messages?page=${page}&size=${size}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to fetch messages');
    throw new Error(errorText || 'Failed to fetch messages');
  }
  const data = await res.json();
  // Ensure content is an array
  if (Array.isArray(data)) {
    return { content: data, totalElements: data.length };
  }
  return {
    content: data.content || data.messages || [],
    totalElements: data.totalElements || data.total || 0,
  };
}

// Send message via REST (optional if using WebSocket)
export async function sendMessageRest(token, conversationId, body) {
  if (!body || !body.trim()) {
    throw new Error('Message cannot be empty');
  }

  if (body.length > 2000) {
    throw new Error('Message exceeds maximum length of 2000 characters');
  }

  const res = await fetch(`${API_BASE}/chat/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body: body.trim() }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || 'Failed to send message';
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function createGroupConversation(token, title, participantIds = []) {
  if (!title || !title.trim()) {
    throw new Error('Group title is required');
  }

  const payload = { title: title.trim(), participantIds };
  console.log('Sending createGroup request:', payload);
  console.log('JSON Payload:', JSON.stringify(payload));

  const res = await fetch(`${API_BASE}/chat/group`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));

    // Handle Spring Boot Validation Errors
    if (errorData.detail && errorData.title === "Bad Request") {
      // Attempt to find specific field errors if available
      // Spring Boot 3.2 ProblemDetail might put them in 'properties' or similar
      console.error("Validation Error:", errorData);
      throw new Error(errorData.detail || "Validation failed");
    }

    const errorMessage = errorData.message || errorData.error || 'Failed to create group';
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function createDirectConversation(token, otherUserContact) {
  if (!otherUserContact || !otherUserContact.trim()) {
    throw new Error('Contact information is required');
  }

  const res = await fetch(`${API_BASE}/chat/direct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ otherUserContact: otherUserContact.trim() }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || 'Failed to create direct chat. User not found.';
    throw new Error(errorMessage);
  }
  return res.json();
}

// List all group conversations visible to current user
export async function fetchGroups(token) {
  const res = await fetch(`${API_BASE}/chat/groups`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to fetch groups');
    throw new Error(errorText || 'Failed to fetch groups');
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Join a specific group conversation
export async function joinGroup(token, groupId) {
  const res = await fetch(`${API_BASE}/chat/groups/${encodeURIComponent(groupId)}/join`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to join group');
    throw new Error(errorText || 'Failed to join group');
  }
  return res.json(); // Conversation
}

// Get conversation details
export async function getConversation(token, conversationId) {
  const res = await fetch(`${API_BASE}/chat/${encodeURIComponent(conversationId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to fetch conversation');
    throw new Error(errorText || 'Failed to fetch conversation');
  }
  return res.json();
}

// Update group (title, avatar) - Admin only
export async function updateGroup(token, groupId, { title, avatarUrl }) {
  const res = await fetch(`${API_BASE}/chat/groups/${encodeURIComponent(groupId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, avatarUrl }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to update group');
    throw new Error(errorText || 'Failed to update group');
  }
  return res.json();
}

// Add participants to group
export async function addParticipantsToGroup(token, groupId, participantIds) {
  const res = await fetch(
    `${API_BASE}/chat/groups/${encodeURIComponent(groupId)}/participants`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ participantIds }),
    }
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to add participants');
    throw new Error(errorText || 'Failed to add participants');
  }
  return res.json();
}

// Remove participant from group
export async function removeParticipantFromGroup(token, groupId, userId) {
  const res = await fetch(
    `${API_BASE}/chat/groups/${encodeURIComponent(groupId)}/participants/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to remove participant');
    throw new Error(errorText || 'Failed to remove participant');
  }
  return res.json();
}

// Get group details
export async function getGroup(token, groupId) {
  const res = await fetch(`${API_BASE}/chat/groups/${encodeURIComponent(groupId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to fetch group');
    throw new Error(errorText || 'Failed to fetch group');
  }
  return res.json();
}

// Delete or leave conversation
export async function deleteConversation(token, conversationId) {
  const res = await fetch(`${API_BASE}/chat/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to delete conversation');
    throw new Error(errorText || 'Failed to delete conversation');
  }
}

// Leave a group
export async function leaveGroup(token, groupId) {
  const res = await fetch(`${API_BASE}/chat/groups/${encodeURIComponent(groupId)}/leave`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to leave group');
    throw new Error(errorText || 'Failed to leave group');
  }
}

// Delete a message
export async function deleteMessage(token, messageId) {
  const res = await fetch(`${API_BASE}/chat/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to delete message');
    throw new Error(errorText || 'Failed to delete message');
  }
}