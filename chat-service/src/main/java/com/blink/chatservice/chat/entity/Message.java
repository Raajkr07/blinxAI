package com.blink.chatservice.chat.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "conv_deleted_created_idx", def = "{'conversationId': 1, 'deleted': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "created_at_idx", def = "{'createdAt': 1}")
})
@Data
public class Message {

    private static final ZoneId UTC = ZoneId.of("UTC");

    @Id
    private String id;
    @Indexed
    // Indexing conversationId for fast chat history loading.
    private String conversationId;
    private String senderId;
    private String recipientId;
    private String body;
    private LocalDateTime createdAt = LocalDateTime.now(UTC);
    private boolean seen = false;
    private boolean deleted = false;
}
