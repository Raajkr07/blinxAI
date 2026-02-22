package com.blink.chatservice.chat.entity;

import com.blink.chatservice.chat.model.ConversationType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "conversations")
@CompoundIndexes({
    @CompoundIndex(name = "participants_type_idx", def = "{'participants': 1, 'type': 1}"),
    @CompoundIndex(name = "participants_updated_idx", def = "{'participants': 1, 'updatedAt': -1}"),
    @CompoundIndex(name = "type_participants_size_idx", def = "{'type': 1, 'participants': 1}")
})
public class Conversation {

    private static final ZoneId UTC = ZoneId.of("UTC");

    @Id
    private String id;
    private String title;
    private String avatarUrl;
    @Indexed
    private ConversationType type;
    private Set<String> participants = new HashSet<>();
    private Set<String> admins = new HashSet<>();
    private String lastMessagePreview;
    private LocalDateTime lastMessageAt;
    private LocalDateTime createdAt = LocalDateTime.now(UTC);
    private LocalDateTime updatedAt = LocalDateTime.now(UTC);
}
