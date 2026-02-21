package com.blink.chatservice.chat.repository;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.model.ConversationType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    List<Conversation> findByParticipantsContainingOrderByUpdatedAtDesc(String userId);
    List<Conversation> findByParticipantsContainingAndType(String userId, ConversationType type);

    @Query("{ 'type': ?0, 'participants': { $all: ?1, $size: 2 } }")
    Optional<Conversation> findDirectByParticipants(ConversationType type, List<String> users);
}
