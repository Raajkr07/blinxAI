package com.blink.chatservice.videochat.dto;

import com.blink.chatservice.user.entity.User;
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
        String callerName,
        String callerAvatar,
        String receiverName,
        String receiverAvatar,
        String conversationId
) {
    public static CallResponse from(Call call, User caller, User receiver) {
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
                caller != null ? caller.getUsername() : null,
                caller != null ? caller.getAvatarUrl() : null,
                receiver != null ? receiver.getUsername() : null,
                receiver != null ? receiver.getAvatarUrl() : null,
                call.getConversationId()
        );
    }
}
