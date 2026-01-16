package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.websocket.dto.RealtimeMessageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class SendMessageTool implements McpTool {

    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public SendMessageTool(MessageRepository messageRepository, SimpMessagingTemplate messagingTemplate) {
        this.messageRepository = messageRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public String name() {
        return "send_message";
    }

    @Override
    public String description() {
        return "Send a message to a conversation. The message will be sent on behalf of the user who requested it.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "conversationId", Map.of("type", "string", "description", "The ID of the conversation to send the message to"),
                        "content", Map.of("type", "string", "description", "The message content to send")
                ),
                "required", List.of("conversationId", "content")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        try {
            String conversationId = (String) args.get("conversationId");
            String content = (String) args.get("content");

            if (conversationId == null || conversationId.trim().isEmpty()) {
                throw new IllegalArgumentException("conversationId is required");
            }
            if (content == null || content.trim().isEmpty()) {
                throw new IllegalArgumentException("content is required");
            }

            Message msg = new Message();
            msg.setConversationId(conversationId);
            msg.setSenderId(userId);
            msg.setBody(content.trim());
            msg.setCreatedAt(LocalDateTime.now());
            msg.setSeen(false);
            msg.setDeleted(false);

            Message saved = messageRepository.save(msg);
            log.info("MCP tool sent message: conversationId={}, senderId={}, messageId={}", 
                    conversationId, userId, saved.getId());

            // Broadcast message via WebSocket so it appears in real-time
            try {
                RealtimeMessageResponse resp = new RealtimeMessageResponse(
                        saved.getId(),
                        saved.getConversationId(),
                        saved.getSenderId(),
                        saved.getRecipientId(),
                        saved.getBody(),
                        saved.getCreatedAt()
                );

                // Broadcast to conversation topic
                String conversationTopic = "/topic/conversations/" + saved.getConversationId();
                messagingTemplate.convertAndSend(conversationTopic, resp);
                log.debug("Broadcasted MCP message to topic: {}", conversationTopic);

                // Also send via user-specific queues for direct messages
                if (saved.getRecipientId() != null) {
                    messagingTemplate.convertAndSendToUser(
                            saved.getSenderId(),
                            "/queue/messages",
                            resp
                    );
                    messagingTemplate.convertAndSendToUser(
                            saved.getRecipientId(),
                            "/queue/messages",
                            resp
                    );
                }
            } catch (Exception e) {
                log.error("Failed to broadcast MCP message via WebSocket", e);
                // Don't fail the tool execution if WebSocket broadcast fails
            }

            return Map.of(
                    "success", true,
                    "messageId", saved.getId(),
                    "conversationId", saved.getConversationId(),
                    "content", saved.getBody(),
                    "createdAt", saved.getCreatedAt().toString()
            );
        } catch (Exception e) {
            log.error("Error executing send_message tool", e);
            throw new RuntimeException("Failed to send message: " + e.getMessage(), e);
        }
    }
}

