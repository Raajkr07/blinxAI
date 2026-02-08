import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

// Get or create AI assistant conversation
export async function getAiConversation(token) {
  const res = await fetch(`${API_BASE}/ai/conversation`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to get AI conversation');
    throw new Error(errorText || 'Failed to get AI conversation');
  }
  return res.json();
}

// Send message to AI assistant
export async function chatWithAi(token, message) {
  if (!message || !message.trim()) {
    throw new Error('Message cannot be empty');
  }

  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: message.trim() }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || 'Failed to chat with AI';
    throw new Error(errorMessage);
  }
  return res.json();
}

// --- New AI Intelligence Features ---

// Summarize conversation
export async function summarizeConversation(token, conversationId) {
  const res = await fetch(`${API_BASE}/ai/analysis/conversation/${conversationId}/summarize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to summarize conversation');
  return res.json();
}

// Get auto-replies for a message
export async function getAutoReplies(token, messageId, content, senderId) {
  const res = await fetch(`${API_BASE}/ai/analysis/auto-replies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ messageId, content, senderId }),
  });
  if (!res.ok) throw new Error('Failed to get auto-replies');
  return res.json();
}

// Extract tasks from text
export async function extractTask(token, text) {
  const res = await fetch(`${API_BASE}/ai/analysis/extract-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to extract task');
  return res.json();
}

// Simulate typing behavior
export async function simulateTyping(token, text) {
  const res = await fetch(`${API_BASE}/ai/analysis/typing-indicator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null; // Non-critical
  return res.json();
}
