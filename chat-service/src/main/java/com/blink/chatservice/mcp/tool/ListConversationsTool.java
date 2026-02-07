package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.service.ChatService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@Slf4j
public class ListConversationsTool implements McpTool {

    private final ChatService chatService;

    public ListConversationsTool(ChatService chatService) {
        this.chatService = chatService;
    }

    @Override
    public String name() {
        return "list_conversations";
    }

    @Override
    public String description() {
        return "List all conversations for the current user with details (ID, type, participants, last message).";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of("type", "object", "properties", Map.of());
    }

    @Override
    public Object execute(String userId, Map<Object, Object> arguments) {
        try {
            List<Conversation> conversations = chatService.listConversationsForUser(userId);
            
            log.info("Listing {} conversations for user: {}", conversations.size(), userId);
            
            return Map.of(
                    "conversations", conversations.stream()
                            .map(conv -> Map.of(
                                    "id", conv.getId(),
                                    "type", conv.getType().toString(),
                                    "title", conv.getTitle() != null ? conv.getTitle() : "Untitled",
                                    "participants", conv.getParticipants() != null ? conv.getParticipants() : List.of(),
                                    "lastMessageAt", conv.getLastMessageAt() != null ? conv.getLastMessageAt().toString() : "",
                                    "lastMessagePreview", conv.getLastMessagePreview() != null ? conv.getLastMessagePreview() : ""
                            ))
                            .collect(Collectors.toList()),
                    "count", conversations.size()
            );
        } catch (Exception e) {
            log.error("Error listing conversations for user: {}", userId, e);
            return Map.of(
                    "error", true,
                    "message", "Failed to list conversations: " + e.getMessage(),
                    "conversations", List.of(),
                    "count", 0
            );
        }
    }
}

