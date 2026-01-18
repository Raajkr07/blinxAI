package com.blink.chatservice.videochat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CallRequest(
        @NotBlank String receiverId,
        @NotNull CallType type,
        String conversationId // Optional
) {
    public enum CallType {
        VIDEO,
        AUDIO
    }
}
