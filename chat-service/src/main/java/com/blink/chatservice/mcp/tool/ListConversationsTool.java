package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.model.ConversationType;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class ListConversationsTool implements McpTool {

    private final ChatService chatService;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "list_conversations";
    }

    @Override
    public String description() {
        return "Show all the user's chats — who they've been talking to, last message preview, and timestamps.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of("type", "object", "properties", Map.of());
    }

    @Override
    public Object execute(String userId, Map<String, Object> arguments) {
        try {
            List<Conversation> conversations = chatService.listConversationsForUser(userId);

            if (conversations == null || conversations.isEmpty()) {
                return Map.of("success", true, "conversations", List.of(), "count", 0,
                    "message", "No conversations yet. Start one by messaging someone!");
            }

            Set<String> allIds = conversations.stream()
                    .flatMap(c -> c.getParticipants().stream())
                    .collect(Collectors.toSet());

            Map<String, Map<String, Object>> userInfoMap = userLookupHelper.getUserInfoBatch(allIds);

            List<Map<String, Object>> list = conversations.stream().map(c -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", c.getId());
                map.put("type", c.getType().toString());
                map.put("title", c.getTitle() != null ? c.getTitle() : "Untitled");
                map.put("lastMessageAt", c.getLastMessageAt() != null ?
                    c.getLastMessageAt().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")) : null);
                map.put("preview", c.getLastMessagePreview() != null ? c.getLastMessagePreview() : "");

                List<Map<String, Object>> participants = c.getParticipants().stream()
                    .map(pId -> userInfoMap.getOrDefault(pId, Map.of("id", pId, "displayName", "Unknown")))
                    .toList();
                map.put("participants", participants);

                if (c.getType() == ConversationType.DIRECT && c.getParticipants().size() == 2) {
                    c.getParticipants().stream().filter(p -> !p.equals(userId)).findFirst().ifPresent(otherId -> {
                        Map<String, Object> other = userInfoMap.get(otherId);
                        if (other != null) map.put("friendlyTitle", "Chat with " + other.get("displayName"));
                    });
                }
                return map;
            }).toList();

            return Map.of("success", true, "conversations", list, "count", list.size());

        } catch (Exception e) {
            log.error("Failed to list conversations for user {}: {}", userId, e.getMessage(), e);
            return Map.of("success", false, "message", "Couldn't load your conversations right now. Please try again.");
        }
    }
}
