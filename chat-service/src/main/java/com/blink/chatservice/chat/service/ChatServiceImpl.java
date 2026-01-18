package com.blink.chatservice.chat.service;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.model.ConversationType;
import com.blink.chatservice.chat.repository.ConversationRepository;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.notification.serviceImpl.EmailServiceImpl;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatServiceImpl.class);

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired(required = false)
    private EmailServiceImpl emailService;

    @Tool(name = "createConversation", description = "this method create a conversation")
    @Override
    @Transactional
    public Conversation createDirectConversation(String me, String otherUserContact) {
        if (otherUserContact == null || otherUserContact.trim().isEmpty()) {
            throw new IllegalArgumentException("Contact information is required");
        }
        
        String otherUserId = userService.resolveUserIdFromContact(otherUserContact.trim());
        if (otherUserId == null) {
            throw new IllegalArgumentException("User not found: " + otherUserContact);
        }
        
        if (me == null || me.trim().isEmpty()) {
            throw new IllegalArgumentException("Current user ID is required");
        }
        
        if (me.equals(otherUserId)) {
            throw new IllegalArgumentException("Cannot create conversation with self");
        }

        List<String> pair1 = List.of(me, otherUserId);
        List<String> pair2 = List.of(otherUserId, me);
        
        // Handling race condition where two DMs might be created if both users click 'message' at same time. 
        // Checking both pair directions to ensure uniqueness.
        Optional<Conversation> existing = conversationRepository.findDirectByParticipants(ConversationType.DIRECT, pair1);
        if (existing.isEmpty()) {
            existing = conversationRepository.findDirectByParticipants(ConversationType.DIRECT, pair2);
        }
        
        return existing.orElseGet(() -> {
            Conversation conv = new Conversation();
            conv.setType(ConversationType.DIRECT);
            conv.setParticipants(new HashSet<>(pair1));
            conv.setCreatedAt(LocalDateTime.now());
            conv.setUpdatedAt(LocalDateTime.now());
            Conversation saved = conversationRepository.save(conv);
            
            // Notify participants
            saved.getParticipants().forEach(userId -> 
                messagingTemplate.convertAndSendToUser(
                    userId, 
                    "/queue/conversations/new", 
                    saved
                )
            );
            
            log.info("Created direct conversation between {} and {}", me, otherUserId);
            return saved;
        });
    }

    @Override
    @Transactional
    public Conversation createGroupConversation(String creatorId, String title, Set<String> participantIds) {
        Conversation conv = new Conversation();
        conv.setType(ConversationType.GROUP);
        conv.setTitle(title);
        Set<String> participants = participantIds != null ? new HashSet<>(participantIds) : new HashSet<>();
        participants.add(creatorId);
        conv.setParticipants(participants);

        if (conv.getAdmins() == null) {
            conv.setAdmins(new HashSet<>());
        }
        conv.getAdmins().add(creatorId);
        
        conv.setCreatedAt(LocalDateTime.now());
        conv.setUpdatedAt(LocalDateTime.now());
        
        Conversation saved = conversationRepository.save(conv);
        log.info("Created group conversation {} by {}", saved.getId(), creatorId);
        return saved;
    }

    @Override
    public List<Conversation> listConversationsForUser(String userId) {
        return conversationRepository.findByParticipantsContaining(userId);
    }

    @Override
    public List<Conversation> listGroupsVisibleToUser(String userId) {
        return conversationRepository.findByParticipantsContainingAndType(userId, ConversationType.GROUP);
    }

    @Override
    @Transactional
    public Conversation addUserToGroup(String groupId, String userId) {
        validateGroupInputs(groupId, userId);
        
        if (!userRepository.existsById(userId.trim())) {
            throw new IllegalArgumentException("User not found: " + userId);
        }
        
        Conversation conv = getGroupConversation(groupId);
        Set<String> participants = getParticipantsSafe(conv);

        String trimmedUserId = userId.trim();
        if (!participants.add(trimmedUserId)) {
            return conv;
        }

        conv.setParticipants(participants);
        conv.setUpdatedAt(LocalDateTime.now());
        log.info("Added user {} to group {}", userId, groupId);
        return conversationRepository.save(conv);
    }

    @Override
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = "conversations_v2", key = "#groupId")
    public Conversation removeUserFromGroup(String groupId, String userId, String requesterId) {
        Conversation conv = getGroupConversation(groupId);

        boolean isAdmin = conv.getAdmins() != null && conv.getAdmins().contains(requesterId);
        boolean isSelf = requesterId.equals(userId);

        if (!isAdmin && !isSelf) {
            throw new IllegalArgumentException("Only admins can remove other users");
        }

        Set<String> participants = getParticipantsSafe(conv);
        if (!participants.remove(userId)) {
            throw new IllegalArgumentException("User is not a participant");
        }

        if (conv.getAdmins() != null) {
            conv.getAdmins().remove(userId);
        }

        if (participants.isEmpty()) {
            throw new IllegalArgumentException("Cannot remove the last participant");
        }

        conv.setParticipants(participants);
        conv.setUpdatedAt(LocalDateTime.now());
        log.info("Removed user {} from group {}", userId, groupId);
        return conversationRepository.save(conv);
    }

    @Override
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = "conversations_v2", key = "#groupId")
    public Conversation updateGroup(String groupId, String requesterId, String title, String avatarUrl) {
        Conversation conv = getGroupConversation(groupId);

        boolean isAdmin = conv.getAdmins() != null && conv.getAdmins().contains(requesterId);
        if (!isAdmin) {
            throw new IllegalArgumentException("Only admins can update group");
        }

        if (title != null && !title.trim().isEmpty()) {
            conv.setTitle(title.trim());
        }

        if (avatarUrl != null) {
            conv.setAvatarUrl(avatarUrl.trim().isEmpty() ? null : avatarUrl.trim());
        }

        conv.setUpdatedAt(LocalDateTime.now());
        log.info("Updated group {}", groupId);
        return conversationRepository.save(conv);
    }

    @Tool(name = "getConversation", description = "this method return all the conversation of the user.")
    @Override
    @Cacheable(value = "conversations_v2", key = "#conversationId")
    public Conversation getConversation(String conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
    }

    @Tool(name = "sendMessage", description = "this method send the message")
    @Override
    @Transactional
    @CacheEvict(value = "conversations_v2", key = "#conversationId")
    public Message sendMessage(String conversationId, String senderId, String body) {
        if (conversationId == null || conversationId.trim().isEmpty()) throw new IllegalArgumentException("Conversation ID is required");
        if (senderId == null || senderId.trim().isEmpty()) throw new IllegalArgumentException("Sender ID is required");
        if (body == null || body.trim().isEmpty()) throw new IllegalArgumentException("Message body is required");
        
        // Truncating long messages to 4000 chars to avoid DB bloat, but logging a warning.
        if (body.length() > 4000) {
            log.warn("Message body truncated for conversation {}", conversationId);
            body = body.substring(0, 4000);
        }

        var conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));

        if (conv.getParticipants() == null || !conv.getParticipants().contains(senderId)) {
            throw new IllegalArgumentException("Sender is not a participant of this conversation");
        }

        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setSenderId(senderId);
        msg.setBody(body.trim());
        msg.setCreatedAt(LocalDateTime.now());

        if (conv.getType() == ConversationType.DIRECT && conv.getParticipants().size() == 2) {
            String recipientId = conv.getParticipants().stream()
                    .filter(id -> !id.equals(senderId))
                    .findFirst()
                    .orElse(null);
            msg.setRecipientId(recipientId);
        }

        Message saved = messageRepository.save(msg);

        String preview = body.length() > 100 ? body.substring(0, 100) : body;
        conv.setLastMessagePreview(preview);
        conv.setLastMessageAt(saved.getCreatedAt());
        conv.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conv);

        broadcastMessage(saved);
        return saved;
    }
    
    public void broadcastMessage(Message saved) {
        try {
            com.blink.chatservice.websocket.dto.RealtimeMessageResponse resp = new com.blink.chatservice.websocket.dto.RealtimeMessageResponse(
                    saved.getId(),
                    saved.getConversationId(),
                    saved.getSenderId(),
                    saved.getRecipientId(),
                    saved.getBody(),
                    saved.getCreatedAt()
            );
            
            String conversationTopic = "/topic/conversations/" + saved.getConversationId();
            messagingTemplate.convertAndSend(conversationTopic, resp);
            
            // Sending to user specific queues for notifications/list updates.
            if (saved.getRecipientId() != null && saved.getSenderId() != null) {
                messagingTemplate.convertAndSendToUser(
                        saved.getRecipientId(),
                        "/queue/messages",
                        resp
                );
                messagingTemplate.convertAndSendToUser(
                        saved.getSenderId(),
                        "/queue/messages",
                        resp
                );
            }
        } catch (Exception e) {
            log.error("Failed to broadcast message {}: {}", saved.getId(), e.getMessage());
        }
    }

    @Override
    public Page<Message> getMessages(String conversationId, int page, int size) {
        return messageRepository.findByConversationIdAndDeletedFalseOrderByCreatedAtDesc(
                conversationId, PageRequest.of(page, size));
    }

    @Override
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = "conversations_v2", key = "#conversationId")
    public void deleteConversation(String conversationId, String userId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));

        if (conv.getType() == ConversationType.DIRECT) {
            if (conv.getParticipants() != null && conv.getParticipants().contains(userId)) {
                Set<String> participants = new HashSet<>(conv.getParticipants());
                participants.remove(userId);
                if (participants.isEmpty()) {
                    conversationRepository.delete(conv);
                } else {
                    conv.setParticipants(participants);
                    conversationRepository.save(conv);
                }
                log.info("User {} deleted conversation {}", userId, conversationId);
            } else {
                throw new IllegalArgumentException("User is not a participant of this conversation");
            }
        } else {
            throw new IllegalArgumentException("Use leaveGroup for group conversations");
        }
    }

    @Override
    public void leaveGroup(String groupId, String userId) {
        try {
            removeUserFromGroup(groupId, userId, userId);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error in leaveGroup for user {} group {}: {}", userId, groupId, e.getMessage(), e);
            throw new RuntimeException("Failed to leave group", e);
        }
    }

    @Override
    @Transactional
    public void deleteMessage(String messageId, String userId) {
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        
        Conversation conv = conversationRepository.findById(msg.getConversationId())
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        
        if (conv.getParticipants() == null || !conv.getParticipants().contains(userId)) {
            throw new IllegalArgumentException("You are not a participant of this conversation");
        }
        
        msg.setDeleted(true);
        messageRepository.save(msg);
        log.info("Message {} deleted by {}", messageId, userId);
    }

    @Override
    @Transactional
    public Conversation createAiConversation(String userId) {
        List<Conversation> conversations = listConversationsForUser(userId);
        Optional<Conversation> existing = conversations.stream()
                .filter(c -> c.getType() == ConversationType.AI_ASSISTANT)
                .findFirst();
        
        if (existing.isPresent()) {
            return existing.get();
        }
        
        Conversation conv = new Conversation();
        conv.setType(ConversationType.AI_ASSISTANT);
        conv.setTitle("AI Assistant");
        conv.setParticipants(new HashSet<>(Arrays.asList(userId, "ai-assistant")));
        conv.setCreatedAt(LocalDateTime.now());
        conv.setUpdatedAt(LocalDateTime.now());
        
        return conversationRepository.save(conv);
    }


    private Conversation getGroupConversation(String groupId) {
        Conversation conv = conversationRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));
        if (conv.getType() != ConversationType.GROUP) {
            throw new IllegalArgumentException("Conversation is not a group");
        }
        return conv;
    }

    private void validateGroupInputs(String groupId, String userId) {
        if (groupId == null || groupId.trim().isEmpty()) throw new IllegalArgumentException("Group ID is required");
        if (userId == null || userId.trim().isEmpty()) throw new IllegalArgumentException("User ID is required");
    }

    private Set<String> getParticipantsSafe(Conversation conv) {
        return conv.getParticipants() != null ? new HashSet<>(conv.getParticipants()) : new HashSet<>();
    }

}
