package com.blink.chatservice.chat.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "messages")
@Data
public class Message {

    @Id
    private String id;
    @Indexed
    private String conversationId;
    private String senderId;
    private String recipientId;
    private String body;
    private LocalDateTime createdAt = LocalDateTime.now();
    private boolean seen = false;
    private boolean deleted = false;
}
