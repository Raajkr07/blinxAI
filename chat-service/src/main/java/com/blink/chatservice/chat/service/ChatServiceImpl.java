package com.blink.chatservice.chat.service;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.model.ConversationType;
import com.blink.chatservice.chat.repository.ConversationRepository;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    @Tool(name = "createConversation", description = "Create a direct conversation with a user.")
    @Override
    @Transactional
    public Conversation createDirectConversation(String me, String otherUserContact) {
        if (otherUserContact == null || otherUserContact.isBlank()) throw new IllegalArgumentException("Contact required");
        
        String otherUserId = userService.resolveUserIdFromContact(otherUserContact.trim());
        if (otherUserId == null) throw new IllegalArgumentException("User not found: " + otherUserContact);
        if (me.equals(otherUserId)) throw new IllegalArgumentException("Cannot chat with self");

        List<String> participants = List.of(me, otherUserId);
        return conversationRepository.findDirectByParticipants(ConversationType.DIRECT, participants)
                .or(() -> conversationRepository.findDirectByParticipants(ConversationType.DIRECT, List.of(otherUserId, me)))
                .orElseGet(() -> {
                    Conversation conv = new Conversation();
                    conv.setType(ConversationType.DIRECT);
                    conv.setParticipants(new HashSet<>(participants));
                    conv.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                    conv.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                    Conversation saved = conversationRepository.save(conv);
                    saved.getParticipants().forEach(uid -> messagingTemplate.convertAndSendToUser(uid, "/queue/conversations/new", saved));
                    return saved;
                });
    }

    @Override
    @Transactional
    public Conversation createGroupConversation(String creatorId, String title, Set<String> participantIds) {
        Conversation conv = new Conversation();
        conv.setType(ConversationType.GROUP);
        conv.setTitle(title != null ? title.trim() : "Untitled Group");
        Set<String> participants = participantIds != null ? new HashSet<>(participantIds) : new HashSet<>();
        participants.add(creatorId);
        conv.setParticipants(participants);
        conv.setAdmins(new HashSet<>(Collections.singletonList(creatorId)));
        conv.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        conv.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        return conversationRepository.save(conv);
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
        Conversation conv = getGroupOrThrow(groupId);
        if (!userRepository.existsById(userId.trim())) throw new IllegalArgumentException("User not found");
        
        Set<String> participants = conv.getParticipants() != null ? new HashSet<>(conv.getParticipants()) : new HashSet<>();
        if (participants.add(userId.trim())) {
            conv.setParticipants(participants);
            conv.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
            return conversationRepository.save(conv);
        }
        return conv;
    }

    @Override
    @Transactional
    @CacheEvict(value = "conversations_v2", key = "#groupId")
    public Conversation removeUserFromGroup(String groupId, String userId, String requesterId) {
        Conversation conv = getGroupOrThrow(groupId);
        if (!conv.getAdmins().contains(requesterId) && !requesterId.equals(userId)) throw new IllegalArgumentException("Unauthorized");

        Set<String> participants = new HashSet<>(conv.getParticipants());
        if (!participants.remove(userId)) throw new IllegalArgumentException("User not in group");
        if (participants.isEmpty()) throw new IllegalArgumentException("Cannot remove last participant");

        conv.setParticipants(participants);
        if (conv.getAdmins() != null) conv.getAdmins().remove(userId);
        conv.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        return conversationRepository.save(conv);
    }

    @Override
    @Transactional
    @CacheEvict(value = "conversations_v2", key = "#groupId")
    public Conversation updateGroup(String groupId, String requesterId, String title, String avatarUrl) {
        Conversation conv = getGroupOrThrow(groupId);
        if (!conv.getAdmins().contains(requesterId)) throw new IllegalArgumentException("Unauthorized");

        if (title != null && !title.isBlank()) conv.setTitle(title.trim());
        if (avatarUrl != null) conv.setAvatarUrl(avatarUrl.isBlank() ? null : avatarUrl.trim());
        
        conv.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        return conversationRepository.save(conv);
    }

    @Tool(name = "getConversation", description = "Get details for a specific conversation.")
    @Override
    @Cacheable(value = "conversations_v2", key = "#conversationId")
    public Conversation getConversation(String conversationId) {
        return conversationRepository.findById(conversationId).orElseThrow(() -> new IllegalArgumentException("Not found"));
    }

    @Tool(name = "sendMessage", description = "Send a message to a conversation.")
    @Override
    @Transactional
    @CacheEvict(value = "conversations_v2", key = "#conversationId")
    public Message sendMessage(String conversationId, String senderId, String body) {
        if (body == null || body.isBlank()) throw new IllegalArgumentException("Body required");
        
        Conversation conv = conversationRepository.findById(conversationId).orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        if (!conv.getParticipants().contains(senderId)) throw new IllegalArgumentException("Unauthorized");

        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setSenderId(senderId);
        msg.setBody(body.length() > 4000 ? body.substring(0, 4000) : body.trim());
        msg.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));

        if (conv.getType() == ConversationType.DIRECT) {
            conv.getParticipants().stream().filter(id -> !id.equals(senderId)).findFirst().ifPresent(msg::setRecipientId);
        }

        Message saved = messageRepository.save(msg);
        conv.setLastMessagePreview(msg.getBody().substring(0, Math.min(msg.getBody().length(), 100)));
        conv.setLastMessageAt(saved.getCreatedAt());
        conv.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
        conversationRepository.save(conv);

        broadcast(saved);
        return saved;
    }

    private void broadcast(Message msg) {
        CompletableFuture.runAsync(() -> {
            var resp = new com.blink.chatservice.websocket.dto.RealtimeMessageResponse(msg.getId(), msg.getConversationId(), msg.getSenderId(), msg.getRecipientId(), msg.getBody(), msg.getCreatedAt());
            messagingTemplate.convertAndSend("/topic/conversations/" + msg.getConversationId(), resp);
            if (msg.getRecipientId() != null) messagingTemplate.convertAndSendToUser(msg.getRecipientId(), "/queue/messages", resp);
            messagingTemplate.convertAndSendToUser(msg.getSenderId(), "/queue/messages", resp);
        });
    }

    @Override
    public Page<Message> getMessages(String conversationId, int page, int size) {
        return messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(conversationId, PageRequest.of(page, size));
    }

    @Override
    @Transactional
    @CacheEvict(value = "conversations_v2", key = "#conversationId")
    public void deleteConversation(String conversationId, String userId) {
        Conversation conv = conversationRepository.findById(conversationId).orElseThrow(() -> new IllegalArgumentException("Not found"));
        if (conv.getType() != ConversationType.DIRECT) throw new IllegalArgumentException("Use leaveGroup for groups");
        if (!conv.getParticipants().contains(userId)) throw new IllegalArgumentException("Unauthorized");

        Set<String> participants = new HashSet<>(conv.getParticipants());
        participants.remove(userId);
        if (participants.isEmpty()) conversationRepository.delete(conv);
        else {
            conv.setParticipants(participants);
            conversationRepository.save(conv);
        }
    }

    @Override
    public void leaveGroup(String groupId, String userId) {
        removeUserFromGroup(groupId, userId, userId);
    }

    @Override
    @Transactional
    public void deleteMessage(String messageId, String userId) {
        Message msg = messageRepository.findById(messageId).orElseThrow(() -> new IllegalArgumentException("Message not found"));
        Conversation conv = conversationRepository.findById(msg.getConversationId()).orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        if (!conv.getParticipants().contains(userId)) throw new IllegalArgumentException("Unauthorized");

        msg.setDeleted(true);
        messageRepository.save(msg);
    }

    @Override
    @Transactional
    public Conversation createAiConversation(String userId) {
        return conversationRepository.findByParticipantsContainingAndType(userId, ConversationType.AI_ASSISTANT).stream().findFirst()
                .orElseGet(() -> {
                    Conversation conv = new Conversation();
                    conv.setType(ConversationType.AI_ASSISTANT);
                    conv.setTitle("AI Assistant");
                    conv.setParticipants(new HashSet<>(Arrays.asList(userId, "ai-assistant")));
                    conv.setCreatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                    conv.setUpdatedAt(LocalDateTime.now(ZoneId.of("UTC")));
                    return conversationRepository.save(conv);
                });
    }

    private Conversation getGroupOrThrow(String id) {
        Conversation conv = conversationRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Group not found"));
        if (conv.getType() != ConversationType.GROUP) throw new IllegalArgumentException("Not a group");
        return conv;
    }
}
