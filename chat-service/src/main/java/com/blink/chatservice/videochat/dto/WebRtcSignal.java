package com.blink.chatservice.videochat.dto;

// WebRTC signaling messages that get passed between caller and receiver
public record WebRtcSignal(
        String callId,
        SignalType type,
        String data,
        String targetUserId
) {
    public enum SignalType {
        OFFER,
        ANSWER,
        ICE_CANDIDATE,
        CALL_ENDED
    }
}
