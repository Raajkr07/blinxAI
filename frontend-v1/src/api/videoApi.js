import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

// Initiate a call
export async function initiateCall(token, callRequest) {
    // callRequest: { receiverId, type: "VIDEO" | "AUDIO", conversationId }
    const res = await fetch(`${API_BASE}/calls/initiate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(callRequest),
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => 'Failed to initiate call');
        throw new Error(errorText || 'Failed to initiate call');
    }

    return res.json(); // CallResponse
}

// Accept a call
export async function acceptCall(token, callId) {
    const res = await fetch(`${API_BASE}/calls/${callId}/accept`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to accept call');
    }

    return res.json(); // CallResponse
}

// Reject a call
export async function rejectCall(token, callId) {
    const res = await fetch(`${API_BASE}/calls/${callId}/reject`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to reject call');
    }

    return res.json(); // CallResponse
}

// End a call
export async function endCall(token, callId) {
    const res = await fetch(`${API_BASE}/calls/${callId}/end`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to end call');
    }

    return res.json();
}

// Get call details
export async function getCall(token, callId) {
    const res = await fetch(`${API_BASE}/calls/${callId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to get call details');
    }

    return res.json(); // CallResponse
}

// Get active calls
export async function getActiveCalls(token) {
    const res = await fetch(`${API_BASE}/calls/active`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error('Failed to get active calls');
    }

    return res.json(); // Array of CallResponse
}
