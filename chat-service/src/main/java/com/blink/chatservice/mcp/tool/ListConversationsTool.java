package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.model.ConversationType;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ListConversationsTool implements McpTool {

    private final ChatService chatService;
    private final UserLookupHelper userLookupHelper;

    @Override
    public String name() {
        return "list_conversations";
    }

    @Override
    public String description() {
        return "List all conversations for the current user.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of("type", "object", "properties", Map.of());
    }

    @Override
    public Object execute(String userId, Map<Object, Object> arguments) {
        List<Conversation> conversations = chatService.listConversationsForUser(userId);
        
        Set<String> allIds = conversations.stream()
                .flatMap(c -> c.getParticipants().stream())
                .collect(Collectors.toSet());

        Map<String, Map<String, Object>> userInfoMap = userLookupHelper.getUserInfoBatch(allIds);

        List<Map<String, Object>> list = conversations.stream().map(c -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", c.getId());
            map.put("type", c.getType().toString());
            map.put("title", c.getTitle() != null ? c.getTitle() : "Untitled");
            map.put("lastMessageAt", c.getLastMessageAt() != null ? 
                c.getLastMessageAt().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")) : null);
            map.put("preview", c.getLastMessagePreview());

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

        return Map.of("conversations", list, "count", list.size());
    }
}
