package com.blink.chatservice.chat.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Document(collection = "messages")
@Data
public class Message {

    @Id
    private String id;
    @Indexed
    // Indexing conversationId for fast chat history loading.
    private String conversationId;
    private String senderId;
    private String recipientId;
    private String body;
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.of("UTC"));
    private boolean seen = false;
    private boolean deleted = false;
}
