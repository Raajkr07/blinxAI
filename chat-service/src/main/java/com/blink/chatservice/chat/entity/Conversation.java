package com.blink.chatservice.chat.entity;

import com.blink.chatservice.chat.model.ConversationType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "conversations")
public class Conversation {

    @Id
    private String id;
    private String title;
    private String avatarUrl;
    private ConversationType type;
    private Set<String> participants = new HashSet<>();
    private Set<String> admins = new HashSet<>();
    private String lastMessagePreview;
    private LocalDateTime lastMessageAt;
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.of("UTC"));
    private LocalDateTime updatedAt = LocalDateTime.now(ZoneId.of("UTC"));
}
