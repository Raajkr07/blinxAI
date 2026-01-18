package com.blink.chatservice.videochat.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

// MongoDB entity for storing call records - both video and audio calls
@Data
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
    private LocalDateTime createdAt = LocalDateTime.now();

    private String conversationId; // linking to chat conversation if any

    // WebRTC stuff - needed for establishing peer-to-peer connection
    private String callerOffer; // SDP offer from the person calling
    private String receiverAnswer; // SDP answer from the person receiving
    private List<String> callerIceCandidates; // network candidates from caller
    private List<String> receiverIceCandidates; // network candidates from receiver

    public enum CallType {
        VIDEO,
        AUDIO
    }

    public enum CallStatus {
        INITIATED,  // call just created, receiver hasn't been notified yet
        RINGING,    // receiver's phone is ringing
        ANSWERED,   // receiver picked up, call is ongoing
        REJECTED,   // receiver declined the call
        ENDED,      // call finished normally
        MISSED      // receiver didn't pick up
    }

    // checking if call is still going on or waiting to be picked up
    public boolean isActive() {
        return status == CallStatus.RINGING || status == CallStatus.ANSWERED;
    }
}
