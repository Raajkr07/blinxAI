package com.blink.chatservice.chat.repository;

import com.blink.chatservice.chat.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;

public interface MessageRepository extends MongoRepository<Message, String> {
    Page<Message> findByConversationIdAndDeletedFalseOrderByIdDesc(String conversationId, Pageable pageable);
    void deleteByCreatedAtBefore(LocalDateTime threshold);
}
