package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@Slf4j
public class ViewConversationTool implements McpTool {

    private final MessageRepository messageRepository;

    public ViewConversationTool(MessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    @Override
    public String name() {
        return "view_conversation";
    }

    @Override
    public String description() {
        return "Get recent messages from a conversation. Returns message details including sender, content, and timestamp.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "conversationId", Map.of(
                                "type", "string",
                                "description", "The ID of the conversation to view"
                        ),
                        "limit", Map.of(
                                "type", "integer",
                                "description", "Maximum number of messages to retrieve (default: 20, max: 100)",
                                "default", 20
                        )
                ),
                "required", List.of("conversationId")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        try {
            String conversationId = (String) args.get("conversationId");
            if (conversationId == null || conversationId.trim().isEmpty()) {
                return Map.of(
                        "error", true,
                        "message", "conversationId is required"
                );
            }

            // Limit to max 100 messages for performance
            Integer limit = args.get("limit") != null ? (Integer) args.get("limit") : 20;
            limit = Math.min(limit, 100);

            List<Message> messages = messageRepository
                    .findByConversationIdAndDeletedFalseOrderByCreatedAtDesc(conversationId,
                            org.springframework.data.domain.PageRequest.of(0, limit))
                    .getContent()
                    .stream()
                    .sorted((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                    .collect(Collectors.toList());

            log.info("Retrieved {} messages from conversation: {} for user: {}", 
                    messages.size(), conversationId, userId);

            return Map.of(
                    "messages", messages.stream()
                            .map(m -> Map.of(
                                    "id", m.getId(),
                                    "senderId", m.getSenderId(),
                                    "content", m.getBody(),
                                    "createdAt", m.getCreatedAt().toString(),
                                    "seen", m.isSeen()
                            ))
                            .collect(Collectors.toList()),
                    "count", messages.size(),
                    "conversationId", conversationId
            );
        } catch (Exception e) {
            log.error("Error viewing conversation", e);
            return Map.of(
                    "error", true,
                    "message", "Failed to view conversation: " + e.getMessage()
            );
        }
    }
}
