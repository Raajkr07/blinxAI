package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
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
        return "Get messages from a conversation";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "conversationId", Map.of("type", "string"),
                        "limit", Map.of("type", "integer", "default", 20)
                ),
                "required", List.of("conversationId")
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String conversationId = (String) args.get("conversationId");
        Integer limit = (Integer) args.getOrDefault("limit", 20);

        List<Message> messages = messageRepository
                .findByConversationIdAndDeletedFalseOrderByCreatedAtDesc(conversationId,
                        org.springframework.data.domain.PageRequest.of(0, limit))
                .getContent()
                .stream()
                .sorted((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                .collect(Collectors.toList());

        return messages.stream()
                .map(m -> Map.of(
                        "senderId", m.getSenderId(),
                        "content", m.getBody(),
                        "createdAt", m.getCreatedAt().toString()
                ))
                .collect(Collectors.toList());
    }
}
