package com.blink.chatservice.chat.service;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import org.springframework.data.domain.Page;
import java.util.List;
import java.util.Set;

public interface ChatService {

    Conversation createDirectConversation(String me, String otherUserContact);
    Conversation createGroupConversation(String creatorId, String title, Set<String> participantIds);
    List<Conversation> listConversationsForUser(String userId);
    List<Conversation> listGroupsVisibleToUser(String userId);
    Conversation addUserToGroup(String groupId, String userId);
    Conversation removeUserFromGroup(String groupId, String userId, String requesterId);
    Conversation updateGroup(String groupId, String requesterId, String title, String avatarUrl);
    Conversation getConversation(String conversationId);
    Message sendMessage(String conversationId, String senderId, String body);
    Page<Message> getMessages(String conversationId, int page, int size);
    void deleteConversation(String conversationId, String userId);
    void leaveGroup(String groupId, String userId);
    Conversation createAiConversation(String userId);
    void deleteMessage(String messageId, String userId);
}
