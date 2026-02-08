package com.blink.chatservice.videochat.entity;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "calls")
public class Call {

    @Id
    private String id;

    @Indexed
    private String callerId;

    @Indexed
    private String receiverId;

    private CallType type;
    private CallStatus status;

    private LocalDateTime startedAt;
    private LocalDateTime answeredAt;
    private LocalDateTime endedAt;
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.of("UTC"));

    private String conversationId;

    private String callerOffer;
    private String receiverAnswer;
    private List<String> callerIceCandidates;
    private List<String> receiverIceCandidates;

    public enum CallType {
        VIDEO, AUDIO
    }

    public enum CallStatus {
        INITIATED, RINGING, ANSWERED, REJECTED, ENDED, MISSED
    }

    public boolean isActive() {
        return status == CallStatus.RINGING || status == CallStatus.ANSWERED;
    }
}
