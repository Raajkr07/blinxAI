import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

// 1) Request OTP for signup/login (same endpoint for both)
export async function requestOtp(identifier, email) {
  const res = await fetch(`${API_BASE}/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, email }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'OTP request failed');
  }

  // { message }
  return res.json();
}

// 2) Verify OTP only (no token)
export async function verifyOtpOnly(identifier, otp) {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, otp }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'OTP verification failed');
  }
  // { message, valid }
  const data = await res.json();
  if (!data.valid) throw new Error(data.message || 'Invalid OTP');
  return data;
}

// 3) signup with refresh token (multi-day login)
export async function completeSignupWithRefreshToken(identifier, { username, avatarUrl, bio, email, phone }) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, username, avatarUrl, bio, email, phone }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Signup failed');
  }
  // { accessToken, refreshToken }
  const data = await res.json();
  if (!data.accessToken || !data.refreshToken) {
    throw new Error(data.error || 'No tokens received');
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

// 4) login with refresh token (multi-day login)
export async function completeLoginWithRefreshToken(identifier, email, otp) {
  const requestBody = {
    identifier,
    otp: otp || null,
  };

  // Only include email if it's provided
  if (email) {
    requestBody.email = email;
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Login failed');
  }

  const data = await res.json(); // { accessToken, refreshToken }
  if (!data.accessToken || !data.refreshToken) {
    throw new Error(data.error || 'No tokens received');
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

// 5) Refresh access token using refresh token
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || 'Token refresh failed');
  }

  const data = await res.json(); // { accessToken, refreshToken }
  if (!data.accessToken || !data.refreshToken) {
    throw new Error(data.error || 'No tokens received');
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

// 6) Revoke refresh token (logout)
export async function revokeRefreshToken(refreshToken) {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Logout failed');
  }

  return res.json(); // { message }
}

export async function fetchMe(token) {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to fetch profile');
    throw new Error(errorText || 'Failed to fetch profile');
  }
  return res.json();
}