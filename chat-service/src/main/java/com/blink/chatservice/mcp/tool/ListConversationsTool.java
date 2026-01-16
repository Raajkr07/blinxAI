package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.service.ChatService;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
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
        return "List conversations for the current user";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of("type", "object", "properties", Map.of());
    }

    @Override
    public Object execute(String userId, Map<String, Object> arguments) {
        return chatService.listConversationsForUser(userId);
    }
}

