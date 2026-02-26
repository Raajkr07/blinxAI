package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class ViewConversationTool implements McpTool {

    private final MessageRepository messageRepository;
    private final UserLookupHelper userLookupHelper;
    private final ChatService chatService;

    @Override
    public String name() {
        return "view_conversation";
    }

    @Override
    public String description() {
        return "Read recent messages from a chat. Use to check what was said before replying or summarizing.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "conversationId", Map.of("type", "string", "description", "Conversation ID to view"),
                "targetUser", Map.of("type", "string", "description", "Username/email/phone — view chat with this person"),
                "limit", Map.of("type", "integer", "description", "How many messages to fetch (default 20, max 100)", "default", 20)
            )
        );
    }

    @Override
    public Object execute(String userId, Map<String, Object> args) {
        String convId = (String) args.get("conversationId");
        String targetUser = (String) args.get("targetUser");

        try {
            if (convId == null && targetUser != null && !targetUser.isBlank()) {
                User user = userLookupHelper.resolveUser(targetUser.trim(), userId);
                if (user == null) {
                    return Map.of("success", false,
                        "message", "Couldn't find '" + targetUser + "' on BlinX. Try their exact username or email.");
                }
                Conversation conversation = chatService.createDirectConversation(userId, user.getId());
                if (conversation == null) {
                    return Map.of("success", false, "message", "No conversation found with " + targetUser + ".");
                }
                convId = conversation.getId();
            }

            if (convId == null || convId.isBlank()) {
                return Map.of("success", false,
                    "message", "Which chat should I look at? Give me a person's name or a conversation ID.");
            }

            // Safe limit parsing
            int limit = 20;
            Object limitObj = args.get("limit");
            if (limitObj != null) {
                try {
                    limit = limitObj instanceof Number ? ((Number) limitObj).intValue() : Integer.parseInt(limitObj.toString());
                    limit = Math.max(1, Math.min(limit, 100));
                } catch (NumberFormatException e) {
                    log.warn("Invalid limit value '{}', using default 20", limitObj);
                }
            }

            List<Message> messages = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(
                    convId, PageRequest.of(0, limit))
                .getContent().stream()
                .sorted(Comparator.comparing(Message::getCreatedAt))
                .toList();

            if (messages.isEmpty()) {
                return Map.of("success", true, "messages", List.of(), "count", 0,
                    "conversationId", convId, "message", "No messages in this conversation yet.");
            }

            Set<String> senderIds = messages.stream().map(Message::getSenderId).collect(Collectors.toSet());
            Map<String, Map<String, Object>> userInfoMap = userLookupHelper.getUserInfoBatch(senderIds);

            List<Map<String, Object>> list = messages.stream().map(m -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", m.getId());
                map.put("senderId", m.getSenderId());
                map.put("content", m.getBody());
                map.put("createdAt", m.getCreatedAt().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")));
                map.put("sender", userInfoMap.getOrDefault(m.getSenderId(),
                    Map.of("id", m.getSenderId(), "displayName", "Unknown")));
                return map;
            }).toList();

            return Map.of("success", true, "messages", list, "count", list.size(), "conversationId", convId);

        } catch (Exception e) {
            log.error("Failed to view conversation for user {} (conv/target: '{}'): {}",
                    userId, convId != null ? convId : targetUser, e.getMessage(), e);
            return Map.of("success", false, "message", "Couldn't load the conversation right now. Please try again.");
        }
    }
}
