package com.blink.chatservice.videochat.dto;

import com.blink.chatservice.videochat.entity.Call;
import java.time.LocalDateTime;

public record CallResponse(
        String id,
        String callerId,
        String receiverId,
        Call.CallType type,
        Call.CallStatus status,
        LocalDateTime startedAt,
        LocalDateTime answeredAt,
        LocalDateTime endedAt,
        LocalDateTime createdAt,
        String conversationId
) {
    public static CallResponse from(Call call) {
        return new CallResponse(
                call.getId(),
                call.getCallerId(),
                call.getReceiverId(),
                call.getType(),
                call.getStatus(),
                call.getStartedAt(),
                call.getAnsweredAt(),
                call.getEndedAt(),
                call.getCreatedAt(),
                call.getConversationId()
        );
    }
}
