package com.blink.chatservice.chat.repository;

import com.blink.chatservice.chat.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MessageRepository extends MongoRepository<Message, String> {

    // Pagination is critical here. Fetches latest messages first (descending).
    // Using ID for sorting is more robust against timezone changes than CreatedAt
    Page<Message> findByConversationIdAndDeletedFalseOrderByIdDesc(
            String conversationId,
            Pageable pageable
    );
}
