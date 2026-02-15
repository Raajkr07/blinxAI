package com.blink.chatservice.mcp.tool;

import com.blink.chatservice.chat.entity.Conversation;
import com.blink.chatservice.chat.entity.Message;
import com.blink.chatservice.chat.repository.MessageRepository;
import com.blink.chatservice.chat.service.ChatService;
import com.blink.chatservice.mcp.tool.helper.UserLookupHelper;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ViewConversationTool implements McpTool {

    private final MessageRepository messageRepository;
    private final UserLookupHelper userLookupHelper;
    private final ChatService chatService;
    private final UserService userService;

    @Override
    public String name() {
        return "view_conversation";
    }

    @Override
    public String description() {
        return "Get recent messages from a conversation or a specific user.";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "conversationId", Map.of("type", "string", "description", "Conversation ID"),
                "targetUser", Map.of("type", "string", "description", "The user to view chat with"),
                "limit", Map.of("type", "integer", "description", "Max messages", "default", 20)
            )
        );
    }

    @Override
    public Object execute(String userId, Map<Object, Object> args) {
        String convId = (String) args.get("conversationId");
        String targetUser = (String) args.get("targetUser");

        if (convId == null && targetUser != null) {
            User user = resolveUser(targetUser, userId);
            if (user != null) {
                Conversation conversation = chatService.createDirectConversation(userId, user.getId());
                convId = conversation.getId();
            } else {
                return Map.of("error", true, "message", "User not found: " + targetUser);
            }
        }

        if (convId == null || convId.isBlank()) {
            return Map.of("error", true, "message", "conversationId or targetUser required");
        }

        int limit = args.get("limit") != null ? ((Number) args.get("limit")).intValue() : 20;
        limit = Math.min(limit, 100);

        List<Message> messages = messageRepository.findByConversationIdAndDeletedFalseOrderByIdDesc(convId, PageRequest.of(0, limit))
            .getContent().stream()
            .sorted(Comparator.comparing(Message::getCreatedAt))
            .toList();

        Set<String> senderIds = messages.stream().map(Message::getSenderId).collect(Collectors.toSet());
        Map<String, Map<String, Object>> userInfoMap = userLookupHelper.getUserInfoBatch(senderIds);

        List<Map<String, Object>> list = messages.stream().map(m -> Map.of(
            "id", m.getId(),
            "senderId", m.getSenderId(),
            "content", m.getBody(),
            "createdAt", m.getCreatedAt(),
            "sender", userInfoMap.getOrDefault(m.getSenderId(), Map.of("id", m.getSenderId(), "displayName", "Unknown"))
        )).toList();

        return Map.of("messages", list, "count", list.size(), "conversationId", convId);
    }

    private User resolveUser(String identifier, String currentUserId) {
        User u = userLookupHelper.findUserByIdentifier(identifier);
        if (u != null) return u;
        
        List<User> users = userService.searchUsersByContact(identifier, currentUserId);
        if (!users.isEmpty()) return users.get(0);
        
        return null;
    }
}
