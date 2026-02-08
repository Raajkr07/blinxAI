package com.blink.chatservice.videochat.dto;

public record CallNotification(
        String callId,
        String callerId,
        String receiverId,
        String type,
        String conversationId,
        String callerName,
        String callerAvatar
) {}