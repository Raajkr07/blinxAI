package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.service.ChatService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class GetOrCreateConversationTool implements McpTool {

    private final ChatService chatService;

    public GetOrCreateConversationTool(ChatService chatService) {
        this.chatService = chatService;
    }

    @Override
    public String name() {
        return "get_or_create_conversation";
    }

    @Override
    public String description() {
        return "Get or create a direct conversation with another user. Use this before sending a message to a specific user.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "recipientId", Map.of(
                                "type", "string",
                                "description", "The ID of the user to start a conversation with"
                        )
                ),
                "required", List.of("recipientId")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String recipientId = (String) args.get("recipientId");
        
        if (recipientId == null || recipientId.trim().isEmpty()) {
            return Map.of(
                    "error", true,
                    "message", "recipientId is required"
            );
        }

        if (recipientId.equals(userId)) {
            return Map.of(
                    "error", true,
                    "message", "Cannot create conversation with yourself"
            );
        }

        try {
            // createDirectConversation already handles finding existing conversations
            Conversation conversation = chatService.createDirectConversation(userId, recipientId);
            
            log.info("Conversation access: {} -> {}", userId, recipientId);

            return Map.of(
                    "success", true,
                    "conversationId", conversation.getId(),
                    "type", conversation.getType().toString(),
                    "participants", conversation.getParticipants()
            );
        } catch (Exception e) {
            log.error("Error getting/creating conversation", e);
            return Map.of(
                    "error", true,
                    "message", "Failed to create conversation: " + e.getMessage()
            );
        }
    }
}
