package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@RequiredArgsConstructor
public class ViewConversationTool implements McpTool {

    private final MessageRepository messageRepository;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "view_conversation";
    }

    @Override
    public String description() {
        return "Get recent messages from a conversation.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "conversationId", Map.of("type", "string", "description", "Conversation ID"),
                "limit", Map.of("type", "integer", "description", "Max messages", "default", 20)
            ),
            "required", List.of("conversationId")
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String convId = (String) args.get("conversationId");
        if (convId == null || convId.isBlank()) return Map.of("error", true, "message", "conversationId required");

        int limit = args.get("limit") != null ? ((Number) args.get("limit")).intValue() : 20;
        limit = Math.min(limit, 100);

        var messages = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(convId, PageRequest.of(0, limit))
            .getContent().stream()
            .sorted(Comparator.comparing(m -> m.getCreatedAt()))
            .toList();

        var senderIds = messages.stream().map(m -> m.getSenderId()).collect(java.util.stream.Collectors.toSet());
        var userInfoMap = userLookupHelper.getUserInfoBatch(senderIds);

        var list = messages.stream().map(m -> Map.of(
            "id", m.getId(),
            "senderId", m.getSenderId(),
            "content", m.getBody(),
            "createdAt", m.getCreatedAt(),
            "sender", userInfoMap.getOrDefault(m.getSenderId(), Map.of("id", m.getSenderId(), "displayName", "Unknown"))
        )).toList();

        return Map.of("messages", list, "count", list.size(), "conversationId", convId);
    }
}
